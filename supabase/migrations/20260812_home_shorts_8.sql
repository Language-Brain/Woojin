-- 홈과 동영상 자료실에 게재할 YouTube Shorts 8건을 한곳에서 관리합니다.
-- 기존 영상 행은 youtube_id로 안전하게 갱신하며 다른 콘텐츠는 변경하지 않습니다.

begin;

update public.videos
set home_featured = false
where home_featured = true
  and youtube_id not in (
    'lZkGv9yIotA', 'iWCkZAp-qeE', '5JnOwY7DA7s', 'sFWwGOtcihw',
    '_SHe3JWLBWs', 'luaM26uims4', 'uhqbsQBVsVk', 'fM8pmyiMgLU'
  );

insert into public.videos (
  title, description, category, youtube_url, youtube_id, thumbnail_url,
  status, home_featured, home_order, published_at, created_by
) values
('읽고 쓰기가 최고의 뇌 운동인 이유', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/lZkGv9yIotA', 'lZkGv9yIotA', 'https://i.ytimg.com/vi/lZkGv9yIotA/maxresdefault.jpg', 'published', true, 1, current_date, auth.uid()),
('‘문해력’의 의미를 아시나요?', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/iWCkZAp-qeE', 'iWCkZAp-qeE', 'https://i.ytimg.com/vi/iWCkZAp-qeE/maxresdefault.jpg', 'published', true, 2, current_date, auth.uid()),
('80세에 한글을 배워도 뇌 건강에 도움이 될까요?', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/5JnOwY7DA7s', '5JnOwY7DA7s', 'https://i.ytimg.com/vi/5JnOwY7DA7s/maxresdefault.jpg', 'published', true, 3, current_date, auth.uid()),
('신비로운 ‘읽기와 쓰기’ 능력', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/sFWwGOtcihw', 'sFWwGOtcihw', 'https://i.ytimg.com/vi/sFWwGOtcihw/maxresdefault.jpg', 'published', true, 4, current_date, auth.uid()),
('AI와 인간 언어의 차이, “책임”', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/_SHe3JWLBWs', '_SHe3JWLBWs', 'https://i.ytimg.com/vi/_SHe3JWLBWs/maxresdefault.jpg', 'published', true, 5, current_date, auth.uid()),
('[문해교수법] 왜 ‘머거요’라고 실수할까요?', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/luaM26uims4', 'luaM26uims4', 'https://i.ytimg.com/vi/luaM26uims4/maxresdefault.jpg', 'published', true, 6, current_date, auth.uid()),
('어휘력의 비밀', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/uhqbsQBVsVk', 'uhqbsQBVsVk', 'https://i.ytimg.com/vi/uhqbsQBVsVk/maxresdefault.jpg', 'published', true, 7, current_date, auth.uid()),
('같은 말도 다르게 들리는 이유', '', 'YouTube Shorts', 'https://www.youtube.com/shorts/fM8pmyiMgLU', 'fM8pmyiMgLU', 'https://i.ytimg.com/vi/fM8pmyiMgLU/maxresdefault.jpg', 'published', true, 8, current_date, auth.uid())
on conflict (youtube_id) where youtube_id <> '' do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  youtube_url = excluded.youtube_url,
  thumbnail_url = excluded.thumbnail_url,
  status = 'published',
  home_featured = true,
  home_order = excluded.home_order,
  deleted_at = null;

commit;
