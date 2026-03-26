export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmailDomain(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim().toLowerCase().replace(/^@+/, '');
  if (!value) {
    return '';
  }

  if (/\.\./.test(value)) {
    return '';
  }

  if (!DOMAIN_REGEX.test(value)) {
    return '';
  }

  return value;
}

function normalizeAllowedDomainRule(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim().toLowerCase().replace(/^@+/, '');
  if (!value) {
    return '';
  }

  if (value.startsWith('*.')) {
    const suffix = value.slice(2);
    if (!suffix || /\.\./.test(suffix) || !DOMAIN_REGEX.test(suffix)) {
      return '';
    }
    return `*.${suffix}`;
  }

  return normalizeEmailDomain(value);
}

export function normalizeAllowedEmailDomains(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const item of rawValue) {
    const normalized = normalizeAllowedDomainRule(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function isAllowedSchoolEmail(email, allowedDomains) {
  if (typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const match = normalizedEmail.match(/^[^\s@]+@([^\s@]+)$/);
  if (!match) {
    return false;
  }

  const emailDomain = normalizeEmailDomain(match[1]);
  if (!emailDomain) {
    return false;
  }

  const normalizedDomains = normalizeAllowedEmailDomains(allowedDomains);
  if (normalizedDomains.length === 0) {
    return false;
  }

  for (const rule of normalizedDomains) {
    if (rule === emailDomain) {
      return true;
    }

    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1); // ".edu.cn"
      if (emailDomain.endsWith(suffix) && emailDomain.length > suffix.length) {
        return true;
      }
    }
  }

  return false;
}
