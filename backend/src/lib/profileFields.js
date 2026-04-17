import { normalizeGrade } from 'lib/grade';

function graphemeCount(text) {
  return [...text].length;
}

export function normalizeNicknameInput(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, msg: '昵称格式无效', value: '' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }
  if (graphemeCount(trimmed) > 20) {
    return { ok: false, msg: '昵称不能超过20个字', value: '' };
  }
  return { ok: true, value: trimmed };
}

export function normalizeMessageToPartnerInput(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, msg: '想说的话格式无效', value: '' };
  }
  const trimmed = raw.trim();
  if (graphemeCount(trimmed) > 300) {
    return { ok: false, msg: '想说的话不能超过300个字', value: '' };
  }
  return { ok: true, value: trimmed };
}

export function normalizeGradeInput(raw) {
  const g = normalizeGrade(typeof raw === 'string' ? raw : '');
  if (!g) {
    return { ok: false, msg: '请选择年级', value: '' };
  }
  return { ok: true, value: g };
}

export function normalizeMatchContactInput(body) {
  const share =
    body?.share_contact_with_match === true
    || body?.share_contact_with_match === 'true';
  const raw = typeof body?.match_contact_detail === 'string' ? body.match_contact_detail.trim() : '';
  if (!share) {
    return { ok: true, share: false, detail: '' };
  }
  if (!raw || graphemeCount(raw) > 20) {
    return { ok: false, msg: '选择向对方展示联系方式时，请填写联系方式（1～20字）' };
  }
  return { ok: true, share: true, detail: raw };
}
