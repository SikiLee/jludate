import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId, getUserEmailByRespondentId } from 'lib/identityLink';
import { getPublicTypeInterpretation } from 'lib/typeInterpretation';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const currentUserId = authResult.user.id;
    const respondentId = await getRespondentIdByUserId(identityPool, currentUserId, {
      actor: `user:${currentUserId}`,
      purpose: 'match_get_self_respondent'
    });
    if (!respondentId) {
      return success('success', {
        matched: false,
        self_rose: null,
        self_rose_name: null,
        type_interpretation: null
      });
    }

    const selfSurveyResult = await surveyPool.query(
      'SELECT rose_code, rose_name FROM unidate_app.survey_responses WHERE respondent_id = $1 LIMIT 1',
      [respondentId]
    );
    const selfRoseCode = selfSurveyResult.rowCount > 0 ? selfSurveyResult.rows[0].rose_code : null;
    const selfRoseName = selfSurveyResult.rowCount > 0 ? selfSurveyResult.rows[0].rose_name : null;
    const selfTypeInterpretation = await getPublicTypeInterpretation(surveyPool, selfRoseCode);

    const matchResult = await surveyPool.query(
      `
      SELECT
        mr.respondent1_id,
        mr.respondent2_id,
        mr.final_match_percent,
        mr.killer_point,
        mr.user1_rose_code,
        mr.user2_rose_code,
        mr.created_at,
        mrun.created_at AS run_created_at
      FROM unidate_app.match_results mr
      INNER JOIN unidate_app.match_runs mrun ON mrun.id = mr.run_id
      WHERE mr.respondent1_id = $1 OR mr.respondent2_id = $1
      ORDER BY mrun.created_at DESC, mr.id DESC
      LIMIT 1
      `,
      [respondentId]
    );

    if (matchResult.rowCount === 0) {
      return success('success', {
        matched: false,
        self_rose: selfRoseCode,
        self_rose_name: selfRoseName,
        type_interpretation: selfTypeInterpretation
      });
    }

    const match = matchResult.rows[0];
    const partnerRespondentId = match.respondent1_id === respondentId ? match.respondent2_id : match.respondent1_id;
    const selfRose = match.respondent1_id === respondentId ? match.user1_rose_code : match.user2_rose_code;
    const partnerRose = match.respondent1_id === respondentId ? match.user2_rose_code : match.user1_rose_code;

    const partnerEmail = await getUserEmailByRespondentId(identityPool, partnerRespondentId, {
      actor: `user:${currentUserId}`,
      purpose: 'match_get_partner_email'
    });
    if (!partnerEmail) {
      return success('success', {
        matched: false,
        self_rose: selfRoseCode,
        self_rose_name: selfRoseName,
        type_interpretation: selfTypeInterpretation
      });
    }

    const effectiveSelfRose = selfRose || selfRoseCode;
    const effectiveTypeInterpretation = effectiveSelfRose === selfRoseCode
      ? selfTypeInterpretation
      : await getPublicTypeInterpretation(surveyPool, effectiveSelfRose);

    return success('success', {
      matched: true,
      partner_email: partnerEmail,
      match_percent: Number(match.final_match_percent),
      self_rose: effectiveSelfRose,
      self_rose_name: selfRoseName,
      partner_rose: partnerRose,
      killer_point: match.killer_point,
      run_at: match.run_created_at || match.created_at,
      type_interpretation: effectiveTypeInterpretation
    });
  } catch (error) {
    console.error('GET /api/match/my-match failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
