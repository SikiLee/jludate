import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId, ensureRespondentIdForUser } from 'lib/identityLink';
import {
  hardFilterStepComplete,
  matchSettingsComplete,
  normalizeLoveQuestionnairePayload,
  deepSurveyComplete
} from 'lib/loveQuestionnaire';
import { normalizeMatchContactInput } from 'lib/profileFields';
import { isValidTargetGender } from 'lib/rose';
import { readJson } from 'lib/request';
import { bizError, httpError, success } from 'lib/response';
import { getDeepQuestionNumbers } from 'lib/matchQuestionnaireConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY = 'friend';

function mergePayload(prev, incoming) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  return normalizeLoveQuestionnairePayload({
    hard_filter: { ...base.hard_filter, ...inc.hard_filter },
    deep_survey: { ...base.deep_survey, ...inc.deep_survey },
    match_settings: { ...base.match_settings, ...inc.match_settings }
  });
}

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const respondentId = await getRespondentIdByUserId(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'friend_questionnaire_get'
    });

    if (!respondentId) {
      return success('success', {
        payload: normalizeLoveQuestionnairePayload({}),
        current_step: 0,
        completed: false,
        updated_at: null
      });
    }

    const result = await surveyPool.query(
      `
      SELECT payload, current_step, completed, updated_at
      FROM unidate_app.match_questionnaire_drafts
      WHERE respondent_id = $1 AND category = $2
      LIMIT 1
      `,
      [respondentId, CATEGORY]
    );

    if (result.rowCount === 0) {
      return success('success', {
        payload: normalizeLoveQuestionnairePayload({}),
        current_step: 0,
        completed: false,
        updated_at: null
      });
    }

    const row = result.rows[0];
    return success('success', {
      payload: normalizeLoveQuestionnairePayload(row.payload || {}),
      current_step: Number(row.current_step) || 0,
      completed: Boolean(row.completed),
      updated_at: row.updated_at
    });
  } catch (error) {
    console.error('GET /api/friend-questionnaire failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const finalize = Boolean(body?.finalize);
    const currentStep = Number.isInteger(Number(body?.current_step))
      ? Math.max(0, Math.min(2, Number(body.current_step)))
      : null;

    const respondentId = await ensureRespondentIdForUser(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'friend_questionnaire_save'
    });

    const existingResult = await surveyPool.query(
      `
      SELECT payload, current_step, completed
      FROM unidate_app.match_questionnaire_drafts
      WHERE respondent_id = $1 AND category = $2
      LIMIT 1
      `,
      [respondentId, CATEGORY]
    );

    const prevPayload = existingResult.rowCount > 0 ? existingResult.rows[0].payload : {};
    const merged = mergePayload(prevPayload, {
      hard_filter: body?.hard_filter,
      deep_survey: body?.deep_survey,
      match_settings: body?.match_settings
    });

    if (finalize) {
      if (!hardFilterStepComplete(merged.hard_filter)) {
        return bizError(400, '请完成硬筛选');
      }

      const deepQuestionNumbers = await getDeepQuestionNumbers(surveyPool, CATEGORY);
      if (!deepSurveyComplete(merged.deep_survey, deepQuestionNumbers)) {
        return bizError(400, '请完成深度问卷');
      }

      const contactBody = {
        share_contact_with_match: merged.match_settings.share_contact_with_match,
        match_contact_detail: merged.match_settings.match_contact_detail
      };
      const contactResult = normalizeMatchContactInput(contactBody);
      if (!contactResult.ok) {
        return bizError(400, contactResult.msg);
      }
      if (!matchSettingsComplete({
        ...merged.match_settings,
        share_contact_with_match: contactResult.share,
        match_contact_detail: contactResult.detail
      })) {
        return bizError(400, '请完善匹配设置');
      }
      const tg = merged.hard_filter.target_gender;
      if (!isValidTargetGender(tg)) {
        return bizError(400, '匹配性别无效');
      }

      await identityPool.query(
        `
        UPDATE unidate_app.users
        SET target_gender = $1,
            share_contact_with_match = $2,
            match_contact_detail = $3,
            auto_weekly_match = $4
        WHERE id = $5
        `,
        [
          tg,
          contactResult.share,
          contactResult.detail,
          Boolean(merged.match_settings.auto_participate_weekly_match),
          authResult.user.id
        ]
      );

      merged.match_settings.share_contact_with_match = contactResult.share;
      merged.match_settings.match_contact_detail = contactResult.detail;
    }

    const nextStep = currentStep !== null
      ? currentStep
      : (existingResult.rowCount > 0 ? existingResult.rows[0].current_step : 0);
    const completedFlag = finalize ? true : (existingResult.rowCount > 0 ? existingResult.rows[0].completed : false);

    await surveyPool.query(
      `
      INSERT INTO unidate_app.match_questionnaire_drafts(
        respondent_id, category, payload, current_step, completed, updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
      ON CONFLICT (respondent_id, category)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        current_step = EXCLUDED.current_step,
        completed = EXCLUDED.completed,
        updated_at = NOW()
      `,
      [respondentId, CATEGORY, JSON.stringify(merged), nextStep, completedFlag]
    );

    return success(finalize ? '已保存全部问卷' : '已保存', {
      payload: merged,
      current_step: nextStep,
      completed: completedFlag
    });
  } catch (error) {
    console.error('POST /api/friend-questionnaire failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

