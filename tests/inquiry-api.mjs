import assert from 'node:assert/strict';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
process.env.RESEND_API_KEY = 'test-resend';
process.env.INQUIRY_TO_EMAIL = 'owner@example.com';
process.env.INQUIRY_HASH_SALT = 'test-hash-salt';

const { default: handler } = await import(`../api/inquiries.js?test=${Date.now()}`);
const now = Date.now();
const validBody = { kind: 'lecture', name: '홍길동', email: 'reader@example.com', phone: '', subject: '강의 문의', message: '성인 문해교육 강의를 문의드립니다.', website: '', startedAt: now - 5000 };

function responseMock() {
  return { headers: {}, code: 0, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

function okJson(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data), json: async () => data };
}

let mode = 'success';
let calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/rest/v1/inquiries?select=id')) return okJson([]);
  if (String(url).endsWith('/rest/v1/inquiries') && options.method === 'POST') {
    if (mode === 'duplicate') return { ok: false, status: 409, text: async () => '23505 duplicate key' };
    return okJson([{ id: '11111111-1111-1111-1111-111111111111', kind: 'lecture', name: '홍길동', email: 'reader@example.com', phone: '', subject: '강의 문의', question: validBody.message }], 201);
  }
  if (String(url).includes('api.resend.com')) return mode === 'email-failure' ? okJson({ message: 'temporary failure' }, 503) : okJson({ id: 'email-1' });
  if (options.method === 'PATCH') return okJson([{}]);
  throw new Error(`unexpected fetch ${url}`);
};

let response = responseMock();
await handler({ method: 'POST', body: validBody, headers: { 'x-forwarded-for': '203.0.113.7' } }, response);
assert.equal(response.code, 201);
assert.equal(calls.filter(call => call.url.includes('api.resend.com')).length, 1);
assert.match(calls.find(call => call.url.includes('api.resend.com')).options.body, /"reply_to":"reader@example.com"/);
assert.match(calls.find(call => call.options.method === 'PATCH').options.body, /"email_status":"sent"/);

mode = 'duplicate'; calls = []; response = responseMock();
await handler({ method: 'POST', body: validBody, headers: { 'x-forwarded-for': '203.0.113.7' } }, response);
assert.equal(response.code, 202);
assert.equal(calls.some(call => call.url.includes('api.resend.com')), false, '중복 이메일 미발송');

mode = 'email-failure'; calls = []; response = responseMock();
await handler({ method: 'POST', body: validBody, headers: { 'x-forwarded-for': '203.0.113.8' } }, response);
assert.equal(response.code, 201, '메일 장애에도 문의 접수');
assert.equal(calls.filter(call => call.url.includes('api.resend.com')).length, 2, '제한 재시도');
assert.match(calls.findLast(call => call.options.method === 'PATCH').options.body, /"email_status":"failed"/);

mode = 'success'; calls = []; response = responseMock();
await handler({ method: 'POST', body: { ...validBody, website: 'bot-filled' }, headers: {} }, response);
assert.equal(response.code, 202);
assert.equal(calls.length, 0, '허니팟 요청은 저장 안 함');

console.log('inquiry api: PASS');
