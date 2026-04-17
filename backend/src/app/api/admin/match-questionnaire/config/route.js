import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError, success } from 'lib/response';
import { listAdminMatchQuestionnaireConfig } from 'lib/matchQuestionnaireConfig';

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

    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || '').toLowerCase();
    if (!['love', 'friend', 'xinghua'].includes(type)) {
      return httpError(400, 'Invalid questionnaire type');
    }

    const config = await listAdminMatchQuestionnaireConfig(surveyPool, type);
    return success('success', config);
  } catch (error) {
    console.error('GET /api/admin/match-questionnaire/config failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
