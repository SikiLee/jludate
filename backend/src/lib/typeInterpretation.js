import fs from 'node:fs/promises';
import path from 'node:path';

const TYPE_HEADER_REGEX = /^##\s+([A-Z]{4})\s+(.+)\s*$/gm;
const DEFAULT_ROSE_TYPE_NAMES = {
  ACIR: '灵魂黑客',
  ACIF: '风暴骑士',
  ACSR: '燃情信徒',
  ACSF: '热烈燃烧者',
  AGIR: '云端守望者',
  AGIF: '吟游诗人',
  AGSR: '星轨伴星',
  AGSF: '浪漫造梦师',
  BCIR: '铁血执政官',
  BCIF: '清醒合伙人',
  BCSR: '钢铁护卫',
  BCSF: '烟火玩家',
  BGIR: '静谧雪松',
  BGIF: '佛系合伙人',
  BGSR: '终极避风港',
  BGSF: '人间水豚'
};
const PLACEHOLDER_MARKDOWN = '该类型解读暂未补充，请在管理端完善内容。';

function normalizeRoseCode(roseCode) {
  if (typeof roseCode !== 'string') {
    return '';
  }
  return roseCode.trim().toUpperCase();
}

export function extractSummaryFromMarkdown(markdownContent, maxLength = 220) {
  if (typeof markdownContent !== 'string' || !markdownContent.trim()) {
    return '';
  }

  const blocks = markdownContent
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const block of blocks) {
    if (block.startsWith('#')) {
      continue;
    }

    const compact = block
      .replace(/\*\*/g, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!compact) {
      continue;
    }

    if (compact.length <= maxLength) {
      return compact;
    }

    return `${compact.slice(0, maxLength).trim()}...`;
  }

  return '';
}

export function extractSectionsFromMarkdown(markdownContent) {
  if (typeof markdownContent !== 'string' || !markdownContent.trim()) {
    return [];
  }

  const lines = markdownContent.split('\n');
  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    const content = current.lines.join('\n').trim();
    if (!content) {
      current = null;
      return;
    }

    sections.push({
      title: current.title,
      content
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^###\s+(.+)$/);

    if (headingMatch) {
      pushCurrent();
      current = {
        title: headingMatch[1].trim(),
        lines: []
      };
      continue;
    }

    if (!current) {
      continue;
    }

    current.lines.push(line);
  }

  pushCurrent();

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      title: '类型解读',
      content: markdownContent.trim()
    }
  ];
}

export function parseTypeMarkdownDocument(markdownSource) {
  if (typeof markdownSource !== 'string' || !markdownSource.trim()) {
    return [];
  }

  TYPE_HEADER_REGEX.lastIndex = 0;
  const sections = [];
  const matches = [];
  let match;

  while ((match = TYPE_HEADER_REGEX.exec(markdownSource)) !== null) {
    matches.push({
      roseCode: normalizeRoseCode(match[1]),
      roseName: match[2].trim(),
      index: match.index,
      headingLength: match[0].length
    });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const contentStart = current.index + current.headingLength;
    const contentEnd = next ? next.index : markdownSource.length;
    const markdownContent = markdownSource.slice(contentStart, contentEnd).trim();

    if (!current.roseCode || !markdownContent) {
      continue;
    }

    sections.push({
      rose_code: current.roseCode,
      rose_name: current.roseName,
      markdown_content: markdownContent
    });
  }

  const sectionMap = new Map(sections.map((section) => [section.rose_code, section]));
  const normalizedSections = [];

  for (const [roseCode, roseName] of Object.entries(DEFAULT_ROSE_TYPE_NAMES)) {
    if (sectionMap.has(roseCode)) {
      const existing = sectionMap.get(roseCode);
      normalizedSections.push({
        rose_code: roseCode,
        rose_name: existing.rose_name || roseName,
        markdown_content: existing.markdown_content
      });
      sectionMap.delete(roseCode);
      continue;
    }

    normalizedSections.push({
      rose_code: roseCode,
      rose_name: roseName,
      markdown_content: PLACEHOLDER_MARKDOWN
    });
  }

  for (const section of sectionMap.values()) {
    normalizedSections.push(section);
  }

  return normalizedSections;
}

function getDefaultTypeSections() {
  return Object.entries(DEFAULT_ROSE_TYPE_NAMES).map(([roseCode, roseName]) => ({
    rose_code: roseCode,
    rose_name: roseName,
    markdown_content: PLACEHOLDER_MARKDOWN
  }));
}

function resolveTypeMdSeedCandidates() {
  const candidates = [];

  if (process.env.TYPE_MD_PATH && process.env.TYPE_MD_PATH.trim()) {
    candidates.push(process.env.TYPE_MD_PATH.trim());
  }

  candidates.push(path.join(process.cwd(), '../Type.md'));
  candidates.push(path.join(process.cwd(), 'Type.md'));
  candidates.push(path.join(process.cwd(), 'src/content/Type.md'));

  return [...new Set(candidates)];
}

