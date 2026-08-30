import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  '../pyeongjae/archive-list.js',
  '../pyeongjae/list-sequence.js',
  '../guides/guide-list.js',
  '../admin/admin.js',
  '../admin/pyeongjae-list-enhancements.js',
  '../api/pyeongjae.js'
].map(path => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const rowCss = fs.readFileSync(new URL('../pyeongjae/list-row.css', import.meta.url), 'utf8');

for (const source of files) {
  assert.match(source, /trimStart\(\)\.startsWith\('○'\)/);
  assert.match(source, /trimStart\(\)\.startsWith\('#'\)/);
  assert.match(source, /created_at/);
}
assert.match(files[0], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[2], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[4], /filter\(row => !isPriority\(row\)\)/);
assert.match(files[5], /sort\(compareEntries\)/);
assert.match(rowCss, /\.face-row\.priority-row/);

const rank = row => String(row.title || '').trimStart().startsWith('○') ? 0 : String(row.title || '').trimStart().startsWith('#') ? 1 : 2;
const priority = row => rank(row) < 2;
const face = value => value === 'back' ? 1 : 0;
const created = row => Date.parse(row.created_at) || 0;
const compare = (a, b) => rank(a) - rank(b)
  || (priority(a) && priority(b) ? created(a) - created(b) : 0)
  || a.book_no - b.book_no
  || a.sheet_no - b.sheet_no
  || face(a.side) - face(b.side);

const rows = [
  { id: 'back', title: '평재문집 제1책 제1장 뒷면', book_no: 1, sheet_no: 1, side: 'back', created_at: '2026-08-01' },
  { id: 'hash', title: '  # 이용 안내', book_no: 3, sheet_no: 9, side: 'back', created_at: '2026-07-01' },
  { id: 'front', title: '평재문집 제1책 제1장 앞면', book_no: 1, sheet_no: 1, side: 'front', created_at: '2026-08-01' },
  { id: 'circle-new', title: '○ 자료를 읽기 전에', book_no: 2, sheet_no: 3, side: 'front', created_at: '2026-06-02' },
  { id: 'circle-old', title: '  ○ 평재문집 소개', book_no: 3, sheet_no: 5, side: 'front', created_at: '2026-06-01' },
  { id: 'middle', title: '평재문집 ○ 기호 연구', book_no: 1, sheet_no: 2, side: 'front', created_at: '2026-05-01' }
].sort(compare);

assert.deepEqual(rows.map(row => row.id), ['circle-old', 'circle-new', 'hash', 'front', 'back', 'middle']);
const ordinals = new Map(rows.filter(row => !priority(row)).map((row, index) => [row.id, index + 1]));
assert.equal(ordinals.has('circle-old'), false);
assert.equal(ordinals.has('hash'), false);
assert.equal(ordinals.get('front'), 1);
assert.equal(ordinals.get('back'), 2);
assert.equal(rank({ title: '중간 # 기호' }), 2);

console.log('pyeongjae priority ordering: PASS');
