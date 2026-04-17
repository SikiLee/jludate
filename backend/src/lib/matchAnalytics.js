import { identityPool, surveyPool } from 'lib/db';
import { getCurrentMatchCycle, runWeeklyMatchingPipeline } from 'lib/weeklyMatch';

const TRACKABLE_EVENT_KEYS = new Set([
  'site_click',
  'home_visit',
  'survey_open',
  'questionnaire_submit',
  'match_page_open',
  'match_page_matched',
  'xinghua_ti_open',
  'xinghua_ti_submit',
  'chat_open',
  'chat_send'
]);

function safeVisitorKey(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 128);
}

function normalizeEventKey(raw) {
  if (typeof raw !== 'string') return '';
  const key = raw.trim().toLowerCase();
  return TRACKABLE_EVENT_KEYS.has(key) ? key : '';
}

export async function recordAnalyticsEvent({
  eventKey,
  visitorKey = '',
  userId = null,
  respondentId = null,
  payload = {}
}) {
  const ek = normalizeEventKey(eventKey);
  if (!ek) return { ok: false, reason: 'invalid_event' };

  const vk = safeVisitorKey(visitorKey) || null;
  const uid = Number.isInteger(Number(userId)) ? Number(userId) : null;
  const rid = typeof respondentId === 'string' && respondentId.trim() ? respondentId.trim() : null;
  const meta = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

  await surveyPool.query(
    `
    INSERT INTO unidate_app.analytics_events(
      event_key,
      visitor_key,
      user_id,
      respondent_id,
      event_payload
    )
    VALUES ($1,$2,$3,$4,$5::jsonb)
    `,
    [ek, vk, uid, rid, JSON.stringify(meta)]
  );
  return { ok: true };
}

export async function markFirstMatchedResultView({ cycleId, category, respondentId }) {
  if (!Number.isInteger(Number(cycleId)) || !respondentId) return false;
  const c = category === 'friend' ? 'friend' : 'love';
  const res = await surveyPool.query(
    `
    INSERT INTO unidate_app.match_cycle_result_views(cycle_id, match_category, respondent_id)
    VALUES ($1,$2,$3)
    ON CONFLICT (cycle_id, match_category, respondent_id) DO NOTHING
    RETURNING id
    `,
    [Number(cycleId), c, respondentId]
  );
  return res.rowCount > 0;
}

