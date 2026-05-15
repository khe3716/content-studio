# Project State Backup — 2026-04-27 (저녁)

박과일 인스타·스레드 인포그래픽 캐러셀 시스템 **본격 운영 직전 상태**.

같은 날 아침 백업 (`STATE-2026-04-27-인스타-스레드-듀얼자동화-Phase1-완성.md`)에 이어, 인포그래픽 디자인·콘텐츠 품질을 사장님 검증 통과 수준까지 끌어올림.

Previous backup: `STATE-2026-04-27-인스타-스레드-듀얼자동화-Phase1-완성.md` (같은 날 아침)

---

## 이번 세션에서 완성된 것

### 1. 인포그래픽 시스템 — 캐러셀 멀티 슬라이드로 전면 재설계
**파일 수정:** `insta/generate-infographic.js`

#### 구조 변경 (1장 통째 → 7장 캐러셀)
- 기존: 1장에 모든 정보 욱여넣음 (가독성·체류시간 약함)
- 신규: **표지 1 + 항목 5 + 마무리 1 = 총 7장 캐러셀**
- 이유: 한국 인스타 잘 터지는 게시물(seoulhotple, seoul.eats_, histo_fit) 모두 멀티 슬라이드 캐러셀

#### SVG 빌더 3개로 분리
- `buildCoverSvg({ title, subtitle, photoBase64?, theme })` — 표지
- `buildItemSvg({ rank, name, taste, tag, photoBase64 })` — 항목 (사진 상단 760px + 하단 정보)
- `buildClosingSvg({ cta, brand })` — 마무리 (빨강 BG + CTA)

#### Cover 테마 시스템 (3가지)
- `photo`: 사진 배경 + 어두운 오버레이 (초기)
- `dark`: 검정 BG + 흰 + 노랑 강조 (토스 톤)
- `light`: **베이지 BG + 검정 + 빨강 강조 (마켓컬리 톤)** ⭐ **사장님 확정**
- 메인 로직과 `regen-item.js` 모두 `theme: 'light'` 박힘

### 2. 항목 슬라이드 데이터 룰 — taste + tag만 (시즌·당도·시세·산지 다 제거)

진화 과정:
1. 처음: rank + name + note만 (정보 빈약)
2. 4축 데이터: season + brix + origin + price (사장님 "정보가 너무 빈약" 지적 후 강화)
3. 사장님 검증: **taste + tag만** (시즌·당도 단정 위험, 시세·원산지는 변동·신뢰도 문제)

최종 항목 슬라이드 정보:
- 🌟 **맛·식감 (taste)** — "톡톡 터지는 새콤단맛" 같이 16자 이내
- 💬 **셀러 코멘트 (tag)** — "딱 4주만 맛보는 귀한 몸" 같이 22자 이내
- 사진 상단 760px (Pixabay 실사 또는 AI)
- rank 빨간 원 + 이름 큰 글씨 (사진 위에 흰색)

### 3. 사진 소스 시스템 — Pixabay 우선 + AI fallback ⭐ 핵심

#### 시도·실패 기록
- Imagen 4 Fast → 한국 참외가 메론·호박처럼 나옴
- Imagen 4 정식 → 정확도 ↑ 하지만 여전히 가끔 어긋남
- Pexels API → **메타데이터 매칭 문제**: "chamoe" 검색 시 베트남 거리 사진, "raspberry" 시 산딸기 덩굴, "tomato green stripes" 시 헤어룸 토마토 등 엉뚱한 결과 → **사용 중단**
- **Pixabay API → 한국어 검색 강력 (`q=참외&lang=ko`)** → 진짜 한국 참외 실사 ⭐

#### 최종 흐름
1. **한국 특산 과일** (참외·산딸기·매실·무화과·대저토마토 등 21개 매핑)
   - Pixabay 한국어 검색 우선 (예: `q=참외`, `q=산딸기`)
   - 결과 없으면 AI Imagen 4 정식 fallback
2. **표지·마무리** — AI 또는 단색 (theme=light면 사진 X)

#### 코드 위치
- `KOREAN_FRUIT_DATA` 매핑 객체 — 21개 과일 (`pixabay: [한국어, 영문 fallback]`, `ai: 영문 프롬프트`)
- `searchPixabay(query, count)` — Pixabay API 호출
- `downloadPhotoAsBase64(url)` — 사진 다운로드 + sharp 1080×1350 cover resize + base64
- `getFruitPhoto(name, fallback)` — Pixabay → AI 자동 폴백 메인 함수
- `generateImageBase64(prompt)` — Imagen 4 정식 (fast 아닌 것)

### 4. 한국 특산 과일 영문 매핑 — Imagen 헷갈림 차단
**문제**: AI에 "Korean melon"이라 박으면 메론으로 인식 → 참외 안 나옴
**해결**: hardcoded 매핑 (Gemini가 만든 image_prompt 무시)

