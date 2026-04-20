// 과일 블로그 썸네일 생성기 (600×600, 슈퍼샘플링)
// 경제블로그 스타일 베이스, 색상만 과일 친화적 그린/핑크 톤

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function generateBaseSvg({ title, subtitle, brand = '과일정보연구소' }) {
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const size = 600;
  const c = size / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F5FFF0"/>
      <stop offset="50%" stop-color="#EFFAE4"/>
      <stop offset="100%" stop-color="#D9F0C1"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2E7D32"/>
      <stop offset="100%" stop-color="#558B2F"/>
    </linearGradient>
    <style>
      .title { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 900; letter-spacing: -2px; }
      .subtitle { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -1px; }
      .brand { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; }
    </style>
  </defs>

  <!-- 배경 -->
  <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>

  <!-- 배경 장식 원 (과일 색상: 빨강·보라·주황) -->
  <circle cx="60" cy="70" r="55" fill="#E53935" opacity="0.08"/>
  <circle cx="30" cy="130" r="35" fill="#8E24AA" opacity="0.10"/>
  <circle cx="${size - 60}" cy="90" r="50" fill="#FF6B35" opacity="0.10"/>
  <circle cx="${size - 30}" cy="140" r="30" fill="#F9A825" opacity="0.12"/>

  <!-- 메인 제목 -->
  <text x="${c}" y="320" class="title" font-size="${
    title.length <= 5 ? 91 : title.length <= 8 ? 74 : title.length <= 11 ? 58 : 48
  }" fill="#1B5E20" text-anchor="middle">${title}</text>

  <!-- 서브 타이틀 -->
  ${subtitleLines
    .map(
      (line, i) =>
        `<text x="${c}" y="${390 + i * 48}" class="subtitle" font-size="41" fill="#558B2F" text-anchor="middle">${line}</text>`
    )
    .join('\n  ')}

  <!-- 하단 브랜드 바 -->
  <rect x="0" y="${size - 68}" width="${size}" height="68" fill="url(#accentGrad)"/>
  <text x="${c}" y="${size - 25}" class="brand" font-size="29" fill="white" text-anchor="middle">🍎 ${brand}</text>
</svg>`;
}

// 이모지 풀백 매핑: 존재하는 파일명으로 재매핑
const EMOJI_FALLBACK = {
  apple: 'red_apple',
  dragon_fruit: 'mango',  // 임시 대체
  fig: 'grapes',          // 임시 대체
  refrigerator: 'blueberries',
  calendar: 'melon',
  pregnant_woman: 'strawberry',
  test_tube: 'kiwi_fruit',
  shopping_cart: 'pear',
  gift: 'peach',
  trophy: 'pineapple',
  droplet: 'watermelon',
  ice_cube: 'blueberries',
  truck: 'tomato',
  money_with_wings: 'banana',
  baby: 'strawberry',
};

function resolveEmojiFile(emoji) {
  const dir = path.join(__dirname, 'emojis');
  const target = EMOJI_FALLBACK[emoji] || emoji;
  const p = path.join(dir, `${target}.png`);
  if (fs.existsSync(p)) return p;
  // 최종 폴백: red_apple
  const fallback = path.join(dir, 'red_apple.png');
  return fs.existsSync(fallback) ? fallback : null;
}

async function renderThumbnailPng({ title, subtitle, brand, emoji, outputPath }) {
  const svg = generateBaseSvg({ title, subtitle, brand });

  let pngBuffer = await sharp(Buffer.from(svg), { density: 600 })
    .resize(1200, 1200)
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  if (emoji) {
    const emojiPath = resolveEmojiFile(emoji);
    if (emojiPath) {
      const emojiResized = await sharp(emojiPath)
        .resize(310, 310, { kernel: 'lanczos3' })
        .png()
        .toBuffer();
      pngBuffer = await sharp(pngBuffer)
        .composite([{ input: emojiResized, left: 444, top: 110 }])
        .png({ quality: 100, compressionLevel: 9 })
        .toBuffer();
    } else {
      console.warn(`⚠️ 이모지 파일 없음: ${emoji}`);
    }
  }

  pngBuffer = await sharp(pngBuffer)
    .resize(600, 600, { kernel: 'lanczos3' })
    .png({ quality: 95, compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(outputPath, pngBuffer);
  return { svg, pngBuffer };
}

module.exports = { generateBaseSvg, renderThumbnailPng };

if (require.main === module) {
  (async () => {
    const [dayId, emoji, title, sub1, sub2] = process.argv.slice(2);
    if (!dayId || !title) {
      console.log('사용법: node generate-thumbnail.js <dayId> <emoji> "<title>" "<subtitle1>" "<subtitle2>"');
      process.exit(1);
    }
    const outputDir = path.join(__dirname, 'thumbnails');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const svgPath = path.join(outputDir, `${dayId}.svg`);
    const pngPath = path.join(outputDir, `${dayId}.png`);
    const { svg, pngBuffer } = await renderThumbnailPng({
      title,
      subtitle: [sub1, sub2].filter(Boolean),
      brand: '과일정보연구소',
      emoji: emoji || 'red_apple',
      outputPath: pngPath,
    });
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`✅ ${dayId} 썸네일 생성! (${Math.round(pngBuffer.length / 1024)}KB)`);
  })();
}
