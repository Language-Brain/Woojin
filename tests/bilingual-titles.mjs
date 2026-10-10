import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../customer/index.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../customer/bilingual-titles.css', import.meta.url), 'utf8');

assert.match(home, /content:"Literacy Talk-Talk"/);
assert.match(home, /content:"Life & Language"/);
assert.match(home, /Cormorant Garamond/);
assert.match(home, /color:#8A837A/);
assert.match(home, /font:500 13px/);
assert.match(home, /font:500 18px/);
assert.match(home, /font-size:11px/);
assert.match(home, /font-size:14px/);
assert.match(shared, /content: "Literacy Talk-Talk"/);
assert.match(shared, /font-weight: 500/);
assert.match(shared, /color: #8A837A/);
assert.match(shared, /white-space: nowrap !important/);

for (const relative of [
  '../archive/index.html', '../archive/news.html', '../archive/works.html', '../archive/videos.html',
  '../guides/index.html', '../guide/index.html', '../pyeongjae/index.html', '../search/index.html',
  '../api/article-template.js', '../api/pyeongjae.js', '../api/video.js'
]) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  assert.match(source, /bilingual-titles\.css/, `${relative} should load the shared bilingual brand style`);
}

console.log('bilingual title labels: PASS');
