// Generate TTS audio for an episode using Edge TTS (free, unlimited).
// Multi-voice mode: outputs the same script in several Korean female voices for comparison.
//
// Usage:
//   node youtube-shorts/generate-tts.js <episodeId>           — multi-voice comparison
//   node youtube-shorts/generate-tts.js <episodeId> <voice>   — single voice (final)

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EPISODES_DIR = path.join(__dirname, 'episodes');
const TTS_BASE = path.join(__dirname, 'tts');

// Edge TTS Korean voices are limited (only SunHi for female).
// We compensate by varying rate/pitch for different vibes,
// plus including a multilingual option that can speak Korean.
const VOICES = [
  { id: 'ko-KR-SunHiNeural', label: 'A. SunHi 기본 — 차분 표준', rate: '+0%', pitch: '+0Hz' },
  { id: 'ko-KR-SunHiNeural', label: 'B. SunHi 발랄 — 빠르고 밝은 톤', rate: '+12%', pitch: '+30Hz', suffix: '_bright' },
  { id: 'ko-KR-SunHiNeural', label: 'C. SunHi 어린 — 더 높은 톤', rate: '+8%', pitch: '+60Hz', suffix: '_young' },
  { id: 'ko-KR-SunHiNeural', label: 'D. SunHi 성숙 — 낮고 부드러움', rate: '-8%', pitch: '-25Hz', suffix: '_mature' },
  { id: 'ko-KR-SunHiNeural', label: 'E. SunHi 속삭이듯 — 살짝 느리게', rate: '-5%', pitch: '+15Hz', suffix: '_soft' },
  { id: 'en-US-AvaMultilingualNeural', label: 'F. Ava (멀티) — 표현력 풍부', rate: '+5%', pitch: '+0Hz' },
];

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
  // Join all scene narrations with natural pauses
  const lines = episode.scenes.map((sc) => sc.narration.trim());
  return lines.join('\n\n');
}

async function runEdgeTts({ textFile, voice, outPath, rate = '+0%', pitch = '+0Hz' }) {
  return new Promise((resolve, reject) => {
    // Use `--flag=value` form so negative values like -8% aren't parsed as flags
    const args = ['-v', voice, '-f', textFile, '--write-media', outPath, `--rate=${rate}`, `--pitch=${pitch}`];
    const proc = spawn('edge-tts', args, { shell: false });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`edge-tts exited ${code}: ${stderr.slice(0, 200)}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const singleVoice = process.argv[3]; // optional

  const outDir = path.join(TTS_BASE, episode.id);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const text = buildFullText(episode);
  console.log(`Episode: ${episode.id}`);
  console.log(`Total chars: ${text.length}, scenes: ${episode.scenes.length}`);

  // Save the text used (for the user to inspect or copy) + use as edge-tts input
  const textFile = path.join(outDir, '대본_TTS용.txt');
  fs.writeFileSync(textFile, text, 'utf8'); // no BOM for edge-tts compatibility

  const voices = singleVoice ? [{ id: singleVoice, label: singleVoice, gender: '?' }] : VOICES;

  for (const v of voices) {
    const baseName = v.id.replace('ko-KR-', '').replace('en-US-', '').replace('Neural', '').replace('Multilingual', 'Multi');
    const suffix = v.suffix || '';
    const fname = singleVoice ? 'narration_final.mp3' : `voice_${baseName}${suffix}.mp3`;
    const outPath = path.join(outDir, fname);
    if (fs.existsSync(outPath) && !singleVoice) {
      console.log(`  ${v.label} → exists, skip`);
      continue;
    }
    process.stdout.write(`  ${v.label} ... `);
    try {
      await runEdgeTts({ textFile, voice: v.id, outPath, rate: v.rate || '+0%', pitch: v.pitch || '+0Hz' });
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
