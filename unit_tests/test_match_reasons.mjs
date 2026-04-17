import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchDimensionReasons } from '../backend/src/lib/rose.js';

test('buildMatchDimensionReasons returns four reason blocks for valid ROSE codes', () => {
  const reasons = buildMatchDimensionReasons('ACIR', 'BGSF');
  assert.equal(Array.isArray(reasons), true);
  assert.equal(reasons.length, 4);
  assert.equal(reasons[0].matchup_label, '黄金互补：A + B');
  assert.equal(reasons[1].matchup_label, '太极局：C + G');
  assert.equal(reasons[2].matchup_label, '高张力磨合：I + S');
  assert.equal(reasons[3].matchup_label, '秩序与自由：R + F');
});

test('buildMatchDimensionReasons returns empty list for invalid ROSE code', () => {
  const reasons = buildMatchDimensionReasons('XXXX', 'BGSF');
  assert.deepEqual(reasons, []);
});
