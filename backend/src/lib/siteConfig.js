import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeAllowedEmailDomains } from './request.js';

export const DEFAULT_BRAND_NAME = 'unidate';
export const DEFAULT_ALLOWED_EMAIL_DOMAINS = ['szu.edu.cn'];
export const DEFAULT_FAQ_ITEMS = [
  {
    q: '使用流程是什么？',
    a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每周二晚九点，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
  },
  {
    q: '你们如何处理我的数据？',
    a: '我们绝不出售您的数据。您的问卷答案仅用于匹配，且在数据库中以随机 ID 存储，与您的邮箱地址分开保存。即使是维护团队，也无法直接将两者关联起来。详见隐私协议。'
  },
  {
    q: '{XXDate} 的使用规范是什么？',
    a: '彼此真诚，互相尊重。'
  },
  {
    q: '配对算法是如何工作的？',
    a: '我们的配对系统基于独创的 ROSE 亲密关系模型，深度融合行为心理学、核心价值观契合度以及人际边界理论。核心逻辑是“底线一致，特质互补”：在原则和三观上寻找同频，在性格与沟通方式上捕捉能产生化学反应的良性差异。'
  }
];
export const DEFAULT_WHY_CHOOSE_US_ITEMS = [
  {
    icon: 'clock',
    title: '每周一次',
    desc: '没有"左滑右滑"。每周二晚九点统一揭晓，一周至多一次配对，让等待变得有意义。'
  },
  {
    icon: 'target',
    title: '精准匹配',
    desc: '基于价值观、情感风格等深度研究与科学算法，不只看相似，也捕捉互补的差异。'
  },
  {
    icon: 'shield',
    title: '隐私优先',
    desc: '{XXDate} 不是公开的社交平台。没有任何主页浏览，任何人除每周收到匹配外，只能看到与自己有关的信息。'
  },
  {
    icon: 'heart',
    title: '校园认证',
    desc: '仅支持 {ALLOWED_DOMAINS} 邮箱注册。封闭纯粹的校园环境，让相认更加真实可靠。'
  }
];
export const SITE_SETTING_KEYS = {
  BRAND_NAME: 'brand_name',
  ALLOWED_EMAIL_DOMAINS: 'allowed_email_domains',
  FAQ_ITEMS: 'faq_items',
  WHY_CHOOSE_US_ITEMS: 'why_choose_us_items'
};
export const SITE_ASSET_KEYS = {
  HOME_HERO_BACKGROUND: 'home_hero_background'
};

const MAX_BRAND_NAME_LENGTH = 64;
const MAX_BACKGROUND_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const WHY_CHOOSE_US_ICON_SET = new Set(['clock', 'target', 'shield', 'heart']);

function normalizeBrandName(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim();
  if (!value) {
    return '';
  }

  if (value.length > MAX_BRAND_NAME_LENGTH) {
    return '';
  }

  return value;
}

function parseSettingValueJson(value) {
  // pg usually parses JSONB automatically. A JSON string value like
  // `"THUDate"` is returned as plain JS string `THUDate`, which should
  // be treated as final value instead of being parsed again.
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  return value;
}

function normalizeAllowedDomainsOrDefault(rawValue) {
  const normalized = normalizeAllowedEmailDomains(rawValue);
  if (normalized.length > 0) {
    return normalized;
  }
  return [...DEFAULT_ALLOWED_EMAIL_DOMAINS];
}

function normalizeFaqItems(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const rows = [];
  for (const item of rawValue) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const q = typeof item.q === 'string' ? item.q.trim() : '';
    const a = typeof item.a === 'string' ? item.a.trim() : '';
    if (!q || !a) {
      continue;
    }

    rows.push({ q, a });
  }

  return rows;
}

