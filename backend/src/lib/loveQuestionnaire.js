const TARGET_GENDER_VALUES = new Set(['male', 'female']);

function normalizeAgeSlot(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 12) {
    return null;
  }
  return n;
}

export function normalizeLoveQuestionnairePayload(raw) {
  const hard = raw && typeof raw.hard_filter === 'object' && raw.hard_filter !== null ? raw.hard_filter : {};
  const deep = raw && typeof raw.deep_survey === 'object' && raw.deep_survey !== null ? raw.deep_survey : {};
  const settings = raw && typeof raw.match_settings === 'object' && raw.match_settings !== null ? raw.match_settings : {};

  const targetGender = typeof hard.target_gender === 'string' ? hard.target_gender.trim() : '';
  const normalizedTarget = TARGET_GENDER_VALUES.has(targetGender) ? targetGender : '';

  const ageOlder = normalizeAgeSlot(hard.age_diff_older_max);
  const ageYounger = normalizeAgeSlot(hard.age_diff_younger_max);

  let acceptSmoking = hard.accept_smoking;
  if (acceptSmoking !== true && acceptSmoking !== false) {
    acceptSmoking = null;
  }

  let acceptCrossCampus = hard.accept_cross_campus;
  if (acceptCrossCampus !== true && acceptCrossCampus !== false) {
    acceptCrossCampus = null;
  }

  const share =
    settings.share_contact_with_match === true
    || settings.share_contact_with_match === 'true';
  const rawContact = typeof settings.match_contact_detail === 'string' ? settings.match_contact_detail.trim() : '';
  let autoWeekly = settings.auto_participate_weekly_match;
  if (autoWeekly !== true && autoWeekly !== false) {
    autoWeekly = true;
  }

  return {
    hard_filter: {
      target_gender: normalizedTarget,
      accept_cross_campus: acceptCrossCampus,
      age_diff_older_max: ageOlder,
      age_diff_younger_max: ageYounger,
      accept_smoking: acceptSmoking
    },
    deep_survey: deep,
    match_settings: {
      share_contact_with_match: share,
      match_contact_detail: share ? rawContact : '',
      auto_participate_weekly_match: autoWeekly
    }
  };
}

export function hardFilterStepComplete(hard) {
  if (!hard || typeof hard !== 'object') {
    return false;
  }
  if (!hard.target_gender) {
    return false;
  }
  if (hard.accept_smoking !== true && hard.accept_smoking !== false) {
    return false;
  }
  if (hard.accept_cross_campus !== true && hard.accept_cross_campus !== false) {
    return false;
  }
  if (!Number.isInteger(hard.age_diff_older_max) || hard.age_diff_older_max < 0 || hard.age_diff_older_max > 12) {
    return false;
  }
  if (!Number.isInteger(hard.age_diff_younger_max) || hard.age_diff_younger_max < 0 || hard.age_diff_younger_max > 12) {
    return false;
  }
  return true;
}

export function matchSettingsComplete(settings) {
  if (!settings || typeof settings !== 'object') {
    return false;
  }
  const share = Boolean(settings.share_contact_with_match);
  const detail = typeof settings.match_contact_detail === 'string' ? settings.match_contact_detail.trim() : '';
  if (share) {
    const len = [...detail].length;
    if (len < 1 || len > 20) {
      return false;
    }
  }
  const includeMessage = Boolean(settings.include_message_to_partner);
  const rawMessage = typeof settings.message_to_partner === 'string' ? settings.message_to_partner.trim() : '';
  if (includeMessage) {
    const len = [...rawMessage].length;
    if (len < 1 || len > 200) {
      return false;
    }
  }
  return true;
}

export function deepSurveyComplete(deepSurvey, deepQuestionNumbers) {
  if (!deepSurvey || typeof deepSurvey !== 'object') {
    return false;
  }
  if (!Array.isArray(deepQuestionNumbers) || deepQuestionNumbers.length === 0) {
    return false;
  }

  for (const n of deepQuestionNumbers) {
    const key = `q${n}`;
    const value = deepSurvey[key];
    if (!Number.isInteger(value) || value < -2 || value > 2) {
      return false;
    }
  }

  return true;
}
