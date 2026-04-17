import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { computeEmailHash, ensureEmailExceptionUploadDir, removeExceptionScreenshot, saveExceptionScreenshot, generateVerificationCode } from 'lib/emailException';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';
import { rateLimit } from 'lib/rateLimit';
import { logError } from 'lib/securityLog';
import { sendVerificationEmail } from 'lib/email';
import { createInactiveUserWithEncryptedEmail, findUserByEmail, updateEncryptedEmailForUser } from 'lib/identityLink';
import { approveAllPendingEmailExceptions } from 'lib/emailExceptionReview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readFormDataSafe(request) {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();
    await ensureEmailExceptionUploadDir();

    const rl = rateLimit(request, 'email_exception_apply', { email: 'ip', limit: 10, windowMs: 10 * 60_000 });
    if (!rl.allowed) {
      return bizError(429, '请求过于频繁，请稍后再试');
    }

    const allowedDomains = await getAllowedEmailDomains(surveyPool);
    const formData = await readFormDataSafe(request);
    if (!formData) {
      return bizError(400, '表单解析失败');
    }

    const schoolEmail = String(formData.get('school_email') || '').trim().toLowerCase();
    const backupEmail = String(formData.get('backup_email') || '').trim().toLowerCase();
    const screenshot = formData.get('screenshot');

    if (!isAllowedSchoolEmail(schoolEmail, allowedDomains)) {
      return bizError(400, `校园邮箱域名不合法，仅支持：${allowedDomains.join(', ')}`);
    }
    if (!backupEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
      return bizError(400, '备用邮箱格式不正确');
    }

    const schoolEmailHash = computeEmailHash(schoolEmail);
    const pending = await identityPool.query(
      `
      SELECT id, backup_email, backup_email_verified, screenshot_path
      FROM unidate_app.email_exception_applications
      WHERE school_email_hash = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [schoolEmailHash]
    );
    if (pending.rowCount === 0) {
      return bizError(400, '请先完成备用邮箱验证码验证');
    }

    const row = pending.rows[0];
    if (!row.backup_email_verified) {
      return bizError(400, '请先完成备用邮箱验证码验证');
    }
    if (String(row.backup_email || '').trim().toLowerCase() !== backupEmail) {
      return bizError(400, '备用邮箱与已验证邮箱不一致，请重新验证');
    }

    const uploadResult = await saveExceptionScreenshot(screenshot);
    if (!uploadResult.ok) {
      return bizError(400, uploadResult.msg || '截图上传失败');
    }

    const previousScreenshot = typeof row.screenshot_path === 'string' ? row.screenshot_path : '';
    if (previousScreenshot) {
      removeExceptionScreenshot(previousScreenshot).catch((error) => {
        logError('remove previous exception screenshot failed', error, { screenshot_path: previousScreenshot });
      });
    }

    await identityPool.query(
      `
      UPDATE unidate_app.email_exception_applications
      SET school_email = $1,
          backup_email = $2,
          screenshot_path = $3,
          updated_at = NOW()
      WHERE id = $4
      `,
      [schoolEmail, backupEmail, uploadResult.data.screenshot_path, row.id]
    );

    // Allow immediate registration: issue a registration code and deliver it to the backup email.
    const code = generateVerificationCode();
    const existingUser = await findUserByEmail(identityPool, schoolEmail);
    if (existingUser) {
      if (existingUser.is_active) {
        // Already registered; nothing else needed.
        return success('异常邮箱申请已提交，请等待管理员审核');
      }
      await identityPool.query(
        'UPDATE unidate_app.users SET verification_code = $1 WHERE id = $2',
        [code, existingUser.id]
      );
      await updateEncryptedEmailForUser(identityPool, existingUser.id, schoolEmail);
    } else {
      await createInactiveUserWithEncryptedEmail(identityPool, schoolEmail, code);
    }

    // Always deliver code to backup mailbox once application is submitted.
    await sendVerificationEmail(backupEmail, code);

    // Auto-approve-all when pending queue reaches 50.
    const pendingCountResult = await identityPool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM unidate_app.email_exception_applications
      WHERE status = 'pending'
      `
    );
    const pendingTotal = Number(pendingCountResult.rows[0]?.total || 0);
    if (pendingTotal >= 50) {
      approveAllPendingEmailExceptions({ reviewedBy: null }).catch((error) => {
        logError('auto approve-all email exceptions failed', error, { pending_total: pendingTotal });
      });
    }

    return success('异常邮箱申请已提交，请等待管理员审核');
  } catch (error) {
    console.error('POST /api/auth/email-exception/apply failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

