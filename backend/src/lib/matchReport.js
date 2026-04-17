import { surveyPool } from 'lib/db';
import { MATCH_REASON_COPY, MODULE_QUESTION_NUMBERS } from 'lib/matchReasonCopy';

function q(n) {
  return `q${n}`;
}

function qType(n) {
  return `q${n}_match_type`;
}

function normalize5(raw) {
  if (Number.isInteger(raw) && raw >= -2 && raw <= 2) return raw + 3;
  if (Number.isInteger(raw) && raw >= 1 && raw <= 5) return raw;
  return null;
}

function simScore(a, b) {
  if (a === null || b === null) return 0;
  return 1 - (Math.abs(a - b) / 4);
}

function compScore(a, b) {
  if (a === null || b === null) return 0;
  return Math.abs(a - b) / 4;
}

function round1(v) {
  return Math.round((Number(v) || 0) * 10) / 10;
}

function resolveModule3Mode(aTypeRaw, bTypeRaw, a, b) {
  const aType = String(aTypeRaw || 'complement').toLowerCase();
  const bType = String(bTypeRaw || 'complement').toLowerCase();
  if (aType === 'similar' && bType === 'similar') return 'similar';
  if ((aType === 'complement' || aType === 'complementary') && (bType === 'complement' || bType === 'complementary')) {
    return 'complementary';
  }
  const s = simScore(a, b);
  const c = compScore(a, b);
  return s >= c ? 'similar' : 'complementary';
}

function resolveQuestionReason(category, questionNumber, mode) {
  const copy = MATCH_REASON_COPY?.[category]?.[questionNumber];
  if (!copy) return '你们在这一题上的作答呈现出较高匹配度，更容易形成自然顺畅的相处体验。';
  if (questionNumber >= 29 && questionNumber <= 36) {
    return mode === 'similar' ? copy.similar : copy.complementary;
  }
  return copy.reason;
}

async function getQuestionTitles(category) {
  const res = await surveyPool.query(
    `
    SELECT question_number, question_title
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1
      AND page_key = 'deep'
      AND question_kind = 'scale5_lr'
    `,
    [category]
  );
  const map = new Map();
  for (const row of res.rows) {
    map.set(Number(row.question_number), String(row.question_title || '').trim());
  }
  return map;
}

export async function buildMatchReportFromDrafts({ category, selfDraft, partnerDraft, finalPercent }) {
  const titles = await getQuestionTitles(category);
  const selfDeep = selfDraft?.deep_survey || {};
  const partnerDeep = partnerDraft?.deep_survey || {};

  const moduleReports = [];
  const topReasons = [];

  for (const moduleIndex of [1, 2, 3]) {
    const questions = MODULE_QUESTION_NUMBERS[moduleIndex] || [];
    const rows = [];
    for (const n of questions) {
      const a = normalize5(selfDeep[q(n)]);
      const b = normalize5(partnerDeep[q(n)]);
      const s = simScore(a, b);
      const c = compScore(a, b);
      const mode = moduleIndex === 3
        ? resolveModule3Mode(selfDeep[qType(n)], partnerDeep[qType(n)], a, b)
        : 'similar';
      const score = moduleIndex === 3
        ? (mode === 'similar' ? s : c)
        : s;
      const reason = resolveQuestionReason(category, n, mode);
      rows.push({
        question_number: n,
        question_title: titles.get(n) || `第${n}题`,
        score: round1(score * 100),
        reason
      });
    }
    rows.sort((l, r) => r.score - l.score);
    const moduleScore = rows.length ? round1(rows.reduce((sum, it) => sum + it.score, 0) / rows.length) : 0;
    const top3 = rows.slice(0, 3);
    if (top3[0]?.reason) topReasons.push(top3[0].reason);
    moduleReports.push({
      module_index: moduleIndex,
      module_score: moduleScore,
      top_questions: top3
    });
  }

  return {
    total_score: round1(finalPercent),
    top_reasons: topReasons.slice(0, 3),
    modules: moduleReports
  };
}

