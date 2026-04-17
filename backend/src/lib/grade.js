export const GRADE_OPTIONS = Object.freeze([
  '大一',
  '大二',
  '大三',
  '大四',
  '研一',
  '研二',
  '研三',
  '博一',
  '博二',
  '博三',
  '博四',
  '博五'
]);

export function isValidGrade(value) {
  return typeof value === 'string' && GRADE_OPTIONS.includes(value);
}

export function normalizeGrade(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return GRADE_OPTIONS.includes(trimmed) ? trimmed : '';
}
