import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { sendPasswordResetEmail } from 'lib/email';
import { findUserByEmail, updateEncryptedEmailForUser } from 'lib/identityLink';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function shouldExposeCodeForTests() {
  return process.env.EXPOSE_VERIFICATION_CODE_FOR_TESTS === 'true';
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const allowedDomains = await getAllowedEmailDomains(surveyPool);

    if (!isAllowedSchoolEmail(email, allowedDomains)) {
      return bizError(400, `Only allowed email domains are accepted: ${allowedDomains.join(', ')}`);
    }

    const existingUser = await findUserByEmail(identityPool, email);
    if (!existingUser || !existingUser.is_active) {
      return success('If the account exists, reset code has been sent');
    }

    const code = generateCode();
    await identityPool.query(
      'UPDATE unidate_app.users SET verification_code = $1 WHERE id = $2',
      [code, existingUser.id]
    );
    await updateEncryptedEmailForUser(identityPool, existingUser.id, email);

    await sendPasswordResetEmail(email, code);

    if (shouldExposeCodeForTests()) {
      return success('Password reset code sent', {
        debug_verification_code: code
      });
    }
    return success('Password reset code sent');
  } catch (error) {
    console.error('POST /api/auth/forgot-password/send-code failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
