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
import { normalizeMatchContactInput, normalizeNicknameInput } from 'lib/profileFields';
import { isValidTargetGender } from 'lib/rose';
import { readJson } from 'lib/request';
import { bizError, httpError, success } from 'lib/response';
import { getDeepQuestionNumbers } from 'lib/matchQuestionnaireConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY = 'love';

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
      purpose: 'love_questionnaire_get'
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
    console.error('GET /api/love-questionnaire failed:', error);
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
      purpose: 'love_questionnaire_save'
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

      // 深度问卷：必须对配置中心里的每一题都完成作答
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
      const nicknameResult = normalizeNicknameInput(merged.match_settings.nickname);
      if (!nicknameResult.ok) {
        return bizError(400, nicknameResult.msg);
      }
      const includeMessage = Boolean(merged.match_settings.include_message_to_partner);
      const rawMessage = typeof merged.match_settings.message_to_partner === 'string'
        ? merged.match_settings.message_to_partner.trim()
        : '';
      if (includeMessage) {
        const len = [...rawMessage].length;
        if (len < 1 || len > 200) {
          return bizError(400, '选择“有对对方想说的话”时，请填写想说的话（1～200字）');
        }
      }
      if (!matchSettingsComplete({
        ...merged.match_settings,
        share_contact_with_match: contactResult.share,
        match_contact_detail: contactResult.detail,
        include_message_to_partner: includeMessage,
        message_to_partner: includeMessage ? rawMessage : ''
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
            message_to_partner = $4,
            auto_weekly_match = $5,
            nickname = $6
        WHERE id = $7
        `,
        [
          tg,
          contactResult.share,
          contactResult.detail,
          includeMessage ? rawMessage : '',
          Boolean(merged.match_settings.auto_participate_weekly_match),
          nicknameResult.value || '',
          authResult.user.id
        ]
      );

      merged.match_settings.nickname = nicknameResult.value;
      merged.match_settings.share_contact_with_match = contactResult.share;
      merged.match_settings.match_contact_detail = contactResult.detail;
      merged.match_settings.include_message_to_partner = includeMessage;
      merged.match_settings.message_to_partner = includeMessage ? rawMessage : '';
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
    console.error('POST /api/love-questionnaire failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
