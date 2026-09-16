-- 『평재문집』 원문 자료의 독자용 추천 표시와 짧은 읽기 안내를 추가합니다.
-- 기존 행은 추천하지 않음(false), 빈 안내로 유지하며 제목·본문·정렬 정보는 변경하지 않습니다.
alter table public.pyeongjae_entries
  add column if not exists recommended_reading boolean not null default false;

alter table public.pyeongjae_entries
  add column if not exists reading_guide text not null default '';

alter table public.pyeongjae_entries
  drop constraint if exists pyeongjae_entries_reading_guide_length_check;
alter table public.pyeongjae_entries
  add constraint pyeongjae_entries_reading_guide_length_check
  check (char_length(reading_guide) <= 60) not valid;
alter table public.pyeongjae_entries
  validate constraint pyeongjae_entries_reading_guide_length_check;

create index if not exists pyeongjae_recommended_source_order_idx
  on public.pyeongjae_entries(book_no,sheet_no,side)
  where entry_kind='source' and recommended_reading=true and status='published';
