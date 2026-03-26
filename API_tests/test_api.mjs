import assert from 'node:assert/strict';
import test from 'node:test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/api';
const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeDomainRule(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim().toLowerCase().replace(/^@+/, '');
  if (!value || /\.\./.test(value)) {
    return '';
  }

  if (value.startsWith('*.')) {
    const suffix = value.slice(2);
    if (!suffix || !DOMAIN_REGEX.test(suffix)) {
      return '';
    }
    return `*.${suffix}`;
  }

  if (!DOMAIN_REGEX.test(value)) {
    return '';
  }

  return value;
}

function resolveTestEmailDomain(rawRules) {
  if (!Array.isArray(rawRules)) {
    return 'szu.edu.cn';
  }

  const rules = rawRules
    .map((item) => normalizeDomainRule(item))
    .filter(Boolean);

  const exact = rules.find((rule) => !rule.startsWith('*.'));
  if (exact) {
    return exact;
  }

  const wildcard = rules.find((rule) => rule.startsWith('*.'));
  if (wildcard) {
    return `test.${wildcard.slice(2)}`;
  }

  return 'szu.edu.cn';
}

function buildAnswers(defaultValue = 4) {
  const answers = {};
  for (let i = 1; i <= 50; i += 1) {
    answers[`q${i}`] = defaultValue;
  }
  return answers;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });

  const bodyText = await response.text();
  let payload = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    payload
  };
}

function readVerificationCodeFromSendCodeResponse(sendCodeResponse, email) {
  const code = sendCodeResponse?.payload?.data?.debug_verification_code;
  assert.equal(typeof code, 'string', `debug_verification_code missing for ${email}`);
  assert.match(code, /^\d{6}$/, `invalid verification code format for ${email}`);
  return code;
}

async function loginAndGetToken(email, password) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload?.code, 200);
  const token = response.payload?.data?.access_token;
  assert.ok(token);
  return token;
}

