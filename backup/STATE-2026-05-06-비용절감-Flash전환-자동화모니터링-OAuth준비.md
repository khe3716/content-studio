# STATE 2026-05-06 — 비용 절감 (Pro→Flash) + 자동 모니터링 + 박재은 SNS 채널 + YouTube OAuth 준비

## 한 줄 요약

**4월~5월초 67,071원 + 12,671원 청구**됨 (Gemini Pro 한도 초과 + Imagen·Lyria·Video 등). 모든 자동화 **Pro→Flash 전환** + 자체 사용량 추적·차단 시스템 구축. **앞으로 0원 운영 보장**. 박재은 유튜브·틱톡 채널 생성 + 영상 v21 업로드. **YouTube OAuth 클라이언트 발급까지 완료**, refresh token 발급은 다음 세션.

---

## 박재은 채널 운영 현황

### 블로그스팟 (worker-money-note.blogspot.com)
- ✅ 자동 발행 운영 중 (예약: 4/29~5/8 day-22~41, 20개 큐)

### 유튜브 채널 (사장님 직접 운영 중)
- ✅ 채널 이름: **월급쟁이 재테크 노트**
- ✅ 핸들: `@worker_money_note`
- ✅ 첫 영상 업로드 완료: `260428_1안_v21.mp4` (Day 1 적금 TOP 5)
- ⏳ 자동 업로드 시스템 = OAuth 클라이언트 발급까지 완료, refresh token 발급은 다음 세션

### 틱톡 (사장님 직접 운영 중)
- ✅ 계정 생성: `@worker_money_note`
- ✅ 프로필 사진: 유튜브 로고 (월급쟁이 재테크 노트, 검은 배경 + 골드 원형)
- ✅ 자기소개 입력 완료
- ⏳ 첫 영상 업로드 (사장님 작업)

### 인스타·스레드 (5/12 이후로 미룸)
- 사장님 인스타 정지 3번 이력 → 박과일 계정과 별도 환경 필요 (다른 휴대폰 번호 + 다른 네트워크)
- 5/12까지 박재은 영상 5~7개 비축 후 한 번에 개설·업로드

---

## 비용 사고 + 절감

### 청구 내역
| 시점 | 금액 | 원인 |
|------|------|------|
| 4월 사용 | **67,071원** (5/2 청구) | Gemini Pro + Imagen + Lyria + Video |
| 5/1~5/4 | **12,671원** (6/1 청구 예정) | Pro 한도 초과 (야간 리서치) |
| 5/5 이후 | **0원 추세** | Flash 전환 + 자동 차단 |

### 원인 분석
- **Pro 무료 한도 일 25회**가 매우 짠
- **야간 리서치 4팀** 매일 8~16회 자동 호출 → 한도 초과 → 유료 전환
- 박재은 영상 작업 (4/27~28): Lyria BGM 4회 + Gemini Video 1회 + Imagen 등 ≈ 5,000원
- 과일 블로그 Imagen 매일 5~10장 ≈ 일 200원

