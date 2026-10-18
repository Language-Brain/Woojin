import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');

assert.match(admin, /id=\"trash-post\"[^>]*type=\"button\"[^>]*>휴지통으로 이동/);
assert.match(admin, /editor-trash-card[^\n]*hidden/);
assert.match(admin, /updateEditorStatus[\s\S]*editor-trash-card[\s\S]*post\.status === 'trashed'/);
assert.match(admin, /resetEditor[\s\S]*editor-trash-card[^\n]*add\('hidden'\)/);
assert.match(admin, /이 글을 휴지통으로 이동하시겠습니까\? 공개 화면과 관리자 일반 목록에서는 보이지 않으며, 휴지통에서 복구할 수 있습니다\./);
assert.match(admin, /이 글을 영구 삭제하면 복구할 수 없습니다\. 정말 삭제하시겠습니까\?/);
assert.match(admin, /function confirmPostAction/);
assert.match(admin, />취소<\/button>/);
assert.match(admin, /confirmPostAction\(trashPostConfirmation, '휴지통으로 이동'\)/);
assert.match(admin, /confirmPostAction\(permanentDeleteConfirmation, '영구 삭제'\)/);
assert.match(admin, /async function movePostToTrash/);
assert.match(admin, /if \(!id\)[\s\S]*resetEditor\(\)[\s\S]*return false/);
assert.match(admin, /_pre_trash_status = post\.status/);
assert.match(admin, /update\(changes\)\.eq\('id', id\)\.eq\('status', post\.status\)\.select\('id'\)\.single\(\)/);
assert.match(admin, /delete\(\)\.eq\('id', id\)\.eq\('status', 'trashed'\)/);
assert.match(admin, /if \(action === 'trash'\) return movePostToTrash\(id\)/);
assert.match(admin, /data-action=\"restore\"/);
assert.match(admin, /button\.textContent = '휴지통으로 이동'/);
assert.match(css, /\.editor-trash-card/);

console.log('admin post trash workflow checks passed');
