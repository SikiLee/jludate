const DIMENSION_WEIGHTS = {
  A: 0.3,
  C: 0.15,
  I: 0.15,
  R: 0.4
};

export const GENDERS = ['male', 'female'];
export const TARGET_GENDERS = ['male', 'female'];
export const ORIENTATIONS = ['prefer_male', 'prefer_female', 'prefer_both'];

function q(number) {
  return `q${number}`;
}

export const QUESTION_KEYS = Array.from({ length: 50 }, (_, index) => q(index + 1));

export const SURVEY_QUESTIONS = [
  { number: 1, section: '核心价值观', text: '拥有孩子并组建传统家庭，是人生圆满不可或缺的一部分。' },
  { number: 2, section: '核心价值观', text: '事业上的野心和成就，比安逸稳定的世俗生活更重要。' },
  { number: 3, section: '核心价值观', text: '我认同在亲密关系中，男女应该承担相对传统的性别角色。' },
  { number: 4, section: '核心价值观', text: '我宁可得罪人并说出残酷真相，也不愿用善意谎言维持表面和谐。' },
  { number: 5, section: '核心价值观', text: '宗教信仰或深层精神信仰，是我生活中必须的一部分。' },
  { number: 6, section: '核心价值观', text: '追求财富自由是我目前人生最大的动力之一。' },
  { number: 7, section: '核心价值观', text: '我相信人性本私，在关键时刻人只会为自己考虑。' },
  { number: 8, section: '核心价值观', text: '我愿意为了追求梦想，忍受长期贫困和不确定性。' },
  { number: 9, section: '核心价值观', text: '改变世界或留下某种社会遗产，对我来说非常重要。' },
  { number: 10, section: '核心价值观', text: '即使面临巨大失败风险，我也更喜欢冒险人生。' },
  { number: 11, section: '生活方式', text: '周末在家里宅着什么都不做，是我最理想的充电方式。' },
  { number: 12, section: '生活方式', text: '即使在热恋期，我也需要大量绝对独处时间。' },
  { number: 13, section: '生活方式', text: '对方完全不使用社交媒体，对我来说是巨大加分项。' },
  { number: 14, section: '生活方式', text: '我有精神洁癖或收纳强迫症，受不了生活环境杂乱。' },
  { number: 15, section: '生活方式', text: '我更愿意把钱花在体验上，而不是奢侈品或电子产品。' },
  { number: 16, section: '生活方式', text: '保持高强度健身和身材管理，是我生活中的非卖品。' },
  { number: 17, section: '生活方式', text: '我是个极度随性的人，旅行时讨厌做详细攻略。' },
  { number: 18, section: '生活方式', text: '我经常深夜或周末加班，且认为这是理所应当。' },
  { number: 19, section: '生活方式', text: '频繁去酒吧、派对或喝酒，是我正常社交生活的一部分。' },
  { number: 20, section: '生活方式', text: '我有非常严格的饮食习惯，并希望伴侣能配合或理解。' },
  { number: 21, section: '情感风格', text: '吵架时，我必须先冷静几个小时甚至几天，再谈问题。' },
  { number: 22, section: '情感风格', text: '我希望伴侣能直接尖锐地指出我的缺点和虚荣。' },
  { number: 23, section: '情感风格', text: '我极度讨厌冷暴力，绝不允许带着矛盾过夜。' },
  { number: 24, section: '情感风格', text: '在关系初期，我乐意展露内心深处的恐惧和自卑。' },
  { number: 25, section: '情感风格', text: '面对沉重情感话题，我习惯用玩笑和幽默化解。' },
  { number: 26, section: '情感风格', text: '我每天都需要伴侣言语或肢体表达爱意，否则缺乏安全感。' },
  { number: 27, section: '情感风格', text: '伴侣倾诉烦恼时，我更倾向直接给解决方案。' },
  { number: 28, section: '情感风格', text: '我是容易记仇的人，很难真正翻篇原谅重大过失。' },
  { number: 29, section: '情感风格', text: '我期望伴侣有读心术，能在我没说时察觉我不开心。' },
  { number: 30, section: '边界感', text: '我完全不介意伴侣向好友吐槽我们感情中的矛盾。' },
  { number: 31, section: '边界感', text: '我认为和前任保持密切朋友关系是完全可接受的。' },
  { number: 32, section: '边界感', text: '长期关系里双方应共享手机密码，不该有数字隐私。' },
  { number: 33, section: '边界感', text: '结婚或确立长期关系后，双方财务必须完全合并。' },
  { number: 34, section: '边界感', text: '伴侣家庭强干预我们重大决定，我可以忍受。' },
  { number: 35, section: '边界感', text: '我希望在伴侣心中，我优先级永远高于原生家庭和老友。' },
  { number: 36, section: '边界感', text: '即使在恋爱或婚姻中，我也计划偶尔独自旅行。' },
  { number: 37, section: '边界感', text: '婚前签署详细婚前财产协议，是理性且必须的一步。' },
  { number: 38, section: '边界感', text: '我需要伴侣参与并热爱我至少一半以上兴趣爱好。' },
  { number: 39, section: '边界感', text: '为了伴侣更好的职业发展，我愿意搬去陌生城市或国家。' },
  { number: 40, section: '边界感', text: '只要没有身体越界，偶尔和别人言语暧昧或调情无伤大雅。' },
  { number: 41, section: '公民道德', text: '我宁愿在决定命运的考试中挂科，也绝不作弊。' },
  { number: 42, section: '公民道德', text: '伴侣政治立场若和我相反，是绝对红灯一票否决。' },
  { number: 43, section: '公民道德', text: '我会为环保理念在日常生活中做出巨大让步。' },
  { number: 44, section: '公民道德', text: '在合法前提下，个人利益最大化比照顾弱势群体更重要。' },
  { number: 45, section: '公民道德', text: '看到别人遭受不公，哪怕与我无关也会忍不住干预。' },
  { number: 46, section: '吸引力法则', text: '第一眼的身体吸引力和颜值，是我愿意深入了解对方的绝对前提。' },
  { number: 47, section: '吸引力法则', text: '对于伴侣身高或特定外貌特征，我有近乎偏执的硬性要求。' },
  { number: 48, section: '吸引力法则', text: '极高智商、快速接梗与深度探讨，对我是顶级吸引力。' },
  { number: 49, section: '吸引力法则', text: '伴侣复杂过往情史对我来说是绝对减分项甚至心理障碍。' },
  { number: 50, section: '吸引力法则', text: '我可以接受伴侣收入学历阶层远低于我，只要精神高度契合。' }
];

