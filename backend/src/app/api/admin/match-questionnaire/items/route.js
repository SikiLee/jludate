import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { createAdminMatchQuestionnaireItem } from 'lib/matchQuestionnaireConfig';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

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
    const type = (body?.questionnaire_type || body?.type || '').toLowerCase();
    const payload = body?.payload;

    if (!payload || typeof payload !== 'object') {
      return bizError(400, 'payload is required');
    }

    const result = await createAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType: type,
      payload,
      updatedBy: authResult.user.id
    });

    if (!result.ok) {
      return bizError(400, result.msg || 'create failed');
    }

    return success('success', result.data);
  } catch (error) {
    console.error('POST /api/admin/match-questionnaire/items failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

