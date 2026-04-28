// Carnation + Gold Mango Gift Set — Detail Page Builder
// Style: 카네이션 로즈 + 망고 골드 팔레트 (어버이날 시즌 한정)
// Rules: 가격 X · 도착일 X · 사용자 사진만

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const W = 600;
const SRC = path.join(__dirname, '../../source-photos/carnation-mango-set');
const OUT = __dirname;

// --- Color palette (carnation rose + mango gold) ---
const c = {
  bg: '#FFF8F0',
  bg_emphasis: '#FCE8DD',
  bg_dark: '#3A2A2D',
  card: '#FFFFFF',
  border: '#EFD8CD',
  brand: '#D4818F',          // carnation rose
  brand_deep: '#B05E73',
  highlight: '#F2C75C',      // mango gold
  highlight_soft: '#FFF1D0',
  dark: '#3A2A2D',
  sub: '#6B5158',
  muted: '#B59999',
  white: '#FFFFFF',
};

const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', serif";

// Photo mapping (decided after photo audit)
const PHOTOS = {
  hero: 'KakaoTalk_20260424_101935337_12.jpg',     // top-down full composition (changed)
  composition: 'KakaoTalk_20260424_101935337_03.jpg', // box + black box + flowers + 보자기
  config_top: 'KakaoTalk_20260424_101935337_10.jpg',  // top-down composition
  carnation: 'KakaoTalk_20260424_101935337_13.jpg',   // carnation row + mango cuts (changed)
  cuts1: 'KakaoTalk_20260424_101935337_15.jpg',       // cube cuts close
  cuts2: 'KakaoTalk_20260424_101935337_21.jpg',       // mango plated dessert (changed)
  black_box: 'KakaoTalk_20260424_101935337.jpg',      // black sunbeams box
  wrap: 'KakaoTalk_20260424_101935337_06.jpg',        // box angle
  gallery1: 'KakaoTalk_20260424_101935337_07.jpg',    // flowers + mango macro
  gallery2: 'KakaoTalk_20260424_101935337_03.jpg',    // box + black box + 보자기
  gallery3: 'KakaoTalk_20260424_101935337_11.jpg',    // top-down box + open lid + 보자기
};

// --- Helpers ---
async function makeRoundedPhoto(file, w, h, radius = 16) {
  const src = path.join(SRC, file);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );
  return sharp(src)
    .resize(w, h, { fit: 'cover', position: 'center' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function makeStyledHero(file, w, h, radius = 20, vignetteIntensity = 0.30) {
  const src = path.join(SRC, file);
  // saturate + contrast + sharpen + vignette (warm hero treatment)
  const base = await sharp(src)
    .resize(w, h, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 1.04, saturation: 1.32, hue: 5 })
    .linear(1.08, -8)
    .sharpen({ sigma: 0.7 })
    .toBuffer();

  const vignette = Buffer.from(
    `<svg width="${w}" height="${h}">
      <defs>
        <radialGradient id="v" cx="50%" cy="50%" r="72%">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="55%" stop-color="black" stop-opacity="0"/>
          <stop offset="100%" stop-color="black" stop-opacity="${vignetteIntensity}"/>
        </radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#v)"/>
    </svg>`
  );

  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );

  return sharp(base)
    .composite([
      { input: vignette, blend: 'over' },
      { input: mask, blend: 'dest-in' },
    ])
    .png()
    .toBuffer();
}

function svgBuf(svg) {
  return Buffer.from(svg);
}

