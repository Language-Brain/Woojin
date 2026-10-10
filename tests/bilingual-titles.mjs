import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../customer/index.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../customer/bilingual-titles.css', import.meta.url), 'utf8');

assert.match(home, /content:"Literacy Talk-Talk"/);
assert.match(home, /content:"Life & Language"/);
assert.match(home, /Libre Baskerville/);
assert.match(home, /color:#55514C/);
assert.match(home, /font:700 17px/);
assert.match(home, /font:700 45px/);
assert.match(home, /font-size:14px/);
assert.match(home, /font-size:31px/);
assert.ok(
  home.indexOf("heroLead.textContent='문해(Literacy), 인지(Cognition), 한국어 교육(KSL, KFL)을 포함한 여러 화두는 서로 연결되어 있습니다.'") <
  home.indexOf("heroDescription.textContent='삶과 언어는 권우진이 언어와 삶, 문해교육, 읽기와 쓰기, 인지와 인간의 활동을 탐구하고 연구 자료를 나누는 연구실입니다.'"),
  'the literacy paragraph should precede the site introduction paragraph'
);
assert.match(home, /\.hero-en,\.hero-ko\{color:#686868\}/);
assert.match(shared, /content: "Literacy Talk-Talk"/);
assert.match(shared, /font-family: "Libre Baskerville", serif/);
assert.match(shared, /font-weight: 700/);
assert.match(shared, /color: #55514C/);
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
