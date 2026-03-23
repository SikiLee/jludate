import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError } from 'lib/response';

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

    return bizError(410, 'Type.md import is disabled in pure database mode');
  } catch (error) {
    console.error('POST /api/admin/rose-types/import failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
