import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../archive/archive.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../archive/archive.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../archive/index.html',import.meta.url),'utf8');

assert.match(js,/if\(kind==='works'\) return workCard\(row\)/,'works must use its own list renderer');
assert.match(js,/class="works-list-row"/,'the whole work row must be a link');
assert.match(js,/works-list-placeholder/,'missing images must keep a stable thumbnail slot');
assert.match(js,/sessionStorage\.setItem\(stateKey/,'works filters and scroll state must be preserved');
assert.match(css,/grid-template-columns:minmax\(0,1fr\) 200px/,'desktop must place text left and a small image right');
assert.match(css,/\.works-list-thumb img\{[^}]*object-fit:cover/,'thumbnails must use object-fit cover');
assert.match(css,/@media\(max-width:620px\)[\s\S]*grid-template-columns:minmax\(0,1fr\) 96px/,'mobile must retain a small right thumbnail');
assert.match(css,/\[data-archive-kind="works"\] \.works-list-item h2\{[^}]*font:700 22px/,'desktop work titles must be prominent without returning to oversized cards');
assert.match(html,/archive\.css\?v=works-list-20260829-1/);
assert.match(html,/archive\.js\?v=works-list-20260829-1/);

console.log('works list layout checks passed');
