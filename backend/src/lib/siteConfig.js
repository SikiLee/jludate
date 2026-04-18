import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeAllowedEmailDomains } from './request.js';

export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
export const DEFAULT_BRAND_NAME = 'JLUDate';
const FALLBACK_ALLOWED_EMAIL_DOMAINS = Object.freeze(['mails.jlu.edu.cn']);

function parseDefaultAllowedEmailDomains(rawValue) {
  if (typeof rawValue !== 'string') {
    return [...FALLBACK_ALLOWED_EMAIL_DOMAINS];
  }

  const text = rawValue.trim();
  if (!text) {
    return [...FALLBACK_ALLOWED_EMAIL_DOMAINS];
  }

  let candidateDomains = null;

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        candidateDomains = parsed;
      }
    } catch {
      // Fallback to delimiter split below.
    }
  }

  if (!candidateDomains) {
    candidateDomains = text
      .split(/[\n,，、;；\s]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const normalized = normalizeAllowedEmailDomains(candidateDomains);
  if (normalized.length > 0) {
    return normalized;
  }

  return [...FALLBACK_ALLOWED_EMAIL_DOMAINS];
}

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = Object.freeze(
  parseDefaultAllowedEmailDomains(process.env.DEFAULT_ALLOWED_EMAIL_DOMAINS)
);
export const DEFAULT_MATCH_SCHEDULE = Object.freeze({
  day_of_week: 5,
  hour: 20,
  minute: 0,
  timezone: SHANGHAI_TIME_ZONE
});
export const DEFAULT_FAQ_ITEMS = [
  {
    q: '使用流程是什么？',
    a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每{MATCH_REVEAL_AT}，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
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
    desc: '没有"左滑右滑"。每{MATCH_REVEAL_AT}统一揭晓，一周至多一次配对，让等待变得有意义。'
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
export const DEFAULT_HOME_METRICS_VISIBILITY = Object.freeze({
  registered_users: true,
  survey_completion_rate: true,
  matched_users: true
});
export const DEFAULT_EMAIL_TEMPLATES = Object.freeze({
  verification: Object.freeze({
    subject: '{{brand_name}} Registration Verification',
    body: '【{{brand_name}}】您的验证码是: {{code}}\n一次深度问卷，匹配一个和你最契合的人。欢迎加入校园专属配对平台！'
  }),
  match_result: Object.freeze({
    subject: '【{{brand_name}}】本期匹配结果通知',
    body: [
      '【{{brand_name}} 匹配结果通知】',
      '你的本期匹配结果已生成，请登录网站查看。',
      '查看入口：{{match_url}}',
      '派发时间：{{run_at}} ({{timezone}})'
    ].join('\n')
  }),
  exception_approved: Object.freeze({
    subject: '【{{brand_name}}】异常校园邮箱核验已通过',
    body: [
      '【{{brand_name}}】你的异常校园邮箱人工核验已通过。',
      '后续你仍使用校园邮箱登录；注册验证码与密码重置验证码将发送到该备用邮箱。',
      '如非本人操作，请尽快联系平台管理员。'
    ].join('\n')
  }),
  exception_rejected: Object.freeze({
    subject: '【{{brand_name}}】异常校园邮箱核验未通过',
    body: [
      '【{{brand_name}}】你的异常校园邮箱人工核验未通过。',
      '你的账号将被立即停用，并删除在平台内的所有关联内容。',
      '如有疑问，请联系平台管理员。'
    ].join('\n')
  })
});
export const DEFAULT_CROSS_SCHOOL_MATCHING_ENABLED = false;
export const SITE_SETTING_KEYS = {
  BRAND_NAME: 'brand_name',
  ALLOWED_EMAIL_DOMAINS: 'allowed_email_domains',
  MATCH_SCHEDULE: 'match_schedule',
  FAQ_ITEMS: 'faq_items',
  WHY_CHOOSE_US_ITEMS: 'why_choose_us_items',
  HOME_METRICS_VISIBILITY: 'home_metrics_visibility',
  EMAIL_TEMPLATES: 'email_templates',
  CROSS_SCHOOL_MATCHING_ENABLED: 'cross_school_matching_enabled'
};
export const SITE_ASSET_KEYS = {
  HOME_HERO_BACKGROUND: 'home_hero_background'
};

const MAX_BRAND_NAME_LENGTH = 64;
const MAX_EMAIL_SUBJECT_LENGTH = 200;
const MAX_EMAIL_BODY_LENGTH = 8000;
const IMAGE_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const WHY_CHOOSE_US_ICON_SET = new Set(['clock', 'target', 'shield', 'heart']);

function getShanghaiWallDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: SHANGHAI_TIME_ZONE }));
}

