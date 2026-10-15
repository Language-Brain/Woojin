import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = ['../customer/index.html', '../archive/index.html', '../archive/news.html', '../archive/works.html', '../archive/archive.js'];
const text = (await Promise.all(files.map(file => readFile(new URL(file, import.meta.url), 'utf8')))).join('\n');

for (const label of ['주목하는 연구/논문', '언어/문해/인지 관련 기사', '강의/저서/연구 원고']) assert.ok(text.includes(label), label);
for (const oldLabel of ['주목할 논문', '언어, 문해, 인지 관련 기사', '강의·저서·연구 원고']) assert.ok(!text.includes(oldLabel), oldLabel);

const home = await readFile(new URL('../customer/index.html', import.meta.url), 'utf8');
assert.match(home, /ensureMoreLink\(target\.closest\('\.stream'\),archiveRoutes\[type\],[\s\S]*?'주목하는 연구\/논문'[\s\S]*?'언어\/문해\/인지 관련 기사'[\s\S]*?'강의\/저서\/연구 원고'\)/);
assert.match(home, /\$\{label\} 더보기 →/);

console.log('home section labels: PASS');
