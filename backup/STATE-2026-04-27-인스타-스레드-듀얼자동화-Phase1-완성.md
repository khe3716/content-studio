# Project State Backup — 2026-04-27

인스타그램 + 스레드(Threads) **듀얼 콘텐츠 자동화 Phase 1 완성**.
한 번 생성하면 같은 주제로 인스타용·스레드용 캡션이 따로 텔레그램에 도착, 사장님은 폰에서 양쪽 채널에 복붙 업로드.

다음 세션 시작점: **사장님 Phase 0 (계정 개설 + 2주 수동 운영) 완료 후 → Phase 2 Meta + Threads Graph API 자동 게시**.

Previous backup: `STATE-2026-04-25-야간리서치팀-구축.md` (또는 인스타 직전 컨텍스트는 `STATE-2026-04-23-인스타시스템-예약발행전환직전.md`).

Plan source: `~/.claude/plans/linked-crafting-seahorse.md`.

---

## 이번 세션에서 완성된 것

### 1. 페르소나 — Threads 섹션 신설
**파일 수정:** `agents/insta-writer.md`

- 헤더 변경: `박과일 (인스타·스레드 버전)`, outputs에 인스타 캡션 + 스레드 캡션 명시
- 신규 섹션 **"스레드(Threads) 전용 규칙"**:
  - 인스타 vs 스레드 비교표 (글자 수, 해시태그, 톤, 이미지)
  - 스레드 글 구조 (300~450자, 후킹 → 본문 1~2문장 → 해시태그 1개)
  - 스레드 카피 가이드 (대화체 OK, 줄바꿈 자주, 인스타 cross-promo 절대 금지)
  - 톤 예시: 인스타 카피 vs 스레드 변주 (같은 주제 다른 표현)
- 절대 금지 추가: "인스타 ↔ 스레드 cross-promo", "인스타 캡션과 스레드 캡션 동일 작성"
- 출력 JSON 스키마를 `card_news` / `single` / `infographic` 세 포맷별로 분리, 각각 `instagram_caption` + `threads_caption` 필드 명시

### 2. 카드뉴스 생성기 — 듀얼 캡션 통합
**파일 수정:** `insta/generate-card-news.js`

- Gemini 프롬프트에 `instagram_caption` + `threads_caption` 둘 다 요청
- 백워드 호환 처리: 기존 `caption` 필드도 fallback으로 인식 (이미 생성된 Day 1 깨지지 않음)
- 캡션 파일 분리 저장:
  - `{prefix}-instagram.txt`
  - `{prefix}-threads.txt`
  - `{prefix}-caption.txt` (백워드 호환 유지)
- 텔레그램 안내 메시지 4개로 분리:
  1. 카드뉴스 완성 알림
  2. 카드 이미지 5장 (CI일 때만 raw URL)
  3. 📝 ① **인스타 캡션** + 인스타 업로드 4단계
  4. 🧵 ② **스레드 캡션** + 스레드 업로드 5단계 + cross-promo 금지 경고

### 3. 단일 포스트 생성기 — 신규
**파일 추가:** `insta/generate-single.js` (≈300줄)

- Imagen 4 Fast로 1080×1080 정사각 이미지 1장
- SVG 오버레이: 큰 헤드라인 (8~12자) + 보조 한 줄 (10~15자)
- Gemini가 `image_overlay`(헤드라인·서브텍스트) + `instagram_caption` + `threads_caption` + `hashtags` + `image_prompt` 한 번에 생성
- 텔레그램 안내 동일 (이미지 1장 + 인스타 캡션 + 스레드 캡션)
- topics.yaml에서 `format === 'single'` ready 토픽 자동 선택
- **첫 실행 대상:** Day 2 — "산딸기 빨리 무르지 않게 하는 꿀팁" (이미 ready 상태)

### 4. 인포그래픽 생성기 — 신규
**파일 추가:** `insta/generate-infographic.js` (≈300줄)

- 표·랭킹·비교 차트 1~2장 슬라이드
- **Imagen 미사용** — 단색 크림 배경(`#FFF8E7`) + 빨강 강조(`#E53935`)로 표 가독성 우선 (실사 위에 표 올리면 모바일에서 잘 안 보임)
- SVG로 표 직접 렌더링:
  - rank 있으면 빨간 원 안 숫자 + 이름 + note
  - rank 없으면 비교표 (좌측 이름, 우측 note)
  - 행 4~7개, 행 높이 자동 조정 (총 높이 H-200 안에 맞춤)
  - 줄무늬 배경 (`rgba(229,57,53,0.06)` 교차)
