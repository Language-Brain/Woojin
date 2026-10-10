import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../customer/index.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../customer/bilingual-titles.css', import.meta.url), 'utf8');

assert.match(home, /content:"Literacy Talk-Talk"/);
assert.match(home, /content:"Life & Language"/);
assert.match(home, /Libre Baskerville/);
assert.match(home, /color:#716C66/);
assert.match(home, /font:700 17px/);
assert.match(home, /font:700 45px/);
assert.match(home, /font-size:14px/);
assert.match(home, /font-size:31px/);
assert.ok(
  home.indexOf("heroLead.replaceChildren(makeHeroLine('문해(Literacy), 인지(Cognition), 한국어 교육(KSL, KFL)을')") <
  home.indexOf("heroDescription.replaceChildren(makeHeroLine('삶과 언어는 권우진이 언어와 삶, 문해교육,')"),
  'the literacy paragraph should precede the site introduction paragraph'
);
assert.match(home, /\.hero \.hero-en,\.hero \.hero-ko\{width:auto;max-width:none;color:#686868;font:400 17px\/1\.58 var\(--sans\);letter-spacing:0\}/);
assert.match(shared, /content: "Literacy Talk-Talk"/);
assert.match(shared, /font-family: "Libre Baskerville", serif/);
assert.match(shared, /font-weight: 700/);
assert.match(shared, /color: #716C66/);
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
