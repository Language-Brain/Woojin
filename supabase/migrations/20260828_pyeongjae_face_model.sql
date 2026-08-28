-- 『평재문집』 자료를 실제 종이의 면 단위로 관리하기 위한 추가형 마이그레이션
-- 기존 본문과 번역 데이터는 보존합니다.
update public.pyeongjae_entries
set side = case
  when side = 'mixed' and coalesce((pages->1->>'original_reading'),'') <> '' and coalesce((pages->0->>'original_reading'),'') = '' then 'back'
  when side = 'mixed' then 'front'
  else side
end
where side = 'mixed';

update public.pyeongjae_entries
set title = format('평재문집 제%s책 제%s장 %s', book_no, sheet_no, case side when 'back' then '뒷면' else '앞면' end)
where title ~ '^평재문집 제[1-3]책 제[0-9]+장 앞·뒷면$';

-- 기존 자료 원문에 명시된 권차를 구조화 정보로 보완한다.
-- 원문·번역 내용은 변경하지 않는다.
update public.pyeongjae_entries
set volume_no = 1
where volume_no is null
  and pages::text like '%卷之一%';

alter table public.pyeongjae_entries drop constraint if exists pyeongjae_entries_side_check;
alter table public.pyeongjae_entries add constraint pyeongjae_entries_side_check check (side in ('front','back'));

drop index if exists public.pyeongjae_book_sheet_unique;
create unique index if not exists pyeongjae_book_sheet_side_unique
  on public.pyeongjae_entries(book_no,sheet_no,side);

create index if not exists pyeongjae_book_sheet_side_order_idx
  on public.pyeongjae_entries(book_no,sheet_no,side)
  where status='published';
