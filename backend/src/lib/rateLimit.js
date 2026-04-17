function nowMs() {
  return Date.now();
}

function clampInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function extractIp(request) {
  // Prefer reverse proxy headers, fall back to unknown.
  const xfwd = request?.headers?.get?.('x-forwarded-for') || '';
  const first = xfwd.split(',')[0]?.trim();
  if (first) return first;
  const realIp = request?.headers?.get?.('x-real-ip') || '';
  if (realIp) return realIp.trim();
  return 'unknown';
}

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

// Simple in-memory sliding window rate limiter.
// NOTE: In multi-instance/serverless deployments this is per-instance.
const BUCKETS = new Map(); // key -> number[] timestamps (ms)

function prune(timestamps, windowMs, now) {
  const cutoff = now - windowMs;
  let idx = 0;
  while (idx < timestamps.length && timestamps[idx] < cutoff) idx += 1;
  if (idx > 0) timestamps.splice(0, idx);
}

function hit(key, { limit, windowMs }, now) {
  const timestamps = BUCKETS.get(key) || [];
  prune(timestamps, windowMs, now);
  if (timestamps.length >= limit) {
    BUCKETS.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((timestamps[0] + windowMs - now) / 1000) };
  }
  timestamps.push(now);
  BUCKETS.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterSec: 0 };
}

export function rateLimit(request, action, { email, limit, windowMs } = {}) {
  const enabled = (process.env.RATE_LIMIT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  if (!enabled) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const now = nowMs();
  const l = clampInt(limit, 10);
  const w = clampInt(windowMs, 60_000);
  const ip = extractIp(request);
  const normalizedEmail = normalizeEmail(email);

  // Apply both IP-based and email-based buckets when email exists.
  const checks = [];
  checks.push(hit(`ip:${action}:${ip}`, { limit: l, windowMs: w }, now));
  if (normalizedEmail) {
    checks.push(hit(`email:${action}:${normalizedEmail}`, { limit: Math.min(3, l), windowMs: w }, now));
  }

  const denied = checks.find((c) => !c.allowed);
  if (denied) {
    return {
      allowed: false,
      retryAfterSec: denied.retryAfterSec || 60
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

