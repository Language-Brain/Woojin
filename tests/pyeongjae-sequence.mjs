import assert from 'node:assert/strict';
import fs from 'node:fs';
const adminHtml=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const adminEnhancements=fs.readFileSync(new URL('../admin/pyeongjae-list-enhancements.js',import.meta.url),'utf8');
const publicSequence=fs.readFileSync(new URL('../pyeongjae/list-sequence.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../api/pyeongjae.js',import.meta.url),'utf8');
assert.ok(adminHtml.includes('id="new-pyeongjae-bottom"'));
assert.ok(adminHtml.includes('class="pj-sequence-head"'));
for(const source of [adminEnhancements,publicSequence]){
  assert.ok(source.includes("value === 'back' ? 1 : 0"));
  assert.ok(source.includes(".eq('status', 'published')"));
  assert.ok(source.includes('index + 1'));
}
assert.ok(adminEnhancements.includes("bottomButton.addEventListener('click', () => topButton.click())"));
assert.ok(publicSequence.includes("new MutationObserver(decorate)"));
assert.ok(api.includes('reader-bottom-position'));
assert.ok(api.includes('nav(false)'));
const faceOrder=value=>value==='back'?1:0;
const compare=(a,b)=>Number(a.book_no)-Number(b.book_no)||Number(a.sheet_no)-Number(b.sheet_no)||faceOrder(a.side)-faceOrder(b.side);
const sample=[{id:'59',book_no:3,sheet_no:59,side:'front'},{id:'1b',book_no:1,sheet_no:1,side:'back'},{id:'2f',book_no:1,sheet_no:2,side:'front'},{id:'1f',book_no:1,sheet_no:1,side:'front'},{id:'41',book_no:3,sheet_no:41,side:'front'}].sort(compare);
assert.deepEqual(sample.map(x=>x.id),['1f','1b','2f','41','59']);
const ordinals=new Map(sample.map((row,index)=>[row.id,index+1]));
assert.equal(ordinals.get('41'),4);
assert.equal(ordinals.get('1b'),2);
console.log('pyeongjae sequence checks passed');
