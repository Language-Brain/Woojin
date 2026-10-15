import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, html] = await Promise.all([
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8')
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
assert.match(html, /id="dashboard-draft-notice"/);
assert.match(source, /작성 중인 임시 저장 글이 \$\{drafts\.length\}건 있습니다/);
assert.match(source, /draftNotice\.classList\.toggle\('hidden', drafts\.length === 0\)/);
assert.match(source, /drafts\.length === 1 \? drafts\[0\]\.id : ''/);
assert.match(source, /const recentWithDrafts = \[\.\.\.drafts, \.\.\.recent\.filter\(post => post\.status !== 'draft'\)\]/);
assert.match(source, /compact-item \$\{post\.status === 'draft' \? 'post-row-draft' : ''\}/);
assert.match(source, /dashboard-draft-notice'[\s\S]*?filter-status'\)\.value = 'draft'/);
assert.match(css, /\.dashboard-draft-notice\{[^}]*background:#f0f3e3;color:#465124/);
assert.match(css, /\.compact-item\.post-row-draft\{[^}]*border-left:4px solid #7a8748;background:#f0f3e3/);

console.log('admin draft visibility: PASS');
