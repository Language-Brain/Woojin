import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderArticle } from '../api/article.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = read('admin/admin.js');
const migration = read('supabase/migrations/20261019_link_shared_posts.sql');
const sharedApi = read('api/shared-article.js');
const imageApi = read('api/shared-image.js');
const sharedHelpers = read('api/_shared.js');
const vercel = JSON.parse(read('vercel.json'));
const robots = read('robots.txt');

assert.match(migration, /status in \('draft', 'shared', 'published', 'trashed'\)/);
assert.match(migration, /create table if not exists public\.post_shares/);
assert.match(migration, /digest\(generated_token, 'sha256'\)/);
assert.match(migration, /crypt\(password_value, gen_salt\('bf', 12\)\)/);
assert.match(migration, /recent_client_failures >= 5 or recent_total_failures >= 30/);
assert.match(migration, /status = 'published' or public\.is_admin\(\)/);
assert.match(migration, /shared-post-images/);
assert.match(migration, /public\.post_shared_assets/);

assert.match(admin, /id="share-post"[^>]*>링크 공개/);
assert.match(admin, /savePost\('shared'\)/);
assert.match(admin, /공유 링크 복사/);
assert.match(admin, /공유 링크 새로 발급/);
assert.match(admin, /공유 중지/);
assert.match(admin, /enable_post_share/);
assert.match(admin, /stop_post_share/);
assert.match(admin, /existing\?\.status !== 'shared'/);
assert.match(admin, /mode === 'draft' && existing\?\.status === 'shared'/);
assert.match(admin, /postStatusLabels = \{ published: '전체 공개', shared: '링크 공개'/);

assert.ok(vercel.rewrites.some(row => row.source === '/shared/article' && row.destination === '/api/shared-article'));
assert.ok(vercel.rewrites.some(row => row.source === '/shared/image' && row.destination === '/api/shared-image'));
assert.ok(vercel.headers.some(row => row.source === '/shared/:path*' && row.headers.some(header => header.key === 'X-Robots-Tag' && /noindex/.test(header.value))));
assert.match(robots, /Disallow: \/shared\//);

for (const source of [sharedApi, imageApi]) {
  assert.match(source, /noindex, nofollow, noarchive/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /no-referrer/);
  assert.match(source, /no-store/);
}
assert.doesNotMatch(sharedApi, /canonical|application\/ld\+json|og:description/);
assert.match(sharedApi, /공유가 종료된 문서입니다\./);
assert.match(sharedHelpers, /shared-post-images/);
assert.match(sharedHelpers, /lb_shared_access/);
assert.match(sharedHelpers, /timingSafeEqual/);
assert.match(sharedHelpers, /post_shared_assets/);

const sharedMarkup = renderArticle({
  id: '00000000-0000-0000-0000-000000000000', type: 'works', category: '', title: '내부 원고',
  subtitle: '', excerpt: '', content_html: '<p>본문</p>', tags: [], image_url: '', image_alt: '',
  published_at: '2026-10-19', updated_at: '2026-10-19T00:00:00Z', recommendedPosts: []
}, { shared: true });
assert.match(sharedMarkup, /링크로 공유된 문서입니다\./);
assert.doesNotMatch(sharedMarkup, /share-area/);

console.log('link-shared post security checks passed');
