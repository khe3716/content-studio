# Project State Backup — 2026-04-21 (3회차)

달콤살랑 스마트스토어 유입 증대 플랜 **Phase 0** 구현 완료.
Previous backup: `STATE-2026-04-21-Few-shot-스타일학습-페르소나정화.md` (세션 2회차).

---

## What Changed Since Previous Backup

### 1. Plan Mode — 달콤살랑 유입 증대 전략 수립
플랜 파일: `C:\Users\khe37\.claude\plans\linked-crafting-seahorse.md`

사장님 고민 3가지(신규 유입 부족 + 구매 전환 낮음 + 재구매 없음) 기반으로 4-Phase 로드맵 확정:

- **Phase 0 (이번 주)** — 네이버 블로그 개설 + 스마트스토어 SEO + 네이버 리라이터 ✅ 완료
- **Phase 1 (1~4주차)** — 네이버 지수 축적 + 리뷰 이벤트
- **Phase 2 (1~3개월)** — 인스타그램 + 시즌 톡톡 알림
- **Phase 3 (3~6개월)** — 애드센스 승인 후 CTA + 후기 카테고리
- **Phase 4 (6개월+)** — 소액 광고 실험

### 2. 스마트스토어 SEO 진단 시스템
**파일**: `scripts/audit-smartstore-seo.js`

- products.json 읽고 상품별 100점 만점 채점
- 채점 영역: 상품명 40점 / 태그 30점 / 카테고리 10점 / 운영 20점
- 체크 항목: 산지·중량·용도·특성 키워드, 태그 10개 꽉 채움 여부, 유사 태그, 할인가 실효성
- 21개 상품 전체를 점수 낮은 순 정렬해서 텔레그램 발송 (4096자 넘으면 자동 split)

**사용법**:
- 로컬: `node scripts/audit-smartstore-seo.js --telegram`
- 텔레그램 `/seo` 명령
- 자동: 매주 월요일 오전 9시 KST (audit-seo.yml cron)

### 3. 네이버 블로그 반자동 시스템 (Phase 0 핵심)
네이버는 공식 API 없음 → Blogger 글을 네이버 스마트에디터 호환 HTML로 자동 생성, 사장님이 복붙.

**파일 추가**:
- `auto-publish-naver.js` — 메인 변환 스크립트
- `agents/park-gwail-naver.md` — 네이버 전용 페르소나 (이웃 대상, 수다체, 3,000자+)
- `docs/NAVER-BLOG-SETUP.md` — 블로그 개설 6단계 가이드
- `naver-blog/README.md` — 운영 원칙 (지수 보호 규칙)
- `naver-blog/drafts/` — 생성된 네이버용 HTML
- `naver-blog/images/` — Imagen으로 생성한 섹션별 이미지

**초기 버전**: HTML 클리너 (class 제거, 썸네일 div 제거, 이미지 URL 치환)
**최종 버전**: Gemini 리라이팅 + 섹션별 이미지 5~6장 자동 생성

### 4. 네이버 리라이터 Gemini 업그레이드 (오늘 마지막)

**흐름**:
1. Blogger 원본 HTML 읽기
2. Gemini가 네이버 톤으로 리라이팅 (3,000~3,500자, 수다체, 이모지, 섹션 5~6개)
3. 응답 형식: `<naver-html>...</naver-html><image-prompts>...</image-prompts>`
4. 스크립트가 파싱 → 섹션별 영문 이미지 프롬프트 5~6개 추출
5. Imagen 4 Fast로 각 이미지 생성 (800×800 JPG, personGeneration: dont_allow)
6. `<!-- [[IMG_N]] -->` 플레이스홀더를 `<img>` 태그로 치환
7. 네이버 스마트에디터 호환 클리닝
8. 저장 + 텔레그램 알림 (raw URL + 복사 안내)