const QUESTION_MAP = Object.fromEntries(SURVEY_QUESTIONS.map((item) => [item.number, item]));

const DIMENSION_CONFIG = {
  A: {
    positiveLetter: 'A',
    negativeLetter: 'B',
    threshold: 44,
    tieBreaker: 2,
    positiveQuestions: [2, 6, 8, 9, 10, 15, 19, 49, 50],
    reverseQuestions: [1, 3]
  },
  C: {
    positiveLetter: 'C',
    negativeLetter: 'G',
    threshold: 32,
    tieBreaker: 4,
    positiveQuestions: [4, 22, 23, 24, 27],
    reverseQuestions: [21, 25, 29]
  },
  I: {
    positiveLetter: 'I',
    negativeLetter: 'S',
    threshold: 44,
    tieBreaker: 12,
    positiveQuestions: [12, 30, 31, 36],
    reverseQuestions: [26, 32, 33, 34, 35, 38, 39]
  },
  R: {
    positiveLetter: 'R',
    negativeLetter: 'F',
    threshold: 80,
    tieBreaker: 41,
    positiveQuestions: [5, 13, 14, 16, 20, 28, 37, 41, 42, 43, 47, 48],
    reverseQuestions: [7, 11, 17, 18, 40, 44, 45, 46]
  }
};

const ROSE_TYPE_NAMES = {
  ACIR: '灵魂黑客 (Soul Hacker)',
  ACIF: '风暴骑士 (Storm Knight)',
  ACSR: '燃情信徒 (Passionate Zealot)',
  ACSF: '热烈燃烧者 (Fierce Burner)',
  AGIR: '云端守望者 (Cloud Watcher)',
  AGIF: '吟游诗人 (Wandering Bard)',
  AGSR: '星轨伴星 (Orbiting Star)',
  AGSF: '浪漫造梦师 (Romantic Dreamer)',
  BCIR: '铁血执政官 (Iron Consul)',
  BCIF: '清醒合伙人 (Sober Partner)',
  BCSR: '钢铁护卫 (Ironclad Guardian)',
  BCSF: '烟火玩家 (Fireworks Player)',
  BGIR: '静谧雪松 (Silent Cedar)',
  BGIF: '佛系合伙人 (Zen Partner)',
  BGSR: '终极避风港 (Ultimate Safe Haven)',
  BGSF: '人间水豚 (Human Capybara)'
};

