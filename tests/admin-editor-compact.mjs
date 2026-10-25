import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, js] = await Promise.all([
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8')
]);

assert.match(html, /<input id="post-subtitle" type="hidden">/);
for (const removed of [
  '부제목 또는 한 문장 요약',
  '이미지는 도구 모음의 그림 버튼으로 삽입할 수 있습니다.',
  '현재 글자색:',
  '제목 1·제목 2·제목 3은 글 전체의 제목이 아니라 본문 안의 소제목 형식입니다.'
]) assert.ok(!html.includes(removed), `화면 문구 제거: ${removed}`);
assert.doesNotMatch(js, /ql-color-status|colorStatus/);
assert.match(js, /subtitle: \$\('#post-subtitle'\)\.value\.trim\(\)/);
assert.match(js, /\$\('#post-subtitle'\)\.value = working\.subtitle/);
assert.match(css, /\.title-input\{[^}]*padding:0 0 10px/);
assert.match(css, /\.editor-label-row\{[^}]*margin:10px 0 5px/);
assert.match(css, /\.ql-editor\{[^}]*padding:28px/);
for (const pair of [['small','13'],['body','15'],['large','18'],['xlarge','22']]) assert.match(css, new RegExp(`data-value=${pair[0]}\\]::before\\{font-size:${pair[1]}px`));

console.log('admin compact editor: PASS');
