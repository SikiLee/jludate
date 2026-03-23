import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { listActiveIdentityProfilesForMatching } from 'lib/identityLink';
import {
  buildRarityMap,
  computeMatchScore,
  computeRoseProfile,
  pickKillerPoint
} from 'lib/rose';
import { sendMatchEmail } from 'lib/email';

function getShanghaiWallDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
}

function getShanghaiIsoWeekKey(date = new Date()) {
  const shDate = getShanghaiWallDate(date);
  shDate.setHours(0, 0, 0, 0);

  const target = new Date(shDate.getTime());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);

  const weekNo = 1 + Math.round((target - firstThursday) / 604800000);
  return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizePair(userLeft, userRight) {
  return userLeft.id < userRight.id ? [userLeft, userRight] : [userRight, userLeft];
}

function buildRunKey(runType, customRunKey) {
  if (customRunKey) {
    return customRunKey;
  }

  if (runType === 'scheduled') {
    return `scheduled-${getShanghaiIsoWeekKey()}`;
  }

  return `manual-${Date.now()}`;
}

function toCandidate(identityProfile, answers) {
  const roseResult = computeRoseProfile(answers);
  if (!roseResult.ok) {
    return null;
  }

  return {
    id: identityProfile.user_id,
    respondent_id: identityProfile.respondent_id,
    email: identityProfile.email,
    gender: identityProfile.gender,
    target_gender: identityProfile.target_gender,
    orientation: identityProfile.orientation,
    answers: roseResult.profile.answers,
    rose: {
      dimension_scores: roseResult.profile.dimension_scores,
      dimension_letters: roseResult.profile.dimension_letters,
      rose_code: roseResult.profile.rose_code,
      rose_name: roseResult.profile.rose_name
    }
  };
}

function buildPairEdges(candidates) {
  const edges = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];
      const score = computeMatchScore(left, right);
      if (!score.is_match) {
        continue;
      }

      edges.push({
        left,
        right,
        score
      });
    }
  }

  edges.sort((a, b) => {
    if (b.score.final_match_percent !== a.score.final_match_percent) {
      return b.score.final_match_percent - a.score.final_match_percent;
    }

    if (b.score.base_match_percent !== a.score.base_match_percent) {
      return b.score.base_match_percent - a.score.base_match_percent;
    }

    if (a.left.id !== b.left.id) {
      return a.left.id - b.left.id;
    }

    return a.right.id - b.right.id;
  });

  return edges;
}

function pickPairs(edges) {
  const selected = [];
  const usedIds = new Set();

  for (const edge of edges) {
    if (usedIds.has(edge.left.id) || usedIds.has(edge.right.id)) {
      continue;
    }

    usedIds.add(edge.left.id);
    usedIds.add(edge.right.id);
    selected.push(edge);
  }

  return selected;
}

