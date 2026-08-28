-- 자료 안내: 파일 없이 웹 문서만 저장하는 추가형 구조
create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null default gen_random_uuid() unique,
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '' check (char_length(description) <= 600),
  body text not null default '' check (char_length(body) <= 100000),
  course_name text not null default '' check (char_length(course_name) <= 240),
  institution_name text not null default '' check (char_length(institution_name) <= 240),
  tags text[] not null default '{}',
  external_links jsonb not null default '[]'::jsonb check (jsonb_typeof(external_links) = 'array'),
  youtube_url text,
  visibility text not null default 'private' check (visibility in ('public','unlisted','private')),
  status text not null default 'active' check (status in ('active','trashed')),
  view_count bigint not null default 0,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.guide_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guides_public_idx on public.guides(updated_at desc) where status='active' and visibility='public';
create index if not exists guides_tags_idx on public.guides using gin(tags);
create index if not exists guide_tags_order_idx on public.guide_tags(display_order,name);
drop trigger if exists guides_set_updated_at on public.guides;
create trigger guides_set_updated_at before update on public.guides for each row execute function public.set_updated_at();
drop trigger if exists guide_tags_set_updated_at on public.guide_tags;
create trigger guide_tags_set_updated_at before update on public.guide_tags for each row execute function public.set_updated_at();
alter table public.guides enable row level security;
alter table public.guide_tags enable row level security;
create policy "guides_public_read" on public.guides for select using ((status='active' and visibility='public') or public.is_admin());
create policy "guides_admin_insert" on public.guides for insert with check (public.is_admin());
create policy "guides_admin_update" on public.guides for update using (public.is_admin()) with check (public.is_admin());
create policy "guides_admin_delete" on public.guides for delete using (public.is_admin());
create policy "guide_tags_public_read" on public.guide_tags for select using (is_visible or public.is_admin());
create policy "guide_tags_admin_insert" on public.guide_tags for insert with check (public.is_admin());
create policy "guide_tags_admin_update" on public.guide_tags for update using (public.is_admin()) with check (public.is_admin());
create policy "guide_tags_admin_delete" on public.guide_tags for delete using (public.is_admin());

create or replace function public.get_unlisted_guide(p_id uuid,p_token uuid)
returns setof public.guides language sql stable security definer set search_path=public as $$
  select * from public.guides where id=p_id and access_token=p_token and status='active' and visibility='unlisted';
$$;
create or replace function public.increment_guide_view(p_guide_id uuid,p_token uuid default null)
returns void language sql security definer set search_path=public as $$
  update public.guides set view_count=view_count+1
  where id=p_guide_id and status='active' and
    (visibility='public' or (visibility='unlisted' and access_token=p_token));
$$;
grant select on public.guides,public.guide_tags to anon;
grant select,insert,update,delete on public.guides,public.guide_tags to authenticated;
grant execute on function public.get_unlisted_guide(uuid,uuid) to anon,authenticated;
grant execute on function public.increment_guide_view(uuid,uuid) to anon,authenticated;
insert into public.guide_tags(name,display_order) values
('강의계획서',10),('아카데믹글쓰기',20),('한국어교육',30),('아동센터',40),('문해교육',50),('컨설팅자료',60),('스터디',70)
on conflict(name) do nothing;
