import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderArticle } from '../api/article.js';

const [html, css, js, shared] = await Promise.all([
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../api/shared-article.js', import.meta.url), 'utf8')
]);

assert.match(html, /<option value="small">작은 글씨<\/option>/);
assert.match(html, /class="ql-color"[^>]*>[\s\S]*value="#24364b"/);
assert.match(html, /class="ql-background"[^>]*>[\s\S]*value="#fff2b8"/);
assert.match(js, /Size\.whitelist = \['small', 'body', 'large', 'xlarge'\]/);
assert.match(js, /현재 글자색: 혼합된 색상/);
assert.match(js, /현재 음영색: 혼합된 색상/);
assert.match(js, /formatValueAcrossSelection/);
assert.match(js, /current-color-line/);
assert.match(js, /current-background-box/);
assert.match(css, /\.ql-editor \.ql-size-small,.article-preview \.ql-size-small\{font-size:max\(\.8em,14px\);line-height:1\.75\}/);
assert.match(css, /\.ql-picker-item\.ql-selected::after\{content:'✓'/);
assert.match(css, /grid-template-columns:repeat\(5,30px\)/);
assert.match(shared, /\.article-body \.ql-size-small\{font-size:max\(\.8em,14px\)/);

const markup = renderArticle({
  id: '00000000-0000-0000-0000-000000000000', type: 'works', category: '', title: '서식 검증',
  subtitle: '', excerpt: '', tags: [], image_url: '', image_alt: '', published_at: '2026-10-25',
  updated_at: '2026-10-25T00:00:00Z', recommendedPosts: [],
  content_html: '<p><span class="ql-size-small" style="color: #24364b; background-color: #fff2b8;">작은 글씨</span></p>'
});
assert.match(markup, /class="ql-size-small"/);
assert.match(markup, /color: #24364b/);
assert.match(markup, /background-color: #fff2b8/);

console.log('editor small text and color palette: PASS');