const MATCH_REASON_DIMENSIONS = [
  {
    key: 'A',
    index: 0,
    title: '🧭 维度 1：人生轨迹 (A 探索者 vs B 筑巢者)',
    core: '生活航向的同频与完美分工',
    templates: {
      AA: {
        label: '同频共振：A + A',
        reason: '你们是两头并肩在旷野上奔跑的狼。你们都不甘平庸，都渴望征服世界。你们能理解对方为什么深夜加班，也能理解为什么临时想远行。你们的关系是势均力敌的顶峰相见。'
      },
      BB: {
        label: '岁月静好：B + B',
        reason: '你们都深知外面的世界再精彩，也不如家里的一碗热汤。你们对安全感、家庭秩序和长期稳定有高度一致的期待，会把关系经营得踏实而可持续。'
      },
      AB: {
        label: '黄金互补：A + B',
        reason: '这是高质量的主内主外组合。A 负责开疆拓土，B 负责稳住后方。A 因为有兜底而敢于突破，B 因为有引领而看见更大世界，你们像两块咬合良好的拼图。'
      }
    }
  },
  {
    key: 'C',
    index: 1,
    title: '💬 维度 2：情感沟通 (C 直球派 vs G 温和派)',
    core: '情绪张力的缓冲与消化',
    templates: {
      CC: {
        label: '坦诚局：C + C',
        reason: '你们之间几乎没有猜心游戏。你敢说，我也敢接。即便冲突来得猛，问题通常也能被快速摊开和解决，关系的沟通效率很高。'
      },
      GG: {
        label: '和平局：G + G',
        reason: '你们都很在乎对方感受，遇到矛盾更倾向包容与退让。相处时情绪安全感强，不容易被尖锐表达刺伤，关系整体温和稳定。'
      },
      CG: {
        label: '太极局：C + G',
        reason: '这是一刚一柔的组合。C 负责精准指出问题，G 负责接住情绪并缓冲张力。一个讲理，一个讲爱，反而容易形成高质量沟通闭环。'
      }
    }
  },
  {
    key: 'I',
    index: 2,
    title: '🌌 维度 3：亲密边界 (I 独立型 vs S 共生型)',
    core: '空间需求的安全感确认',
    templates: {
      II: {
        label: '高阶室友：I + I',
        reason: '你们重视边界感，懂得距离产生美。你们可以给彼此足够的物理与心理空间，不会因为高频查岗而内耗，关系会更轻盈。'
      },
      SS: {
        label: '连体婴儿：S + S',
        reason: '你们都需要高频陪伴和强确认感。对你们来说，爱就是高度融合与彼此占有。只要节奏一致，这种关系会非常浓烈且有安全感。'
      },
      IS: {
        label: '高张力磨合：I + S',
        reason: '一个更需要空间，一个更需要靠近，天然会出现追与逃的张力。关键不是谁对谁错，而是能否提前约定边界与陪伴节奏；磨合成功会很稳，失配时也会很累。'
      }
    }
  },
  {
    key: 'R',
    index: 3,
    title: '⚖️ 维度 4：价值底线 (R 原则型 vs F 变通型)',
    core: '三观基石的稳固与包容',
    templates: {
      RR: {
        label: '钢铁同盟：R + R',
        reason: '你们对黑白边界和关系底线的判断很一致。在忠诚、道德和原则问题上容易形成稳定同盟，一旦建立信任，关系韧性会很强。'
      },
      FF: {
        label: '松弛玩家：F + F',
        reason: '你们都更重视弹性和现实感，不喜欢把关系变成刚性规训。你们对彼此的个体差异容忍度高，互动往往更轻松。'
      },
      RF: {
        label: '秩序与自由：R + F',
        reason: '这是秩序与弹性的组合。R 提供底线和稳定性，F 提供缓冲与灵活度。只要双方明确不可触碰边界，这组搭配反而容易形成长期平衡。'
      }
    }
  }
];

