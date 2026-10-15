import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, html] = await Promise.all([
  readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8')
]);

assert.match(source, /\[\.\.\.counts\.entries\(\)\]\.sort\(\(a, b\) => b\[1\] - a\[1\]\)\.slice\(0, 20\)/);
assert.match(source, /popular-rank">\$\{index \+ 1\}/);
assert.match(source, /popular-count">조회 \$\{Number\(count\)\.toLocaleString\('ko-KR'\)\}/);
assert.match(source, /href="\/article\?id=\$\{encodeURIComponent\(id\)\}" target="_blank" rel="noopener"/);
assert.match(css, /#popular-posts\{width:min\(100%,920px\)\}/);
assert.match(css, /\.popular-item\{[^}]*grid-template-columns:32px minmax\(0,1fr\) minmax\(78px,96px\)/);
assert.match(css, /\.popular-title\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
assert.match(css, /\.popular-count\{[^}]*white-space:nowrap;font-variant-numeric:tabular-nums/);
assert.match(html, /admin\.js\?v=popular-posts-20261015-1/);
assert.match(html, /admin\.css\?v=popular-posts-20261015-1/);

console.log('admin popular posts: PASS');
