// 재테크 블로그 썸네일 생성기 (1200×630, Open Graph 표준)
//
// 사용법:
//   node finance-blog/generate-thumbnail.js <slug> [tone]
//   tone: 1 (Toss editorial / 라이트 + 블루) — 기본
//         3 (Motion Graphics / 베이지 + 다크잉크)
//         all (둘 다 한꺼번에 생성)
//
// 입력: finance-blog/drafts/{slug}-meta.json (title 추출)
//       finance-blog/research/{slug}.json (verified_rate_data → 핵심 숫자 추출)
// 출력: finance-blog/thumbnails/{slug}-thumb-tone{N}.png

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DRAFTS_DIR = path.join(__dirname, 'drafts');
const RESEARCH_DIR = path.join(__dirname, 'research');
const OUT_DIR = path.join(__dirname, 'thumbnails');

const W = 1080;
const H = 1080;  // 1:1 정사각 (인스타·카카오톡 OG 친화)

// 글에서 핵심 정보 추출
function extractContent(slug) {
  const metaPath = path.join(DRAFTS_DIR, `${slug}-meta.json`);
  const researchPath = path.join(RESEARCH_DIR, `${slug}.json`);
  if (!fs.existsSync(metaPath)) throw new Error(`meta 파일 없음: ${metaPath}`);

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const research = fs.existsSync(researchPath) ? JSON.parse(fs.readFileSync(researchPath, 'utf8')) : null;

  // 제목 정제: 이모지·"—" 뒤 부제 제거
  let mainTitle = (meta.title || '').replace(/[🏦💼📊💰💵📈]/g, '').replace(/\s+—.*$/, '').trim();

  // 시즌 추출 (예: "2026년 5월")
  const seasonMatch = mainTitle.match(/(\d{4}년\s*\d{1,2}월)/);
  const season = seasonMatch ? seasonMatch[1] : '';
  if (season) mainTitle = mainTitle.replace(season, '').trim();

  // 핵심 숫자 추출 (verified_rate_data에서 전체 최고 금리 1개만 강조)
  let bigStat = '';
  let statSubtitle = '';
  const v = research?.verified_rate_data;
  if (v?.bankTop10?.[0]?.max12m || v?.savingbankTop5?.[0]?.max12m) {
    const maxBank = v?.bankTop10?.[0]?.max12m || 0;
    const maxSb = v?.savingbankTop5?.[0]?.max12m || 0;
    const overall = Math.max(maxBank, maxSb);
    bigStat = `최고 연 ${overall}%`;
    statSubtitle = '1금융권 · 저축은행 한눈에';
  }

  return {
    season,
    mainTitle,
    bigStat,
    statSubtitle,
    signature: '박재은이 정리합니다',
  };
}

