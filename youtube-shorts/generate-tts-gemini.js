// Generate TTS using Gemini 2.5 Native TTS — far more natural than Edge TTS.
// Uses the existing GEMINI_API_KEY.
//
// Usage:
//   node youtube-shorts/generate-tts-gemini.js <episodeId>           — multi-voice comparison
//   node youtube-shorts/generate-tts-gemini.js <episodeId> <voice>   — single voice (final)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash-preview-tts';

const EPISODES_DIR = path.join(__dirname, 'episodes');
const TTS_BASE = path.join(__dirname, 'tts');

// Gemini TTS prebuilt voices (from official docs).
// Picked female-leaning ones suitable for 달콤설렘썰 Korean teen romance narration.
const VOICES = [
  { id: 'Kore', label: 'A. Kore — 단단하고 또렷한 톤 (firm)' },
  { id: 'Aoede', label: 'B. Aoede — 산뜻하고 가벼운 톤 (breezy)' },
  { id: 'Leda', label: 'C. Leda — 어리고 발랄한 톤 (youthful)' },
  { id: 'Callirrhoe', label: 'D. Callirrhoe — 편안한 톤 (easy-going)' },
  { id: 'Autonoe', label: 'E. Autonoe — 밝은 톤 (bright)' },
  { id: 'Zephyr', label: 'F. Zephyr — 밝고 가벼운 톤 (bright)' },
];

// Style prompt prepended to text. Gemini TTS supports natural-language style direction.
const STYLE_PROMPT = `다음 대본을 한국 20대 초반 여성이 친구한테 썰 푸는 것처럼 자연스럽게, 약간 들뜬 듯 설레는 톤으로 읽어줘. 너무 단조롭지 않게 감정 실어서:`;

function pickEpisode(arg) {
  if (arg) {
    const p = path.join(EPISODES_DIR, `${arg}.json`);
    if (fs.existsSync(p)) return p;
    throw new Error(`Episode not found: ${arg}`);
  }
  const files = fs.readdirSync(EPISODES_DIR).filter((f) => f.startsWith('ep_') && f.endsWith('.json') && !f.includes('backup')).sort().reverse();
  if (files.length === 0) throw new Error('No episodes found');
  return path.join(EPISODES_DIR, files[0]);
}

function buildFullText(episode) {
  return episode.scenes.map((sc) => sc.narration.trim()).join(' ');
}

// Gemini returns raw PCM 16-bit mono @ 24kHz. Wrap in WAV header for playability.
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

async function generateTts({ text, voice, outPath }) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `${STYLE_PROMPT}\n\n${text}` }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      const wav = pcmToWav(pcm);
      fs.writeFileSync(outPath, wav);
      return outPath;
    }
  }
  throw new Error('No audio returned from Gemini TTS');
}

async function main() {
  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const singleVoice = process.argv[3];

  const outDir = path.join(TTS_BASE, episode.id);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const text = buildFullText(episode);
  console.log(`Episode: ${episode.id}`);
  console.log(`Total chars: ${text.length}, scenes: ${episode.scenes.length}`);
  console.log(`Model: ${MODEL}`);

  const voices = singleVoice ? [{ id: singleVoice, label: singleVoice }] : VOICES;

  for (const v of voices) {
    const fname = singleVoice ? 'narration_final.wav' : `gemini_${v.id}.wav`;
    const outPath = path.join(outDir, fname);
    if (fs.existsSync(outPath) && !singleVoice) {
      console.log(`  ${v.label} → exists, skip`);
      continue;
    }
    process.stdout.write(`  ${v.label} ... `);
    try {
      await generateTts({ text, voice: v.id, outPath });
      const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`✓ ${fname} (${sizeKb} KB)`);
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 200)}`);
    }
  }

  console.log(`\n✓ Output: ${outDir}`);
  return outDir;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { VOICES };
