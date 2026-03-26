import {
  getHomeMetricsVisibilitySettings,
  getMatchScheduleSettings,
  getNextMatchTimeInShanghai
} from './siteConfig.js';

function computeCompletionRate(registeredUsers, completedUsers) {
  if (!Number.isFinite(registeredUsers) || registeredUsers <= 0) {
    return 0;
  }

  const rate = Math.round((completedUsers / registeredUsers) * 100);
  if (!Number.isFinite(rate)) {
    return 0;
  }
  return Math.max(0, Math.min(100, rate));
}

export async function getPublicHomeMetrics(identityDb, surveyDb) {
  const [registeredResult, completedResult, matchedUsersResult, matchSchedule, homeMetricsVisibility] = await Promise.all([
    identityDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM unidate_app.users
      WHERE is_active = TRUE
      `
    ),
    surveyDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM unidate_app.survey_responses
      `
    ),
    surveyDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT respondent1_id AS respondent_id
        FROM unidate_app.match_results
        WHERE respondent1_id IS NOT NULL
        UNION
        SELECT respondent2_id AS respondent_id
        FROM unidate_app.match_results
        WHERE respondent2_id IS NOT NULL
      ) matched_users
      `
    ),
    getMatchScheduleSettings(surveyDb),
    getHomeMetricsVisibilitySettings(surveyDb)
  ]);

  const registeredUsers = registeredResult.rows[0]?.total || 0;
  const completedUsers = completedResult.rows[0]?.total || 0;
  const matchedUsers = matchedUsersResult.rows[0]?.total || 0;
  const metricVisibility = homeMetricsVisibility || {
    registered_users: true,
    survey_completion_rate: true,
    matched_users: true
  };

  const nextMatchAt = getNextMatchTimeInShanghai(matchSchedule);
  const nowShanghai = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const secondsToNextMatch = Math.max(0, Math.floor((nextMatchAt.getTime() - nowShanghai.getTime()) / 1000));

  return {
    registered_users: metricVisibility.registered_users ? registeredUsers : null,
    survey_completed_users: metricVisibility.survey_completion_rate ? completedUsers : null,
    survey_completion_rate: metricVisibility.survey_completion_rate ? computeCompletionRate(registeredUsers, completedUsers) : null,
    matched_users: metricVisibility.matched_users ? matchedUsers : null,
    metric_visibility: metricVisibility,
    next_match_in_seconds: secondsToNextMatch
  };
}
