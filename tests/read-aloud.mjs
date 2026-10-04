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
assert.match(module, /MutationObserver/);
assert.match(module, /retryCount<20/);
assert.match(module, /voiceschanged/);
assert.match(module, /LanguageBrainReadAloud=\{initialize,refreshVoices\}/);
assert.match(module, /document\.querySelector\('\.read-aloud-controls'\)/);
assert.match(module, /observer\.disconnect\(\)/);
assert.match(module, /stabilityTimer=setTimeout/);
assert.match(module, /setTimeout\(initialize,300\)/);
assert.match(module, /한국어 음성을 준비하고 있습니다\. 잠시 후 다시 눌러 주세요\./);
assert.match(module, /\[읽어주기\] 본문 미발견/);
assert.match(module, /\[읽어주기\] 음성 목록 준비 중/);
assert.match(module, /\[읽어주기\] Web Speech API 미지원/);
assert.match(module, /collectPyeongjaeSource/);
assert.match(module, /\.literal-translation,\.interpretive-translation/);
assert.match(module, /읽을 수 있는 현대어 직역 또는 의역이 없습니다\./);
assert.match(pyeongjae, /page\.literal_translation,'literal-translation'/);
assert.match(pyeongjae, /page\.interpretive_translation,'interpretive-translation'/);
assert.match(module, /Google\|Microsoft\|Siri\|Samsung\|Natural\|Online/);
assert.match(module, /reader-speaking/);
assert.match(module, /script,style,noscript,img,svg,video,audio,iframe/);
assert.match(module, /replace\(\/https\?:\\\/\\\/\\S\+\/gi/);
assert.match(styles, /\.reader-speaking\{background:#e9f3ef/);
assert.match(styles, /focus-visible/);
assert.doesNotMatch(links, /read-aloud/);
for (const source of [article, guide, pyeongjae, video]) {
  assert.match(source, /DOMContentLoaded/);
  assert.match(source, /pageshow/);
  assert.match(source, /customer\/read-aloud\.js\?v=20261004-12/);
  assert.match(source, /customer\/read-aloud\.css\?v=20261004-12/);
}
assert.match(guide, /LanguageBrainReadAloud\?\.initialize\(\)/);

console.log('public read aloud controls: PASS');
