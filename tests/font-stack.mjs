import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['../customer/index.html', '../archive/archive.css', '../admin/admin.css', '../admin/index.html', '../admin/admin.js', '../api/article-template.js', '../video/index.html'];
const texts = Object.fromEntries(files.map(file => [file, fs.readFileSync(new URL(file, import.meta.url), 'utf8')]));
texts['../api/article-template.js'] = JSON.parse(texts['../api/article-template.js'].replace(/^export default\s*/, '').replace(/;\s*$/, ''));
const stack = '"Nanum Gothic","Noto Sans KR","함초롬돋움","HCR Dotum","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
for (const file of ['../customer/index.html', '../archive/archive.css', '../admin/admin.css', '../api/article-template.js']) assert.ok(texts[file].includes(stack), `${file} 고딕 대체 서체`);
for (const file of files) {
  assert.doesNotMatch(texts[file], /--serif\s*:/, `${file} 명조 변수 제거`);
  assert.doesNotMatch(texts[file], /var\(--serif\)/, `${file} 명조 변수 사용 제거`);
  assert.doesNotMatch(texts[file], /font-family\s*:[^;}]*(?:Batang|Myeongjo|Georgia)/i, `${file} 명조 선언 제거`);
}
assert.match(texts['../customer/index.html'], /fonts\.googleapis\.com\/css2\?family=Nanum\+Gothic/);
assert.match(texts['../archive/archive.css'], /fonts\.googleapis\.com\/css2\?family=Nanum\+Gothic/);
assert.match(texts['../admin/admin.css'], /fonts\.googleapis\.com\/css2\?family=Nanum\+Gothic/);
assert.match(texts['../api/article-template.js'], /fonts\.googleapis\.com\/css2\?family=Nanum\+Gothic/);
assert.doesNotMatch(texts['../admin/index.html'], />나눔명조<|>시스템 명조<|>Noto Serif KR</);
assert.match(texts['../admin/admin.js'], /Font\.whitelist = \['noto-sans', 'nanum-gothic', 'system-sans'\]/);
assert.match(texts['../admin/admin.css'], /\.ql-editor \[style\*="font-family"\].*?font-family:var\(--sans\)!important/);
assert.match(texts['../api/article-template.js'], /\.article-body \[style\*="font-family"\].*?font-family:var\(--sans\)!important/);
console.log('font stack: PASS');
