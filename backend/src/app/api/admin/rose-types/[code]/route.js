import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import {
  getTypeInterpretationForAdmin,
  updateTypeInterpretation
} from 'lib/typeInterpretation';

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

    const roseCode = params?.code;
    const interpretation = await getTypeInterpretationForAdmin(surveyPool, roseCode);
    if (!interpretation) {
      return httpError(404, 'Type not found');
    }

    return success('success', interpretation);
  } catch (error) {
    console.error('GET /api/admin/rose-types/[code] failed:', error);
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

    const roseCode = params?.code;
    const body = await readJson(request);
    const updateResult = await updateTypeInterpretation(
      surveyPool,
      roseCode,
      {
        rose_name: body?.rose_name,
        markdown_content: body?.markdown_content,
        enabled: body?.enabled
      },
      authResult.user.id
    );

    if (!updateResult.ok) {
      if (updateResult.status === 404) {
        return httpError(404, updateResult.msg);
      }
      return bizError(400, updateResult.msg);
    }

    return success('Type interpretation updated', updateResult.data);
  } catch (error) {
    console.error('PUT /api/admin/rose-types/[code] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
