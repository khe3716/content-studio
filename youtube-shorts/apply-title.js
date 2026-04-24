// Take user's base.png template, write episode title in the title area.
// Doesn't touch any other part of the design.
//
// Usage: node youtube-shorts/apply-title.js [episodeId]
//   episodeId defaults to most recent

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');

const ROOT = __dirname;
const BASE_PNG = path.join(ROOT, 'templates', 'base.png');
const FONT_DIR = path.join(ROOT, 'templates', 'fonts');
const EPISODES_DIR = path.join(ROOT, 'episodes');

// Register fonts
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 B.ttf'), 'SB Aggro Bold');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 M.ttf'), 'SB Aggro Medium');

// Title region (detected from base.png pixel sampling)
const W = 1080;
const H = 1920;
const TITLE_X = 80;            // left padding
const TITLE_REGION_TOP = 245;  // empty space starts after yellow strip
const TITLE_REGION_BOTTOM = 370; // ends at meta line top
const TITLE_REGION_HEIGHT = TITLE_REGION_BOTTOM - TITLE_REGION_TOP; // 125

// Title styling
const TITLE_COLOR = '#5A3005'; // dark brown — matches user's brand
const TITLE_MAX_WIDTH = W - TITLE_X * 2; // 920px

// Shrink-to-fit: find the largest font size where the title fits in ONE line
function fitFontSize(ctx, text, maxWidth, maxFontPx = 70, minFontPx = 28) {
  for (let fs = maxFontPx; fs >= minFontPx; fs -= 1) {
    ctx.font = `${fs}px "SB Aggro Bold"`;
    if (ctx.measureText(text).width <= maxWidth) return fs;
  }
  return minFontPx;
}

function renderTitleOverlay(title) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const fontPx = fitFontSize(ctx, title, TITLE_MAX_WIDTH, 70, 28);
  ctx.font = `${fontPx}px "SB Aggro Bold"`;

  // Vertical center the single line in the title region
  const y = TITLE_REGION_TOP + TITLE_REGION_HEIGHT / 2 + fontPx * 0.35;

  ctx.fillText(title, TITLE_X, y);

  return canvas.toBuffer('image/png');
}

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
  if (!fs.existsSync(BASE_PNG)) throw new Error(`Missing ${BASE_PNG}`);

  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));

  const titleOverlay = renderTitleOverlay(episode.video.title);

  const outDir = path.join(ROOT, 'templates', episode.id);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'template_with_title.png');

  await sharp(BASE_PNG)
    .composite([{ input: titleOverlay, top: 0, left: 0 }])
    .png()
    .toFile(outPath);

  console.log(`Episode: ${episode.id}`);
  console.log(`Title: ${episode.video.title}`);
  console.log(`✓ Saved: ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { renderTitleOverlay };
