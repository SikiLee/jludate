import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
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

    const result = await identityPool.query(
      `
      SELECT
        a.id,
        a.school_email,
        a.backup_email,
        a.status,
        a.has_invalid_send_record,
        a.backup_email_verified,
        a.reviewed_by,
        a.reviewed_at,
        a.created_at,
        a.updated_at,
        CASE WHEN a.screenshot_path IS NULL OR BTRIM(a.screenshot_path) = '' THEN FALSE ELSE TRUE END AS has_screenshot,
        CASE WHEN a.status IN ('approved','rejected') AND (a.screenshot_path IS NULL OR BTRIM(a.screenshot_path) = '') THEN TRUE ELSE FALSE END AS screenshot_deleted
      FROM unidate_app.email_exception_applications a
      ORDER BY a.created_at DESC
      LIMIT 500
      `
    );

    return success('success', result.rows);
  } catch (error) {
    console.error('GET /api/admin/email-exception/applications failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

