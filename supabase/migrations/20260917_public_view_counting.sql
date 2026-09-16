-- 공개 보조 자료 열람을 브라우저별 하루 한 번만 집계합니다.
-- 기존 조회수와 자료는 변경하거나 초기화하지 않습니다.
create table if not exists public.guide_view_events (
  guide_id uuid not null references public.guides(id) on delete cascade,
  viewer_hash text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (guide_id, viewer_hash, viewed_on)
);
alter table public.guide_view_events enable row level security;
revoke all on public.guide_view_events from anon, authenticated;

create or replace function public.increment_guide_view(p_guide_id uuid,p_token uuid,p_viewer text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if char_length(coalesce(p_viewer,'')) < 8 or char_length(p_viewer) > 160 then return false; end if;
  insert into public.guide_view_events(guide_id,viewer_hash)
  select p_guide_id,md5(p_viewer) from public.guides
  where id=p_guide_id and status='active'
    and (visibility='public' or (visibility='unlisted' and access_token=p_token))
  on conflict do nothing;
  if found then
    update public.guides set view_count=view_count+1 where id=p_guide_id and status='active';
    return true;
  end if;
  return false;
end; $$;

-- 새 화면은 방문자 식별자가 있는 3인자 함수를 사용합니다.
-- 이전 2인자 호출은 배포 전후 중복 집계를 막기 위해 더 이상 증가시키지 않습니다.
create or replace function public.increment_guide_view(p_guide_id uuid,p_token uuid default null)
returns void language plpgsql security definer set search_path=public as $$ begin return; end; $$;

grant execute on function public.increment_guide_view(uuid,uuid,text) to anon,authenticated;
grant execute on function public.increment_guide_view(uuid,uuid) to anon,authenticated;
