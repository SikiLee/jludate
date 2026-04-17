import { identityPool } from 'lib/db';
import { computeEmailHash, removeExceptionScreenshot } from 'lib/emailException';
import { sendExceptionApprovedEmail } from 'lib/email';
import { logError } from 'lib/securityLog';

const EMAIL_EXCEPTION_APPROVE_ALL_LOCK_KEY = 90421061;

export async function approveAllPendingEmailExceptions({ reviewedBy = null } = {}) {
  const client = await identityPool.connect();
  let hasLock = false;
  try {
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [
      EMAIL_EXCEPTION_APPROVE_ALL_LOCK_KEY
    ]);
    hasLock = Boolean(lockResult.rows[0]?.locked);
    if (!hasLock) {
      return {
        approved_count: 0,
        skipped_count: 0,
        pending_count: 0,
        lock_skipped: true
      };
    }

    const pendingResult = await client.query(
      `
      SELECT id, school_email, backup_email, backup_email_verified, screenshot_path
      FROM unidate_app.email_exception_applications
      WHERE status = 'pending'
      ORDER BY created_at ASC
      `
    );

    let approvedCount = 0;
    let skippedCount = 0;

    for (const row of pendingResult.rows) {
      const schoolEmail = typeof row.school_email === 'string' ? row.school_email.trim().toLowerCase() : '';
      const backupEmail = typeof row.backup_email === 'string' ? row.backup_email.trim().toLowerCase() : '';
      const screenshotPath = typeof row.screenshot_path === 'string' ? row.screenshot_path.trim() : '';

      if (!row.backup_email_verified || !schoolEmail || !backupEmail || !screenshotPath) {
        skippedCount += 1;
        continue;
      }

      const schoolEmailHash = computeEmailHash(schoolEmail);

      await client.query(
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
        [schoolEmail, schoolEmailHash, backupEmail, row.id, reviewedBy]
      );

      await client.query(
        `
        UPDATE unidate_app.users
        SET email_exception_status = 'approved'
        WHERE email_hash = $1
        `,
        [schoolEmailHash]
      ).catch(() => null);

      await client.query(
        `
        UPDATE unidate_app.email_exception_applications
        SET status = 'approved',
            reviewed_by = $1,
            reviewed_at = NOW(),
            screenshot_path = NULL,
            updated_at = NOW()
        WHERE id = $2
        `,
        [reviewedBy, row.id]
      );

      removeExceptionScreenshot(screenshotPath).catch((error) => {
        logError('bulk approve remove screenshot failed', error, { screenshot_path: screenshotPath });
      });
      sendExceptionApprovedEmail(backupEmail).catch((error) => {
        logError('bulk approve send approved email failed', error, { backup_email: backupEmail });
      });

      approvedCount += 1;
    }

    return {
      approved_count: approvedCount,
      skipped_count: skippedCount,
      pending_count: pendingResult.rows.length,
      lock_skipped: false
    };
  } finally {
    if (hasLock) {
      await client.query('SELECT pg_advisory_unlock($1)', [EMAIL_EXCEPTION_APPROVE_ALL_LOCK_KEY]).catch(() => null);
    }
    client.release();
  }
}

