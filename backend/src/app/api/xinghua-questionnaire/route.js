import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId, ensureRespondentIdForUser } from 'lib/identityLink';
import { matchSettingsComplete, normalizeLoveQuestionnairePayload } from 'lib/loveQuestionnaire';
import { normalizeMatchContactInput, normalizeNicknameInput } from 'lib/profileFields';
import { readJson } from 'lib/request';
import { bizError, httpError, success } from 'lib/response';
import { isValidTargetGender } from 'lib/rose';
import { XINGHUA_TI_TYPE_CODE_SET } from 'lib/xinghuaTiTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY = 'xinghua';

const TIME_VALUES = new Set(['sun_am', 'sun_pm', 'any']);

function normalizeTargetXinghuaTi(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s === 'same_as_me' || s === 'any') {
    return s;
  }
  if (s.length === 4 && XINGHUA_TI_TYPE_CODE_SET.has(s)) {
    return s;
  }
  return 'same_as_me';
}

function normalizeXinghuaPayload(raw) {
  const normalized = normalizeLoveQuestionnairePayload(raw || {});
  const hard = raw && typeof raw.hard_filter === 'object' && raw.hard_filter !== null ? raw.hard_filter : {};
  const settings = raw && typeof raw.match_settings === 'object' && raw.match_settings !== null ? raw.match_settings : {};

  const preferredTime = typeof hard.preferred_time === 'string' && TIME_VALUES.has(hard.preferred_time)
    ? hard.preferred_time
    : '';

  const includeMessage = settings.include_message_to_partner === true || settings.include_message_to_partner === 'true';
  const messageToPartner = includeMessage && typeof settings.message_to_partner === 'string'
    ? settings.message_to_partner.trim()
    : '';

  return {
    hard_filter: {
      target_gender: normalized.hard_filter.target_gender,
      accept_cross_campus: normalized.hard_filter.accept_cross_campus,
      age_diff_older_max: normalized.hard_filter.age_diff_older_max,
      age_diff_younger_max: normalized.hard_filter.age_diff_younger_max,
      preferred_time: preferredTime,
      target_xinghua_ti: normalizeTargetXinghuaTi(hard.target_xinghua_ti),
      self_xinghua_ti_type: typeof hard.self_xinghua_ti_type === 'string' && hard.self_xinghua_ti_type.length === 4
        && XINGHUA_TI_TYPE_CODE_SET.has(hard.self_xinghua_ti_type)
        ? hard.self_xinghua_ti_type.trim()
        : ''
    },
    deep_survey: {},
    match_settings: {
      ...normalized.match_settings,
      include_message_to_partner: includeMessage,
      message_to_partner: includeMessage ? messageToPartner : ''
    }
  };
}

function mergePayload(prev, incoming) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  return normalizeXinghuaPayload({
    hard_filter: { ...base.hard_filter, ...inc.hard_filter },
    deep_survey: {}, // xinghua: no deep survey
    match_settings: { ...base.match_settings, ...inc.match_settings }
  });
}

function xinghuaHardFilterComplete(hard) {
  if (!hard || typeof hard !== 'object') {
    return false;
  }
  if (!hard.target_gender || !isValidTargetGender(hard.target_gender)) {
    return false;
  }
  if (!TIME_VALUES.has(hard.preferred_time)) {
    return false;
  }
  if (!(typeof hard.self_xinghua_ti_type === 'string' && hard.self_xinghua_ti_type.length === 4
    && XINGHUA_TI_TYPE_CODE_SET.has(hard.self_xinghua_ti_type))) {
    return false;
  }
  return true;
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
      purpose: 'xinghua_questionnaire_get'
    });

    if (!respondentId) {
      return success('success', {
        payload: normalizeXinghuaPayload({}),
        completed: false,
        updated_at: null
      });
    }

    const result = await surveyPool.query(
      `
      SELECT payload, completed, updated_at
      FROM unidate_app.match_questionnaire_drafts
      WHERE respondent_id = $1 AND category = $2
      LIMIT 1
      `,
      [respondentId, CATEGORY]
    );

    if (result.rowCount === 0) {
      return success('success', {
        payload: normalizeXinghuaPayload({}),
        completed: false,
        updated_at: null
      });
    }

    const row = result.rows[0];
    return success('success', {
      payload: normalizeXinghuaPayload(row.payload || {}),
      completed: Boolean(row.completed),
      updated_at: row.updated_at
    });
  } catch (error) {
    console.error('GET /api/xinghua-questionnaire failed:', error);
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

    const respondentId = await ensureRespondentIdForUser(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'xinghua_questionnaire_save'
    });

    const existingResult = await surveyPool.query(
      `
      SELECT payload, completed
      FROM unidate_app.match_questionnaire_drafts
      WHERE respondent_id = $1 AND category = $2
      LIMIT 1
      `,
      [respondentId, CATEGORY]
    );

    const prevPayload = existingResult.rowCount > 0 ? existingResult.rows[0].payload : {};
    const merged = mergePayload(prevPayload, {
      hard_filter: body?.hard_filter,
      match_settings: body?.match_settings
    });

    if (finalize) {
      if (!xinghuaHardFilterComplete(merged.hard_filter)) {
        return bizError(400, '请完成硬筛选');
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

      await identityPool.query(
        `
        UPDATE unidate_app.users
        SET target_gender = $1,
            share_contact_with_match = $2,
            match_contact_detail = $3,
            message_to_partner = $4,
            xinghua_preferred_time = $5,
            xinghua_match_target_ti = $6,
            xinghua_ti_type = $7,
            auto_weekly_match = TRUE,
            xinghua_festival_participate = TRUE,
            nickname = $8
        WHERE id = $9
        `,
        [
          merged.hard_filter.target_gender,
          contactResult.share,
          contactResult.detail,
          includeMessage ? rawMessage : '',
          merged.hard_filter.preferred_time,
          normalizeTargetXinghuaTi(merged.hard_filter.target_xinghua_ti),
          merged.hard_filter.self_xinghua_ti_type,
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

    const completedFlag = finalize ? true : (existingResult.rowCount > 0 ? existingResult.rows[0].completed : false);

    await surveyPool.query(
      `
      INSERT INTO unidate_app.match_questionnaire_drafts(
        respondent_id, category, payload, current_step, completed, updated_at
      )
      VALUES ($1, $2, $3::jsonb, 0, $4, NOW())
      ON CONFLICT (respondent_id, category)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        current_step = 0,
        completed = EXCLUDED.completed,
        updated_at = NOW()
      `,
      [respondentId, CATEGORY, JSON.stringify(merged), completedFlag]
    );

    return success(finalize ? '已参与杏花节搭子匹配' : '已保存', {
      payload: merged,
      completed: completedFlag
    });
  } catch (error) {
    console.error('POST /api/xinghua-questionnaire failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

