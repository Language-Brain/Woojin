-- 『평재문집』 공개 디지털 문집: 기존 자료를 변경하지 않는 추가형 구조
create table if not exists public.pyeongjae_entries (
  id uuid primary key default gen_random_uuid(),
  book_no smallint not null check (book_no between 1 and 3),
  volume_no smallint not null check (volume_no between 1 and 6),
  start_page integer not null check (start_page > 0),
  end_page integer not null check (end_page >= start_page and end_page <= start_page + 4),
  side text not null default 'mixed' check (side in ('front','back','mixed')),
  genre text not null default '기타' check (genre in ('시','편지','잡저','기문','축문','제문','묘지명','행장','기타')),
  work_title text not null default '' check (char_length(work_title) <= 300),
  title text not null check (char_length(title) between 1 and 300),
  summary text not null default '' check (char_length(summary) <= 1000),
  people text[] not null default '{}',
  places text[] not null default '{}',
  tags text[] not null default '{}',
  pages jsonb not null default '[]'::jsonb check (jsonb_typeof(pages) = 'array'),
  reference_links jsonb not null default '[]'::jsonb check (jsonb_typeof(reference_links) = 'array'),
  review_status text not null default '초벌 정리' check (review_status in ('초벌 정리','판독 검토 필요','인명·지명 확인 필요','번역 검토 필요','공개 가능','검토 완료')),
  status text not null default 'draft' check (status in ('draft','published','trashed')),
  source_order integer not null default 0,
  view_count bigint not null default 0,
  original_images jsonb not null default '[]'::jsonb check (jsonb_typeof(original_images) = 'array'),
  published_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pyeongjae_entry_range_unique unique (volume_no,start_page,end_page,side)
);
create index if not exists pyeongjae_public_order_idx on public.pyeongjae_entries(volume_no,source_order,start_page) where status='published';
create index if not exists pyeongjae_tags_idx on public.pyeongjae_entries using gin(tags);
create index if not exists pyeongjae_people_idx on public.pyeongjae_entries using gin(people);
create index if not exists pyeongjae_places_idx on public.pyeongjae_entries using gin(places);
create table if not exists public.pyeongjae_view_events (
  entry_id uuid not null references public.pyeongjae_entries(id) on delete cascade,
  viewer_hash text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key(entry_id,viewer_hash,viewed_on)
);
alter table public.pyeongjae_view_events enable row level security;
revoke all on public.pyeongjae_view_events from anon,authenticated;
drop trigger if exists pyeongjae_entries_set_updated_at on public.pyeongjae_entries;
create trigger pyeongjae_entries_set_updated_at before update on public.pyeongjae_entries for each row execute function public.set_updated_at();
alter table public.pyeongjae_entries enable row level security;
drop policy if exists "pyeongjae_public_read" on public.pyeongjae_entries;
drop policy if exists "pyeongjae_admin_insert" on public.pyeongjae_entries;
drop policy if exists "pyeongjae_admin_update" on public.pyeongjae_entries;
drop policy if exists "pyeongjae_admin_delete" on public.pyeongjae_entries;
create policy "pyeongjae_public_read" on public.pyeongjae_entries for select using (status='published' or public.is_admin());
create policy "pyeongjae_admin_insert" on public.pyeongjae_entries for insert with check (public.is_admin());
create policy "pyeongjae_admin_update" on public.pyeongjae_entries for update using (public.is_admin()) with check (public.is_admin());
create policy "pyeongjae_admin_delete" on public.pyeongjae_entries for delete using (public.is_admin());
create or replace function public.increment_pyeongjae_view(p_entry_id uuid,p_viewer text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if char_length(coalesce(p_viewer,'')) < 8 or char_length(p_viewer) > 160 then return; end if;
  insert into public.pyeongjae_view_events(entry_id,viewer_hash)
  select p_entry_id,md5(p_viewer) from public.pyeongjae_entries where id=p_entry_id and status='published'
  on conflict do nothing;
  if found then update public.pyeongjae_entries set view_count=view_count+1 where id=p_entry_id and status='published'; end if;
end; $$;
grant select on public.pyeongjae_entries to anon;
grant select,insert,update,delete on public.pyeongjae_entries to authenticated;
grant execute on function public.increment_pyeongjae_view(uuid,text) to anon,authenticated;
insert into public.guide_tags(name,display_order,is_visible) values ('평재문집',5,true) on conflict(name) do update set is_visible=true,display_order=least(public.guide_tags.display_order,5);
