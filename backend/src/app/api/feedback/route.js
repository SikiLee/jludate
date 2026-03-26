import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserIfPresentFromRequest } from 'lib/auth';
import { validateFeedbackPayload } from 'lib/feedback';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserIfPresentFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const validation = validateFeedbackPayload(body);
    if (!validation.ok) {
      return bizError(400, validation.msg);
    }

    const isGuest = !authResult.user;
    const userId = authResult.user?.id ?? null;
    const insertResult = await surveyPool.query(
      `
      INSERT INTO unidate_app.user_feedback(
        user_id,
        is_guest,
        source,
        rose_code,
        content,
        contact_email
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
      `,
      [
        userId,
        isGuest,
        validation.data.source,
        validation.data.rose_code,
        validation.data.content,
        validation.data.contact_email
      ]
    );

    return success('Feedback submitted', {
      id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at
    });
  } catch (error) {
    console.error('POST /api/feedback failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
