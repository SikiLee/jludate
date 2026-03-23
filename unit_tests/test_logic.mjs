import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeMatchScore,
  computeRoseProfile,
  evaluateHardFilters,
  validateProfile,
  validateAnswers
} from '../backend/src/lib/rose.js';

function buildAnswers(defaultValue = 4) {
  const answers = {};
  for (let i = 1; i <= 50; i += 1) {
    answers[`q${i}`] = defaultValue;
  }
  return answers;
}

function buildUser({ gender = 'male', target_gender = 'female', answers }) {
  const result = computeRoseProfile(answers);
  assert.equal(result.ok, true);

  return {
    gender,
    target_gender,
    answers: result.profile.answers,
    rose: {
      dimension_scores: result.profile.dimension_scores,
      dimension_letters: result.profile.dimension_letters,
      rose_code: result.profile.rose_code
    }
  };
}

test('validateAnswers requires exact 50 integer scores', () => {
  const valid = buildAnswers();
  const success = validateAnswers(valid);
  assert.equal(success.ok, true);

  const missing = { ...valid };
  delete missing.q50;
  assert.equal(validateAnswers(missing).ok, false);

  const badType = { ...valid, q10: '7' };
  assert.equal(validateAnswers(badType).ok, false);

  const outOfRange = { ...valid, q10: 9 };
  assert.equal(validateAnswers(outOfRange).ok, false);
});

test('validateProfile accepts only gender + target_gender', () => {
  assert.equal(validateProfile({ gender: 'male', target_gender: 'female' }).ok, true);
  assert.equal(validateProfile({ gender: 'male', target_gender: 'prefer_both' }).ok, false);
  assert.equal(validateProfile({ gender: 'unknown', target_gender: 'female' }).ok, false);
});

test('dimension tie-break follows core question score', () => {
  const tiePreferA = buildAnswers();
  tiePreferA.q2 = 5;
  tiePreferA.q6 = 3;

  const roseA = computeRoseProfile(tiePreferA);
  assert.equal(roseA.ok, true);
  assert.equal(roseA.profile.dimension_scores.A, 40);
  assert.equal(roseA.profile.dimension_letters.A, 'A');

  const tiePreferB = buildAnswers();
  const roseB = computeRoseProfile(tiePreferB);
  assert.equal(roseB.ok, true);
  assert.equal(roseB.profile.dimension_scores.A, 40);
  assert.equal(roseB.profile.dimension_letters.A, 'B');
});

test('hard filter rejects I/S mismatch and veto question split', () => {
  const baseAnswers = buildAnswers();
  baseAnswers.q41 = 1;
  const left = buildUser({ answers: baseAnswers, gender: 'male', target_gender: 'female' });

  const diffBoundaryAnswers = buildAnswers();
  diffBoundaryAnswers.q12 = 5;
  diffBoundaryAnswers.q30 = 3;
  const rightBoundary = buildUser({ answers: diffBoundaryAnswers, gender: 'female', target_gender: 'male' });

  const boundaryResult = evaluateHardFilters(left, rightBoundary);
  assert.equal(boundaryResult.passed, false);
  assert.equal(boundaryResult.reason, 'boundary_type_conflict');

  const vetoAnswers = buildAnswers();
  vetoAnswers.q41 = 7;
  const rightVeto = buildUser({ answers: vetoAnswers, gender: 'female', target_gender: 'male' });
  const vetoResult = evaluateHardFilters(left, rightVeto);
  assert.equal(vetoResult.passed, false);
  assert.equal(vetoResult.reason, 'veto_q41');
});

test('match score is capped at 99.9', () => {
  const answers = buildAnswers();
  const userA = buildUser({ answers, gender: 'male', target_gender: 'female' });
  const userB = buildUser({ answers, gender: 'female', target_gender: 'male' });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.final_match_percent, 99.9);
});

test('communication complementary bonus grants +5%', () => {
  const cHighAnswers = buildAnswers();
  cHighAnswers.q4 = 7;
  cHighAnswers.q22 = 7;
  cHighAnswers.q23 = 7;

  const cLowAnswers = buildAnswers();
  cLowAnswers.q4 = 1;
  cLowAnswers.q22 = 1;

  const userA = buildUser({ answers: cHighAnswers, gender: 'male', target_gender: 'female' });
  const userB = buildUser({ answers: cLowAnswers, gender: 'female', target_gender: 'male' });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.complementary_bonus, 5);
});
