const TOKEN_KEY = 'campus_match_token';
const ADMIN_KEY = 'campus_match_is_admin';
const LEGACY_TOKEN_KEY = 'szu_token';
const LEGACY_ADMIN_KEY = 'szu_is_admin';

let hasMigrated = false;

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function emitAuthChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.dispatchEvent(new Event('campus-auth-changed'));
  } catch {
    // ignore
  }
}

export function migrateLegacyStorageKeys() {
  if (hasMigrated || typeof window === 'undefined') {
    return;
  }

  hasMigrated = true;

  const existingToken = safeGet(TOKEN_KEY);
  const legacyToken = safeGet(LEGACY_TOKEN_KEY);
  if (!existingToken && legacyToken) {
    safeSet(TOKEN_KEY, legacyToken);
  }
  if (legacyToken) {
    safeRemove(LEGACY_TOKEN_KEY);
  }

  const existingAdmin = safeGet(ADMIN_KEY);
  const legacyAdmin = safeGet(LEGACY_ADMIN_KEY);
  if (!existingAdmin && legacyAdmin) {
    safeSet(ADMIN_KEY, legacyAdmin);
  }
  if (legacyAdmin) {
    safeRemove(LEGACY_ADMIN_KEY);
  }
}

export function getAccessToken() {
  migrateLegacyStorageKeys();
  const token = safeGet(TOKEN_KEY);
  if (token) {
    return token;
  }

  const legacy = safeGet(LEGACY_TOKEN_KEY);
  if (legacy) {
    safeSet(TOKEN_KEY, legacy);
    return legacy;
  }

  return null;
}

export function setAccessToken(token) {
  migrateLegacyStorageKeys();
  if (!token) {
    safeRemove(TOKEN_KEY);
    safeRemove(LEGACY_TOKEN_KEY);
    emitAuthChanged();
    return;
  }
  safeSet(TOKEN_KEY, token);
  // Keep legacy key for mixed/stale frontend bundle compatibility.
  safeSet(LEGACY_TOKEN_KEY, token);
  emitAuthChanged();
}

export function getIsAdmin() {
  migrateLegacyStorageKeys();
  const value = safeGet(ADMIN_KEY);
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  const legacy = safeGet(LEGACY_ADMIN_KEY);
  if (legacy === 'true' || legacy === 'false') {
    safeSet(ADMIN_KEY, legacy);
    return legacy === 'true';
  }

  return false;
}

export function setIsAdmin(value) {
  migrateLegacyStorageKeys();
  const normalized = String(Boolean(value));
  safeSet(ADMIN_KEY, normalized);
  // Keep legacy key for mixed/stale frontend bundle compatibility.
  safeSet(LEGACY_ADMIN_KEY, normalized);
  emitAuthChanged();
}

export function clearAuthStorage() {
  migrateLegacyStorageKeys();
  safeRemove(TOKEN_KEY);
  safeRemove(ADMIN_KEY);
  safeRemove(LEGACY_TOKEN_KEY);
  safeRemove(LEGACY_ADMIN_KEY);
  emitAuthChanged();
}

export const storageKeys = {
  token: TOKEN_KEY,
  isAdmin: ADMIN_KEY
};
