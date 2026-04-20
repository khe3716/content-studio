// 과일 블로그 썸네일 생성기 (800×800, 슈퍼샘플링)
// 스타일: 빨강/핑크 볼드 타이틀 + 밝은 크림/핑크 배경 (기존 블로그 스타일 매칭)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function generateBaseSvg({ title, subtitle, brand = '과일정보연구소' }) {
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const size = 800;
  const c = size / 2;

  // 타이틀 길이 기반 폰트 크기
  const titleFontSize = title.length <= 5 ? 130 : title.length <= 8 ? 100 : title.length <= 11 ? 78 : 62;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF8F5"/>
      <stop offset="100%" stop-color="#FFE4E1"/>
    </linearGradient>
    <style>
      .title { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 900; letter-spacing: -3px; }
      .subtitle { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 800; letter-spacing: -2px; }
      .brand { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -1px; }
    </style>
  </defs>

  <!-- 배경 (크림 → 연분홍 그라디언트) -->
  <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>

  <!-- 상단 장식 (얇은 빨간 선 + 작은 라벨) -->
  <rect x="80" y="120" width="80" height="6" fill="#E53935"/>
  <text x="80" y="108" class="brand" font-size="24" fill="#E53935">FRUIT GUIDE</text>

  <!-- 메인 타이틀 (빨강 볼드) -->
  <text x="${c}" y="${size / 2 - 20}" class="title" font-size="${titleFontSize}" fill="#C62828" text-anchor="middle" dominant-baseline="middle">${escapeXml(title)}</text>

  <!-- 서브 타이틀 (진한 핑크) -->
  ${subtitleLines
    .map(
      (line, i) =>
        `<text x="${c}" y="${size / 2 + 80 + i * 56}" class="subtitle" font-size="44" fill="#AD1457" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`
    )
    .join('\n  ')}

  <!-- 하단 장식 (얇은 빨간 선 + 브랜드) -->
  <rect x="${size - 160}" y="${size - 126}" width="80" height="6" fill="#E53935"/>
  <text x="${size - 80}" y="${size - 88}" class="brand" font-size="26" fill="#37474F" text-anchor="end">📍 ${escapeXml(brand)}</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function renderThumbnailPng({ title, subtitle, brand, emoji, outputPath }) {
  const svg = generateBaseSvg({ title, subtitle, brand });
  let pngBuffer = await sharp(Buffer.from(svg), { density: 600 })
    .resize(1600, 1600)
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();
  pngBuffer = await sharp(pngBuffer)
    .resize(800, 800, { kernel: 'lanczos3' })
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
      emoji,
      outputPath: pngPath,
    });
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`✅ ${dayId} 썸네일 (${Math.round(pngBuffer.length / 1024)}KB)`);
  })();
}
