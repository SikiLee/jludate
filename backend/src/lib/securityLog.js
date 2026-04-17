function redactString(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  // Emails
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
  // 6-digit codes (verification)
  out = out.replace(/\b\d{6}\b/g, '[redacted-code]');
  // Bearer tokens
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted-token]');
  // JWT-like tokens
  out = out.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-jwt]');
  // Password-ish fields in JSON/log lines
  out = out.replace(/("?(?:password|pass|passwd|smtp_pass|secret|secret_key|privacy_keyring_json|authorization|cookie)"?\s*[:=]\s*)(".*?"|'.*?'|[^\s,}]+)/gi, '$1[redacted]');
  return out;
}

function safeErrorObject(error) {
  if (!error || typeof error !== 'object') {
    return { message: redactString(String(error)) };
  }
  const message = redactString(typeof error.message === 'string' ? error.message : String(error));
  const name = typeof error.name === 'string' ? error.name : 'Error';
  const stack = redactString(typeof error.stack === 'string' ? error.stack : '');
  return { name, message, stack };
}

export function logError(context, error, meta = undefined) {
  const safeMeta = meta ? JSON.parse(JSON.stringify(meta)) : undefined;
  // In case meta contains sensitive fields.
  if (safeMeta && typeof safeMeta === 'object') {
    for (const k of Object.keys(safeMeta)) {
      if (/(email|code|token|pass|password|secret|cookie|authorization)/i.test(k)) {
        safeMeta[k] = '[redacted]';
      }
    }
  }
  const safeErr = safeErrorObject(error);
  console.error(`[${context}]`, safeErr, safeMeta || '');
}