// ─────────────────────────────────────────────────────────────
// 1안 — Toss editorial (라이트 + 블루 + 골드) — 1:1 1080×1080
// ─────────────────────────────────────────────────────────────
function svgTone1({ season, mainTitle, bigStat, statSubtitle, signature }) {
  // 메인 제목 — 시각적으로 가장 강한 요소 (페이지 정체성)
  const titleLines = (() => {
    if (mainTitle.length <= 7) return [mainTitle];
    const half = Math.ceil(mainTitle.length / 2);
    const idx = mainTitle.lastIndexOf(' ', half + 2);
    if (idx > 2) return [mainTitle.slice(0, idx), mainTitle.slice(idx + 1)];
    return [mainTitle];
  })();

  const titleFs = titleLines.length === 2
    ? (Math.max(...titleLines.map(l => l.length)) <= 7 ? 148 : 124)
    : (mainTitle.length <= 8 ? 168 : 134);

  const titleStartY = season ? 340 : 270;
  const titleLineHeight = titleFs - 3;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAFBFF"/>
      <stop offset="100%" stop-color="#EEF1F8"/>
    </linearGradient>
    <style>
      .t-title { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 900; letter-spacing: -4px; }
      .t-sub { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -1.5px; }
      .t-season { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 800; letter-spacing: -1px; }
      .t-sig { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -0.5px; }
      .t-brand { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 600; letter-spacing: -0.3px; }
    </style>
  </defs>

  <!-- 배경 그라데이션 -->
  <rect width="${W}" height="${H}" fill="url(#bg1)"/>

  <!-- 떠다니는 도형들 (1:1 균형 배치) -->
  <circle cx="140" cy="180" r="100" fill="#1B64DA" opacity="0.08"/>
  <circle cx="80" cy="320" r="36" fill="#FFB800" opacity="0.32"/>
  <circle cx="${W - 130}" cy="140" r="70" fill="#FFB800" opacity="0.18"/>
  <circle cx="${W - 60}" cy="260" r="28" fill="#1B64DA" opacity="0.22"/>
  <circle cx="${W - 90}" cy="80" r="22" fill="#00C896" opacity="0.28"/>

  <!-- 우측 하단 큰 원 (시각 무게 균형) -->
  <circle cx="${W - 80}" cy="${H - 280}" r="120" fill="#1B64DA" opacity="0.08"/>
  <rect x="${W - 240}" y="${H - 350}" width="100" height="100" rx="24" fill="#FFB800" opacity="0.18" transform="rotate(-10 ${W - 190} ${H - 300})"/>

  <!-- 좌측 하단 작은 도형 -->
  <circle cx="120" cy="${H - 190}" r="44" fill="#00C896" opacity="0.16"/>
  <circle cx="60" cy="${H - 290}" r="20" fill="#FFB800" opacity="0.30"/>

  <!-- 시즌 라벨 (둥근 캡슐) — 상단 -->
  ${season ? `
  <rect x="80" y="100" width="${60 + season.length * 40}" height="84" rx="42" fill="#1B64DA"/>
  <text x="${80 + (60 + season.length * 40) / 2}" y="159" class="t-season" font-size="44" fill="white" text-anchor="middle">📅 ${season}</text>
  ` : ''}

  <!-- 메인 제목 (큰 폰트, 1~2줄) — stroke로 더 굵게 -->
  ${titleLines.map((line, i) =>
    `<text x="80" y="${titleStartY + i * titleLineHeight}" class="t-title" font-size="${titleFs}" fill="#0B1B3D" stroke="#0B1B3D" stroke-width="3" paint-order="stroke fill">${line}</text>`
  ).join('\n  ')}

  <!-- 골드 액센트 박스 — 보조 후킹 (메인보다 작게) -->
  ${bigStat ? `
  <rect x="80" y="${H - 350}" width="${60 + bigStat.length * 36}" height="106" rx="16" fill="#FFB800"/>
  <text x="${80 + (60 + bigStat.length * 36) / 2}" y="${H - 282}" class="t-sub" font-size="54" fill="#0B1B3D" font-weight="900" text-anchor="middle">${bigStat}</text>
  ` : ''}

  <!-- 시그니처 영역 -->
  <line x1="80" y1="${H - 200}" x2="${W - 80}" y2="${H - 200}" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="8 8"/>
  <text x="80" y="${H - 130}" class="t-sig" font-size="44" fill="#0B1B3D">💼 ${signature}</text>
  <text x="80" y="${H - 70}" class="t-brand" font-size="32" fill="#64748B">월급쟁이 재테크 노트</text>

  <!-- 우측 하단 화살표 모티프 (재테크 성장 시각) -->
  <g transform="translate(${W - 200} ${H - 130})">
    <circle cx="60" cy="20" r="48" fill="#1B64DA"/>
    <text x="60" y="38" font-family="Pretendard" font-weight="900" font-size="44" fill="white" text-anchor="middle">↗</text>
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 3안 — Motion Graphics (베이지 + 다크잉크 + 골드 + 레드)
// ─────────────────────────────────────────────────────────────
function svgTone3({ season, mainTitle, bigStat, statSubtitle, signature }) {
  // 호환을 위해 변수 이름 매핑
  const highlights = bigStat ? `${bigStat} (${statSubtitle})` : '';
  const titleFs = mainTitle.length <= 8 ? 120 : mainTitle.length <= 12 ? 100 : 84;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dot3" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="2" fill="#1A1A1A" fill-opacity="0.08"/>
    </pattern>
    <style>
      .t-title { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 900; letter-spacing: -4px; }
      .t-sub { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 800; letter-spacing: -1.5px; }
      .t-season { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 800; letter-spacing: -1px; }
      .t-sig { font-family: 'Pretendard', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-weight: 700; letter-spacing: -0.5px; }
    </style>
  </defs>

  <!-- 베이지 배경 + 도트 텍스처 -->
  <rect width="${W}" height="${H}" fill="#F0EBE0"/>
  <rect width="${W}" height="${H}" fill="url(#dot3)"/>

  <!-- 좌측 큰 따옴표 / 인용 강조 마크 (Motion Graphics 시그니처) -->
  <text x="60" y="180" font-family="serif" font-size="240" fill="#C8341A" font-weight="900" opacity="0.15">"</text>

  <!-- 우측 큰 골드 원 -->
  <circle cx="${W - 100}" cy="180" r="180" fill="#C99B2D" opacity="0.18"/>
  <circle cx="${W - 50}" cy="${H - 80}" r="80" fill="#C8341A" opacity="0.20"/>

  <!-- 시즌 (스티커 느낌, 살짝 회전) -->
  ${season ? `
  <g transform="translate(80 130) rotate(-3)">
    <rect x="0" y="0" width="${20 + season.length * 36}" height="64" rx="6" fill="#C8341A"/>
    <text x="${10 + (season.length * 36) / 2}" y="44" class="t-season" font-size="34" fill="#FAF6ED" text-anchor="middle">${season}</text>
  </g>
  ` : ''}

  <!-- 메인 제목 -->
  <text x="80" y="${season ? 320 : 280}" class="t-title" font-size="${titleFs}" fill="#1A1A1A">${mainTitle}</text>

  <!-- 핵심 숫자 강조 (도장 느낌, 살짝 회전) -->
  ${highlights ? `
  <g transform="translate(80 ${season ? 355 : 315})">
    <rect x="0" y="0" width="${highlights.length * 22 + 60}" height="86" rx="12" fill="#1A1A1A"/>
    <text x="30" y="58" class="t-sub" font-size="38" fill="#C99B2D">${highlights}</text>
  </g>
  ` : ''}

  <!-- 시그니처 (골드 스트라이프 위) -->
  <rect x="0" y="${H - 110}" width="${W}" height="6" fill="#C99B2D"/>
  <text x="80" y="${H - 50}" class="t-sig" font-size="30" fill="#1A1A1A">🍗 ${signature}</text>
  <text x="${W - 80}" y="${H - 50}" class="t-sig" font-size="26" fill="#5C5448" text-anchor="end">월급쟁이 재테크 노트</text>
</svg>`;
}

// SVG → PNG 변환
async function svgToPng(svg, outPath) {
  await sharp(Buffer.from(svg), { density: 200 })
    .png({ quality: 95 })
    .toFile(outPath);
}

// ========== 메인 ==========
(async () => {
  const slug = process.argv[2];
  const toneArg = process.argv[3] || 'all';
  if (!slug) {
    console.error('❌ 사용법: node finance-blog/generate-thumbnail.js <slug> [1|3|all]');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const content = extractContent(slug);
  console.log('📝 추출 내용:');
  console.log(`   season: ${content.season}`);
  console.log(`   title: ${content.mainTitle}`);
  console.log(`   bigStat: ${content.bigStat}`);
  console.log(`   statSubtitle: ${content.statSubtitle}`);
  console.log(`   signature: ${content.signature}`);
  console.log('');

  const variants = toneArg === 'all' ? ['1', '3'] : [toneArg];

  for (const tone of variants) {
    const svg = tone === '1' ? svgTone1(content) : svgTone3(content);
    const outPath = path.join(OUT_DIR, `${slug}-thumb-tone${tone}.png`);
    await svgToPng(svg, outPath);
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`✓ tone${tone}: ${path.relative(ROOT, outPath)} (${sizeKB}KB)`);
  }
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
