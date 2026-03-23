import { Pool } from 'pg';
import { seedInterpretationsIfEmpty } from 'lib/typeInterpretation';
import { seedSurveyQuestionsIfEmpty } from 'lib/surveyQuestionConfig';
import { seedDefaultSiteSettings } from 'lib/siteConfig';
import { assertPrivacyConfig } from 'lib/privacy';

const DEFAULT_IDENTITY_DB_URL = 'postgresql://user:password@localhost:5432/identity_db';
const DEFAULT_SURVEY_DB_URL = 'postgresql://user:password@localhost:5432/survey_db';

const IDENTITY_DATABASE_URL = process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_IDENTITY_DB_URL;
const SURVEY_DATABASE_URL = process.env.SURVEY_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_SURVEY_DB_URL;

const IDENTITY_DB_NAME = extractDatabaseName(IDENTITY_DATABASE_URL);
const SURVEY_DB_NAME = extractDatabaseName(SURVEY_DATABASE_URL);
const ADMIN_DATABASE_URL = process.env.DATABASE_ADMIN_URL || toAdminDatabaseUrl(IDENTITY_DATABASE_URL);
const IDENTITY_DB_CREDENTIALS = extractDatabaseCredentials(IDENTITY_DATABASE_URL);
const SURVEY_DB_CREDENTIALS = extractDatabaseCredentials(SURVEY_DATABASE_URL);
const ADMIN_DB_USER = extractDatabaseUser(ADMIN_DATABASE_URL);
const IDENTITY_ADMIN_DATABASE_URL = toDatabaseUrl(
  process.env.IDENTITY_ADMIN_DATABASE_URL || ADMIN_DATABASE_URL,
  IDENTITY_DB_NAME
);
const SURVEY_ADMIN_DATABASE_URL = toDatabaseUrl(
  process.env.SURVEY_ADMIN_DATABASE_URL || ADMIN_DATABASE_URL,
  SURVEY_DB_NAME
);
const INACTIVE_PASSWORD_PLACEHOLDER_HASH = process.env.INACTIVE_PASSWORD_PLACEHOLDER_HASH
  || '$2a$12$1JW0irfGiqgrg7c1FLRk4.bmJswowkJmG5J5x9vpCu5NrrTFjjR/C';

const identityPool = new Pool({
  connectionString: IDENTITY_DATABASE_URL
});

const surveyPool = new Pool({
  connectionString: SURVEY_DATABASE_URL
});

const identityAdminPool = new Pool({
  connectionString: IDENTITY_ADMIN_DATABASE_URL
});

const surveyAdminPool = new Pool({
  connectionString: SURVEY_ADMIN_DATABASE_URL
});

// Backward-compatible alias for existing modules. New code should use surveyPool/identityPool explicitly.
const pool = surveyPool;

let schemaPromise;

function extractDatabaseName(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const dbName = parsed.pathname.replace(/^\/+/, '').trim();
    return dbName || 'postgres';
  } catch {
    return 'postgres';
  }
}

function decodeUrlComponentSafe(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function extractDatabaseCredentials(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return {
      user: decodeUrlComponentSafe(parsed.username || '').trim(),
      password: decodeUrlComponentSafe(parsed.password || '')
    };
  } catch {
    return { user: '', password: '' };
  }
}

function extractDatabaseUser(connectionString) {
  return extractDatabaseCredentials(connectionString).user;
}

function toAdminDatabaseUrl(connectionString) {
  const parsed = new URL(connectionString);
  parsed.pathname = '/postgres';
  return parsed.toString();
}

function toDatabaseUrl(connectionString, dbName) {
  const parsed = new URL(connectionString);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

function quoteIdentifier(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw new Error('Invalid SQL identifier');
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function isIgnorableAdminBootstrapError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : '';
  if (code === '42501') {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('permission denied');
}

async function ensureDatabasesExist() {
  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });
  try {
    try {
      await ensureSingleDatabase(adminPool, IDENTITY_DB_NAME);
      if (IDENTITY_DB_NAME !== SURVEY_DB_NAME) {
        await ensureSingleDatabase(adminPool, SURVEY_DB_NAME);
      }
      await ensureRuntimeDatabaseRoles(adminPool);
    } catch (error) {
      if (isIgnorableAdminBootstrapError(error)) {
        console.warn('Skipping admin database bootstrap due to limited database privileges.');
        return;
      }
      throw error;
    }
  } finally {
    await adminPool.end().catch(() => null);
  }
}

