import fs from 'fs';
import path from 'path';

const QUESTIONNAIRE_TYPES = new Set(['love', 'friend']);
const PAGE_KEYS = new Set(['hard', 'deep', 'settings']);

function pickTxtFilePath() {
  const candidatePaths = [
    path.join(process.cwd(), '恋爱版交友版匹配问卷_36题精简版.txt'),
    path.join(process.cwd(), '..', '恋爱版交友版匹配问卷_36题精简版.txt'),
    path.join(process.cwd(), 'content', '恋爱版交友版匹配问卷_36题精简版.txt'),
    path.join(process.cwd(), '..', 'content', '恋爱版交友版匹配问卷_36题精简版.txt')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

function safeTrim(line) {
  if (typeof line !== 'string') return '';
  return line.trim();
}

function parseScale5LRDeepFromTxt(txt) {
  const rawLines = txt.split(/\r?\n/).map((l) => safeTrim(l)).filter(Boolean);

  let currentType = null; // 'love' | 'friend'
  let currentModuleIndex = null; // 1..3
  let currentModuleTitle = '';

  const result = {
    love: { modules: new Map(), questions: [] },
    friend: { modules: new Map(), questions: [] }
  };

  const typeHeaderRe = /^恋爱版/;
  const friendHeaderRe = /^交友版/;
  const moduleHeaderRe = /^模块([一二三])：(.+)$/;
  const questionRe = /^(\d+)\.\s*(.+)$/;

  const moduleCharToIndex = { 一: 1, 二: 2, 三: 3 };

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];

    if (typeHeaderRe.test(line)) {
      currentType = 'love';
      currentModuleIndex = null;
      continue;
    }

    if (friendHeaderRe.test(line)) {
      currentType = 'friend';
      currentModuleIndex = null;
      continue;
    }

    const moduleMatch = line.match(moduleHeaderRe);
    if (moduleMatch) {
      currentModuleIndex = moduleCharToIndex[moduleMatch[1]] || null;
      currentModuleTitle = safeTrim(moduleMatch[2] || '');
      if (currentType && currentModuleIndex) {
        result[currentType].modules.set(currentModuleIndex, currentModuleTitle);
      }
      continue;
    }

    const qMatch = line.match(questionRe);
    if (!qMatch || !currentType || !currentModuleIndex) {
      continue;
    }

    const questionNumber = Number(qMatch[1]);
    const questionTitle = safeTrim(qMatch[2] || '');

    const stemLine = rawLines[i + 1] || '';
    const leftLine = rawLines[i + 2] || '';
    const rightLine = rawLines[i + 3] || '';

    const leftText = leftLine.replace(/^左：?/, '').trim();
    const rightText = rightLine.replace(/^右：?/, '').trim();

    const questionStem = stemLine.trim();

    if (!questionNumber || !questionTitle || !questionStem || !leftText || !rightText) {
      // Skip malformed block; seeding should still work for majority of data.
      continue;
    }

    result[currentType].questions.push({
      question_number: questionNumber,
      question_title: questionTitle,
      question_stem: questionStem,
      left_option_text: leftText,
      right_option_text: rightText,
      module_index: currentModuleIndex
    });

    i += 3;
  }

  return result;
}

