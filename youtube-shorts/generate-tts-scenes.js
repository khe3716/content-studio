// Generate per-scene TTS audio (one wav per scene), using locked tts-config.json.
// This is what the video composer uses — exact audio length per image.
//
// Pipeline per scene:
//   1. Gemini TTS (voice from config) → raw PCM
//   2. Wrap as WAV
//   3. FFmpeg atempo=<speed> for speed adjustment (pitch preserved)
//   4. Probe duration → write back to episode JSON
//
// Usage: node youtube-shorts/generate-tts-scenes.js <episodeId>

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ROOT = __dirname;
const EPISODES_DIR = path.join(ROOT, 'episodes');
const TTS_BASE = path.join(ROOT, 'tts');
const CONFIG_PATH = path.join(ROOT, 'tts-config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

function pickEpisode(arg) {
  if (arg) {
    const p = path.join(EPISODES_DIR, `${arg}.json`);
    if (fs.existsSync(p)) return p;
    throw new Error(`Episode not found: ${arg}`);
  }
  const files = fs.readdirSync(EPISODES_DIR).filter((f) => f.startsWith('ep_') && f.endsWith('.json') && !f.includes('backup')).sort().reverse();
  return path.join(EPISODES_DIR, files[0]);
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
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
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  pcm.copy(buf, 44);
  return buf;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function geminiTts(text) {
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: config.model,
        contents: [{ role: 'user', parts: [{ text: `${config.stylePrompt}\n\n${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } },
          },
        },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) return Buffer.from(p.inlineData.data, 'base64');
      }
      throw new Error('No audio returned');
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        // Free tier: 3 RPM. Wait 25 seconds with exponential backoff
        const wait = 25000 * attempt;
        process.stdout.write(`(429, waiting ${wait / 1000}s) `);
        await sleep(wait);
        continue;
      }
      if (msg.includes('500') || msg.includes('internal')) {
        await sleep(3000);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function generateSilentWav(durationSec, sampleRate = 24000) {
  // Mono 16-bit silent PCM
  const samples = Math.floor(durationSec * sampleRate);
  const pcm = Buffer.alloc(samples * 2); // 16-bit = 2 bytes/sample
  return pcm;
}

function ffmpegAtempo(inPath, outPath, speed) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inPath, '-filter:a', `atempo=${speed}`, '-loglevel', 'error', outPath];
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => (code === 0 ? resolve(outPath) : reject(new Error(stderr.slice(0, 200)))));
    proc.on('error', reject);
  });
}

function ffprobeDuration(filePath) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath];
    const proc = spawn('ffprobe', args);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => (code === 0 ? resolve(parseFloat(out.trim())) : reject(new Error(err))));
    proc.on('error', reject);
  });
}

function isAtmosphericOnly(text) {
  // narration like "...", "(꿀꺽)", "두근..." may fail or produce odd TTS.
  // Treat pure punctuation/short atmospheric as silent or very short.
  const stripped = text.replace(/[\.\,\?\!\(\)\s…]/g, '');
  return stripped.length < 2;
}

async function generateSceneTts(scene, sceneDir) {
  const num = String(scene.n).padStart(2, '0');
  const rawWav = path.join(sceneDir, `__raw_${num}.wav`);
  const finalWav = path.join(sceneDir, `scene_${num}.wav`);

  if (fs.existsSync(finalWav)) {
    const dur = await ffprobeDuration(finalWav);
    return { path: finalWav, duration: dur, cached: true };
  }

  let pcm;
  if (isAtmosphericOnly(scene.narration)) {
    // Use silent placeholder matching the planned scene duration
    pcm = generateSilentWav(scene.duration || 2.5, config.sampleRate || 24000);
  } else {
    pcm = await geminiTts(scene.narration);
  }

  fs.writeFileSync(rawWav, pcmToWav(pcm, config.sampleRate || 24000));
  await ffmpegAtempo(rawWav, finalWav, config.speed);
  fs.unlinkSync(rawWav);
  const dur = await ffprobeDuration(finalWav);
  return { path: finalWav, duration: dur, cached: false };
}

async function main() {
  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));

  const sceneDir = path.join(TTS_BASE, episode.id, 'scenes');
  if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir, { recursive: true });

  console.log(`Episode: ${episode.id}`);
  console.log(`Voice: ${config.voice} @ ${config.speed}x`);
  console.log(`Scenes: ${episode.scenes.length}`);

  // Free tier: 3 RPM = 20s between calls. Use 21s to be safe.
  // Cached scenes skip the wait.
  const MIN_DELAY_MS = 21000;
  let lastApiCallAt = 0;

  let total = 0;
  for (const sc of episode.scenes) {
    process.stdout.write(`  [${String(sc.n).padStart(2, '0')}] "${sc.narration.slice(0, 30)}..." `);

    const num = String(sc.n).padStart(2, '0');
    const finalWav = path.join(sceneDir, `scene_${num}.wav`);
    const willCallApi = !fs.existsSync(finalWav) && !isAtmosphericOnly(sc.narration);

    if (willCallApi) {
      const elapsed = Date.now() - lastApiCallAt;
      if (lastApiCallAt > 0 && elapsed < MIN_DELAY_MS) {
        const wait = MIN_DELAY_MS - elapsed;
        process.stdout.write(`(rate-limit wait ${Math.round(wait / 1000)}s) `);
        await sleep(wait);
      }
      lastApiCallAt = Date.now();
    }

    try {
      const { duration, cached } = await generateSceneTts(sc, sceneDir);
      sc.audioDuration = parseFloat(duration.toFixed(3));
      total += duration;
      console.log(`✓ ${duration.toFixed(2)}s${cached ? ' (cached)' : ''}`);
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 100)}`);
    }
  }

  // Save updated episode (with audioDuration per scene)
  fs.writeFileSync(epPath, JSON.stringify(episode, null, 2));

  console.log(`\nTotal audio: ${total.toFixed(2)}s (${Math.floor(total / 60)}분 ${Math.round(total % 60)}초)`);
  console.log(`✓ Output: ${sceneDir}`);
  console.log(`✓ Episode JSON updated with audioDuration per scene.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { generateSceneTts };
