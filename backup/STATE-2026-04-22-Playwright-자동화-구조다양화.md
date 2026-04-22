# Project State Backup — 2026-04-22

Blogger Playwright 완전 자동화 + 글 구조 다양화 + 클러스터 중복 방지 완료.
Previous backup: `STATE-2026-04-21-네이버블로그-Gemini리라이터-SEO진단.md`.

---

## What Changed

### 1. Blogger Playwright 완전 자동화
Blogger API가 열지 않는 **퍼머링크**와 **검색 설명** 필드를 Playwright로 자동 입력.

**파일 추가:**
- `scripts/blogger-session-setup.js` — 1회성 Google 로그인 (storageState 저장)
- `scripts/blogger-finalize-post.js` — 포스트 편집 페이지에서 필드 자동 입력 + 저장

**통합:**
- `publish-draft-fruit.js` — 업로드 직후 자동 호출 (세션 없으면 graceful skip)
- `auto-publish-fruit.js` — `slug`, `searchDescription`을 `runPublishDraft`에 전달
- `.github/workflows/auto-publish-fruit.yml` — Step 3-1b/3-1c 추가 (Playwright 설치 + 세션 복원)

**GitHub Secrets:**
- `BLOGGER_SESSION_STATE` — `state.json`을 base64 인코딩해 저장 (24KB)
- Actions 실행 시 복원 → `.blogger-session/state.json` → Playwright가 사용

**제약:**
- DRAFT 상태에서만 작동 (Blogger는 발행된 글의 URL 변경 불가)
- 세션은 수 주~수 개월 유효. 만료 시 `node scripts/blogger-session-setup.js` 재실행 → 다시 `gh secret set BLOGGER_SESSION_STATE` 업로드 필요

**Blogger 한글 UI 네이밍 주의:**
- "영구 링크" ❌ → **"퍼머링크"** ✅
- 일반 `<button>` 아닌 `<div role="button">` 형태

### 2. 글 구조 다양화 (park-gwail.md)
기존엔 매 글마다 "실전 3단계"가 하드코딩 → 산딸기 3편이 전부 똑같은 3단계 구조 나옴.

**수정:** 5가지 포맷 중 주제에 맞게 선택:

| 포맷 | 적합 주제 |
|---|---|
| A. 체크리스트형 | OO 고르는 법 |
| B. 단계형 (2~5단계) | OO 보관법 |
| C. 비교표형 | A vs B |
| D. 레시피형 | 수제청·잼 만들기 |
| E. Q&A형 | 오해·진실 |

섹션 수 3~5 유연화, "3단계" 고정 제거.

### 3. 클러스터 중복 방지 (auto-publish-fruit.js)
같은 과일 클러스터의 이전 발행글(draft 상태)을 자동으로 읽어 Gemini에 전달 → 공통 팩트(수분 85% 등) 반복 회피.

**추가 함수:** `loadSameClusterPosts(topic, topicsData)`
- `fruit-blog/drafts/*.html`에서 같은 클러스터 + day 작은 + status=draft 포스트 로드
- 태그 제거 후 앞 1,500자 요약 → `clusterHint` 변수에 담아 system prompt에 주입

### 4. 페르소나 도입부 개선 (park-gwail.md)
**첫 문단을 SEO 검색 설명으로 기능하도록** 2단 구조:
- 첫 문단 (120~160자): 정보형, 핵심 키워드, 이모지·인사 금지 → 구글이 자동 발췌해 검색 결과 설명으로 사용
- 둘째 문단: 기존 "안녕하세요~" 친근 체험체

### 5. 산딸기 클러스터 마무리
3편 모두 LIVE:
- Day 1: 고르는 법 (4/20, 6 조회)
- Day 2: 보관법 (4/21, 0 조회)
- Day 3: 수제청·잼 (4/21, 0 조회)

topics.yaml 동기화:
- Day 3: `ready` → `draft` (수동 발행 반영)
- Day 4 (블루베리 무농약 vs 일반): `pending` → `ready`

### 6. Day 2 발행 일지
- 예약 발행 설정 (18:00 KST)
- 사장님이 실수로 조기 게시 버튼 눌러 몇 시간 일찍 공개
- 수동으로 퍼머링크·검색설명 직접 세팅
- 이후 Playwright 통합으로 다음부턴 자동

---

## 내일 (2026-04-23) 18:00 KST 예정

**Day 4 — 무농약 블루베리와 일반 블루베리, 진짜 차이는**

예상 흐름:
1. GitHub Actions 자동 시작
2. Gemini 본문 + 썸네일 + 이미지 생성 (비교표형 포맷 선택 예상)
3. Blogger DRAFT 업로드
4. **Playwright 자동 실행** — 퍼머링크 `organic-vs-regular-blueberry` + 검색 설명 자동 세팅
5. 네이버 리라이팅 + 5장 이미지
6. 텔레그램 알림 (편집 URL + 공개 URL)
7. 사장님이 "발행" 버튼 1번만 누르면 공개

