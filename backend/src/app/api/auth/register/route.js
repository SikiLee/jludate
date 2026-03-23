import { hashPassword } from 'lib/auth';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import {
  ensureRespondentIdForUser,
  findUserByEmail,
  updateEncryptedEmailForUser
} from 'lib/identityLink';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
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

    const hashedPassword = await hashPassword(password);
    await identityPool.query(
      `
      UPDATE uniday_app.users
      SET hashed_password = $1,
          is_active = TRUE,
          verification_code = NULL
      WHERE id = $2
      `,
      [hashedPassword, user.id]
    );

    await updateEncryptedEmailForUser(identityPool, user.id, email);
    await ensureRespondentIdForUser(identityPool, user.id, {
      actor: `user:${user.id}`,
      purpose: 'register_link_create'
    });

    return success('Registration successful');
  } catch (error) {
    console.error('POST /api/auth/register failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
