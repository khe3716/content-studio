// 재테크 블로그 TTS 생성 (Gemini Leda + 1.3배속)
// youtube-shorts/tts-config.json 의 보이스 잠금 설정 적용
// 사용법: node scripts/finance-team/generate-tts.js <slug>

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const TTS_CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'youtube-shorts', 'tts-config.json'), 'utf8')
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const slug = process.argv[2];
if (!slug) { console.error('❌ slug 인자 필요'); process.exit(1); }

const NARRATION_PATH = path.join(ROOT, 'finance-blog', 'drafts', `${slug}-narration.json`);
if (!fs.existsSync(NARRATION_PATH)) {
  console.error(`❌ narration JSON 없음: ${NARRATION_PATH}`);
  process.exit(1);
}
const narration = JSON.parse(fs.readFileSync(NARRATION_PATH, 'utf8'));

const PUBLIC_AUDIO_DIR = path.join(ROOT, 'finance-blog', 'remotion', 'public', 'audio');
fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bps = 16) {
  const byteRate = sampleRate * channels * (bps / 8);
  const blockAlign = channels * (bps / 8);
  const dataSize = pcm.length;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bps, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  pcm.copy(buf, 44);
  return buf;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateTtsRaw(text, voice) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: TTS_CONFIG.model,
        contents: [{ role: 'user', parts: [{ text: `${TTS_CONFIG.stylePrompt}\n\n${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          return Buffer.from(p.inlineData.data, 'base64');
        }
      }
      throw new Error('No audio returned');
    } catch (err) {
      last = err;
      const m = err.message || '';
      if (m.includes('429') || m.includes('quota') || m.includes('RESOURCE_EXHAUSTED')) {
        const wait = 25000 * attempt;
        process.stdout.write(`(429, ${wait/1000}s 대기) `);
        await sleep(wait);
        continue;
      }
      if (m.includes('500') || m.includes('internal')) {
        await sleep(3000);
        continue;
      }
      throw err;
    }
  }
  throw last;
}

function ffmpegAtempo(inPath, outPath, speed) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inPath, '-filter:a', `atempo=${speed}`, '-loglevel', 'error', outPath];
    const proc = spawn('ffmpeg', args);
    let err = '';
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(err.slice(0, 300))));
    proc.on('error', reject);
  });
}

function ffprobeDuration(filePath) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath];
    const proc = spawn('ffprobe', args);
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.on('close', code => code === 0 ? resolve(parseFloat(out.trim())) : reject());
  });
}

async function processVariant(key, text, speed, voice) {
  process.stdout.write(`🎙️  ${key} (${text.length}자) ... `);
  const pcm = await generateTtsRaw(text, voice);
  const wav = pcmToWav(pcm, TTS_CONFIG.sampleRate);
  const rawPath = path.join(PUBLIC_AUDIO_DIR, `${slug}-${key}-raw.wav`);
  fs.writeFileSync(rawPath, wav);
  const finalPath = path.join(PUBLIC_AUDIO_DIR, `${slug}-${key}.wav`);
  await ffmpegAtempo(rawPath, finalPath, speed);
  fs.unlinkSync(rawPath);
  const dur = await ffprobeDuration(finalPath);
  console.log(`✓ ${dur.toFixed(2)}s @ ${speed}x`);
  return { path: finalPath, duration: dur, durationFrames: Math.ceil(dur * 30) };
}

(async () => {
  const result = {};
  const speed = narration.speed || TTS_CONFIG.speed;
  const voice = narration.voice || TTS_CONFIG.voice;

  if (Array.isArray(narration.scenes) && narration.scenes.length) {
    // Scene mode — scene별 wav 생성 (sync 정확)
    for (const sc of narration.scenes) {
      if (!sc.id || !sc.text) continue;
      result[sc.id] = await processVariant(sc.id, sc.text, speed, voice);
    }
  } else {
    // Legacy mode — long / short 통짜
    if (narration.long)  result.long  = await processVariant('long',  narration.long,  speed, voice);
    if (narration.short) result.short = await processVariant('short', narration.short, speed, voice);
  }

  const metaPath = path.join(PUBLIC_AUDIO_DIR, `${slug}-meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n💾 ${path.relative(ROOT, metaPath)}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
