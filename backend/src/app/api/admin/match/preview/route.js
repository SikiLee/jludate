import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError, success } from 'lib/response';
import { previewWeeklyMatchingStats } from 'lib/weeklyMatch';

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

    const stats = await previewWeeklyMatchingStats({ date: new Date() });
    return success('success', stats);
  } catch (error) {
    console.error('GET /api/admin/match/preview failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