```js
KOREAN_FRUIT_PROMPTS = {
  '참외': '... Korean Chamoe ... NOT round, NOT melon, NOT cantaloupe ...',
  '산딸기': 'Korean wild raspberry ...',
  '대저토마토': 'Daejeo tomato (Korean salty firm tomato) ...',
  // ... 21개
}
```

### 5. 신규 헬퍼 — `insta/regen-item.js`

7장 다 다시 안 만들고 **특정 슬라이드 1장만 재생성**:

```bash
# 항목 1개만 재생성 (사진 + SVG)
node insta/regen-item.js day-04-1777280777835 참외

# 표지 재생성 (light 테마 자동)
node insta/regen-item.js day-04-1777280777835 cover
```

→ 다른 슬라이드 보존, 1장만 갱신. 비용·시간 절감.

### 6. .env 추가
```
PEXELS_API_KEY=46eEqVhT05h1pdUXPPtl2dubRuA4n7aklFl8Sxr8W3RPyuxTdCxDqs6F  # 부적합 판명, 코드에서 미사용
PIXABAY_API_KEY=55613792-4a13537922f3c12c319ac2fe9  # ⭐ 핵심
```

PEXELS_API_KEY는 사장님 다른 프로젝트 `.env`에서 가져옴 (`C:\Users\khe37\OneDrive\바탕 화면\my_youtube_bot\my_bot_2\.env`). 박과일에서는 사용 X.

### 7. 페르소나 (`agents/insta-writer.md`) — 미수정
**다음 세션에 강화 예정** (이 세션은 디자인·기술 시스템에 집중).

### 8. topics.yaml — 미정리
**다음 세션에 Phase 1 운영용으로 정리 예정.**

---

## Day 4 검증 샘플 — 사장님 확정

위치: `insta/drafts/day-04-1777280777835-info-1~7.jpg`

| # | 내용 | 사진 출처 |
|---|---|---|
| 1/7 | 표지 (라이트) "5월에 안 사면 1년 후회하는 과일" | 베이지 BG + 검정 + 빨강 |
| 2/7 | ① 산딸기 — "톡톡 터지는 새콤달콤함" | AI Imagen |
| 3/7 | ② 참외 — "아삭하고 시원한 꿀 단맛" | **Pixabay 실사 (eommina)** ⭐ |
| 4/7 | ③ 매실 | AI Imagen |
| 5/7 | ④ 토마토 | AI Imagen |
| 6/7 | ⑤ 오디 | AI Imagen |
| 7/7 | 마무리 (빨강 BG) | 단색 |

→ 사장님 평가: "너무좋아"

---

## 박과일 인스타 계정 회수 (이 세션 부산물)

사장님이 `parkfruit.today` 인스타 비밀번호 잊어버림 → 이 세션에서 같이 회수:
1. instagram.com → "비밀번호 찾기" → `parkfruit.today` 입력
2. SMS 코드 받기 (사장님 본인 휴대폰 번호로 가입돼있었음)
3. 폰 인스타 앱에서 코드 직접 입력 (링크 클릭하면 "알 수 없는 오류")
4. 새 비밀번호 설정 완료
5. 표시 이름 "강하은" → **"박과일 · 제철 과일정보"** 결정 (사장님 본인 이름 강하은이지만 페르소나 박과일로 변경)
6. 메일 추가 시도 — `khe3714@gmail.com`은 사장님 개인 인스타 계정에 이미 등록됨 → parkfruit.today에 다른 메일 추가는 보류

⚠️ **사장님 본명: 강하은** (메모리 저장 안 함, 호칭은 "사장님" 유지)

---

## 사장님 결정 사항 (이번 세션 누적)

### 인스타·스레드 운영 정책
- 콘텐츠 100% AI (사장님 인터뷰·직접 글쓰기 X)
- 인스타 ↔ 스레드: 같은 시각자료 + 다른 톤 텍스트
- 인스타 ↔ 네이버 블로그: 같은 콘텐츠 OK (자동 변환 유지)
- 인스타 ↔ 그 외: 완전 분리

### 운영 페이스
- **Phase 1 (Week 1~2)**: 카드뉴스만, 주 3편 (월·수·금)
- **Phase 2 (Week 3~4)**: 다양한 포맷·톤 신뢰 쌓기
- **Phase 3 (Month 2~)**: 스마트스토어 연계 (프로필 링크)

### 안전장치
- 매 게시물에 **고정 댓글** 활용 (Phase 1~2: 참여·시리즈 유도 / Phase 3: "프로필 링크 ☝️")
- ❌ 영어 텍스트 (FRUIT GUIDE 배지 → "박과일")
- ❌ 시세·산지 단정 (변동 위험)
- ❌ 시즌·당도 단정 (확인 안 된 사실)

### 시스템 디자인
- 표지 = **light 테마 (베이지 + 검정 + 빨강)** 확정
- 항목 = 사진 + 맛·식감 + 셀러 코멘트만
- 마무리 = 빨강 단색
- 항목 5개 (4~6개 가능)

---

