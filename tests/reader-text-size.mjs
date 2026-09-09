import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reader controls expose every requested step, persistence, reset, and accessibility labels', async () => {
  const script = await read('customer/reader-text-size.js');
  assert.match(script, /STEPS=\[80,90,100,110,120,130,140\]/);
  assert.match(script, /life-language-reader-text-size/);
  assert.match(script, /localStorage\.getItem/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /본문 글자 크기 줄이기/);
  assert.match(script, /본문 글자 크기를 기본값 100%로 되돌리기/);
  assert.match(script, /본문 글자 크기 키우기/);
  assert.match(script, /minus\.disabled=percent===STEPS\[0\]/);
  assert.match(script, /plus\.disabled=percent===STEPS\.at\(-1\)/);
  assert.match(script, /reset\.addEventListener\('click',\(\)=>apply\(100\)\)/);
  assert.doesNotMatch(script, /reset\.disabled/);
});

test('the shared styles resize and reflow only reader text content', async () => {
  const css = await read('customer/reader-text-size.css');
  assert.match(css, /\.reader-text-content\{[^}]*font-size:calc\(var\(--reader-body-size\) \* var\(--reader-scale,1\)\)/);
  assert.match(css, /\.pyeongjae-text\.reader-text-content\{line-height:1\.72\}/);
  assert.match(css, /html\[data-reader-scale="(?:120|130|140)"\]/);
  assert.match(css, /\.hero-gallery\{float:none/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /--reader-body-size:17px/);
  assert.doesNotMatch(css, /(?:zoom|transform\s*:\s*scale)\s*:/i);
});

test('all public detail families load the shared controls and mark body-only content', async () => {
  const [article, guide, pyeongjae] = await Promise.all([
    read('api/article.js'),
    read('guide/index.html'),
    read('api/pyeongjae.js')
  ]);
  for (const source of [article, guide, pyeongjae]) {
    assert.match(source, /reader-text-size\.css\?v=20260909-1/);
    assert.match(source, /reader-text-size\.js\?v=20260909-1/);
    assert.match(source, /reader-text-content/);
  }
  assert.match(article, /<div class="reader-text-content"[^>]*>\$\{gallery\}\$\{body\}<\/div>\$\{tags\}/);
  assert.match(guide, /document-body reader-text-content/);
  assert.match(pyeongjae, /pyeongjae-text reader-text-content/);
  assert.doesNotMatch(pyeongjae, /reader-nav reader-text-content/);
});
