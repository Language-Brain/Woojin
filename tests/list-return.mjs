import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const module=read('customer/list-return.js');
const article=read('api/article.js');
const articleTemplate=read('api/article-template.js');
const guide=read('api/guide.js');
const pyeongjae=read('api/pyeongjae.js');
const video=read('api/video.js');
const archive=read('archive/archive.js');
const pyeongjaeList=read('pyeongjae/archive-list.js');

new Function(module);
assert.match(module,/origin===location\.origin&&LIST_PATHS\.has/);
assert.match(module,/DETAIL_PATHS\.has/);
assert.match(module,/sessionStorage\.setItem\(CONTEXT_KEY/);
assert.match(module,/scrollY:window\.scrollY/);
assert.match(module,/location\.assign\(target\)/);
assert.doesNotMatch(module,/history\.back\(\)/);
assert.match(module,/setTimeout\(restore,800\)/);
assert.doesNotMatch(module,/localStorage/);
for(const source of [article,guide,pyeongjae,video]){
  assert.match(source,/data-list-return/);
  assert.match(source,/customer\/list-return\.js\?v=20261013-2/);
  assert.match(source,/공유하기/);
  assert.match(source,/목록 보기/);
}
assert.match(article,/post\.type === 'paper' \? '\/papers'/);
assert.match(articleTemplate,/\.share-button\{display:inline-flex;width:112px/);
assert.match(articleTemplate,/shareMarkup=data=>/);
assert.match(articleTemplate,/data-list-return data-list-fallback/);
assert.match(module,/MutationObserver\(bind\)/);
assert.match(guide,/data-list-fallback="\/guides"/);
assert.match(pyeongjae,/data-list-fallback="\/pyeongjae"/);
assert.match(video,/data-list-fallback="\/videos"/);
assert.match(archive,/params\.get\('q'\)\?\?savedState\.q/);
assert.match(archive,/saveState\(true\)/);
assert.match(pyeongjaeList,/params\.get\('page'\)/);
assert.match(pyeongjaeList,/next\.searchParams\.set\('page'/);
for(const page of ['archive/index.html','archive/news.html','archive/works.html','archive/videos.html','guides/index.html','pyeongjae/index.html','search/index.html','customer/index.html'])assert.match(read(page),/customer\/list-return\.js\?v=20261013-2/,page);

console.log('safe list return controls: PASS');
