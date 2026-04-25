# 디자인 시스템 (월급쟁이 재테크)

## 컬러 토큰

| 토큰 | HEX | 용도 |
|---|---|---|
| `--primary` | `#2563eb` | 제목·H1·CTA·버튼·표 헤더 |
| `--secondary` | `#f59e0b` | 강조·하이라이트·border-left |
| `--accent` | `#10b981` | 수익·금리·긍정 수치 |
| `--warn` | `#ef4444` | 주의·금리 인하·리스크 |
| `--bg` | `#f8fafc` | 박스 배경 |
| `--fg` | `#0f172a` | 본문 텍스트 |
| `--muted` | `#64748b` | 출처·캡션 |
| `--border` | `#e2e8f0` | 표 라인·구분선 |

## 타이포 스케일

| 토큰 | 크기 | weight | 용도 |
|---|---|---|---|
| `hero` | 64pt | 800 | 영상 타이틀 |
| `h1` | 32pt | 700 | 블로그 제목 |
| `h2` | 22pt | 700 | 섹션 |
| `h3` | 18pt | 700 | 서브섹션 |
| `body` | 16pt | 400 | 본문 |
| `body-bold` | 16pt | 700 | 강조 본문 |
| `caption` | 13pt | 500 | 출처·주석 |
| `video-title` | 84pt | 800 | 영상 화면 큰 타이틀 |
| `video-rank` | 200pt | 900 | 영상 랭킹 숫자 |
| `video-sub` | 36pt | 700 | 영상 자막 |

폰트: `Noto Sans KR` (블로그) / `Pretendard` (영상, fallback Noto Sans KR).

## 그리드 / 스페이싱

| 토큰 | px |
|---|---|
| `space-1` | 4 |
| `space-2` | 8 |
| `space-3` | 12 |
| `space-4` | 16 |
| `space-6` | 24 |
| `space-8` | 32 |
| `space-12` | 48 |

## 컴포넌트 (블로그)

### 도입 박스
```html
<div class="intro" style="background:#f8fafc;padding:18px;border-radius:8px;">
  ...
</div>
```

### 랭킹 표
```html
<table class="rank-table">
  <thead><tr><th>순위</th><th>은행</th><th>금리</th><th>한도</th><th>우대조건</th></tr></thead>
  <tbody>...</tbody>
</table>
```

### 강조 카드 (1위)
```html
<div class="champion" style="border:2px solid #f59e0b;background:#fef3c7;padding:18px;border-radius:12px;">
  <h3>🏆 1위: ○○ 적금</h3>
  <p>...</p>
</div>
```

### CTA 박스
```html
<div class="cta" style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px;">
  ...
</div>
```

## 영상 모션 룰

- 페이드인: 8 frames (≈ 0.27s @ 30fps)
- 슬라이드인: 15 frames + ease-out
- 숫자 카운트업: 1초간 0 → 목표값
- 큰 랭킹 숫자: 12 frames spring 등장
