import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { listActiveIdentityProfilesForMatching } from 'lib/identityLink';
import { sendMatchEmail } from 'lib/email';
import { XINGHUA_TI_TYPE_CODE_SET } from 'lib/xinghuaTiTypes';

const MATCH_CATEGORIES = Object.freeze(['love', 'friend', 'xinghua']);

function normalizeCategories(input) {
  if (!Array.isArray(input) || input.length === 0) return [...MATCH_CATEGORIES];
  const allowed = new Set(MATCH_CATEGORIES);
  const out = [];
  for (const raw of input) {
    const c = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!allowed.has(c)) continue;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

function q(n) {
  return `q${n}`;
}

function qType(n) {
  return `q${n}_match_type`;
}

function makePairKey(respondentIdA, respondentIdB) {
  const a = String(respondentIdA || '').trim();
  const b = String(respondentIdB || '').trim();
  if (!a || !b) return '';
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function simScoreFromAnswers(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 0;
  const d = Math.abs(a - b) / 4; // answers in [-2..2]
  const dd = clamp01(d);
  return 1 - (dd ** 1.3);
}

function compScoreFromAnswers(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 0;
  const d = Math.abs(a - b) / 4;
  const dd = clamp01(d);
  const m = 0.4;
  const sigma = 0.2;
  const z = (dd - m) / sigma;
  return Math.exp(-0.5 * (z ** 2));
}

function resolveModule3QuestionPairScore(userA, userB, questionNumber) {
  const a = userA.deep[q(questionNumber)];
  const b = userB.deep[q(questionNumber)];
  const typeA = typeof userA.deep[qType(questionNumber)] === 'string'
    ? userA.deep[qType(questionNumber)].trim().toLowerCase()
    : 'complement';
  const typeB = typeof userB.deep[qType(questionNumber)] === 'string'
    ? userB.deep[qType(questionNumber)].trim().toLowerCase()
    : 'complement';

  const aSimilar = typeA === 'similar';
  const bSimilar = typeB === 'similar';
  const aComp = typeA === 'complement';
  const bComp = typeB === 'complement';

  if (aSimilar && bSimilar) return simScoreFromAnswers(a, b);
  if (aComp && bComp) return compScoreFromAnswers(a, b);

  return 0.5 * simScoreFromAnswers(a, b) + 0.5 * compScoreFromAnswers(a, b);
}

function round1(x) {
  return Math.round((Number(x) || 0) * 10) / 10;
}

function isValidGender(value) {
  return value === 'male' || value === 'female';
}

function isValidXinghuaType(value) {
  return typeof value === 'string' && value.length === 4 && XINGHUA_TI_TYPE_CODE_SET.has(value);
}

function xinghuaTypeDistance(typeA, typeB) {
  if (!isValidXinghuaType(typeA) || !isValidXinghuaType(typeB)) return null;
  let diff = 0;
  for (let i = 0; i < 4; i += 1) {
    if (typeA[i] !== typeB[i]) diff += 1;
  }
  return diff;
}

function gradeToIndex(grade) {
  // must match lib/grade.js ordering (0..12)
  const order = [
    '大一', '大二', '大三', '大四',
    '研一', '研二', '研三',
    '博一', '博二', '博三', '博四', '博五'
  ];
  const idx = order.indexOf(typeof grade === 'string' ? grade.trim() : '');
  return idx >= 0 ? idx : null;
}

function passesHardFilters(userA, userB, category) {
  if (category === 'xinghua') {
    if (!isValidGender(userA.gender) || !isValidGender(userB.gender)) return false;
    if (userA.hard?.target_gender !== userB.gender) return false;
    if (userB.hard?.target_gender !== userA.gender) return false;

    const validTimes = new Set(['sun_am', 'sun_pm', 'any']);
    const aTime = typeof userA.hard?.preferred_time === 'string' ? userA.hard.preferred_time.trim() : '';
    const bTime = typeof userB.hard?.preferred_time === 'string' ? userB.hard.preferred_time.trim() : '';
    if (!validTimes.has(aTime) || !validTimes.has(bTime)) return false;
    if (aTime !== 'any' && bTime !== 'any' && aTime !== bTime) return false;

    const aType = isValidXinghuaType(userA.xinghua_ti_type) ? userA.xinghua_ti_type : '';
    const bType = isValidXinghuaType(userB.xinghua_ti_type) ? userB.xinghua_ti_type : '';
    if (!aType || !bType) return false;

    const resolveRequired = (target, selfType) => {
      if (target === 'any') return null;
      if (target === 'same_as_me') return selfType || null;
      if (isValidXinghuaType(target)) return target;
      return selfType || null;
    };
    const aTarget = typeof userA.hard?.target_xinghua_ti === 'string' ? userA.hard.target_xinghua_ti.trim() : 'same_as_me';
    const bTarget = typeof userB.hard?.target_xinghua_ti === 'string' ? userB.hard.target_xinghua_ti.trim() : 'same_as_me';
    const aRequired = resolveRequired(aTarget, aType);
    const bRequired = resolveRequired(bTarget, bType);
    if (aRequired && bType !== aRequired) return false;
    if (bRequired && aType !== bRequired) return false;
    return true;
  }

  // gender preference (both ways)
  if (!isValidGender(userA.gender) || !isValidGender(userB.gender)) return false;
  if (userA.hard?.target_gender !== userB.gender) return false;
  if (userB.hard?.target_gender !== userA.gender) return false;

  // cross campus (both ways)
  const aAcceptCross = userA.hard?.accept_cross_campus;
  const bAcceptCross = userB.hard?.accept_cross_campus;
  if (aAcceptCross === false || bAcceptCross === false) {
    const campusA = (userA.campus || '').trim();
    const campusB = (userB.campus || '').trim();
    if (campusA && campusB && campusA !== campusB) return false;
  }

  // grade diff (both ways)
  const aIdx = gradeToIndex(userA.grade);
  const bIdx = gradeToIndex(userB.grade);
  if (aIdx === null || bIdx === null) return false;
  const diff = bIdx - aIdx; // positive => B is "higher grade"/older cohort

  const aOlderMax = userA.hard?.age_diff_older_max;
  const aYoungerMax = userA.hard?.age_diff_younger_max;
  const bOlderMax = userB.hard?.age_diff_older_max;
  const bYoungerMax = userB.hard?.age_diff_younger_max;
  if (!Number.isInteger(aOlderMax) || !Number.isInteger(aYoungerMax)) return false;
  if (!Number.isInteger(bOlderMax) || !Number.isInteger(bYoungerMax)) return false;

  // for A: partner older => diff>0 must be <= older_max; partner younger => -diff <= younger_max
  if (diff > 0 && diff > aOlderMax) return false;
  if (diff < 0 && (-diff) > aYoungerMax) return false;

  // for B: from B view, partner older is -diff
  if (-diff > 0 && (-diff) > bOlderMax) return false;
  if (-diff < 0 && diff > bYoungerMax) return false;

  return true;
}

async function getQuestionNumbersByModule(category) {
  const res = await surveyPool.query(
    `
    SELECT module_index, question_number
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1
      AND page_key = 'deep'
      AND question_kind = 'scale5_lr'
    ORDER BY module_index ASC, display_order ASC, question_number ASC
    `,
    [category]
  );
  const modules = new Map([[1, []], [2, []], [3, []]]);
  for (const row of res.rows) {
    const mi = Number(row.module_index);
    const qn = Number(row.question_number);
    if ((mi === 1 || mi === 2 || mi === 3) && Number.isInteger(qn)) {
      modules.get(mi).push(qn);
    }
  }
  return modules;
}

async function listEligibleParticipants(category) {
  const profiles = await listActiveIdentityProfilesForMatching(identityPool, {
    actor: 'system:weekly_match',
    purpose: `load_profiles_${category}`
  });

  const respondentIds = profiles
    .filter((p) => p.auto_weekly_match !== false)
    .map((p) => p.respondent_id);
  if (respondentIds.length === 0) return [];

  const drafts = await surveyPool.query(
    `
    SELECT respondent_id, payload
    FROM unidate_app.match_questionnaire_drafts
    WHERE respondent_id = ANY($1::text[])
      AND category = $2
      AND completed = TRUE
    `,
    [respondentIds, category]
  );
  const payloadByRespondent = new Map(drafts.rows.map((r) => [r.respondent_id, r.payload || {}]));

  const participants = [];
  for (const p of profiles) {
    if (p.auto_weekly_match === false) continue;
    const payload = payloadByRespondent.get(p.respondent_id);
    if (!payload) continue;
    const matchSettings = payload.match_settings && typeof payload.match_settings === 'object'
      ? payload.match_settings
      : {};
    if (matchSettings.auto_participate_weekly_match === false) continue;

    const hard = payload.hard_filter && typeof payload.hard_filter === 'object'
      ? payload.hard_filter
      : {};
    const deep = payload.deep_survey && typeof payload.deep_survey === 'object'
      ? payload.deep_survey
      : {};

    participants.push({
      ...p,
      category,
      hard,
      deep
    });
  }

  return participants;
}

async function getConsecutiveUnmatchedCount(category, respondentIds) {
  if (!respondentIds.length) return new Map();
  const res = await surveyPool.query(
    `
    SELECT match_category, respondent_id, status, created_at
    FROM unidate_app.match_cycle_results
    WHERE match_category = $1
      AND respondent_id = ANY($2::text[])
    ORDER BY respondent_id ASC, created_at DESC
    `,
    [category, respondentIds]
  );

  const byId = new Map();
  for (const id of respondentIds) byId.set(id, []);
  for (const row of res.rows) {
    const id = row.respondent_id;
    if (!byId.has(id)) continue;
    byId.get(id).push(String(row.status || '').toLowerCase());
  }

  const result = new Map();
  for (const [id, statuses] of byId.entries()) {
    let k = 0;
    for (const st of statuses) {
      if (st === 'unmatched') {
        k += 1;
        continue;
      }
      break;
    }
    result.set(id, k);
  }
  return result;
}

async function getHistoricalMatchedPairKeySet(category, respondentIds) {
  if (!respondentIds.length) return new Set();
  const res = await surveyPool.query(
    `
    SELECT respondent1_id, respondent2_id
    FROM unidate_app.match_results
    WHERE match_category = $1
      AND respondent1_id = ANY($2::text[])
      AND respondent2_id = ANY($2::text[])
      AND respondent1_id IS NOT NULL
      AND respondent2_id IS NOT NULL
    `,
    [category, respondentIds]
  );

  const pairKeys = new Set();
  for (const row of res.rows) {
    const key = makePairKey(row.respondent1_id, row.respondent2_id);
    if (key) pairKeys.add(key);
  }
  return pairKeys;
}

function compensationBonus(consecutiveFails) {
  const k = Number(consecutiveFails) || 0;
  if (k <= 0) return 0;
  return Math.min(6, 1.5 * k);
}

function computePairScore(userA, userB, moduleQuestions, bonusMap, category) {
  if (category === 'xinghua') {
    const dist = xinghuaTypeDistance(userA.xinghua_ti_type, userB.xinghua_ti_type);
    if (dist === null || dist > 2) {
      return { m1: 0, m2: 0, m3: 0, base: 0, compensation_bonus: 0, final: 0 };
    }
    const baseByDist = [96, 84, 72];
    const base = baseByDist[dist] || 0;
    const bA = compensationBonus(bonusMap.get(userA.respondent_id) || 0);
    const bB = compensationBonus(bonusMap.get(userB.respondent_id) || 0);
    return {
      m1: 0,
      m2: 0,
      m3: round1(((2 - dist) / 2) * 100),
      base: round1(base),
      compensation_bonus: round1(bA + bB),
      final: round1(Math.min(99.9, base + bA + bB))
    };
  }

  const modules = {
    1: moduleQuestions.get(1) || [],
    2: moduleQuestions.get(2) || [],
    3: moduleQuestions.get(3) || []
  };

  function avg(list, fn) {
    if (!list.length) return 0;
    let sum = 0;
    for (const n of list) sum += fn(n);
    return sum / list.length;
  }

  const m1 = avg(modules[1], (n) => simScoreFromAnswers(userA.deep[q(n)], userB.deep[q(n)]));
  const m2 = avg(modules[2], (n) => simScoreFromAnswers(userA.deep[q(n)], userB.deep[q(n)]));
  const m3 = avg(modules[3], (n) => resolveModule3QuestionPairScore(userA, userB, n));

  const m1p = m1 * 100;
  const m2p = m2 * 100;
  const m3p = m3 * 100;

  const base = (0.4 * m1p) + (0.4 * m2p) + (0.2 * m3p);
  const bA = compensationBonus(bonusMap.get(userA.respondent_id) || 0);
  const bB = compensationBonus(bonusMap.get(userB.respondent_id) || 0);
  const final = Math.min(99.9, base + bA + bB);

  return {
    m1: round1(m1p),
    m2: round1(m2p),
    m3: round1(m3p),
    base: round1(base),
    compensation_bonus: round1(bA + bB),
    final: round1(final)
  };
}

function thresholdPass(score, category) {
  if (category === 'xinghua') {
    return score.final >= 72;
  }
  return score.final >= 62 && score.m2 >= 55;
}

function buildBipartiteSets(participants) {
  const left = [];
  const right = [];
  for (const p of participants) {
    if (p.gender === 'male') left.push(p);
    if (p.gender === 'female') right.push(p);
  }
  return { left, right };
}

// Min-cost max-flow for bipartite matching (left -> right).
function minCostMaxFlow({ leftSize, rightSize, edges }) {
  const N = 2 + leftSize + rightSize;
  const S = 0;
  const T = N - 1;
  const graph = Array.from({ length: N }, () => []);

  function addEdge(u, v, cap, cost) {
    graph[u].push({ to: v, rev: graph[v].length, cap, cost });
    graph[v].push({ to: u, rev: graph[u].length - 1, cap: 0, cost: -cost });
  }

  for (let i = 0; i < leftSize; i += 1) addEdge(S, 1 + i, 1, 0);
  for (let j = 0; j < rightSize; j += 1) addEdge(1 + leftSize + j, T, 1, 0);
  for (const e of edges) {
    addEdge(1 + e.i, 1 + leftSize + e.j, 1, e.cost);
  }

  const INF = 1e18;
  let flow = 0;
  let cost = 0;
  const potential = new Array(N).fill(0);

  while (true) {
    const dist = new Array(N).fill(INF);
    const prevNode = new Array(N).fill(-1);
    const prevEdge = new Array(N).fill(-1);
    dist[S] = 0;

    const inQueue = new Array(N).fill(false);
    const q = [S];
    inQueue[S] = true;
    // SPFA with potentials (sufficient for small graphs)
    while (q.length) {
      const u = q.shift();
      inQueue[u] = false;
      for (let k = 0; k < graph[u].length; k += 1) {
        const ed = graph[u][k];
        if (ed.cap <= 0) continue;
        const v = ed.to;
        const nd = dist[u] + ed.cost + potential[u] - potential[v];
        if (nd < dist[v]) {
          dist[v] = nd;
          prevNode[v] = u;
          prevEdge[v] = k;
          if (!inQueue[v]) {
            inQueue[v] = true;
            q.push(v);
          }
        }
      }
    }

    if (dist[T] === INF) break;
    for (let v = 0; v < N; v += 1) {
      if (dist[v] < INF) potential[v] += dist[v];
    }

    // augment 1 unit
    let v = T;
    while (v !== S) {
      const u = prevNode[v];
      const k = prevEdge[v];
      graph[u][k].cap -= 1;
      const rev = graph[u][k].rev;
      graph[v][rev].cap += 1;
      v = u;
    }
    flow += 1;
    cost += potential[T];
  }

  // extract matches
  const matches = [];
  for (let i = 0; i < leftSize; i += 1) {
    const u = 1 + i;
    for (const ed of graph[u]) {
      const v = ed.to;
      if (v >= 1 + leftSize && v < 1 + leftSize + rightSize) {
        // if used (cap 0 on forward edge) => matched
        const wasUsed = ed.cap === 0;
        if (wasUsed) {
          const j = v - (1 + leftSize);
          matches.push({ i, j });
        }
      }
    }
  }

  return { flow, cost, matches };
}

async function createMatchCycle(startedBy = 'system') {
  const ins = await surveyPool.query(
    `
    INSERT INTO unidate_app.match_cycles(started_by)
    VALUES ($1)
    RETURNING id, started_at
    `,
    [startedBy]
  );
  return { id: ins.rows[0].id, started_at: ins.rows[0].started_at };
}

export async function getCurrentMatchCycle() {
  const res = await surveyPool.query(
    `
    SELECT id, started_at, started_by
    FROM unidate_app.match_cycles
    ORDER BY id DESC
    LIMIT 1
    `
  );
  if (res.rowCount === 0) {
    return null;
  }
  return res.rows[0];
}

async function runWeeklyMatchingForCategory({
  category,
  runKey,
  initiatedBy,
  cycleId,
  sendEmails = true
}) {
  const runInsert = await surveyPool.query(
    `
    INSERT INTO unidate_app.match_runs(cycle_id, run_type, run_key, status, initiated_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (run_key) DO NOTHING
    RETURNING id
    `,
    [cycleId || null, 'weekly_match', runKey, 'running', initiatedBy]
  );
  if (runInsert.rowCount === 0) {
    return { skipped: true, reason: 'run_exists', run_key: runKey, category };
  }
  const runId = runInsert.rows[0].id;

  try {
    const [participants, moduleQuestions] = await Promise.all([
      listEligibleParticipants(category),
      getQuestionNumbersByModule(category)
    ]);

    const respondentIds = participants.map((p) => p.respondent_id);
    const { left, right } = buildBipartiteSets(participants);
    const [consecutiveFailMap, historicalPairKeys] = await Promise.all([
      getConsecutiveUnmatchedCount(category, respondentIds),
      getHistoricalMatchedPairKeySet(category, respondentIds)
    ]);

    const hasAnyHardCandidate = new Map(participants.map((p) => [p.respondent_id, false]));
    const hasAnyThresholdCandidate = new Map(participants.map((p) => [p.respondent_id, false]));

    const edges = [];
    for (let i = 0; i < left.length; i += 1) {
      for (let j = 0; j < right.length; j += 1) {
        const a = left[i];
        const b = right[j];
        if (!passesHardFilters(a, b, category)) {
          continue;
        }
        if (historicalPairKeys.has(makePairKey(a.respondent_id, b.respondent_id))) {
          continue;
        }
        hasAnyHardCandidate.set(a.respondent_id, true);
        hasAnyHardCandidate.set(b.respondent_id, true);

        const score = computePairScore(a, b, moduleQuestions, consecutiveFailMap, category);
        if (!thresholdPass(score, category)) {
          continue;
        }
        hasAnyThresholdCandidate.set(a.respondent_id, true);
        hasAnyThresholdCandidate.set(b.respondent_id, true);

        // min-cost => negative weight
        edges.push({ i, j, cost: -score.final, score });
      }
    }

    const mcmf = minCostMaxFlow({ leftSize: left.length, rightSize: right.length, edges });

    const now = new Date();
    let insertedPairs = 0;

    const matchedRespondents = new Set();
    const matchResultIdByRespondent = new Map();
    const matchScoreByRespondent = new Map();

    for (const { i, j } of mcmf.matches) {
      const a = left[i];
      const b = right[j];
      const edge = edges.find((e) => e.i === i && e.j === j);
      const score = edge?.score || computePairScore(a, b, moduleQuestions, consecutiveFailMap, category);

      const ins = await surveyPool.query(
        `
        INSERT INTO unidate_app.match_results(
          run_id,
          respondent1_id,
          respondent2_id,
          match_category,
          base_match_percent,
          complementary_bonus,
          final_match_percent,
          user1_rose_code,
          user2_rose_code
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
        `,
        [
          runId,
          a.respondent_id,
          b.respondent_id,
          category,
          score.base,
          score.compensation_bonus,
          score.final,
          null,
          null
        ]
      );
      const matchResultId = ins.rows[0].id;
      insertedPairs += 1;

      matchedRespondents.add(a.respondent_id);
      matchedRespondents.add(b.respondent_id);
      matchResultIdByRespondent.set(a.respondent_id, matchResultId);
      matchResultIdByRespondent.set(b.respondent_id, matchResultId);
      matchScoreByRespondent.set(a.respondent_id, score.final);
      matchScoreByRespondent.set(b.respondent_id, score.final);
    }

    // Per-user cycle results: everyone gets a row
    for (const p of participants) {
      const rid = p.respondent_id;
      const matched = matchedRespondents.has(rid);
      let reason = null;
      if (!matched) {
        if (!hasAnyHardCandidate.get(rid)) reason = 'no_candidate';
        else if (!hasAnyThresholdCandidate.get(rid)) reason = 'below_threshold';
        else reason = 'not_selected';
      }
      await surveyPool.query(
        `
        INSERT INTO unidate_app.match_cycle_results(
          run_id,
          match_category,
          respondent_id,
          status,
          match_result_id,
          reason_code,
          score_snapshot
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (run_id, match_category, respondent_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          match_result_id = EXCLUDED.match_result_id,
          reason_code = EXCLUDED.reason_code,
          score_snapshot = EXCLUDED.score_snapshot
        `,
        [
          runId,
          category,
          rid,
          matched ? 'matched' : 'unmatched',
          matched ? matchResultIdByRespondent.get(rid) : null,
          matched ? null : reason,
          matched ? matchScoreByRespondent.get(rid) : null
        ]
      );
    }

    // Emails (best-effort)
    let delivered = 0;
    let failed = 0;
    if (sendEmails) {
      const byRespondent = new Map(participants.map((p) => [p.respondent_id, p]));
      for (const p of participants) {
        const rid = p.respondent_id;
        const matched = matchedRespondents.has(rid);
        // eslint-disable-next-line no-await-in-loop
        const ok = await (async () => {
          let partnerNickname = '';
          let matchPercent = 0;
          if (matched) {
            const matchResultId = matchResultIdByRespondent.get(rid);
            const matchRow = await surveyPool.query(
              `
              SELECT respondent1_id, respondent2_id, final_match_percent
              FROM unidate_app.match_results
              WHERE id = $1
              LIMIT 1
              `,
              [matchResultId]
            );
            const row = matchRow.rows[0];
            const partnerId = row.respondent1_id === rid ? row.respondent2_id : row.respondent1_id;
            const partner = byRespondent.get(partnerId);
            partnerNickname = partner?.nickname || '';
            matchPercent = Number(row.final_match_percent) || 0;
          }
          return sendMatchEmail({
            toEmail: p.email,
            partnerNickname,
            matchPercent,
            selfRose: '-',
            partnerRose: '-',
            runAt: now,
            matched,
            category
          });
        })();

        if (ok) delivered += 1;
        else failed += 1;
      }
    }

    const runStatus = failed > 0 ? 'completed_with_errors' : 'completed';
    await surveyPool.query(
      `
      UPDATE unidate_app.match_runs
      SET status = $1,
          candidate_count = $2,
          pair_count = $3,
          completed_at = NOW()
      WHERE id = $4
      `,
      [runStatus, participants.length, insertedPairs, runId]
    );

    return {
      skipped: false,
      reason: 'ok',
      run_key: runKey,
      category,
      candidates: participants.length,
      pairs: insertedPairs,
      delivered,
      failed
    };
  } catch (error) {
    await surveyPool.query(
      `
      UPDATE unidate_app.match_runs
      SET status = $1,
          completed_at = NOW()
      WHERE id = $2
      `,
      ['failed', runId]
    );
    throw error;
  }
}

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

export function getCurrentWeeklyMatchRunKey(category, date = new Date()) {
  const isoWeek = getShanghaiIsoWeekKey(date);
  return `weekly-match-${category}-${isoWeek}`;
}

export async function runWeeklyMatchingPipeline({
  initiatedBy = 'scheduler',
  date = new Date(),
  sendEmails = true,
  categories
} = {}) {
  await ensureSchema();
  const targetCategories = normalizeCategories(categories);
  if (targetCategories.length === 0) {
    throw new Error('No valid match categories selected');
  }
  const cycle = await createMatchCycle(initiatedBy);
  const results = [];
  for (const category of targetCategories) {
    const runKey = `weekly-match-cycle-${cycle.id}-${category}`;
    // eslint-disable-next-line no-await-in-loop
    const res = await runWeeklyMatchingForCategory({
      category,
      runKey,
      initiatedBy,
      cycleId: cycle.id,
      sendEmails
    });
    results.push(res);
  }
  return { cycle_id: cycle.id, started_at: cycle.started_at, categories: targetCategories, results };
}

export async function previewWeeklyMatchingStats({ date = new Date() } = {}) {
  await ensureSchema();
  const out = {
    computed_at: date.toISOString(),
    love: {
      questionnaire_filled: 0,
      matched_pairs: 0,
      matched_users: 0,
      funnel: {
        left_participants: 0,
        right_participants: 0,
        hard_filter_edges: 0,
        threshold_edges: 0
      }
    },
    friend: {
      questionnaire_filled: 0,
      matched_pairs: 0,
      matched_users: 0,
      funnel: {
        left_participants: 0,
        right_participants: 0,
        hard_filter_edges: 0,
        threshold_edges: 0
      }
    },
    xinghua: {
      questionnaire_filled: 0,
      matched_pairs: 0,
      matched_users: 0,
      funnel: {
        left_participants: 0,
        right_participants: 0,
        hard_filter_edges: 0,
        threshold_edges: 0
      }
    },
    total: {
      questionnaire_filled: 0,
      matched_pairs: 0,
      matched_users: 0,
      funnel: {
        left_participants: 0,
        right_participants: 0,
        hard_filter_edges: 0,
        threshold_edges: 0
      }
    }
  };

  for (const category of MATCH_CATEGORIES) {
    // eslint-disable-next-line no-await-in-loop
    const [participants, moduleQuestions] = await Promise.all([
      listEligibleParticipants(category),
      getQuestionNumbersByModule(category)
    ]);
    const respondentIds = participants.map((p) => p.respondent_id);
    const { left, right } = buildBipartiteSets(participants);
    // eslint-disable-next-line no-await-in-loop
    const [consecutiveFailMap, historicalPairKeys] = await Promise.all([
      getConsecutiveUnmatchedCount(category, respondentIds),
      getHistoricalMatchedPairKeySet(category, respondentIds)
    ]);

    const edges = [];
    let hardFilterEdges = 0;
    for (let i = 0; i < left.length; i += 1) {
      for (let j = 0; j < right.length; j += 1) {
        const a = left[i];
        const b = right[j];
        if (!passesHardFilters(a, b, category)) continue;
        if (historicalPairKeys.has(makePairKey(a.respondent_id, b.respondent_id))) continue;
        hardFilterEdges += 1;
        const score = computePairScore(a, b, moduleQuestions, consecutiveFailMap, category);
        if (!thresholdPass(score, category)) continue;
        edges.push({ i, j, cost: -score.final });
      }
    }

    const mcmf = minCostMaxFlow({ leftSize: left.length, rightSize: right.length, edges });
    const pairs = mcmf.matches.length;
    const users = pairs * 2;

    out[category].questionnaire_filled = participants.length;
    out[category].matched_pairs = pairs;
    out[category].matched_users = users;
    out[category].funnel.left_participants = left.length;
    out[category].funnel.right_participants = right.length;
    out[category].funnel.hard_filter_edges = hardFilterEdges;
    out[category].funnel.threshold_edges = edges.length;
  }

  const xinghuaFilledRes = await surveyPool.query(
    `
    SELECT COUNT(DISTINCT respondent_id)::int AS total
    FROM unidate_app.match_questionnaire_drafts
    WHERE category = 'xinghua'
      AND completed = TRUE
    `
  );
  out.xinghua.questionnaire_filled = Number(xinghuaFilledRes.rows[0]?.total || 0);

  out.total.questionnaire_filled = out.love.questionnaire_filled + out.friend.questionnaire_filled + out.xinghua.questionnaire_filled;
  out.total.matched_pairs = out.love.matched_pairs + out.friend.matched_pairs + out.xinghua.matched_pairs;
  out.total.matched_users = out.love.matched_users + out.friend.matched_users + out.xinghua.matched_users;
  out.total.funnel.left_participants = out.love.funnel.left_participants + out.friend.funnel.left_participants + out.xinghua.funnel.left_participants;
  out.total.funnel.right_participants = out.love.funnel.right_participants + out.friend.funnel.right_participants + out.xinghua.funnel.right_participants;
  out.total.funnel.hard_filter_edges = out.love.funnel.hard_filter_edges + out.friend.funnel.hard_filter_edges + out.xinghua.funnel.hard_filter_edges;
  out.total.funnel.threshold_edges = out.love.funnel.threshold_edges + out.friend.funnel.threshold_edges + out.xinghua.funnel.threshold_edges;
  return out;
}
