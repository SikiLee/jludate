import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId } from 'lib/identityLink';
import { readJson } from 'lib/request';
import { bizError, httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertParticipantOrFail({ matchResultId, respondentId }) {
  const res = await surveyPool.query(
    `
    SELECT respondent1_id, respondent2_id
    FROM unidate_app.match_results
    WHERE id = $1
    LIMIT 1
    `,
    [matchResultId]
  );
  if (res.rowCount === 0) {
    return { ok: false, status: 404, msg: 'Match not found' };
  }
  const row = res.rows[0];
  const isParticipant = row.respondent1_id === respondentId || row.respondent2_id === respondentId;
  if (!isParticipant) {
    return { ok: false, status: 403, msg: 'Forbidden' };
  }
  return { ok: true, row };
}

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getCurrentUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }
    const respondentId = await getRespondentIdByUserId(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'match_chat_get'
    });
    if (!respondentId) {
      return httpError(400, 'No respondent id');
    }

    const url = new URL(request.url);
    const matchResultId = Number(url.searchParams.get('match_result_id'));
    if (!Number.isInteger(matchResultId) || matchResultId <= 0) {
      return httpError(400, 'match_result_id is required');
    }

    const check = await assertParticipantOrFail({ matchResultId, respondentId });
    if (!check.ok) {
      return httpError(check.status, check.msg);
    }

    const messagesRes = await surveyPool.query(
      `
      SELECT id, sender_respondent_id, message_text, created_at
      FROM unidate_app.match_messages
      WHERE match_result_id = $1
      ORDER BY id ASC
      LIMIT 200
      `,
      [matchResultId]
    );

    return success('success', {
      match_result_id: matchResultId,
      messages: messagesRes.rows.map((m) => ({
        id: m.id,
        sender_respondent_id: m.sender_respondent_id,
        message_text: m.message_text,
        created_at: m.created_at
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
    const respondentId = await getRespondentIdByUserId(identityPool, authResult.user.id, {
      actor: `user:${authResult.user.id}`,
      purpose: 'match_chat_post'
    });
    if (!respondentId) {
      return httpError(400, 'No respondent id');
    }

    const body = await readJson(request);
    const matchResultId = Number(body?.match_result_id);
    const messageText = typeof body?.message_text === 'string' ? body.message_text.trim() : '';
    if (!Number.isInteger(matchResultId) || matchResultId <= 0) {
      return httpError(400, 'match_result_id is required');
    }
    if (!messageText) {
      return bizError(400, '请输入消息内容');
    }
    if ([...messageText].length > 500) {
      return bizError(400, '消息过长（最多 500 字）');
    }

    const check = await assertParticipantOrFail({ matchResultId, respondentId });
    if (!check.ok) {
      return httpError(check.status, check.msg);
    }

    const ins = await surveyPool.query(
      `
      INSERT INTO unidate_app.match_messages(match_result_id, sender_respondent_id, message_text)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [matchResultId, respondentId, messageText]
    );

    return success('sent', {
      id: ins.rows[0].id,
      created_at: ins.rows[0].created_at
    });
  } catch (error) {
    console.error('POST /api/match/chat failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