**Day 2 테스트 결과**:
- 원본: 2,000자 정보체
- 변환: 3,500자 "이웃님들~!" 수다체, 이모지 자연스럽게 섞임
- 이미지 5장: 물러진 산딸기 / 신선한 클로즈업 / 씻지 말기 / 키친타월 배치 / 유리 용기 숨구멍
- 각 섹션 내용과 이미지 정확히 매칭

### 5. 텔레그램 봇 명령 추가

| 명령 | 동작 |
|---|---|
| `/naver` | 최근 draft 주제 네이버용으로 변환 |
| `/naver 3` | 특정 Day 지정 |
| `/seo` | 21개 상품 SEO 진단 리포트 |

워커 파일: `telegram-worker/worker.js` 수정 → Cloudflare에서 재배포 완료 (사장님이 직접 붙여넣기).

### 6. GitHub Actions 워크플로우 추가

| 파일 | 용도 | 트리거 |
|---|---|---|
| `audit-seo.yml` | SEO 진단 | `/seo` + 매주 월 9시 cron |
| `naver-convert.yml` | 네이버 변환 | `/naver` |
| `auto-publish-fruit.yml` (수정) | 과일 발행 | 5-1/5-2 스텝에 네이버 변환 체인 추가 |

모든 워크플로우에 `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` secrets 연결.

### 7. Day 2 예약발행 + Day 3 ready 승격
- Day 2 산딸기 보관법 → 오늘 오후 6시(2026-04-21 18:00 KST) 예약발행 설정됨
- Blogger Post ID: `211154732680395447`, status: SCHEDULED
- Day 3 (산딸기 수제청·잼) → pending → **ready** 수동 승격 (Day 2 수동 업로드로 자동 승격 건너뜀)
- 내일 18시 자동 실행 시 Day 3부터 정상 진행

### 8. .env 로컬 업데이트
텔레그램 시크릿 2개 추가 (GitHub에는 이미 있었고, 로컬에만 없어서 로컬 실행 시 텔레그램 발송 안 되던 문제 해결):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

`.env`는 `.gitignore` 등록돼 있어 커밋 안 됨.

---

## 현재 자동 발행 상태

| Blog | 스케줄 | 다음 주제 |
|---|---|---|
| 경제 | 매일 07:30 + 17:00 KST | topics.yaml ready 다음 |
| 과일 (Blogger) | 매일 18:00 KST | Day 3 — 산딸기 수제청·잼 황금비율 (ready) |
| 과일 (네이버 변환) | Blogger 발행 후 자동 실행 | Gemini 리라이팅 + 5장 이미지 |

**사장님 할 일 (아직 안 함)**:
- [ ] 네이버 블로그 개설 (docs/NAVER-BLOG-SETUP.md 6단계)
- [ ] 첫 글 복붙 테스트
- [ ] SEO 진단 Top 5 상품 수정 (샤인머스켓·대저토마토·명이나물·청포도·단마토)

---

## 다른 Claude 세션 작업물 (이 세션에서는 건드리지 않음)

- `youtube-shorts/` — 한국 썰 쇼츠 자동화 (과일 스토어 유입과 무관)
- `fruit-blog/detail-pages/` — 스마트스토어 상세페이지 템플릿 (2026-04-21 상세페이지 자동화 백업 참고)
- `package.json`, `package-lock.json` — 새 패키지 추가 (@google/genai, dotenv, exceljs)

이 폴더들은 다른 세션이 커밋하라고 남겨둠.

---

## Repository

**URL**: https://github.com/khe3716/content-studio
**Visibility**: Public
**Last commits** (이번 세션 추가):
- `dd6733a` feat: add few-shot learning for fruit blog writer + tone cleanup
- `0eca00b` fix: Day 3 status pending → ready
- `6facf65` feat(phase0): 달콤살랑 유입 증대 — SEO 진단 + 네이버 블로그 반자동
- `0f38782` feat(seo): show all products in telegram report + auto-split
- `38be9b1` feat: /seo telegram command + weekly SEO audit workflow
- `c77fb0a` feat(naver): Gemini 리라이팅 + 섹션별 이미지 5장 자동 생성

