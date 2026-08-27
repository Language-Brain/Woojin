import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dedupeKey, escapeHtml, safeHeader, validateAndClassify } from '../api/inquiry-validation.js';

const now = Date.now();
const base = { kind: 'lecture', name: '홍길동', email: 'reader@example.com', phone: '010-1234-5678', subject: '성인 문해교육 강의 문의', message: '성인 학습자를 위한 문해교육 강의를 문의드립니다.', website: '', startedAt: now - 10_000 };

assert.equal(validateAndClassify(base, now).ok, true, '정상 한국어 강의 문의');
assert.equal(validateAndClassify({ ...base, kind: 'question', name: '', email: '', subject: '', message: '읽기 활동과 인지 건강의 관계가 궁금합니다.' }, now).ok, true, '정상 질문 제안');
assert.equal(validateAndClassify({ ...base, email: 'not-an-email' }, now).code, 'invalid_email');
assert.equal(validateAndClassify({ ...base, website: 'https://bot.example' }, now).code, 'accepted_bot');
assert.equal(validateAndClassify({ ...base, startedAt: now - 500 }, now).code, 'invalid_timing');
assert.equal(validateAndClassify({ ...base, message: '가'.repeat(3001) }, now).code, 'message_too_long');
assert.equal(validateAndClassify({ ...base, message: '<script>alert(1)</script> 강의 문의입니다.' }, now).code, 'unsafe_content');
assert.equal(validateAndClassify({ ...base, message: '카지노 무료머니 https://a.example https://a.example https://b.example https://c.example' }, now).spam, true, '광고 링크 스팸 분류');
assert.equal(escapeHtml('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
assert.equal(safeHeader('제목\r\nBcc: attacker@example.com'), '제목 Bcc: attacker@example.com');

const first = dedupeKey(base, 'iphash', now);
assert.equal(first, dedupeKey(base, 'iphash', now + 1000), '같은 시간 구간 중복 키');
assert.notEqual(first, dedupeKey({ ...base, message: `${base.message} 추가` }, 'iphash', now), '다른 문의 키');

const api = fs.readFileSync(new URL('../api/inquiries.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../customer/index.html', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260827_secure_inquiries_email.sql', import.meta.url), 'utf8');
assert.match(api, /Idempotency-Key/);
assert.match(api, /email_status: 'failed'/);
assert.match(api, /reply_to: row\.email/);
assert.match(api, /status: checked\.spam \? 'spam' : 'new'/);
assert.match(page, /fetch\('\/api\/inquiries'/);
assert.doesNotMatch(page, /from\('inquiries'\)\.insert/);
assert.match(page, /class="inquiry-honeypot"/);
assert.match(admin, /escapeText\(item\.question\)/);
assert.match(admin, /item\.status === 'spam'/);
assert.match(migration, /revoke insert on public\.inquiries from anon, authenticated/);
assert.match(migration, /inquiries_admin_select/);
const inlineScripts = [...page.matchAll(/<script(?![^>]*application\/ld\+json)(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
for (const script of inlineScripts) new Function(script);
assert.equal((page.match(/\.secure-inquiry\{position:relative\}/g) || []).length, 1, '문의 CSS 중복 없음');
assert.equal((page.match(/class="inquiry-honeypot"/g) || []).length, 2, '두 양식 허니팟');console.log('inquiry security: PASS');
