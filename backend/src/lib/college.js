/** 学院仅作资料收集，不参与匹配算法 */
export const COLLEGE_OPTIONS = Object.freeze([
  '哲学社会',
  '文学',
  '考古',
  '历史文化',
  '外国语言文化',
  '艺术',
  '体育',
  '经济',
  '法学',
  '行政',
  '商学与管理',
  '马克思主义',
  '东北亚',
  '公共外交',
  '数学',
  '物理',
  '化学',
  '生命科学',
  '机械与航空航天工程',
  '汽车工程',
  '材料科学与工程',
  '交通',
  '生物与农业工程',
  '仿生科学与工程',
  '电子科学与工程',
  '通信工程',
  '计算机科学与技术',
  '软件',
  '人工智能',
  '地球科学',
  '地球探测科学与技术',
  '建设工程',
  '新能源与环境',
  '仪器科学与电气工程',
  '基础医学',
  '公共卫生',
  '药学',
  '护理',
  '白求恩第一临床',
  '白求恩第二临床',
  '白求恩第三临床',
  '白求恩口腔',
  '预科教育'
]);

export function isValidCollege(value) {
  return typeof value === 'string' && COLLEGE_OPTIONS.includes(value);
}

export function normalizeCollege(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return COLLEGE_OPTIONS.includes(trimmed) ? trimmed : '';
}
