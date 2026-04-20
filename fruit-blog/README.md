# 과일 연구소 블로그

**Blogger URL**: https://fruitinfoguide.blogspot.com/
**스마트스토어**: https://smartstore.naver.com/dalkomsalang (달콤살랑)

## 폴더 구조

| 폴더/파일 | 용도 |
|---|---|
| `topics.yaml` | 주제 로드맵 (어떤 글 쓸지 순서대로) |
| `drafts/` | AI가 만든 글 원고 (HTML) |
| `thumbnails/` | 자동 생성된 썸네일 이미지 (PNG/SVG) |

## 자동화 흐름 (경제 블로그와 동일)

1. GitHub Actions가 정해진 시간에 실행
2. `topics.yaml`에서 다음 주제 선택
3. AI가 글 작성 → 팩트체크 → HTML 저장
4. 썸네일 자동 생성 → GitHub 푸시
5. Blogger API로 임시저장 업로드
6. 텔레그램 알림 (파머링크 + 검색 설명 포함)
7. 사장님이 Blogger에서 파머링크/검색 설명 붙여넣고 발행

## 주의

- 이 블로그는 **공개 저장소**에 저장됩니다 (`.env`만 제외)
- 비밀번호는 GitHub Secrets에 암호화 저장됨
- 스마트스토어 링크는 애드센스 심사 중엔 자제 (일반 정보 위주)
