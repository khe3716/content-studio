# CLAUDE.md

이 저장소는 경제 블로그 + 과일 블로그 + (예정) YouTube Shorts 자동화 시스템입니다.

## 프로젝트 현황

- **경제 블로그**: 매일 07:30 + 17:00 KST 자동 발행 (Blogspot)
- **과일 블로그**: 매일 18:00 KST 자동 발행 (Blogspot, fruitinfoguide.blogspot.com)
- **텔레그램 봇**: `@Economyblog_bot` (/publish, /fruit, /status, /fruitstatus, /help)
- **운영자**: 1인 스마트스토어 (달콤살랑) 과일 판매자, 비개발자

## 🚨 백업 규칙 (중요)

**다음 상황에서는 반드시 사용자에게 백업을 권유하세요:**

1. 새 기능 완성 (예: 유튜브 쇼츠 자동화, 네이버 블로그 추가)
2. 큰 구조 변경 (폴더/파일 재배치, 워크플로 변경)
3. 새 서비스 연동 (API 키 추가, 외부 툴 도입)
4. 스케줄·스펙 크게 변경

**백업 형식**: `backup/STATE-YYYY-MM-DD-주제요약.md`

예시:
- `STATE-2026-04-28-유튜브쇼츠-자동화-완성.md`
- `STATE-2026-05-05-네이버블로그-반자동-추가.md`

**백업 방법**: 이전 백업 파일(`backup/STATE-2026-04-21-...md`) 형식 참고해서 현재 상태 전부 기록.

## 새 Claude 세션 진입 시

먼저 `backup/` 폴더의 **가장 최신 STATE 파일**을 읽고 프로젝트 상황 파악하세요.
그래야 사용자가 질문 반복 답 안 해도 됩니다.

## 주요 폴더

- `agents/` — 작가 페르소나 (김하나, 박과일, 박팩트 등)
- `economy-blog/` — 경제 블로그 원고·썸네일·주제 로드맵
- `fruit-blog/` — 과일 블로그 원고·썸네일·AI 이미지·주제 로드맵
- `telegram-worker/` — Cloudflare Worker 코드 (텔레그램 → GitHub Actions 중계)
- `youtube-shorts/` — (예정) 유튜브 쇼츠 자동화
- `backup/` — 프로젝트 상태 스냅샷 (날짜순)
- `.github/workflows/` — GitHub Actions 자동 스케줄

## 사용자 특성

- 한국어, 비개발자
- 핸드폰에서 텔레그램으로 명령 선호
- 컴퓨터 꺼져도 자동화 작동해야 함
- 애드센스 심사 중 — 과도한 상품 링크 자제
