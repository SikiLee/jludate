import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { resolveTargetGender, validateProfile } from 'lib/rose';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toProfilePayload(row) {
  const targetGender = resolveTargetGender(row);

  return {
    gender: row.gender || null,
    target_gender: targetGender,
    completed: Boolean(row.gender && targetGender)
  };
}

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const result = await identityPool.query(
      'SELECT gender, target_gender, orientation FROM szudate_app.users WHERE id = $1 LIMIT 1',
      [authResult.user.id]
    );

    if (result.rowCount === 0) {
      return httpError(404, 'User not found');
    }

    return success('success', toProfilePayload(result.rows[0]));
  } catch (error) {
    console.error('GET /api/profile failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const gender = body?.gender;
    const targetGender = body?.target_gender;

    const validation = validateProfile({ gender, target_gender: targetGender });
    if (!validation.ok) {
      return bizError(400, validation.msg);
    }

    await identityPool.query(
      `
      UPDATE szudate_app.users
      SET gender = $1,
          target_gender = $2
      WHERE id = $3
      `,
      [gender, targetGender, authResult.user.id]
    );

    return success('Profile saved', {
      gender,
      target_gender: targetGender,
      completed: true
    });
  } catch (error) {
    console.error('POST /api/profile failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
