export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

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

  const domainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!domainRegex.test(value)) {
    return '';
  }

  return value;
}

export function normalizeAllowedEmailDomains(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const item of rawValue) {
    const normalized = normalizeEmailDomain(item);
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

  return normalizedDomains.includes(emailDomain);
}
