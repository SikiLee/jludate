import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { parseFeedbackListParams } from 'lib/feedback';
import { httpError, success } from 'lib/response';

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

    const { limit, offset } = parseFeedbackListParams(request.nextUrl.searchParams);
    const [listResult, countResult] = await Promise.all([
      surveyPool.query(
        `
        SELECT
          id,
          user_id,
          is_guest,
          source,
          rose_code,
          content,
          contact_email,
          created_at
        FROM unidate_app.user_feedback
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      surveyPool.query('SELECT COUNT(*)::int AS total FROM unidate_app.user_feedback')
    ]);

    return success('success', {
      items: listResult.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('GET /api/admin/feedback failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
