-- 링크 공개 글: 기존 자료를 보존하는 추가형 마이그레이션
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행합니다.

begin;

create extension if not exists pgcrypto;

alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check
  check (status in ('draft', 'shared', 'published', 'trashed'));

create table if not exists public.post_shares (
  post_id uuid primary key references public.posts(id) on delete cascade,
  token_hash bytea not null unique,
  token_value text not null unique,
  password_hash text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  stopped_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.post_share_attempts (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  client_key text not null default '',
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create table if not exists public.post_shared_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  source_url text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  created_at timestamptz not null default now(),
  unique(post_id, source_url)
);

create index if not exists post_share_attempts_lookup_idx
  on public.post_share_attempts(post_id, client_key, attempted_at desc);

alter table public.post_shares enable row level security;
alter table public.post_share_attempts enable row level security;
alter table public.post_shared_assets enable row level security;

drop policy if exists "post_shares_admin_all" on public.post_shares;
create policy "post_shares_admin_all" on public.post_shares
for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.post_shares from anon;
revoke all on public.post_share_attempts from anon, authenticated;
revoke all on public.post_shared_assets from anon;
grant select, insert, update, delete on public.post_shares to authenticated;
grant select on public.post_shared_assets to authenticated;

drop policy if exists "post_shared_assets_admin_read" on public.post_shared_assets;
create policy "post_shared_assets_admin_read" on public.post_shared_assets
for select to authenticated using (public.is_admin());

create or replace function public.new_share_token()
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

revoke all on function public.new_share_token() from public;

create or replace function public.enable_post_share(
  target_post uuid,
  access_password text default null,
  rotate_token boolean default false
)
returns table(token text, link_created_at timestamptz, password_protected boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  generated_token text;
  existing public.post_shares%rowtype;
  password_value text := nullif(btrim(coalesce(access_password, '')), '');
  password_was_supplied boolean := access_password is not null;
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if password_value is not null and char_length(password_value) < 6 then raise exception 'password_too_short'; end if;
  if password_value is not null and char_length(password_value) > 128 then raise exception 'password_too_long'; end if;
  perform 1 from public.posts where id = target_post and status <> 'trashed' for update;
  if not found then raise exception 'post_not_found'; end if;

  select * into existing from public.post_shares where post_id = target_post for update;
  if existing.post_id is null or rotate_token then
    generated_token := public.new_share_token();
  else
    generated_token := existing.token_value;
  end if;

  insert into public.post_shares(post_id, token_hash, token_value, password_hash, enabled, created_at, rotated_at, stopped_at, created_by)
  values (
    target_post,
    digest(generated_token, 'sha256'),
    generated_token,
    case when not password_was_supplied and existing.post_id is not null then existing.password_hash when password_value is null then null else crypt(password_value, gen_salt('bf', 12)) end,
    true,
    coalesce(existing.created_at, now()),
    case when existing.post_id is null or rotate_token then now() else coalesce(existing.rotated_at, now()) end,
    null,
    auth.uid()
  )
  on conflict (post_id) do update set
    token_hash = excluded.token_hash,
    token_value = excluded.token_value,
    password_hash = excluded.password_hash,
    enabled = true,
    rotated_at = excluded.rotated_at,
    stopped_at = null,
    created_by = auth.uid();

  update public.posts set status = 'shared' where id = target_post;
  return query select generated_token, coalesce(existing.created_at, now()), (select password_hash is not null from public.post_shares where post_id = target_post);
end;
$$;

create or replace function public.stop_post_share(target_post uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  update public.post_shares set enabled = false, stopped_at = now() where post_id = target_post;
  update public.posts set status = 'draft' where id = target_post and status = 'shared';
end;
$$;

create or replace function public.resolve_shared_post(
  supplied_token text,
  supplied_password text default '',
  supplied_client_key text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  share_row public.post_shares%rowtype;
  post_row public.posts%rowtype;
  recent_client_failures integer;
  recent_total_failures integer;
  password_ok boolean;
begin
  delete from public.post_share_attempts where attempted_at < now() - interval '24 hours';
  select * into share_row from public.post_shares
    where token_hash = digest(coalesce(supplied_token, ''), 'sha256') limit 1;
  if share_row.post_id is null then return jsonb_build_object('code', 'not_found'); end if;
  if not share_row.enabled then return jsonb_build_object('code', 'stopped'); end if;

  select * into post_row from public.posts where id = share_row.post_id and status = 'shared';
  if post_row.id is null then return jsonb_build_object('code', 'stopped'); end if;

  if share_row.password_hash is not null then
    select count(*) into recent_client_failures from public.post_share_attempts
      where post_id = share_row.post_id and client_key = left(coalesce(supplied_client_key, ''), 128)
        and succeeded = false and attempted_at > now() - interval '15 minutes';
    select count(*) into recent_total_failures from public.post_share_attempts
      where post_id = share_row.post_id and succeeded = false and attempted_at > now() - interval '15 minutes';
    if recent_client_failures >= 5 or recent_total_failures >= 30 then
      return jsonb_build_object('code', 'rate_limited', 'retry_after_seconds', 900);
    end if;
    if coalesce(supplied_password, '') = '' then return jsonb_build_object('code', 'password_required'); end if;
    password_ok := share_row.password_hash = crypt(supplied_password, share_row.password_hash);
    insert into public.post_share_attempts(post_id, client_key, succeeded)
      values (share_row.post_id, left(coalesce(supplied_client_key, ''), 128), password_ok);
    if not password_ok then return jsonb_build_object('code', 'wrong_password'); end if;
  end if;

  return jsonb_build_object(
    'code', 'ok',
    'post', to_jsonb(post_row) - 'working_content' - 'created_by',
    'shared_at', share_row.created_at,
    'password_protected', share_row.password_hash is not null
  );
end;
$$;

revoke all on function public.enable_post_share(uuid, text, boolean) from public;
revoke all on function public.stop_post_share(uuid) from public;
revoke all on function public.resolve_shared_post(text, text, text) from public;
grant execute on function public.enable_post_share(uuid, text, boolean) to authenticated;
grant execute on function public.stop_post_share(uuid) to authenticated;
grant execute on function public.resolve_shared_post(text, text, text) to anon, authenticated;

-- 일반 익명 조회는 전체 공개 글만 허용합니다. 링크 공개 글은 RPC를 통하지 않고 읽을 수 없습니다.
drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts
for select to anon, authenticated using (status = 'published' or public.is_admin());

-- 앞으로 링크 공개 전용 이미지를 저장할 비공개 버킷입니다.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('shared-post-images', 'shared-post-images', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shared_post_images_admin_all" on storage.objects;
create policy "shared_post_images_admin_all" on storage.objects
for all to authenticated
using (bucket_id = 'shared-post-images' and public.is_admin())
with check (bucket_id = 'shared-post-images' and public.is_admin());

commit;
