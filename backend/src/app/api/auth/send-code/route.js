import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { sendVerificationEmail } from 'lib/email';
import {
  createInactiveUserWithEncryptedEmail,
  findUserByEmail,
  updateEncryptedEmailForUser
} from 'lib/identityLink';
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

    const code = generateCode();

    if (existingUser) {
      if (existingUser.is_active) {
        return bizError(400, 'Email already registered');
      }

      await identityPool.query(
        'UPDATE uniday_app.users SET verification_code = $1 WHERE id = $2',
        [code, existingUser.id]
      );

      // Ensure existing pre-upgrade account also has encrypted email fields.
      await updateEncryptedEmailForUser(identityPool, existingUser.id, email);
    } else {
      await createInactiveUserWithEncryptedEmail(identityPool, email, code);
    }

    await sendVerificationEmail(email, code);
    if (shouldExposeCodeForTests()) {
      return success('Verification code sent successfully', {
        debug_verification_code: code
      });
    }
    return success('Verification code sent successfully');
  } catch (error) {
    console.error('POST /api/auth/send-code failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
