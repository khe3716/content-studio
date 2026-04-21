# Project State Backup — 2026-04-21 (후반)

Few-shot style learning system added for fruit blog + 박과일 persona tone cleanup.
Previous backup: `STATE-2026-04-21-과일블로그-AI이미지-클러스터로드맵.md`.

---

## What Changed Since Previous Backup

### 1. Few-shot Style Learning (NEW)
박과일이 사장님 기존 글 톤을 90%+ 모방하도록 업그레이드.

**흐름:**
1. `scripts/fetch-fruit-samples.js` — Blogger API로 기존 발행글 5편 다운로드 → `fruit-blog/samples/*.html`
2. `auto-publish-fruit.js`의 `loadWritingSamples()` — 매 글 생성 시 3편 랜덤 선택 + 각 2,500자로 잘라 system prompt에 주입
3. 주입 위치: `writeArticle()`의 system prompt에 `samplesHint` 블록으로 삽입 (박과일 페르소나 다음)

**현재 샘플 (5편):**
| # | 파일 | 제목 |
|---|---|---|
| 01 | 산딸기-고르는-법 | 산딸기 고르는 법, 이 3가지만 체크하세요 |
| 02 | 경고-수박에-랩을 | 🍉 [경고] 수박에 '랩'을 씌우는 건 세균을 배양하는 행위입니다 |
| 03 | 실패-없는-수박-선별법 | 실패 없는 수박 선별법 |
| 04 | 아보카도-후숙-보관 | 아보카도 실패 없는 후숙 & 보관 꿀팁 |
| 05 | 바나나-끝부분 | 🍌 "바나나 끝부분, 떼고 드세요?" 90%가 오해하는 진실과 보관 꿀팁 |

**샘플 리프레시 방법:**
```bash
node scripts/fetch-fruit-samples.js
```
(새 글 추가됐을 때 사장님이 수동 실행. 자동화는 아직 안 함)

### 2. 박과일 페르소나 정화 (agents/park-gwail.md)
테스트 중 AI가 "자살 행위나 마찬가지" 같은 과격한 비유를 쓰는 문제 발견. 원인은 페르소나 파일 자체에 그런 예시가 박혀있었음.

**삭제된 표현:**
- "~는 자살 행위나 마찬가지예요"
- "경고형" 제목 스타일 (→ "정보 강조형"으로)
- "7일만에 세균 3,000배 증식" 센세이셔널 예시
- "충격 유도" 문장 패턴 행

**추가된 절대 금지:**
- 과격·자극적 비유 ("자살 행위", "목숨 걸고")
- 공포 조장 ("이거 먹으면 큰일 납니다", "독이 됩니다")

### 3. CLAUDE.md 백업 규칙
새 Claude 세션이 항상 최신 백업 파일부터 읽도록 규칙 추가. 백업 파일명은 `STATE-YYYY-MM-DD-주제.md` 형식.

### 4. Day 2 Test Upload
산딸기 보관법 테스트 업로드 성공.
- Blogger Post ID: `211154732680395447`
- URL: `https://www.blogger.com/blog/post/edit/2104007364572229986/211154732680395447`
- Status: DRAFT (사장님이 언제든 발행 버튼 눌러 공개 가능)

---

## 현재 자동 발행 상태

| Blog | 다음 자동 실행 | 다음 주제 |
|---|---|---|
| 경제 | 매일 07:30, 17:00 KST | topics.yaml의 다음 ready 항목 |
| 과일 | 매일 18:00 KST | Day 3 — 산딸기 수제청·잼 황금비율 (상태: pending → 내일 실행 전 ready로 변경 필요할 수도) |

### ⚠️ 내일 확인 사항
`fruit-blog/topics.yaml`에서 Day 3가 `status: pending`. `auto-publish-fruit.js`의 주제 선택 로직이 pending도 받는지 확인. 안 받으면 수동으로 `ready`로 바꿔줘야 함.

---

## Few-shot 작동 확인 (Day 2 dry-run 비교)

| 지표 | Before Few-shot | After Few-shot + 페르소나 정화 |
|---|---|---|
| 팩트체크 이슈 | 5개 (high 1 + medium 2 + low 2) | 2~3개 (전부 low/medium) |
| "자살 행위" 등장 | ✅ 들어감 | ❌ 없음 |
| 자동 수정 트리거 | O (high 이슈) | X (원본 유지) |
| 초안 자 수 | ~3,900 | ~3,800 |

---

## Repository

**URL**: https://github.com/khe3716/content-studio
**Visibility**: Public
**Last commit**: `dd6733a feat: add few-shot learning for fruit blog writer + tone cleanup`

---

## Files Changed (This Session)

```
M  agents/park-gwail.md                              # 과격 표현 제거
M  auto-publish-fruit.js                             # loadWritingSamples() + samplesHint
M  fruit-blog/topics.yaml                            # Day 2 status: ready → draft (업로드 후 자동)
A  fruit-blog/drafts/day-02-how-to-store-korean-raspberry.html
A  fruit-blog/images/day-02-*-body-1.jpg (46KB)
A  fruit-blog/images/day-02-*-body-2.jpg (46KB)
A  fruit-blog/samples/                               # 5편 HTML + index.json
A  fruit-blog/thumbnails/day-02-*.png                # 디자인 썸네일
A  fruit-blog/thumbnails/day-02-*.svg
A  scripts/fetch-fruit-samples.js                    # 샘플 리프레시 스크립트
A  backup/STATE-2026-04-21-Few-shot-스타일학습-페르소나정화.md  # 이 파일
```

유튜브 쇼츠 관련 변경 (`package.json`, `package-lock.json`, `youtube-shorts/`)은 **다른 Claude 세션**의 작업물이라 이 세션에서는 커밋하지 않음.

---

## Recovery Commands

```bash
# 현재 과일 블로그 전체 flow 테스트 (업로드 없이)
node auto-publish-fruit.js --day 3 --dry-run

# 샘플 다시 가져오기 (사장님이 블로그 글 추가했을 때)
node scripts/fetch-fruit-samples.js

# 텔레그램에서 수동 발행
/fruit         # 다음 주제 자동 발행
/fruitstatus   # 최근 실행 상태 확인
```

---

## Known Limitations

1. **Day 3 status `pending`** — 자동 발행 대상인지 코드 재확인 필요
2. **Few-shot 샘플 수동 리프레시** — 새 글 발행 후 자동으로 `samples/` 업데이트되지 않음. 필요 시 수동 실행
3. **바나나 샘플이 56KB로 큼** — 현재 2,500자로 잘라서 쓰지만 토큰 비용 약간 증가
4. **Day 2 테스트 업로드는 로컬 실행**이라 이미지가 base64 임베딩됨. GitHub Actions로 자동 실행될 때만 raw URL 사용. 파일 크기 차이 있음

---

## Next Tasks (Pending)

- [ ] 유튜브 쇼츠 자동화 (다른 Claude 세션에서 작업 중)
- [ ] 네이버 블로그 반자동 추가 (예정)
- [ ] 애드센스 승인 후 상품 링크 전략 재검토
- [ ] `fetch-fruit-samples.js` GitHub Actions에 월 1회 실행 스케줄 추가 검토

---

**End of State (2026-04-21, 세션 2회차)**