function formatMatchRevealLabel(schedule) {
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const day = Number.isInteger(schedule?.day_of_week) ? schedule.day_of_week : DEFAULT_MATCH_SCHEDULE.day_of_week;
  const hour = Number.isInteger(schedule?.hour) ? schedule.hour : DEFAULT_MATCH_SCHEDULE.hour;
  const minute = Number.isInteger(schedule?.minute) ? schedule.minute : DEFAULT_MATCH_SCHEDULE.minute;
  const dayLabel = weekdayNames[day] || '周五';
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return `${dayLabel} ${timeLabel}`;
}

function applyScheduleTokens(text, schedule) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/\{MATCH_REVEAL_AT\}/g, formatMatchRevealLabel(schedule));
}

function cloneDefaultMatchSchedule() {
  return {
    day_of_week: DEFAULT_MATCH_SCHEDULE.day_of_week,
    hour: DEFAULT_MATCH_SCHEDULE.hour,
    minute: DEFAULT_MATCH_SCHEDULE.minute,
    timezone: DEFAULT_MATCH_SCHEDULE.timezone
  };
}

function normalizeScheduleNumber(rawValue, min, max) {
  const number = Number(rawValue);
  if (!Number.isInteger(number)) {
    return null;
  }

  if (number < min || number > max) {
    return null;
  }

  return number;
}

export function normalizeMatchSchedule(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const dayOfWeek = normalizeScheduleNumber(rawValue.day_of_week, 0, 6);
  const hour = normalizeScheduleNumber(rawValue.hour, 0, 23);
  const minute = normalizeScheduleNumber(rawValue.minute, 0, 59);

  if (dayOfWeek === null || hour === null || minute === null) {
    return null;
  }

  return {
    day_of_week: dayOfWeek,
    hour,
    minute,
    timezone: SHANGHAI_TIME_ZONE
  };
}

export function getNextMatchTimeInShanghai(schedule, date = new Date()) {
  const normalizedSchedule = normalizeMatchSchedule(schedule) || cloneDefaultMatchSchedule();
  const shanghaiNow = getShanghaiWallDate(date);
  const target = new Date(shanghaiNow.getTime());

  const day = shanghaiNow.getDay();
  const daysUntil = (normalizedSchedule.day_of_week - day + 7) % 7;
  target.setDate(target.getDate() + daysUntil);
  target.setHours(normalizedSchedule.hour, normalizedSchedule.minute, 0, 0);

  if (daysUntil === 0 && shanghaiNow >= target) {
    target.setDate(target.getDate() + 7);
  }

  return target;
}

export function isMatchScheduleDueInShanghai(schedule, date = new Date()) {
  const normalizedSchedule = normalizeMatchSchedule(schedule) || cloneDefaultMatchSchedule();
  const shanghaiDate = getShanghaiWallDate(date);
  return (
    shanghaiDate.getDay() === normalizedSchedule.day_of_week
    && shanghaiDate.getHours() === normalizedSchedule.hour
    && shanghaiDate.getMinutes() === normalizedSchedule.minute
  );
}

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

    const q = normalizeLegacyMatchRevealText(typeof item.q === 'string' ? item.q.trim() : '');
    const a = normalizeLegacyMatchRevealText(typeof item.a === 'string' ? item.a.trim() : '');
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
    const title = normalizeLegacyMatchRevealText(typeof item.title === 'string' ? item.title.trim() : '');
    const desc = normalizeLegacyMatchRevealText(typeof item.desc === 'string' ? item.desc.trim() : '');
    if (!WHY_CHOOSE_US_ICON_SET.has(icon) || !title || !desc) {
      continue;
    }

    rows.push({ icon, title, desc });
  }

  return rows;
}