**성공 확인 방법:**
- 텔레그램 알림에 편집 URL
- Blogger에서 URL이 `/organic-vs-regular-blueberry.html` 형식인지
- 검색 설명 필드에 텍스트 있는지

**실패 시 디버그:**
- GitHub Actions 로그에서 "Blogger 세션 복원" 단계 확인
- `debug-blogger-save-fail.png` 등 아티팩트 확인

---

## 현재 모든 자동화 상태

| 기능 | 상태 | 트리거 |
|---|---|---|
| 과일 블로그 Gemini 작성 | ✅ | GitHub Actions 매일 18시 + `/fruit` |
| Blogger DRAFT 업로드 | ✅ | 과일 발행 후 |
| Blogger 퍼머링크·검색설명 자동 | ✅ | DRAFT 업로드 후 Playwright |
| 네이버 Gemini 리라이팅 | ✅ | 과일 발행 후 자동 |
| 네이버 섹션 이미지 5장 | ✅ | 리라이팅 후 자동 |
| 스마트스토어 SEO 진단 | ✅ | `/seo` + 월요일 9시 |
| 경제 블로그 자동 발행 | ✅ | 매일 07:30 + 17:00 |

---

## Repository

**URL:** https://github.com/khe3716/content-studio
**Last commits (이번 세션):**
- `1fdf79a` chore: 쿠팡 상품 이미지 10장 추가 (이전 세션)
- `0a2991d` feat(blogger): Playwright 자동화로 퍼머링크·검색설명 자동 설정
- `eb4be37` ci: restore Blogger session from GitHub Secret
- `6faa8a5` feat(writer): 글 구조 다양화 + 클러스터 내 중복 방지
- `c68529f` fix: Day 3 draft 반영 + Day 4 블루베리 ready 승격

---

## .env 로컬 추가
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (세션 2회차에 이미 추가됨)
- (이번 세션엔 .env 변경 없음)

## GitHub Secrets 추가
- `BLOGGER_SESSION_STATE` (base64 state.json)
- 기존: `GEMINI_API_KEY`, `FRUIT_BLOG_ID`, `BLOG_ID`, `GOOGLE_*`, `TELEGRAM_*`, `NAVER_COMMERCE_*`

---

## 네이버 블로그 개설 상황

**상태:** 블로그 생성됨 but 상업 URL (`dalcom_salang`) + 상업 블로그명("달콤살랑") + 상업 카테고리("상품리뷰") 문제 발견.

**결정:**
- URL은 못 바꿔서 그대로 유지
- 블로그명 중립화 미정 (사장님이 결정 연기)
- 카테고리 "상품리뷰" → "요리·레시피"로 변경 완료
- **네이버 블로그 전체 작업 보류** — 준비되면 재개

**콘텐츠 전략:**
- **옵션 A 확정**: 실제 본인(박과일 필명 유지) + 과일 80% + 요리 20%
- 여자 페르소나 위장 안 함 (진정성 우선)
- 구글·네이버 같은 페르소나 공유
- **네이버 반자동 복붙** 방식 유지 (Playwright 자동은 계정 정지 위험이라 포기)

---

## 다른 Claude 세션 작업물 (이 세션에서 건드리지 않음)

- `coupang-automation/` — 쿠팡 자동화 시스템
- `fruit-blog/detail-pages/` — 스마트스토어 상세페이지 생성
- `youtube-shorts/` — 한국 썰 콘텐츠 자동화
- `backup/STATE-2026-04-21-상세페이지-자동화-완성.md`
- `backup/STATE-2026-04-21-쿠팡-API자동화-이미지병목.md`
- `backup/STATE-2026-04-22-쿠팡-스킬-완성.md`
- `backup/STATE-2026-04-22-쿠팡-자동화-완전성공.md`

package.json에 이들이 설치한 의존성(@google/genai, @napi-rs/canvas, dotenv, exceljs)이 이미 있어서 같이 커밋됨.

---

## Pending — 다음 세션 후보

### 즉시 가능
- [ ] 인스타/틱톡 SNS 전략 논의 (다음 대화 주제)
- [ ] 리뷰 이벤트 쿠폰 문구 + 톡톡 친구 유도 메시지 (30분)
- [ ] SEO 진단 키워드 힌트 확장 (국내산, 부산 등) — **보류**
- [ ] 네이버 블로그 개설 준비 완료 후 재개

### Phase 2 후보
- [ ] 인스타그램 이미지 템플릿 자동 생성기
- [ ] 시즌별 톡톡 메시지 (`/season` 명령)
- [ ] 재구매 고객 관리

### 운영 개선
- [ ] Playwright 세션 만료 감지 알림 (텔레그램)
- [ ] Day 4 실행 결과 모니터링 스크립트

---

**End of State (2026-04-22)**
