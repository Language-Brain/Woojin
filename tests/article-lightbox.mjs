import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../api/article.js', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../customer/article-lightbox.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../customer/article-lightbox.css', import.meta.url), 'utf8');

assert.match(api, /article-lightbox\.css/);
assert.match(api, /id="image-lightbox"/);
assert.match(api, /article-lightbox\.js/);

assert.match(script, /\.article-body img/);
assert.match(script, /naturalWidth < 120 && image\.naturalHeight < 120/);
assert.match(script, /viewer\.src = image\.currentSrc \|\| image\.src/);
assert.match(script, /viewer\.alt = image\.alt \|\| ''/);
assert.match(script, /event\.target === inner/);
assert.match(script, /dialog\.addEventListener\('cancel'/);
assert.match(script, /opener\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(script, /event\.key === 'Enter' \|\| event\.key === ' '/);

assert.match(style, /cursor:\s*zoom-in/);
assert.match(style, /touch-action:\s*pinch-zoom/);
assert.match(style, /object-fit:\s*contain/);
assert.match(style, /\.image-lightbox::backdrop/);
assert.doesNotMatch(style, /\.article-body img\s*\{/);

console.log('article lightbox checks passed');