function normalizeWhyChooseUsItems(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const rows = [];
  for (const item of rawValue) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const icon = typeof item.icon === 'string' ? item.icon.trim().toLowerCase() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const desc = typeof item.desc === 'string' ? item.desc.trim() : '';
    if (!WHY_CHOOSE_US_ICON_SET.has(icon) || !title || !desc) {
      continue;
    }

    rows.push({ icon, title, desc });
  }

  return rows;
}

function resolveSiteAssetsDir() {
  const configured = process.env.SITE_ASSETS_DIR;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim();
  }
  return path.join(process.cwd(), 'storage', 'site-assets');
}

async function ensureSiteAssetsDir() {
  await fs.mkdir(resolveSiteAssetsDir(), { recursive: true });
}

function safeAssetPath(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  const basename = path.basename(fileName.trim());
  if (basename !== fileName.trim()) {
    return null;
  }

  return path.join(resolveSiteAssetsDir(), basename);
}

function buildHomeHeroBackgroundUrl(updatedAt) {
  if (!updatedAt) {
    return null;
  }

  const epoch = new Date(updatedAt).getTime();
  const version = Number.isFinite(epoch) ? epoch : Date.now();
  return `/api/public/site-assets/home-hero-background?v=${version}`;
}

async function withOptionalTransaction(db, fn) {
  if (typeof db.connect !== 'function') {
    return fn(db);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function upsertSiteSetting(db, settingKey, settingValue, updatedBy = null) {
  await db.query(
    `
    INSERT INTO unidate_app.site_settings(
      setting_key,
      setting_value_json,
      updated_by
    )
    VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value_json = EXCLUDED.setting_value_json,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    `,
    [settingKey, JSON.stringify(settingValue), updatedBy]
  );
}

async function getSiteSettingRows(db) {
  const result = await db.query(
    `
    SELECT setting_key, setting_value_json, updated_at
    FROM unidate_app.site_settings
    WHERE setting_key IN ($1, $2, $3, $4)
    `,
    [
      SITE_SETTING_KEYS.BRAND_NAME,
      SITE_SETTING_KEYS.ALLOWED_EMAIL_DOMAINS,
      SITE_SETTING_KEYS.FAQ_ITEMS,
      SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS
    ]
  );

  return result.rows;
}

function computeLatestUpdatedAt(...values) {
  let latest = null;
  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) {
      continue;
    }

    if (latest === null || timestamp > latest) {
      latest = timestamp;
    }
  }

  return latest === null ? null : new Date(latest).toISOString();
}

async function readCoreSiteSettings(db) {
  const rows = await getSiteSettingRows(db);
  const rowMap = new Map(rows.map((row) => [row.setting_key, row]));

  const brandRow = rowMap.get(SITE_SETTING_KEYS.BRAND_NAME);
  const domainsRow = rowMap.get(SITE_SETTING_KEYS.ALLOWED_EMAIL_DOMAINS);
  const faqRow = rowMap.get(SITE_SETTING_KEYS.FAQ_ITEMS);
  const whyChooseRow = rowMap.get(SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS);

  const brandRaw = parseSettingValueJson(brandRow?.setting_value_json);
  const domainsRaw = parseSettingValueJson(domainsRow?.setting_value_json);
  const faqRaw = parseSettingValueJson(faqRow?.setting_value_json);
  const whyChooseRaw = parseSettingValueJson(whyChooseRow?.setting_value_json);

  const brandName = normalizeBrandName(brandRaw) || DEFAULT_BRAND_NAME;
  const allowedEmailDomains = normalizeAllowedDomainsOrDefault(domainsRaw);
  const faqItems = normalizeFaqItems(faqRaw);
  const whyChooseUsItems = normalizeWhyChooseUsItems(whyChooseRaw);

  return {
    brand_name: brandName,
    allowed_email_domains: allowedEmailDomains,
    faq_items: faqItems.length > 0 ? faqItems : [...DEFAULT_FAQ_ITEMS],
    why_choose_us_items: whyChooseUsItems.length > 0 ? whyChooseUsItems : [...DEFAULT_WHY_CHOOSE_US_ITEMS],
    brand_updated_at: brandRow?.updated_at || null,
    domains_updated_at: domainsRow?.updated_at || null,
    faq_updated_at: faqRow?.updated_at || null,
    why_choose_us_updated_at: whyChooseRow?.updated_at || null
  };
}

