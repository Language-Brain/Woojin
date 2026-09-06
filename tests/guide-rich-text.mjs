import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adminHtml = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
const adminJs = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');
const adminCss = await readFile(new URL('../admin/admin.css', import.meta.url), 'utf8');
const publicHtml = await readFile(new URL('../guide/index.html', import.meta.url), 'utf8');

test('guide editor exposes scoped formatting and link controls', () => {
  for (const label of ['굵게', '밑줄', '글자색', '링크 삽입', '링크 해제', '서식 제거', '번호 목록', '글머리표']) assert.match(adminHtml, new RegExp(label));
  assert.match(adminHtml, /id="guide-body-editor"[^>]+contenteditable="true"/);
  assert.match(adminHtml, /id="guide-link-new-tab"[^>]+checked/);
  assert.match(adminCss, /\.guide-body-editor/);
});

test('guide HTML uses an allowlist and rejects unsafe URL schemes', () => {
  assert.match(adminJs, /guideAllowedTags=\['p','br','div','strong','b','u','span','a','ol','ul','li'\]/);
  assert.match(adminJs, /\['http:','https:'\]\.includes\(url\.protocol\)/);
  assert.match(adminJs, /DOMPurify\.sanitize/);
  assert.match(adminJs, /rel='noopener noreferrer'/);
  assert.match(publicHtml, /dompurify@3\.2\.6/);
  assert.match(publicHtml, /ALLOWED_TAGS:\['p','br','div','strong','b','u','span','a','ol','ul','li'\]/);
  assert.match(publicHtml, /a\.replaceWith\(\.\.\.a\.childNodes\)/);
});

test('legacy plain text remains compatible and pasted URLs are linkified', () => {
  assert.match(adminJs, /guidePlainToHtml/);
  assert.match(adminJs, /linkifyGuideUrls/);
  assert.match(adminJs, /row\.body\|\|''/);
  assert.match(publicHtml, /raw\.split\(\/\(https\?:/);
  assert.match(publicHtml, /document\.createElement\('br'\)/);
});
