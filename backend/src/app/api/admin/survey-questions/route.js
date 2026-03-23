import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { listSurveyQuestions } from 'lib/surveyQuestionConfig';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const rows = await listSurveyQuestions(surveyPool);
    return success('success', rows);
  } catch (error) {
    console.error('GET /api/admin/survey-questions failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
