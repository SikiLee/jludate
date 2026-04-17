import crypto from 'node:crypto';
import { decryptString, encryptString, hashSha256Hex } from './privacy.js';

const RESPONDENT_ID_RETRY_LIMIT = 3;
const INACTIVE_PASSWORD_PLACEHOLDER_HASH = process.env.INACTIVE_PASSWORD_PLACEHOLDER_HASH
  || '$2a$12$1JW0irfGiqgrg7c1FLRk4.bmJswowkJmG5J5x9vpCu5NrrTFjjR/C';

function safePurpose(purpose) {
  if (typeof purpose !== 'string') {
    return '';
  }
  return purpose.trim().slice(0, 500);
}

function safeActor(actor) {
  if (typeof actor !== 'string') {
    return 'system';
  }
  const value = actor.trim();
  return value ? value.slice(0, 120) : 'system';
}

function normalizeRespondentId(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }
  return rawValue.trim();
}

export function normalizeEmail(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }
  return rawValue.trim().toLowerCase();
}

export function hashEmailForLookup(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return '';
  }
  return hashSha256Hex(normalized);
}

function hashRespondentIdForLookup(respondentId) {
  const normalized = normalizeRespondentId(respondentId);
  if (!normalized) {
    return '';
  }
  return hashSha256Hex(normalized);
}