- 1080×1350 (4:5)
- **첫 실행 대상:** Day 4 — "5월 제철 과일 TOP 7" (랭킹), Day 8 — "토마토 품종별 당도·용도 비교" (비교표) 등

### 5. 워크플로우 — format 자동 분기
**파일 수정:** `.github/workflows/auto-publish-insta.yml`

- 이름 변경: `인스타 + 스레드 콘텐츠 생성`
- **Step 4 신규**: `id: pick` — Node로 topics.yaml 읽어서 `format` 추출, `$GITHUB_OUTPUT`에 저장
  - `inputs.day` 있으면 그 day의 format
  - 없으면 첫 ready 토픽의 format
- **Step 5 변경**: `case` 문으로 분기
  - `card_news` → `generate-card-news.js`
  - `single` → `generate-single.js`
  - `infographic` → `generate-infographic.js`
- 커밋 메시지: `chore: auto-generate insta+threads content [skip ci]`
- 실패 알림 메시지: `🚨 인스타+스레드 생성 실패`

### 6. 텔레그램 워커 — `/instastatus` 추가 + `/insta` 안내문 갱신
**파일 수정:** `telegram-worker/worker.js`

- `/help` 메뉴: 인스타 섹션 표시 변경 → "📸 **인스타 + 스레드**", `/insta` 설명에 "format에 따라 카드/단일/인포 분기 + 텔레그램에 인스타·스레드 캡션 따로 도착" 추가
- `/help` 공통 섹션에 **`/instastatus`** 추가
- `/insta` 응답 메시지: "인스타 + 스레드 생성 시작! 2-4분 후 이미지 + 인스타 캡션 + 스레드 캡션 따로 도착합니다."
- `/instastatus` 분기 추가 — `INSTA_WORKFLOW`의 최근 실행 3건 표시, 라벨 "📸 인스타+스레드"

### 7. 플랜 문서 업데이트
**파일 수정:** `~/.claude/plans/linked-crafting-seahorse.md`

