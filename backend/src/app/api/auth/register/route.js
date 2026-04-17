import { hashPassword } from 'lib/auth';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import {
  ensureRespondentIdForUser,
  findUserByEmail,
  updateEncryptedEmailForUser
} from 'lib/identityLink';
import { computeEmailHash } from 'lib/emailException';
import { normalizeCollege } from 'lib/college';
import { normalizeCampus } from 'lib/campus';
import { normalizeGradeInput } from 'lib/profileFields';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';
import { isValidGender } from 'lib/rose';
import { rateLimit } from 'lib/rateLimit';
import { logError } from 'lib/securityLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rl = rateLimit(request, 'auth_register', { email, limit: 10, windowMs: 10 * 60_000 });
    if (!rl.allowed) {
      return bizError(429, 'Too many requests. Please try again later');
    }
    const password = body?.password;
    const code = body?.code;
    const allowedDomains = await getAllowedEmailDomains(surveyPool);

    if (!isAllowedSchoolEmail(email, allowedDomains)) {
      return bizError(400, `Only allowed email domains are accepted: ${allowedDomains.join(', ')}`);
    }

    if (typeof password !== 'string' || typeof code !== 'string') {
      return bizError(400, 'Invalid parameters');
    }

    if (code.length !== 6) {
      return bizError(400, 'Invalid verification code');
    }

    if (password.length < 6 || password.length > 128) {
      return bizError(400, 'Password length must be between 6 and 128');
    }

    const user = await findUserByEmail(identityPool, email);
    if (!user || user.verification_code !== code) {
      return bizError(400, 'Invalid verification code');
    }

    const regGender = body?.gender;
    if (!isValidGender(regGender)) {
      return bizError(400, '请选择生物学性别');
    }
    const gradeResult = normalizeGradeInput(body?.grade);
    if (!gradeResult.ok) {
      return bizError(400, gradeResult.msg);
    }
    const campusRaw = typeof body?.campus === 'string' ? body.campus : '';
    const regCampus = normalizeCampus(campusRaw);
    if (!regCampus) {
      return bizError(400, '请选择校区');
    }
    const collegeRaw = typeof body?.college === 'string' ? body.college : '';
    const regCollege = normalizeCollege(collegeRaw);
    if (!regCollege) {
      if (collegeRaw.trim() !== '') {
        return bizError(400, '学院选择无效');
      }
      return bizError(400, '请选择学院');
    }

    const hashedPassword = await hashPassword(password);
    const emailHash = computeEmailHash(email);
    const pendingApplication = await identityPool.query(
      `
      SELECT 1
      FROM unidate_app.email_exception_applications
      WHERE school_email_hash = $1
        AND status = 'pending'
        AND backup_email_verified = TRUE
        AND screenshot_path IS NOT NULL
        AND BTRIM(screenshot_path) <> ''
      LIMIT 1
      `,
      [emailHash]
    );
    const exceptionStatus = pendingApplication.rowCount > 0 ? 'pending' : 'none';
    await identityPool.query(
      `
      UPDATE unidate_app.users
      SET hashed_password = $1,
          is_active = TRUE,
          verification_code = NULL,
          email_exception_status = $7,
          gender = $3,
          grade = $4,
          campus = $5,
          college = $6,
          registration_profile_locked = TRUE
      WHERE id = $2
      `,
      [hashedPassword, user.id, regGender, gradeResult.value, regCampus, regCollege, exceptionStatus]
    );

    await updateEncryptedEmailForUser(identityPool, user.id, email);
    await ensureRespondentIdForUser(identityPool, user.id, {
      actor: `user:${user.id}`,
      purpose: 'register_link_create'
    });

    return success('Registration successful');
  } catch (error) {
    logError('POST /api/auth/register failed', error);
    return httpError(500, 'Internal Server Error');
  }
}
