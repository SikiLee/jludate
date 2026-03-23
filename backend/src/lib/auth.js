import jwt from 'jsonwebtoken';
import { identityPool } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

const SECRET_KEY = process.env.SECRET_KEY || 'supersecretkey-unidate';
const ALGORITHM = 'HS256';
export { hashPassword, verifyPassword };

export function createAccessToken(userId) {
  return jwt.sign({ sub: String(userId), typ: 'uid' }, SECRET_KEY, { algorithm: ALGORITHM });
}

export function decodeAccessToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] });
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { error: { status: 401, msg: 'Invalid token format' } };
  }

  const token = authorization.slice(7);
  const payload = decodeAccessToken(token);
  if (!payload || !payload.sub) {
    return { error: { status: 401, msg: 'Invalid token' } };
  }

  let result;
  const subject = String(payload.sub);
  if (/^\d+$/.test(subject)) {
    result = await identityPool.query('SELECT id, is_admin FROM unidate_app.users WHERE id = $1 LIMIT 1', [Number(subject)]);
  } else {
    // Legacy compatibility for old tokens where sub was email.
    result = await identityPool.query('SELECT id, is_admin FROM unidate_app.users WHERE email = $1 LIMIT 1', [subject]);
  }

  if (result.rowCount === 0) {
    return { error: { status: 401, msg: 'User not found' } };
  }

  return { user: result.rows[0] };
}

export async function getAdminUserFromRequest(request) {
  const currentUserResult = await getCurrentUserFromRequest(request);
  if (currentUserResult.error) {
    return currentUserResult;
  }

  if (!currentUserResult.user.is_admin) {
    return { error: { status: 403, msg: 'Admin permission required' } };
  }

  return currentUserResult;
}
