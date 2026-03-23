import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../backend/src/lib/password.js';

test('verifyPassword accepts bcrypt hash and does not require upgrade', async () => {
  const password = 'Password123!';
  const hashed = await hashPassword(password);

  const matched = await verifyPassword(password, hashed);
  assert.equal(matched.matched, true);
  assert.equal(matched.needs_upgrade, false);

  const wrong = await verifyPassword('WrongPassword123!', hashed);
  assert.equal(wrong.matched, false);
  assert.equal(wrong.needs_upgrade, false);
});

test('verifyPassword supports legacy plain-text and marks for upgrade', async () => {
  const matched = await verifyPassword('legacy-pass', 'legacy-pass');
  assert.equal(matched.matched, true);
  assert.equal(matched.needs_upgrade, true);

  const wrong = await verifyPassword('legacy-pass', 'another-pass');
  assert.equal(wrong.matched, false);
  assert.equal(wrong.needs_upgrade, false);
});
