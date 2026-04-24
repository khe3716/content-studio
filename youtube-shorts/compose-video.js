// Compose final episode video — image + per-word subtitle + TTS audio
// Layout: base template (0~430) + subtitle area (430~720) + scene image (720~1920)
//
// Usage:
//   node youtube-shorts/compose-video.js [episodeId] [maxScene]
//   maxScene defaults to all scenes; e.g. 3 to test first 3 scenes

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { GlobalFonts, createCanvas, loadImage } = require('@napi-rs/canvas');

const ROOT = __dirname;
const FONT_DIR = path.join(ROOT, 'templates', 'fonts');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 B.ttf'), 'SB Aggro Bold');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SB 어그로 M.ttf'), 'SB Aggro Medium');

const W = 1080;
const H = 1920;
const SUB_Y_TOP = 430;
const SUB_Y_BOTTOM = 720;
const SUB_HEIGHT = SUB_Y_BOTTOM - SUB_Y_TOP;
const IMG_Y_TOP = 720;
const IMG_HEIGHT = H - IMG_Y_TOP; // 1200

const FPS = 30;
const SUB_COLOR = '#0F0F1A';
const SUB_FONT = 'SB Aggro Bold';

// ──────── Splitting Korean text into 어절 (words) ────────
function splitWords(text) {
  return text.split(/\s+/).filter(Boolean);
}

// ──────── Per-word timing distribution ────────
function distributeTimings(words, totalDuration) {
  // weight by visible character count (excluding punctuation)
  const weights = words.map((w) => {
    const stripped = w.replace(/[\.\,\?\!\(\)…"'']/g, '');
    return Math.max(1, stripped.length);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // Each word gets duration ≈ (its weight / total) * totalDuration.
  // Word i appears at the START of its slot (so the visual "onset" lines up
  // with when its first character is being spoken).
  const startTimes = [];
  let cur = 0;
  for (const w of weights) {
    startTimes.push(cur);
    cur += (w / totalWeight) * totalDuration;
  }
  return startTimes;
}

// ──────── Subtitle text rendering ────────
function fitSubtitleFontSize(ctx, lines, maxWidth, maxFontPx = 80, minFontPx = 38) {
  for (let fs = maxFontPx; fs >= minFontPx; fs -= 1) {
    ctx.font = `${fs}px "${SUB_FONT}"`;
    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxWidth) {
        fits = false;
        break;
      }
    }
    if (fits) return fs;
  }
  return minFontPx;
}

function wrapWords(ctx, words, maxWidth, sep = ' ') {
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + sep + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSubtitle(ctx, words) {
  if (words.length === 0) return;
  const maxWidth = W - 120;

  // Wrap with current font (start 76)
  ctx.font = `76px "${SUB_FONT}"`;
  let lines = wrapWords(ctx, words, maxWidth);
  const fs = fitSubtitleFontSize(ctx, lines, maxWidth, 76, 38);
  ctx.font = `${fs}px "${SUB_FONT}"`;
  lines = wrapWords(ctx, words, maxWidth);

  ctx.fillStyle = SUB_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = fs * 1.25;
  const blockHeight = lines.length * lineHeight;
  const startY = SUB_Y_TOP + (SUB_HEIGHT - blockHeight) / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * lineHeight);
  });
}

// ──────── Load assets ────────
async function loadEpisodeAssets(episodeId) {
  const baseImg = await loadImage(path.join(ROOT, 'templates', 'base.png'));
  const titleOverlayPath = path.join(ROOT, 'templates', episodeId, 'template_with_title.png');
  if (!fs.existsSync(titleOverlayPath)) {
    throw new Error(`Run apply-title.js for ${episodeId} first`);
  }
  const titleImg = await loadImage(titleOverlayPath);
  return { baseImg, titleImg };
}

// ──────── Render one frame (template + scene image + accumulated subtitle) ────────
async function renderFrame({ titleImg, sceneImg, words }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 1. Title-applied template (covers top portion already; rest is white)
  ctx.drawImage(titleImg, 0, 0, W, H);

  // 2. Scene image: cover the bottom area
  // sceneImg dims usually ~992x1056, fit to 1080x1200 with cover
  const srcW = sceneImg.width;
  const srcH = sceneImg.height;
  const targetW = W;
  const targetH = IMG_HEIGHT;
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;
  let drawW, drawH, dx, dy;
  if (srcAspect > targetAspect) {
    drawH = targetH;
    drawW = drawH * srcAspect;
    dx = (targetW - drawW) / 2;
    dy = 0;
  } else {
    drawW = targetW;
    drawH = drawW / srcAspect;
    dx = 0;
    dy = (targetH - drawH) / 2;
  }
  ctx.drawImage(sceneImg, dx, IMG_Y_TOP + dy, drawW, drawH);

  // 3. Subtitle words (accumulated)
  drawSubtitle(ctx, words);

  return canvas.toBuffer('image/png');
}

// ──────── FFmpeg helpers ────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { shell: false });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}\n${stderr.slice(-1500)}`));
    });
  });
}

