# 언어와 뇌 홈페이지 — 데스크탑 작업 준비 안내

이 문서는 집의 데스크탑에서 현재 홈페이지 작업을 안전하게 이어가기 위한 안내입니다. 비밀번호, 비밀키, 로그인 토큰은 이 문서나 GitHub에 저장하지 않습니다.

## 1. 프로젝트 정보

- GitHub 저장소: https://github.com/Language-Brain/Woojin.git
- 기본 브랜치: `main`
- 공개 이용자 페이지: https://languagebrain.vercel.app/customer
- 관리자 페이지: https://languagebrain.vercel.app/admin
- Supabase 프로젝트 ID: `vhaosgzyvoijgwryybry`
- 구성: 정적 HTML·CSS·JavaScript, Vercel Serverless 설정 API, Supabase Database·Auth·Storage

이 프로젝트에는 `package.json`이나 별도 빌드 단계가 없습니다. 홈페이지 실행에 필요한 외부 라이브러리는 각 HTML 문서에서 CDN으로 불러옵니다.

## 2. 데스크탑에 필요한 프로그램

1. [Git for Windows](https://git-scm.com/download/win)
2. Chrome 또는 Edge 같은 최신 웹 브라우저
3. 로컬 미리보기용 Python 3 또는 Node.js(선택)
4. Vercel과 같은 방식으로 로컬 실행하려면 Node.js와 Vercel CLI(선택)

## 3. 저장소 복제

PowerShell을 열고 작업할 상위 폴더로 이동한 뒤 실행합니다.

```powershell
git clone https://github.com/Language-Brain/Woojin.git
cd Woojin
git switch main
git pull --ff-only origin main
```

이미 복제한 폴더가 있다면 새로 복제하지 말고 그 폴더에서 `git status`를 먼저 확인합니다.

## 4. 환경변수

필요한 이름은 다음 세 가지입니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard → Project Settings → Data API에서 확인
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Dashboard → Project Settings → API Keys에서 `Publishable key` 확인
- `NEXT_PUBLIC_SITE_URL`: 운영 주소 `https://languagebrain.vercel.app`

로컬에서 Vercel 방식으로 실행할 때만 `.env.example`을 `.env.local`로 복사한 뒤 실제 값을 채웁니다.

```powershell
Copy-Item .env.example .env.local
```

`.env.local`은 Git에 올라가지 않습니다. Supabase `service_role` 또는 secret key는 브라우저 프로젝트에 넣지 마세요. 이 홈페이지는 공개용 publishable key와 Supabase RLS 정책을 사용합니다.

Vercel 환경변수는 데스크탑의 `.env.local`과 별개입니다. Vercel Dashboard → 해당 프로젝트 → Settings → Environment Variables에서 Production, Preview, Development 환경을 각각 확인합니다.

## 5. 로컬 실행

### 간단한 정적 미리보기

Python이 설치되어 있다면 프로젝트 루트에서 실행합니다.

```powershell
py -m http.server 3000
```

그다음 브라우저에서 다음 주소를 엽니다.

- 이용자 화면: http://localhost:3000/customer/
- 관리자 화면: http://localhost:3000/admin/

정적 미리보기는 코드에 포함된 브라우저용 Supabase 공개 설정을 사용합니다. 운영과 같은 `/api/config` 동작까지 확인하려면 아래 Vercel 방식을 사용합니다.

### Vercel 방식으로 미리보기

Node.js가 설치되어 있다면 다음을 실행합니다.

```powershell
npx vercel dev
```

처음 실행할 때는 Vercel 로그인이 필요할 수 있습니다. 기존 `languagebrain` 프로젝트에 연결하고 새 프로젝트를 만들지 마세요.

## 6. 검사 명령

이 프로젝트는 별도 설치·빌드가 필요 없는 정적 사이트입니다. Node.js가 있으면 운영 연결 검사를 실행할 수 있습니다.

```powershell
node tests/public-integration-smoke.mjs
```

검사는 공개 홈페이지, 관리자 페이지, Supabase 공개 글 조회, 비공개 글 차단, 공개 동영상 상태를 확인합니다. JavaScript 문법은 다음처럼 확인할 수 있습니다.

```powershell
node --check admin/admin.js
node --check archive/archive.js
```

## 7. Supabase 연결

- 데이터베이스 변경 기록: `supabase/migrations/`
- 전체 초기 구조 참고: `supabase/schema.sql`
- 관리자 인증: Supabase Auth
- 글·카테고리·동영상: Supabase Database
- 이미지: Supabase Storage

새 데스크탑에서는 데이터베이스를 새로 만들거나 migration을 다시 실행할 필요가 없습니다. 기존 온라인 Supabase 프로젝트에 같은 관리자 계정으로 로그인하면 됩니다. 새 migration을 작성한 경우에만 내용을 검토한 뒤 기존 프로젝트에 한 번 적용합니다.

## 8. 두 컴퓨터에서 안전하게 작업하는 순서

작업 전:

```powershell
git switch main
git status
git pull --ff-only origin main
```

작업 후:

```powershell
git status
git add 변경한파일
git commit -m "변경 내용을 설명하는 메시지"
git pull --rebase origin main
git push origin main
```

노트북과 데스크탑에서 동시에 같은 파일을 수정하지 마세요. 한 컴퓨터에서 작업을 끝낸 뒤 반드시 commit과 push를 하고, 다른 컴퓨터에서는 작업 시작 전에 pull을 합니다. `git reset --hard`나 강제 푸시는 사용하지 않습니다.

## 9. 자주 확인할 오류

- `git status`에 예상하지 못한 파일이 보이면 바로 삭제하지 말고 내용을 먼저 확인합니다.
- `git pull --ff-only`가 실패하면 두 컴퓨터에 서로 다른 커밋이 있다는 뜻이므로 강제로 덮어쓰지 않습니다.
- 관리자 로그인이 안 되면 Supabase Auth 사용자와 Redirect URL을 확인합니다.
- 저장이 안 되면 브라우저 개발자 도구의 오류와 Supabase RLS 정책을 확인합니다.
- 로컬에서 `/api/config`가 404라면 정적 서버의 정상적인 제한입니다. `npx vercel dev`로 다시 확인합니다.
- 운영 반영이 늦으면 GitHub의 `main` 최신 커밋과 Vercel Deployment 상태를 비교합니다.
- 이미지가 안 보이면 로컬 절대경로가 아니라 Supabase Storage의 온라인 URL인지 확인합니다.

문제가 생겼을 때 기존 Supabase 프로젝트, GitHub 저장소, Vercel 프로젝트를 새로 만들지 말고 현재 연결 정보를 먼저 점검하세요.