async function writeIdentityAuditLog(db, { actor, action, targetType, targetRef, purpose }) {
  try {
    await db.query(
      `
      INSERT INTO unidate_app.access_audit_logs(actor, action, target_type, target_ref, purpose)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        safeActor(actor),
        String(action || 'unknown').slice(0, 120),
        String(targetType || 'unknown').slice(0, 120),
        targetRef ? String(targetRef).slice(0, 255) : null,
        safePurpose(purpose)
      ]
    );
  } catch {
    // Keep identity access logs best-effort, but surface failures for ops visibility.
    console.error('writeIdentityAuditLog failed');
  }
}

export function buildEncryptedEmailPayload(email) {
  const normalizedEmail = normalizeEmail(email);
  const emailHash = hashEmailForLookup(normalizedEmail);
  const encrypted = encryptString(normalizedEmail);

  return {
    email_ciphertext: encrypted.ciphertext,
    email_hash: emailHash,
    email_key_version: encrypted.key_version
  };
}

export function resolveUserEmail(row) {
  if (row?.email_ciphertext && row?.email_key_version) {
    try {
      return normalizeEmail(decryptString(row.email_ciphertext, row.email_key_version));
    } catch {
      return '';
    }
  }

  if (typeof row?.email === 'string') {
    return normalizeEmail(row.email);
  }

  return '';
}

export async function findUserByEmail(db, emailInput) {
  const email = normalizeEmail(emailInput);
  if (!email) {
    return null;
  }

  const emailHash = hashEmailForLookup(email);
  const result = await db.query(
    `
    SELECT
      id,
      email,
      email_ciphertext,
      email_hash,
      email_key_version,
      hashed_password,
      is_active,
      is_admin,
      verification_code,
      gender,
      target_gender,
      orientation
    FROM unidate_app.users
    WHERE email_hash = $1 OR email = $2
    ORDER BY CASE WHEN email_hash = $1 THEN 0 ELSE 1 END ASC
    LIMIT 1
    `,
    [emailHash, email]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function createInactiveUserWithEncryptedEmail(db, emailInput, verificationCode) {
  const email = normalizeEmail(emailInput);
  const payload = buildEncryptedEmailPayload(email);

  const result = await db.query(
    `
    INSERT INTO unidate_app.users(
      email,
      email_ciphertext,
      email_hash,
      email_key_version,
      hashed_password,
      verification_code,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, FALSE)
    RETURNING id
    `,
    [
      null,
      payload.email_ciphertext,
      payload.email_hash,
      payload.email_key_version,
      INACTIVE_PASSWORD_PLACEHOLDER_HASH,
      verificationCode
    ]
  );

  return result.rows[0].id;
}

export async function updateEncryptedEmailForUser(db, userId, emailInput) {
  const email = normalizeEmail(emailInput);
  const payload = buildEncryptedEmailPayload(email);

  await db.query(
    `
    UPDATE unidate_app.users
    SET email = NULL,
        email_ciphertext = $1,
        email_hash = $2,
        email_key_version = $3
    WHERE id = $4
    `,
    [payload.email_ciphertext, payload.email_hash, payload.email_key_version, userId]
  );
}

function decryptRespondentIdFromRow(row) {
  if (!row) {
    return '';
  }

  if (row.respondent_id_ciphertext && row.respondent_id_key_version) {
    try {
      return normalizeRespondentId(decryptString(row.respondent_id_ciphertext, row.respondent_id_key_version));
    } catch {
      return '';
    }
  }

  if (typeof row.respondent_id === 'string') {
    return normalizeRespondentId(row.respondent_id);
  }

  return '';
}

function buildEncryptedRespondentPayload(respondentIdInput) {
  const respondentId = normalizeRespondentId(respondentIdInput);
  const encrypted = encryptString(respondentId);
  const respondentHash = hashRespondentIdForLookup(respondentId);

  return {
    respondent_id_ciphertext: encrypted.ciphertext,
    respondent_id_hash: respondentHash,
    respondent_id_key_version: encrypted.key_version
  };
}

export async function getRespondentIdByUserId(db, userId, { actor = 'system', purpose = '' } = {}) {
  const result = await db.query(
    `
    SELECT respondent_id_ciphertext, respondent_id_hash, respondent_id_key_version
    FROM unidate_app.user_respondent_links
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const respondentId = decryptRespondentIdFromRow(result.rows[0]);
  if (!respondentId) {
    return null;
  }

  await writeIdentityAuditLog(db, {
    actor,
    action: 'read_user_respondent_link',
    targetType: 'user',
    targetRef: String(userId),
    purpose
  });

  return respondentId;
}

export async function ensureRespondentIdForUser(db, userId, { actor = 'system', purpose = '' } = {}) {
  const existing = await getRespondentIdByUserId(db, userId, { actor, purpose: purpose || 'ensure_link_existing' });
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < RESPONDENT_ID_RETRY_LIMIT; attempt += 1) {
    const respondentId = crypto.randomUUID();
    const payload = buildEncryptedRespondentPayload(respondentId);

    try {
      await db.query(
        `
        INSERT INTO unidate_app.user_respondent_links(
          user_id,
          respondent_id_ciphertext,
          respondent_id_hash,
          respondent_id_key_version,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          respondent_id_ciphertext = unidate_app.user_respondent_links.respondent_id_ciphertext,
          respondent_id_hash = unidate_app.user_respondent_links.respondent_id_hash,
          respondent_id_key_version = unidate_app.user_respondent_links.respondent_id_key_version,
          updated_at = unidate_app.user_respondent_links.updated_at
        `,
        [userId, payload.respondent_id_ciphertext, payload.respondent_id_hash, payload.respondent_id_key_version]
      );
    } catch (error) {
      if (error?.code === '23505') {
        continue;
      }
      throw error;
    }

    const resolved = await getRespondentIdByUserId(db, userId, { actor, purpose: purpose || 'ensure_link_created' });
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('Failed to generate respondent id');
}

export async function getUserEmailByRespondentId(db, respondentIdInput, { actor = 'system', purpose = '' } = {}) {
  const respondentId = normalizeRespondentId(respondentIdInput);
  if (!respondentId) {
    return '';
  }

  const respondentHash = hashRespondentIdForLookup(respondentId);
  const result = await db.query(
    `
    SELECT
      l.user_id,
      l.respondent_id_ciphertext,
      l.respondent_id_key_version,
      u.email,
      u.email_ciphertext,
      u.email_key_version
    FROM unidate_app.user_respondent_links l
    INNER JOIN unidate_app.users u ON u.id = l.user_id
    WHERE l.respondent_id_hash = $1
    LIMIT 1
    `,
    [respondentHash]
  );

  if (result.rowCount === 0) {
    return '';
  }

  const row = result.rows[0];
  const decryptedRespondentId = decryptRespondentIdFromRow(row);
  if (!decryptedRespondentId || decryptedRespondentId !== respondentId) {
    return '';
  }

  const email = resolveUserEmail(row);
  if (!email) {
    return '';
  }

  await writeIdentityAuditLog(db, {
    actor,
    action: 'read_email_by_respondent',
    targetType: 'respondent',
    targetRef: respondentHash.slice(0, 16),
    purpose
  });

  return email;
}

/** 匹配页展示对方资料（不含邮箱）；需校验 respondent 哈希防越权 */
export async function getUserMatchDisplayProfileByRespondentId(
  db,
  respondentIdInput,
  { actor = 'system', purpose = '' } = {}
) {
  const respondentId = normalizeRespondentId(respondentIdInput);
  if (!respondentId) {
    return null;
  }

  const respondentHash = hashRespondentIdForLookup(respondentId);
  const result = await db.query(
    `
    SELECT
      l.respondent_id_ciphertext,
      l.respondent_id_key_version,
      u.nickname,
      u.gender,
      u.campus,
      u.college,
      u.grade,
      u.message_to_partner,
      u.share_contact_with_match,
      u.match_contact_detail
    FROM unidate_app.user_respondent_links l
    INNER JOIN unidate_app.users u ON u.id = l.user_id
    WHERE l.respondent_id_hash = $1
    LIMIT 1
    `,
    [respondentHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const decryptedRespondentId = decryptRespondentIdFromRow(row);
  if (!decryptedRespondentId || decryptedRespondentId !== respondentId) {
    return null;
  }

  await writeIdentityAuditLog(db, {
    actor,
    action: 'read_match_display_profile_by_respondent',
    targetType: 'respondent',
    targetRef: respondentHash.slice(0, 16),
    purpose
  });

  const shareContact = Boolean(row.share_contact_with_match);
  const rawDetail = typeof row.match_contact_detail === 'string' ? row.match_contact_detail.trim() : '';
  const partnerContactForMatch = shareContact && rawDetail ? rawDetail : '';

  return {
    nickname: typeof row.nickname === 'string' ? row.nickname.trim() : '',
    gender: typeof row.gender === 'string' ? row.gender.trim() : '',
    campus: typeof row.campus === 'string' ? row.campus.trim() : '',
    college: typeof row.college === 'string' ? row.college.trim() : '',
    grade: typeof row.grade === 'string' ? row.grade.trim() : '',
    message_to_partner: typeof row.message_to_partner === 'string' ? row.message_to_partner : '',
    partner_contact_for_match: partnerContactForMatch
  };
}

export async function listActiveIdentityProfilesForMatching(db, { actor = 'system', purpose = '' } = {}) {
  const result = await db.query(
    `
    SELECT
      u.id AS user_id,
      u.email,
      u.email_ciphertext,
      u.email_key_version,
      u.gender,
      u.target_gender,
      u.allow_cross_school_match,
      u.campus,
      u.nickname,
      u.orientation,
      u.xinghua_preferred_time,
      u.xinghua_festival_participate,
      u.xinghua_ti_type,
      u.xinghua_match_target_ti,
      l.respondent_id_ciphertext,
      l.respondent_id_key_version
    FROM unidate_app.users u
    INNER JOIN unidate_app.user_respondent_links l ON l.user_id = u.id
    WHERE u.is_active = TRUE
    ORDER BY u.id ASC
    `
  );

  const rows = [];
  for (const row of result.rows) {
    const respondentId = decryptRespondentIdFromRow(row);
    const email = resolveUserEmail(row);
    if (!respondentId || !email) {
      continue;
    }

    rows.push({
      user_id: row.user_id,
      respondent_id: respondentId,
      email,
      gender: row.gender,
      target_gender: row.target_gender,
      allow_cross_school_match: Boolean(row.allow_cross_school_match),
      campus: typeof row.campus === 'string' ? row.campus.trim() : '',
      nickname: typeof row.nickname === 'string' ? row.nickname.trim() : '',
      orientation: row.orientation,
      xinghua_preferred_time: typeof row.xinghua_preferred_time === 'string' ? row.xinghua_preferred_time.trim() : '',
      xinghua_festival_participate: Boolean(row.xinghua_festival_participate),
      xinghua_ti_type: typeof row.xinghua_ti_type === 'string' ? row.xinghua_ti_type.trim() : '',
      xinghua_match_target_ti: typeof row.xinghua_match_target_ti === 'string' ? row.xinghua_match_target_ti.trim() : 'same_as_me'
    });
  }

  await writeIdentityAuditLog(db, {
    actor,
    action: 'batch_read_matching_profiles',
    targetType: 'user_respondent_links',
    targetRef: String(rows.length),
    purpose
  });

  return rows;
}
