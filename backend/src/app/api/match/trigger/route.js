import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { runMatchingEngine } from 'lib/matching';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const allowTrigger = process.env.ALLOW_TEST_TRIGGER === 'true' || process.env.NODE_ENV === 'test';
    if (!allowTrigger) {
      return httpError(403, 'Manual trigger is disabled in production');
    }

    const result = await runMatchingEngine({ runType: 'manual', initiatedBy: 'manual_api' });

    if (result.skipped) {
      return success('Matching skipped: current run already exists', {
        run_key: result.run_key,
        matches_created: result.matches_created
      });
    }

    return success(`Matching complete. ${result.matches_created} pairs created.`, {
      run_key: result.run_key,
      candidates: result.candidates,
      matches_created: result.matches_created
    });
  } catch (error) {
    console.error('POST /api/match/trigger failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
