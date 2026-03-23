import { getQuestionDefinitionList } from 'lib/rose';

function normalizeQuestionNumber(rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    return null;
  }
  return value;
}

function normalizeDisplayOrder(rawValue, fallbackValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    return fallbackValue;
  }
  return value;
}

export async function seedSurveyQuestionsIfEmpty(db) {
  const countResult = await db.query('SELECT COUNT(*)::int AS count FROM uniday_app.survey_questions');
  const count = countResult.rows[0]?.count || 0;
  if (count > 0) {
    return { seeded: false, count };
  }

  const definitions = getQuestionDefinitionList();
  for (const item of definitions) {
    await db.query(
      `
      INSERT INTO uniday_app.survey_questions(
        question_number,
        section_title,
        question_text,
        display_order
      )
      VALUES ($1, $2, $3, $4)
      `,
      [item.number, item.section, item.text, item.number]
    );
  }

  return { seeded: true, count: definitions.length };
}

export async function importSurveyQuestionsFromDefaults(db, { overwrite = false } = {}) {
  const definitions = getQuestionDefinitionList();
  const existingResult = await db.query('SELECT question_number FROM uniday_app.survey_questions');
  const existingNumbers = new Set(existingResult.rows.map((row) => row.question_number));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of definitions) {
    if (existingNumbers.has(item.number)) {
      if (!overwrite) {
        skipped += 1;
        continue;
      }

      await db.query(
        `
        UPDATE uniday_app.survey_questions
        SET section_title = $1,
            question_text = $2,
            display_order = $3,
            updated_at = NOW()
        WHERE question_number = $4
        `,
        [item.section, item.text, item.number, item.number]
      );
      updated += 1;
      continue;
    }

    await db.query(
      `
      INSERT INTO uniday_app.survey_questions(
        question_number,
        section_title,
        question_text,
        display_order
      )
      VALUES ($1, $2, $3, $4)
      `,
      [item.number, item.section, item.text, item.number]
    );
    inserted += 1;
  }

  return {
    total: definitions.length,
    inserted,
    updated,
    skipped
  };
}

export async function listSurveyQuestions(db) {
  const result = await db.query(
    `
    SELECT
      question_number,
      section_title,
      question_text,
      display_order,
      updated_at,
      updated_by
    FROM uniday_app.survey_questions
    ORDER BY display_order ASC, question_number ASC
    `
  );
  return result.rows;
}

export async function getSurveyQuestionByNumber(db, questionNumberInput) {
  const questionNumber = normalizeQuestionNumber(questionNumberInput);
  if (!questionNumber) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      question_number,
      section_title,
      question_text,
      display_order,
      updated_at,
      updated_by
    FROM uniday_app.survey_questions
    WHERE question_number = $1
    LIMIT 1
    `,
    [questionNumber]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function updateSurveyQuestion(db, questionNumberInput, payload, updatedBy = null) {
  const questionNumber = normalizeQuestionNumber(questionNumberInput);
  if (!questionNumber) {
    return { ok: false, msg: 'Invalid question number' };
  }

  const sectionTitle = payload?.section_title;
  const questionText = payload?.question_text;
  const displayOrder = normalizeDisplayOrder(payload?.display_order, questionNumber);

  if (typeof sectionTitle !== 'string' || !sectionTitle.trim()) {
    return { ok: false, msg: 'section_title is required' };
  }

  if (typeof questionText !== 'string' || !questionText.trim()) {
    return { ok: false, msg: 'question_text is required' };
  }

  const result = await db.query(
    `
    UPDATE uniday_app.survey_questions
    SET section_title = $1,
        question_text = $2,
        display_order = $3,
        updated_by = $4,
        updated_at = NOW()
    WHERE question_number = $5
    RETURNING
      question_number,
      section_title,
      question_text,
      display_order,
      updated_at,
      updated_by
    `,
    [sectionTitle.trim(), questionText.trim(), displayOrder, updatedBy, questionNumber]
  );

  if (result.rowCount === 0) {
    return { ok: false, msg: 'Question not found', status: 404 };
  }

  return { ok: true, data: result.rows[0] };
}

export async function getSurveySectionsForClient(db) {
  const rows = await listSurveyQuestions(db);
  if (rows.length === 0) {
    return [];
  }

  const sections = [];
  const sectionMap = new Map();

  for (const row of rows) {
    const sectionTitle = row.section_title || '未分组';
    if (!sectionMap.has(sectionTitle)) {
      const section = {
        title: sectionTitle,
        questions: []
      };
      sectionMap.set(sectionTitle, section);
      sections.push(section);
    }

    sectionMap.get(sectionTitle).questions.push({
      number: row.question_number,
      text: row.question_text
    });
  }

  return sections;
}

