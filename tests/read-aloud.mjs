import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const module = read('customer/read-aloud.js');
const styles = read('customer/read-aloud.css');
const links = read('customer/public-links.js');
const article = read('api/article.js');
const guide = read('guide/index.html');
const pyeongjae = read('api/pyeongjae.js');
const video = read('api/video.js');

for (const marker of ['window.speechSynthesis', 'window.SpeechSynthesisUtterance', "utterance.lang='ko-KR'", 'getVoices']) {
  assert.ok(module.includes(marker), marker);
}
for (const label of ['🔊 읽어주기', '일시정지', '계속 듣기', '처음부터', '정지', '0.8배', '1.0배', '1.2배', '1.5배']) assert.ok(module.includes(label), label);
for (const action of ['synth.pause()', 'synth.resume()', 'synth?.cancel()', "window.addEventListener('pagehide'"]) assert.ok(module.includes(action), action);
assert.match(module, /DOMContentLoaded/);
assert.match(module, /Google\|Microsoft\|Siri\|Samsung\|Natural\|Online/);
assert.match(module, /reader-speaking/);
assert.match(module, /script,style,noscript,img,svg,video,audio,iframe/);
assert.match(module, /replace\(\/https\?:\\\/\\\/\\S\+\/gi/);
assert.match(styles, /\.reader-speaking\{background:#e9f3ef/);
assert.match(styles, /focus-visible/);
assert.doesNotMatch(links, /read-aloud/);
for (const source of [article, guide, pyeongjae, video]) {
  assert.match(source, /defer src=["']\/customer\/read-aloud\.js\?v=20261004-7/);
  assert.match(source, /customer\/read-aloud\.css\?v=20261004-7/);
}

console.log('public read aloud controls: PASS');