async function loadSeedSectionsFromTypeMd() {
  const candidates = resolveTypeMdSeedCandidates();

  for (const candidate of candidates) {
    try {
      const markdown = await fs.readFile(candidate, 'utf8');
      const sections = parseTypeMarkdownDocument(markdown);
      if (sections.length > 0) {
        return {
          sections,
          source: candidate
        };
      }
    } catch {
      // try next candidate
    }
  }

  return {
    sections: getDefaultTypeSections(),
    source: 'fallback-defaults'
  };
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

export async function seedInterpretationsIfEmpty(db) {
  const countResult = await db.query('SELECT COUNT(*)::int AS count FROM unidate_app.rose_type_interpretations');
  const count = countResult.rows[0]?.count || 0;
  if (count > 0) {
    return { seeded: false, count };
  }

  const seedData = await loadSeedSectionsFromTypeMd();
  const seedSections = seedData.sections;
  const imported = await withOptionalTransaction(db, async (executor) => {
    let inserted = 0;
    for (const section of seedSections) {
      const result = await executor.query(
        `
        INSERT INTO unidate_app.rose_type_interpretations(
          rose_code,
          rose_name,
          enabled,
          markdown_content
        )
        VALUES ($1, $2, TRUE, $3)
        ON CONFLICT (rose_code) DO NOTHING
        `,
        [section.rose_code, section.rose_name, section.markdown_content]
      );
      inserted += result.rowCount || 0;
    }
    return {
      total: seedSections.length,
      inserted
    };
  });

  if (imported.inserted > 0) {
    console.info(`Seeded ROSE type interpretations from ${seedData.source} (inserted=${imported.inserted})`);
  }

  return {
    seeded: imported.inserted > 0,
    count: imported.inserted
  };
}

export async function listTypeInterpretations(db) {
  const result = await db.query(
    `
    SELECT rose_code, rose_name, enabled, updated_at
    FROM unidate_app.rose_type_interpretations
    ORDER BY rose_code ASC
    `
  );

  return result.rows;
}

export async function getTypeInterpretationForAdmin(db, roseCodeInput) {
  const roseCode = normalizeRoseCode(roseCodeInput);
  if (!roseCode) {
    return null;
  }

  const result = await db.query(
    `
    SELECT rose_code, rose_name, enabled, markdown_content, updated_at, updated_by
    FROM unidate_app.rose_type_interpretations
    WHERE rose_code = $1
    LIMIT 1
    `,
    [roseCode]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function updateTypeInterpretation(db, roseCodeInput, payload, updatedBy = null) {
  const roseCode = normalizeRoseCode(roseCodeInput);
  if (!roseCode) {
    return { ok: false, msg: 'Invalid rose code' };
  }

  const roseName = payload?.rose_name;
  const markdownContent = payload?.markdown_content;
  const enabled = payload?.enabled;

  if (typeof roseName !== 'string' || !roseName.trim()) {
    return { ok: false, msg: 'rose_name is required' };
  }

  if (typeof markdownContent !== 'string' || !markdownContent.trim()) {
    return { ok: false, msg: 'markdown_content is required' };
  }

  if (typeof enabled !== 'boolean') {
    return { ok: false, msg: 'enabled must be a boolean' };
  }

  const result = await db.query(
    `
    UPDATE unidate_app.rose_type_interpretations
    SET rose_name = $1,
        markdown_content = $2,
        enabled = $3,
        updated_by = $4,
        updated_at = NOW()
    WHERE rose_code = $5
    RETURNING rose_code, rose_name, enabled, markdown_content, updated_at, updated_by
    `,
    [roseName.trim(), markdownContent.trim(), enabled, updatedBy, roseCode]
  );

  if (result.rowCount === 0) {
    return { ok: false, msg: 'Type not found', status: 404 };
  }

  return { ok: true, data: result.rows[0] };
}

export async function getPublicTypeInterpretation(db, roseCodeInput) {
  const roseCode = normalizeRoseCode(roseCodeInput);
  if (!roseCode) {
    return null;
  }

  const result = await db.query(
    `
    SELECT rose_code, rose_name, enabled, markdown_content, updated_at
    FROM unidate_app.rose_type_interpretations
    WHERE rose_code = $1
    LIMIT 1
    `,
    [roseCode]
  );

  if (result.rowCount === 0) {
    return {
      supported: false,
      rose_code: roseCode,
      reason: 'type_not_found'
    };
  }

  const row = result.rows[0];
  if (!row.enabled) {
    return {
      supported: false,
      rose_code: row.rose_code,
      rose_name: row.rose_name,
      reason: 'type_disabled'
    };
  }

  return {
    supported: true,
    rose_code: row.rose_code,
    rose_name: row.rose_name,
    summary: extractSummaryFromMarkdown(row.markdown_content),
    sections: extractSectionsFromMarkdown(row.markdown_content),
    markdown: row.markdown_content,
    updated_at: row.updated_at
  };
}
