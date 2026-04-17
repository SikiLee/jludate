import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import {
  deleteAdminMatchQuestionnaireItem,
  updateAdminMatchQuestionnaireItem
} from 'lib/matchQuestionnaireConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveTypeFromQuery(request) {
  const url = new URL(request.url);
  return (url.searchParams.get('type') || '').toLowerCase();
}

function parseId(params) {
  const id = Number(params?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const id = parseId(params);
    if (!id) {
      return bizError(400, 'Invalid id');
    }

    const body = await readJson(request);
    const updateResult = await updateAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType: resolveTypeFromQuery(request),
      id,
      payload: body?.payload,
      updatedBy: authResult.user.id
    });
    if (!updateResult.ok) {
      const status = Number.isInteger(updateResult.status) ? updateResult.status : 400;
      return bizError(status, updateResult.msg || 'Update failed');
    }

    return success('updated', updateResult.data);
  } catch (error) {
    console.error('PUT /api/admin/match-questionnaire/items/:id failed:', error);
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

    const id = parseId(params);
    if (!id) {
      return bizError(400, 'Invalid id');
    }

    const deleteResult = await deleteAdminMatchQuestionnaireItem(surveyPool, {
      questionnaireType: resolveTypeFromQuery(request),
      id
    });
    if (!deleteResult.ok) {
      const status = Number.isInteger(deleteResult.status) ? deleteResult.status : 400;
      return bizError(status, deleteResult.msg || 'Delete failed');
    }

    return success('deleted');
  } catch (error) {
    console.error('DELETE /api/admin/match-questionnaire/items/:id failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
