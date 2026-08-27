-- 최근 주목한 책: 기존 자료와 분리된 추가형 구조
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  author text not null default '' check (char_length(author) <= 240),
  description text not null default '' check (char_length(description) <= 1200),
  cover_url text,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  status text not null default 'draft' check (status in ('draft','published','trashed')),
  is_pinned boolean not null default false,
  display_order integer not null default 0,
  publisher text check (char_length(publisher) <= 240),
  publication_year integer check (publication_year between 1000 and 2200),
  isbn text check (char_length(isbn) <= 40),
  admin_note text check (char_length(admin_note) <= 500),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_public_shelf_idx
  on public.books (is_pinned desc, display_order asc, created_at desc)
  where status = 'published' and deleted_at is null;
create index if not exists books_status_idx on public.books (status, updated_at desc);

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at before update on public.books
for each row execute function public.set_updated_at();

alter table public.books enable row level security;

drop policy if exists "books_public_read" on public.books;
create policy "books_public_read" on public.books for select
using ((status = 'published' and deleted_at is null) or public.is_admin());

drop policy if exists "books_admin_insert" on public.books;
create policy "books_admin_insert" on public.books for insert
with check (public.is_admin());
drop policy if exists "books_admin_update" on public.books;
create policy "books_admin_update" on public.books for update
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "books_admin_delete" on public.books;
create policy "books_admin_delete" on public.books for delete
using (public.is_admin());

grant select on public.books to anon;
grant select, insert, update, delete on public.books to authenticated;
