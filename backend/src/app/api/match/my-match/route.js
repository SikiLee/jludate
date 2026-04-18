import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserFromRequest } from 'lib/auth';
import { getRespondentIdByUserId, getUserMatchDisplayProfileByRespondentId } from 'lib/identityLink';
import { httpError, success } from 'lib/response';
import { markFirstMatchedResultView, recordAnalyticsEvent } from 'lib/matchAnalytics';
import { buildMatchReportFromDrafts } from 'lib/matchReport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeCategory(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'xinghua') return 'xinghua';
  return v === 'friend' ? 'friend' : 'love';
}

function buildUnmatchedMessage(reasonCode) {
  if (reasonCode === 'below_threshold') {
    return '本周未匹配到合适对象（候选均低于阈值），下周会继续为你尝试。';
  }
  if (reasonCode === 'not_selected') {
    return '本周候选充足，但在全局最优分配中未被选中；下周会继续为你尝试。';
  }
  return '本周暂未匹配到合适对象，下周会继续为你尝试。';
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
      purpose: 'match_my_match_get'
    });
    if (!respondentId) {
      return success('success', {
        self: { respondent_id: null },
        status: 'unmatched',
        reason_code: 'no_profile',
        message: buildUnmatchedMessage('no_candidate')
      });
    }

    const url = new URL(request.url);
    const category = normalizeCategory(url.searchParams.get('category'));

    const latest = await surveyPool.query(
      `
      SELECT
        r.run_id,
        r.match_category,
        r.status,
        r.match_result_id,
        r.reason_code,
        r.score_snapshot,
        mr.respondent1_id,
        mr.respondent2_id,
        mr.final_match_percent,
        mr.created_at AS matched_at,
        runs.cycle_id,
        runs.run_key,
        runs.completed_at
      FROM unidate_app.match_cycle_results r
      LEFT JOIN unidate_app.match_results mr ON mr.id = r.match_result_id
      LEFT JOIN unidate_app.match_runs runs ON runs.id = r.run_id
      WHERE r.respondent_id = $1
        AND r.match_category = $2
      ORDER BY r.created_at DESC
      LIMIT 1
      `,
      [respondentId, category]
    );

    if (latest.rowCount === 0) {
      return success('success', {
        self: { respondent_id: respondentId },
        status: 'unmatched',
        reason_code: 'no_result',
        message: '本周结果尚未生成，请稍后再来查看。'
      });
    }

    const row = latest.rows[0];
    const status = String(row.status || '').toLowerCase() === 'matched' ? 'matched' : 'unmatched';
    const cycle = {
      cycle_id: row.cycle_id || null,
      run_key: row.run_key || null,
      completed_at: row.completed_at || null,
      category
    };

    if (status !== 'matched' || !row.match_result_id) {
      const reasonCode = row.reason_code || 'no_candidate';
      return success('success', {
        self: { respondent_id: respondentId },
        cycle,
        status: 'unmatched',
        reason_code: reasonCode,
        message: buildUnmatchedMessage(reasonCode)
      });
    }

    const partnerRespondentId = row.respondent1_id === respondentId ? row.respondent2_id : row.respondent1_id;
    const partnerProfile = await getUserMatchDisplayProfileByRespondentId(identityPool, partnerRespondentId, {
      actor: `user:${authResult.user.id}`,
      purpose: 'match_my_match_partner_profile'
    });
    const draftsRes = await surveyPool.query(
      `
      SELECT respondent_id, payload
      FROM unidate_app.match_questionnaire_drafts
      WHERE category = $1
        AND respondent_id = ANY($2::text[])
      `,
      [category, [respondentId, partnerRespondentId]]
    );
    const draftMap = new Map(draftsRes.rows.map((r) => [r.respondent_id, r.payload || {}]));
    const selfPayload = draftMap.get(respondentId) || {};
    const partnerPayload = draftMap.get(partnerRespondentId) || {};
    const partnerSettings = partnerPayload && typeof partnerPayload.match_settings === 'object' && partnerPayload.match_settings !== null
      ? partnerPayload.match_settings
      : {};
    const partnerIncludeMessage = Boolean(partnerSettings.include_message_to_partner);
    const partnerDraftMessage = partnerIncludeMessage && typeof partnerSettings.message_to_partner === 'string'
      ? partnerSettings.message_to_partner.trim()
      : '';

    let report = null;
    let matchReasons = [];
    if (category === 'xinghua') {
      const partnerType = typeof partnerProfile?.xinghua_ti_type === 'string'
        ? partnerProfile.xinghua_ti_type.trim()
        : '';
      matchReasons = [partnerType || '未填写'];
    } else {
      report = await buildMatchReportFromDrafts({
        category,
        selfDraft: selfPayload,
        partnerDraft: partnerPayload,
        finalPercent: Number(row.final_match_percent) || Number(row.score_snapshot) || 0
      });
      matchReasons = report.top_reasons;
    }
    if (Number.isInteger(Number(row.cycle_id))) {
      await markFirstMatchedResultView({
        cycleId: Number(row.cycle_id),
        category,
        respondentId
      });
    }
    await recordAnalyticsEvent({
      eventKey: 'match_page_matched',
      userId: authResult.user.id,
      respondentId,
      payload: { category, cycle_id: row.cycle_id || null }
    });

    return success('success', {
      self: { respondent_id: respondentId },
      cycle,
      status: 'matched',
      match_reasons: matchReasons,
      detailed_report: report,
      match: {
        match_result_id: row.match_result_id,
        final_match_percent: Number(row.final_match_percent) || Number(row.score_snapshot) || 0,
        matched_at: row.matched_at || null
      },
      partner: partnerProfile
        ? {
          ...partnerProfile,
          message_to_partner: partnerDraftMessage || partnerProfile.message_to_partner || ''
        }
        : null
    });
  } catch (error) {
    console.error('GET /api/match/my-match failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
