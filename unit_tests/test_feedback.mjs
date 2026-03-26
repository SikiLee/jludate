import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFeedbackListParams, validateFeedbackPayload } from '../backend/src/lib/feedback.js';

test('validateFeedbackPayload accepts valid payload', () => {
  const result = validateFeedbackPayload({
    content: '整体体验不错，希望增加筛选条件。',
    contact_email: 'User@Example.com',
    source: 'banner',
    rose_code: 'ra_1'
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.source, 'banner');
  assert.equal(result.data.contact_email, 'user@example.com');
  assert.equal(result.data.rose_code, 'RA_1');
});

test('validateFeedbackPayload rejects invalid payload', () => {
  const emptyContent = validateFeedbackPayload({ content: '   ' });
  assert.equal(emptyContent.ok, false);

  const badEmail = validateFeedbackPayload({
    content: '希望增加导出',
    contact_email: 'bad-email'
  });
  assert.equal(badEmail.ok, false);

  const badRoseCode = validateFeedbackPayload({
    content: '希望增加导出',
    rose_code: 'rose!*'
  });
  assert.equal(badRoseCode.ok, false);
});

test('parseFeedbackListParams resolves defaults and bounds', () => {
  const defaults = parseFeedbackListParams(new URLSearchParams());
  assert.deepEqual(defaults, { limit: 50, offset: 0 });

  const custom = parseFeedbackListParams(new URLSearchParams('limit=20&offset=30'));
  assert.deepEqual(custom, { limit: 20, offset: 30 });

  const bounded = parseFeedbackListParams(new URLSearchParams('limit=999&offset=-1'));
  assert.deepEqual(bounded, { limit: 200, offset: 0 });
});
