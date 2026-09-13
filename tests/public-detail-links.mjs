import assert from 'node:assert/strict';
import fs from 'node:fs';

const links=fs.readFileSync(new URL('../customer/public-links.js',import.meta.url),'utf8');
const article=fs.readFileSync(new URL('../api/article.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../guide/index.html',import.meta.url),'utf8');
const pyeongjae=fs.readFileSync(new URL('../api/pyeongjae.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../pyeongjae/pyeongjae.css',import.meta.url),'utf8');

new Function(links);
for(const token of [
  "/https?:\\/\\/[^\\s<>\"']+/gi",
  "['http:', 'https:'].includes(url.protocol)",
  "a,script,style,code,pre,textarea",
  "url.origin !== location.origin",
  "anchor.target = '_blank'",
  "anchor.rel = 'noopener noreferrer'",
  "anchor.removeAttribute('target')",
  'trailingCharacters',
  'MutationObserver'
])assert.ok(links.includes(token),token);
assert.ok(article.includes('data-public-linkify'));
assert.ok(article.includes('/customer/public-links.js?v=20260914-1'));
assert.ok(guide.includes('data-public-linkify'));
assert.ok(guide.includes('/customer/public-links.js?v=20260914-1'));
assert.ok(pyeongjae.includes('data-public-linkify'));
assert.ok(pyeongjae.includes('/customer/public-links.js?v=20260914-1'));
for(const area of ["section('원문과 음독'","section('현대어 직역'","section('현대어 의역'","section('참고'",'reference_links'])assert.ok(pyeongjae.includes(area),area);
for(const rule of ['.pyeongjae-text a','.pyeongjae-guide-body a','overflow-wrap:anywhere','word-break:break-word'])assert.ok(css.includes(rule),rule);
console.log('public detail automatic links: PASS');
