import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../customer/index.html', import.meta.url), 'utf8');

assert.match(home, /async function loadHomeFeed\(type\)\{const homeLimit=8;/);
assert.match(home, /\.eq\('status','published'\)\.eq\('type',type\)/);
assert.match(home, /\.order\('published_at',\{ascending:false\}\)\.order\('created_at',\{ascending:false\}\)\.limit\(homeLimit\)/);
assert.match(home, /new Map\(\(result\.data\|\|\[\]\)\.map\(row=>\[row\.id,row\]\)\)/);
assert.match(home, /type==='paper'&&row\.category==='연구노트'/);
assert.match(home, /ensureMoreLink\(target\.closest\('\.stream'\),archiveRoutes\[type\]/);

console.log('home feed limit checks passed');
