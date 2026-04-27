# 월급쟁이 재테크 콘텐츠 팀

박재은 페르소나로 운영되는 재테크 비교 블로그 + 영상 자동 제작 팀.

## 팀 구성도

```
              ┌──────────────────────────────┐
              │  사용자 (사장님 / 텔레그램)   │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  orchestrator (디렉터, opus) │
              └──────────────┬───────────────┘
                             ▼
   ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
   ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
researcher  copywriter visual-dir image-gen  html-build video-prod qa-review  (text logs)
sonnet      sonnet     sonnet     haiku      haiku      sonnet     sonnet
   │          │
   │          └─→ 박재은 페르소나 참조: agents/park-jaeeun.md
   │
   └─→ research/{slug}.json 산출
```

## 작가 페르소나 (브랜드 얼굴)

**박재은** — 36세 8년차 사무직, 친근한 누나·언니 톤, 그날 경제 뉴스 도입 패턴.

전체 디테일: [`agents/park-jaeeun.md`](../park-jaeeun.md)

> ⚠️ 박재은 톤 변경은 **`park-jaeeun.md` 한 곳에서만** 수정. 다른 에이전트 파일에서 톤 재정의 금지.

## 사용법

### 방법 1: CLI 직접 호출 (개발자 모드)

```bash
node scripts/finance-team/run.js \
  --slug day-01-may-high-rate-savings-top10 \
  --category savings \
  --pattern ranking \
  --tone A
```

옵션:
- `--slug` (필수) — `day-NN-{kebab}` 형식
- `--category` — savings / loan / card / insurance / account / etf
- `--pattern` — ranking / vs / guide / qa
- `--tone` — A (Toss editorial) / D (Wealthsimple magazine)

### 방법 2: 텔레그램 (사장님 모드)

```
/finance day-01-may-high-rate-savings-top10
```

텔레그램 워커가 GitHub Actions를 트리거 → orchestrator 실행 → 완료되면 결과를 텔레그램으로 발송.

### 방법 3: GitHub Actions 자동 (Phase 2)

매일 정해진 시각에 `finance-blog/topics.yaml`의 다음 슬러그를 자동 발행. (현재 Phase 1: 수동만 지원)

## 산출물

```
finance-blog/
├── research/{slug}.json              # 1단계
├── drafts/
│   ├── {slug}.md                     # 2단계 (frontmatter + 박재은 본문)
│   ├── {slug}-script-long.json       # 2단계 (60s 씬)
│   ├── {slug}-script-short.json      # 2단계 (30s 씬)
│   └── {slug}.html                   # 5단계 (블로그스팟 draft)
├── visual/{slug}.json                # 3단계
├── images/{slug}-*.jpg               # 4단계
├── videos/{slug}-{long|short}.mp4    # 6단계
├── remotion/public/audio/{slug}-*.wav # 6단계 사이드
└── reports/{slug}-qa.json            # 7단계
```

## 슬러그 컨벤션

`day-{NN}-{slug-kebab}`

| 예시 | 패턴 |
|---|---|
| `day-01-may-high-rate-savings-top10` | ranking |
| `day-02-cheong-nyeon-doyak-vs-huimang` | vs |
| `day-03-cheong-do-account-guide` | guide |
| `day-04-cma-faq` | qa |

`NN`은 발행 순서. 월 단위 리셋 가능.

## 디자인 톤

| 톤 | 이름 | 특징 | 어울리는 패턴 |
|---|---|---|---|
| **A안** | Toss editorial | 라이트 배경 + floating shapes + AE Bouncy 모션 | ranking, qa |
| **D안** | Wealthsimple magazine | 베이지 + 클래식 레드 + 매거진 그리드 | vs, guide |

기본값은 A. 특정 글에 D 적용하려면 `--tone D` 또는 frontmatter에 `design_tone: D`.

> **메모리 참조:** [project_finance_video_styles.md](C:\Users\khe37\.claude\projects\c--antigravity-claude-code\memory\project_finance_video_styles.md)에 두 톤의 비주얼 시스템 상세 저장됨. 사용자가 "A안", "D안"으로 호출하면 자동 적용.

## 모션 규칙 (영상)

- **좌우 20px 안전 마진** (텍스트가 화면 밖으로 나가지 않게)
- **메인 텍스트는 ease-in 또는 AE Bouncy** (계층별 차별화 — 한 페이지 동일 ease 금지)
- **작은 라벨은 정적**
- **루프 모션**(floating shapes)은 sin/cos 기반
- **랭킹 숫자**: 부드러운 spring scale만 (블러·진동 X)
- **Hook 텍스트 / 은행명**: AE Bouncy (`BouncyDampedText`)

세부: [`finance-blog/remotion/src/motion.tsx`](../../finance-blog/remotion/src/motion.tsx)

> **메모리 참조:** [feedback_video_motion_rules.md](C:\Users\khe37\.claude\projects\c--antigravity-claude-code\memory\feedback_video_motion_rules.md)

## 절대 금지 (전 팀 공통)

박재은 페르소나 + 정책 준수:

- 정치인·정당·이념 발언
- 부동산 가격 전망
- 주식 종목 추천 (자본시장법)
- "100% 승인", "원금 보장" 단정 표현
- 출처 없는 금리·한도 수치
- 사람 얼굴 클로즈업 이미지
- 자극·공포 마케팅

위반 시 qa-reviewer가 CRITICAL 처리 → 해당 단계 롤백 + 재호출.

## 단계별 입출력 계약

전체 워크플로우와 입출력은 [`orchestrator.md`](orchestrator.md) 참조.

각 에이전트 책임:

| 에이전트 | 핵심 책임 | 산출물 |
|---|---|---|
| [researcher](researcher.md) | 트렌드·SEO·플레이북 분석 | `research/{slug}.json` |
| [copywriter](copywriter.md) | 박재은 본문 + 영상 스크립트 | `drafts/{slug}.{md,script-*.json}` |
| [visual-director](visual-director.md) | 이미지 컨셉 + 컬러·타이포 | `visual/{slug}.json` |
| [image-generator](image-generator.md) | Nano Banana 이미지 생성 | `images/{slug}-*.jpg` |
| [html-builder](html-builder.md) | 블로그스팟 HTML 조립 | `drafts/{slug}.html` |
| [video-producer](video-producer.md) | Remotion 롱폼/쇼츠 렌더 | `videos/{slug}-*.mp4` |
| [qa-reviewer](qa-reviewer.md) | 정확성·톤·정책 최종 검수 | `reports/{slug}-qa.json` |

## 다른 팀과의 관계

- **낮 작가 8명** (`agents/*.md`) — 경제·과일 블로그 운영. 박재은은 그 9번째 작가로 합류.
- **야간 리서치 팀** (`agents/night/`) — 낮·야간 분리. 박재은은 낮 작가 카테고리.
- **detail-page 팀** (`agents/detail-page/`) — 상세페이지 자동화. 영감을 받은 워크플로우(orchestrator → researcher → copywriter → visual → image → html → qa) 동일 구조.

## 변경 이력

- 2026-04-25: finance 팀 8명 + 박재은 페르소나(copywriter 내장) 초기 구축
- 2026-04-27: 박재은 페르소나 단독 파일 분리 + 팀 운영 가이드(README) 정식화 + orchestrator 호출 프로토콜 명확화
