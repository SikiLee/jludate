import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { httpError, success } from 'lib/response';
import { getPublicHomeMetrics } from 'lib/publicMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const metrics = await getPublicHomeMetrics(identityPool, surveyPool);
    return success('success', metrics);
  } catch (error) {
    console.error('GET /api/public/home-metrics failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
