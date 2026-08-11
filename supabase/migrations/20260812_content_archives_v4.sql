-- 언어와 문해 연구실 콘텐츠 자료실 v4
-- 기존 posts와 공개 자료는 삭제하지 않고 자료실 메타데이터와 videos만 추가합니다.

begin;

alter table public.posts add column if not exists home_featured boolean not null default true;
alter table public.posts add column if not exists home_order integer not null default 0;
alter table public.posts add column if not exists content_subtype text not null default '';
alter table public.posts add column if not exists original_title text not null default '';
alter table public.posts add column if not exists authors text not null default '';
alter table public.posts add column if not exists publication_year integer;
alter table public.posts add column if not exists journal text not null default '';
alter table public.posts add column if not exists bibliographic_info text not null default '';
alter table public.posts add column if not exists doi text not null default '';
alter table public.posts add column if not exists research_method text not null default '';
alter table public.posts add column if not exists key_results text not null default '';
alter table public.posts add column if not exists importance text not null default '';
alter table public.posts add column if not exists publisher text not null default '';
alter table public.posts add column if not exists article_date date;

update public.posts
set home_order = sort_order,
    content_subtype = case when type = 'works' then coalesce(nullif(source, ''), '연구 원고') else content_subtype end,
    journal = case when type = 'paper' then coalesce(nullif(source, ''), category) else journal end,
    publisher = case when type = 'news' then coalesce(nullif(source, ''), category) else publisher end,
    article_date = case when type = 'news' then published_at else article_date end
where home_order = 0;

create index if not exists posts_archive_public_idx
  on public.posts(type, status, home_featured, home_order desc, published_at desc);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  category text not null default '',
  youtube_url text not null default '',
  youtube_id text not null default '',
  thumbnail_url text not null default '',
  custom_image_url text not null default '',
  related_post_id uuid references public.posts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'trashed')),
  home_featured boolean not null default false,
  home_order integer not null default 0,
  published_at date not null default current_date,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_valid_published_youtube check (
    status <> 'published' or (youtube_id ~ '^[A-Za-z0-9_-]{11}$' and youtube_url like 'https://%')
  )
);

create unique index if not exists videos_youtube_id_unique
  on public.videos(youtube_id) where youtube_id <> '';
create index if not exists videos_public_archive_idx
  on public.videos(status, home_featured, home_order, published_at desc);

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at before update on public.videos
for each row execute function public.set_updated_at();

alter table public.videos enable row level security;

drop policy if exists "videos_public_read" on public.videos;
create policy "videos_public_read" on public.videos
for select to anon, authenticated
using ((status = 'published' and youtube_id <> '') or public.is_admin());

drop policy if exists "videos_admin_insert" on public.videos;
create policy "videos_admin_insert" on public.videos
for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "videos_admin_update" on public.videos;
create policy "videos_admin_update" on public.videos
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "videos_admin_delete" on public.videos;
create policy "videos_admin_delete" on public.videos
for delete to authenticated using (public.is_admin());

grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;

insert into public.videos (
  title, description, category, youtube_url, youtube_id, thumbnail_url,
  status, home_featured, home_order, published_at, created_by
) values
('같은 말도 다르게 들리는 이유', '같은 표현도 맥락과 경험에 따라 다르게 이해되는 언어와 인지의 관계를 살펴봅니다.', '읽기', 'https://www.youtube.com/shorts/lZkGv9yIotA', 'lZkGv9yIotA', 'https://i.ytimg.com/vi/lZkGv9yIotA/hqdefault.jpg', 'published', true, 10, '2026-05-02', 'cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('읽고 쓰기가 최고의 뇌 운동인 이유', '읽기와 쓰기가 기억과 사고의 연결망을 어떻게 사용하는지 소개합니다.', '쓰기', 'https://www.youtube.com/shorts/uhqbsQBVsVk', 'uhqbsQBVsVk', 'https://i.ytimg.com/vi/uhqbsQBVsVk/hqdefault.jpg', 'published', true, 20, '2026-04-26', 'cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('신비로운 읽기와 쓰기 능력, 어떻게 키워질까요?', '읽기와 쓰기 능력이 학습과 경험을 통해 자라는 과정을 살펴봅니다.', '언어', 'https://www.youtube.com/shorts/_SHe3JWLBWs', '_SHe3JWLBWs', 'https://i.ytimg.com/vi/_SHe3JWLBWs/hqdefault.jpg', 'published', true, 30, '2026-04-19', 'cf5cdb8d-71c3-4192-9a7e-302f1692a75f')
on conflict (youtube_id) where youtube_id <> '' do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  youtube_url = excluded.youtube_url,
  thumbnail_url = excluded.thumbnail_url;

commit;
