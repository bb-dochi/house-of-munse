# HOUSE OF MUNSE

보드게임 컬렉션 사이트. 공방의 솥에 재료(인원·시간·기분)를 넣고 주사위를 뿌리면 오늘의 게임이 나옵니다.

- `apps/web` — React + Vite (화면)
- `apps/api` — NestJS + Prisma + PostgreSQL (API)
- `tools/` — 배경 그림 생성 스크립트, DB 없이 화면을 띄우는 가짜 API

## 현재 확인된 것과 아닌 것

이 코드는 패키지 설치가 막힌 환경에서 작성했습니다. 그래서 확인 범위가 나뉩니다.

| 부분 | 상태 |
|---|---|
| 필터·정렬·추천, 장부 입력 정리, 로그인 토큰, BGG 응답 변환 | 테스트 16개 통과 (`npm test`) |
| 화면 5종 (홈·컬렉션·후기·위시리스트·어드민) | 가짜 API에 연결해 브라우저에서 동작 확인 |
| NestJS 컨트롤러·서비스, Prisma 스키마, 시드 | **실행해 보지 못함.** 처음 `npm install` 후 빌드에서 오류가 나면 여기부터 보세요 |
| BGG 실제 호출 | **확인 못 함.** 토큰이 있어야 합니다 |
| `tsc` 타입 검사 (web) | **확인 못 함.** `npm run typecheck -w apps/web` |

## 로컬에서 실행

Node 20 이상이 필요합니다.

```bash
npm install

# 1) DB 없이 화면만 보기 (가짜 API, 관리자 비밀번호: munse)
npm run build:web
npx tsx tools/mock-api.ts apps/web/dist 4173     # http://localhost:4173

# 2) 진짜 API로 실행
cp apps/api/.env.example apps/api/.env             # 값 채우기
npm run prisma:generate -w apps/api
npm run db:push -w apps/api                        # 테이블 만들기
npm run seed -w apps/api                           # 예시 게임 16개 넣기 (비어 있을 때만)
npm run dev:api                                    # http://localhost:3000/api
npm run dev:web                                    # http://localhost:5173
```

## 무료로 배포하기

카드 등록 없이 쓸 수 있는 조합입니다. 각 서비스의 무료 조건은 바뀔 수 있으니 가입할 때 한 번 확인하세요.

| 역할 | 서비스 | 비고 |
|---|---|---|
| 화면 | Cloudflare Pages | 무료, 항상 켜져 있음 |
| API | Render (Free web service) | **한동안 요청이 없으면 잠들고, 깨어나는 데 1분쯤 걸립니다** |
| DB | Neon (PostgreSQL Free) | 이 사이트 규모에는 충분 |

### 1. Neon — DB
1. neon.tech에서 프로젝트를 만들고 연결 문자열(`postgresql://...sslmode=require`)을 복사합니다.

### 2. Render — API
1. Render 대시보드 → New → Blueprint → 이 저장소 선택 (`render.yaml`을 읽습니다).
2. 환경변수를 채웁니다.
   - `DATABASE_URL`: Neon 연결 문자열
   - `ADMIN_PASSWORD`: 어드민 비밀번호
   - `WEB_ORIGIN`: Cloudflare Pages 주소 (예: `https://house-of-munse.pages.dev`)
   - `BGG_TOKEN`: BGG 토큰 (없으면 비워 둠)
   - `TOKEN_SECRET`은 자동 생성됩니다.
3. 첫 배포가 끝나면 예시 데이터를 한 번 넣습니다. 로컬에서 `DATABASE_URL`을 Neon 주소로 두고 `npm run seed -w apps/api`.
4. `https://<서비스>.onrender.com/api/health`가 `{"ok":true}`를 돌려주면 성공입니다.

### 3. Cloudflare Pages — 화면
1. Workers & Pages → Create → Pages → 이 저장소 연결.
2. 빌드 설정
   - Build command: `npm ci && npm run build:web`
   - Build output directory: `apps/web/dist`
   - 환경변수 `VITE_API_URL`: `https://<서비스>.onrender.com/api`
3. `public/_redirects`가 들어 있어 `/collection` 같은 주소로 바로 들어와도 열립니다.

### 잠드는 문제
- 화면은 서버가 깨어나는 동안 "깨어나는 데 1분쯤 걸릴 수 있어요"라고 안내합니다.
- 더 빠르게 하려면 API를 잠들지 않는 무료 호스팅(예: Vercel 함수)으로 옮기는 방법이 있습니다. 바뀌는 것은 서버 진입점 정도입니다.

## BGG 연동

1. https://boardgamegeek.com/applications 에서 앱을 등록하고 승인되면 토큰을 받습니다.
2. 토큰을 API 환경변수 `BGG_TOKEN`에 넣습니다.
3. 어드민 → "BGG에서 가져오기"에서 영문 이름으로 검색해 장부에 가져옵니다.

지켜야 할 것:
- BGG는 서버에서만 호출하고, 가져온 결과는 DB에 저장합니다. 방문자 요청 때는 BGG를 부르지 않습니다.
- 공개 사이트에는 "Powered by BGG" 로고를 BGG 링크와 함께 넣어야 합니다. 지금 꼬리말에는 **글자 링크만** 있으니, 배포 전에 BGG가 제공하는 로고 이미지로 바꿔 주세요.
- 수익이나 광고가 붙으면 상업 라이선스 조건을 확인하세요.

## API 요약

| 주소 | 설명 |
|---|---|
| `GET /api/games?q&players&weight&category&sort` | 컬렉션 목록 (방출 완료 제외, 가격 없음) |
| `GET /api/games/:id` | 게임 하나 |
| `GET /api/recommend?players&time&mood` | 솥 추천. 인원 필수, 기분 2점, 시간 1점 |
| `GET /api/plays`, `GET /api/wishlist` | 후기, 위시리스트 |
| `POST /api/auth/login` | `{password}` → `{token}` (12시간) |
| `GET /api/admin/ledger` | 장부 (가격 포함, 로그인 필요) |
| `POST/PATCH/DELETE /api/admin/games[/:id]` | 장부 추가·수정·삭제 |
| `GET /api/admin/bgg/search?q`, `POST /api/admin/bgg/import` | BGG 검색·가져오기 |

## 아직 없는 것

- 후기·위시리스트 작성 화면 (지금은 읽기만, 예시 데이터)
- 게임별 픽셀 그림은 예시 16종만 있습니다. BGG에서 가져온 게임은 BGG 이미지가 박스 표지 칸에 들어갑니다.
- 로그인 시도 횟수 제한

## 그림과 글꼴

- 배경 그림은 `tools/scene.py`로 생성한 것입니다 (Python, numpy, Pillow).
- 글꼴: [Galmuri](https://github.com/quiple/galmuri) (SIL Open Font License 1.1). 라이선스 전문은 `apps/web/public/assets/Galmuri-LICENSE.md`.