// --- Section builders ---
async function buildHero() {
  const H = 760;
  const photoW = 520, photoH = 380;
  const photoX = 40, photoY = 320;

  const heroPhoto = await makeStyledHero(PHOTOS.hero, photoW, photoH, 18, 0.32);

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <!-- eyebrow pill -->
      <rect x="40" y="60" width="180" height="34" rx="17" fill="${c.brand}"/>
      <text x="130" y="82" font-family="${FONT}" font-size="13" fill="${c.white}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">SPECIAL EDITION</text>

      <!-- 시즌 한정 배지 -->
      <text x="40" y="148" font-family="${SERIF}" font-size="14" fill="${c.brand_deep}"
            font-weight="700" letter-spacing="3">2026 · CARNATION × MANGO</text>

      <!-- H1 -->
      <text x="40" y="200" font-family="${FONT}" font-size="32" fill="${c.dark}"
            font-weight="900" letter-spacing="-1">생화 카네이션 +</text>
      <text x="40" y="244" font-family="${FONT}" font-size="32" fill="${c.brand_deep}"
            font-weight="900" letter-spacing="-1">골드망고 6과 선물세트</text>

      <!-- subtitle -->
      <text x="40" y="284" font-family="${FONT}" font-size="14" fill="${c.sub}"
            font-weight="500" letter-spacing="-0.3">한 박스에 담은 두 가지 마음 — 향기와 단맛</text>
    </svg>
  `;

  return sharp(svgBuf(svg))
    .composite([{ input: heroPhoto, top: photoY, left: photoX }])
    .png()
    .toBuffer();
}

async function buildHook() {
  const H = 580;

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <rect x="218" y="60" width="164" height="32" rx="16" fill="${c.bg_emphasis}"/>
      <text x="300" y="81" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">WHY THIS YEAR</text>

      <!-- H1 centered -->
      <text x="300" y="158" font-family="${FONT}" font-size="28" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.8">올해는, 말로 하지 마세요</text>

      <text x="300" y="200" font-family="${FONT}" font-size="14" fill="${c.sub}"
            font-weight="500" text-anchor="middle">매년 똑같은 인사 대신,</text>
      <text x="300" y="222" font-family="${FONT}" font-size="14" fill="${c.sub}"
            font-weight="500" text-anchor="middle">손에 닿는 마음 한 박스.</text>

      <!-- card 1: carnation -->
      <rect x="40" y="270" width="240" height="240" rx="16" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <rect x="40" y="270" width="6" height="240" rx="3" fill="${c.brand}"/>
      <text x="60" y="310" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" letter-spacing="2">FLOWER</text>
      <text x="60" y="346" font-family="${FONT}" font-size="20" fill="${c.dark}"
            font-weight="900">생화 카네이션</text>
      <text x="60" y="380" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">시들지 않는 인공 꽃이</text>
      <text x="60" y="402" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">아닌, 진짜 향기와 결.</text>
      <text x="60" y="446" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700">받는 순간 분위기가</text>
      <text x="60" y="468" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700">달라지는 한 묶음.</text>

      <!-- card 2: mango -->
      <rect x="320" y="270" width="240" height="240" rx="16" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <rect x="320" y="270" width="6" height="240" rx="3" fill="${c.highlight}"/>
      <text x="340" y="310" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" letter-spacing="2">FRUIT</text>
      <text x="340" y="346" font-family="${FONT}" font-size="20" fill="${c.dark}"
            font-weight="900">골드망고 6과</text>
      <text x="340" y="380" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">한 입에 무너지는 결,</text>
      <text x="340" y="402" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">진하게 차오르는 단맛.</text>
      <text x="340" y="446" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700">자식 표정 대신,</text>
      <text x="340" y="468" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700">엄마 표정이 바뀌는 맛.</text>
    </svg>
  `;

  return sharp(svgBuf(svg)).png().toBuffer();
}

