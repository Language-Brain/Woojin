import assert from 'node:assert/strict';
import handler from '../api/guide.js';

const id = '11111111-2222-4333-8444-555555555555';
const row = {
  id,
  title: '문해교육 수업 자료',
  description: '',
  body: '<p>검색엔진이 자바스크립트 없이 읽어야 하는 첫 번째 의미 있는 본문입니다.</p><p><strong>굵은 문장</strong>과 <a href="https://example.com/reference">참고 링크</a>입니다.</p><script>alert(1)</script>',
  tags: ['문해교육', '수업 자료'],
  external_links: [{ label: '관련 자료', url: 'https://example.org/resource' }],
  visibility: 'public',
  status: 'active',
  view_count: 12,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-11T00:00:00.000Z'
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.match(String(url), /\/rest\/v1\/guides\?/);
  return { ok: true, json: async () => [row] };
};

let statusCode = 0;
const headers = new Map();
let html = '';
const response = {
  setHeader(name, value) { headers.set(name.toLowerCase(), value); },
  status(value) { statusCode = value; return this; },
  send(value) { html = value; return this; }
};

try {
  await handler({ query: { id } }, response);
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(statusCode, 200);
assert.equal(headers.get('content-type'), 'text/html; charset=utf-8');
assert.match(headers.get('cache-control'), /s-maxage=300/);
assert.match(html, /<title>문해교육 수업 자료 \| 리터러시 톡톡<\/title>/);
assert.match(html, /<meta name="description" content="검색엔진이 자바스크립트 없이 읽어야 하는 첫 번째 의미 있는 본문입니다/);
assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
assert.match(html, new RegExp(`<link rel="canonical" href="https://literacy-korea\\.com/guide\\?id=${id}">`));
assert.match(html, /<meta property="og:type" content="article">/);
assert.match(html, /<meta name="twitter:card" content="summary">/);
assert.match(html, /<meta property="article:tag" content="문해교육">/);
assert.match(html, /"@type":"Article"/);
assert.match(html, /"headline":"문해교육 수업 자료"/);
assert.match(html, /<h1>문해교육 수업 자료<\/h1>/);
assert.match(html, /검색엔진이 자바스크립트 없이 읽어야 하는 첫 번째 의미 있는 본문입니다/);
assert.match(html, /target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);

const vercel = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(vercel.rewrites.some(item => item.source === '/guide' && item.destination === '/api/guide'));

console.log('guide SEO server-render tests passed');
