import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');

assert.match(source, /let editorSession = 0/);
assert.match(source, /function startNewPost\(\)[\s\S]*?resetEditor\(\);[\s\S]*?navigate\('editor'\)/);
assert.match(source, /button\.dataset\.view === 'editor'\) \{ startNewPost\(\); return; \}/);
assert.match(source, /clearTimeout\(autosaveTimer\);[\s\S]*?autosaveTimer = null;[\s\S]*?currentPost = null/);
assert.match(source, /quill\.setContents\(\[\], 'silent'\);[\s\S]*?quill\.history\.clear\(\);[\s\S]*?quill\.setSelection\(0, 0, 'silent'\)/);
assert.match(source, /\$\('#post-id'\)\.value = ''/);
assert.match(source, /\$\('#publish-post'\)\.textContent = '공개하기'/);
assert.match(source, /const session = editorSession/);
assert.ok((source.match(/session !== editorSession/g) || []).length >= 4, 'stale async saves must not refill a new editor session');
assert.match(source, /if \(saving\) return/);
assert.match(source, /quill\.clipboard\.dangerouslyPasteHTML[\s\S]*?quill\.history\.clear\(\)/);

console.log('admin new-post state isolation: PASS');