---

## Files Added This Session

```
agents/
  park-gwail-naver.md                    # 신규 — 네이버 페르소나
auto-publish-naver.js                     # 신규 → 전면 업그레이드 (Gemini + Imagen)
scripts/
  audit-smartstore-seo.js                 # 신규 — 21개 상품 SEO 진단
  fetch-fruit-samples.js                  # 신규 (세션 2회차)
docs/
  NAVER-BLOG-SETUP.md                    # 신규 — 개설 가이드
naver-blog/
  README.md                               # 신규 — 운영 원칙
  drafts/day-02-*.html                   # Day 2 테스트 변환본
  images/day-02-naver-*-[1-5].jpg        # 섹션별 이미지 5장
.github/workflows/
  audit-seo.yml                          # 신규 — /seo 워크플로우
  naver-convert.yml                      # 신규 — /naver 워크플로우
  auto-publish-fruit.yml                 # 5-1/5-2 스텝 추가
telegram-worker/worker.js                # /naver, /seo 명령 추가
fruit-blog/topics.yaml                   # Day 3 ready 승격
fruit-blog/samples/*                      # 세션 2회차 (Few-shot 샘플 5편)
backup/
  STATE-2026-04-21-Few-shot-스타일학습-페르소나정화.md  # 세션 2회차
  STATE-2026-04-21-네이버블로그-Gemini리라이터-SEO진단.md  # 이 파일
```

---

## Recovery Commands

```bash
# 과일 블로그 발행 + 네이버 변환 자동 실행
# 텔레그램: /fruit

# 네이버만 특정 Day로 재변환
# 텔레그램: /naver 3
# 또는 로컬: node auto-publish-naver.js --day 3

# SEO 진단
# 텔레그램: /seo
# 또는 로컬: node scripts/audit-smartstore-seo.js --telegram

# 샘플 리프레시 (사장님이 블로그 글 추가한 뒤)
node scripts/fetch-fruit-samples.js

# 디버그: Gemini 없이 네이버 클리닝만
node auto-publish-naver.js --day 2 --skip-rewrite
```

---

## Known Limitations / TODO

1. **네이버 블로그 지수는 3개월 이상** 걸림 — 당분간 매출 직결 X, 꾸준히 쌓아야 함
2. **사장님이 HTML 복붙** 필요 (네이버 API 없음, Playwright 자동화는 약관 위반 위험)
3. **애드센스 심사 중** — 네이버 블로그 3개월, Blogger에 스토어 CTA 금지
4. **SEO 진단 키워드 힌트 부족** — "국내산", "부산" 같은 산지명이 `origin` 힌트에 없어서 오탐 가능. Phase 1에서 확장
5. **Imagen 4 Fast 요금** — 무료 한도 내지만 주 10장+ 생성이라 월간 모니터링 필요

---

## Next Tasks (Pending — 다음 세션용)

### Phase 1 후보 (1~4주차)
- [ ] 스마트스토어 리뷰 이벤트 문구 템플릿 (쿠폰 연계)
- [ ] 톡톡 친구 추가 유도 메시지 (주문서 동봉용)
- [ ] SEO 진단 키워드 힌트 확장 (산지명 추가)

### Phase 2 후보 (1~3개월)
- [ ] 인스타그램 이미지 템플릿 자동 생성기
- [ ] 시즌별 톡톡 메시지 생성 (`/season` 명령)
- [ ] 재구매 고객 관리 DB

### 운영 개선
- [ ] Gemini 리라이팅 반복 호출 시 중복 체크 (이미 변환된 Day 재변환 막기)
- [ ] 네이버 변환본 링크를 텔레그램에 직접 파일 첨부로 전송 (현재는 raw URL)

---

**End of State (2026-04-21, 세션 3회차)**
