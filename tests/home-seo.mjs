import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { descriptionFor } from '../api/_seo.js';

const home = readFileSync(new URL('../customer/index.html', import.meta.url), 'utf8');
const seo = readFileSync(new URL('../api/_seo.js', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../api/sitemap.js', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
const description = '삶과 언어는 문해, 인지, 한국어 교육(KSL, KFL)을 중심으로 논문, 관련 기사와 연구 원고를 소개하는 권우진의 연구 공간입니다.';

assert.match(home, /<title>삶과 언어 \| 권우진 연구실<\/title>/);
assert.ok(home.includes(`<meta name="description" content="${description}">`));
assert.match(home, /<meta property="og:title" content="삶과 언어 \| 권우진 연구실">/);
assert.ok(home.includes(`<meta property="og:description" content="${description}">`));
assert.match(home, /<meta name="twitter:title" content="삶과 언어 \| 권우진 연구실">/);
assert.ok(home.includes(`<meta name="twitter:description" content="${description}">`));
assert.match(home, /<link rel="canonical" href="https:\/\/languagebrain\.vercel\.app\/">/);
assert.match(home, /<meta name="robots" content="index, follow, max-image-preview:large">/);
assert.match(home, /"@type":"WebSite"[^}]*"name":"삶과 언어","alternateName":"권우진 연구실"/);
assert.match(seo, /post\.seo_description \|\| post\.excerpt \|\| meaningfulBodyText\(post\.content_html, post\)/);
assert.match(seo, /return `\$\{sample\.slice\(0, cut\)\.trim\(\)\}…`/);
assert.match(sitemap, /select=id,type,updated_at,published_at/);
assert.match(sitemap, /status=eq\.published&type=in\.\(paper,news,works\)/);
assert.match(sitemap, /status=eq\.active&visibility=eq\.public/);
assert.match(sitemap, /lastmod: latest\(posts\.filter\(post => post\.type === 'paper'\)\)/);
assert.match(robots, /User-agent: \*\s+Allow: \/\s+Disallow: \/admin\s+Disallow: \/api\//);
assert.match(robots, /Sitemap: https:\/\/languagebrain\.vercel\.app\/sitemap\.xml/);
assert.equal(descriptionFor({ seo_description: '별도 검색 설명', excerpt: '기존 설명', content_html: '<p>본문 설명입니다.</p>' }), '별도 검색 설명');
assert.equal(descriptionFor({ content_html: '<h2>소제목</h2><p>이 문장은 검색 설명에 사용할 첫 번째 의미 있는 본문 문단입니다.</p><p>다음 문단입니다.</p>' }), '이 문장은 검색 설명에 사용할 첫 번째 의미 있는 본문 문단입니다. 다음 문단입니다.');
assert.equal(descriptionFor({ title: '반복 제목', authors: '홍길동', content_html: '<p>반복 제목</p><p>홍길동</p><p>검색 설명에는 실제 본문의 첫 번째 의미 있는 문장이 사용되어야 합니다.</p>' }), '검색 설명에는 실제 본문의 첫 번째 의미 있는 문장이 사용되어야 합니다.');
assert.equal(descriptionFor({ content_html: '<p>Skin cleansing practices for older people: a systematic review</p><p>「노인의 피부 세정 방법: 체계적 문헌고찰」</p><p>Fiona Cowdell, Katerina Steventon</p><p>Cowdell, F. (2015). Journal, 10(1), 3–13.</p><p>DOI: 10.1111/example</p><p>○ 주요 메시지</p><p>노인의 피부를 씻는 일은 단순한 개인위생을 넘어 피부 건강을 유지하는 건강관리의 문제이다.</p>' }), '노인의 피부를 씻는 일은 단순한 개인위생을 넘어 피부 건강을 유지하는 건강관리의 문제이다.');
assert.doesNotMatch(descriptionFor({ content_html: '<p>검색 설명에 포함할 충분히 긴 문장입니다. https://example.com/image.jpg 불필요한 주소는 제거합니다.</p>' }), /https?:|<p>/);

console.log('home and article SEO: PASS');
