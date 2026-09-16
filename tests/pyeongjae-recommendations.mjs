import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync(new URL('../pyeongjae/archive-list.js',import.meta.url),'utf8');
const guides=fs.readFileSync(new URL('../guides/guide-list.js',import.meta.url),'utf8');
const rowCss=fs.readFileSync(new URL('../pyeongjae/list-row.css',import.meta.url),'utf8');
const detailCss=fs.readFileSync(new URL('../pyeongjae/pyeongjae.css',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../admin/admin.js',import.meta.url),'utf8');

for(const text of ["params.get('recommended') === '1'","next.searchParams.set('recommended', '1')",'row.recommended_reading === true','row.reading_guide','아직 추천해서 읽을 자료가 없습니다.'])assert.ok(archive.includes(text),text);
for(const text of ['recommended_reading,reading_guide','row.reading_guide','reading-star','reading-guide'])assert.ok(guides.includes(text),text);
for(const text of ['white-space:nowrap','text-overflow:ellipsis','.face-title-main','.reading-guide'])assert.ok(rowCss.includes(text),text);
for(const text of ['h1.has-reading-guide','.reader-reading-star','.reader-reading-guide','text-overflow:ellipsis'])assert.ok(detailCss.includes(text),text);
for(const text of ["recommended_reading:$('#pj-recommended-reading').checked",'reading_guide:readingGuide','readingGuide.length>60',"recommended_reading:false,reading_guide:''"])assert.ok(admin.includes(text),text);
assert.ok(!/sort\([^)]*recommended_reading/.test(archive),'추천 여부가 목록 정렬 기준이 되어서는 안 됩니다.');
console.log('pyeongjae recommendations: PASS');
