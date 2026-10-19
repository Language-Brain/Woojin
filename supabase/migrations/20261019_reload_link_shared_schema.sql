-- 링크 공개 마이그레이션 적용 후 PostgREST가 새 테이블과 RPC를 즉시 인식하도록
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행합니다.

notify pgrst, 'reload schema';
