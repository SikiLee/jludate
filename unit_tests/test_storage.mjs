import assert from 'node:assert/strict';
import test from 'node:test';
import { clearAuthStorage, getAccessToken, getIsAdmin } from '../frontend/src/lib/storage.js';

class MockLocalStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

test('legacy storage keys migrate to campus_match_* keys', () => {
  const localStorage = new MockLocalStorage({
    szu_token: 'legacy-token',
    szu_is_admin: 'true'
  });

  global.window = { localStorage };

  assert.equal(getAccessToken(), 'legacy-token');
  assert.equal(getIsAdmin(), true);

  assert.equal(localStorage.getItem('campus_match_token'), 'legacy-token');
  assert.equal(localStorage.getItem('campus_match_is_admin'), 'true');
  assert.equal(localStorage.getItem('szu_token'), null);
  assert.equal(localStorage.getItem('szu_is_admin'), null);

  clearAuthStorage();
  assert.equal(localStorage.getItem('campus_match_token'), null);
  assert.equal(localStorage.getItem('campus_match_is_admin'), null);

  delete global.window;
});

test('setters keep new and legacy keys in sync for compatibility', () => {
  const localStorage = new MockLocalStorage();
  global.window = {
    localStorage,
    dispatchEvent: () => {}
  };

  // re-import to isolate migrated state
  // eslint-disable-next-line no-undef
  return import(`../frontend/src/lib/storage.js?compat=${Date.now()}`).then((storage) => {
    storage.setAccessToken('new-token');
    storage.setIsAdmin(true);

    assert.equal(localStorage.getItem('campus_match_token'), 'new-token');
    assert.equal(localStorage.getItem('szu_token'), 'new-token');
    assert.equal(localStorage.getItem('campus_match_is_admin'), 'true');
    assert.equal(localStorage.getItem('szu_is_admin'), 'true');

    storage.clearAuthStorage();
    assert.equal(localStorage.getItem('campus_match_token'), null);
    assert.equal(localStorage.getItem('szu_token'), null);
  }).finally(() => {
    delete global.window;
  });
});
