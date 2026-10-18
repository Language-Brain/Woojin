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

assert.match(adminHtml, /id="post-paper-nature"[\s\S]*value="formal_paper">정식 논문[\s\S]*value="research_note">연구노트/);
assert.match(adminJs, /post-type'\)\.value === 'paper' \? \$\('#post-paper-nature'\)\.value : \$\('#post-subtype'\)\.value/);
assert.match(adminJs, /working\.type === 'paper' && working\.content_subtype === 'research_note'/);
assert.match(adminJs, /post\.type === 'paper' && post\.content_subtype === 'research_note'/);
assert.match(home, /type==='paper'&&row\.content_subtype==='research_note'/);
assert.match(home, /label=match\?\.\[1\]\|\|row\.category\|\|row\.source/);
assert.match(archive, /kind==='papers'&&row\.content_subtype==='research_note'/);
assert.match(archive, /researchBadge}<span class="card-kicker">\[\$\{esc\(row\.category/);
assert.match(search, /row\.type==='paper'&&row\.content_subtype==='research_note'/);
assert.match(search, /category,content_subtype,title/);
assert.match(article, /post\.type === 'paper' && post\.content_subtype === 'research_note'/);
assert.match(article, /data-server-rendered/);
assert.match(badgeCss, /background:#768a42/);
assert.match(badgeCss, /color:#fff/);
assert.doesNotMatch(badgeCss, /border-radius:(?:999|50%)/);

console.log('research-note badge checks passed');
