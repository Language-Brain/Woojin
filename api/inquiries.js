import { dedupeKey, escapeHtml, hash, requestIp, safeHeader, validateAndClassify } from './inquiry-validation.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhaosgzyvoijgwryybry.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const TO_EMAIL = process.env.INQUIRY_TO_EMAIL || '';
const FROM_EMAIL = process.env.INQUIRY_FROM_EMAIL || '언어와 뇌 홈페이지 <onboarding@resend.dev>';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://languagebrain.vercel.app').replace(/\/$/, '');

function json(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(status).json(body);
}

async function supabase(path, options = {}) {
  if (!SERVICE_KEY) throw new Error('server_not_configured');
  const serviceHeaders = { apikey: SERVICE_KEY };
  if (!SERVICE_KEY.startsWith('sb_secret_')) serviceHeaders.Authorization = `Bearer ${SERVICE_KEY}`;
  const result = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) }
  });
  const text = await result.text();
  if (!result.ok) {
    const detail = text.toLowerCase();
    const category = /invalid (?:api )?key|no api key/.test(detail) ? 'invalid_key' : /permission denied|insufficient_privilege/.test(detail) ? 'permission' : /row.level|rls/.test(detail) ? 'rls' : /jwt/.test(detail) ? 'jwt' : /column|schema cache/.test(detail) ? 'schema' : 'request';
    const error = new Error(`database_${result.status}_${category}`);
    error.detail = text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

async function checkRateLimit(ipHash) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const rows = await supabase(`inquiries?select=id&source_ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(since)}&limit=6`);
  return (rows || []).length < 5;
}

function emailContent(row) {
  const kind = row.kind === 'lecture' ? '강의 문의' : '질문 제안';
  const subject = `[언어와 뇌] ${kind} · ${safeHeader(row.subject || row.question.slice(0, 40))}`;
  const adminUrl = `${SITE_URL}/admin`;
  const text = `${kind}\n\n이름: ${row.name}\n이메일: ${row.email || '-'}\n연락처: ${row.phone || '-'}\n제목: ${row.subject || '-'}\n\n${row.question}\n\n관리자 확인: ${adminUrl}`;
  const html = `<h2>${escapeHtml(kind)}</h2><p><strong>이름</strong>: ${escapeHtml(row.name)}</p><p><strong>이메일</strong>: ${escapeHtml(row.email || '-')}</p><p><strong>연락처</strong>: ${escapeHtml(row.phone || '-')}</p><p><strong>제목</strong>: ${escapeHtml(row.subject || '-')}</p><hr><p style="white-space:pre-wrap">${escapeHtml(row.question)}</p><p><a href="${adminUrl}">관리자 화면에서 확인</a></p>`;
  return { subject, text, html };
}

async function sendEmail(row) {
  if (!RESEND_KEY || !TO_EMAIL) throw new Error('email_not_configured');
  const content = emailContent(row);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `inquiry-${row.id}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [TO_EMAIL], reply_to: row.email || undefined, ...content })
      });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(`resend_${result.status}_${safeHeader(body.message || '')}`);
      return body.id || '';
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  throw lastError;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { ok: false, message: '허용되지 않은 요청입니다.' });
  if (Number(request.headers?.['content-length'] || 0) > 20000) return json(response, 413, { ok: false, message: '입력 내용이 너무 깁니다.' });
  const checked = validateAndClassify(request.body || {});
  if (!checked.ok) {
    if (checked.code === 'accepted_bot') return json(response, 202, { ok: true });
    return json(response, checked.status, { ok: false, message: checked.status === 429 ? '잠시 후 다시 시도해 주세요.' : '입력 내용을 확인해 주세요.' });
  }
  const hashSalt = process.env.INQUIRY_HASH_SALT || SERVICE_KEY.slice(-24);
  const ipHash = hash(`${requestIp(request)}|${hashSalt}`);
  try {
    if (!(await checkRateLimit(ipHash))) return json(response, 429, { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    const dedupe = dedupeKey(checked.values, ipHash);
    const payload = {
      kind: checked.values.kind,
      name: checked.values.name,
      email: checked.values.email,
      phone: checked.values.phone,
      subject: checked.values.subject,
      question: checked.values.message,
      status: checked.spam ? 'spam' : 'new',
      spam_reason: checked.spamReason,
      email_status: checked.spam ? 'suppressed' : 'pending',
      source_ip_hash: ipHash,
      dedupe_key: dedupe,
      is_read: false,
      is_public: false
    };
    let rows;
    try {
      rows = await supabase('inquiries', { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) {
      if (/23505|duplicate/i.test(error.detail || '')) return json(response, 202, { ok: true, duplicate: true });
      throw error;
    }
    const row = rows?.[0];
    if (!row || checked.spam) return json(response, 202, { ok: true });
    try {
      const providerId = await sendEmail(row);
      await supabase(`inquiries?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ email_status: 'sent', email_provider_id: providerId, email_error: '', email_sent_at: new Date().toISOString() }) });
    } catch (error) {
      await supabase(`inquiries?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ email_status: 'failed', email_error: safeHeader(error.message).slice(0, 240) }) }).catch(() => {});
    }
    return json(response, 201, { ok: true });
  } catch (error) {
    console.error('inquiry_submit_failed', safeHeader(error.message));
    return json(response, 503, { ok: false, message: '지금은 문의를 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
