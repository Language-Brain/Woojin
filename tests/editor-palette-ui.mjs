import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, js] = await Promise.all([
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8')
]);

for (const color of ['#1d4ed8','#173b63','#0f766e','#2f6b3b','#68752a','#966515','#c45113','#b42318','#7f2929','#6b3f74']) assert.ok(html.toLowerCase().includes(color), `글자색 ${color}`);
for (const color of ['#e5e7eb','#efe5d2','#ffefad','#f8d9b5','#dce8b7','#cfe8df','#cfe4f3','#f3d4d9','#e4d8ef']) assert.ok(html.toLowerCase().includes(color), `음영색 ${color}`);
assert.match(css, /\.ql-color-picker:not\(\.ql-expanded\) \.ql-picker-options\{display:none!important;visibility:hidden!important/);
assert.match(css, /\.ql-color-picker\.ql-expanded \.ql-picker-options\{display:grid!important;visibility:visible!important/);
assert.match(js, /closeColorPickers\(picker\)/);
assert.match(js, /event\.key === 'Escape'/);
assert.match(js, /positionColorPicker/);
assert.match(js, /lastEditorRange/);
assert.match(js, /closeColorPickers\(\);/);

const sizePreviews = [...css.matchAll(/\.ql-picker\.ql-size \.ql-picker-item\[data-value=(small|body|large|xlarge)\]::before\{font-size:(\d+)px\}/g)]
  .reduce((map, match) => ({ ...map, [match[1]]: Number(match[2]) }), {});
assert.deepEqual(sizePreviews, { small: 13, body: 15, large: 18, xlarge: 22 });
assert.ok(sizePreviews.small < sizePreviews.body && sizePreviews.body < sizePreviews.large && sizePreviews.large < sizePreviews.xlarge);

console.log('editor palette initial state and size previews: PASS');