async function getHomeHeroAssetRow(db) {
  const result = await db.query(
    `
    SELECT
      asset_key,
      file_name,
      mime_type,
      file_size,
      updated_at,
      updated_by
    FROM unidate_app.site_assets
    WHERE asset_key = $1
    LIMIT 1
    `,
    [SITE_ASSET_KEYS.HOME_HERO_BACKGROUND]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export function validateSiteSettingsPayload(payload) {
  const brandName = normalizeBrandName(payload?.brand_name);
  if (!brandName) {
    return {
      ok: false,
      msg: `brand_name is required (1-${MAX_BRAND_NAME_LENGTH} chars)`
    };
  }

  const allowedDomains = normalizeAllowedEmailDomains(payload?.allowed_email_domains);
  if (allowedDomains.length === 0) {
    return {
      ok: false,
      msg: 'allowed_email_domains must include at least 1 valid domain'
    };
  }

  const faqItems = normalizeFaqItems(payload?.faq_items);
  if (faqItems.length === 0) {
    return {
      ok: false,
      msg: 'faq_items must include at least 1 valid FAQ item'
    };
  }

  const whyChooseUsItems = normalizeWhyChooseUsItems(payload?.why_choose_us_items);
  if (whyChooseUsItems.length === 0) {
    return {
      ok: false,
      msg: 'why_choose_us_items must include at least 1 valid item'
    };
  }

  return {
    ok: true,
    data: {
      brand_name: brandName,
      allowed_email_domains: allowedDomains,
      faq_items: faqItems,
      why_choose_us_items: whyChooseUsItems
    }
  };
}

export function validateBackgroundUploadFile(file) {
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    return { ok: false, msg: 'file is required' };
  }

  if (!IMAGE_MIME_TO_EXT[file.type]) {
    return { ok: false, msg: 'Only jpg/png/webp images are allowed' };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, msg: 'Invalid file size' };
  }

  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    return { ok: false, msg: 'Image size must be <= 5MB' };
  }

  return {
    ok: true,
    data: {
      extension: IMAGE_MIME_TO_EXT[file.type],
      mime_type: file.type,
      size: file.size
    }
  };
}

export async function seedDefaultSiteSettings(db) {
  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.BRAND_NAME, JSON.stringify(DEFAULT_BRAND_NAME)]
  );

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.ALLOWED_EMAIL_DOMAINS, JSON.stringify(DEFAULT_ALLOWED_EMAIL_DOMAINS)]
  );

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.FAQ_ITEMS, JSON.stringify(DEFAULT_FAQ_ITEMS)]
  );

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS, JSON.stringify(DEFAULT_WHY_CHOOSE_US_ITEMS)]
  );
}

export async function getSiteBrandName(db) {
  const settings = await readCoreSiteSettings(db);
  return settings.brand_name;
}

export async function getAllowedEmailDomains(db) {
  const settings = await readCoreSiteSettings(db);
  return settings.allowed_email_domains;
}

export async function getPublicSiteSettings(db) {
  const settings = await readCoreSiteSettings(db);
  const asset = await getHomeHeroAssetRow(db);

  return {
    brand_name: settings.brand_name,
    allowed_email_domains: settings.allowed_email_domains,
    faq_items: settings.faq_items,
    why_choose_us_items: settings.why_choose_us_items,
    home_hero_background_url: asset ? buildHomeHeroBackgroundUrl(asset.updated_at) : null,
    updated_at: computeLatestUpdatedAt(
      settings.brand_updated_at,
      settings.domains_updated_at,
      settings.faq_updated_at,
      settings.why_choose_us_updated_at,
      asset?.updated_at
    )
  };
}

