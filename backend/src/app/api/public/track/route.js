import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getCurrentUserIfPresentFromRequest } from 'lib/auth';
import { readJson } from 'lib/request';
import { httpError, success } from 'lib/response';
import { recordAnalyticsEvent } from 'lib/matchAnalytics';
import { getRespondentIdByUserId } from 'lib/identityLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSampleRate() {
  const raw = Number(process.env.ANALYTICS_SAMPLE_RATE || '1');
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0, Math.min(1, raw));
}

function shouldSample(visitorKey, eventKey, sampleRate) {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  // deterministic sampling per visitor/event
  const seed = `${visitorKey || 'anonymous'}:${eventKey || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 10000) / 10000;
  return normalized < sampleRate;
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();
    const body = await readJson(request);

    const userResult = await getCurrentUserIfPresentFromRequest(request);
    const userId = userResult?.user?.id || null;
    let respondentId = null;
    if (userId) {
      respondentId = await getRespondentIdByUserId(identityPool, userId, {
        actor: `user:${userId}`,
        purpose: 'public_track'
      });
    }

    const sampleRate = parseSampleRate();
    if (!shouldSample(body?.visitor_key, body?.event_key, sampleRate)) {
      return success('tracked', { ok: true, sampled: false });
    }

    await recordAnalyticsEvent({
      eventKey: body?.event_key,
      visitorKey: body?.visitor_key,
      userId,
      respondentId,
      payload: body?.payload || {}
    });

    return success('tracked', { ok: true, sampled: true });
  } catch (error) {
    console.error('POST /api/public/track failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

