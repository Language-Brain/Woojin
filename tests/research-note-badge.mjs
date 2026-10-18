import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const adminHtml = read('admin/index.html');
const adminJs = read('admin/admin.js');
const home = read('customer/index.html');
const archive = read('archive/archive.js');
const search = read('search/index.html');
const article = read('api/article.js');
const badgeCss = read('customer/research-note-badge.css');

assert.doesNotMatch(adminHtml, /post-paper-nature|글의 성격/);
assert.match(adminJs, /categories\.map\(row => row\.name\), '연구노트'/);
assert.match(adminJs, /post\.type === 'paper' && post\.category === '연구노트'/);
assert.match(home, /type==='paper'&&row\.category==='연구노트'/);
assert.match(home, /label=match\?\.\[1\]\|\|row\.category\|\|row\.source/);
assert.match(archive, /kind==='papers'&&row\.category==='연구노트'/);
assert.match(archive, /categoryLabel=isResearchNote\?'<span class="research-note-badge">연구노트<\/span>'/);
assert.match(search, /row\.type==='paper'&&row\.category==='연구노트'/);
assert.match(search, /category,content_subtype,title/);
assert.match(article, /post\.type === 'paper' && post\.category === '연구노트'/);
assert.match(article, /data-server-rendered/);
assert.match(badgeCss, /background:#768a42/);
assert.match(badgeCss, /color:#fff/);
assert.doesNotMatch(badgeCss, /border-radius:(?:999|50%)/);

console.log('research-note badge checks passed');
