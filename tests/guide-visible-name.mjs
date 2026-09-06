import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files=['admin/index.html','customer/index.html','guides/index.html','guide/index.html','pyeongjae/index.html','search/index.html'];
for(const file of files){
  const source=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
  assert.equal(source.includes('자료 안내 관리'),false,`${file}: old admin label`);
  assert.equal(source.includes('>자료 안내<'),false,`${file}: old visible label`);
  assert.equal(source.includes('자료 안내 검색'),false,`${file}: old search label`);
}
console.log('guide visible name: PASS');