function normalizeLegacyMatchRevealText(text) {
  if (typeof text !== 'string' || !text) {
    return '';
  }
  let out = text;
  // Already tokenized.
  if (out.includes('{MATCH_REVEAL_AT}')) {
    return out;
  }
  // Canonical replacements for legacy hardcoded schedule phrases.
  const legacyPatterns = [
    /每周五晚八点/g,
    /周五晚八点/g,
    /每周五晚上八点/g,
    /周五晚上八点/g,
    /每周五\s*20:00/g,
    /周五\s*20:00/g,
    /每周五\s*20点/g,
    /周五\s*20点/g
  ];
  for (const re of legacyPatterns) {
    out = out.replace(re, '每{MATCH_REVEAL_AT}');
  }
  return out;
}

function normalizeHomeMetricsVisibility(rawValue, { strict = false } = {}) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return strict
      ? null
      : {
          registered_users: DEFAULT_HOME_METRICS_VISIBILITY.registered_users,
          survey_completion_rate: DEFAULT_HOME_METRICS_VISIBILITY.survey_completion_rate,
          matched_users: DEFAULT_HOME_METRICS_VISIBILITY.matched_users
        };
  }

  const registeredUsers = rawValue.registered_users;
  const surveyCompletionRate = rawValue.survey_completion_rate;
  const matchedUsers = rawValue.matched_users;

  if (
    strict
    && (
      typeof registeredUsers !== 'boolean'
      || typeof surveyCompletionRate !== 'boolean'
      || typeof matchedUsers !== 'boolean'
    )
  ) {
    return null;
  }

  return {
    registered_users: typeof registeredUsers === 'boolean'
      ? registeredUsers
      : DEFAULT_HOME_METRICS_VISIBILITY.registered_users,
    survey_completion_rate: typeof surveyCompletionRate === 'boolean'
      ? surveyCompletionRate
      : DEFAULT_HOME_METRICS_VISIBILITY.survey_completion_rate,
    matched_users: typeof matchedUsers === 'boolean'
      ? matchedUsers
      : DEFAULT_HOME_METRICS_VISIBILITY.matched_users
  };
}

function normalizeCrossSchoolMatchingEnabled(rawValue, { strict = false } = {}) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (strict) {
    return null;
  }

  return DEFAULT_CROSS_SCHOOL_MATCHING_ENABLED;
}

function cloneDefaultEmailTemplates() {
  return {
    verification: {
      subject: DEFAULT_EMAIL_TEMPLATES.verification.subject,
      body: DEFAULT_EMAIL_TEMPLATES.verification.body
    },
    match_result: {
      subject: DEFAULT_EMAIL_TEMPLATES.match_result.subject,
      body: DEFAULT_EMAIL_TEMPLATES.match_result.body
    },
    exception_approved: {
      subject: DEFAULT_EMAIL_TEMPLATES.exception_approved.subject,
      body: DEFAULT_EMAIL_TEMPLATES.exception_approved.body
    },
    exception_rejected: {
      subject: DEFAULT_EMAIL_TEMPLATES.exception_rejected.subject,
      body: DEFAULT_EMAIL_TEMPLATES.exception_rejected.body
    }
  };
}

function normalizeTemplateText(rawValue, maxLength) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const normalized = rawValue.replace(/\r\n/g, '\n').trim();
  if (!normalized || normalized.length > maxLength) {
    return '';
  }

  return normalized;
}

