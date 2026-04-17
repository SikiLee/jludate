import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import { createAdminMatchQuestionnaireItem } from 'lib/matchQuestionnaireConfig';

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
    const createResult = await createAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType: body?.questionnaire_type,
      payload: body?.payload,
      updatedBy: authResult.user.id
    });

    if (!createResult.ok) {
      return bizError(400, createResult.msg || 'Invalid parameters');
    }

    return success('created', createResult.data);
  } catch (error) {
    console.error('POST /api/admin/match-questionnaire/items failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
