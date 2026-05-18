// 용과 비교 카드 (백용과 vs 적용과) — 사장님 상세페이지 톤 매칭
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const W = 600;
const H = 720;

const c = {
  bg: '#FFFFFF',
  text_dark: '#1A1A1A',
  text_sub: '#666666',
  text_mute: '#999999',
  // 백용과 (연두·녹색 톤)
  white_bg: '#F4FBE8',
  white_border: '#B8D982',
  white_accent: '#6BA428',
  white_dark: '#2D4D0E',
  // 적용과 (핑크·마젠타 톤 — 사장님 페이지 옵션 박스 색)
  red_bg: '#FFE9F0',
  red_border: '#FF8AAE',
  red_accent: '#E91E63',
  red_dark: '#8B1A5C',
};

const FONT = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 -->
  <rect width="${W}" height="${H}" fill="${c.bg}"/>

  <!-- 섹션 헤더 -->
  <text x="${W/2}" y="60" font-family="${FONT}" font-size="14" fill="${c.text_mute}" font-weight="600" text-anchor="middle" letter-spacing="3">SELECT</text>
  <text x="${W/2}" y="105" font-family="${FONT}" font-size="34" fill="${c.text_dark}" font-weight="900" text-anchor="middle" letter-spacing="-1">백용과 vs 적용과</text>
  <text x="${W/2}" y="140" font-family="${FONT}" font-size="15" fill="${c.text_sub}" font-weight="500" text-anchor="middle">어떤 용과가 더 맞을까요?</text>

  <!-- 백용과 카드 -->
  <rect x="30" y="180" width="265" height="500" rx="24" fill="${c.white_bg}"/>

  <!-- 백용과 원형 아이콘 영역 -->
  <circle cx="162.5" cy="260" r="55" fill="#FFFFFF"/>
  <circle cx="162.5" cy="260" r="55" fill="none" stroke="${c.white_border}" stroke-width="3"/>
  <!-- 흰 용과 단면 일러스트 (간단) -->
  <ellipse cx="162.5" cy="260" rx="42" ry="36" fill="#FFFFFF"/>
  <ellipse cx="162.5" cy="260" rx="42" ry="36" fill="none" stroke="${c.red_border}" stroke-width="2"/>
  <!-- 검은 씨앗들 -->
  <circle cx="148" cy="248" r="2" fill="#1A1A1A"/>
  <circle cx="170" cy="250" r="2" fill="#1A1A1A"/>
  <circle cx="155" cy="262" r="2" fill="#1A1A1A"/>
  <circle cx="175" cy="265" r="2" fill="#1A1A1A"/>
  <circle cx="160" cy="275" r="2" fill="#1A1A1A"/>
  <circle cx="178" cy="278" r="2" fill="#1A1A1A"/>
  <circle cx="145" cy="270" r="2" fill="#1A1A1A"/>
  <circle cx="168" cy="285" r="2" fill="#1A1A1A"/>

  <!-- 백용과 제목 -->
  <text x="162.5" y="365" font-family="${FONT}" font-size="32" fill="${c.white_dark}" font-weight="900" text-anchor="middle" letter-spacing="-1">백용과</text>
  <text x="162.5" y="390" font-family="${FONT}" font-size="13" fill="${c.text_mute}" font-weight="500" text-anchor="middle" letter-spacing="1">WHITE DRAGON FRUIT</text>

  <!-- 구분선 -->
  <line x1="60" y1="415" x2="265" y2="415" stroke="${c.white_border}" stroke-width="1.5"/>

  <!-- 특징 리스트 -->
  <text x="55" y="455" font-family="${FONT}" font-size="18" fill="${c.white_accent}" font-weight="900">·</text>
  <text x="70" y="455" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">부드러운 단맛</text>

  <text x="55" y="490" font-family="${FONT}" font-size="18" fill="${c.white_accent}" font-weight="900">·</text>
  <text x="70" y="490" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">깔끔한 향</text>

  <text x="55" y="525" font-family="${FONT}" font-size="18" fill="${c.white_accent}" font-weight="900">·</text>
  <text x="70" y="525" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">키위처럼 아삭한 식감</text>

  <text x="55" y="560" font-family="${FONT}" font-size="18" fill="${c.white_accent}" font-weight="900">·</text>
  <text x="70" y="560" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">부담 없는 첫 입</text>

  <!-- 추천 태그 -->
  <rect x="55" y="610" width="210" height="42" rx="21" fill="${c.white_accent}"/>
  <text x="162.5" y="637" font-family="${FONT}" font-size="14" fill="#FFFFFF" font-weight="700" text-anchor="middle" letter-spacing="0.5">아이·가성비 추천</text>

  <!-- 적용과 카드 -->
  <rect x="305" y="180" width="265" height="500" rx="24" fill="${c.red_bg}"/>

  <!-- 적용과 원형 아이콘 영역 -->
  <circle cx="437.5" cy="260" r="55" fill="#FFFFFF"/>
  <circle cx="437.5" cy="260" r="55" fill="none" stroke="${c.red_border}" stroke-width="3"/>
  <!-- 적 용과 단면 일러스트 -->
  <ellipse cx="437.5" cy="260" rx="42" ry="36" fill="#FF4D8F"/>
  <ellipse cx="437.5" cy="260" rx="42" ry="36" fill="none" stroke="${c.red_dark}" stroke-width="2"/>
  <circle cx="423" cy="248" r="2" fill="#1A1A1A"/>
  <circle cx="445" cy="250" r="2" fill="#1A1A1A"/>
  <circle cx="430" cy="262" r="2" fill="#1A1A1A"/>
  <circle cx="450" cy="265" r="2" fill="#1A1A1A"/>
  <circle cx="435" cy="275" r="2" fill="#1A1A1A"/>
  <circle cx="453" cy="278" r="2" fill="#1A1A1A"/>
  <circle cx="420" cy="270" r="2" fill="#1A1A1A"/>
  <circle cx="443" cy="285" r="2" fill="#1A1A1A"/>

  <!-- 적용과 제목 -->
  <text x="437.5" y="365" font-family="${FONT}" font-size="32" fill="${c.red_dark}" font-weight="900" text-anchor="middle" letter-spacing="-1">적용과</text>
  <text x="437.5" y="390" font-family="${FONT}" font-size="13" fill="${c.text_mute}" font-weight="500" text-anchor="middle" letter-spacing="1">RED DRAGON FRUIT</text>

  <line x1="335" y1="415" x2="540" y2="415" stroke="${c.red_border}" stroke-width="1.5"/>

  <text x="330" y="455" font-family="${FONT}" font-size="18" fill="${c.red_accent}" font-weight="900">·</text>
  <text x="345" y="455" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">진한 단맛</text>

  <text x="330" y="490" font-family="${FONT}" font-size="18" fill="${c.red_accent}" font-weight="900">·</text>
  <text x="345" y="490" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">베타시아닌 풍부</text>

  <text x="330" y="525" font-family="${FONT}" font-size="18" fill="${c.red_accent}" font-weight="900">·</text>
  <text x="345" y="525" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">화려한 디저트 색감</text>

  <text x="330" y="560" font-family="${FONT}" font-size="18" fill="${c.red_accent}" font-weight="900">·</text>
  <text x="345" y="560" font-family="${FONT}" font-size="15" fill="${c.text_dark}" font-weight="700">강한 항산화</text>

  <rect x="330" y="610" width="210" height="42" rx="21" fill="${c.red_accent}"/>
  <text x="437.5" y="637" font-family="${FONT}" font-size="14" fill="#FFFFFF" font-weight="700" text-anchor="middle" letter-spacing="0.5">디저트·요거트 추천</text>
</svg>`;

const svgPath = path.join(__dirname, 'comparison.svg');
const pngPath = path.join(__dirname, 'comparison.png');

fs.writeFileSync(svgPath, svg);

sharp(Buffer.from(svg))
  .png()
  .toFile(pngPath)
  .then(() => {
    const size = (fs.statSync(pngPath).size / 1024).toFixed(0);
    console.log(`✓ SVG: ${svgPath}`);
    console.log(`✓ PNG: ${pngPath} (${size}KB)`);
    console.log(`📐 ${W} × ${H} px`);
  })
  .catch(e => {
    console.error('❌ 실패:', e.message);
    process.exit(1);
  });
