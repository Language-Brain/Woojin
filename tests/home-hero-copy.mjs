import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../customer/index.html',import.meta.url),'utf8');
assert.match(html,/heroTitle\.textContent='삶과 언어'/);
assert.match(html,/heroLead\.textContent='언어의 문제는 곧 삶의 문제가 됩니다\.'/);
assert.match(html,/문해\(Literacy\), 인지\(Cognition\), 한국어 교육\(KSL, KFL\)을 포함한/);
assert.match(html,/여러 화두는 서로 연결되어 있습니다\./);
assert.match(html,/heroDescription\.replaceChildren\(heroDescriptionLine1,heroDescriptionLine2\)/);
assert.match(html,/@media\(min-width:1051px\)\{\.hero \.hero-grid\{width:min\(780px,calc\(100% - 44px\)\);min-height:280px/);
assert.match(html,/\.hero \.hero-copy\{padding:22px 0 26px 18px\}/);
assert.match(html,/\.hero h1\{font-size:68px;margin-bottom:10px\}/);
assert.match(html,/\.hero \.hero-art\{height:280px\}/);
assert.match(html,/const homeLimit=type==='works'\?7:5/);
assert.match(html,/@media\(max-width:760px\)[\s\S]*\.hero-ko\{width:100%;font-size:17px\}/);

console.log('home hero copy: PASS');