async function getRegisteredUsersCount() {
  const res = await identityPool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM unidate_app.users
    WHERE is_active = TRUE
    `
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCurrentCycleRegisteredUsersCount(cycle) {
  if (!cycle?.started_at) return 0;
  const res = await identityPool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM unidate_app.users
    WHERE is_active = TRUE
      AND created_at >= $1
    `,
    [cycle.started_at]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCumulativeClickUsersCount() {
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT COALESCE(NULLIF(visitor_key, ''), respondent_id, CONCAT('u-', user_id::text)))::int AS total
    FROM unidate_app.analytics_events
    WHERE event_key = 'site_click'
      AND (
        (visitor_key IS NOT NULL AND NULLIF(visitor_key, '') IS NOT NULL)
        OR respondent_id IS NOT NULL
        OR user_id IS NOT NULL
      )
    `
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCurrentCycleClickUsersCount(cycle) {
  if (!cycle?.started_at) return 0;
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT COALESCE(NULLIF(visitor_key, ''), respondent_id, CONCAT('u-', user_id::text)))::int AS total
    FROM unidate_app.analytics_events
    WHERE event_key = 'site_click'
      AND created_at >= $1
      AND (
        (visitor_key IS NOT NULL AND NULLIF(visitor_key, '') IS NOT NULL)
        OR respondent_id IS NOT NULL
        OR user_id IS NOT NULL
      )
    `,
    [cycle.started_at]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getQuestionnaireFilledCount(cycle) {
  if (!cycle?.started_at) {
    const res = await surveyPool.query(
      `
      SELECT COUNT(DISTINCT respondent_id)::int AS total
      FROM unidate_app.match_questionnaire_drafts
      WHERE completed = TRUE
        AND category IN ('love', 'friend')
      `
    );
    return Number(res.rows[0]?.total || 0);
  }
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT respondent_id)::int AS total
    FROM unidate_app.match_questionnaire_drafts
    WHERE completed = TRUE
      AND category IN ('love', 'friend')
      AND updated_at >= $1
    `,
    [cycle.started_at]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getQuestionnaireFilledCountByCategory(cycle) {
  if (!cycle?.started_at) {
    const res = await surveyPool.query(
      `
      SELECT category, COUNT(DISTINCT respondent_id)::int AS total
      FROM unidate_app.match_questionnaire_drafts
      WHERE completed = TRUE
        AND category IN ('love', 'friend', 'xinghua')
      GROUP BY category
      `
    );
    const xinghuaFromEvents = await getCumulativeXinghuaTiSubmitUsers();
    return {
      love: Number(res.rows.find((r) => r.category === 'love')?.total || 0),
      friend: Number(res.rows.find((r) => r.category === 'friend')?.total || 0),
      xinghua: xinghuaFromEvents
    };
  }
  const res = await surveyPool.query(
    `
    SELECT category, COUNT(DISTINCT respondent_id)::int AS total
    FROM unidate_app.match_questionnaire_drafts
    WHERE completed = TRUE
      AND category IN ('love', 'friend', 'xinghua')
      AND updated_at >= $1
    GROUP BY category
    `,
    [cycle.started_at]
  );
  const xinghuaFromEvents = await getCycleXinghuaTiSubmitUsers(cycle.started_at);
  return {
    love: Number(res.rows.find((r) => r.category === 'love')?.total || 0),
    friend: Number(res.rows.find((r) => r.category === 'friend')?.total || 0),
    xinghua: xinghuaFromEvents
  };
}

async function getCumulativeXinghuaTiSubmitUsers() {
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT COALESCE(NULLIF(visitor_key, ''), respondent_id, CONCAT('u-', user_id::text)))::int AS total
    FROM unidate_app.analytics_events
    WHERE event_key = 'xinghua_ti_submit'
      AND (
        (visitor_key IS NOT NULL AND NULLIF(visitor_key, '') IS NOT NULL)
        OR respondent_id IS NOT NULL
        OR user_id IS NOT NULL
      )
    `
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCycleXinghuaTiSubmitUsers(cycleStartAt) {
  if (!cycleStartAt) return 0;
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT COALESCE(NULLIF(visitor_key, ''), respondent_id, CONCAT('u-', user_id::text)))::int AS total
    FROM unidate_app.analytics_events
    WHERE event_key = 'xinghua_ti_submit'
      AND created_at >= $1
      AND (
        (visitor_key IS NOT NULL AND NULLIF(visitor_key, '') IS NOT NULL)
        OR respondent_id IS NOT NULL
        OR user_id IS NOT NULL
      )
    `,
    [cycleStartAt]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCycleMatchedUsersCount(cycleId) {
  if (!cycleId) return 0;
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT r.respondent_id)::int AS total
    FROM unidate_app.match_cycle_results r
    INNER JOIN unidate_app.match_runs runs ON runs.id = r.run_id
    WHERE runs.cycle_id = $1
      AND r.status = 'matched'
    `,
    [cycleId]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCycleMatchedUsersCountByCategory(cycleId) {
  if (!cycleId) {
    return { love: 0, friend: 0, xinghua: 0 };
  }
  const res = await surveyPool.query(
    `
    SELECT r.match_category AS category, COUNT(DISTINCT r.respondent_id)::int AS total
    FROM unidate_app.match_cycle_results r
    INNER JOIN unidate_app.match_runs runs ON runs.id = r.run_id
    WHERE runs.cycle_id = $1
      AND r.status = 'matched'
      AND r.match_category IN ('love', 'friend', 'xinghua')
    GROUP BY r.match_category
    `,
    [cycleId]
  );
  return {
    love: Number(res.rows.find((r) => r.category === 'love')?.total || 0),
    friend: Number(res.rows.find((r) => r.category === 'friend')?.total || 0),
    xinghua: Number(res.rows.find((r) => r.category === 'xinghua')?.total || 0)
  };
}

async function getCycleFirstMatchedResultViewUsers(cycleId) {
  if (!cycleId) return 0;
  const res = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT respondent_id)::int AS total
    FROM unidate_app.match_cycle_result_views
    WHERE cycle_id = $1
    `,
    [cycleId]
  );
  return Number(res.rows[0]?.total || 0);
}

async function getCycleFirstMatchedResultViewUsersByCategory(cycleId) {
  if (!cycleId) return { love: 0, friend: 0, xinghua: 0 };
  const res = await surveyPool.query(
    `
    SELECT match_category AS category, COUNT(DISTINCT respondent_id)::int AS total
    FROM unidate_app.match_cycle_result_views
    WHERE cycle_id = $1
      AND match_category IN ('love', 'friend', 'xinghua')
    GROUP BY match_category
    `,
    [cycleId]
  );
  return {
    love: Number(res.rows.find((r) => r.category === 'love')?.total || 0),
    friend: Number(res.rows.find((r) => r.category === 'friend')?.total || 0),
    xinghua: Number(res.rows.find((r) => r.category === 'xinghua')?.total || 0)
  };
}

async function getCycleChatSideStats(cycleId) {
  if (!cycleId) {
    return {
      one_side_initiated_users: 0,
      both_sides_initiated_users: 0
    };
  }

  const res = await surveyPool.query(
    `
    WITH per_match AS (
      SELECT
        mr.id AS match_result_id,
        COUNT(DISTINCT mm.sender_respondent_id)::int AS sender_sides,
        ARRAY_AGG(DISTINCT mm.sender_respondent_id) FILTER (WHERE mm.sender_respondent_id IS NOT NULL) AS senders
      FROM unidate_app.match_results mr
      INNER JOIN unidate_app.match_runs runs ON runs.id = mr.run_id
      LEFT JOIN unidate_app.match_messages mm ON mm.match_result_id = mr.id
      WHERE runs.cycle_id = $1
      GROUP BY mr.id
    )
    SELECT
      COALESCE((
        SELECT COUNT(DISTINCT s)::int
        FROM per_match p, UNNEST(COALESCE(p.senders, ARRAY[]::text[])) AS s
        WHERE p.sender_sides = 1
      ), 0) AS one_side_users,
      COALESCE((
        SELECT COUNT(DISTINCT s)::int
        FROM per_match p, UNNEST(COALESCE(p.senders, ARRAY[]::text[])) AS s
        WHERE p.sender_sides >= 2
      ), 0) AS both_side_users
    `,
    [cycleId]
  );

  return {
    one_side_initiated_users: Number(res.rows[0]?.one_side_users || 0),
    both_sides_initiated_users: Number(res.rows[0]?.both_side_users || 0)
  };
}

export async function getAdminMatchDashboardMetrics() {
  const cycle = await getCurrentMatchCycle();
  const cycleId = cycle?.id || null;

  const [
    cumulativeClickUsers,
    currentCycleClickUsers,
    registeredUsers,
    currentCycleRegisteredUsers,
    cumulativeXinghuaTiSubmitUsers,
    questionnaireFilledUsers,
    questionnaireFilledByCategory,
    matchedUsers,
    matchedUsersByCategory,
    firstViewUsers,
    firstViewUsersByCategory,
    chatStats
  ] = await Promise.all([
    getCumulativeClickUsersCount(),
    getCurrentCycleClickUsersCount(cycle),
    getRegisteredUsersCount(),
    getCurrentCycleRegisteredUsersCount(cycle),
    getCumulativeXinghuaTiSubmitUsers(),
    getQuestionnaireFilledCount(cycle),
    getQuestionnaireFilledCountByCategory(cycle),
    getCycleMatchedUsersCount(cycleId),
    getCycleMatchedUsersCountByCategory(cycleId),
    getCycleFirstMatchedResultViewUsers(cycleId),
    getCycleFirstMatchedResultViewUsersByCategory(cycleId),
    getCycleChatSideStats(cycleId)
  ]);

  const successRate = questionnaireFilledUsers > 0
    ? Math.round((matchedUsers / questionnaireFilledUsers) * 1000) / 10
    : 0;

  return {
    cycle: cycle
      ? {
          id: cycle.id,
          started_at: cycle.started_at,
          started_by: cycle.started_by
        }
      : null,
    cumulative_click_users: cumulativeClickUsers,
    current_cycle_click_users: currentCycleClickUsers,
    registered_users: registeredUsers,
    current_cycle_registered_users: currentCycleRegisteredUsers,
    cumulative_xinghua_ti_submit_users: cumulativeXinghuaTiSubmitUsers,
    current_cycle_questionnaire_filled_users: questionnaireFilledUsers,
    current_cycle_questionnaire_filled_users_by_category: questionnaireFilledByCategory,
    current_cycle_first_result_page_view_users: firstViewUsers,
    current_cycle_first_result_page_view_users_by_category: firstViewUsersByCategory,
    current_cycle_chat_one_side_initiated_users: chatStats.one_side_initiated_users,
    current_cycle_chat_both_sides_initiated_users: chatStats.both_sides_initiated_users,
    current_cycle_matched_users: matchedUsers,
    current_cycle_matched_users_by_category: matchedUsersByCategory,
    current_cycle_match_success_rate: successRate,
    recent_cycles: await getRecentCycleSummaries(8)
  };
}

export async function runAdminOneClickMatch({ adminUserId, categories }) {
  const run = await runWeeklyMatchingPipeline({
    initiatedBy: `admin:${adminUserId}`,
    sendEmails: true,
    categories
  });
  const cycleId = run?.cycle_id || null;
  const metrics = await getAdminMatchDashboardMetrics();
  return {
    cycle_id: cycleId,
    run,
    result: {
      matched_users: metrics.current_cycle_matched_users,
      success_rate: metrics.current_cycle_match_success_rate
    }
  };
}

async function getRecentCycleSummaries(limit = 8) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));
  const res = await surveyPool.query(
    `
    WITH cycles AS (
      SELECT
        c.id,
        c.started_at,
        c.started_by,
        LEAD(c.started_at) OVER (ORDER BY c.started_at ASC) AS next_started_at
      FROM unidate_app.match_cycles c
      ORDER BY c.started_at DESC
      LIMIT $1
    ),
    questionnaire AS (
      SELECT
        cy.id AS cycle_id,
        COUNT(DISTINCT d.respondent_id)::int AS questionnaire_filled_users
      FROM cycles cy
      LEFT JOIN unidate_app.match_questionnaire_drafts d
        ON d.completed = TRUE
       AND d.category IN ('love', 'friend')
       AND d.updated_at >= cy.started_at
       AND (cy.next_started_at IS NULL OR d.updated_at < cy.next_started_at)
      GROUP BY cy.id
    ),
    matched AS (
      SELECT
        cy.id AS cycle_id,
        COUNT(DISTINCT r.respondent_id)::int AS matched_users
      FROM cycles cy
      LEFT JOIN unidate_app.match_runs runs ON runs.cycle_id = cy.id
      LEFT JOIN unidate_app.match_cycle_results r ON r.run_id = runs.id AND r.status = 'matched'
      GROUP BY cy.id
    ),
    views AS (
      SELECT
        cy.id AS cycle_id,
        COUNT(DISTINCT v.respondent_id)::int AS first_view_users
      FROM cycles cy
      LEFT JOIN unidate_app.match_cycle_result_views v ON v.cycle_id = cy.id
      GROUP BY cy.id
    ),
    chat AS (
      SELECT
        cy.id AS cycle_id,
        COALESCE((
          SELECT COUNT(DISTINCT s)::int
          FROM (
            SELECT
              mr.id AS match_result_id,
              COUNT(DISTINCT mm.sender_respondent_id)::int AS sender_sides,
              ARRAY_AGG(DISTINCT mm.sender_respondent_id) FILTER (WHERE mm.sender_respondent_id IS NOT NULL) AS senders
            FROM unidate_app.match_runs runs2
            INNER JOIN unidate_app.match_results mr ON mr.run_id = runs2.id
            LEFT JOIN unidate_app.match_messages mm ON mm.match_result_id = mr.id
            WHERE runs2.cycle_id = cy.id
            GROUP BY mr.id
          ) pm, UNNEST(COALESCE(pm.senders, ARRAY[]::text[])) AS s
          WHERE pm.sender_sides = 1
        ), 0) AS one_side_users,
        COALESCE((
          SELECT COUNT(DISTINCT s)::int
          FROM (
            SELECT
              mr.id AS match_result_id,
              COUNT(DISTINCT mm.sender_respondent_id)::int AS sender_sides,
              ARRAY_AGG(DISTINCT mm.sender_respondent_id) FILTER (WHERE mm.sender_respondent_id IS NOT NULL) AS senders
            FROM unidate_app.match_runs runs2
            INNER JOIN unidate_app.match_results mr ON mr.run_id = runs2.id
            LEFT JOIN unidate_app.match_messages mm ON mm.match_result_id = mr.id
            WHERE runs2.cycle_id = cy.id
            GROUP BY mr.id
          ) pm, UNNEST(COALESCE(pm.senders, ARRAY[]::text[])) AS s
          WHERE pm.sender_sides >= 2
        ), 0) AS both_side_users
      FROM cycles cy
    )
    SELECT
      cy.id,
      cy.started_at,
      cy.started_by,
      COALESCE(q.questionnaire_filled_users, 0) AS questionnaire_filled_users,
      COALESCE(m.matched_users, 0) AS matched_users,
      COALESCE(v.first_view_users, 0) AS first_view_users,
      COALESCE(ch.one_side_users, 0) AS chat_one_side_users,
      COALESCE(ch.both_side_users, 0) AS chat_both_sides_users
    FROM cycles cy
    LEFT JOIN questionnaire q ON q.cycle_id = cy.id
    LEFT JOIN matched m ON m.cycle_id = cy.id
    LEFT JOIN views v ON v.cycle_id = cy.id
    LEFT JOIN chat ch ON ch.cycle_id = cy.id
    ORDER BY cy.started_at DESC
    `,
    [safeLimit]
  );

  return res.rows.map((row) => {
    const questionnaireFilled = Number(row.questionnaire_filled_users || 0);
    const matchedUsers = Number(row.matched_users || 0);
    const successRate = questionnaireFilled > 0
      ? Math.round((matchedUsers / questionnaireFilled) * 1000) / 10
      : 0;
    return {
      cycle_id: Number(row.id),
      started_at: row.started_at,
      started_by: row.started_by || 'system',
      questionnaire_filled_users: questionnaireFilled,
      matched_users: matchedUsers,
      success_rate: successRate,
      first_view_users: Number(row.first_view_users || 0),
      chat_one_side_users: Number(row.chat_one_side_users || 0),
      chat_both_sides_users: Number(row.chat_both_sides_users || 0)
    };
  });
}

