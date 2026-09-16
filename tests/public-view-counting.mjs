import assert from 'node:assert/strict';
import fs from 'node:fs';

const tracker=fs.readFileSync(new URL('../customer/public-view-count.js',import.meta.url),'utf8');
const pyeongjae=fs.readFileSync(new URL('../api/pyeongjae.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../guide/index.html',import.meta.url),'utf8');
const article=fs.readFileSync(new URL('../api/article.js',import.meta.url),'utf8');
const archive=fs.readFileSync(new URL('../pyeongjae/archive-list.js',import.meta.url),'utf8');
const guideList=fs.readFileSync(new URL('../guides/guide-list.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20260917_public_view_counting.sql',import.meta.url),'utf8');

for(const value of ['record_post_view','increment_guide_view','increment_pyeongjae_view','crypto?.randomUUID?.()','localStorage.getItem'])assert.ok(tracker.includes(value),value);
for(const page of [pyeongjae,guide,article])assert.ok(page.includes('/customer/public-view-count.js?v=20260917-1'));
assert.ok(archive.includes("cache: 'no-store'")&&archive.includes('event.persisted) load()'));
assert.ok(guideList.includes("cache: 'no-store'"));
for(const value of ['create table if not exists public.guide_view_events','on conflict do nothing','increment_guide_view(uuid,uuid,text)'])assert.ok(migration.includes(value),value);
assert.match(migration,/primary key\s*\(guide_id,\s*viewer_hash,\s*viewed_on\)/);
assert.doesNotMatch(migration,/delete from|truncate|drop table|update public\.guides set view_count\s*=\s*0/i);
new Function(tracker);
console.log('public view counting: PASS');