function normalizeRoseCodeForReason(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim().toUpperCase();
  if (!/^[AB][CG][IS][RF]$/.test(value)) {
    return '';
  }

  return value;
}

function resolveReasonTemplate(templates, leftLetter, rightLetter) {
  const directKey = `${leftLetter}${rightLetter}`;
  if (templates[directKey]) {
    return templates[directKey];
  }

  const reverseKey = `${rightLetter}${leftLetter}`;
  if (templates[reverseKey]) {
    return templates[reverseKey];
  }

  return null;
}

export function buildMatchDimensionReasons(selfRoseCodeInput, partnerRoseCodeInput) {
  const selfRoseCode = normalizeRoseCodeForReason(selfRoseCodeInput);
  const partnerRoseCode = normalizeRoseCodeForReason(partnerRoseCodeInput);
  if (!selfRoseCode || !partnerRoseCode) {
    return [];
  }

  return MATCH_REASON_DIMENSIONS.map((dimension, index) => {
    const selfLetter = selfRoseCode[dimension.index];
    const partnerLetter = partnerRoseCode[dimension.index];
    const matchedTemplate = resolveReasonTemplate(dimension.templates, selfLetter, partnerLetter);

    return {
      dimension: dimension.key,
      dimension_index: index + 1,
      title: dimension.title,
      core_label: dimension.core,
      matchup_label: matchedTemplate?.label || `${selfLetter} + ${partnerLetter}`,
      reason: matchedTemplate?.reason || '这一维的匹配结果建议结合完整问卷答题语境进一步判断。'
    };
  });
}

const QUESTION_DIMENSION_MAP = buildQuestionDimensionMap();
const DIMENSION_MAX_DIFF = buildDimensionMaxDiff();
export const THEORETICAL_MAX_DISTANCE = Math.sqrt(
  (DIMENSION_WEIGHTS.A * (DIMENSION_MAX_DIFF.A ** 2)) +
  (DIMENSION_WEIGHTS.C * (DIMENSION_MAX_DIFF.C ** 2)) +
  (DIMENSION_WEIGHTS.I * (DIMENSION_MAX_DIFF.I ** 2)) +
  (DIMENSION_WEIGHTS.R * (DIMENSION_MAX_DIFF.R ** 2))
);

function buildQuestionDimensionMap() {
  const map = {};

  for (const [dimension, config] of Object.entries(DIMENSION_CONFIG)) {
    for (const number of [...config.positiveQuestions, ...config.reverseQuestions]) {
      map[number] = dimension;
    }
  }

  return map;
}

function buildDimensionMaxDiff() {
  const maxDiff = {};

  for (const [dimension, config] of Object.entries(DIMENSION_CONFIG)) {
    const questionCount = config.positiveQuestions.length + config.reverseQuestions.length;
    maxDiff[dimension] = questionCount * 6;
  }

  return maxDiff;
}

function inRange(value, min, max) {
  return value >= min && value <= max;
}

export function isValidGender(gender) {
  return GENDERS.includes(gender);
}

export function isValidTargetGender(targetGender) {
  return TARGET_GENDERS.includes(targetGender);
}

function mapOrientationToTargetGender(orientation) {
  if (orientation === 'prefer_male') {
    return 'male';
  }

  if (orientation === 'prefer_female') {
    return 'female';
  }

  return null;
}

export function resolveTargetGender(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  if (isValidTargetGender(profile.target_gender)) {
    return profile.target_gender;
  }

  if (ORIENTATIONS.includes(profile.orientation)) {
    return mapOrientationToTargetGender(profile.orientation);
  }

  return null;
}

export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { ok: false, msg: 'Profile is required' };
  }

  if (!isValidGender(profile.gender)) {
    return { ok: false, msg: 'Invalid gender' };
  }

  if (
    profile.target_gender !== undefined
    && profile.target_gender !== null
    && profile.target_gender !== ''
    && !isValidTargetGender(profile.target_gender)
  ) {
    return { ok: false, msg: 'Invalid target gender' };
  }

  if (
    Object.prototype.hasOwnProperty.call(profile, 'allow_cross_school_match')
    && typeof profile.allow_cross_school_match !== 'boolean'
  ) {
    return { ok: false, msg: 'allow_cross_school_match must be boolean' };
  }

  return { ok: true };
}

