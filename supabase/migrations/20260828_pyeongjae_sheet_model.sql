-- 『평재문집』 등록 단위를 실제 종이 한 장(앞·뒷면)으로 전환하는 추가형 마이그레이션
-- 기존 행과 번역 본문은 보존하며 기존 쪽수 필드는 호환용으로 유지합니다.
alter table public.pyeongjae_entries add column if not exists sheet_no integer;
alter table public.pyeongjae_entries add column if not exists admin_note text not null default '';
update public.pyeongjae_entries set sheet_no=start_page where sheet_no is null;
alter table public.pyeongjae_entries alter column sheet_no set not null;
alter table public.pyeongjae_entries alter column volume_no drop not null;
alter table public.pyeongjae_entries drop constraint if exists pyeongjae_sheet_no_positive;
alter table public.pyeongjae_entries add constraint pyeongjae_sheet_no_positive check (sheet_no > 0) not valid;
alter table public.pyeongjae_entries validate constraint pyeongjae_sheet_no_positive;
alter table public.pyeongjae_entries drop constraint if exists pyeongjae_entries_genre_check;
alter table public.pyeongjae_entries add constraint pyeongjae_entries_genre_check check (genre in ('시','서간','편지','잡저','기문','축문','제문','애사','묘지명','행장','복합·경계','기타'));
drop index if exists public.pyeongjae_book_sheet_unique;
create unique index pyeongjae_book_sheet_unique on public.pyeongjae_entries(book_no,sheet_no);
create index if not exists pyeongjae_book_sheet_order_idx on public.pyeongjae_entries(book_no,sheet_no) where status='published';
