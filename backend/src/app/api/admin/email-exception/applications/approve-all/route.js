import { ensureSchema } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError, success } from 'lib/response';
import { approveAllPendingEmailExceptions } from 'lib/emailExceptionReview';

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

    const result = await approveAllPendingEmailExceptions({
      reviewedBy: authResult.user.id
    });
    if (result.lock_skipped) {
      return success('已有批量通过任务正在执行，请稍后再试', {
        approved_count: 0,
        skipped_count: 0
      });
    }

    return success('批量审核通过已完成', {
      approved_count: result.approved_count,
      skipped_count: result.skipped_count
    });
  } catch (error) {
    console.error('POST /api/admin/email-exception/applications/approve-all failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