function getDefaultHardSettingsItems() {
  // These are the fixed fields used by current client questionnaire flow.
  const CAN = '能';
  const CANNOT = '不能';
  const YES = '是';
  const NO = '否';
  const MALE = '男生';
  const FEMALE = '女生';

  const targetGenderChoices = [
    { value: 'male', label: MALE },
    { value: 'female', label: FEMALE }
  ];

  const ageChoices = [0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }));

  return [
    // hard_filter
    {
      page_key: 'hard',
      question_number: 1,
      question_kind: 'select',
      question_title: '匹配对方的性别',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'target_gender',
        placeholder: '请选择',
        choices: targetGenderChoices
      }
    },
    {
      page_key: 'hard',
      question_number: 2,
      question_kind: 'select',
      question_title: '最多可接受对方比我大几级',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'age_diff_older_max',
        placeholder: '请选择',
        choices: ageChoices
      }
    },
    {
      page_key: 'hard',
      question_number: 3,
      question_kind: 'select',
      question_title: '最多可接受对方比我小几级',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'age_diff_younger_max',
        placeholder: '请选择',
        choices: ageChoices
      }
    },
    {
      page_key: 'hard',
      question_number: 4,
      question_kind: 'toggle',
      question_title: '是否能接受对方吸烟',
      question_stem: '',
      left_option_text: CAN,
      right_option_text: CANNOT,
      options_json: {
        payload_key: 'accept_smoking',
        left_value: true,
        right_value: false
      }
    },

    // match_settings
    {
      page_key: 'settings',
      question_number: 1,
      question_kind: 'toggle',
      question_title: '是否展示联系方式',
      question_stem: '',
      left_option_text: NO,
      right_option_text: YES,
      options_json: {
        payload_key: 'share_contact_with_match',
        left_value: false,
        right_value: true
      }
    },
    {
      page_key: 'settings',
      question_number: 2,
      question_kind: 'text',
      question_title: '联系方式（必填，1～20字）',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'match_contact_detail',
        placeholder: '请输入联系方式'
      }
    },
    {
      page_key: 'settings',
      question_number: 3,
      question_kind: 'toggle',
      question_title: '是否有对对方想说的话',
      question_stem: '',
      left_option_text: NO,
      right_option_text: YES,
      options_json: {
        payload_key: 'include_message_to_partner',
        left_value: false,
        right_value: true
      }
    },
    {
      page_key: 'settings',
      question_number: 4,
      question_kind: 'textarea',
      question_title: '对对方想说的话（必填，1～200字）',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'message_to_partner',
        placeholder: '请输入对对方想说的话'
      }
    },
    {
      page_key: 'settings',
      question_number: 5,
      question_kind: 'toggle',
      question_title: '是否自动参与每周匹配',
      question_stem: '',
      left_option_text: NO,
      right_option_text: YES,
      options_json: {
        payload_key: 'auto_participate_weekly_match',
        left_value: false,
        right_value: true
      }
    }
  ];
}

async function readDefaultTxtFile() {
  const p = pickTxtFilePath();
  if (!p) return null;
  return fs.readFileSync(p, 'utf8');
}

function validateQuestionnaireType(type) {
  if (!QUESTIONNAIRE_TYPES.has(type)) return null;
  return type;
}

function normalizeItemsSort(items, { sortKey = 'display_order' } = {}) {
  return [...items].sort((a, b) => {
    if (a[sortKey] !== b[sortKey]) return (a[sortKey] || 0) - (b[sortKey] || 0);
    return (a.question_number || 0) - (b.question_number || 0);
  });
}

