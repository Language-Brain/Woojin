import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync(new URL('../pyeongjae/index.html',import.meta.url),'utf8');
const list=fs.readFileSync(new URL('../pyeongjae/archive-list.js',import.meta.url),'utf8');
const guides=fs.readFileSync(new URL('../guides/guide-list.js',import.meta.url),'utf8');
const home=fs.readFileSync(new URL('../customer/index.html',import.meta.url),'utf8');

for(const value of ['data-book=""','data-book="1"','data-book="2"','data-book="3"','data-genre="시"','data-genre="서간"','data-genre="복합"','data-genre="경계"','id="recommended-filter"','id="query"'])assert.ok(page.includes(value),value);
assert.ok(!page.includes('권차·글 종류로 평재문집 자세히 찾기'));
assert.ok(list.includes("(book === '1' && isGuide(row))"),'guides remain above book 1');
assert.ok(list.includes("if (genre || recommended) book = ''"),'genre URLs search all books');
assert.ok(list.includes("if (genre) book = ''"),'genre clicks reset book');
assert.ok(list.includes("book = button.dataset.book;\n      genre = '';\n      recommended = false;"),'book clicks clear lower filters');
assert.ok(list.includes("recommended = !recommended;\n    if (recommended) {\n      book = '';\n      genre = '';"),'recommended searches all books');
assert.ok(list.includes("`제1책 ${sourceCount}건 · 안내 글 ${guideCount}건`"),'book 1 counts distinguish guides');
assert.ok(guides.includes('location.replace(target.href)'),'legacy pyeongjae scope redirects to expanded archive');
assert.ok(home.includes('href="/pyeongjae">평재문집 목록'));
assert.ok(home.includes("row.name==='평재문집'?'/pyeongjae'"));
new Function(list);
new Function(guides);
console.log('pyeongjae public filters: PASS');