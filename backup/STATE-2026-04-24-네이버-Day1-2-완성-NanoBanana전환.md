# STATE 2026-04-24 — 네이버 Day 1·2 완성 + Nano Banana 전환

## 오늘 세션 핵심 성과

### 1. Imagen → Nano Banana 전환
- **이유**: Imagen 4 Fast 일일 70장 쿼터 한도 초과 (Tier 1)
- **해결**: `gemini-2.5-flash-image` (Nano Banana) 전환 — 일일 2,000장
- **파일**: `auto-publish-naver.js::generateImage()`

### 2. 이미지 안전 규칙 강화
`auto-publish-naver.js`의 `safePrompt`에 프롬프트 **맨 앞** 배치:
```
STRICT REQUIREMENTS:
- No people, no hands
- No text, no writing, no korean characters, no labels
- All berries hulled (no stems/calyx/leaves)
- ONLY raspberries (Rubus idaeus)
  - NOT strawberries (no heart-shape, no seeds)
  - NOT blackberries (not purple)
  - NOT blueberries (not blue)
- Physically accurate, no floating objects, no melting shapes
```

### 3. HTML 스타일 규칙 (네이버 호환)
네이버 스마트에디터가 유지하는 CSS만 사용:
- ✅ text-align, color, background-color, font-size, font-weight
- ❌ border, border-radius, padding, display:inline-block (제거됨)

**구현 완료**:
- `<h1>` 제거 → HTML 주석에 제목 텍스트 보관 → 네이버 "제목" 입력란 별도
- `<h2>` 박스형 헤더: 배경색 `#fdf6e3` + 17pt + 위 유니코드 구분선 `━━━━━━━━━━━━━━`
- `<blockquote>` 19pt 폰트
- `<ol><li>` → `<p><strong>1.</strong></p>` 변환 (중앙 정렬 시 번호·본문 간격 해결)
- 문장별 `<p>` 분리 (긴 단락 → 문장 하나씩 별도 `<p>` + 빈 단락)
- 전체 블록 가운데 정렬 (h1, h2, h3, p, blockquote, li)

### 4. 제목 포맷 간결화
- 이전: "[꿀팁] 산딸기, 맨 위만 보고 샀다가 눈물 훔친 경험 있으시죠? 😭 실패 확률 0%에 도전하는 3단계 선별법!"
- 지금: "산딸기 실패 없이 고르는 3단계 꿀팁 🍓" (20자 내외)
- 페르소나 규칙: 20~25자, 이모지 1개, 공감 질문·채움어 금지

### 5. 이전 Day 중복 회피 시스템
`auto-publish-naver.js::loadPreviousNaverDays()` 구현:
- Day N 생성 시 Day 1~(N-1)의 HTML 텍스트 추출해서 Gemini 프롬프트에 주입
- 명시적 지시: "이 글에 나온 도입부 패턴·자기소개·비유·실패담·과학근거 전부 반복 금지"
- 페르소나에 "Day별 고유 테마" 규칙:
  - Day 1: 마트·선별
  - Day 2: 주방·유리용기·냉장고
  - Day 3: 조리도구·냄비·병입
  - Day 4: 비교·유기농 vs 일반

### 6. 이미지 중복 회피
- Day 1과 Day 2 이미지 교차 검수
- 비슷한 구도(단일 산딸기 우드, 요거트 보울 등) 발견 시 재생성
- 교체 스크립트: `scripts/regen-naver-images.js`

## 완성된 파일

### Day 1 (산딸기 고르는 법)
- HTML: `naver-blog/drafts/day-01-how-to-pick-korean-raspberry.html`
- 제목: **산딸기 실패 없이 고르는 3단계 꿀팁 🍓**
- 이미지: 10장 (꼭지 없음, 산딸기 전용)
- **사장님 네이버 업로드 완료** ✅

### Day 2 (산딸기 보관법)
- HTML: `naver-blog/drafts/day-02-how-to-store-korean-raspberry.html`
- 제목: **산딸기 신선도 2배 가는 3단계 보관법 🍓**
- 이미지: 12장 (전부 산딸기, 네모 유리용기 통일)
- **Day 1과 중복 없음 검증**: 도입부·자기소개·섹션 1·2 완전 재구성
  - 도입부: "금요일 저녁 냉장고 열고 한숨 쉬는 경험"
  - 섹션 1: "산딸기 수프 사건" (미리 씻어 밀폐한 실패)
  - 섹션 2: 호흡·찜질방 비유 (Day 1의 피부 얇음 안 반복)
- **아직 네이버 업로드 안 함** (내일 사장님 작업)

## 내일 시작점 (Day 3)

### 주제: 산딸기 수제청 황금 레시피
- `fruit-blog/topics.yaml::day 3`
- 기존 fruit-blog 원본: `fruit-blog/drafts/day-03-korean-raspberry-recipe.html`

### 자동 적용될 규칙 (코드 반영 완료)
- Day 1·2 HTML이 Gemini 프롬프트에 주입되어 중복 회피
- 시각 테마: **조리도구·냄비·병입·설탕** (Day 1 마트, Day 2 주방용기 → Day 3 조리)
- 모든 스타일 규칙 (h2 박스·blockquote 19pt·문장별 줄바꿈·h1 제거 등) 자동

### 실행
```bash
node auto-publish-naver.js --day 3
```

## 이후 계획

- Day 4 (블루베리 유기농 vs 일반)
- Day 5 (블루베리 보관법)
- Day 6+ (기타 과일)

## 진행 중이던 Phase 2 항목

- Meta API 인스타 자동화 (사장님 계정 개설 + 2주 수동 운영 후 진행 예정)
- 경제블로그 Day 22~30, 과일블로그 Day 14~30 배치 예약 (나중에)

## 기술 메모

### Nano Banana API
```js
const model = 'gemini-2.5-flash-image';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
body: {
  contents: [{ parts: [{ text: safePrompt }] }],
  generationConfig: { responseModalities: ['IMAGE'] }
}
// 응답: candidates[0].content.parts[].inlineData.data (base64)
```

### 쿼터 확인
- https://aistudio.google.com/spend — 월 지출
- aistudio.google.com/rate-limit — RPM·RPD 실시간 사용량
- KST 오전 9시에 일일 쿼터 리셋

## 새 스크립트

- `scripts/regen-naver-images.js` — 특정 이미지 번호만 재생성
- `scripts/split-sentences.js` — 긴 `<p>` 문장 단위 분리
- `scripts/add-section-boxes.js` — h2 박스형 헤더 적용
- `scripts/cachebust-day1.js` — 이미지 캐시 버스트