export function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, msg: 'Answers must be an object' };
  }

  const answerKeys = Object.keys(answers);
  if (answerKeys.length !== QUESTION_KEYS.length) {
    return { ok: false, msg: 'Answers must contain exactly 50 questions' };
  }

  const normalized = {};

  for (const key of QUESTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(answers, key)) {
      return { ok: false, msg: `Missing answer: ${key}` };
    }

    const rawValue = answers[key];
    if (!Number.isInteger(rawValue) || rawValue < 1 || rawValue > 7) {
      return { ok: false, msg: `Invalid score for ${key}. Score must be an integer between 1 and 7` };
    }

    normalized[key] = rawValue;
  }

  return { ok: true, normalized };
}

function transformedScore(rawScore, isReverseQuestion) {
  return isReverseQuestion ? (8 - rawScore) : rawScore;
}

function resolveDimensionLetter({ score, threshold, tieBreakerQuestion, positiveLetter, negativeLetter, answers }) {
  if (score > threshold) {
    return positiveLetter;
  }

  if (score < threshold) {
    return negativeLetter;
  }

  return answers[q(tieBreakerQuestion)] >= 5 ? positiveLetter : negativeLetter;
}

export function computeDimensionScores(answers) {
  const dimensionScores = {};
  const dimensionLetters = {};

  for (const [dimension, config] of Object.entries(DIMENSION_CONFIG)) {
    let score = 0;

    for (const number of config.positiveQuestions) {
      score += transformedScore(answers[q(number)], false);
    }

    for (const number of config.reverseQuestions) {
      score += transformedScore(answers[q(number)], true);
    }

    dimensionScores[dimension] = score;
    dimensionLetters[dimension] = resolveDimensionLetter({
      score,
      threshold: config.threshold,
      tieBreakerQuestion: config.tieBreaker,
      positiveLetter: config.positiveLetter,
      negativeLetter: config.negativeLetter,
      answers
    });
  }

  return {
    dimensionScores,
    dimensionLetters
  };
}

export function computeRoseProfile(answersInput) {
  const validation = validateAnswers(answersInput);
  if (!validation.ok) {
    return { ok: false, msg: validation.msg };
  }

  const answers = validation.normalized;
  const { dimensionScores, dimensionLetters } = computeDimensionScores(answers);
  const roseCode = `${dimensionLetters.A}${dimensionLetters.C}${dimensionLetters.I}${dimensionLetters.R}`;

  return {
    ok: true,
    profile: {
      dimension_scores: dimensionScores,
      dimension_letters: dimensionLetters,
      rose_code: roseCode,
      rose_name: ROSE_TYPE_NAMES[roseCode] || '未知人格',
      answers
    }
  };
}

export function areProfilesCompatible(userA, userB) {
  if (!userA || !userB) {
    return false;
  }

  if (!isValidGender(userA.gender) || !isValidGender(userB.gender)) {
    return false;
  }

  const targetGenderA = resolveTargetGender(userA);
  const targetGenderB = resolveTargetGender(userB);
  if (!isValidTargetGender(targetGenderA) || !isValidTargetGender(targetGenderB)) {
    return false;
  }

  return targetGenderA === userB.gender && targetGenderB === userA.gender;
}

export function evaluateHardFilters(userA, userB) {
  if (!areProfilesCompatible(userA, userB)) {
    return { passed: false, reason: 'profile_mismatch' };
  }

  return { passed: true };
}

export function computeWeightedDistance(scoresA, scoresB) {
  return Math.sqrt(
    (DIMENSION_WEIGHTS.A * ((scoresA.A - scoresB.A) ** 2)) +
    (DIMENSION_WEIGHTS.C * ((scoresA.C - scoresB.C) ** 2)) +
    (DIMENSION_WEIGHTS.I * ((scoresA.I - scoresB.I) ** 2)) +
    (DIMENSION_WEIGHTS.R * ((scoresA.R - scoresB.R) ** 2))
  );
}

function hasPowerAmbitionLoop(userA, userB) {
  const aLeads = userA.answers[q(49)] >= 6 && ((userB.answers[q(2)] + userB.answers[q(6)]) >= 12);
  const bLeads = userB.answers[q(49)] >= 6 && ((userA.answers[q(2)] + userA.answers[q(6)]) >= 12);
  return aLeads || bLeads;
}