export async function getAdminSiteSettings(db) {
  const publicSettings = await getPublicSiteSettings(db);
  const asset = await getHomeHeroAssetRow(db);

  return {
    ...publicSettings,
    home_hero_background: asset
      ? {
          file_name: asset.file_name,
          mime_type: asset.mime_type,
          file_size: asset.file_size,
          updated_at: asset.updated_at,
          updated_by: asset.updated_by
        }
      : null
  };
}

export async function updateSiteSettings(db, payload, updatedBy = null) {
  const validation = validateSiteSettingsPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  await withOptionalTransaction(db, async (executor) => {
    await upsertSiteSetting(executor, SITE_SETTING_KEYS.BRAND_NAME, validation.data.brand_name, updatedBy);
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.ALLOWED_EMAIL_DOMAINS,
      validation.data.allowed_email_domains,
      updatedBy
    );
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.FAQ_ITEMS,
      validation.data.faq_items,
      updatedBy
    );
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS,
      validation.data.why_choose_us_items,
      updatedBy
    );
  });

  const data = await getAdminSiteSettings(db);
  return { ok: true, data };
}

export async function saveHomeHeroBackground(db, file, updatedBy = null) {
  const validation = validateBackgroundUploadFile(file);
  if (!validation.ok) {
    return validation;
  }

  await ensureSiteAssetsDir();

  const { extension, mime_type: mimeType, size: fileSize } = validation.data;
  const newFileName = `${SITE_ASSET_KEYS.HOME_HERO_BACKGROUND}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  const newFilePath = path.join(resolveSiteAssetsDir(), newFileName);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(newFilePath, fileBuffer);

  let previousFileName = null;

  try {
    await withOptionalTransaction(db, async (executor) => {
      const previousResult = await executor.query(
        `
        SELECT file_name
        FROM unidate_app.site_assets
        WHERE asset_key = $1
        LIMIT 1
        `,
        [SITE_ASSET_KEYS.HOME_HERO_BACKGROUND]
      );

      previousFileName = previousResult.rows[0]?.file_name || null;

      await executor.query(
        `
        INSERT INTO unidate_app.site_assets(
          asset_key,
          file_name,
          mime_type,
          file_size,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (asset_key)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          mime_type = EXCLUDED.mime_type,
          file_size = EXCLUDED.file_size,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        `,
        [SITE_ASSET_KEYS.HOME_HERO_BACKGROUND, newFileName, mimeType, fileSize, updatedBy]
      );
    });
  } catch (error) {
    await fs.unlink(newFilePath).catch(() => null);
    throw error;
  }

  if (previousFileName && previousFileName !== newFileName) {
    const previousPath = safeAssetPath(previousFileName);
    if (previousPath) {
      await fs.unlink(previousPath).catch(() => null);
    }
  }

  const data = await getAdminSiteSettings(db);
  return { ok: true, data };
}

export async function removeHomeHeroBackground(db) {
  const existing = await getHomeHeroAssetRow(db);
  if (!existing) {
    return { ok: true, data: await getAdminSiteSettings(db) };
  }

  await db.query('DELETE FROM unidate_app.site_assets WHERE asset_key = $1', [SITE_ASSET_KEYS.HOME_HERO_BACKGROUND]);

  const existingPath = safeAssetPath(existing.file_name);
  if (existingPath) {
    await fs.unlink(existingPath).catch(() => null);
  }

  return { ok: true, data: await getAdminSiteSettings(db) };
}

export async function readHomeHeroBackgroundBinary(db) {
  const asset = await getHomeHeroAssetRow(db);
  if (!asset) {
    return null;
  }

  const assetPath = safeAssetPath(asset.file_name);
  if (!assetPath) {
    return null;
  }

  try {
    const content = await fs.readFile(assetPath);
    return {
      content,
      mime_type: asset.mime_type,
      updated_at: asset.updated_at
    };
  } catch {
    return null;
  }
}