async function buildKairos() {
  const H = 320;
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.brand}"/>

      <text x="300" y="68" font-family="${FONT}" font-size="11" fill="${c.white}"
            font-weight="700" text-anchor="middle" letter-spacing="3" opacity="0.85">PRE-ORDER</text>

      <text x="300" y="120" font-family="${FONT}" font-size="22" fill="${c.white}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.5">예약 발주 — 5월 3일까지</text>

      <text x="300" y="160" font-family="${FONT}" font-size="14" fill="${c.white}"
            font-weight="500" text-anchor="middle" opacity="0.92">생화 카네이션이 들어가는 한정 구성</text>
      <text x="300" y="184" font-family="${FONT}" font-size="14" fill="${c.white}"
            font-weight="500" text-anchor="middle" opacity="0.92">수량 모두 채워지는 즉시 마감됩니다</text>

      <rect x="190" y="220" width="220" height="44" rx="22" fill="${c.white}"/>
      <text x="300" y="248" font-family="${FONT}" font-size="13" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2">5 · 3  ORDER DEADLINE</text>
    </svg>
  `;
  return sharp(svgBuf(svg)).png().toBuffer();
}

async function buildComposition() {
  const H = 800;
  const photoW = 520, photoH = 480;
  const photo = await makeRoundedPhoto(PHOTOS.composition, photoW, photoH, 18);

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <rect x="200" y="50" width="200" height="32" rx="16" fill="${c.bg_emphasis}"/>
      <text x="300" y="71" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">FULL COMPOSITION</text>

      <text x="300" y="130" font-family="${FONT}" font-size="26" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.6">받는 순간 모든 게 다 있는 한 박스</text>
    </svg>
  `;

  const captionSvg = `
    <svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="120" fill="${c.bg}"/>
      <rect x="220" y="14" width="160" height="26" rx="13" fill="${c.brand}"/>
      <text x="300" y="32" font-family="${FONT}" font-size="11" fill="${c.white}"
            font-weight="800" text-anchor="middle" letter-spacing="2">예약발주상품</text>
      <text x="300" y="64" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700" text-anchor="middle">생화카네이션 + 골드망고 6과 + 선물세트포장</text>
      <text x="300" y="86" font-family="${FONT}" font-size="13" fill="${c.dark}"
            font-weight="700" text-anchor="middle">+ 보자기동봉 + 외피박스포장</text>
      <text x="300" y="110" font-family="${FONT}" font-size="11" fill="${c.muted}"
            font-weight="500" text-anchor="middle" letter-spacing="2">CARNATION · MANGO 6P · GIFT WRAP</text>
    </svg>
  `;

  return sharp(svgBuf(svg))
    .composite([
      { input: photo, top: 170, left: 40 },
      { input: svgBuf(captionSvg), top: 660, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function buildPoint01() {
  const H = 720;
  const photo = await makeRoundedPhoto(PHOTOS.carnation, 520, 380, 16);
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg_emphasis}"/>

      <text x="40" y="70" font-family="${SERIF}" font-size="64" fill="${c.brand}"
            font-weight="900" letter-spacing="-2">01</text>
      <rect x="40" y="80" width="40" height="3" fill="${c.brand}"/>

      <text x="40" y="124" font-family="${FONT}" font-size="11" fill="${c.brand_deep}"
            font-weight="800" letter-spacing="3">POINT</text>

      <text x="40" y="170" font-family="${FONT}" font-size="24" fill="${c.dark}"
            font-weight="900" letter-spacing="-0.6">시들지 않는 마음이 아닌,</text>
      <text x="40" y="202" font-family="${FONT}" font-size="24" fill="${c.brand_deep}"
            font-weight="900" letter-spacing="-0.6">진짜 향기로 전합니다</text>

      <text x="40" y="246" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">받는 분 손에 닿을 때까지</text>
      <text x="40" y="266" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">싱그러운 결을 유지하도록</text>
      <text x="40" y="286" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500">발송 직전 손질해 동봉합니다.</text>
    </svg>
  `;
  return sharp(svgBuf(svg))
    .composite([{ input: photo, top: 320, left: 40 }])
    .png()
    .toBuffer();
}

async function buildPoint02() {
  const H = 720;
  const photo = await makeRoundedPhoto(PHOTOS.config_top, 520, 380, 16);
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <text x="${W - 40}" y="70" font-family="${SERIF}" font-size="64" fill="${c.highlight}"
            font-weight="900" letter-spacing="-2" text-anchor="end">02</text>
      <rect x="${W - 80}" y="80" width="40" height="3" fill="${c.highlight}"/>

      <text x="${W - 40}" y="124" font-family="${FONT}" font-size="11" fill="${c.brand_deep}"
            font-weight="800" letter-spacing="3" text-anchor="end">POINT</text>

      <text x="${W - 40}" y="170" font-family="${FONT}" font-size="24" fill="${c.dark}"
            font-weight="900" letter-spacing="-0.6" text-anchor="end">한 알 한 알 직접 골라</text>
      <text x="${W - 40}" y="202" font-family="${FONT}" font-size="24" fill="${c.brand_deep}"
            font-weight="900" letter-spacing="-0.6" text-anchor="end">6과를 정직하게 채웁니다</text>

      <text x="${W - 40}" y="246" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500" text-anchor="end">크기·색·결을 고루 살펴</text>
      <text x="${W - 40}" y="266" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500" text-anchor="end">덜 익은 것·흠집 있는 것은</text>
      <text x="${W - 40}" y="286" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500" text-anchor="end">담지 않습니다.</text>
    </svg>
  `;
  return sharp(svgBuf(svg))
    .composite([{ input: photo, top: 320, left: 40 }])
    .png()
    .toBuffer();
}

async function buildCuts() {
  const H = 720;
  const cut1 = await makeRoundedPhoto(PHOTOS.cuts1, 250, 320, 14);
  const cut2 = await makeRoundedPhoto(PHOTOS.cuts2, 250, 320, 14);

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <rect x="218" y="60" width="164" height="32" rx="16" fill="${c.bg_emphasis}"/>
      <text x="300" y="81" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">THE TASTE</text>

      <text x="300" y="148" font-family="${FONT}" font-size="26" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.6">한 입에 무너지는 결</text>

      <text x="300" y="186" font-family="${FONT}" font-size="13" fill="${c.sub}"
            font-weight="500" text-anchor="middle">사진 그대로의 진한 골드와 단맛</text>

      <text x="165" y="565" font-family="${FONT}" font-size="11" fill="${c.muted}"
            font-weight="600" text-anchor="middle" letter-spacing="2">큐브컷 · 한 입 큰 한 조각</text>
      <text x="435" y="565" font-family="${FONT}" font-size="11" fill="${c.muted}"
            font-weight="600" text-anchor="middle" letter-spacing="2">그릇 위 · 한 그릇 디저트</text>

      <rect x="40" y="600" width="520" height="50" rx="25" fill="${c.highlight_soft}"/>
      <text x="300" y="631" font-family="${FONT}" font-size="14" fill="${c.dark}"
            font-weight="700" text-anchor="middle">그대로 한 조각, 그릇에 담아도 한 그릇이 되는 단맛</text>
    </svg>
  `;

  return sharp(svgBuf(svg))
    .composite([
      { input: cut1, top: 220, left: 40 },
      { input: cut2, top: 220, left: 310 },
    ])
    .png()
    .toBuffer();
}

async function buildPoint03() {
  const H = 800;
  const blackBox = await makeRoundedPhoto(PHOTOS.black_box, 250, 250, 14);
  const wrap = await makeRoundedPhoto(PHOTOS.wrap, 250, 250, 14);

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg_dark}"/>

      <text x="40" y="70" font-family="${SERIF}" font-size="64" fill="${c.highlight}"
            font-weight="900" letter-spacing="-2">03</text>
      <rect x="40" y="80" width="40" height="3" fill="${c.highlight}"/>

      <text x="40" y="124" font-family="${FONT}" font-size="11" fill="${c.highlight}"
            font-weight="800" letter-spacing="3">POINT</text>

      <text x="40" y="170" font-family="${FONT}" font-size="24" fill="${c.white}"
            font-weight="900" letter-spacing="-0.6">받는 그대로</text>
      <text x="40" y="202" font-family="${FONT}" font-size="24" fill="${c.highlight}"
            font-weight="900" letter-spacing="-0.6">선물이 되는 패키지</text>

      <text x="40" y="246" font-family="${FONT}" font-size="13" fill="#D5C4BD"
            font-weight="500">검은 외피박스 + 흰 내부박스 + 보자기까지</text>
      <text x="40" y="266" font-family="${FONT}" font-size="13" fill="#D5C4BD"
            font-weight="500">따로 포장할 필요 없이 그대로 전달됩니다.</text>

      <text x="165" y="640" font-family="${FONT}" font-size="11" fill="${c.highlight}"
            font-weight="700" text-anchor="middle" letter-spacing="2">SUNBEAMS BOX</text>
      <text x="165" y="664" font-family="${FONT}" font-size="13" fill="${c.white}"
            font-weight="600" text-anchor="middle">외피 기프트 박스</text>

      <text x="435" y="640" font-family="${FONT}" font-size="11" fill="${c.highlight}"
            font-weight="700" text-anchor="middle" letter-spacing="2">WRAPPING</text>
      <text x="435" y="664" font-family="${FONT}" font-size="13" fill="${c.white}"
            font-weight="600" text-anchor="middle">보자기 동봉</text>

      <rect x="40" y="710" width="520" height="50" rx="25" fill="rgba(255,255,255,0.08)"/>
      <text x="300" y="741" font-family="${FONT}" font-size="13" fill="${c.white}"
            font-weight="600" text-anchor="middle" opacity="0.92">검은 외피박스 · 흰 내부박스 · 보자기까지 — 그대로 전달</text>
    </svg>
  `;

  return sharp(svgBuf(svg))
    .composite([
      { input: blackBox, top: 360, left: 40 },
      { input: wrap, top: 360, left: 310 },
    ])
    .png()
    .toBuffer();
}

async function buildWho() {
  const H = 660;
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <rect x="220" y="60" width="160" height="32" rx="16" fill="${c.bg_emphasis}"/>
      <text x="300" y="81" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">WHO IT'S FOR</text>

      <text x="300" y="148" font-family="${FONT}" font-size="26" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.6">이런 분께 보내드립니다</text>

      <!-- 4 cards 2x2 -->
      <rect x="40" y="200" width="250" height="180" rx="14" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <circle cx="68" cy="232" r="14" fill="${c.brand}"/>
      <text x="68" y="237" font-family="${FONT}" font-size="13" fill="${c.white}" font-weight="900" text-anchor="middle">01</text>
      <text x="92" y="237" font-family="${FONT}" font-size="14" fill="${c.dark}" font-weight="800">어머니 · 어머님</text>
      <text x="64" y="280" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">매년 같은 인사 대신,</text>
      <text x="64" y="302" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">이번엔 손에 닿는 마음.</text>

      <rect x="310" y="200" width="250" height="180" rx="14" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <circle cx="338" cy="232" r="14" fill="${c.brand}"/>
      <text x="338" y="237" font-family="${FONT}" font-size="13" fill="${c.white}" font-weight="900" text-anchor="middle">02</text>
      <text x="362" y="237" font-family="${FONT}" font-size="14" fill="${c.dark}" font-weight="800">은사 · 멘토</text>
      <text x="334" y="280" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">고마움을 직접 말하긴</text>
      <text x="334" y="302" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">쑥스러운 그분께.</text>

      <rect x="40" y="400" width="250" height="180" rx="14" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <circle cx="68" cy="432" r="14" fill="${c.brand}"/>
      <text x="68" y="437" font-family="${FONT}" font-size="13" fill="${c.white}" font-weight="900" text-anchor="middle">03</text>
      <text x="92" y="437" font-family="${FONT}" font-size="14" fill="${c.dark}" font-weight="800">거래처 · VIP</text>
      <text x="64" y="480" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">시즌 인사가 필요한,</text>
      <text x="64" y="502" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">격을 갖춘 한 박스.</text>

      <rect x="310" y="400" width="250" height="180" rx="14" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>
      <circle cx="338" cy="432" r="14" fill="${c.brand}"/>
      <text x="338" y="437" font-family="${FONT}" font-size="13" fill="${c.white}" font-weight="900" text-anchor="middle">04</text>
      <text x="362" y="437" font-family="${FONT}" font-size="14" fill="${c.dark}" font-weight="800">시부모 · 친정</text>
      <text x="334" y="480" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">멀리 있어 직접 못 가는</text>
      <text x="334" y="502" font-family="${FONT}" font-size="13" fill="${c.sub}" font-weight="500">날, 대신 가는 한 묶음.</text>
    </svg>
  `;
  return sharp(svgBuf(svg)).png().toBuffer();
}

async function buildGallery() {
  const H = 480;
  const g1 = await makeRoundedPhoto(PHOTOS.gallery1, 168, 220, 12);
  const g2 = await makeRoundedPhoto(PHOTOS.gallery2, 168, 220, 12);
  const g3 = await makeRoundedPhoto(PHOTOS.gallery3, 168, 220, 12);

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg_emphasis}"/>

      <text x="300" y="74" font-family="${FONT}" font-size="11" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="3">GALLERY</text>
      <text x="300" y="120" font-family="${FONT}" font-size="22" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.5">실제 받으시는 모습입니다</text>
    </svg>
  `;
  return sharp(svgBuf(svg))
    .composite([
      { input: g1, top: 170, left: 40 },
      { input: g2, top: 170, left: 216 },
      { input: g3, top: 170, left: 392 },
    ])
    .png()
    .toBuffer();
}

async function buildNotice() {
  const H = 380;
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.bg}"/>

      <rect x="220" y="50" width="160" height="32" rx="16" fill="${c.bg_emphasis}"/>
      <text x="300" y="71" font-family="${FONT}" font-size="12" fill="${c.brand_deep}"
            font-weight="800" text-anchor="middle" letter-spacing="2.5">PRE-ORDER NOTICE</text>

      <text x="300" y="124" font-family="${FONT}" font-size="20" fill="${c.dark}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.5">예약 발주 안내</text>

      <rect x="40" y="160" width="520" height="180" rx="14" fill="${c.card}" stroke="${c.border}" stroke-width="1"/>

      <circle cx="64" cy="192" r="6" fill="${c.brand}"/>
      <text x="80" y="197" font-family="${FONT}" font-size="13" fill="${c.dark}" font-weight="700">생화 카네이션이 들어가는 한정 구성입니다</text>

      <circle cx="64" cy="222" r="6" fill="${c.brand}"/>
      <text x="80" y="227" font-family="${FONT}" font-size="13" fill="${c.dark}" font-weight="700">5월 3일까지 주문 마감, 수량 채워지면 조기 마감</text>

      <circle cx="64" cy="252" r="6" fill="${c.brand}"/>
      <text x="80" y="257" font-family="${FONT}" font-size="13" fill="${c.dark}" font-weight="700">발송은 카네이션 신선도를 위해 마감 직후 순차 진행</text>

      <circle cx="64" cy="282" r="6" fill="${c.brand}"/>
      <text x="80" y="287" font-family="${FONT}" font-size="13" fill="${c.dark}" font-weight="700">택배 일정은 플랫폼 안내·문의에서 확인해 주세요</text>

      <circle cx="64" cy="312" r="6" fill="${c.brand}"/>
      <text x="80" y="317" font-family="${FONT}" font-size="13" fill="${c.dark}" font-weight="700">신선도 특성상 단순 변심 교환·환불 어려운 점 양해 부탁드립니다</text>
    </svg>
  `;
  return sharp(svgBuf(svg)).png().toBuffer();
}

async function buildCTA() {
  const H = 520;
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${c.brand}"/>

      <text x="300" y="80" font-family="${FONT}" font-size="11" fill="${c.white}"
            font-weight="700" text-anchor="middle" letter-spacing="3" opacity="0.85">FINAL</text>

      <text x="300" y="138" font-family="${FONT}" font-size="26" fill="${c.white}"
            font-weight="900" text-anchor="middle" letter-spacing="-0.6">올해는 한 박스로 충분합니다</text>

      <text x="300" y="178" font-family="${FONT}" font-size="14" fill="${c.white}"
            font-weight="500" text-anchor="middle" opacity="0.92">진짜 카네이션 향, 진짜 골드망고 단맛</text>
      <text x="300" y="200" font-family="${FONT}" font-size="14" fill="${c.white}"
            font-weight="500" text-anchor="middle" opacity="0.92">한 박스에 두 가지 마음을 담았습니다</text>

      <!-- 구성 안내 (가격 미표시) -->
      <rect x="80" y="250" width="440" height="60" rx="12" fill="${c.white}"/>
      <text x="100" y="287" font-family="${FONT}" font-size="13" fill="${c.brand_deep}" font-weight="900">구성</text>
      <text x="160" y="287" font-family="${FONT}" font-size="15" fill="${c.dark}" font-weight="700">생화카네이션 + 골드망고 6과 + 보자기</text>

      <rect x="80" y="320" width="440" height="60" rx="12" fill="${c.white}"/>
      <text x="100" y="357" font-family="${FONT}" font-size="13" fill="${c.brand_deep}" font-weight="900">마감</text>
      <text x="160" y="357" font-family="${FONT}" font-size="15" fill="${c.dark}" font-weight="700">5월 3일까지 · 수량 채워지면 조기 마감</text>

      <!-- 안내 띠 -->
      <rect x="80" y="410" width="440" height="44" rx="22" fill="${c.white}" opacity="0.95"/>
      <text x="300" y="438" font-family="${FONT}" font-size="13" fill="${c.brand_deep}"
            font-weight="700" text-anchor="middle">▼ 가격·결제는 아래 상품옵션에서 진행해주세요</text>

      <text x="300" y="490" font-family="${FONT}" font-size="11" fill="${c.white}"
            font-weight="600" text-anchor="middle" letter-spacing="3" opacity="0.7">SUNBEAMS · CARNATION × MANGO</text>
    </svg>
  `;
  return sharp(svgBuf(svg)).png().toBuffer();
}

// --- Main composer ---
(async () => {
  console.log('Building carnation-mango-set detail page...');

  const sections = [
    await buildHero(),
    await buildHook(),
    await buildKairos(),
    await buildComposition(),
    await buildPoint01(),
    await buildPoint02(),
    await buildCuts(),
    await buildPoint03(),
    await buildWho(),
    await buildGallery(),
    await buildNotice(),
    await buildCTA(),
  ];

  // measure heights
  const meta = await Promise.all(sections.map((b) => sharp(b).metadata()));
  const totalH = meta.reduce((sum, m) => sum + m.height, 0);

  console.log(`Total height: ${totalH}px`);

  // compose vertically
  let y = 0;
  const composites = sections.map((buf, i) => {
    const out = { input: buf, top: y, left: 0 };
    y += meta[i].height;
    return out;
  });

  await sharp({
    create: {
      width: W,
      height: totalH,
      channels: 4,
      background: { r: 255, g: 248, b: 240, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(OUT, 'carnation-mango-set-final.png'));

  console.log('✅ Saved: carnation-mango-set-final.png');

  // also save section previews
  for (let i = 0; i < sections.length; i++) {
    await sharp(sections[i])
      .png()
      .toFile(path.join(OUT, `section-${String(i + 1).padStart(2, '0')}.png`));
  }
  console.log('✅ Section previews saved');
})();
