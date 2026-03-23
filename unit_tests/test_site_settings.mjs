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
  assert.equal(normalizeEmailDomain('szu.edu.cn'), 'szu.edu.cn');
  assert.equal(normalizeEmailDomain('bad_domain'), '');
  assert.equal(normalizeEmailDomain('bad..edu.cn'), '');
});

test('normalizeAllowedEmailDomains dedupes and filters invalid domains', () => {
  const result = normalizeAllowedEmailDomains(['@szu.edu.cn', 'THU.edu.cn', 'thu.edu.cn', 'bad_domain']);
  assert.deepEqual(result, ['szu.edu.cn', 'thu.edu.cn']);
});

test('isAllowedSchoolEmail validates against white list', () => {
  const domains = ['szu.edu.cn', 'thu.edu.cn'];
  assert.equal(isAllowedSchoolEmail('user@szu.edu.cn', domains), true);
  assert.equal(isAllowedSchoolEmail('USER@THU.EDU.CN', domains), true);
  assert.equal(isAllowedSchoolEmail('user@gmail.com', domains), false);
  assert.equal(isAllowedSchoolEmail('not-an-email', domains), false);
});

test('validateSiteSettingsPayload requires valid brand and domain list', () => {
  const ok = validateSiteSettingsPayload({
    brand_name: 'THUDate',
    allowed_email_domains: ['thu.edu.cn', '@szu.edu.cn'],
    why_choose_us_items: [
      { icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }
    ],
    faq_items: [
      { q: '问题1', a: '答案1' }
    ]
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data.allowed_email_domains, ['thu.edu.cn', 'szu.edu.cn']);
  assert.deepEqual(ok.data.why_choose_us_items, [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }]);
  assert.deepEqual(ok.data.faq_items, [{ q: '问题1', a: '答案1' }]);

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
    why_choose_us_items: [{ icon: 'clock', title: '每周一次', desc: '每周揭晓一次' }],
    faq_items: [{ q: '问题1', a: '答案1' }]
  });
  assert.equal(badDomains.ok, false);

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
  assert.equal(badSize.ok, false);
});
