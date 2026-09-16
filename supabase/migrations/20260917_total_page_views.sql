-- 공개 상세 페이지가 실제로 열릴 때마다 조회수를 한 번 누적합니다.
-- 기존 조회수 및 중복 방지 이벤트 기록은 보존하며 삭제하거나 초기화하지 않습니다.

create or replace function public.record_post_view(target_post uuid, visitor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.posts
    where id = target_post and status = 'published'
  ) then
    return false;
  end if;

  -- post_views의 기존 행을 그대로 보존하면서 열람마다 고유 이벤트를 추가합니다.
  insert into public.post_views(post_id, visitor_hash, viewed_on)
  values (
    target_post,
    md5(target_post::text || clock_timestamp()::text || random()::text),
    current_date
  );
  return true;
end;
$$;

create or replace function public.increment_guide_view(
  p_guide_id uuid,
  p_token uuid,
  p_viewer text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.guides
  set view_count = view_count + 1
  where id = p_guide_id
    and status = 'active'
    and (visibility = 'public' or (visibility = 'unlisted' and access_token = p_token));
  return found;
end;
$$;

-- 배포 전 캐시된 구형 화면의 추가 호출은 계속 무시하여 한 번의 진입이 중복 집계되지 않게 합니다.
create or replace function public.increment_guide_view(p_guide_id uuid, p_token uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

create or replace function public.increment_pyeongjae_view(p_entry_id uuid, p_viewer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pyeongjae_entries
  set view_count = view_count + 1
  where id = p_entry_id and status = 'published';
end;
$$;

revoke all on function public.record_post_view(uuid, text) from public;
grant execute on function public.record_post_view(uuid, text) to anon, authenticated;
grant execute on function public.increment_guide_view(uuid, uuid, text) to anon, authenticated;
grant execute on function public.increment_guide_view(uuid, uuid) to anon, authenticated;
grant execute on function public.increment_pyeongjae_view(uuid, text) to anon, authenticated;