import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { ensureRespondentIdForUser } from 'lib/identityLink';
import { computeRoseProfile, resolveTargetGender, validateAnswers } from 'lib/rose';
import { getPublicTypeInterpretation } from 'lib/typeInterpretation';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const answers = body?.answers;

    const profileResult = await identityPool.query(
      'SELECT gender, target_gender, orientation FROM szudate_app.users WHERE id = $1 LIMIT 1',
      [authResult.user.id]
    );
    if (profileResult.rowCount === 0) {
      return httpError(404, 'User not found');
    }

    const profile = profileResult.rows[0];
    if (!profile.gender || !resolveTargetGender(profile)) {
      return bizError(400, 'Please complete profile before survey');
    }

    const respondentId = await ensureRespondentIdForUser(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'survey_submit'
    });

    const answerValidation = validateAnswers(answers);
    if (!answerValidation.ok) {
      return bizError(400, answerValidation.msg);
    }

    const roseResult = computeRoseProfile(answerValidation.normalized);
    if (!roseResult.ok) {
      return bizError(400, roseResult.msg);
    }

    await surveyPool.query(
      `
      INSERT INTO szudate_app.survey_responses(
        respondent_id,
        answers,
        rose_code,
        rose_name,
        dimension_scores,
        updated_at
      )
      VALUES ($1, $2::jsonb, $3, $4, $5::jsonb, NOW())
      ON CONFLICT (respondent_id)
      DO UPDATE
      SET answers = EXCLUDED.answers,
          rose_code = EXCLUDED.rose_code,
          rose_name = EXCLUDED.rose_name,
          dimension_scores = EXCLUDED.dimension_scores,
          updated_at = NOW()
      `,
      [
        respondentId,
        JSON.stringify(answerValidation.normalized),
        roseResult.profile.rose_code,
        roseResult.profile.rose_name,
        JSON.stringify(roseResult.profile.dimension_scores)
      ]
    );

    const typeInterpretation = await getPublicTypeInterpretation(surveyPool, roseResult.profile.rose_code);

    return success('Survey submitted successfully', {
      rose_code: roseResult.profile.rose_code,
      rose_name: roseResult.profile.rose_name,
      type_interpretation: typeInterpretation
    });
  } catch (error) {
    console.error('POST /api/survey/submit failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