function normalizeEmailTemplates(rawValue, { strict = false } = {}) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return strict ? null : cloneDefaultEmailTemplates();
  }

  const verification = rawValue.verification && typeof rawValue.verification === 'object'
    ? rawValue.verification
    : {};
  const matchResult = rawValue.match_result && typeof rawValue.match_result === 'object'
    ? rawValue.match_result
    : {};
  const exceptionApproved = rawValue.exception_approved && typeof rawValue.exception_approved === 'object'
    ? rawValue.exception_approved
    : {};
  const exceptionRejected = rawValue.exception_rejected && typeof rawValue.exception_rejected === 'object'
    ? rawValue.exception_rejected
    : {};

  const verificationSubject = normalizeTemplateText(verification.subject, MAX_EMAIL_SUBJECT_LENGTH);
  const verificationBody = normalizeTemplateText(verification.body, MAX_EMAIL_BODY_LENGTH);
  const matchResultSubject = normalizeTemplateText(matchResult.subject, MAX_EMAIL_SUBJECT_LENGTH);
  const matchResultBody = normalizeTemplateText(matchResult.body, MAX_EMAIL_BODY_LENGTH);
  const exceptionApprovedSubject = normalizeTemplateText(exceptionApproved.subject, MAX_EMAIL_SUBJECT_LENGTH);
  const exceptionApprovedBody = normalizeTemplateText(exceptionApproved.body, MAX_EMAIL_BODY_LENGTH);
  const exceptionRejectedSubject = normalizeTemplateText(exceptionRejected.subject, MAX_EMAIL_SUBJECT_LENGTH);
  const exceptionRejectedBody = normalizeTemplateText(exceptionRejected.body, MAX_EMAIL_BODY_LENGTH);

  if (
    strict
    && (
      !verificationSubject
      || !verificationBody
      || !matchResultSubject
      || !matchResultBody
      || !exceptionApprovedSubject
      || !exceptionApprovedBody
      || !exceptionRejectedSubject
      || !exceptionRejectedBody
    )
  ) {
    return null;
  }

  return {
    verification: {
      subject: verificationSubject || DEFAULT_EMAIL_TEMPLATES.verification.subject,
      body: verificationBody || DEFAULT_EMAIL_TEMPLATES.verification.body
    },
    match_result: {
      subject: matchResultSubject || DEFAULT_EMAIL_TEMPLATES.match_result.subject,
      body: matchResultBody || DEFAULT_EMAIL_TEMPLATES.match_result.body
    },
    exception_approved: {
      subject: exceptionApprovedSubject || DEFAULT_EMAIL_TEMPLATES.exception_approved.subject,
      body: exceptionApprovedBody || DEFAULT_EMAIL_TEMPLATES.exception_approved.body
    },
    exception_rejected: {
      subject: exceptionRejectedSubject || DEFAULT_EMAIL_TEMPLATES.exception_rejected.subject,
      body: exceptionRejectedBody || DEFAULT_EMAIL_TEMPLATES.exception_rejected.body
    }
  };
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
    WHERE setting_key IN ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      SITE_SETTING_KEYS.BRAND_NAME,
      SITE_SETTING_KEYS.ALLOWED_EMAIL_DOMAINS,
      SITE_SETTING_KEYS.MATCH_SCHEDULE,
      SITE_SETTING_KEYS.FAQ_ITEMS,
      SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS,
      SITE_SETTING_KEYS.HOME_METRICS_VISIBILITY,
      SITE_SETTING_KEYS.EMAIL_TEMPLATES,
      SITE_SETTING_KEYS.CROSS_SCHOOL_MATCHING_ENABLED
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
  const matchScheduleRow = rowMap.get(SITE_SETTING_KEYS.MATCH_SCHEDULE);
  const faqRow = rowMap.get(SITE_SETTING_KEYS.FAQ_ITEMS);
  const whyChooseRow = rowMap.get(SITE_SETTING_KEYS.WHY_CHOOSE_US_ITEMS);
  const homeMetricsVisibilityRow = rowMap.get(SITE_SETTING_KEYS.HOME_METRICS_VISIBILITY);
  const emailTemplatesRow = rowMap.get(SITE_SETTING_KEYS.EMAIL_TEMPLATES);
  const crossSchoolMatchingRow = rowMap.get(SITE_SETTING_KEYS.CROSS_SCHOOL_MATCHING_ENABLED);

  const brandRaw = parseSettingValueJson(brandRow?.setting_value_json);
  const domainsRaw = parseSettingValueJson(domainsRow?.setting_value_json);
  const matchScheduleRaw = parseSettingValueJson(matchScheduleRow?.setting_value_json);
  const faqRaw = parseSettingValueJson(faqRow?.setting_value_json);
  const whyChooseRaw = parseSettingValueJson(whyChooseRow?.setting_value_json);
  const homeMetricsVisibilityRaw = parseSettingValueJson(homeMetricsVisibilityRow?.setting_value_json);
  const emailTemplatesRaw = parseSettingValueJson(emailTemplatesRow?.setting_value_json);
  const crossSchoolMatchingRaw = parseSettingValueJson(crossSchoolMatchingRow?.setting_value_json);

  const brandName = normalizeBrandName(brandRaw) || DEFAULT_BRAND_NAME;
  const allowedEmailDomains = normalizeAllowedDomainsOrDefault(domainsRaw);
  const matchSchedule = normalizeMatchSchedule(matchScheduleRaw) || cloneDefaultMatchSchedule();
  const faqItemsRaw = normalizeFaqItems(faqRaw);
  const whyChooseUsItemsRaw = normalizeWhyChooseUsItems(whyChooseRaw);
  const homeMetricsVisibility = normalizeHomeMetricsVisibility(homeMetricsVisibilityRaw);
  const emailTemplates = normalizeEmailTemplates(emailTemplatesRaw);
  const crossSchoolMatchingEnabled = normalizeCrossSchoolMatchingEnabled(crossSchoolMatchingRaw);

  const faqItems = (faqItemsRaw.length > 0 ? faqItemsRaw : [...DEFAULT_FAQ_ITEMS]).map((item) => ({
    q: applyScheduleTokens(item.q, matchSchedule),
    a: applyScheduleTokens(item.a, matchSchedule)
  }));
  const whyChooseUsItems = (whyChooseUsItemsRaw.length > 0 ? whyChooseUsItemsRaw : [...DEFAULT_WHY_CHOOSE_US_ITEMS]).map((item) => ({
    ...item,
    title: applyScheduleTokens(item.title, matchSchedule),
    desc: applyScheduleTokens(item.desc, matchSchedule)
  }));

  return {
    brand_name: brandName,
    allowed_email_domains: allowedEmailDomains,
    match_schedule: matchSchedule,
    faq_items: faqItems,
    why_choose_us_items: whyChooseUsItems,
    home_metrics_visibility: homeMetricsVisibility,
    email_templates: emailTemplates,
    cross_school_matching_enabled: crossSchoolMatchingEnabled,
    brand_updated_at: brandRow?.updated_at || null,
    domains_updated_at: domainsRow?.updated_at || null,
    match_schedule_updated_at: matchScheduleRow?.updated_at || null,
    faq_updated_at: faqRow?.updated_at || null,
    why_choose_us_updated_at: whyChooseRow?.updated_at || null,
    home_metrics_visibility_updated_at: homeMetricsVisibilityRow?.updated_at || null,
    email_templates_updated_at: emailTemplatesRow?.updated_at || null,
    cross_school_matching_updated_at: crossSchoolMatchingRow?.updated_at || null
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

  const hasMatchSchedule = payload && Object.prototype.hasOwnProperty.call(payload, 'match_schedule');
  const matchSchedule = normalizeMatchSchedule(payload?.match_schedule);
  if (hasMatchSchedule && !matchSchedule) {
    return {
      ok: false,
      msg: 'match_schedule is invalid (day_of_week:0-6, hour:0-23, minute:0-59)'
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

  const hasHomeMetricsVisibility = payload && Object.prototype.hasOwnProperty.call(payload, 'home_metrics_visibility');
  const homeMetricsVisibility = normalizeHomeMetricsVisibility(payload?.home_metrics_visibility, { strict: true });
  if (hasHomeMetricsVisibility && !homeMetricsVisibility) {
    return {
      ok: false,
      msg: 'home_metrics_visibility is invalid (registered_users/survey_completion_rate/matched_users must be boolean)'
    };
  }

  const hasEmailTemplates = payload && Object.prototype.hasOwnProperty.call(payload, 'email_templates');
  const emailTemplates = normalizeEmailTemplates(payload?.email_templates, { strict: true });
  if (hasEmailTemplates && !emailTemplates) {
    return {
      ok: false,
      msg: `email_templates is invalid (subject 1-${MAX_EMAIL_SUBJECT_LENGTH} chars; body 1-${MAX_EMAIL_BODY_LENGTH} chars)`
    };
  }

  const hasCrossSchoolMatchingEnabled = payload && Object.prototype.hasOwnProperty.call(payload, 'cross_school_matching_enabled');
  const crossSchoolMatchingEnabled = normalizeCrossSchoolMatchingEnabled(payload?.cross_school_matching_enabled, { strict: true });
  if (hasCrossSchoolMatchingEnabled && crossSchoolMatchingEnabled === null) {
    return {
      ok: false,
      msg: 'cross_school_matching_enabled must be boolean'
    };
  }

  return {
    ok: true,
    data: {
      brand_name: brandName,
      allowed_email_domains: allowedDomains,
      match_schedule: hasMatchSchedule ? matchSchedule : null,
      faq_items: faqItems,
      why_choose_us_items: whyChooseUsItems,
      home_metrics_visibility: hasHomeMetricsVisibility ? homeMetricsVisibility : null,
      email_templates: hasEmailTemplates ? emailTemplates : null,
      cross_school_matching_enabled: hasCrossSchoolMatchingEnabled ? crossSchoolMatchingEnabled : null
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
    [SITE_SETTING_KEYS.MATCH_SCHEDULE, JSON.stringify(DEFAULT_MATCH_SCHEDULE)]
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

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.HOME_METRICS_VISIBILITY, JSON.stringify(DEFAULT_HOME_METRICS_VISIBILITY)]
  );

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.EMAIL_TEMPLATES, JSON.stringify(DEFAULT_EMAIL_TEMPLATES)]
  );

  await db.query(
    `
    INSERT INTO unidate_app.site_settings(setting_key, setting_value_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (setting_key) DO NOTHING
    `,
    [SITE_SETTING_KEYS.CROSS_SCHOOL_MATCHING_ENABLED, JSON.stringify(DEFAULT_CROSS_SCHOOL_MATCHING_ENABLED)]
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
    match_schedule: settings.match_schedule,
    faq_items: settings.faq_items,
    why_choose_us_items: settings.why_choose_us_items,
    home_metrics_visibility: settings.home_metrics_visibility,
    cross_school_matching_enabled: settings.cross_school_matching_enabled,
    home_hero_background_url: asset ? buildHomeHeroBackgroundUrl(asset.updated_at) : null,
    updated_at: computeLatestUpdatedAt(
      settings.brand_updated_at,
      settings.domains_updated_at,
      settings.match_schedule_updated_at,
      settings.faq_updated_at,
      settings.why_choose_us_updated_at,
      settings.home_metrics_visibility_updated_at,
      settings.email_templates_updated_at,
      settings.cross_school_matching_updated_at,
      asset?.updated_at
    )
  };
}

