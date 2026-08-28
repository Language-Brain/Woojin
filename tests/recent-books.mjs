import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../customer/index.html', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const adminJs = fs.readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const adminCss = fs.readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260828_recent_books.sql', import.meta.url), 'utf8');

assert.ok(home.indexOf('id="books"') > home.indexOf('class="shorts"'));
assert.ok(home.indexOf('id="books"') < home.indexOf('id="about"'));
assert.match(home, /from\('books'\)[\s\S]*?eq\('status','published'\)[\s\S]*?is\('deleted_at',null\)/);
assert.match(home, /order\('is_pinned',\{ascending:false\}\)[\s\S]*?order\('display_order',\{ascending:true\}\)/);
assert.match(home, /scroll-snap-type:x mandatory/);
assert.doesNotMatch(home, /setInterval\([^)]*books/i);
assert.match(home, /target='_blank'/);
assert.match(home, /rel='noopener noreferrer'/);
assert.match(home, /\^https\?:\$/);

for (const needle of ['data-view="books"', 'id="view-books"', 'id="book-form"', 'id="book-search"', 'id="book-filter-status"', 'id="book-preview-dialog"']) assert.ok(admin.includes(needle), needle);
for (const needle of ['function cleanBookUrl', 'function similarBookTitles', 'async function loadBooks', "data-book-action=\"trash\"", "data-book-action=\"restore\"", "data-book-action=\"up\"", 'uploadImage(file']) assert.ok(adminJs.includes(needle), needle);
assert.match(adminJs, /function normalizeBookLinks/);
assert.ok(adminJs.includes("const links = $$('.book-link-row').map"));
assert.ok(adminJs.includes('exactDuplicate'));
assert.ok(!adminJs.includes("const links = $('.book-link-row').map"));
assert.match(adminCss, /\.compact-book-form/);
assert.match(adminCss, /@media\(max-width:720px\)/);

assert.match(migration, /create table if not exists public\.books/);
assert.match(migration, /alter table public\.books enable row level security/);
assert.match(migration, /status = 'published' and deleted_at is null/);
assert.match(migration, /public\.is_admin\(\)/);
assert.doesNotMatch(migration, /drop table|truncate/i);

new Function(adminJs);
console.log('recent books: PASS');
