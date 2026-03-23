import { createAccessToken, hashPassword, verifyPassword } from 'lib/auth';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureRespondentIdForUser, findUserByEmail } from 'lib/identityLink';
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
    const allowedDomains = await getAllowedEmailDomains(surveyPool);

    if (!isAllowedSchoolEmail(email, allowedDomains)) {
      return bizError(400, `Only allowed email domains are accepted: ${allowedDomains.join(', ')}`);
    }

    if (typeof password !== 'string') {
      return bizError(400, 'Invalid parameters');
    }

    const user = await findUserByEmail(identityPool, email);
    if (!user) {
      return bizError(400, 'Invalid credentials');
    }

    const passwordCheck = await verifyPassword(password, user.hashed_password);
    if (!user.is_active || !passwordCheck.matched) {
      return bizError(400, 'Invalid credentials');
    }

    if (passwordCheck.needs_upgrade) {
      const upgradedPasswordHash = await hashPassword(password);
      await identityPool.query(
        'UPDATE unidate_app.users SET hashed_password = $1 WHERE id = $2',
        [upgradedPasswordHash, user.id]
      );
    }

    await ensureRespondentIdForUser(identityPool, user.id, {
      actor: `user:${user.id}`,
      purpose: 'login_link_bootstrap'
    });

    const accessToken = createAccessToken(user.id);
    return success('Login successful', {
      access_token: accessToken,
      is_admin: Boolean(user.is_admin)
    });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