export async function getMatchScheduleSettings(db) {
  const settings = await readCoreSiteSettings(db);
  return settings.match_schedule;
}

export async function getHomeMetricsVisibilitySettings(db) {
  const settings = await readCoreSiteSettings(db);
  return settings.home_metrics_visibility;
}

export async function getEmailTemplates(db) {
  const settings = await readCoreSiteSettings(db);
  return settings.email_templates;
}

export async function getCrossSchoolMatchingEnabled(db) {
  const settings = await readCoreSiteSettings(db);
  return Boolean(settings.cross_school_matching_enabled);
}

export async function getAdminSiteSettings(db) {
  const publicSettings = await getPublicSiteSettings(db);
  const asset = await getHomeHeroAssetRow(db);
  const settings = await readCoreSiteSettings(db);

  return {
    ...publicSettings,
    email_templates: settings.email_templates,
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
  const effectiveMatchSchedule = validation.data.match_schedule || await getMatchScheduleSettings(db);
  const effectiveHomeMetricsVisibility = validation.data.home_metrics_visibility || await getHomeMetricsVisibilitySettings(db);
  const effectiveEmailTemplates = validation.data.email_templates || await getEmailTemplates(db);
  const effectiveCrossSchoolMatchingEnabled = validation.data.cross_school_matching_enabled === null
    ? await getCrossSchoolMatchingEnabled(db)
    : validation.data.cross_school_matching_enabled;

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
      SITE_SETTING_KEYS.MATCH_SCHEDULE,
      effectiveMatchSchedule,
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
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.HOME_METRICS_VISIBILITY,
      effectiveHomeMetricsVisibility,
      updatedBy
    );
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.EMAIL_TEMPLATES,
      effectiveEmailTemplates,
      updatedBy
    );
    await upsertSiteSetting(
      executor,
      SITE_SETTING_KEYS.CROSS_SCHOOL_MATCHING_ENABLED,
      effectiveCrossSchoolMatchingEnabled,
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
