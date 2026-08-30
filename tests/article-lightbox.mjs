import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../api/article.js', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../customer/article-lightbox.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../customer/article-lightbox.css', import.meta.url), 'utf8');

assert.match(api, /\/customer\/article-lightbox\.css/);
assert.match(api, /id="image-lightbox"/);
assert.match(api, /\/customer\/article-lightbox\.js/);

assert.match(script, /\.article-body img/);
assert.match(script, /naturalWidth < 120 && image\.naturalHeight < 120/);
assert.match(script, /viewer\.src = image\.currentSrc \|\| image\.src/);
assert.match(script, /viewer\.alt = image\.alt \|\| ''/);
assert.match(script, /event\.target === inner/);
assert.match(script, /dialog\.addEventListener\('cancel'/);
assert.match(script, /opener\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(script, /event\.key === 'Enter' \|\| event\.key === ' '/);
assert.match(script, /viewer\.addEventListener\('pointerdown'/);
assert.match(script, /viewer\.addEventListener\('pointermove'/);
assert.match(script, /viewer\.setPointerCapture/);
assert.match(script, /pinch\.localX \* nextScale/);
assert.match(script, /viewer\.offsetWidth \* scale - inner\.clientWidth/);
assert.match(script, /state\.scale > MIN_SCALE && drag/);
assert.match(script, /document\.body\.style\.position = 'fixed'/);
assert.match(script, /window\.scrollTo\(0, savedScrollY\)/);
assert.match(script, /resetView\(\);\s*viewer\.removeAttribute\('src'\)/);
assert.match(script, /backdropGesture\.moved/);

assert.match(style, /cursor:\s*zoom-in/);
assert.match(style, /touch-action:\s*none/);
assert.match(style, /object-fit:\s*contain/);
assert.match(style, /transform-origin:\s*center center/);
assert.match(style, /\.image-lightbox-image\.is-pannable/);
assert.match(style, /\.image-lightbox::backdrop/);
assert.doesNotMatch(style, /\.article-body img\s*\{/);

console.log('article lightbox checks passed');