async function ensureSingleDatabase(adminPool, dbName) {
  const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1', [dbName]);
  if (result.rowCount > 0) {
    return;
  }

  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(dbName)} TEMPLATE template0`);
}

async function ensureRoleWithPassword(adminPool, roleName, rolePassword) {
  if (typeof roleName !== 'string' || !roleName.trim()) {
    return;
  }

  const normalizedRoleName = roleName.trim();
  const roleIdentifier = quoteIdentifier(normalizedRoleName);
  const passwordLiteral = quoteLiteral(rolePassword || '');
  const exists = await adminPool.query('SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1', [normalizedRoleName]);

  if (exists.rowCount === 0) {
    await adminPool.query(`CREATE ROLE ${roleIdentifier} LOGIN PASSWORD ${passwordLiteral}`);
    return;
  }

  await adminPool.query(`ALTER ROLE ${roleIdentifier} WITH LOGIN PASSWORD ${passwordLiteral}`);
}

async function ensureDatabaseConnectPrivileges(adminPool, dbName, allowedRoles) {
  const dbIdentifier = quoteIdentifier(dbName);
  await adminPool.query(`REVOKE CONNECT ON DATABASE ${dbIdentifier} FROM PUBLIC`);
  await adminPool.query(`REVOKE TEMP ON DATABASE ${dbIdentifier} FROM PUBLIC`);

  const uniqueRoles = [...new Set(
    allowedRoles
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  )];

  for (const roleName of uniqueRoles) {
    const roleIdentifier = quoteIdentifier(roleName);
    await adminPool.query(`GRANT CONNECT ON DATABASE ${dbIdentifier} TO ${roleIdentifier}`);
    await adminPool.query(`GRANT TEMP ON DATABASE ${dbIdentifier} TO ${roleIdentifier}`);
  }
}

async function ensureRuntimeDatabaseRoles(adminPool) {
  await ensureRoleWithPassword(adminPool, IDENTITY_DB_CREDENTIALS.user, IDENTITY_DB_CREDENTIALS.password);
  await ensureRoleWithPassword(adminPool, SURVEY_DB_CREDENTIALS.user, SURVEY_DB_CREDENTIALS.password);

  await ensureDatabaseConnectPrivileges(adminPool, IDENTITY_DB_NAME, [
    ADMIN_DB_USER,
    IDENTITY_DB_CREDENTIALS.user
  ]);

  await ensureDatabaseConnectPrivileges(adminPool, SURVEY_DB_NAME, [
    ADMIN_DB_USER,
    SURVEY_DB_CREDENTIALS.user
  ]);

  if (
    IDENTITY_DB_NAME !== SURVEY_DB_NAME
    && IDENTITY_DB_CREDENTIALS.user
    && SURVEY_DB_CREDENTIALS.user
    && IDENTITY_DB_CREDENTIALS.user !== SURVEY_DB_CREDENTIALS.user
  ) {
    await adminPool.query(
      `REVOKE CONNECT ON DATABASE ${quoteIdentifier(SURVEY_DB_NAME)} FROM ${quoteIdentifier(IDENTITY_DB_CREDENTIALS.user)}`
    );
    await adminPool.query(
      `REVOKE TEMP ON DATABASE ${quoteIdentifier(SURVEY_DB_NAME)} FROM ${quoteIdentifier(IDENTITY_DB_CREDENTIALS.user)}`
    );
    await adminPool.query(
      `REVOKE CONNECT ON DATABASE ${quoteIdentifier(IDENTITY_DB_NAME)} FROM ${quoteIdentifier(SURVEY_DB_CREDENTIALS.user)}`
    );
    await adminPool.query(
      `REVOKE TEMP ON DATABASE ${quoteIdentifier(IDENTITY_DB_NAME)} FROM ${quoteIdentifier(SURVEY_DB_CREDENTIALS.user)}`
    );
  }
}

async function grantRuntimeSchemaPrivileges(dbPool, roleName) {
  if (typeof roleName !== 'string' || !roleName.trim()) {
    return;
  }

  const roleIdentifier = quoteIdentifier(roleName.trim());

  await dbPool.query(`GRANT USAGE ON SCHEMA uniday_app TO ${roleIdentifier}`);
  await dbPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA uniday_app TO ${roleIdentifier}`);
  await dbPool.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA uniday_app TO ${roleIdentifier}`);
  await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA uniday_app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${roleIdentifier}`);
  await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA uniday_app GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${roleIdentifier}`);
}

async function ensureIdentitySchema() {
  await identityAdminPool.query('CREATE SCHEMA IF NOT EXISTS uniday_app');

  await identityAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      email_ciphertext TEXT,
      email_hash VARCHAR(64),
      email_key_version VARCHAR(32),
      hashed_password TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      verification_code VARCHAR(16),
      gender VARCHAR(16),
      target_gender VARCHAR(16),
      orientation VARCHAR(32),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await identityAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.user_respondent_links (
      user_id INTEGER PRIMARY KEY REFERENCES uniday_app.users(id) ON DELETE CASCADE,
      respondent_id_ciphertext TEXT NOT NULL,
      respondent_id_hash VARCHAR(64) UNIQUE NOT NULL,
      respondent_id_key_version VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await identityAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.access_audit_logs (
      id SERIAL PRIMARY KEY,
      actor VARCHAR(128) NOT NULL,
      action VARCHAR(128) NOT NULL,
      target_type VARCHAR(128) NOT NULL,
      target_ref VARCHAR(255),
      purpose TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS email_ciphertext TEXT');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64)');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS email_key_version VARCHAR(32)');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS gender VARCHAR(16)');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS target_gender VARCHAR(16)');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS orientation VARCHAR(32)');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE');
  await identityAdminPool.query('ALTER TABLE uniday_app.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  await identityAdminPool.query('ALTER TABLE uniday_app.users ALTER COLUMN email DROP NOT NULL');
  await identityAdminPool.query(
    `
    UPDATE uniday_app.users
    SET hashed_password = $1
    WHERE is_active = FALSE
      AND COALESCE(BTRIM(hashed_password), '') = ''
    `,
    [INACTIVE_PASSWORD_PLACEHOLDER_HASH]
  );

  await identityAdminPool.query(`
    UPDATE uniday_app.users
    SET target_gender = CASE
      WHEN orientation = 'prefer_male' THEN 'male'
      WHEN orientation = 'prefer_female' THEN 'female'
      ELSE target_gender
    END
    WHERE target_gender IS NULL
  `);

  await identityAdminPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash_unique
    ON uniday_app.users(email_hash)
    WHERE email_hash IS NOT NULL
  `);
  await identityAdminPool.query('CREATE INDEX IF NOT EXISTS idx_users_is_active ON uniday_app.users(is_active)');
  await identityAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_respondent_links_hash ON uniday_app.user_respondent_links(respondent_id_hash)');
  await identityAdminPool.query('CREATE INDEX IF NOT EXISTS idx_access_audit_logs_created_at ON uniday_app.access_audit_logs(created_at DESC)');

  await grantRuntimeSchemaPrivileges(identityAdminPool, IDENTITY_DB_CREDENTIALS.user);
}

