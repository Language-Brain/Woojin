import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  '../pyeongjae/archive-list.js', '../pyeongjae/list-sequence.js',
  '../guides/guide-list.js', '../admin/admin.js',
  '../admin/pyeongjae-list-enhancements.js', '../api/pyeongjae.js'
].map(path => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const rowCss = fs.readFileSync(new URL('../pyeongjae/list-row.css', import.meta.url), 'utf8');
for (const source of files) {
  assert.match(source, /entry_kind/);
  assert.match(source, /startsWith\('○'\)/);
  assert.match(source, /startsWith\('#'\)/);
  assert.match(source, /created_at/);
}
assert.match(files[0], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[2], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[4], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[5], /sort\(compareEntries\)/);
assert.match(rowCss, /\.face-row\.priority-row/);

const isGuide = row => row.entry_kind === 'guide';
const rank = row => { const title=String(row.title||'').trimStart(); return isGuide(row) ? (title.startsWith('○') ? 0 : title.startsWith('#') ? 1 : 2) : 3; };
const face = value => value === 'back' ? 1 : 0;
const created = row => Date.parse(row.created_at) || 0;
const compare = (a, b) => rank(a) - rank(b)
  || (isGuide(a) && isGuide(b) ? created(a) - created(b) : 0)
  || (Number(a.book_no) || 0) - (Number(b.book_no) || 0)
  || (Number(a.sheet_no) || 0) - (Number(b.sheet_no) || 0)
  || face(a.side) - face(b.side);
const rows = [
  { id:'back', entry_kind:'source', title:'평재문집 제1책 제1장 뒷면', book_no:1, sheet_no:1, side:'back', created_at:'2026-08-01' },
  { id:'hash', entry_kind:'guide', title:'  # 이용 안내', created_at:'2026-07-01' },
  { id:'front', entry_kind:'source', title:'평재문집 제1책 제1장 앞면', book_no:1, sheet_no:1, side:'front', created_at:'2026-08-01' },
  { id:'circle-new', entry_kind:'guide', title:'○ 자료를 읽기 전에', created_at:'2026-06-02' },
  { id:'circle-old', entry_kind:'guide', title:'  ○ 평재문집 소개', created_at:'2026-06-01' },
  { id:'plain-guide', entry_kind:'guide', title:'편찬 해제', created_at:'2026-05-01' },
  { id:'middle', entry_kind:'source', title:'평재문집 ○ 기호 연구', book_no:1, sheet_no:2, side:'front', created_at:'2026-05-01' }
].sort(compare);
assert.deepEqual(rows.map(row => row.id), ['circle-old','circle-new','hash','plain-guide','front','back','middle']);
const ordinals = new Map(rows.filter(row => !isGuide(row)).map((row,index) => [row.id,index+1]));
assert.equal(ordinals.has('circle-old'), false);
assert.equal(ordinals.has('hash'), false);
assert.equal(ordinals.has('plain-guide'), false);
assert.equal(ordinals.get('front'), 1);
assert.equal(ordinals.get('back'), 2);
assert.equal(rank({entry_kind:'source',title:'중간 # 기호'}), 3);
console.log('pyeongjae guide/source ordering: PASS');
