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
  name text not null default '익명',
  email text not null default '',
  question text not null check (char_length(question) between 2 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'replied', 'archived')),
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
create policy "inquiries_public_insert" on public.inquiries
for insert to anon, authenticated with check (status = 'new' and admin_reply = '' and is_public = false);

drop policy if exists "inquiries_public_read_answers" on public.inquiries;
create policy "inquiries_public_read_answers" on public.inquiries
for select to anon, authenticated using ((status = 'replied' and is_public = true) or public.is_admin());

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
grant insert(name, email, question) on public.inquiries to anon, authenticated;
grant update, delete on public.inquiries to authenticated;

insert into public.profiles (user_id, email, display_name, role)
values ('cf5cdb8d-71c3-4192-9a7e-302f1692a75f', 'ccuccuci@gmail.com', '권우진', 'admin')
on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name, role = 'admin';

insert into public.posts (type, ref_no, category, title, source, status, sort_order, published_at, created_by) values
('paper','1087','Brain & Cognition','해마가 작아질수록 단어 기억도 흐려진다','Brain & Cognition','published',1087,'2026-05-02','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1086','NeuroImage','암호화어망 초기, 뇌의 연결망은 어떻게 변하는가','NeuroImage','published',1086,'2026-04-28','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1085','Aging Brain','작업기억이 저하될 때 전전두엽에서 나타나는 변화','Aging Brain','published',1085,'2026-04-24','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1084','Sleep & Memory','잠을 잘 자는 노인은 기억도 더 오래 유지한다','Sleep & Memory','published',1084,'2026-04-18','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1083','Neuroscience','신체 활동이 노년기 해마의 신경가소성을 촉진한다','Neuroscience','published',1083,'2026-04-12','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1082','Dementia Research','말이 막히기 시작할 때 뇌 백질에 생기는 일','Dementia Research','published',1082,'2026-04-06','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1081','Healthy Aging','신체활동과 교류가 노년의 인지예비력을 높인다','Healthy Aging','published',1081,'2026-03-30','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('paper','1080','Music & Brain','음악 기반 인지훈련과 정서의 관계','Music & Brain','published',1080,'2026-03-24','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2179','코메디닷컴','머리에 충격 받으면 치매 위험 증가','코메디닷컴','published',2179,'2026-05-03','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2178','연합뉴스','송파구 치매 어르신, 11일 석촌호수 걷기','연합뉴스','published',2178,'2026-05-01','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2177','연합뉴스','보건소 치매안심센터, 치매환자 장기도 지원','연합뉴스','published',2177,'2026-04-29','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2176','뉴스1','中 치매할머니 아파트 148층서 택라고 덜컥','뉴스1','published',2176,'2026-04-27','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2175','노컷뉴스','치매 걸린 아내, 당신은 무엇을 기억하나요?','노컷뉴스','published',2175,'2026-04-23','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2174','메디컬투데이','알츠하이머치매 혈액 검사로 추정 가능','메디컬투데이','published',2174,'2026-04-19','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2173','연합뉴스','80세 이후에 나타나는 다른 유형의 치매','연합뉴스','published',2173,'2026-04-15','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('news','2172','코메디닷컴','김혜자 열연 눈이 부시게, 치매 이야기','코메디닷컴','published',2172,'2026-04-10','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0068','연구노트','단어를 기억하는 것은 어떻게 행위를 조직하는가','연구노트','published',68,'2026-04-30','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0067','저서','언어는 우리의 생각을 어떻게 조직하는가','저서','published',67,'2026-04-21','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0066','강의','인지란 무엇인가—기억에서 판단과 행동까지','강의','published',66,'2026-04-12','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0065','연구노트','하루를 언어로 기억하는 습관과 기억','연구노트','published',65,'2026-04-05','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0064','저서','읽기는 어떻게 뇌를 움직이고 삶을 바꾸는가','저서','published',64,'2026-03-28','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0063','강의','건강증진과 치매 사이, 인지 저하를 이해하기','강의','published',63,'2026-03-20','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0062','연구노트','이를 붙이기—결핍을 설명하는 두 언어의 힘','연구노트','published',62,'2026-03-13','cf5cdb8d-71c3-4192-9a7e-302f1692a75f'),
('works','0061','저서','노년의 언어와 인지, 그리고 삶의 문해','저서','published',61,'2026-03-05','cf5cdb8d-71c3-4192-9a7e-302f1692a75f')
on conflict (type, ref_no) do nothing;

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
