import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import {
  getAdminMatchQuestionnaireItemById,
  updateAdminMatchQuestionnaireItem,
  deleteAdminMatchQuestionnaireItem
} from 'lib/matchQuestionnaireConfig';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const url = new URL(request.url);
    const questionnaireType = (url.searchParams.get('type') || '').toLowerCase();

    const item = await getAdminMatchQuestionnaireItemById(surveyPool, {
      questionnaireType,
      id: params?.id
    });

    if (!item) {
      return httpError(404, 'Item not found');
    }

    return success('success', item);
  } catch (error) {
    console.error('GET /api/admin/match-questionnaire/items/[id] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function PUT(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const url = new URL(request.url);
    const questionnaireType = (url.searchParams.get('type') || '').toLowerCase();

    const body = await readJson(request);

    const result = await updateAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType,
      id: params?.id,
      payload: body?.payload || body,
      updatedBy: authResult.user.id
    });

    if (!result.ok) {
      if (result.status === 404) return httpError(404, result.msg);
      return bizError(400, result.msg);
    }

    return success('success', result.data);
  } catch (error) {
    console.error('PUT /api/admin/match-questionnaire/items/[id] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function DELETE(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const url = new URL(request.url);
    const questionnaireType = (url.searchParams.get('type') || '').toLowerCase();

    const result = await deleteAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType,
      id: params?.id
    });

    if (!result.ok) {
      if (result.status === 404) return httpError(404, result.msg);
      return bizError(400, result.msg);
    }

    return success('success', { deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/match-questionnaire/items/[id] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

