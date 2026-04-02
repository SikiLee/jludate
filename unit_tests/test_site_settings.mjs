import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAllowedSchoolEmail,
  normalizeAllowedEmailDomains,
  normalizeEmailDomain
} from '../backend/src/lib/request.js';
import { validateBackgroundUploadFile, validateSiteSettingsPayload } from '../backend/src/lib/siteConfig.js';

test('normalizeEmailDomain handles casing, @ prefix and invalid values', () => {
  assert.equal(normalizeEmailDomain('@THU.edu.cn'), 'thu.edu.cn');
  assert.equal(normalizeEmailDomain('mails.jlu.edu.cn'), 'mails.jlu.edu.cn');
  assert.equal(normalizeEmailDomain('bad_domain'), '');
  assert.equal(normalizeEmailDomain('bad..edu.cn'), '');
});

test('normalizeAllowedEmailDomains dedupes and filters invalid domains', () => {
  const result = normalizeAllowedEmailDomains(['@mails.jlu.edu.cn', 'THU.edu.cn', 'thu.edu.cn', '*.edu.cn', '*.EDU.cn', 'bad_domain']);
  assert.deepEqual(result, ['mails.jlu.edu.cn', 'thu.edu.cn', '*.edu.cn']);
});

test('isAllowedSchoolEmail validates against white list', () => {
  const domains = ['mails.jlu.edu.cn', 'thu.edu.cn', '*.edu.cn'];
  assert.equal(isAllowedSchoolEmail('user@mails.jlu.edu.cn', domains), true);
  assert.equal(isAllowedSchoolEmail('USER@THU.EDU.CN', domains), true);
  assert.equal(isAllowedSchoolEmail('alice@email.mails.jlu.edu.cn', domains), true);
  assert.equal(isAllowedSchoolEmail('user@gmail.com', domains), false);
  assert.equal(isAllowedSchoolEmail('not-an-email', domains), false);
});

test('validateSiteSettingsPayload requires valid brand and domain list', () => {
  const ok = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn', '@mails.jlu.edu.cn'],
    match_schedule: { day_of_week: 3, hour: 20, minute: 30 },
    email_templates: {
      verification: {
        subject: '【{{brand_name}}】验证码',
        body: '验证码：{{code}}'
      },
      match_result: {
        subject: '【{{brand_name}}】匹配结果',
        body: '对方：{{partner_email}}，匹配度：{{match_percent}}%'
      }
    },
    cross_school_matching_enabled: true,
    why_choose_us_items: [
      { icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }
    ],
    faq_items: [
      { q: '问题1', a: '答案1' }
    ]
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data.allowed_email_domains, ['thu.edu.cn', 'mails.jlu.edu.cn']);
  assert.deepEqual(ok.data.match_schedule, { day_of_week: 3, hour: 20, minute: 30, timezone: 'Asia/Shanghai' });
  assert.equal(ok.data.cross_school_matching_enabled, true);
  assert.deepEqual(ok.data.why_choose_us_items, [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }]);
  assert.deepEqual(ok.data.faq_items, [{ q: '问题1', a: '答案1' }]);
  assert.equal(ok.data.email_templates.verification.subject, '【{{brand_name}}】验证码');
  assert.equal(ok.data.email_templates.match_result.body, '对方：{{partner_email}}，匹配度：{{match_percent}}%');

  const badBrand = validateSiteSettingsPayload({
    brand_name: '',
    allowed_email_domains: ['thu.edu.cn'],
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badBrand.ok, false);

  const badDomains = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: [],
    match_schedule: { day_of_week: 2, hour: 21, minute: 0 },
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badDomains.ok, false);

  const badMatchSchedule = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn'],
    match_schedule: { day_of_week: 9, hour: 21, minute: 0 },
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badMatchSchedule.ok, false);

  const badWhyChoose = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn'],
    why_choose_us_items: [{ icon: 'bad-icon', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badWhyChoose.ok, false);

  const badFaqItems = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn'],
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '', a: '答案1' }]
  });
  assert.equal(badFaqItems.ok, false);

  const badCrossSchool = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn'],
    cross_school_matching_enabled: 'yes',
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badCrossSchool.ok, false);

  const badEmailTemplates = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn'],
    email_templates: {
      verification: { subject: '', body: '验证码：{{code}}' },
      match_result: { subject: '匹配结果', body: '内容' }
    },
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badEmailTemplates.ok, false);
});

test('validateBackgroundUploadFile enforces type and size', () => {
  const ok = validateBackgroundUploadFile({
    type: 'image/png',
    size: 1024,
    arrayBuffer: async () => new ArrayBuffer(0)
  });
  assert.equal(ok.ok, true);

  const badType = validateBackgroundUploadFile({
    type: 'text/plain',
    size: 1024,
    arrayBuffer: async () => new ArrayBuffer(0)
  });
  assert.equal(badType.ok, false);

  const badSize = validateBackgroundUploadFile({
    type: 'image/png',
    size: 6 * 1024 * 1024,
    arrayBuffer: async () => new ArrayBuffer(0)
  });
  assert.equal(badSize.ok, true);
});
