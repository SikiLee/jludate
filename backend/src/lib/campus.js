export const CAMPUS_OPTIONS = Object.freeze([
  '南区',
  '北区',
  '南岭',
  '南湖',
  '新民',
  '朝阳',
  '和平'
]);

export function isValidCampus(value) {
  return typeof value === 'string' && CAMPUS_OPTIONS.includes(value);
}

export function normalizeCampus(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return CAMPUS_OPTIONS.includes(trimmed) ? trimmed : '';
}