async function ensureSurveySchema() {
  await surveyAdminPool.query('CREATE SCHEMA IF NOT EXISTS uniday_app');

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.survey_responses (
      id SERIAL PRIMARY KEY,
      respondent_id VARCHAR(64) UNIQUE NOT NULL,
      answers JSONB NOT NULL,
      rose_code VARCHAR(8),
      rose_name VARCHAR(128),
      dimension_scores JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.match_runs (
      id SERIAL PRIMARY KEY,
      run_type VARCHAR(20) NOT NULL,
      run_key VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL,
      initiated_by VARCHAR(64) NOT NULL DEFAULT 'system',
      candidate_count INTEGER NOT NULL DEFAULT 0,
      pair_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.match_results (
      id SERIAL PRIMARY KEY,
      run_id INTEGER REFERENCES uniday_app.match_runs(id),
      respondent1_id VARCHAR(64),
      respondent2_id VARCHAR(64),
      base_match_percent NUMERIC(5,1) NOT NULL DEFAULT 0,
      complementary_bonus NUMERIC(5,1) NOT NULL DEFAULT 0,
      final_match_percent NUMERIC(5,1) NOT NULL DEFAULT 0,
      user1_rose_code VARCHAR(8),
      user2_rose_code VARCHAR(8),
      killer_point TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.survey_questions (
      id SERIAL PRIMARY KEY,
      question_number INTEGER UNIQUE NOT NULL,
      section_title VARCHAR(128) NOT NULL,
      question_text TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.rose_type_interpretations (
      id SERIAL PRIMARY KEY,
      rose_code VARCHAR(8) UNIQUE NOT NULL,
      rose_name VARCHAR(128) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      markdown_content TEXT NOT NULL,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.site_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(64) UNIQUE NOT NULL,
      setting_value_json JSONB NOT NULL,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query(`
    CREATE TABLE IF NOT EXISTS uniday_app.site_assets (
      id SERIAL PRIMARY KEY,
      asset_key VARCHAR(64) UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      mime_type VARCHAR(128) NOT NULL,
      file_size INTEGER NOT NULL,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_responses ADD COLUMN IF NOT EXISTS respondent_id VARCHAR(64)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_responses ADD COLUMN IF NOT EXISTS rose_code VARCHAR(8)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_responses ADD COLUMN IF NOT EXISTS rose_name VARCHAR(128)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_responses ADD COLUMN IF NOT EXISTS dimension_scores JSONB');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS run_id INTEGER REFERENCES uniday_app.match_runs(id)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS respondent1_id VARCHAR(64)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS respondent2_id VARCHAR(64)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS base_match_percent NUMERIC(5,1) NOT NULL DEFAULT 0');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS complementary_bonus NUMERIC(5,1) NOT NULL DEFAULT 0');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS final_match_percent NUMERIC(5,1) NOT NULL DEFAULT 0');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS user1_rose_code VARCHAR(8)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS user2_rose_code VARCHAR(8)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.match_results ADD COLUMN IF NOT EXISTS killer_point TEXT');

  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS rose_name VARCHAR(128)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE');
  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS markdown_content TEXT');
  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS updated_by INTEGER');
  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await surveyAdminPool.query('ALTER TABLE uniday_app.rose_type_interpretations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await surveyAdminPool.query(`
    UPDATE uniday_app.rose_type_interpretations
    SET updated_at = COALESCE(updated_at, NOW())
    WHERE updated_at IS NULL
  `);

  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS section_title VARCHAR(128)');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS question_text TEXT');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS display_order INTEGER');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS updated_by INTEGER');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await surveyAdminPool.query('ALTER TABLE uniday_app.survey_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await surveyAdminPool.query(`
    UPDATE uniday_app.survey_questions
    SET display_order = COALESCE(display_order, question_number),
        section_title = COALESCE(section_title, '未分组'),
        question_text = COALESCE(question_text, '')
  `);

  await surveyAdminPool.query(`
    UPDATE uniday_app.survey_responses
    SET respondent_id = COALESCE(respondent_id, CONCAT('legacy-', id))
    WHERE respondent_id IS NULL
  `);

  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_respondent_id ON uniday_app.survey_responses(respondent_id)');
  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_match_runs_run_key ON uniday_app.match_runs(run_key)');
  await surveyAdminPool.query('CREATE INDEX IF NOT EXISTS idx_match_results_run_id ON uniday_app.match_results(run_id)');
  await surveyAdminPool.query('CREATE INDEX IF NOT EXISTS idx_match_results_respondent1 ON uniday_app.match_results(respondent1_id)');
  await surveyAdminPool.query('CREATE INDEX IF NOT EXISTS idx_match_results_respondent2 ON uniday_app.match_results(respondent2_id)');
  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_rose_type_interpretations_code ON uniday_app.rose_type_interpretations(rose_code)');
  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_questions_number ON uniday_app.survey_questions(question_number)');
  await surveyAdminPool.query('CREATE INDEX IF NOT EXISTS idx_survey_questions_order ON uniday_app.survey_questions(display_order)');
  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_key ON uniday_app.site_settings(setting_key)');
  await surveyAdminPool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_site_assets_key ON uniday_app.site_assets(asset_key)');
  await surveyAdminPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_match_results_unique_pair_per_run
    ON uniday_app.match_results(
      run_id,
      LEAST(respondent1_id, respondent2_id),
      GREATEST(respondent1_id, respondent2_id)
    )
    WHERE respondent1_id IS NOT NULL AND respondent2_id IS NOT NULL
  `);

  await grantRuntimeSchemaPrivileges(surveyAdminPool, SURVEY_DB_CREDENTIALS.user);
}

async function seedSurveyData() {
  await seedInterpretationsIfEmpty(surveyAdminPool);
  await seedSurveyQuestionsIfEmpty(surveyAdminPool);
  await seedDefaultSiteSettings(surveyAdminPool);
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      assertPrivacyConfig();
      await ensureDatabasesExist();
      await ensureIdentitySchema();
      await ensureSurveySchema();
      await seedSurveyData();
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  return schemaPromise;
}

export {
  pool,
  identityPool,
  surveyPool
};
