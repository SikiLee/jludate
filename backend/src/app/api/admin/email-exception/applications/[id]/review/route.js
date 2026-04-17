import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import { computeEmailHash, removeExceptionScreenshot } from 'lib/emailException';
import { logError } from 'lib/securityLog';
import { sendExceptionApprovedEmail, sendExceptionRejectedEmail } from 'lib/email';
import { purgeAccountBySchoolEmail } from 'lib/accountPurge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeDecision(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';
  if (value === 'approved' || value === 'rejected') return value;
  return '';
}

export async function POST(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const id = Number(params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return bizError(400, 'Invalid id');
    }

    const body = await readJson(request);
    const decision = normalizeDecision(body?.decision);
    if (!decision) {
      return bizError(400, 'decision must be approved or rejected');
    }

    const hasInvalidSendRecord = body && Object.prototype.hasOwnProperty.call(body, 'has_invalid_send_record')
      ? body.has_invalid_send_record
      : null;
    if (hasInvalidSendRecord !== null && typeof hasInvalidSendRecord !== 'boolean') {
      return bizError(400, 'has_invalid_send_record must be boolean');
    }


    const existing = await identityPool.query(
      `
      SELECT
        id,
        status,
        school_email,
        backup_email,
        backup_email_verified,
        screenshot_path
      FROM unidate_app.email_exception_applications
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (existing.rowCount === 0) {
      return httpError(404, 'Not found');
    }

    const row = existing.rows[0];
    if (row.status !== 'pending') {
      return bizError(400, '该申请已完成审核');
    }
    if (!row.backup_email_verified) {
      return bizError(400, '该申请的备用邮箱尚未验证，无法审核通过/拒绝');
    }

    const screenshotPath = typeof row.screenshot_path === 'string' ? row.screenshot_path.trim() : '';
    const schoolEmail = typeof row.school_email === 'string' ? row.school_email.trim().toLowerCase() : '';
    const backupEmail = typeof row.backup_email === 'string' ? row.backup_email.trim().toLowerCase() : '';
    const schoolEmailHash = computeEmailHash(schoolEmail);

    if (decision === 'approved') {
      await identityPool.query(
        `
        INSERT INTO unidate_app.email_exception_mappings(
          school_email,
          school_email_hash,
          backup_email,
          application_id,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (school_email_hash)
        DO UPDATE SET
          school_email = EXCLUDED.school_email,
          backup_email = EXCLUDED.backup_email,
          application_id = EXCLUDED.application_id,
          created_by = EXCLUDED.created_by,
          updated_at = NOW()
        `,
        [schoolEmail, schoolEmailHash, backupEmail, id, authResult.user.id]
      );

      // Mark user account as approved if it already exists.
      await identityPool.query(
        `
        UPDATE unidate_app.users
        SET email_exception_status = 'approved'
        WHERE email_hash = $1
        `,
        [schoolEmailHash]
      ).catch(() => null);
    }

    await identityPool.query(
      `
      UPDATE unidate_app.email_exception_applications
      SET status = $1,
          has_invalid_send_record = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          screenshot_path = NULL,
          updated_at = NOW()
      WHERE id = $4
      `,
      [decision, hasInvalidSendRecord, authResult.user.id, id]
    );

    if (screenshotPath) {
      removeExceptionScreenshot(screenshotPath).catch((error) => {
        logError('remove exception screenshot failed', error, { screenshot_path: screenshotPath });
      });
    }

    if (decision === 'approved') {
      sendExceptionApprovedEmail(backupEmail).catch((error) => {
        logError('send exception approved email failed', error, { backup_email: backupEmail });
      });
    }

    if (decision === 'rejected') {
      // Must notify first, then disable and purge everything.
      await sendExceptionRejectedEmail(backupEmail).catch((error) => {
        logError('send exception rejected email failed', error, { backup_email: backupEmail });
      });
      try {
        await purgeAccountBySchoolEmail(schoolEmail, { actor: `admin:${authResult.user.id}` });
      } catch (error) {
        logError('purge rejected account failed', error, { school_email: schoolEmail });
      }
    }

    return success('审核已保存');
  } catch (error) {
    console.error('POST /api/admin/email-exception/applications/:id/review failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

