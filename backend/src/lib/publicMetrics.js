function getShanghaiWallDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
}

function getNextTuesday21Shanghai(date = new Date()) {
  const shanghaiNow = getShanghaiWallDate(date);
  const target = new Date(shanghaiNow.getTime());

  const day = shanghaiNow.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7;
  target.setDate(target.getDate() + daysUntilTuesday);
  target.setHours(21, 0, 0, 0);

  if (daysUntilTuesday === 0 && shanghaiNow >= target) {
    target.setDate(target.getDate() + 7);
  }

  return target;
}

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
  const [registeredResult, completedResult, matchedUsersResult] = await Promise.all([
    identityDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM szudate_app.users
      WHERE is_active = TRUE
      `
    ),
    surveyDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM szudate_app.survey_responses
      `
    ),
    surveyDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT respondent1_id AS respondent_id
        FROM szudate_app.match_results
        WHERE respondent1_id IS NOT NULL
        UNION
        SELECT respondent2_id AS respondent_id
        FROM szudate_app.match_results
        WHERE respondent2_id IS NOT NULL
      ) matched_users
      `
    )
  ]);

  const registeredUsers = registeredResult.rows[0]?.total || 0;
  const completedUsers = completedResult.rows[0]?.total || 0;
  const matchedUsers = matchedUsersResult.rows[0]?.total || 0;

  const nextMatchAt = getNextTuesday21Shanghai();
  const nowShanghai = getShanghaiWallDate();
  const secondsToNextMatch = Math.max(0, Math.floor((nextMatchAt.getTime() - nowShanghai.getTime()) / 1000));

  return {
    registered_users: registeredUsers,
    survey_completed_users: completedUsers,
    survey_completion_rate: computeCompletionRate(registeredUsers, completedUsers),
    matched_users: matchedUsers,
    next_match_in_seconds: secondsToNextMatch
  };
}
