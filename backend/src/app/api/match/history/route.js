import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId, getUserMatchDisplayProfileByRespondentId } from 'lib/identityLink';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeCategory(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'friend' ? 'friend' : 'love';
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
      purpose: 'match_history_get'
    });
    if (!respondentId) {
      return success('success', { category: 'love', history: [] });
    }

    const url = new URL(request.url);
    const category = normalizeCategory(url.searchParams.get('category'));
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 10)));

    const rowsRes = await surveyPool.query(
      `
      SELECT
        r.id AS cycle_id,
        r.status,
        r.reason_code,
        r.score_snapshot,
        r.created_at AS cycle_created_at,
        mr.id AS match_result_id,
        mr.respondent1_id,
        mr.respondent2_id,
        mr.final_match_percent,
        runs.run_key,
        runs.completed_at
      FROM unidate_app.match_cycle_results r
      LEFT JOIN unidate_app.match_results mr ON mr.id = r.match_result_id
      LEFT JOIN unidate_app.match_runs runs ON runs.id = r.run_id
      WHERE r.respondent_id = $1
        AND r.match_category = $2
      ORDER BY r.created_at DESC
      LIMIT $3
      `,
      [respondentId, category, limit]
    );

    const history = [];
    for (const row of rowsRes.rows) {
      const status = String(row.status || '').toLowerCase() === 'matched' ? 'matched' : 'unmatched';
      let partner = null;
      if (status === 'matched' && row.match_result_id) {
        const partnerRespondentId = row.respondent1_id === respondentId ? row.respondent2_id : row.respondent1_id;
        // eslint-disable-next-line no-await-in-loop
        partner = await getUserMatchDisplayProfileByRespondentId(identityPool, partnerRespondentId, {
          actor: `user:${authResult.user.id}`,
          purpose: 'match_history_partner_profile'
        });
      }
      history.push({
        status,
        reason_code: row.reason_code || null,
        score_snapshot: row.score_snapshot !== null ? Number(row.score_snapshot) : null,
        created_at: row.cycle_created_at,
        run_key: row.run_key || null,
        completed_at: row.completed_at || null,
        match_result_id: row.match_result_id || null,
        final_match_percent: row.final_match_percent !== null ? Number(row.final_match_percent) : null,
        partner
      });
    }

    return success('success', { category, history });
  } catch (error) {
    console.error('GET /api/match/history failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

