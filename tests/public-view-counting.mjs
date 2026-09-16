import assert from 'node:assert/strict';
import fs from 'node:fs';

const tracker=fs.readFileSync(new URL('../customer/public-view-count.js',import.meta.url),'utf8');
const pyeongjae=fs.readFileSync(new URL('../api/pyeongjae.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../guide/index.html',import.meta.url),'utf8');
const article=fs.readFileSync(new URL('../api/article.js',import.meta.url),'utf8');
const articleTemplate=fs.readFileSync(new URL('../api/article-template.js',import.meta.url),'utf8');
const archive=fs.readFileSync(new URL('../pyeongjae/archive-list.js',import.meta.url),'utf8');
const guideList=fs.readFileSync(new URL('../guides/guide-list.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20260917_total_page_views.sql',import.meta.url),'utf8');

for(const value of ['record_post_view','increment_guide_view','increment_pyeongjae_view','__languageBrainRecordedPageViews','public-page-open'])assert.ok(tracker.includes(value),value);
assert.ok(!tracker.includes('localStorage')&&!tracker.includes('randomUUID'),'view counting must not deduplicate visitors');
for(const page of [pyeongjae,guide,article])assert.ok(page.includes('/customer/public-view-count.js?v=20260917-2'));
assert.equal((article.match(/public-view-count\.js/g)||[]).length,1,'article loads tracker once');
assert.equal((pyeongjae.match(/public-view-count\.js/g)||[]).length,1,'pyeongjae loads tracker once');
assert.equal((guide.match(/public-view-count\.js/g)||[]).length,1,'guide loads tracker once');
assert.ok(!articleTemplate.includes('recordView(data.id)'),'article legacy view call removed');
assert.ok(!pyeongjae.includes("d.rpc('increment_pyeongjae_view'"),'pyeongjae legacy view call removed');
assert.ok(!guide.includes("db.rpc('increment_guide_view'"),'guide legacy view call removed');
assert.ok(archive.includes("cache: 'no-store'")&&archive.includes('event.persisted) load()'));
assert.ok(guideList.includes("cache: 'no-store'"));
for(const value of ['create or replace function public.record_post_view','set view_count = view_count + 1','create or replace function public.increment_pyeongjae_view'])assert.ok(migration.includes(value),value);
assert.ok(migration.includes('insert into public.post_views'),'general post opens remain additive events');
assert.doesNotMatch(migration,/on conflict do nothing|delete from|truncate|drop table|view_count\s*=\s*0/i);
new Function(tracker);
console.log('total public page view counting: PASS');