- 제목 변경: 인스타그램 → 인스타그램 + 스레드(Threads)
- 2026-04-27 진행 상황 섹션 추가 (완료 항목 6개)
- 사장님 Phase 0 액션 4단계 (Threads 계정 개설은 인스타 로그인하면 자동 생성됨 명시)
- Phase 2 분리: **2-A 인스타 Graph API** + **2-B Threads Graph API** (`THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, 인스타→스레드 5분 간격 순차 게시 패턴)

---

## 듀얼 자동화 동작 흐름

```
사장님: /insta (폰 텔레그램)
    ↓
워커: GitHub Actions auto-publish-insta.yml dispatch (workflow_dispatch)
    ↓
Step 4: topics.yaml에서 다음 ready 토픽 → format 추출
    ↓
Step 5: format별 분기
    ├─ card_news    → generate-card-news.js   (5장 + 듀얼 캡션)
    ├─ single       → generate-single.js      (1장 + 듀얼 캡션)
    └─ infographic  → generate-infographic.js (1~2장 + 듀얼 캡션)
    ↓
Gemini 2.5 Pro: 인스타 캡션 + 스레드 캡션 동시 생성 (다른 표현 강제)
Imagen 4 Fast (카드뉴스·단일만): 배경 이미지
Sharp + SVG: 합성
    ↓
텔레그램 알림 4종:
  1. 완성 알림 (Day · 제목)
  2. 이미지 (raw.githubusercontent.com URL)
  3. 📝 인스타 캡션 + 업로드 4단계
  4. 🧵 스레드 캡션 + 업로드 5단계 + cross-promo 금지 경고
    ↓
Step 6: insta/topics.yaml + insta/drafts/ 자동 커밋 (status: draft, 다음 ready 자동 승격)
    ↓
사장님: 폰에서 인스타 앱·스레드 앱 양쪽에 따로 복붙 업로드 (3~5분)
```

---

## topics.yaml 현재 상태

| 항목 | 값 |
|---|---|
| 총 토픽 | **30개** |
| card_news | 14개 |
| single | 10개 |
| infographic | 6개 |
| 상태 draft | 1 (Day 1 산딸기 카드뉴스, 4/22 생성) |
| 상태 ready | **1 (Day 2 산딸기 보관, single 포맷)** ← 다음 `/insta` 첫 타자 |
| 상태 pending | 28 |

> `/insta` 누르면 Day 2 single이 신규 `generate-single.js`로 처리됨 (검증 1차).

---

## 사장님 Phase 0 액션 (이번 세션 외 — 사장님 작업)

### 인스타 계정 (`parkfruit.today` 또는 신규)
4/23 백업에서 이미 `parkfruit.today` 개설됨. 그대로 계속 사용 or 정지 이력 회피 위해 신규 개설 둘 중 결정 필요.

- [ ] 결정: parkfruit.today 그대로 vs 신규 (다른 번호·다른 네트워크)
- [ ] 프로페셔널 계정 전환 — 식품 및 음료
- [ ] Facebook Page 생성 + 인스타 연동 (Phase 2-A 사전 준비)
- [ ] 프로필 사진 (필요 시 AI 생성 요청)

### Threads 계정
- [ ] 인스타 계정으로 로그인 → Threads 자동 생성됨
- [ ] 소개글 인스타와 살짝 다르게
- [ ] 첫 게시는 카드 1장만 첨부 + 짧은 텍스트로 (스레드 톤)

### 2주 수동 운영
- [ ] `/insta` 받아서 양쪽 (인스타 + 스레드) 직접 업로드
- [ ] 매일 정상 활동 (남의 글 좋아요·댓글 10개) — 봇 의심 회피
- [ ] 2주 후 정지 없으면 Phase 2 진행

---

## Repository

**URL:** https://github.com/khe3716/content-studio

**이번 세션 작업 (커밋 전):**
- `agents/insta-writer.md` 수정
- `insta/generate-card-news.js` 수정
- `insta/generate-single.js` 신규
- `insta/generate-infographic.js` 신규
- `.github/workflows/auto-publish-insta.yml` 수정
- `telegram-worker/worker.js` 수정 (`/instastatus` + `/insta` 안내문)
- `~/.claude/plans/linked-crafting-seahorse.md` 업데이트

> 사용자가 명시 요청 시에만 `git add` + `git commit` + `git push` 진행. (이번 세션 자동 커밋 없음)
> Cloudflare Worker (`telegram-worker/`)는 별도 배포 필요 — `wrangler deploy` 실행해야 `/instastatus` 활성화.

---

## 파일 구조 (인스타·스레드 시스템)

```
agents/
└── insta-writer.md              # 박과일 (인스타·스레드 버전) — Threads 섹션 추가

insta/
├── topics.yaml                  # 30편 시드 (card_news 14 / single 10 / infographic 6)
├── drafts/                      # 생성 결과
│   ├── day-{N}-{ts}-card-{1..5}.jpg     # 카드뉴스
│   ├── day-{N}-{ts}-single.jpg          # 단일 포스트
│   ├── day-{N}-{ts}-info-{1..2}.jpg     # 인포그래픽
│   ├── day-{N}-{ts}-instagram.txt       # 인스타용 캡션 (해시태그 20~25개)
│   ├── day-{N}-{ts}-threads.txt         # 스레드용 캡션 (해시태그 1개)
│   └── day-{N}-{ts}-meta.json           # topic + content JSON
├── generate-card-news.js        # 카드뉴스 5장 (1080×1350) + 듀얼 캡션
├── generate-single.js           # 신규 — 단일 포스트 1장 (1080×1080) + 듀얼 캡션
└── generate-infographic.js      # 신규 — 인포그래픽 1~2장 (1080×1350) + 듀얼 캡션

.github/workflows/
└── auto-publish-insta.yml       # format 자동 분기 (card_news / single / infographic)

telegram-worker/worker.js        # /insta /instastatus + 양 채널 안내
```

---

## GitHub Secrets (이번 세션 변경 없음)

기존 그대로 사용:
- `GEMINI_API_KEY` — Gemini 2.5 Pro + Imagen 4 Fast
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `GITHUB_TOKEN` (Cloudflare Worker용 PAT)

**Phase 2에서 추가 예정 (다음 세션):**
- `META_ACCESS_TOKEN` — 인스타 + 스레드 공통 Long-lived token (60일)
- `IG_USER_ID` — Instagram Business Account ID
- `THREADS_USER_ID` — Threads Business Account ID

---

## 다른 Claude 세션 작업물 (이 세션에서 절대 안 건드림)

### finance-blog/ — 다른 창에서 동시 작업 중 ★
사용자가 명시적으로 격리 요청. Read 외 어떤 수정도 금지.
- `finance-blog/` 폴더 전체
- `agents/finance/*` (orchestrator, copywriter, visual-director 등 8인 팀)
- `agents/park-jaeeun.md` (재테크 페르소나)

### 다른 시스템 (별도 백업 존재)
- `coupang-automation/` — 쿠팡 자동화 (`STATE-2026-04-22-쿠팡-자동화-완전성공.md`)
- `fruit-blog/detail-pages/` — 스마트스토어 상세페이지 (`STATE-2026-04-21-상세페이지-자동화-완성.md`)
- `youtube-shorts/` — 썰 쇼츠
- `scripts/night-crew/` — 야간 리서치 팀 (`STATE-2026-04-25-야간리서치팀-구축.md`)
- `agents/finance/` 영상 시스템 (`STATE-2026-04-27-재테크블로그-영상시스템-AE모션.md`)

---

## 다음 세션 즉시 시작 항목

### 1순위 — 사장님 Phase 0 결과에 따라
- [ ] `/insta` 텔레그램 명령으로 Day 2 single 첫 실행 검증 (사장님 폰에서)
- [ ] 인스타·스레드 양쪽 업로드 후 2주 정지 없는지 모니터링
- [ ] 한 채널이라도 정지 발생 시 즉시 자동화 중단·원인 분석

### 2순위 — Phase 2 자동 게시 (2주 수동 운영 완료 후)
- [ ] Meta Developer App 생성 (사장님 + 안내, ≈40분)
- [ ] `insta/instagram-upload.js` 신규 — Instagram Graph API 캐러셀 게시
- [ ] `insta/threads-upload.js` 신규 — Threads Graph API 텍스트+이미지 게시
- [ ] 토큰 자동 갱신 로직 (50일째 갱신 + 만료 7일 전 텔레그램 알림)
- [ ] 워크플로우 9단계: 생성 → 인스타 게시 → **5분 대기** → 스레드 게시 (봇 패턴 회피)
- [ ] GitHub Actions 자동 스케줄 활성화 (현재 cron 주석 해제: 월·수·금 09~11시 랜덤)

### 3순위
- [ ] 30편 토픽 소진 후 `insta/topics.yaml` 다음 30편 추가
- [ ] 인스타·스레드 분석 대시보드 (좋아요·저장·답글 통계 텔레그램 주간 리포트)
- [ ] 릴스 자동화 (간단 모션 그래픽)

---

## 알려진 위험 / 주의사항

### 인스타 재정지 위험
- 과거 3번 정지 이력. Phase 0의 2주 수동 운영이 가장 중요한 안전장치.
- Phase 2 자동 전환 후에도 발행 시간 랜덤화, 주 3편 제한, 인스타→스레드 5분 간격.

### 스레드 캡션 품질 검증 필요
- Gemini가 인스타와 스레드 캡션을 진짜 다르게 쓰는지 첫 몇 편 사장님 직접 검수 권장.
- 같은 표현 복붙하면 알고리즘 페널티.
- 페르소나에 명시 강제했지만 모델 출력 확률적이라 100% 보장 못 함.

### 백워드 호환 (Day 1 카드뉴스)
- 4/22 생성된 Day 1은 `caption` 필드 (단일)였음. fallback 처리로 깨지지 않음.
- Day 1 재생성 원하면 `node insta/generate-card-news.js --day 1` 으로 덮어쓰기 가능.

### Cloudflare Worker 배포 필요
- `telegram-worker/worker.js` 변경분은 `wrangler deploy` 해야 적용됨.
- 안 하면 `/instastatus` 명령 미인식, `/insta` 안내문은 구버전 그대로.

---

## 환경 변수 (.env 로컬, 변경 없음)

기존 그대로:
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `GITHUB_REPOSITORY` (CI에서만 자동 주입)

---

**End of State (2026-04-27)**

Plan source: `~/.claude/plans/linked-crafting-seahorse.md`
