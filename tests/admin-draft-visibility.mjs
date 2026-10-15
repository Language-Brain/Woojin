import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css] = await Promise.all([
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8')
]);

assert.match(source, /post-row-draft/);
assert.match(source, /draft-title-badge">임시 저장/);
assert.match(source, /post\.status === 'draft' \? '임시 저장'/);
assert.match(source, /임시 저장되었습니다/);
assert.match(source, /setSaveState\('저장 실패', 'error'\)/);
assert.match(css, /\.post-table tr\.post-row-draft\{background:#f0f3e3;box-shadow:inset 4px 0 #7a8748\}/);
assert.match(css, /\.post-table tr\.post-row-draft td:first-child\{border-left:4px solid #7a8748\}/);
assert.match(css, /\.draft-title-badge\{[^}]*background:#dde5b8;color:#465124/);
assert.match(css, /\.status-draft\{background:#dde5b8;color:#465124\}/);

console.log('admin draft visibility: PASS');