async function ffprobeDuration(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { shell: false });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('close', () => {
      const dur = parseFloat(out.trim());
      if (!isNaN(dur)) resolve(dur);
      else reject(new Error(`Could not probe ${file}`));
    });
  });
}

// ──────── Compose ONE scene into MP4 ────────
async function composeScene({ scene, episodeId, titleImg, sceneTmpDir, sceneOutPath, audioPath }) {
  const sceneImgPath = path.join(ROOT, 'images', episodeId, `scene_${String(scene.n).padStart(2, '0')}.png`);
  const sceneImg = await loadImage(sceneImgPath);

  const audioDur = scene.audioDuration || (await ffprobeDuration(audioPath));
  const words = splitWords(scene.narration);

  // Edge case: empty narration like "..." → just one frame of nothing
  let frameStates;
  if (words.length === 0) {
    frameStates = [{ start: 0, words: [] }];
  } else {
    const starts = distributeTimings(words, audioDur);
    frameStates = words.map((_, i) => ({ start: starts[i], words: words.slice(0, i + 1) }));
  }

  // Render each frame state
  const framePaths = [];
  for (let i = 0; i < frameStates.length; i++) {
    const buf = await renderFrame({ titleImg, sceneImg, words: frameStates[i].words });
    const fp = path.join(sceneTmpDir, `state_${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(fp, buf);
    framePaths.push(fp);
  }

  // Build concat list with per-frame durations
  const listLines = [];
  for (let i = 0; i < frameStates.length; i++) {
    const start = frameStates[i].start;
    const end = i + 1 < frameStates.length ? frameStates[i + 1].start : audioDur;
    const dur = Math.max(0.05, end - start);
    listLines.push(`file '${framePaths[i].replace(/\\/g, '/')}'`);
    listLines.push(`duration ${dur.toFixed(3)}`);
  }
  // Last file repeated (concat demuxer requirement)
  listLines.push(`file '${framePaths[framePaths.length - 1].replace(/\\/g, '/')}'`);
  const listPath = path.join(sceneTmpDir, 'concat.txt');
  fs.writeFileSync(listPath, listLines.join('\n'));

  // Build video from PNG sequence + audio
  await runFfmpeg([
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-i', audioPath,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-vf', `scale=${W}:${H},fps=${FPS}`,
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    sceneOutPath,
  ]);
}

// ──────── Compose full episode ────────
async function composeEpisode(episodeId, maxScene) {
  const epPath = path.join(ROOT, 'episodes', `${episodeId}.json`);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));

  const scenesToProcess = maxScene ? episode.scenes.slice(0, maxScene) : episode.scenes;
  console.log(`Episode: ${episodeId}`);
  console.log(`Composing scenes 1..${scenesToProcess.length} of ${episode.scenes.length}`);

  const tmpRoot = path.join(ROOT, 'video-tmp', episodeId);
  if (!fs.existsSync(tmpRoot)) fs.mkdirSync(tmpRoot, { recursive: true });
  const outDir = path.join(ROOT, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const { titleImg } = await loadEpisodeAssets(episodeId);

  const sceneClips = [];
  for (const sc of scenesToProcess) {
    const num = String(sc.n).padStart(2, '0');
    const sceneTmpDir = path.join(tmpRoot, `scene_${num}`);
    if (!fs.existsSync(sceneTmpDir)) fs.mkdirSync(sceneTmpDir, { recursive: true });
    const audioPath = path.join(ROOT, 'tts', episodeId, 'scenes', `scene_${num}.wav`);
    const sceneOutPath = path.join(sceneTmpDir, `scene_${num}.mp4`);

    if (!fs.existsSync(audioPath)) {
      console.log(`  [${num}] missing audio, skip`);
      continue;
    }

    process.stdout.write(`  [${num}] composing... `);
    try {
      await composeScene({ scene: sc, episodeId, titleImg, sceneTmpDir, sceneOutPath, audioPath });
      sceneClips.push(sceneOutPath);
      console.log('✓');
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 200)}`);
    }
  }

  if (sceneClips.length === 0) throw new Error('No scenes composed');

  // Concat all scene MP4s
  const concatList = path.join(tmpRoot, 'episode_concat.txt');
  fs.writeFileSync(
    concatList,
    sceneClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
  );

  const finalSuffix = maxScene ? `_test_${maxScene}scenes` : '';
  const finalOut = path.join(outDir, `${episodeId}${finalSuffix}.mp4`);
  console.log(`\nConcatenating into ${finalOut}...`);
  await runFfmpeg([
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatList,
    '-c', 'copy',
    finalOut,
  ]);
  console.log(`✓ Done: ${finalOut}`);
  return finalOut;
}

if (require.main === module) {
  const epId = process.argv[2];
  const maxScene = process.argv[3] ? parseInt(process.argv[3], 10) : null;
  if (!epId) {
    console.error('Usage: node compose-video.js <episodeId> [maxScene]');
    process.exit(1);
  }
  composeEpisode(epId, maxScene).catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}
