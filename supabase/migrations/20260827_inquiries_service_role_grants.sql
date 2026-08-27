-- Vercel 서버 문의 API에 필요한 최소 권한입니다.
-- 공개 anon/authenticated 쓰기 차단과 관리자 RLS 정책은 그대로 유지됩니다.
grant select, insert, update on table public.inquiries to service_role;
