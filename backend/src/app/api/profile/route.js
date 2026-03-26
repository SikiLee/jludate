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
    allow_cross_school_match: Boolean(row.allow_cross_school_match),
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
      'SELECT gender, target_gender, orientation, allow_cross_school_match FROM unidate_app.users WHERE id = $1 LIMIT 1',
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
    const allowCrossSchoolMatch = typeof body?.allow_cross_school_match === 'boolean'
      ? body.allow_cross_school_match
      : null;

    const profilePayload = {
      gender,
      target_gender: targetGender
    };
    if (allowCrossSchoolMatch !== null) {
      profilePayload.allow_cross_school_match = allowCrossSchoolMatch;
    }

    const validation = validateProfile(profilePayload);
    if (!validation.ok) {
      return bizError(400, validation.msg);
    }

    const updateResult = await identityPool.query(
      `
      UPDATE unidate_app.users
      SET gender = $1,
          target_gender = $2,
          allow_cross_school_match = COALESCE($3, allow_cross_school_match)
      WHERE id = $4
      RETURNING allow_cross_school_match
      `,
      [gender, targetGender, allowCrossSchoolMatch, authResult.user.id]
    );
    const savedAllowCrossSchoolMatch = Boolean(updateResult.rows[0]?.allow_cross_school_match);

    return success('Profile saved', {
      gender,
      target_gender: targetGender,
      allow_cross_school_match: savedAllowCrossSchoolMatch,
      completed: true
    });
  } catch (error) {
    console.error('POST /api/profile failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