test('end-to-end API flow with ROSE survey and match trigger', async () => {
  const timestamp = Date.now();
  const password = 'Password123!';
  const resetPassword = 'NewPassword123!';

  const publicSiteSettings = await request('/public/site-settings', { method: 'GET' });
  assert.equal(publicSiteSettings.status, 200);
  assert.equal(publicSiteSettings.payload?.code, 200);
  assert.equal(typeof publicSiteSettings.payload?.data?.brand_name, 'string');
  assert.ok(Array.isArray(publicSiteSettings.payload?.data?.allowed_email_domains));
  assert.ok(publicSiteSettings.payload?.data?.allowed_email_domains.length > 0);
  assert.ok(Array.isArray(publicSiteSettings.payload?.data?.why_choose_us_items));
  assert.ok(publicSiteSettings.payload?.data?.why_choose_us_items.length > 0);
  assert.ok(Array.isArray(publicSiteSettings.payload?.data?.faq_items));
  assert.ok(publicSiteSettings.payload?.data?.faq_items.length > 0);
  const testEmailDomain = resolveTestEmailDomain(publicSiteSettings.payload?.data?.allowed_email_domains);
  const userAEmail = `rose_user_a_${timestamp}@${testEmailDomain}`;
  const userBEmail = `rose_user_b_${timestamp}@${testEmailDomain}`;

  const publicHomeMetrics = await request('/public/home-metrics', { method: 'GET' });
  assert.equal(publicHomeMetrics.status, 200);
  assert.equal(publicHomeMetrics.payload?.code, 200);
  const metricVisibility = publicHomeMetrics.payload?.data?.metric_visibility || {};
  assert.equal(typeof metricVisibility.registered_users, 'boolean');
  assert.equal(typeof metricVisibility.survey_completion_rate, 'boolean');
  assert.equal(typeof metricVisibility.matched_users, 'boolean');
  if (metricVisibility.registered_users) {
    assert.equal(typeof publicHomeMetrics.payload?.data?.registered_users, 'number');
  } else {
    assert.equal(publicHomeMetrics.payload?.data?.registered_users, null);
  }
  if (metricVisibility.survey_completion_rate) {
    assert.equal(typeof publicHomeMetrics.payload?.data?.survey_completion_rate, 'number');
  } else {
    assert.equal(publicHomeMetrics.payload?.data?.survey_completion_rate, null);
  }
  if (metricVisibility.matched_users) {
    assert.equal(typeof publicHomeMetrics.payload?.data?.matched_users, 'number');
  } else {
    assert.equal(publicHomeMetrics.payload?.data?.matched_users, null);
  }
  assert.equal(typeof publicHomeMetrics.payload?.data?.next_match_in_seconds, 'number');

  const publicHeroAsset = await request('/public/site-assets/home-hero-background', { method: 'GET' });
  assert.ok([200, 404].includes(publicHeroAsset.status));

  const unauthorizedSurvey = await request('/survey/get');
  assert.equal(unauthorizedSurvey.status, 401);

  const guestSurveyQuestions = await request('/survey/questions', {
    method: 'GET'
  });
  assert.equal(guestSurveyQuestions.status, 200);
  assert.ok(Array.isArray(guestSurveyQuestions.payload?.data?.sections));
  assert.ok(guestSurveyQuestions.payload?.data?.sections.length > 0);

  const guestSubmit = await request('/survey/submit', {
    method: 'POST',
    body: JSON.stringify({ answers: buildAnswers(4) })
  });
  assert.equal(guestSubmit.status, 200);
  assert.equal(guestSubmit.payload?.code, 200);
  assert.ok(guestSubmit.payload?.data?.rose_code);
  assert.ok(guestSubmit.payload?.data?.rose_name);
  assert.equal(guestSubmit.payload?.data?.guest_mode, true);
  assert.equal(guestSubmit.payload?.data?.match_enabled, false);

  const invalidDomainSendCode = await request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: `outside_${timestamp}@gmail.com` })
  });
  assert.equal(invalidDomainSendCode.status, 400);

  const sendCodeA = await request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail })
  });
  assert.equal(sendCodeA.status, 200);
  assert.equal(sendCodeA.payload?.code, 200);

  const sendCodeB = await request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: userBEmail })
  });
  assert.equal(sendCodeB.status, 200);
  assert.equal(sendCodeB.payload?.code, 200);

  const codeA = readVerificationCodeFromSendCodeResponse(sendCodeA, userAEmail);
  const codeB = readVerificationCodeFromSendCodeResponse(sendCodeB, userBEmail);

  const registerA = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password,
      code: codeA
    })
  });
  assert.equal(registerA.status, 200);
  assert.equal(registerA.payload?.code, 200);

  const registerB = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userBEmail,
      password,
      code: codeB
    })
  });
  assert.equal(registerB.status, 200);
  assert.equal(registerB.payload?.code, 200);

  const forgotCodeInvalidDomain = await request('/auth/forgot-password/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: `outside_reset_${timestamp}@gmail.com` })
  });
  assert.equal(forgotCodeInvalidDomain.status, 400);

  const forgotCodeNonExist = await request('/auth/forgot-password/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: `not_exists_${timestamp}@${testEmailDomain}` })
  });
  assert.equal(forgotCodeNonExist.status, 200);
  assert.equal(forgotCodeNonExist.payload?.code, 200);

  const forgotCodeA = await request('/auth/forgot-password/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail })
  });
  assert.equal(forgotCodeA.status, 200);
  assert.equal(forgotCodeA.payload?.code, 200);
  const resetCodeA = readVerificationCodeFromSendCodeResponse(forgotCodeA, userAEmail);

  const resetWithWrongCode = await request('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password: resetPassword,
      code: '000000'
    })
  });
  assert.equal(resetWithWrongCode.status, 400);

  const resetA = await request('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password: resetPassword,
      code: resetCodeA
    })
  });
  assert.equal(resetA.status, 200);
  assert.equal(resetA.payload?.code, 200);

  const loginOldPassword = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password
    })
  });
  assert.equal(loginOldPassword.status, 400);

  const tokenA = await loginAndGetToken(userAEmail, resetPassword);
  const tokenB = await loginAndGetToken(userBEmail, password);

  const saveProfileA = await request('/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ gender: 'male', target_gender: 'female' })
  });
  assert.equal(saveProfileA.status, 200);

  const saveProfileB = await request('/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ gender: 'female', target_gender: 'male' })
  });
  assert.equal(saveProfileB.status, 200);

  const invalidAnswers = buildAnswers();
  delete invalidAnswers.q50;
  const submitInvalid = await request('/survey/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ answers: invalidAnswers })
  });
  assert.equal(submitInvalid.status, 400);

  const answersA = buildAnswers(4);
  const answersB = buildAnswers(4);
  answersA.q4 = 7;
  answersA.q22 = 7;
  answersB.q4 = 1;
  answersB.q22 = 1;

  const submitA = await request('/survey/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ answers: answersA })
  });
  assert.equal(submitA.status, 200);
  assert.equal(submitA.payload?.code, 200);
  assert.ok(submitA.payload?.data?.rose_code);
  assert.ok(submitA.payload?.data?.rose_name);
  assert.equal(typeof submitA.payload?.data?.type_interpretation, 'object');
  assert.equal(submitA.payload?.data?.type_interpretation?.supported, true);
  assert.ok(submitA.payload?.data?.type_interpretation?.summary);

  const submitB = await request('/survey/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ answers: answersB })
  });
  assert.equal(submitB.status, 200);
  assert.equal(submitB.payload?.code, 200);
  assert.equal(typeof submitB.payload?.data?.type_interpretation, 'object');

  const getSurveyA = await request('/survey/get', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(getSurveyA.status, 200);
  assert.equal(getSurveyA.payload?.data?.completed, true);
  assert.ok(getSurveyA.payload?.data?.type_interpretation);
  assert.equal(getSurveyA.payload?.data?.type_interpretation?.supported, true);

  const adminForbidden = await request('/admin/rose-types', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(adminForbidden.status, 403);

  const questionAdminForbidden = await request('/admin/survey-questions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(questionAdminForbidden.status, 403);

  const siteSettingsAdminForbidden = await request('/admin/site-settings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(siteSettingsAdminForbidden.status, 403);

  const beforeMatch = await request('/match/my-match', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(beforeMatch.status, 200);
  assert.equal(beforeMatch.payload?.data?.matched, false);
  assert.ok(beforeMatch.payload?.data?.self_rose);
  assert.ok(beforeMatch.payload?.data?.type_interpretation);

  const triggerUnauthorized = await request('/match/trigger', {
    method: 'POST'
  });
  assert.equal(triggerUnauthorized.status, 401);

  const trigger = await request('/match/trigger', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(trigger.status, 200);
  assert.equal(trigger.payload?.code, 200);

  const myMatchA = await request('/match/my-match', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(myMatchA.status, 200);
  assert.equal(myMatchA.payload?.code, 200);
  assert.equal(myMatchA.payload?.data?.matched, true);
  assert.ok(myMatchA.payload?.data?.partner_email);
  assert.equal(typeof myMatchA.payload?.data?.match_percent, 'number');
  assert.ok(myMatchA.payload?.data?.self_rose);
  assert.ok(myMatchA.payload?.data?.partner_rose);
  assert.equal(Object.prototype.hasOwnProperty.call(myMatchA.payload?.data || {}, 'killer_point'), false);
  assert.ok(myMatchA.payload?.data?.type_interpretation);
});
