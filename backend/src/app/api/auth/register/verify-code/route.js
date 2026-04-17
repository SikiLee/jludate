import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { findUserByEmail } from 'lib/identityLink';
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
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const allowedDomains = await getAllowedEmailDomains(surveyPool);

    if (!isAllowedSchoolEmail(email, allowedDomains)) {
      return bizError(400, `Only allowed email domains are accepted: ${allowedDomains.join(', ')}`);
    }
    if (code.length !== 6) {
      return bizError(400, 'Invalid verification code');
    }

    const user = await findUserByEmail(identityPool, email);
    if (!user || user.verification_code !== code) {
      return bizError(400, 'Invalid verification code');
    }

    return success('验证码校验通过');
  } catch (error) {
    console.error('POST /api/auth/register/verify-code failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

