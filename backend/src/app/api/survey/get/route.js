import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId } from 'lib/identityLink';
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

    const respondentId = await getRespondentIdByUserId(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'survey_get'
    });
    if (!respondentId) {
      return success('success', {
        completed: false,
        answers: null,
        rose_code: null,
        rose_name: null,
        type_interpretation: null,
        dimension_scores: null,
        updated_at: null
      });
    }

    const surveyResult = await surveyPool.query(
      `
      SELECT answers, rose_code, rose_name, dimension_scores, updated_at
      FROM unidate_app.survey_responses
      WHERE respondent_id = $1
      LIMIT 1
      `,
      [respondentId]
    );

    if (surveyResult.rowCount === 0) {
      return success('success', {
        completed: false,
        answers: null,
        rose_code: null,
        rose_name: null,
        type_interpretation: null,
        dimension_scores: null,
        updated_at: null
      });
    }

    const roseCode = surveyResult.rows[0].rose_code;
    const typeInterpretation = await getPublicTypeInterpretation(surveyPool, roseCode);

    return success('success', {
      completed: true,
      answers: surveyResult.rows[0].answers,
      rose_code: roseCode,
      rose_name: surveyResult.rows[0].rose_name,
      type_interpretation: typeInterpretation,
      dimension_scores: surveyResult.rows[0].dimension_scores,
      updated_at: surveyResult.rows[0].updated_at
    });
  } catch (error) {
    console.error('GET /api/survey/get failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
