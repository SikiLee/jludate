import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMatchScore, computeRoseProfile } from '../backend/src/lib/rose.js';

function buildAnswers(defaultValue = 4) {
  const answers = {};
  for (let i = 1; i <= 50; i += 1) {
    answers[`q${i}`] = defaultValue;
  }
  return answers;
}

function buildUser({ gender, target_gender, answers }) {
  const roseResult = computeRoseProfile(answers);
  assert.equal(roseResult.ok, true);

  return {
    gender,
    target_gender,
    answers: roseResult.profile.answers,
    rose: {
      dimension_scores: roseResult.profile.dimension_scores,
      dimension_letters: roseResult.profile.dimension_letters,
      rose_code: roseResult.profile.rose_code
    }
  };
}

test('accuracy case: identical answers should hit max score cap 99.9', () => {
  const answers = buildAnswers(4);
  const userA = buildUser({ gender: 'male', target_gender: 'female', answers });
  const userB = buildUser({ gender: 'female', target_gender: 'male', answers });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.final_match_percent, 99.9);
});

test('accuracy case: incompatible target gender should be rejected', () => {
  const answers = buildAnswers(4);
  const userA = buildUser({ gender: 'male', target_gender: 'female', answers });
  const userB = buildUser({ gender: 'female', target_gender: 'female', answers });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, false);
  assert.equal(score.reason, 'profile_mismatch');
});

test('accuracy case: q41 difference no longer blocks matching', () => {
  const answersA = buildAnswers(4);
  const answersB = buildAnswers(4);
  answersA.q41 = 7;
  answersB.q41 = 1;

  const userA = buildUser({ gender: 'male', target_gender: 'female', answers: answersA });
  const userB = buildUser({ gender: 'female', target_gender: 'male', answers: answersB });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.reason, 'compatible');
});

test('accuracy case: chill compatibility should get +3 bonus', () => {
  const chillA = buildAnswers(4);
  chillA.q12 = 5;
  chillA.q40 = 5;

  const chillB = buildAnswers(4);
  chillB.q12 = 5;
  chillB.q40 = 5;

  const userA = buildUser({ gender: 'male', target_gender: 'female', answers: chillA });
  const userB = buildUser({ gender: 'female', target_gender: 'male', answers: chillB });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.complementary_bonus, 3);
});

test('accuracy case: communication balance should get +4 bonus', () => {
  const commA = buildAnswers(4);
  commA.q27 = 5;

  const commB = buildAnswers(4);
  commB.q25 = 5;

  const userA = buildUser({ gender: 'male', target_gender: 'female', answers: commA });
  const userB = buildUser({ gender: 'female', target_gender: 'male', answers: commB });

  const score = computeMatchScore(userA, userB);
  assert.equal(score.is_match, true);
  assert.equal(score.complementary_bonus, 4);
});

test('accuracy case: similar pair should score higher than a farther pair', () => {
  const anchorAnswers = buildAnswers(4);
  const closeAnswers = buildAnswers(4);
  const farAnswers = buildAnswers(6);

  const anchor = buildUser({ gender: 'male', target_gender: 'female', answers: anchorAnswers });
  const closeUser = buildUser({ gender: 'female', target_gender: 'male', answers: closeAnswers });
  const farUser = buildUser({ gender: 'female', target_gender: 'male', answers: farAnswers });

  const closeScore = computeMatchScore(anchor, closeUser);
  const farScore = computeMatchScore(anchor, farUser);

  assert.equal(closeScore.is_match, true);
  assert.equal(farScore.is_match, true);
  assert.equal(closeScore.final_match_percent > farScore.final_match_percent, true);
});
