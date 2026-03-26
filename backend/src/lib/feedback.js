const FEEDBACK_SOURCE_SET = new Set(['banner', 'survey_result', 'other']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROSE_CODE_REGEX = /^[A-Z0-9_-]{1,16}$/;
const MAX_FEEDBACK_CONTENT_LENGTH = 2000;

function toSafeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeFeedbackSource(rawValue) {
  const source = toSafeString(rawValue).toLowerCase();
  if (FEEDBACK_SOURCE_SET.has(source)) {
    return source;
  }
  return 'other';
}

function normalizeOptionalEmail(rawValue) {
  const email = toSafeString(rawValue).toLowerCase();
  if (!email) {
    return '';
  }
  if (!EMAIL_REGEX.test(email)) {
    return null;
  }
  return email;
}

function normalizeOptionalRoseCode(rawValue) {
  const roseCode = toSafeString(rawValue).toUpperCase();
  if (!roseCode) {
    return '';
  }
  if (!ROSE_CODE_REGEX.test(roseCode)) {
    return null;
  }
  return roseCode;
}

export function validateFeedbackPayload(payload) {
  const content = toSafeString(payload?.content);
  if (!content) {
    return { ok: false, msg: '反馈内容不能为空' };
  }

  if (content.length > MAX_FEEDBACK_CONTENT_LENGTH) {
    return { ok: false, msg: `反馈内容不能超过 ${MAX_FEEDBACK_CONTENT_LENGTH} 字` };
  }

  const contactEmail = normalizeOptionalEmail(payload?.contact_email);
  if (contactEmail === null) {
    return { ok: false, msg: '联系邮箱格式不正确' };
  }

  const roseCode = normalizeOptionalRoseCode(payload?.rose_code);
  if (roseCode === null) {
    return { ok: false, msg: 'rose_code 格式不正确' };
  }

  return {
    ok: true,
    data: {
      content,
      contact_email: contactEmail || null,
      rose_code: roseCode || null,
      source: normalizeFeedbackSource(payload?.source)
    }
  };
}

export function parseFeedbackListParams(searchParams) {
  const limitRaw = Number.parseInt(searchParams?.get('limit') || '', 10);
  const offsetRaw = Number.parseInt(searchParams?.get('offset') || '', 10);

  const limit = Number.isInteger(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 200)
    : 50;
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  return { limit, offset };
}
