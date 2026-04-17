import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { readJson } from 'lib/request';
import { httpError, success } from 'lib/response';
import { runWeeklyMatchingPipeline, getCurrentWeeklyMatchRunKey } from 'lib/weeklyMatch';

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
    const category = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : 'all';
    const date = body?.date ? new Date(body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return httpError(400, 'Invalid date');
    }

    if (category !== 'all' && category !== 'love' && category !== 'friend') {
      return httpError(400, 'category must be one of: all, love, friend');
    }

    const run = await runWeeklyMatchingPipeline({
      initiatedBy: `admin:${authResult.user.id}`,
      date
    });
    const allResults = Array.isArray(run?.results) ? run.results : [];

    const filtered = category === 'all' ? allResults : allResults.filter((r) => r.category === category);
    return success('Weekly matching executed', {
      cycle_id: run?.cycle_id || null,
      started_at: run?.started_at || null,
      run_keys: filtered.map((r) => r.run_key || getCurrentWeeklyMatchRunKey(r.category, date)),
      results: filtered
    });
  } catch (error) {
    console.error('POST /api/match/trigger failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