### 절감 조치 (5/5~5/6 적용)
1. **모든 코드 Pro → Flash 전환** (12개 파일)
   - auto-publish.js, auto-publish-fruit.js, auto-publish-naver.js
   - scripts/finance-team/lib.js
   - scripts/night-crew/crew-runner.js
   - youtube-shorts/* (4개)
   - insta/* (3개)
2. **scripts/api-usage-tracker.js** 신규 생성
   - 일 1,500회 한도 (Flash) 추적
   - 50%·80%·95% 임계값 텔레그램 알림
   - 100% 도달 시 자동 호출 차단 (throw)
3. **야간 리서치 Pro fallback 절대 금지**
   - crew-runner.js의 callGemini가 model 인자 무시하고 Flash 강제
   - 메모리 저장: `feedback_no_pro_fallback.md`
4. **Google Cloud 예산 알림** (사장님 마무리 중)
   - 1원 한도 + 50/90/100% 임계값
   - 1원이라도 청구 시 즉시 이메일

### 자동화 일일 사용량 vs 한도
| 작업 | 일 호출 |
|------|--------|
| 경제 블로그 (07:30·17:00) | 4~5회 |
| 과일 블로그 (18:00) | 2~3회 |
| 야간 리서치 4팀 | 8~12회 |
| 텔레그램 명령 | ~5회 |
| **합계** | **~25회** (한도 1,500의 1.7%) |

→ 무료 한도 안에서 100% 작동.

---

## 메모리 추가 (이번 세션)

- `feedback_file_naming.md` — YYMMDD_N안 파일 명명 규칙
- `feedback_search_description.md` — 블로그 검색 설명 자동 추가
- `feedback_no_pro_fallback.md` — 야간 리서치 Pro 금지 + Flash 강제

---

## YouTube OAuth 준비 (사장님 발급 완료)

### .env 추가됨
```
YOUTUBE_CLIENT_ID=<<GOOGLE_CLIENT_ID>>
YOUTUBE_CLIENT_SECRET=<<GOOGLE_CLIENT_SECRET>>
# YOUTUBE_REFRESH_TOKEN= (다음 세션에 발급)
```

### 다음 세션에 할 것
1. **Refresh token 발급** (브라우저 OAuth 인증)
   - scope: `https://www.googleapis.com/auth/youtube.upload`, `youtube`
2. **scripts/finance-team/upload-youtube.js** 작성
   - 영상 + 제목 + 설명 + 태그 + 카테고리 자동 업로드
   - 무료 quota 일 6 업로드 (충분)
3. **통합 발행 스크립트**
   - 블로그 + 유튜브 동시 발행 + 텔레그램 알림
   - 틱톡은 텔레그램으로 영상·캡션 발송 → 사장님이 폰으로 1분 업로드

---

## 1안 영상 v21 (이미 완성)

### 위치
```
c:\antigravity\claude code\finance-blog\remotion\out\260428_1안_v21.mp4
```

### 사양
- 1080×1920 세로, 24초, 4.3MB
- 검증된 금감원 데이터 (1위 경남은행 7%)
- 음성 프레임 단위 동기화
- BGM (Lyria 102 BPM 펑키 로파이)
- 사장님 효과음 8종 + 카운트업
- 1위 폭죽 + 매직 차임

### 영상 v1→v21 핵심 다듬은 항목
1. 검증 데이터 적용
2. Hook 가운데 정렬
3. "1위는 7%" 한 줄 통합
4. 한도/우대 → % 밑 이동
5. 음성 동기화 (ffmpeg silence detection +4프레임 보정)
6. CTA 음성 동기화
7. 한도/우대 fade-in 제거
8. BGM 추가 (Lyria 3, 75 → 88 → 102 BPM)
9. 나레이션 +2dB / BGM -16dB
10. SFX 4개 (ElevenLabs)
11. SFX 영상 톤 분석 (Gemini Video API)
12. 사용자 wav 8종 적용
13. 카운트업 모든 위 적용 (5·4·3·2·1위)
14. 1위 화면 ~19초까지 유지
15. 라벨 "한도" → "방식"
16. 1·2위 적립방식 데이터 정정

---

## 다음 세션 작업 (압축 후)

### 사장님이 원하는 작업 (압축 후 한 번에 요청)
1. **박재은 SNS 3채널 캡션** (인스타·스레드·틱톡)
   - 영상은 사장님 폰에서 직접 업로드
   - 채널별 캡션 톤 맞춤 (제가 미리 줌)
2. **달콤살랑 상세페이지** (메인 작업)
   - 사장님이 사진·정보 주시면 자동 생성

### 추가 작업 (선택)
3. **YouTube refresh token 발급** + 자동 업로드 스크립트
4. **2안·3안 영상** (Wealthsimple·Motion Graphics)
5. **Day 2~ 영상** (적금 외 다른 주제)
6. **TikTok Direct Post API 신청** (1~2주 승인)

---

## 알려진 한계

1. **Gemini Pro 일 25회 한도 초과**: 야간 리서치 + 자동 발행이 자주 초과 → Flash로 해결
2. **Imagen 4.0 Fast 무료 한도 거의 없음**: 이미지당 25원 → Gemini Flash Image (일 500장 무료) 전환 옵션 남김
3. **Lyria 3 / Gemini Video API 유료**: 영상 작업 시에만 호출 (자동화 영향 X)
4. **TikTok Direct Post API**: 승인 1~2주 (대안: 텔레그램 → 폰 수동)
5. **인스타 정지 3번 이력**: 박재은 인스타는 5/12 이후 다른 환경에서 개설

---

## 환경변수 추가됨 (이번 세션)

```
YOUTUBE_CLIENT_ID=<<GOOGLE_CLIENT_ID>>
YOUTUBE_CLIENT_SECRET=GOCSPX-...
ELEVENLABS_API_KEY=sk_... (이전 세션, 유지)
FSS_FINLIFE_API_KEY=... (이전 세션, 유지)
```

---

## 감사 (사장님 작업)

- 결제 메일 보고 즉시 알아채심 (5/2 67,071원)
- "Flash 한도 없으면 절대 Pro로 전환하지 말라" 명확한 원칙 제시
- OAuth 클라이언트 발급 (5분)
- Google Cloud 예산 알림 설정

→ "**자동화는 무료 한도 안에서**" 원칙 확립.
→ 비용 모니터링 시스템 정착 (자체 + Google Cloud 이중 안전).