export async function seedMatchQuestionnaireConfigIfEmpty(db) {
  const typeCount = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM unidate_app.match_questionnaire_items
    `
  );
  const count = typeCount.rows[0]?.count ?? 0;
  if (count > 0) {
    return { seeded: false, count };
  }

  const txt = await readDefaultTxtFile();
  if (!txt) {
    // Hard fail: admin UI and client questionnaires cannot work without deep question seeds.
    throw new Error('Default questionnaire txt not found; cannot seed match questionnaire config');
  }

  const deepParsed = parseScale5LRDeepFromTxt(txt);

  const hardSettingsDefaults = getDefaultHardSettingsItems();

  const deepQuestionsByType = {
    love: deepParsed.love.questions,
    friend: deepParsed.friend.questions
  };

  const moduleTitlesByType = {
    love: deepParsed.love.modules,
    friend: deepParsed.friend.modules
  };

  await db.query('BEGIN');
  try {
    // Modules
    for (const type of ['love', 'friend']) {
      const moduleMap = moduleTitlesByType[type];
      if (!moduleMap || moduleMap.size === 0) continue;

      for (const [moduleIndex, title] of moduleMap.entries()) {
        await db.query(
          `
          INSERT INTO unidate_app.match_questionnaire_modules(
            questionnaire_type, module_index, title, display_order
          )
          VALUES ($1, $2::smallint, $3, $4)
          ON CONFLICT (questionnaire_type, module_index)
          DO UPDATE SET
            title = EXCLUDED.title,
            display_order = EXCLUDED.display_order,
            updated_at = NOW()
          `,
          [type, moduleIndex, title, moduleIndex]
        );
      }
    }

    // Items: deep (scale5_lr)
    for (const type of ['love', 'friend']) {
      const questions = deepQuestionsByType[type] || [];
      // Sort by module + question number, so display_order is stable initially.
      const sorted = [...questions].sort((a, b) => {
        if (a.module_index !== b.module_index) return a.module_index - b.module_index;
        return a.question_number - b.question_number;
      });

      for (let i = 0; i < sorted.length; i += 1) {
        const q = sorted[i];
        await db.query(
          `
          INSERT INTO unidate_app.match_questionnaire_items(
            questionnaire_type,
            page_key,
            module_index,
            display_order,
            question_number,
            question_kind,
            question_title,
            question_stem,
            left_option_text,
            right_option_text,
            options_json
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
          `,
          [
            type,
            'deep',
            q.module_index,
            q.question_number,
            q.question_number,
            'scale5_lr',
            q.question_title,
            q.question_stem,
            q.left_option_text,
            q.right_option_text,
            JSON.stringify({})
          ]
        );
      }
    }

    // Items: hard + settings (fixed kinds)
    for (const type of ['love', 'friend']) {
      const base = hardSettingsDefaults;
      for (const item of base) {
        await db.query(
          `
          INSERT INTO unidate_app.match_questionnaire_items(
            questionnaire_type,
            page_key,
            module_index,
            display_order,
            question_number,
            question_kind,
            question_title,
            question_stem,
            left_option_text,
            right_option_text,
            options_json
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
          `,
          [
            type,
            item.page_key,
            0,
            item.question_number,
            item.question_number,
            item.question_kind,
            item.question_title,
            item.question_stem,
            item.left_option_text || '',
            item.right_option_text || '',
            JSON.stringify(item.options_json || {})
          ]
        );
      }
    }

    await db.query('COMMIT');
    return { seeded: true, count: deepQuestionsByType.love.length + deepQuestionsByType.friend.length };
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

export async function listMatchQuestionnaireConfigForClient(db, questionnaireType) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type) {
    return { modules: [], hard_items: [], settings_items: [] };
  }

  const modulesRes = await db.query(
    `
    SELECT module_index, title, display_order
    FROM unidate_app.match_questionnaire_modules
    WHERE questionnaire_type = $1
    ORDER BY display_order ASC, module_index ASC
    `,
    [type]
  );

  const modules = modulesRes.rows.map((r) => ({
    module_index: Number(r.module_index),
    title: String(r.title || ''),
    questions: []
  }));
  const moduleIndexToModule = new Map(modules.map((m) => [m.module_index, m]));

  const hardRes = await db.query(
    `
    SELECT
      id,
      'hard' AS page_key,
      question_number,
      question_kind,
      question_title,
      question_stem,
      left_option_text,
      right_option_text,
      options_json,
      0 AS module_index,
      display_order
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1 AND page_key = 'hard'
    ORDER BY display_order ASC, question_number ASC
    `,
    [type]
  );

  const settingsRes = await db.query(
    `
    SELECT
      id,
      'settings' AS page_key,
      question_number,
      question_kind,
      question_title,
      question_stem,
      left_option_text,
      right_option_text,
      options_json,
      0 AS module_index,
      display_order
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1 AND page_key = 'settings'
    ORDER BY display_order ASC, question_number ASC
    `,
    [type]
  );

  const deepRes = await db.query(
    `
    SELECT
      id,
      module_index,
      question_number,
      question_kind,
      question_title,
      question_stem,
      left_option_text,
      right_option_text,
      options_json,
      display_order
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1 AND page_key = 'deep' AND question_kind = 'scale5_lr'
    ORDER BY module_index ASC, display_order ASC, question_number ASC
    `,
    [type]
  );

  for (const row of deepRes.rows) {
    const moduleIndex = Number(row.module_index);
    const m = moduleIndexToModule.get(moduleIndex);
    if (!m) continue;
    m.questions.push({
      id: row.id,
      question_number: Number(row.question_number),
      page_key: 'deep',
      module_index: moduleIndex,
      question_kind: row.question_kind,
      display_order: Number(row.display_order),
      question_title: String(row.question_title || ''),
      question_stem: String(row.question_stem || ''),
      left_option_text: String(row.left_option_text || ''),
      right_option_text: String(row.right_option_text || ''),
      options_json: row.options_json || {}
    });
  }

  return {
    type,
    hard_items: normalizeItemsSort(hardRes.rows, { sortKey: 'display_order' }),
    settings_items: normalizeItemsSort(settingsRes.rows, { sortKey: 'display_order' }),
    deep_modules: modules.map((m) => ({
      module_index: m.module_index,
      title: m.title,
      questions: m.questions
    }))
  };
}

export async function getDeepQuestionNumbers(db, questionnaireType) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type) return [];

  const deepRes = await db.query(
    `
    SELECT question_number
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1
      AND page_key = 'deep'
      AND question_kind = 'scale5_lr'
    ORDER BY display_order ASC, question_number ASC
    `,
    [type]
  );
  return deepRes.rows.map((r) => Number(r.question_number)).filter((n) => Number.isInteger(n));
}

function normalizeOptionsJson(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

export async function listAdminMatchQuestionnaireConfig(db, questionnaireType) {
  const config = await listMatchQuestionnaireConfigForClient(db, questionnaireType);
  return config;
}

export async function getAdminMatchQuestionnaireItemById(db, { questionnaireType, id }) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type || !id) return null;

  const res = await db.query(
    `
    SELECT *
    FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1 AND id = $2
    LIMIT 1
    `,
    [type, id]
  );
  return res.rows[0] || null;
}

export async function createAdminMatchQuestionnaireItem(db, { questionnaireType, payload, updatedBy }) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type) return { ok: false, msg: 'Invalid questionnaire type' };

  const pageKey = typeof payload?.page_key === 'string' ? payload.page_key : null;
  if (!pageKey || !PAGE_KEYS.has(pageKey)) return { ok: false, msg: 'Invalid page_key' };

  const questionKind = typeof payload?.question_kind === 'string' ? payload.question_kind : null;
  if (!questionKind) return { ok: false, msg: 'question_kind is required' };

  const questionNumber = Number(payload?.question_number);
  if (!Number.isInteger(questionNumber) || questionNumber < 1) {
    return { ok: false, msg: 'question_number must be integer >= 1' };
  }

  const displayOrder = Number.isInteger(Number(payload?.display_order))
    ? Number(payload.display_order)
    : questionNumber;

  const moduleIndexInput = payload?.module_index === null || payload?.module_index === undefined
    ? undefined
    : Number(payload.module_index);
  const moduleIndex = pageKey === 'deep'
    ? moduleIndexInput
    : 0;

  if (pageKey === 'deep' && (!moduleIndex || !Number.isInteger(moduleIndex) || moduleIndex < 1 || moduleIndex > 3)) {
    return { ok: false, msg: 'module_index (1..3) is required for deep page' };
  }

  const item = {
    page_key: pageKey,
    module_index: moduleIndex,
    question_kind: questionKind,
    question_number: questionNumber,
    display_order: displayOrder,
    question_title: typeof payload?.question_title === 'string' ? payload.question_title.trim() : '',
    question_stem: typeof payload?.question_stem === 'string' ? payload.question_stem.trim() : '',
    left_option_text: typeof payload?.left_option_text === 'string' ? payload.left_option_text.trim() : '',
    right_option_text: typeof payload?.right_option_text === 'string' ? payload.right_option_text.trim() : '',
    options_json: normalizeOptionsJson(payload?.options_json)
  };

  if (pageKey === 'deep' && questionKind === 'scale5_lr') {
    if (!item.question_title || !item.question_stem || !item.left_option_text || !item.right_option_text) {
      return { ok: false, msg: 'scale5_lr requires question_title, question_stem, left_option_text, right_option_text' };
    }
  }

  // For hard/settings pages, module_index is always 0 (not applicable).
  if (pageKey !== 'deep') {
    item.module_index = 0;
  }

  const inserted = await db.query(
    `
    INSERT INTO unidate_app.match_questionnaire_items(
      questionnaire_type,
      page_key,
      module_index,
      display_order,
      question_number,
      question_kind,
      question_title,
      question_stem,
      left_option_text,
      right_option_text,
      options_json,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
    RETURNING *
    `,
    [
      type,
      item.page_key,
      item.module_index,
      item.display_order,
      item.question_number,
      item.question_kind,
      item.question_title,
      item.question_stem,
      item.left_option_text,
      item.right_option_text,
      JSON.stringify(item.options_json),
      updatedBy || null
    ]
  );

  return { ok: true, data: inserted.rows[0] };
}

export async function updateAdminMatchQuestionnaireItem(db, { questionnaireType, id, payload, updatedBy }) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type) return { ok: false, msg: 'Invalid questionnaire type' };
  if (!id) return { ok: false, msg: 'id is required' };

  const patch = payload && typeof payload === 'object' ? payload : {};
  const next = {
    page_key: typeof patch.page_key === 'string' ? patch.page_key : undefined,
    module_index: patch.module_index === undefined ? undefined : (patch.module_index === null ? null : Number(patch.module_index)),
    display_order: patch.display_order === undefined ? undefined : Number(patch.display_order),
    question_number: patch.question_number === undefined ? undefined : Number(patch.question_number),
    question_kind: typeof patch.question_kind === 'string' ? patch.question_kind : undefined,
    question_title: typeof patch.question_title === 'string' ? patch.question_title.trim() : undefined,
    question_stem: typeof patch.question_stem === 'string' ? patch.question_stem.trim() : undefined,
    left_option_text: typeof patch.left_option_text === 'string' ? patch.left_option_text.trim() : undefined,
    right_option_text: typeof patch.right_option_text === 'string' ? patch.right_option_text.trim() : undefined,
    options_json: patch.options_json === undefined ? undefined : normalizeOptionsJson(patch.options_json)
  };

  // Build update SQL dynamically with a safe whitelist.
  const fields = [];
  const values = [];

  function addField(key, value) {
    if (value === undefined) return;
    fields.push(`${key} = $${values.length + 1}`);
    values.push(value);
  }

  addField('page_key', next.page_key);
  addField('module_index', next.module_index);
  addField('display_order', Number.isFinite(next.display_order) ? next.display_order : undefined);
  addField('question_number', Number.isFinite(next.question_number) ? next.question_number : undefined);
  addField('question_kind', next.question_kind);
  addField('question_title', next.question_title);
  addField('question_stem', next.question_stem);
  addField('left_option_text', next.left_option_text);
  addField('right_option_text', next.right_option_text);
  if (next.options_json !== undefined) {
    fields.push(`options_json = $${values.length + 1}::jsonb`);
    values.push(JSON.stringify(next.options_json));
  }

  // Always update updated_by if provided.
  if (updatedBy) {
    fields.push(`updated_by = $${values.length + 1}`);
    values.push(updatedBy);
  }

  if (fields.length === 0) {
    return { ok: false, msg: 'No fields to update' };
  }

  const sql = `
    UPDATE unidate_app.match_questionnaire_items
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE questionnaire_type = $${values.length + 1} AND id = $${values.length + 2}
    RETURNING *
  `;

  values.push(type, id);

  const res = await db.query(sql, values);
  if (res.rowCount === 0) return { ok: false, msg: 'Item not found', status: 404 };
  return { ok: true, data: res.rows[0] };
}

export async function deleteAdminMatchQuestionnaireItem(db, { questionnaireType, id }) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type || !id) return { ok: false, msg: 'Invalid request' };

  const res = await db.query(
    `
    DELETE FROM unidate_app.match_questionnaire_items
    WHERE questionnaire_type = $1 AND id = $2
    RETURNING id
    `,
    [type, id]
  );
  if (res.rowCount === 0) return { ok: false, msg: 'Item not found', status: 404 };
  return { ok: true };
}

export async function reorderAdminMatchQuestionnaireItems(db, { questionnaireType, payload }) {
  const type = validateQuestionnaireType(questionnaireType);
  if (!type) return { ok: false, msg: 'Invalid questionnaire type' };
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) return { ok: false, msg: 'items is required' };

  await db.query('BEGIN');
  try {
    for (const it of items) {
      const id = Number(it?.id);
      const displayOrder = Number(it?.display_order);
      if (!Number.isInteger(id) || !Number.isInteger(displayOrder)) {
        throw new Error('Invalid reorder payload');
      }
      await db.query(
        `
        UPDATE unidate_app.match_questionnaire_items
        SET display_order = $1,
            updated_at = NOW()
        WHERE questionnaire_type = $2 AND id = $3
        `,
        [displayOrder, type, id]
      );
    }
    await db.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await db.query('ROLLBACK');
    return { ok: false, msg: e?.message || 'reorder failed' };
  }
}

