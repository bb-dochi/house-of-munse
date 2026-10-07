# HOUSE OF MUNSE

보드게임 컬렉션 사이트. 공방의 솥에 재료(인원·시간·기분)를 넣고 주사위를 뿌리면 오늘의 게임이 나옵니다.

- `apps/web/src` — React + Vite (화면)
- `apps/web/worker` — Cloudflare Worker (`/api`), D1(SQLite)에 직접 SQL
- `apps/web/migrations` — D1 마이그레이션. `0000~0002`는 house-of-munse2의 `games` 테이블 그대로, `0003`은 이 사이트에 필요한 열(`category`, `description`, `icon_key`, `status`)과 `plays`·`wishes` 테이블
- `tools/` — 배경 그림 생성 스크립트

화면과 API가 한 Worker에서 같은 주소로 나갑니다. 따로 띄울 API 서버도, CORS 설정도 없습니다.

## 로컬에서 실행

Node 20.19 이상이 필요합니다. 명령은 저장소 루트에서 실행합니다.

```bash
npm install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # 관리자 비밀번호 등 (예시 비밀번호: munse)
npm run db:migrate:local                          # 로컬 D1에 테이블 만들기
npm run db:seed:local                             # 예시 게임 16개·후기·위시 넣기 (여러 번 실행해도 중복 없음)
npm run dev                                       # http://localhost:5173 (화면 + API + 로컬 D1)
```

로컬 D1은 `apps/web/.wrangler/`에 저장됩니다. 지우면 처음 상태로 돌아갑니다.

| 명령 | 설명 |
|---|---|
| `npm test` | 필터·추천, 장부 입력 정리, 행 변환, 로그인 토큰, BGG 응답 변환 테스트 |
| `npm run typecheck` | 화면과 Worker 타입 검사 |
| `npm run build` | `apps/web/dist/client`(화면)와 `apps/web/dist/house_of_munse`(Worker) 생성 |

## 내 컬렉션 넣기 (BG Stats 백업)

1. BG Stats에서 내보낸 JSON을 `apps/web/data-private/`에 넣습니다. 이 폴더는 git에 올라가지 않습니다.
2. `npm run db:import:local -w apps/web` — 가장 최근 JSON을 읽어 소장 중인 게임을 넣습니다.
   - 다시 실행해도 중복되지 않습니다. BG Stats에서 오는 칸(인원·시간·평점·표지·구매 정보·플레이 수)만 새로 고치고, 장부에서 고친 이름·상태·카테고리·웨이트는 그대로 둡니다.
   - 확장판은 장부에 한 줄씩 들어가고, 본판을 알 수 있으면(BG Stats에 붙여 둔 확장, 함께 한 판, 이름) 공개 화면에서 본판 카드에 묶입니다.
3. BG Stats에는 웨이트와 카테고리가 없습니다. `.dev.vars`에 `BGG_TOKEN`을 넣고 `npm run db:bgg:local -w apps/web`을 실행하면 BGG 번호가 있는 게임의 빈 칸(웨이트·카테고리·인원·시간·표지)과 확장판 연결을 BGG 기준으로 채웁니다.
4. 예시 게임을 지우려면: `npx wrangler d1 execute house-of-munse --local --command "DELETE FROM games WHERE id LIKE 'sample-%'"` (`apps/web`에서)

배포한 DB에는 같은 명령의 `:remote` 버전(`db:import:remote`, `db:bgg:remote`)을 씁니다.

- 인원을 모르는 게임은 컬렉션에 "인원 미정"으로 보이고, 솥 추천과 인원 검색에서는 빠집니다. 어드민 장부에서 인원을 채우면 들어갑니다.

## 배포 (Cloudflare Workers + D1)

무료 플랜으로 충분한 규모입니다. 명령은 `apps/web`에서 실행합니다.

1. `npx wrangler login`
2. `npx wrangler d1 create house-of-munse` → 출력된 `database_id`를 `wrangler.jsonc`에 넣습니다.
3. `npm run db:migrate:remote`, 예시 데이터가 필요하면 `npm run db:seed:remote`
4. 비밀값 넣기
   - `npx wrangler secret put ADMIN_PASSWORD`
   - `npx wrangler secret put TOKEN_SECRET` (길고 무작위인 문자열)
   - `npx wrangler secret put BGG_TOKEN` (없으면 생략, BGG 기능만 꺼짐)
5. `npm run deploy`
6. `https://house-of-munse.<계정>.workers.dev/api/health`가 `{"ok":true}`를 돌려주면 성공입니다.

## 데이터 모양

- 게임 id는 문자열(UUID, BG Stats에서 온 것은 `bgstats:…`)입니다. 컬렉션의 `HM-001` 번호는 등록 순서로 매깁니다.
- 인원·시간은 house-of-munse2와 같이 글자로 저장합니다 (`"2–4"`, `"30–60 min"`). API가 읽을 때 숫자로 바꿉니다. 시간 범위는 긴 쪽을 씁니다.
- 상태는 `status`(보유·대여 중·방출 예정·방출 완료)에 두고, 방출 완료면 `disposed`도 1로 맞춥니다. 방문자 화면은 `owned = 1 AND disposed = 0`인 게임만 보여 줍니다.

## BGG 연동

1. https://boardgamegeek.com/applications 에서 앱을 등록하고 승인되면 토큰을 받습니다.
2. 토큰을 `BGG_TOKEN`에 넣습니다 (로컬은 `.dev.vars`, 배포는 `wrangler secret put`).
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

게임 id(`:id`)는 문자열입니다.

## 아직 없는 것

- 후기·위시리스트 작성 화면 (지금은 읽기만, 예시 데이터)
- 게임별 픽셀 그림은 예시 16종만 있습니다. BGG에서 가져온 게임은 BGG 이미지가 박스 표지 칸에 들어갑니다.
- 로그인 시도 횟수 제한

## 그림과 글꼴

- 배경 그림은 `tools/scene.py`로 생성한 것입니다 (Python, numpy, Pillow).
- 글꼴: [Galmuri](https://github.com/quiple/galmuri) (SIL Open Font License 1.1). 라이선스 전문은 `apps/web/public/assets/Galmuri-LICENSE.md`.
