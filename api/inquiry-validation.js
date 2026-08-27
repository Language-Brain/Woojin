import crypto from 'node:crypto';

export const LIMITS = Object.freeze({ name: 80, email: 254, phone: 40, subject: 160, message: 3000 });

const TAG_OR_CODE = /<\/?(?:script|iframe|object|embed|form|svg|math|style|link|meta)\b|on\w+\s*=|javascript\s*:|data\s*:\s*text\/html/i;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const URL = /(?:https?:\/\/|www\.)[^\s<]+/gi;
const SPAM_WORDS = /(?:카지노|바카라|토토|도박|성인사이트|조건만남|불법대출|대출상담|코인리딩|수익보장|무료머니|베팅|porn|casino|betting|payday\s*loan)/gi;

export function plain(value) {
  return String(value ?? '').replace(CONTROL, '').replace(/\r\n?/g, '\n').trim();
}

export function safeHeader(value) {
  return plain(value).replace(/[\r\n]+/g, ' ').slice(0, 160);
}

export function escapeHtml(value) {
  return plain(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function requestIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(request.headers?.['x-real-ip'] || request.socket?.remoteAddress || 'unknown');
}

export function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function repetitionScore(message) {
  const pieces = message.toLowerCase().split(/\s+/).filter(part => part.length >= 3);
  if (pieces.length < 8) return 0;
  const counts = new Map();
  for (const piece of pieces) counts.set(piece, (counts.get(piece) || 0) + 1);
  const max = Math.max(...counts.values());
  return max >= 6 || max / pieces.length > 0.35 ? 2 : 0;
}

export function validateAndClassify(input, now = Date.now()) {
  const kind = input?.kind === 'lecture' ? 'lecture' : input?.kind === 'question' ? 'question' : '';
  const values = {
    kind,
    name: plain(input?.name) || '익명',
    email: plain(input?.email).toLowerCase(),
    phone: plain(input?.phone),
    subject: plain(input?.subject),
    message: plain(input?.message)
  };
  if (!kind) return { ok: false, status: 400, code: 'invalid_kind' };
  if (plain(input?.website)) return { ok: false, status: 202, code: 'accepted_bot' };
  const startedAt = Number(input?.startedAt);
  if (!Number.isFinite(startedAt) || now - startedAt < 3000 || now - startedAt > 7_200_000) return { ok: false, status: 429, code: 'invalid_timing' };
  for (const [field, limit] of Object.entries(LIMITS)) {
    if (values[field].length > limit) return { ok: false, status: 400, code: `${field}_too_long` };
  }
  if (!values.message || values.message.length < 10) return { ok: false, status: 400, code: 'message_too_short' };
  if (kind === 'lecture' && (!values.name || values.name === '익명' || !values.email || !values.subject)) return { ok: false, status: 400, code: 'required_fields' };
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) return { ok: false, status: 400, code: 'invalid_email' };
  if (TAG_OR_CODE.test(Object.values(values).join('\n'))) return { ok: false, status: 400, code: 'unsafe_content' };
  const links = values.message.match(URL) || [];
  const uniqueLinks = new Set(links.map(link => link.toLowerCase()));
  const spamHits = values.message.match(SPAM_WORDS)?.length || 0;
  const score = (links.length >= 4 ? 2 : 0) + (links.length >= 2 && uniqueLinks.size < links.length ? 2 : 0) + Math.min(spamHits, 3) + repetitionScore(values.message);
  return { ok: true, values, spam: score >= 3, spamReason: score >= 3 ? `자동 판정 점수 ${score} (링크 ${links.length}개)` : '' };
}

export function dedupeKey(values, ipHash, now = Date.now()) {
  const bucket = Math.floor(now / 600000);
  return hash([values.kind, values.email, values.phone, values.subject, values.message, ipHash, bucket].join('|'));
}
