# 재테크 팀 자동화 (월급쟁이 재테크)

박재은 페르소나로 글 + 이미지 + TTS + 영상 + Blogspot 발행을 한 번에.

## 사용법 (일반 운영)

### 텔레그램에서 (가장 편함)

```
/finance 4              → Day 4 자동 생성, DRAFT만 (Blogspot에 임시저장)
/finance 4 publish      → Day 4 자동 생성 + 즉시 발행
/finance                → 다음 day 자동 결정
/financestatus          → 최근 실행 3건 확인
```

### CLI에서 (개발자 모드)

```bash
# 풀 자동
node scripts/finance-team/run.js --day 4

# DRAFT 저장만 (발행 안 함, 미리보기용)
node scripts/finance-team/run.js --day 4 --skip-publish

# 즉시 발행
node scripts/finance-team/run.js --day 4 --publish now

# 예약 발행 (5월 4일 오전 8시 KST)
node scripts/finance-team/run.js --day 4 --publish 2026-05-04T08:00:00+09:00

# 영상 빼고 글만
node scripts/finance-team/run.js --day 4 --skip-video
```

## 단계별 흐름

```
1. researcher    → finance-blog/research/{slug}.json
                   (Datalab 트렌드 + 토픽 메타 + 플레이북)

2. copywriter    → finance-blog/drafts/{slug}.html
                   finance-blog/drafts/{slug}-narration.json
                   finance-blog/drafts/{slug}-meta.json
                   (박재은 페르소나로 본문 + 영상 대본 동시 생성)

3. images        → finance-blog/images/{slug}-*.jpg
                   (Nano Banana 이미지)

4. tts           → finance-blog/remotion/public/audio/{slug}-*.wav
                   (Gemini Leda 1.3x)

5. video         → finance-blog/videos/{slug}-{long,short}.mp4
                   (Remotion 렌더)

6. publish       → Blogspot DRAFT 또는 즉시 발행
                   텔레그램 알림
```

## 단독 실행 (디버깅용)

각 단계만 따로 돌려보고 싶을 때:

```bash
# 1단계만
node scripts/finance-team/research.js --day 4

# 2단계만 (research 결과가 있어야 함)
node scripts/finance-team/write-draft.js --slug salary-30-savings-1y-simulation

# 2단계 미리보기 (저장 안 함)
node scripts/finance-team/write-draft.js --slug ... --dry-run

# 3-5단계 (이미지+TTS+영상)
node scripts/finance-team/orchestrator.js salary-30-savings-1y-simulation

# 6단계만 (글+영상이 이미 있어야 함)
node scripts/finance-team/publish-finance.js --slug salary-30-savings-1y-simulation
node scripts/finance-team/publish-finance.js --slug ... --publish now
```

## 환경변수 체크리스트

`.env`에 다음이 필요:

```
# Gemini API (글쓰기 + 이미지)
GEMINI_API_KEY=...

# 네이버 데이터랩 (키워드 트렌드)
NAVER_DATALAB_CLIENT_ID=...
NAVER_DATALAB_CLIENT_SECRET=...

# 재테크 블로그 Blogspot
FINANCE_BLOG_ID=...                 # ← 사장님이 Blogspot 만든 후 채워야 함
GOOGLE_CLIENT_ID=...                # ← 경제블로그와 공유 가능 (같은 구글 계정)
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# 텔레그램 알림 (선택)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

GitHub Actions에서 자동 실행하려면 같은 키를 **GitHub Secrets**에 등록.

## 산출물 폴더 구조

```
finance-blog/
├── research/{slug}.json              ← 1단계
├── drafts/
│   ├── {slug}.html                   ← 본문
│   ├── {slug}-narration.json         ← TTS 대본
│   └── {slug}-meta.json              ← 발행용 메타
├── images/{slug}-*.jpg               ← 이미지
├── videos/{slug}-{long,short}.mp4    ← 영상
└── remotion/public/audio/{slug}-*.wav
```

## 토픽 추가하기

`finance-blog/topics.yaml` 끝에 새 항목 추가:

```yaml
  - day: 31
    slug: my-new-topic-slug
    category: savings    # savings | loan | card | insurance
    title: 새 글 제목
    keywords: [메인 키워드, 롱테일1, 롱테일2]
    pattern: ranking     # ranking | vs | guide | qa | simulation | review | recap
```

## 자동 스케줄

GitHub Actions가 **매일 KST 19:00**에 자동 실행 (퇴근 후 트래픽 시간).

자동 실행은 시작일 가드(`20260501`)가 통과해야 동작. 그 전엔 `/finance` 수동만 작동.

## 박재은 톤 / 패턴

- 작가 페르소나: [`agents/park-jaeeun.md`](../../agents/park-jaeeun.md)
- 팀 가이드: [`agents/finance/README.md`](../../agents/finance/README.md)

### 절대 금지 (모든 단계)
- 정치인·정당·이념 발언
- 부동산 가격 전망
- 주식 종목 추천 (자본시장법)
- "100% 승인" / "원금 보장" / "절대 손해" 단정 표현
- 출처 없는 금리·한도 수치

위반 시 자동 재시도 후 실패 알림.

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| `GEMINI_API_KEY 없음` | .env 미설정 | `.env`에 `GEMINI_API_KEY=...` 추가 |
| `FINANCE_BLOG_ID 미설정` | Blogspot 블로그 안 만들었거나 ID 누락 | blogger.com → 새 블로그 → URL의 blogID 복사 |
| `JSON 파싱 실패` (write-draft) | Gemini가 JSON 외 텍스트 반환 | 자동 3회 재시도. 그래도 실패 시 `--dry-run`으로 응답 확인 |
| Remotion 렌더 실패 | 폰트·FFmpeg 누락 | `apt-get install fonts-noto-cjk ffmpeg` (CI에서는 자동) |
| 토픽 자동 결정 실패 | 모든 토픽 이미 발행됨 | `topics.yaml` 끝에 새 토픽 추가 |