function hasChillCompatibility(userA, userB) {
  return (
    userA.answers[q(12)] >= 5
    && userB.answers[q(12)] >= 5
    && userA.answers[q(40)] >= 5
    && userB.answers[q(40)] >= 5
  );
}

function hasCommunicationBalance(userA, userB) {
  return (
    (userA.answers[q(27)] >= 5 && userB.answers[q(25)] >= 5)
    || (userB.answers[q(27)] >= 5 && userA.answers[q(25)] >= 5)
  );
}

function computeComplementaryBonus(userA, userB) {
  let bonus = 0;

  if (hasPowerAmbitionLoop(userA, userB)) {
    bonus += 5;
  }
  if (hasChillCompatibility(userA, userB)) {
    bonus += 3;
  }
  if (hasCommunicationBalance(userA, userB)) {
    bonus += 4;
  }

  return bonus;
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function computeMatchScore(userA, userB) {
  const hardFilterResult = evaluateHardFilters(userA, userB);
  if (!hardFilterResult.passed) {
    return {
      is_match: false,
      reason: hardFilterResult.reason,
      distance: null,
      base_match_percent: 0,
      complementary_bonus: 0,
      final_match_percent: 0
    };
  }

  const distance = computeWeightedDistance(userA.rose.dimension_scores, userB.rose.dimension_scores);
  const baseRaw = Math.max(0, (1 - (distance / THEORETICAL_MAX_DISTANCE)) * 100);

  const bonus = computeComplementaryBonus(userA, userB);

  const finalRaw = Math.min(99.9, baseRaw + bonus);

  return {
    is_match: true,
    reason: 'compatible',
    distance,
    base_match_percent: roundToOneDecimal(baseRaw),
    complementary_bonus: roundToOneDecimal(bonus),
    final_match_percent: roundToOneDecimal(finalRaw)
  };
}

export function buildRarityMap(users) {
  const rarityMap = {};
  for (let index = 1; index <= 50; index += 1) {
    rarityMap[index] = 0;
  }

  for (const user of users) {
    for (let number = 1; number <= 50; number += 1) {
      if (user.answers[q(number)] === 7) {
        rarityMap[number] += 1;
      }
    }
  }

  return rarityMap;
}

function questionWeight(questionNumber) {
  const dimension = QUESTION_DIMENSION_MAP[questionNumber];
  return DIMENSION_WEIGHTS[dimension] || 0;
}

export function getQuestionText(questionNumber) {
  return QUESTION_MAP[questionNumber]?.text || '';
}

export function pickKillerPoint(answersA, answersB, rarityMap = {}) {
  const commonStrongAgree = [];

  for (let number = 1; number <= 50; number += 1) {
    if (answersA[q(number)] === 7 && answersB[q(number)] === 7) {
      commonStrongAgree.push(number);
    }
  }

  if (commonStrongAgree.length > 0) {
    commonStrongAgree.sort((left, right) => {
      const rarityDiff = (rarityMap[left] || 0) - (rarityMap[right] || 0);
      if (rarityDiff !== 0) {
        return rarityDiff;
      }
      return left - right;
    });

    const selected = commonStrongAgree[0];
    return `Q${selected}：${getQuestionText(selected)}`;
  }

  const fallbackCandidates = [];

  for (let number = 1; number <= 50; number += 1) {
    const scoreA = answersA[q(number)];
    const scoreB = answersB[q(number)];
    fallbackCandidates.push({
      number,
      diff: Math.abs(scoreA - scoreB),
      avg: (scoreA + scoreB) / 2,
      weight: questionWeight(number)
    });
  }

  fallbackCandidates.sort((left, right) => {
    if (left.diff !== right.diff) {
      return left.diff - right.diff;
    }

    if (left.weight !== right.weight) {
      return right.weight - left.weight;
    }

    if (left.avg !== right.avg) {
      return right.avg - left.avg;
    }

    return left.number - right.number;
  });

  const selected = fallbackCandidates[0].number;
  return `Q${selected}：${getQuestionText(selected)}`;
}

export function normalizeAnswersForStorage(answersInput) {
  const validation = validateAnswers(answersInput);
  if (!validation.ok) {
    return null;
  }
  return validation.normalized;
}

export function getQuestionCount() {
  return QUESTION_KEYS.length;
}

export function getQuestionDefinitionList() {
  return SURVEY_QUESTIONS;
}
