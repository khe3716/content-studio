---
style_id: style_1
name: 시그니처 (식품 그린/옐로우)
category_fit: [food, fresh-grocery, fruit, organic]
based_on: 메론 케이스 (2026-04-25)
ref_implementation: fruit-blog/detail-pages/generate-detail-melon-signature.js
---

# 스타일_1 — 시그니처 디자인 시스템

식품·신선식품 카테고리용 디자인 시스템. 메론 첫 케이스에서 정립.

## 디자인 철학

1. **자연·신선** — 그린 = 외피/잎, 옐로우 = 과육
2. **통일성 우선** — 단일 액센트 컬러, 한 종류 카드, 한 가지 사진 라디우스
3. **POINT 구조 + FBM 훅** — 한국 스마트스토어 컨벤션 + 행동 설계 결합
4. **사진 우선** — 좋은 컷은 큰 사이즈로, 텍스트 보조

## 컬러 토큰

```javascript
const c = {
  bg: '#FAFCF0',           // 페이지 BG (밀키 크림-옐로우)
  bg_emphasis: '#F0F4DC',   // 강조 BG (옅은 그린-크림)
  card: '#FFFFFF',         // 카드 배경
  border: '#DEE2C0',       // 카드 보더 (옅은 올리브)
  brand: '#87A35A',        // 메인 그린 (메론 외피)
  brand_deep: '#5C7A3F',    // 진한 그린 (잎)
  highlight: '#FCEFC2',    // 옅은 옐로우 (과육)
  dark: '#2A3520',         // 딥 포레스트
  sub: '#5F6A4D',          // 서브 포레스트
  muted: '#989F7E',        // 음소거 올리브
};
```

### 사용 규칙
- **brand** = 모든 액센트 (eyebrow·H1 강조어·CTA·아이콘 원·강조 띠)
- **brand_deep** = 호버·인용문 강조
- **highlight** = 가로 띠로만 사용 (절제, 1~2회/페이지)
- **bg** = 거의 모든 섹션 배경
- **bg_emphasis** = KAIROS 같은 1~2 섹션만
- **dark** = 본문 텍스트
- **sub** = 서브타이틀·설명
- **muted** = 캡션·footer

## 타이포 시스템

```javascript
const FONT = "'Pretendard', 'Malgun Gothic', sans-serif";
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', serif";
```

### 위계
| 레벨 | 사이즈 | weight | 사용처 |
|------|--------|--------|--------|
| Eyebrow | 13px | 900 | 섹션 시작 라벨 (오렌지 알약 안) |
| H1 (히어로) | 36px | 900 | 히어로 메인 |
| H1 (섹션) | 28px | 900 | 일반 섹션 메인 |
| H2 | 22px | 900 | 카드 안 헤드 |
| Subtitle | 15px | 600 | H1 아래 보조 |
| Body | 14~15px | 600~700 | 본문·체크리스트 |
| Caption | 13px | 600 | footnote·메타 |
| Quote | 22px | italic | 인용·감성 마무리 (Serif) |

### Letter spacing
- H1: -0.8 ~ -1.2 (타이트)
- Body: -0.3 (살짝 타이트)
- Eyebrow: 3 (풀어서 트래킹)

## 카드 시스템

### 기본 카드
```
배경: #FFFFFF
보더: 1px solid #DEE2C0
라디우스: 16px
패딩: 16px 양옆
```

### Stripe Card (Hook용)
- 기본 카드 + 좌측 6px brand 컬러 띠
- 280h ~ 340h 정도

### Step Card (TASTE/POINT03)
- 기본 카드 + 좌측 brand circle (26r) 안에 흰색 번호
- 라벨(13px brand) + 본문(16px dark 800)
- 80h 정도

### Variety Chip (POINT02)
- 기본 카드 + 좌측 색상 닷 (22r) + 옅은 보더
- 76h 정도, 4개 세로 스택

### Highlight Band
- highlight 컬러 풀 가로 띠
- 44~50h, 라디우스 22 (full pill)
- 14~17px bold dark 텍스트 중앙

### Mega CTA Card
- brand 컬러 fill
- 720h 정도
- 흰색 inset 카드 (옵션 ①, ②) 안에 가격
- 강조 띠 + 배송 안내

## 사진 규격

| 용도 | 크기 | 라디우스 | 위치 |
|------|------|---------|------|
| 히어로 | 520×380 | 16px | 좌측 마진 40 |
| 매크로 풀와이드 | 600×400 | 0 (풀블리드) | x=0 |
| SIZE 풀와이드 | 600×460 | 0 | x=0 |
| POINT 메인 | 520×320 | 16px | 좌측 마진 40 |
| TASTE 단면 | 520×320 | 16px | 좌측 마진 40 |
| CUTS 좌우 | 260×260 | 16px | 좌 40, 우 300 |
| 갤러리 | 168×168 | 12px | 3×2 그리드 (x=50,176,352) |

## 컴포넌트 헬퍼 함수 (디자이너 표준)

### eyebrow(text, y=60, w=200)
```svg
<rect x="${300 - w/2}" y="${y}" width="${w}" height="36" rx="18" fill="#87A35A"/>
<text x="300" y="${y+24}" font-size="13" fill="white" font-weight="900" text-anchor="middle" letter-spacing="3">${text}</text>
```

