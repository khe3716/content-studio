// Generate template overlay PNGs (1080x1920) for shorts.
// Uses @napi-rs/canvas with locally bundled SB 어그로 fonts for exact font match.
//
// Output: templates/{epId}/template_with_hook.png and template_minimal.png
//   - Top: yellow bubble + white header (title) + (optional) white hook area
//   - Bottom: TRANSPARENT (AI animated video goes here)

const fs = require('fs');
const path = require('path');
const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');

const W = 1080;
const H = 1920;

const Y_BUBBLE_TOP = 30;
const Y_BUBBLE_HEIGHT = 90;
const HEADER_TOP = 150;
const HEADER_HEIGHT = 320;
const HOOK_TOP = 470;
const HOOK_HEIGHT = 380;

// ──────── Brand (matches the user's existing channel) ────────
const BRAND = {
  yellowText: '아니 근데 있잖아...',
  channelHandle: '달콤살랑',
  metaTime: '11:11',
  metaViews: '조회수 11,111,111',
};

// ──────── Register the SB 어그로 fonts ────────
const FONT_DIR = path.join(__dirname, 'templates', 'fonts');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 B.ttf'), 'SB Aggro Bold');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 M.ttf'), 'SB Aggro Medium');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 L.ttf'), 'SB Aggro Light');

// ──────── Helpers ────────
function fontSizeForTitle(title) {
  if (title.length <= 14) return 70;
  if (title.length <= 20) return 60;
  if (title.length <= 26) return 52;
  return 46;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const ch of text) {
    const test = current + ch;
    const w = ctx.measureText(test).width;
    if (w > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ──────── Drawing ────────
function drawTemplate({ title, includeHookArea }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 1. Yellow bubble strip background
  ctx.fillStyle = '#FBF4D8';
  ctx.fillRect(0, 0, W, Y_BUBBLE_TOP + Y_BUBBLE_HEIGHT + 30);

  // 2. Yellow bubble pill
  const bubbleW = 600;
  const bubbleX = (W - bubbleW) / 2;
  ctx.fillStyle = '#F5E8B8';
  drawRoundedRect(ctx, bubbleX, Y_BUBBLE_TOP, bubbleW, Y_BUBBLE_HEIGHT, 45);
  ctx.fill();
  ctx.strokeStyle = '#E0CC80';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Yellow bubble text
  ctx.fillStyle = '#3A2D14';
  ctx.font = '46px "SB Aggro Bold"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND.yellowText, W / 2, Y_BUBBLE_TOP + Y_BUBBLE_HEIGHT / 2);

  // 4. Header (white background with title + meta)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, HEADER_TOP, W, HEADER_HEIGHT);

  // Title (SB Aggro Bold, dark navy)
  const titleFs = fontSizeForTitle(title);
  ctx.font = `${titleFs}px "SB Aggro Bold"`;
  ctx.fillStyle = '#1F2842';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleMaxWidth = W - 160;
  const titleLines = wrapText(ctx, title, titleMaxWidth);
  const titleLineHeight = titleFs + 12;
  const titleStartY = HEADER_TOP + (HEADER_HEIGHT - 60 - titleLines.length * titleLineHeight) / 2 + titleFs;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 80, titleStartY + i * titleLineHeight);
  });

  // Meta line (medium)
  ctx.font = '32px "SB Aggro Medium"';
  ctx.fillStyle = '#9A9A9A';
  ctx.fillText(
    `${BRAND.channelHandle}  |  ${BRAND.metaTime}  |  ${BRAND.metaViews}`,
    80,
    HEADER_TOP + HEADER_HEIGHT - 30,
  );

  // 5. Hook white area (optional)
  if (includeHookArea) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, HOOK_TOP, W, HOOK_HEIGHT);
  }

  // 6. Bottom area stays transparent

  return canvas.toBuffer('image/png');
}

// ──────── Episode picker ────────
const EPISODES_DIR = path.join(__dirname, 'episodes');

function pickEpisode(arg) {
  if (arg) {
    const p = path.join(EPISODES_DIR, `${arg}.json`);
    if (fs.existsSync(p)) return p;
    throw new Error(`Episode not found: ${arg}`);
  }
  const files = fs.readdirSync(EPISODES_DIR)
    .filter((f) => f.startsWith('ep_') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No episodes found');
  return path.join(EPISODES_DIR, files[0]);
}

async function main() {
  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const tplDir = path.join(__dirname, 'templates', episode.id);
  if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });

  console.log(`Episode: ${episode.id}`);
  console.log(`Title: ${episode.video.title}`);
  console.log(`Font: SB 어그로 Bold`);

  const tplWithHook = path.join(tplDir, 'template_with_hook.png');
  fs.writeFileSync(tplWithHook, drawTemplate({ title: episode.video.title, includeHookArea: true }));
  console.log(`  ✓ ${tplWithHook}`);

  const tplMinimal = path.join(tplDir, 'template_minimal.png');
  fs.writeFileSync(tplMinimal, drawTemplate({ title: episode.video.title, includeHookArea: false }));
  console.log(`  ✓ ${tplMinimal}`);

  console.log(`\n구조 (1080x1920):`);
  console.log(`  ─ 0~150px:   노란 말풍선 영역 (FIXED)`);
  console.log(`  ─ 150~470:   흰 헤더 (TITLE 가변)`);
  console.log(`  ─ 470~850:   흰 hook 영역 (with_hook 버전만)`);
  console.log(`  ─ 850~1920:  TRANSPARENT (AI 영상 자리)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { drawTemplate, BRAND };
