import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {
  extractSummaryFromMarkdown,
  parseTypeMarkdownDocument
} from '../backend/src/lib/typeInterpretation.js';

const TYPE_MD_PATH = new URL('../backend/src/content/Type.md', import.meta.url);

test('Type.md can be parsed into 16 ROSE type sections', async () => {
  const markdown = await fs.readFile(TYPE_MD_PATH, 'utf8');
  const sections = parseTypeMarkdownDocument(markdown);

  assert.equal(sections.length, 16);
  const codes = new Set(sections.map((section) => section.rose_code));
  assert.equal(codes.size, 16);
  assert.ok(codes.has('ACIR'));
  assert.ok(codes.has('BGSF'));

  for (const section of sections) {
    assert.ok(section.rose_name.length > 0);
    assert.ok(section.markdown_content.length > 0);
  }
});

test('summary extraction returns non-empty text for parsed markdown', async () => {
  const markdown = await fs.readFile(TYPE_MD_PATH, 'utf8');
  const sections = parseTypeMarkdownDocument(markdown);

  for (const section of sections) {
    const summary = extractSummaryFromMarkdown(section.markdown_content);
    assert.ok(summary.length > 0, `summary missing for ${section.rose_code}`);
  }
});

