import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../customer/index.html',import.meta.url),'utf8');
assert.match(html,/heroTitle\.textContent='삶과 언어'/);
assert.match(html,/heroLead\.replaceChildren\(makeHeroLine\('문해\(Literacy\), 인지\(Cognition\), 한국어 교육\(KSL, KFL\)을'\),makeHeroLine\('포함한 여러 화두는 서로 연결되어 있습니다\.'\)\)/);
assert.match(html,/heroDescription\.replaceChildren\(makeHeroLine\('삶과 언어는 권우진이 언어와 삶, 문해교육,'\),makeHeroLine\('읽기와 쓰기, 인지와 인간의 활동을 탐구하고'\),makeHeroLine\('연구 자료를 나누는 연구실입니다\.'\)\)/);
assert.match(html,/\.hero \.hero-en,\.hero \.hero-ko\{width:auto;max-width:none;color:#686868;font:400 17px\/1\.58 var\(--sans\);letter-spacing:0\}/);
assert.match(html,/\.hero-copy-line\{display:block;white-space:nowrap\}/);
assert.match(html,/@media\(min-width:901px\)\{\.hero \.hero-grid\{width:min\(1180px,calc\(100% - 44px\)\);grid-template-columns:minmax\(680px,1fr\) minmax\(0,500px\)\}/);
assert.match(html,/@media\(min-width:1051px\)\{\.hero \.hero-grid\{width:min\(780px,calc\(100% - 44px\)\);min-height:280px/);
assert.match(html,/\.hero \.hero-copy\{padding:22px 0 26px 18px\}/);
assert.match(html,/\.hero h1\{font-size:68px;margin-bottom:10px\}/);
assert.match(html,/\.hero \.hero-art\{height:280px\}/);
assert.match(html,/const homeLimit=type==='works'\?7:5/);
assert.match(html,/@media\(max-width:760px\)[\s\S]*\.hero-ko\{width:100%;font-size:17px\}/);

console.log('home hero copy: PASS');
