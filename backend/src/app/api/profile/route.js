import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { isValidCollege, normalizeCollege } from 'lib/college';
import { isValidCampus, normalizeCampus } from 'lib/campus';
import { isValidGrade } from 'lib/grade';
import {
  normalizeGradeInput,
  normalizeMatchContactInput,
  normalizeMessageToPartnerInput,
  normalizeNicknameInput
} from 'lib/profileFields';
import { resolveTargetGender, validateProfile } from 'lib/rose';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toProfilePayload(row) {
  const targetGender = resolveTargetGender(row);
  const rawCampus = typeof row.campus === 'string' ? row.campus.trim() : '';
  const campus = isValidCampus(rawCampus) ? rawCampus : '';
  const rawCollege = typeof row.college === 'string' ? row.college.trim() : '';
  const college = isValidCollege(rawCollege) ? rawCollege : '';
  const rawNick = typeof row.nickname === 'string' ? row.nickname.trim() : '';
  const nickname = rawNick && [...rawNick].length <= 20 ? rawNick : '';
  const rawGrade = typeof row.grade === 'string' ? row.grade.trim() : '';
  const grade = isValidGrade(rawGrade) ? rawGrade : '';
  const messageToPartner = typeof row.message_to_partner === 'string' ? row.message_to_partner : '';
  const messageOk = [...messageToPartner].length <= 300;
  const shareContact = Boolean(row.share_contact_with_match);
  const rawContactDetail = typeof row.match_contact_detail === 'string' ? row.match_contact_detail.trim() : '';
  const matchContactDetail = shareContact ? rawContactDetail : '';
  const registrationLocked = Boolean(row.registration_profile_locked);
  const effectiveCampus = campus || '南区';

  return {
    gender: row.gender || null,
    target_gender: targetGender,
    nickname: nickname || null,
    campus: effectiveCampus || null,
    college: college || null,
    grade: grade || null,
    message_to_partner: messageOk ? messageToPartner : '',
    share_contact_with_match: shareContact,
    match_contact_detail: matchContactDetail,
    allow_cross_school_match: Boolean(row.allow_cross_school_match),
    auto_weekly_match: row.auto_weekly_match !== false,
    registration_profile_locked: registrationLocked,
    completed: Boolean(
      registrationLocked
      && row.gender
      && grade
      && effectiveCampus
    )
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
      `
      SELECT gender, target_gender, orientation, allow_cross_school_match,
             campus, college, nickname, grade, message_to_partner,
             share_contact_with_match, match_contact_detail,
             registration_profile_locked, auto_weekly_match
      FROM unidate_app.users
      WHERE id = $1
      LIMIT 1
      `,
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
    const existingResult = await identityPool.query(
      `
      SELECT gender, target_gender, campus, college, grade, registration_profile_locked
      FROM unidate_app.users
      WHERE id = $1
      LIMIT 1
      `,
      [authResult.user.id]
    );
    if (existingResult.rowCount === 0) {
      return httpError(404, 'User not found');
    }
    const existing = existingResult.rows[0];
    const locked = Boolean(existing.registration_profile_locked);

    let gender = body?.gender;
    let targetGender = body?.target_gender;
    let campusInput = typeof body?.campus === 'string' ? body.campus : '';
    let collegeInput = typeof body?.college === 'string' ? body.college : '';
    let gradeInput = body?.grade;

    if (locked) {
      gender = existing.gender;
      campusInput = existing.campus || '南区';
      collegeInput = existing.college || '';
      gradeInput = existing.grade;
    }

    if (targetGender === undefined || targetGender === null || targetGender === '') {
      targetGender = existing.target_gender;
    }
    if (!locked && (gender === undefined || gender === null || gender === '')) {
      gender = existing.gender;
    }

    const allowCrossSchoolMatch = typeof body?.allow_cross_school_match === 'boolean'
      ? body.allow_cross_school_match
      : null;

    const nickResult = normalizeNicknameInput(body?.nickname);
    if (!nickResult.ok) {
      return bizError(400, nickResult.msg);
    }

    let campus = normalizeCampus(campusInput);
    if (!campus) {
      campus = '南区';
    }

    let college = normalizeCollege(collegeInput);
    if (!college && collegeInput.trim() !== '') {
      return bizError(400, '学院选择无效');
    }

    const gradeResult = normalizeGradeInput(gradeInput);
    if (!gradeResult.ok) {
      return bizError(400, gradeResult.msg);
    }

    const msgResult = normalizeMessageToPartnerInput(body?.message_to_partner);
    if (!msgResult.ok) {
      return bizError(400, msgResult.msg);
    }

    const contactResult = normalizeMatchContactInput(body);
    if (!contactResult.ok) {
      return bizError(400, contactResult.msg);
    }

    const autoWeeklyMatch = typeof body?.auto_weekly_match === 'boolean' ? body.auto_weekly_match : null;

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
          allow_cross_school_match = COALESCE($3, allow_cross_school_match),
          campus = $4,
          college = $5,
          nickname = $6,
          grade = $7,
          message_to_partner = $8,
          share_contact_with_match = $9,
          match_contact_detail = $10,
          auto_weekly_match = COALESCE($12, auto_weekly_match)
      WHERE id = $11
      RETURNING gender, target_gender, allow_cross_school_match, campus, college, nickname, grade,
                message_to_partner, share_contact_with_match, match_contact_detail,
                registration_profile_locked, auto_weekly_match
      `,
      [
        gender,
        targetGender,
        allowCrossSchoolMatch,
        campus,
        college,
        nickResult.value,
        gradeResult.value,
        msgResult.value,
        contactResult.share,
        contactResult.detail,
        authResult.user.id,
        autoWeeklyMatch
      ]
    );

    const row = updateResult.rows[0];
    return success('Profile saved', toProfilePayload(row));
  } catch (error) {
    console.error('POST /api/profile failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
