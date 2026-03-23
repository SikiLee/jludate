import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptString,
  encryptString,
  getActivePrivacyKeyVersion,
  hashSha256Hex
} from '../backend/src/lib/privacy.js';
import {
  buildEncryptedEmailPayload,
  hashEmailForLookup,
  normalizeEmail,
  resolveUserEmail
} from '../backend/src/lib/identityLink.js';

test('privacy encrypt/decrypt roundtrip works with key version', () => {
  const encrypted = encryptString('respondent-123');
  assert.ok(encrypted.ciphertext);
  assert.equal(typeof encrypted.key_version, 'string');
  assert.equal(encrypted.key_version, getActivePrivacyKeyVersion());

  const decrypted = decryptString(encrypted.ciphertext, encrypted.key_version);
  assert.equal(decrypted, 'respondent-123');
});

test('email lookup hash is stable with normalization', () => {
  const hashA = hashEmailForLookup('User@Test.edu.cn ');
  const hashB = hashEmailForLookup('user@test.edu.cn');

  assert.equal(hashA, hashB);
  assert.equal(hashA, hashSha256Hex('user@test.edu.cn'));
  assert.equal(normalizeEmail('  USER@Test.edu.cn '), 'user@test.edu.cn');
});

test('resolveUserEmail can decode encrypted email payload', () => {
  const payload = buildEncryptedEmailPayload('enc_user@szu.edu.cn');
  const resolved = resolveUserEmail({
    email: null,
    email_ciphertext: payload.email_ciphertext,
    email_key_version: payload.email_key_version
  });

  assert.equal(resolved, 'enc_user@szu.edu.cn');
});
