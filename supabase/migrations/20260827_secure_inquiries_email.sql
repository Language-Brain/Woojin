-- 문의를 공개 브라우저가 아닌 서버 API에서만 접수하도록 확장합니다.
alter table public.inquiries add column if not exists kind text not null default 'question';
alter table public.inquiries add column if not exists phone text not null default '';
alter table public.inquiries add column if not exists subject text not null default '';
alter table public.inquiries add column if not exists spam_reason text not null default '';
alter table public.inquiries add column if not exists email_status text not null default 'not_requested';
alter table public.inquiries add column if not exists email_provider_id text not null default '';
alter table public.inquiries add column if not exists email_error text not null default '';
alter table public.inquiries add column if not exists email_sent_at timestamptz;
alter table public.inquiries add column if not exists is_read boolean not null default false;
alter table public.inquiries add column if not exists source_ip_hash text not null default '';
alter table public.inquiries add column if not exists dedupe_key text;

alter table public.inquiries drop constraint if exists inquiries_kind_check;
alter table public.inquiries add constraint inquiries_kind_check check (kind in ('lecture', 'question'));
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check check (status in ('new', 'reviewing', 'replied', 'archived', 'spam'));
alter table public.inquiries drop constraint if exists inquiries_email_status_check;
alter table public.inquiries add constraint inquiries_email_status_check check (email_status in ('not_requested', 'pending', 'sent', 'failed', 'suppressed'));
alter table public.inquiries drop constraint if exists inquiries_name_length;
alter table public.inquiries add constraint inquiries_name_length check (char_length(name) <= 80) not valid;
alter table public.inquiries drop constraint if exists inquiries_email_length;
alter table public.inquiries add constraint inquiries_email_length check (char_length(email) <= 254) not valid;
alter table public.inquiries drop constraint if exists inquiries_phone_length;
alter table public.inquiries add constraint inquiries_phone_length check (char_length(phone) <= 40) not valid;
alter table public.inquiries drop constraint if exists inquiries_subject_length;
alter table public.inquiries add constraint inquiries_subject_length check (char_length(subject) <= 160) not valid;

create unique index if not exists inquiries_dedupe_key_idx on public.inquiries(dedupe_key) where dedupe_key is not null;
create index if not exists inquiries_rate_limit_idx on public.inquiries(source_ip_hash, created_at desc);

-- 공개 사용자의 직접 삽입은 차단하고 Vercel 서버 API(service role)만 접수합니다.
drop policy if exists "inquiries_public_insert" on public.inquiries;
revoke insert on public.inquiries from anon, authenticated;

-- 인증된 관리자만 비공개 문의 전체를 읽고 상태를 변경합니다.
drop policy if exists "inquiries_admin_select" on public.inquiries;
create policy "inquiries_admin_select" on public.inquiries
for select to authenticated using (public.is_admin());

-- 홈페이지에 공개하기로 선택한 답변만 익명 조회를 허용합니다.
drop policy if exists "inquiries_public_read_answers" on public.inquiries;
create policy "inquiries_public_read_answers" on public.inquiries
for select to anon using (status = 'replied' and is_public = true);

grant select on public.inquiries to anon, authenticated;
grant update, delete on public.inquiries to authenticated;
