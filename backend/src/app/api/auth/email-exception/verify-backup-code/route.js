import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { computeEmailHash, isValidBackupEmail } from 'lib/emailException';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';
import { rateLimit } from 'lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE_TTL_MS = 15 * 60_000;

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const schoolEmail = typeof body?.school_email === 'string' ? body.school_email.trim().toLowerCase() : '';
    const backupEmail = typeof body?.backup_email === 'string' ? body.backup_email.trim().toLowerCase() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const rl = rateLimit(request, 'email_exception_verify_backup_code', {
      email: `${schoolEmail}|${backupEmail}`,
      limit: 10,
      windowMs: 60_000
    });
    if (!rl.allowed) {
      return bizError(429, `请求过于频繁，请 ${rl.retryAfterSec}s 后再试`);
    }

    const allowedDomains = await getAllowedEmailDomains(surveyPool);
    if (!isAllowedSchoolEmail(schoolEmail, allowedDomains)) {
      return bizError(400, `校园邮箱域名不合法，仅支持：${allowedDomains.join(', ')}`);
    }
    if (!isValidBackupEmail(backupEmail)) {
      return bizError(400, '备用邮箱格式不正确');
    }
    if (code.length !== 6) {
      return bizError(400, '验证码格式不正确');
    }

    const schoolEmailHash = computeEmailHash(schoolEmail);
    const existing = await identityPool.query(
      `
      SELECT id, backup_email, backup_code, backup_code_sent_at
      FROM unidate_app.email_exception_applications
      WHERE school_email_hash = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [schoolEmailHash]
    );
    if (existing.rowCount === 0) {
      return bizError(400, '请先获取备用邮箱验证码');
    }

    const row = existing.rows[0];
    const sentAt = row.backup_code_sent_at ? new Date(row.backup_code_sent_at).getTime() : 0;
    if (!Number.isFinite(sentAt) || Date.now() - sentAt > CODE_TTL_MS) {
      return bizError(400, '验证码已过期，请重新获取');
    }
    if (String(row.backup_email || '').trim().toLowerCase() !== backupEmail) {
      return bizError(400, '备用邮箱不一致，请重新获取验证码');
    }
    if (String(row.backup_code || '').trim() !== code) {
      return bizError(400, '验证码不正确');
    }

    await identityPool.query(
      `
      UPDATE unidate_app.email_exception_applications
      SET backup_email_verified = TRUE,
          backup_code = NULL,
          backup_code_verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [row.id]
    );

    return success('备用邮箱验证通过');
  } catch (error) {
    console.error('POST /api/auth/email-exception/verify-backup-code failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

