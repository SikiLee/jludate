import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { listActiveIdentityProfilesForMatching } from 'lib/identityLink';
import { sendMatchEmail } from 'lib/email';

function getShanghaiWallDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
}

function getShanghaiIsoWeekKey(date = new Date()) {
  const shDate = getShanghaiWallDate(date);
  shDate.setHours(0, 0, 0, 0);

  const target = new Date(shDate.getTime());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);

  const weekNo = 1 + Math.round((target - firstThursday) / 604800000);
  return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getCurrentScheduledBroadcastRunKey(date = new Date()) {
  return `scheduled-broadcast-${getShanghaiIsoWeekKey(date)}`;
}

async function listEligibleRespondentIds(respondentIds) {
  if (!Array.isArray(respondentIds) || respondentIds.length === 0) {
    return new Set();
  }

  const result = await surveyPool.query(
    `
    SELECT DISTINCT respondent_id
    FROM unidate_app.match_questionnaire_drafts
    WHERE respondent_id = ANY($1::text[])
      AND category IN ('love', 'friend')
      AND completed = TRUE
    `,
    [respondentIds]
  );

  return new Set(result.rows.map((row) => row.respondent_id).filter(Boolean));
}

export async function runMatchResultBroadcast({
  runKey = getCurrentScheduledBroadcastRunKey(),
  initiatedBy = 'scheduler'
} = {}) {
  await ensureSchema();

  const runInsert = await surveyPool.query(
    `
    INSERT INTO unidate_app.match_runs(run_type, run_key, status, initiated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (run_key) DO NOTHING
    RETURNING id
    `,
    ['scheduled_broadcast', runKey, 'running', initiatedBy]
  );
  if (runInsert.rowCount === 0) {
    return { skipped: true, reason: 'run_exists', run_key: runKey, recipients: 0, delivered: 0, failed: 0 };
  }

  const runId = runInsert.rows[0].id;
  try {
    const profiles = await listActiveIdentityProfilesForMatching(identityPool, {
      actor: 'system:broadcast',
      purpose: 'load_broadcast_recipients'
    });
    const respondentIds = profiles.map((item) => item.respondent_id);
    const eligibleRespondentIds = await listEligibleRespondentIds(respondentIds);
    const recipients = profiles.filter((item) => eligibleRespondentIds.has(item.respondent_id));

    const now = new Date();
    let delivered = 0;
    let failed = 0;
    for (const item of recipients) {
      const sent = await sendMatchEmail({
        toEmail: item.email,
        partnerNickname: '本周结果已更新',
        matchPercent: 0,
        selfRose: '-',
        partnerRose: '-',
        runAt: now
      });
      if (sent) {
        delivered += 1;
      } else {
        failed += 1;
      }
    }

    const runStatus = failed > 0 ? 'completed_with_errors' : 'completed';

    await surveyPool.query(
      `
      UPDATE unidate_app.match_runs
      SET status = $1,
          candidate_count = $2,
          pair_count = $3,
          completed_at = NOW()
      WHERE id = $4
      `,
      [runStatus, profiles.length, delivered, runId]
    );

    return {
      skipped: false,
      reason: 'ok',
      run_key: runKey,
      recipients: recipients.length,
      delivered,
      failed
    };
  } catch (error) {
    await surveyPool.query(
      `
      UPDATE unidate_app.match_runs
      SET status = $1,
          completed_at = NOW()
      WHERE id = $2
      `,
      ['failed', runId]
    );
    throw error;
  }
}
