import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const js=read('../archive/archive.js');
const css=read('../archive/archive.css');
const archive=read('../archive/index.html');
const home=read('../customer/index.html');
const admin=read('../admin/index.html');
const articleApi=read('../api/article.js');

assert.match(js,/function listSummary\(row\)/,'archive lists need one shared automatic summary resolver');
assert.match(js,/row\.content_html\|\|row\.content/,'the fallback summary must read the saved body');
assert.match(js,/querySelectorAll\('script,style,noscript,img,picture,figure,figcaption,table,pre,code/,'unsafe and non-prose elements must be removed');
assert.match(js,/text\.length>=18/,'very short metadata fragments must be skipped');
assert.match(js,/row\.original_title,row\.authors,row\.journal,row\.source,row\.publisher/,'paper titles, authors, journals, and sources must be skipped');
assert.match(js,/_listSummary:listSummary\(row\)/,'summaries must be calculated once when rows load');
assert.match(js,/if\(kind==='papers'\|\|kind==='news'\) return compactPostCard\(row\)/);
assert.match(js,/문해, 한국어 교육, 디지털리터러시, 인지 능력 등과 관련한 뉴스를 살펴봅니다\./);
assert.match(css,/\.compact-list-row\{[^}]*grid-template-columns:minmax\(0,1fr\) 180px/);
assert.match(css,/@media\(max-width:620px\)[\s\S]*\.compact-list-thumb\{width:96px;height:72px\}/);
assert.doesNotMatch(admin,/목록 설명\(선택\)/);
assert.match(admin,/<input id="post-excerpt" type="hidden">/);
assert.match(js,/if\(!html\)\{[\s\S]*row\.excerpt,row\.subtitle,row\.description/,'saved descriptions are preserved only when the body is empty');
assert.match(archive,/<a class="brand" href="\/">삶과 언어<\/a>/);
assert.match(home,/<a class="brand" href="#top">삶과 언어<\/a>/);
assert.match(home,/<title>삶과 언어 \| 권우진 연구실<\/title>/);
assert.match(home,/© 2026 삶과 언어/);
assert.match(articleApi,/og:site_name" content="삶과 언어"/);
assert.doesNotMatch(home,/<a class="brand"[^>]*>언어와 뇌<\/a>/);

console.log('archive summaries, compact lists, and public brand: PASS');