### h1(left, accent, right, y)
```svg
<text x="300" y="${y}" font-weight="900" font-size="28" fill="#2A3520" text-anchor="middle" letter-spacing="-0.8">
  ${left} <tspan fill="#87A35A">${accent}</tspan>${right ? ' '+right : ''}
</text>
```

### subtitle(text, y)
```svg
<text x="300" y="${y}" font-size="15" fill="#5F6A4D" font-weight="600" text-anchor="middle" letter-spacing="-0.3">${text}</text>
```

### roundedPhoto(file, w, h, r=16)
```js
sharp(file).resize(w, h, {fit:'cover'}).composite([{
  input: Buffer.from(`<svg width="${w}" height="${h}"><rect rx="${r}" ry="${r}" width="${w}" height="${h}" fill="white"/></svg>`),
  blend: 'dest-in'
}]).png().toBuffer();
```

## 표준 섹션 카탈로그

스타일_1에서 사용 가능한 섹션 타입 (와이어프레임에서 조합):

1. **hero** — 좌측 H1 임팩트 + 라운드 사진
2. **hook (fear+hope)** — 두 장의 stripe card
3. **taste** — 단면 사진 + 임팩트 헤드 + 3 step cards
4. **macro** — 풀와이드 사진 단독
5. **size** — 풀와이드 사진 + 헤더 + 정량 띠
6. **reasons** — 4개 카드 그리드 (아이콘 원 + 2줄 텍스트)
7. **point01** — eyebrow + h1 + 사진 + 체크리스트 카드
8. **point02** — eyebrow + h1 + 사진 + 4 variety chips + facilitator 띠
9. **cuts** — eyebrow + h1 + 좌우 큰 사진 2장 + footer quote
10. **point03** — eyebrow + h1 + 3 step cards + footnote
11. **gallery** — eyebrow + h1 + 6 thumbnails 3×2 + owner quote
12. **kairos** — eyebrow + h1 + body + brand orange card + social punch
13. **cta** — mega brand card + 옵션 가격 카드 + 배송 + 클로저
14. **policy** — 외부 정책 이미지 임포트

## 시각 리듬 규칙

```
크림 → 크림 → 크림 → [풀사진] → 크림 → 크림 → 크림 → 크림 → 크림 → 강조크림 → 브랜드카드 → 정책
```

- **다크/풀블록 강조 = 0** (스타일_1은 light 톤만)
- **강조 BG = 1~2 섹션** (KAIROS 등)
- **풀사진 = 호흡 포인트** (3~5섹션마다 1번)
- **CTA 메가카드 = 마지막 클라이맥스 1번**

## 카피 프레임 (FBM 매핑)

| 섹션 | FBM 역할 | 카피 톤 |
|-----|---------|--------|
| hero | Pleasure spark | 식욕 자극 즉발 |
| hook (fear) | Fear of Loss | 손실 회피 |
| hook (hope) | Hope simulation | 미래 장면 |
| taste | Pleasure 심화 | "설명 안 됨" |
| macro/size | Visual evidence | 텍스트 절제 |
| reasons | Trust establish | 사실 + 프레임 |
| point01 | Trust depth | 산지·검수 |
| point02 | Facilitator | "고민 NO" |
| cuts | Pleasure visual | 단면 컬러 묘사 |
| point03 | Education + ability | 후숙 가이드 |
| gallery | Authenticity | 실제 사진 |
| kairos | Kairos signal | 지금 |
| cta | Signal | 옵션·가격 명확 |

## 카테고리 fit

이 스타일은 **식품·신선·과일·유기농** 카테고리에서 검증.

### 적합
- 신선식품 (메론·딸기·사과·복숭아 등)
- 산지직송 농산물
- 베이커리·디저트 (변형 가능)

### 부적합
- 전자제품 (다크/네온 시스템 필요 — `style_2` 후보)
- 명품·럭셔리 (다크 럭셔리 시스템 — `style_3` 후보)
- 화장품 (디테일+감각 시스템 — `style_4` 후보)

## 변형 포인트

같은 스타일_1 내에서 카테고리별 색감 미세 조정:

- **메론**: 그린(#87A35A) + 옐로우(#F5C84A)
- **딸기/체리**: 레드(#D85A5A) + 핑크(#F4D5C9)
- **사과**: 레드(#C94545) + 옐로우(#F5C84A)
- **복숭아**: 피치(#F4A48E) + 크림
- **포도**: 자주(#7A3D6B) + 라일락
- **귤**: 오렌지(#E89544) + 옐로우

색만 바꾸고 나머지 시스템은 그대로 유지.

## 레퍼런스 구현

```
fruit-blog/detail-pages/generate-detail-melon-signature.js
fruit-blog/detail-pages/output/goryeong-melon/variant-signature-final.png
```

이 두 파일이 스타일_1의 정확한 구현체. 새 상품 케이스 시작할 땐 이 파일 복사 후:
1. SOURCE_DIR + product-id 변경
2. photo_mapping 변경
3. 카피 JSON 적용
4. 색감 미세조정 (필요시)

## 다음 발전 방향

- [ ] HTML 출력 옵션 (반응형)
- [ ] 다크 모드 변형 (`style_1_dark`)
- [ ] 모바일 가로 스크롤 카드 변형
- [ ] 동영상 임베드 슬롯
