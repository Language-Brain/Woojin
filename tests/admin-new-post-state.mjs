import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');

assert.match(source, /let editorSession = 0/);
assert.match(html, /<a class="nav-item" data-view="editor" data-new-post href="\/admin\?new=1">/);
assert.match(html, /admin\.js\?v=editor-compact-20261025-3/);
assert.match(source, /const newPostRequested = initialAdminParams\.get\('new'\) === '1'/);
assert.match(source, /if \(newPostRequested\)[\s\S]*?resetEditor\(\);[\s\S]*?navigate\('editor'\);[\s\S]*?post-title/);
assert.match(source, /function startNewPost\(\)[\s\S]*?editorSession \+= 1;[\s\S]*?location\.assign\('\/admin\?new=1'\)/);
assert.match(source, /button\.dataset\.view === 'editor'\) \{ event\.preventDefault\(\); startNewPost\(\); return; \}/);
assert.match(source, /clearTimeout\(autosaveTimer\);[\s\S]*?autosaveTimer = null;[\s\S]*?currentPost = null/);
assert.match(source, /quill\.setContents\(\[\], 'silent'\);[\s\S]*?quill\.history\.clear\(\);[\s\S]*?quill\.setSelection\(0, 0, 'silent'\)/);
assert.match(source, /\$\('#post-id'\)\.value = ''/);
assert.match(source, /\$\('#publish-post'\)\.textContent = '전체 공개'/);
assert.match(source, /const session = editorSession/);
assert.ok((source.match(/session !== editorSession/g) || []).length >= 4, 'stale async saves must not refill a new editor session');
assert.match(source, /if \(saving\) return/);
assert.match(source, /quill\.clipboard\.dangerouslyPasteHTML[\s\S]*?quill\.history\.clear\(\)/);
assert.match(source, /history\.replaceState\(null, '', `\/admin\?edit=\$\{encodeURIComponent\(id\)\}`\)/);

console.log('admin new-post state isolation: PASS');