async function loadCandidates() {
  const identityProfiles = await listActiveIdentityProfilesForMatching(identityPool, {
    actor: 'system:matching',
    purpose: 'load_matching_candidates'
  });
  if (identityProfiles.length === 0) {
    return [];
  }

  const respondentIds = identityProfiles.map((item) => item.respondent_id);
  const surveyRowsResult = await surveyPool.query(
    `
    SELECT respondent_id, answers
    FROM unidate_app.survey_responses
    WHERE respondent_id = ANY($1::text[])
    `,
    [respondentIds]
  );

  const answersByRespondent = new Map();
  for (const row of surveyRowsResult.rows) {
    answersByRespondent.set(row.respondent_id, row.answers);
  }

  const candidates = [];
  for (const profile of identityProfiles) {
    const answers = answersByRespondent.get(profile.respondent_id);
    if (!answers) {
      continue;
    }

    const candidate = toCandidate(profile, answers);
    if (!candidate) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates;
}

export async function runMatchingEngine({ runType = 'manual', runKey: customRunKey, initiatedBy = 'system' } = {}) {
  await ensureSchema();

  const runKey = buildRunKey(runType, customRunKey);
  const runStartedAt = new Date();

  const existingRun = await surveyPool.query(
    'SELECT id, status FROM unidate_app.match_runs WHERE run_key = $1 LIMIT 1',
    [runKey]
  );

  if (existingRun.rowCount > 0) {
    return {
      skipped: true,
      reason: 'run_exists',
      run_key: runKey,
      run_id: existingRun.rows[0].id,
      matches_created: 0
    };
  }

  const client = await surveyPool.connect();
  const pendingEmails = [];

  try {
    await client.query('BEGIN');

    const runInsert = await client.query(
      `
      INSERT INTO unidate_app.match_runs(run_type, run_key, status, initiated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [runType, runKey, 'running', initiatedBy]
    );

    const runId = runInsert.rows[0].id;
    const candidates = await loadCandidates();

    for (const candidate of candidates) {
      await client.query(
        `
        UPDATE unidate_app.survey_responses
        SET rose_code = $1,
            rose_name = $2,
            dimension_scores = $3::jsonb,
            updated_at = NOW()
        WHERE respondent_id = $4
        `,
        [
          candidate.rose.rose_code,
          candidate.rose.rose_name,
          JSON.stringify(candidate.rose.dimension_scores),
          candidate.respondent_id
        ]
      );
    }

    const rarityMap = buildRarityMap(candidates);
    const edges = buildPairEdges(candidates);
    const selectedPairs = pickPairs(edges);

    for (const pair of selectedPairs) {
      const [user1, user2] = normalizePair(pair.left, pair.right);
      const killerPoint = pickKillerPoint(pair.left.answers, pair.right.answers, rarityMap);

      const insertResult = await client.query(
        `
        INSERT INTO unidate_app.match_results(
          run_id,
          respondent1_id,
          respondent2_id,
          base_match_percent,
          complementary_bonus,
          final_match_percent,
          user1_rose_code,
          user2_rose_code,
          killer_point
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at
        `,
        [
          runId,
          user1.respondent_id,
          user2.respondent_id,
          pair.score.base_match_percent,
          pair.score.complementary_bonus,
          pair.score.final_match_percent,
          user1.rose.rose_code,
          user2.rose.rose_code,
          killerPoint
        ]
      );

      const createdAt = insertResult.rows[0].created_at;
      pendingEmails.push({
        left: pair.left,
        right: pair.right,
        killerPoint,
        finalMatchPercent: pair.score.final_match_percent,
        runAt: createdAt
      });
    }

    await client.query(
      `
      UPDATE unidate_app.match_runs
      SET status = $1,
          candidate_count = $2,
          pair_count = $3,
          completed_at = NOW()
      WHERE id = $4
      `,
      ['completed', candidates.length, selectedPairs.length, runId]
    );

    await client.query('COMMIT');

    for (const emailTask of pendingEmails) {
      await sendMatchEmail({
        toEmail: emailTask.left.email,
        partnerEmail: emailTask.right.email,
        matchPercent: emailTask.finalMatchPercent,
        selfRose: emailTask.left.rose.rose_code,
        partnerRose: emailTask.right.rose.rose_code,
        killerPoint: emailTask.killerPoint,
        runAt: emailTask.runAt
      });

      await sendMatchEmail({
        toEmail: emailTask.right.email,
        partnerEmail: emailTask.left.email,
        matchPercent: emailTask.finalMatchPercent,
        selfRose: emailTask.right.rose.rose_code,
        partnerRose: emailTask.left.rose.rose_code,
        killerPoint: emailTask.killerPoint,
        runAt: emailTask.runAt
      });
    }

    return {
      skipped: false,
      reason: 'ok',
      run_key: runKey,
      run_started_at: runStartedAt.toISOString(),
      matches_created: selectedPairs.length,
      candidates: candidates.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function isTuesday21InShanghai(date = new Date()) {
  const shanghaiDate = getShanghaiWallDate(date);
  return shanghaiDate.getDay() === 2 && shanghaiDate.getHours() === 21;
}

export function getCurrentScheduledRunKey(date = new Date()) {
  return `scheduled-${getShanghaiIsoWeekKey(date)}`;
}
