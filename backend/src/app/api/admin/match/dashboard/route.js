import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError, success } from 'lib/response';
import { getAdminMatchDashboardMetrics, runAdminOneClickMatch } from 'lib/matchAnalytics';

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

    const data = await getAdminMatchDashboardMetrics();
    return success('success', data);
  } catch (error) {
    console.error('GET /api/admin/match/dashboard failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    let categories = null;
    try {
      const body = await request.json();
      if (Array.isArray(body?.categories)) {
        categories = body.categories;
      }
    } catch {
      categories = null;
    }

    const data = await runAdminOneClickMatch({
      adminUserId: authResult.user.id,
      categories
    });
    return success('One-click matching completed', data);
  } catch (error) {
    console.error('POST /api/admin/match/dashboard failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

