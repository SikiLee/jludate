import crypto from 'node:crypto';

const DEFAULT_ACTIVE_VERSION = 'v1';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_BYTES = 16;

let cachedConfig = null;

function deriveFallbackKey() {
  const secret = process.env.SECRET_KEY || 'fallback-insecure-secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  return {
    activeVersion: DEFAULT_ACTIVE_VERSION,
    keyMap: new Map([[DEFAULT_ACTIVE_VERSION, key]])
  };
}

function shouldRequireExplicitKeyring() {
  if (process.env.PRIVACY_REQUIRE_KEYRING === 'true') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function parseRawKeyring(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const text = raw.trim();
  if (!text) {
    return null;
  }

  // Prefer JSON object: {"v1":"base64key","v2":"base64key"}.
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Fallback format: v1:base64,v2:base64
  const chunks = text.split(',').map((item) => item.trim()).filter(Boolean);
  if (chunks.length === 0) {
    return null;
  }

  const result = {};
  for (const chunk of chunks) {
    const separatorIndex = chunk.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const version = chunk.slice(0, separatorIndex).trim();
    const value = chunk.slice(separatorIndex + 1).trim();
    if (!version || !value) {
      continue;
    }

    result[version] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function loadKeyConfig() {
  const raw = process.env.PRIVACY_KEYRING_JSON || process.env.PRIVACY_KEYRING || '';
  const parsed = parseRawKeyring(raw);
  if (!parsed) {
    if (shouldRequireExplicitKeyring()) {
      throw new Error('PRIVACY_KEYRING_JSON/PRIVACY_KEYRING is required in production');
    }
    return deriveFallbackKey();
  }

  const keyMap = new Map();
  for (const [version, base64Key] of Object.entries(parsed)) {
    if (typeof version !== 'string' || typeof base64Key !== 'string') {
      continue;
    }

    const normalizedVersion = version.trim();
    const normalizedBase64 = base64Key.trim();
    if (!normalizedVersion || !normalizedBase64) {
      continue;
    }

    const key = Buffer.from(normalizedBase64, 'base64');
    if (key.length !== KEY_LENGTH_BYTES) {
      continue;
    }

    keyMap.set(normalizedVersion, key);
  }

  if (keyMap.size === 0) {
    if (shouldRequireExplicitKeyring()) {
      throw new Error('No valid 32-byte keys found in PRIVACY_KEYRING_JSON/PRIVACY_KEYRING');
    }
    return deriveFallbackKey();
  }

  const configuredActiveVersion = (process.env.PRIVACY_ACTIVE_KEY_VERSION || '').trim();
  const activeVersion = configuredActiveVersion || DEFAULT_ACTIVE_VERSION;
  if (!keyMap.has(activeVersion)) {
    const [firstVersion] = keyMap.keys();
    return {
      activeVersion: firstVersion,
      keyMap
    };
  }

  return {
    activeVersion,
    keyMap
  };
}

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadKeyConfig();
  }
  return cachedConfig;
}

function getKeyForVersion(version) {
  const config = getConfig();
  const key = config.keyMap.get(version);
  if (!key) {
    throw new Error('Unknown privacy key version');
  }
  return key;
}

export function assertPrivacyConfig() {
  const config = getConfig();
  if (!config.activeVersion || !config.keyMap.has(config.activeVersion)) {
    throw new Error('Invalid privacy key config');
  }
}

export function getActivePrivacyKeyVersion() {
  return getConfig().activeVersion;
}

export function encryptString(plainTextInput) {
  const plainText = String(plainTextInput ?? '');
  const keyVersion = getActivePrivacyKeyVersion();
  const key = getKeyForVersion(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encryptedBody = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encryptedBody]).toString('base64');

  return {
    ciphertext: payload,
    key_version: keyVersion
  };
}

export function decryptString(ciphertextInput, keyVersionInput) {
  const ciphertext = typeof ciphertextInput === 'string' ? ciphertextInput.trim() : '';
  const keyVersion = typeof keyVersionInput === 'string' ? keyVersionInput.trim() : '';
  if (!ciphertext || !keyVersion) {
    throw new Error('Missing encrypted payload');
  }

  const key = getKeyForVersion(keyVersion);
  const payload = Buffer.from(ciphertext, 'base64');
  if (payload.length < IV_LENGTH_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted payload');
  }

  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_BYTES);
  const body = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(body), decipher.final()]);
  return decrypted.toString('utf8');
}

export function hashSha256Hex(rawValue) {
  const value = String(rawValue ?? '');
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