## 메모리 저장 (이번 세션)
- `feedback_no_time_assumption.md` — 시간 추측·강조 금지
- `project_insta_2phase_strategy.md` — 박과일 인스타 2단계 운영
- `project_finance_blog_isolated.md` — finance-blog 격리 (다른 창 작업 중)

---

## 다음 세션 즉시 시작 항목

### 1순위 — Phase 1 운영 준비 (시스템 정비, 30분)
- [ ] `insta/topics.yaml` Phase 1 정리 (Week 1~2용 카드뉴스 + 인포그래픽 ready, 단일 포스트 모두 pending)
- [ ] `agents/insta-writer.md` 강화:
  - 5 hit pattern (손해회피·랭킹·셀러비밀·일상·시즌FOMO)
  - 고정 댓글 가이드 (Phase 1~3 단계별)
  - 한국 특산 과일 영문 매핑 가이드
  - "확인 안 된 사실 단정 금지" 룰 명시
- [ ] `insta/PHASE-PLAN.md` 신규 — 12주 로드맵 문서

### 2순위 — 사장님 Phase 0 액션 점검 (Phase 1 시작 전)
- [ ] parkfruit.today 인스타 프로필 마무리 (이름 "박과일 · 제철 과일정보" 적용 확인)
- [ ] 프로필 사진 (`profile-pics/logo-3d-sticker.jpg` 또는 다른 거)
- [ ] Threads 가입 (인스타 로그인하면 자동 생성됨)
- [ ] 매일 5분 warm-up (다른 과일·요리 계정 좋아요·팔로우)

### 3순위 — 첫 게시 (Week 3 진입 시)
- [ ] 텔레그램 `/insta 1` → Day 1 산딸기 카드뉴스 받기 (이미 4/22에 만들어둔 거)
- [ ] 또는 `/insta 4` → Day 4 5월 제철 인포그래픽 받기
- [ ] 폰 인스타 앱에 캐러셀 7장 + 캡션 업로드
- [ ] 같은 시각자료 → Threads 앱에 다른 텍스트로 업로드

### 4순위 — Phase 2 자동 게시 (Week 5~)
- [ ] Meta Developer App 생성
- [ ] `META_ACCESS_TOKEN`, `IG_USER_ID`, `THREADS_USER_ID` 발급
- [ ] `insta/instagram-upload.js` 신규 — Graph API 캐러셀 업로드
- [ ] `insta/threads-upload.js` 신규 — Threads Graph API
- [ ] GitHub Actions cron 활성화 (월·수·금 09~11시 랜덤)

---

## Repository

**URL:** https://github.com/khe3716/content-studio
**커밋되지 않은 변경분 (이 세션):**
- `insta/generate-infographic.js` (대규모 변경 — 캐러셀, Pixabay, 라이트 테마)
- `insta/regen-item.js` (신규)
- `.env` (PEXELS_API_KEY, PIXABAY_API_KEY 추가)
- `insta/drafts/day-04-1777280777835-*` (Day 4 샘플 7장)

**커밋 권장**: `feat(insta): infographic carousel + Pixabay integration + light cover theme`

---

## 알려진 이슈 / 주의

### Pixabay 신뢰도
- 한국어 검색 (`q=참외&lang=ko`) 1순위 결과를 자동 사용
- 가끔 부정확한 결과 가능성 있음 → `regen-item.js`로 1장 재생성 가능
- 추후 결과 평가 로직 필요할 수도 (e.g., Gemini Vision으로 사진 검증)

### Imagen 4 정식 비용
- Imagen 4 Fast → 정식 변경으로 호출당 비용·시간 ↑
- 현재는 무료 한도 내 (Gemini API 무료 quota)
- Phase 2 자동화 시 월 60회 호출 예상 → 무료 한도 충분

### 한국 특산 매핑 21개로 한정
- 토픽 yaml에 매핑 외 과일 들어가면 AI Imagen 사용 (정확도 떨어질 수 있음)
- 새 과일 추가 시 `KOREAN_FRUIT_DATA`에 매핑 추가 필요
- 메서드: 다음 세션에 사장님이 "○○ 과일 매핑 추가해줘" 요청

### 캡션 미점검
- 인스타 캡션·스레드 캡션은 자동 생성 (Gemini)
- Day 4 샘플 캡션 사장님 미검토 — Phase 1 첫 게시 전 한 번 확인 필요

---

## 환경 변수 (.env 현재)

```
GEMINI_API_KEY=...                     # Gemini 2.5 Pro + Imagen 4 정식
GOOGLE_CLIENT_ID=...                   # Blogger API
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
PEXELS_API_KEY=46eEqVhT...             # 미사용 (한국 특산 부적합 판명)
PIXABAY_API_KEY=55613792-4a13...       # ⭐ 핵심 (한국어 과일 검색)
```

**Phase 2에서 추가 예정**:
- `META_ACCESS_TOKEN`
- `IG_USER_ID`
- `THREADS_USER_ID`

---

**End of State (2026-04-27 저녁)**
