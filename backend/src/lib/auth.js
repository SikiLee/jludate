import jwt from 'jsonwebtoken';
import { identityPool } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

const ALGORITHM = 'HS256';
export { hashPassword, verifyPassword };

function readJwtSecretKey() {
  const secret = typeof process.env.SECRET_KEY === 'string' ? process.env.SECRET_KEY.trim() : '';
  if (!secret) {
    throw new Error('SECRET_KEY environment variable is required');
  }
  return secret;
}

export function createAccessToken(userId) {
  return jwt.sign({ sub: String(userId), typ: 'uid' }, readJwtSecretKey(), { algorithm: ALGORITHM });
}

export function decodeAccessToken(token) {
  try {
    return jwt.verify(token, readJwtSecretKey(), { algorithms: [ALGORITHM] });
  } catch {
    return null;
  }
}

async function resolveUserFromBearerToken(token) {
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

export async function getCurrentUserIfPresentFromRequest(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return { user: null };
  }

  if (!authorization.startsWith('Bearer ')) {
    return { error: { status: 401, msg: 'Invalid token format' } };
  }

  const token = authorization.slice(7);
  return resolveUserFromBearerToken(token);
}

export async function getCurrentUserFromRequest(request) {
  const result = await getCurrentUserIfPresentFromRequest(request);
  if (result.error) {
    return result;
  }
  if (!result.user) {
    return { error: { status: 401, msg: 'Invalid token format' } };
  }
  return result;
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
