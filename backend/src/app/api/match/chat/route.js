import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId } from 'lib/identityLink';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CHAT_MESSAGES = 500;
const MAX_MESSAGE_LENGTH = 1000;

function parsePositiveInteger(rawValue) {
  const number = Number(rawValue);
  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}

async function resolveMatchResultForUser(matchResultId, respondentId) {
  const result = await surveyPool.query(
    `
    SELECT id, respondent1_id, respondent2_id
    FROM unidate_app.match_results
    WHERE id = $1
    LIMIT 1
    `,
    [matchResultId]
  );

  if (result.rowCount === 0) {
    return { error: { status: 404, msg: 'Match result not found' } };
  }

  const row = result.rows[0];
  const isParticipant = row.respondent1_id === respondentId || row.respondent2_id === respondentId;
  if (!isParticipant) {
    return { error: { status: 403, msg: 'Forbidden' } };
  }

  return { row };
}

async function resolveLatestMatchResultForUser(respondentId) {
  const result = await surveyPool.query(
    `
    SELECT
      mr.id,
      mr.respondent1_id,
      mr.respondent2_id
    FROM unidate_app.match_results mr
    INNER JOIN unidate_app.match_runs mrun ON mrun.id = mr.run_id
    WHERE mr.respondent1_id = $1 OR mr.respondent2_id = $1
    ORDER BY mrun.created_at DESC, mr.id DESC
    LIMIT 1
    `,
    [respondentId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const currentUserId = authResult.user.id;
    const respondentId = await getRespondentIdByUserId(identityPool, currentUserId, {
      actor: `user:${currentUserId}`,
      purpose: 'match_chat_get_self_respondent'
    });
    if (!respondentId) {
      return success('success', { match_result_id: null, messages: [] });
    }

    const url = new URL(request.url);
    const requestedMatchResultId = parsePositiveInteger(url.searchParams.get('match_result_id'));

    let targetMatch = null;
    if (requestedMatchResultId) {
      const resolved = await resolveMatchResultForUser(requestedMatchResultId, respondentId);
      if (resolved.error) {
        return httpError(resolved.error.status, resolved.error.msg);
      }
      targetMatch = resolved.row;
    } else {
      targetMatch = await resolveLatestMatchResultForUser(respondentId);
    }

    if (!targetMatch) {
      return success('success', { match_result_id: null, messages: [] });
    }

    const messageResult = await surveyPool.query(
      `
      SELECT id, sender_respondent_id, message_text, created_at
      FROM unidate_app.match_messages
      WHERE match_result_id = $1
      ORDER BY id ASC
      LIMIT $2
      `,
      [targetMatch.id, MAX_CHAT_MESSAGES]
    );

    return success('success', {
      match_result_id: targetMatch.id,
      messages: messageResult.rows.map((row) => ({
        id: row.id,
        content: row.message_text || '',
        created_at: row.created_at,
        is_self: row.sender_respondent_id === respondentId
      }))
    });
  } catch (error) {
    console.error('GET /api/match/chat failed:', error);
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

    const currentUserId = authResult.user.id;
    const respondentId = await getRespondentIdByUserId(identityPool, currentUserId, {
      actor: `user:${currentUserId}`,
      purpose: 'match_chat_post_self_respondent'
    });
    if (!respondentId) {
      return bizError(400, 'No respondent profile found');
    }

    const payload = await readJson(request);
    const matchResultId = parsePositiveInteger(payload?.match_result_id);
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';

    if (!matchResultId) {
      return bizError(400, 'match_result_id is required');
    }
    if (!content) {
      return bizError(400, 'content is required');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return bizError(400, `content length must be <= ${MAX_MESSAGE_LENGTH}`);
    }

    const resolved = await resolveMatchResultForUser(matchResultId, respondentId);
    if (resolved.error) {
      return httpError(resolved.error.status, resolved.error.msg);
    }

    const insertResult = await surveyPool.query(
      `
      INSERT INTO unidate_app.match_messages(
        match_result_id,
        sender_respondent_id,
        message_text
      )
      VALUES ($1, $2, $3)
      RETURNING id, message_text, created_at
      `,
      [matchResultId, respondentId, content]
    );

    const row = insertResult.rows[0];
    return success('Message sent', {
      match_result_id: matchResultId,
      message: {
        id: row.id,
        content: row.message_text || '',
        created_at: row.created_at,
        is_self: true
      }
    });
  } catch (error) {
    console.error('POST /api/match/chat failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
