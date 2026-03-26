import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicHomeMetrics } from '../backend/src/lib/publicMetrics.js';

function buildDbMock(resolver) {
  return {
    async query(sql) {
      return resolver(sql);
    }
  };
}

test('getPublicHomeMetrics returns database-backed values', async () => {
  const identityDb = buildDbMock(async () => ({ rows: [{ total: 10 }] }));
  const surveyDb = buildDbMock(async (sql) => {
    if (sql.includes('FROM unidate_app.survey_responses')) {
      return { rows: [{ total: 6 }] };
    }
    if (sql.includes('SELECT respondent1_id AS respondent_id')) {
      return { rows: [{ total: 4 }] };
    }
    if (sql.includes('FROM unidate_app.site_settings')) {
      return { rows: [] };
    }
    throw new Error('Unexpected survey query');
  });

  const metrics = await getPublicHomeMetrics(identityDb, surveyDb);
  assert.equal(metrics.registered_users, 10);
  assert.equal(metrics.survey_completed_users, 6);
  assert.equal(metrics.survey_completion_rate, 60);
  assert.equal(metrics.matched_users, 4);
  assert.equal(Number.isFinite(metrics.next_match_in_seconds), true);
  assert.equal(metrics.next_match_in_seconds >= 0, true);
  assert.equal(metrics.next_match_in_seconds <= 7 * 24 * 3600, true);
});

test('survey completion rate is capped at 100%', async () => {
  const identityDb = buildDbMock(async () => ({ rows: [{ total: 3 }] }));
  const surveyDb = buildDbMock(async (sql) => {
    if (sql.includes('FROM unidate_app.survey_responses')) {
      return { rows: [{ total: 9 }] };
    }
    if (sql.includes('SELECT respondent1_id AS respondent_id')) {
      return { rows: [{ total: 2 }] };
    }
    if (sql.includes('FROM unidate_app.site_settings')) {
      return { rows: [] };
    }
    throw new Error('Unexpected survey query');
  });

  const metrics = await getPublicHomeMetrics(identityDb, surveyDb);
  assert.equal(metrics.survey_completion_rate, 100);
});
