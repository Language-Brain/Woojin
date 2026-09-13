-- 『평재문집』 안내 글을 책·장·면과 분리해 저장하는 추가형 마이그레이션
-- 기존 원문 행과 본문은 변경하지 않습니다.
alter table public.pyeongjae_entries
  add column if not exists entry_kind text not null default 'source';
alter table public.pyeongjae_entries
  add column if not exists guide_body text not null default '';

alter table public.pyeongjae_entries
  drop constraint if exists pyeongjae_entries_entry_kind_check;
alter table public.pyeongjae_entries
  add constraint pyeongjae_entries_entry_kind_check
  check (entry_kind in ('source','guide'));

alter table public.pyeongjae_entries alter column book_no drop not null;
alter table public.pyeongjae_entries alter column sheet_no drop not null;
alter table public.pyeongjae_entries alter column start_page drop not null;
alter table public.pyeongjae_entries alter column end_page drop not null;
alter table public.pyeongjae_entries alter column side drop not null;
alter table public.pyeongjae_entries alter column genre drop not null;

drop index if exists public.pyeongjae_book_sheet_unique;
drop index if exists public.pyeongjae_book_sheet_side_unique;
create unique index if not exists pyeongjae_source_book_sheet_side_unique
  on public.pyeongjae_entries(book_no,sheet_no,side)
  where entry_kind='source';

alter table public.pyeongjae_entries
  drop constraint if exists pyeongjae_entry_kind_fields_check;
alter table public.pyeongjae_entries
  add constraint pyeongjae_entry_kind_fields_check check (
    (entry_kind='guide' and book_no is null and sheet_no is null and start_page is null and end_page is null and side is null and volume_no is null and genre is null)
    or
    (entry_kind='source' and book_no between 1 and 3 and sheet_no > 0 and start_page > 0 and end_page >= start_page and side in ('front','back') and genre is not null)
  ) not valid;
alter table public.pyeongjae_entries validate constraint pyeongjae_entry_kind_fields_check;

create index if not exists pyeongjae_entry_kind_public_idx
  on public.pyeongjae_entries(entry_kind,created_at)
  where status='published';
