import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import {
  getRespondentIdByUserId,
  getUserMatchDisplayProfileByRespondentId
} from 'lib/identityLink';
import { buildMatchDimensionReasons } from 'lib/rose';
import { getPublicTypeInterpretation } from 'lib/typeInterpretation';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function genderToLabel(value) {
  if (value === 'male') {
    return '男';
  }
  if (value === 'female') {
    return '女';
  }
  return '—';
}

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const currentUserId = authResult.user.id;
    const manualTriggerEnabled = process.env.ALLOW_TEST_TRIGGER === 'true' || process.env.NODE_ENV === 'test';
    const respondentId = await getRespondentIdByUserId(identityPool, currentUserId, {
      actor: `user:${currentUserId}`,
      purpose: 'match_get_self_respondent'
    });
    if (!respondentId) {
      return success('success', {
        matched: false,
        survey_completed: false,
        manual_trigger_enabled: manualTriggerEnabled,
        match_result_id: null,
        match_reasons: [],
        history: [],
        self_rose: null,
        self_rose_name: null,
        type_interpretation: null
      });
    }

    const selfSurveyResult = await surveyPool.query(
      'SELECT rose_code, rose_name FROM unidate_app.survey_responses WHERE respondent_id = $1 LIMIT 1',
      [respondentId]
    );
    const surveyCompleted = selfSurveyResult.rowCount > 0;
    const selfRoseCode = selfSurveyResult.rowCount > 0 ? selfSurveyResult.rows[0].rose_code : null;
    const selfRoseName = selfSurveyResult.rowCount > 0 ? selfSurveyResult.rows[0].rose_name : null;
    const selfTypeInterpretation = await getPublicTypeInterpretation(surveyPool, selfRoseCode);

    const matchResult = await surveyPool.query(
      `
      SELECT
        mr.id,
        mr.run_id,
        mr.respondent1_id,
        mr.respondent2_id,
        mr.final_match_percent,
        mr.user1_rose_code,
        mr.user2_rose_code,
        mr.created_at,
        mrun.created_at AS run_created_at
      FROM unidate_app.match_results mr
      INNER JOIN unidate_app.match_runs mrun ON mrun.id = mr.run_id
      WHERE mr.respondent1_id = $1 OR mr.respondent2_id = $1
      ORDER BY mrun.created_at DESC, mr.id DESC
      LIMIT 20
      `,
      [respondentId]
    );

    if (matchResult.rowCount === 0) {
      return success('success', {
        matched: false,
        survey_completed: surveyCompleted,
        manual_trigger_enabled: manualTriggerEnabled,
        match_result_id: null,
        match_reasons: [],
        history: [],
        self_rose: selfRoseCode,
        self_rose_name: selfRoseName,
        type_interpretation: selfTypeInterpretation
      });
    }

    const history = [];
    for (const row of matchResult.rows) {
      const partnerRespondentId = row.respondent1_id === respondentId ? row.respondent2_id : row.respondent1_id;
      const selfRose = row.respondent1_id === respondentId ? row.user1_rose_code : row.user2_rose_code;
      const partnerRose = row.respondent1_id === respondentId ? row.user2_rose_code : row.user1_rose_code;

      const partnerProfile = await getUserMatchDisplayProfileByRespondentId(
        identityPool,
        partnerRespondentId,
        {
          actor: `user:${currentUserId}`,
          purpose: 'match_get_partner_display_profile'
        }
      );

      if (!partnerProfile) {
        continue;
      }

      history.push({
        match_result_id: row.id,
        run_id: row.run_id,
        partner_nickname: partnerProfile.nickname || '',
        partner_gender_label: genderToLabel(partnerProfile.gender),
        partner_campus: partnerProfile.campus || '—',
        partner_college: partnerProfile.college || '—',
        partner_grade: partnerProfile.grade || '—',
        partner_message_to_partner: partnerProfile.message_to_partner || '',
        partner_contact_for_match: partnerProfile.partner_contact_for_match || '',
        match_percent: Number(row.final_match_percent),
        self_rose: selfRose,
        partner_rose: partnerRose,
        run_at: row.run_created_at || row.created_at
      });
    }

    if (history.length === 0) {
      return success('success', {
        matched: false,
        survey_completed: surveyCompleted,
        manual_trigger_enabled: manualTriggerEnabled,
        match_result_id: null,
        match_reasons: [],
        history: [],
        self_rose: selfRoseCode,
        self_rose_name: selfRoseName,
        type_interpretation: selfTypeInterpretation
      });
    }

    const latestMatch = history[0];
    const effectiveSelfRose = latestMatch.self_rose || selfRoseCode;
    const effectiveTypeInterpretation = effectiveSelfRose === selfRoseCode
      ? selfTypeInterpretation
      : await getPublicTypeInterpretation(surveyPool, effectiveSelfRose);
    const dimensionReasons = buildMatchDimensionReasons(latestMatch.self_rose, latestMatch.partner_rose);

    return success('success', {
      matched: true,
      survey_completed: surveyCompleted,
      manual_trigger_enabled: manualTriggerEnabled,
      match_result_id: latestMatch.match_result_id,
      match_reasons: dimensionReasons,
      history,
      partner_nickname: latestMatch.partner_nickname || '',
      partner_gender_label: latestMatch.partner_gender_label || '—',
      partner_campus: latestMatch.partner_campus || '—',
      partner_college: latestMatch.partner_college || '—',
      partner_grade: latestMatch.partner_grade || '—',
      partner_message_to_partner: latestMatch.partner_message_to_partner || '',
      partner_contact_for_match: latestMatch.partner_contact_for_match || '',
      match_percent: latestMatch.match_percent,
      self_rose: effectiveSelfRose,
      self_rose_name: selfRoseName,
      partner_rose: latestMatch.partner_rose,
      run_at: latestMatch.run_at,
      type_interpretation: effectiveTypeInterpretation
    });
  } catch (error) {
    console.error('GET /api/match/my-match failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
