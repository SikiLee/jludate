import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import { importSurveyQuestionsFromDefaults } from 'lib/surveyQuestionConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const overwrite = body?.overwrite === true;
    const result = await importSurveyQuestionsFromDefaults(surveyPool, { overwrite });
    return success('Survey questions imported', result);
  } catch (error) {
    console.error('POST /api/admin/survey-questions/import failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
