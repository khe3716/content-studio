// 블로그 썸네일 생성기 (600×600, 슈퍼샘플링 적용)
//
// 두 가지 사용법:
//   1. CLI: node generate-thumbnail.js <dayId> <emoji> "<title>" "<subtitle1>" "<subtitle2>"
//      예:  node generate-thumbnail.js day-04 money-bag "이자란?" "이자 개념과 종류," "한 번에 정리!"
//   2. 라이브러리: const { renderThumbnailPng } = require('./generate-thumbnail'); await renderThumbnailPng({...});

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 텍스트·배경만 포함한 SVG 생성 (이모지는 나중에 합성)
 */
function generateBaseSvg({ title, subtitle, brand = '경제 꿀팁, 하루 5분' }) {
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const size = 600;
  const c = size / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF9F0"/>
      <stop offset="50%" stop-color="#FFF3E0"/>
      <stop offset="100%" stop-color="#FFE4C4"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF6B35"/>
      <stop offset="100%" stop-color="#FF8C42"/>
    </linearGradient>
    <style>
      .title { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 900; letter-spacing: -2px; }
      .subtitle { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -1px; }
      .brand { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; }
    </style>
  </defs>

  <!-- 배경 -->
  <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>

  <!-- 배경 장식 원 -->
  <circle cx="60" cy="70" r="55" fill="#FF6B35" opacity="0.08"/>
  <circle cx="30" cy="130" r="35" fill="#FFB347" opacity="0.12"/>
  <circle cx="${size - 60}" cy="90" r="50" fill="#FFA500" opacity="0.1"/>
  <circle cx="${size - 30}" cy="140" r="30" fill="#FF6B35" opacity="0.13"/>

  <!-- 메인 제목 (길이에 따라 폰트 자동 축소) -->
  <text x="${c}" y="320" class="title" font-size="${
    title.length <= 5 ? 91 : title.length <= 8 ? 74 : title.length <= 11 ? 58 : 48
  }" fill="#1A1A1A" text-anchor="middle">${title}</text>

  <!-- 서브 타이틀 -->
  ${subtitleLines
    .map(
      (line, i) =>
        `<text x="${c}" y="${390 + i * 48}" class="subtitle" font-size="41" fill="#E55A2B" text-anchor="middle">${line}</text>`
    )
    .join('\n  ')}

  <!-- 하단 브랜드 바 (💰 이모지는 PNG 합성으로 추가됨) -->
  <rect x="0" y="${size - 68}" width="${size}" height="68" fill="url(#accentGrad)"/>
  <text x="${c}" y="${size - 25}" class="brand" font-size="29" fill="white" text-anchor="middle">${brand}</text>
</svg>`;
}

/**
 * SVG + 이모지 합성하여 최종 PNG 생성 (슈퍼샘플링)
 */
async function renderThumbnailPng({ title, subtitle, brand, emoji, outputPath }) {
  const svg = generateBaseSvg({ title, subtitle, brand });

  // 1. SVG → PNG 2배 크기(1200×1200)
  let pngBuffer = await sharp(Buffer.from(svg), { density: 600 })
    .resize(1200, 1200)
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  // 2. 상단 메인 이모지 합성 (310×310 → 1200 해상도에서)
  if (emoji) {
    const emojiPath = path.join(__dirname, 'emojis', `${emoji}.png`);
    if (fs.existsSync(emojiPath)) {
      const emojiResized = await sharp(emojiPath)
        .resize(310, 310, { kernel: 'lanczos3' })
        .png()
        .toBuffer();
      pngBuffer = await sharp(pngBuffer)
        .composite([{ input: emojiResized, left: 444, top: 110 }])
        .png({ quality: 100, compressionLevel: 9 })
        .toBuffer();
    } else {
      console.warn(`⚠️ 이모지 파일 없음: ${emojiPath}`);
    }
  }

  // 2-b. 하단 배너의 💰 머니백 이모지 합성 (SVG 텍스트 이모지가 CI에서 흰색 깨짐)
  // SVG에서는 이모지 제거한 상태. "경제 꿀팁, 하루 5분" 텍스트 왼쪽에 이모지 PNG 덧붙임.
  const bagPath = path.join(__dirname, 'emojis', 'money-bag.png');
  if (fs.existsSync(bagPath)) {
    // 1200×1200 intermediate에서:
    //   배너 영역: y=1064~1200 (136px 높이)
    //   이모지 90×90 → y=1087 (배너 중앙)
    //   텍스트 중앙 정렬인데 이모지를 텍스트 왼쪽에 배치
    //   텍스트 "경제 꿀팁, 하루 5분" @ 58px ≈ 가로 580px, 중앙 기준 310~890
    //   이모지 x=340 (텍스트 시작 직전)
    const bagResized = await sharp(bagPath)
      .resize(80, 80, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
    pngBuffer = await sharp(pngBuffer)
      .composite([{ input: bagResized, left: 220, top: 1092 }])
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();
  }

  // 3. 최종 다운스케일 600×600
  pngBuffer = await sharp(pngBuffer)
    .resize(600, 600, { kernel: 'lanczos3' })
    .png({ quality: 95, compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(outputPath, pngBuffer);
  return { svg, pngBuffer };
}

// ========== 라이브러리로 내보내기 ==========
module.exports = { generateBaseSvg, renderThumbnailPng };

// ========== CLI 실행 ==========
if (require.main === module) {
  (async () => {
    const [dayId, emoji, title, sub1, sub2] = process.argv.slice(2);
    if (!dayId || !title) {
      console.log('사용법: node generate-thumbnail.js <dayId> <emoji> "<title>" "<subtitle1>" "<subtitle2>"');
      console.log('예시: node generate-thumbnail.js day-04 money-bag "이자란?" "이자 개념과 종류," "한 번에 정리!"');
      process.exit(1);
    }

    const outputDir = path.join(__dirname, 'thumbnails');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const svgPath = path.join(outputDir, `${dayId}.svg`);
    const pngPath = path.join(outputDir, `${dayId}.png`);

    const { svg, pngBuffer } = await renderThumbnailPng({
      title,
      subtitle: [sub1, sub2].filter(Boolean),
      brand: '경제 꿀팁, 하루 5분',
      emoji: emoji || 'lightbulb',
      outputPath: pngPath,
    });

    fs.writeFileSync(svgPath, svg, 'utf8');

    console.log(`✅ ${dayId} 썸네일 생성 완료!`);
    console.log(`🖼️  PNG: ${pngPath} (${Math.round(pngBuffer.length / 1024)}KB)`);
  })();
}
