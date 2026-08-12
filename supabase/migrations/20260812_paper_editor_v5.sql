-- 해외 연구 소개 입력 단순화: 기존 세부 열은 보존하고 새 통합 필드만 추가합니다.
alter table public.posts
  add column if not exists citation text not null default '',
  add column if not exists doi_url text not null default '',
  add column if not exists full_text_url text not null default '';

comment on column public.posts.citation is '완성된 형식으로 입력하는 논문 서지정보';
comment on column public.posts.doi_url is '정규화한 DOI 링크';
comment on column public.posts.full_text_url is '논문 전문 외부 링크';

-- 기존 데이터는 갱신하거나 삭제하지 않습니다. 공개 화면은 새 필드가 비어 있으면
-- original_title, authors, publication_year, journal 등의 기존 열을 계속 사용합니다.
