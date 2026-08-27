-- 언어와 뇌 연구 아카이브 v2
-- Supabase SQL Editor에서 한 번 실행합니다.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '관리자',
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('paper', 'news', 'works')),
  ref_no text not null,
  category text not null default '',
  title text not null,
  excerpt text not null default '',
  academic_info text not null default '',
  source text not null default '',
  image_url text not null default '',
  link_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  published_at date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(type, ref_no)
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'question' check (kind in ('lecture', 'question')),
  name text not null default '익명' check (char_length(name) <= 80),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  subject text not null default '' check (char_length(subject) <= 160),
  question text not null check (char_length(question) between 2 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'replied', 'archived', 'spam')),
  spam_reason text not null default '',
  email_status text not null default 'not_requested' check (email_status in ('not_requested', 'pending', 'sent', 'failed', 'suppressed')),
  email_provider_id text not null default '',
  email_error text not null default '',
  email_sent_at timestamptz,
  is_read boolean not null default false,
  source_ip_hash text not null default '',
  dedupe_key text unique,
  admin_reply text not null default '',
  is_public boolean not null default false,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at before update on public.inquiries
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "profiles_read_self" on public.profiles;
create policy "profiles_read_self" on public.profiles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts
for select to anon, authenticated using (status = 'published' or public.is_admin());

drop policy if exists "posts_admin_insert" on public.posts;
create policy "posts_admin_insert" on public.posts
for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update" on public.posts
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts
for delete to authenticated using (public.is_admin());

drop policy if exists "inquiries_public_insert" on public.inquiries;

drop policy if exists "inquiries_public_read_answers" on public.inquiries;
create policy "inquiries_public_read_answers" on public.inquiries
for select to anon using (status = 'replied' and is_public = true);

drop policy if exists "inquiries_admin_select" on public.inquiries;
create policy "inquiries_admin_select" on public.inquiries
for select to authenticated using (public.is_admin());

drop policy if exists "inquiries_admin_update" on public.inquiries;
create policy "inquiries_admin_update" on public.inquiries
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inquiries_admin_delete" on public.inquiries;
create policy "inquiries_admin_delete" on public.inquiries
for delete to authenticated using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant select on public.profiles to authenticated;
grant select on public.inquiries to anon, authenticated;
revoke insert on public.inquiries from anon, authenticated;
grant update, delete on public.inquiries to authenticated;

insert into public.profiles (user_id, email, display_name, role)
values ('cf5cdb8d-71c3-4192-9a7e-302f1692a75f', 'ccuccuci@gmail.com', '권우진', 'admin')
on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name, role = 'admin';


insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read" on storage.objects
for select to public using (bucket_id = 'post-images');

drop policy if exists "post_images_admin_insert" on storage.objects;
create policy "post_images_admin_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post_images_admin_update" on storage.objects;
create policy "post_images_admin_update" on storage.objects
for update to authenticated using (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post_images_admin_delete" on storage.objects;
create policy "post_images_admin_delete" on storage.objects
for delete to authenticated using (bucket_id = 'post-images' and public.is_admin());
