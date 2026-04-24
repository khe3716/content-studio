const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 없음');

async function generateImage(prompt, outputPath) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const isBerry = /raspberr|blueberr|산딸기|블루베리|berry|berries/i.test(prompt);
  const frontRules = [
    'STRICT REQUIREMENTS:',
    '- No people, no hands, no human figures.',
    '- No text, no writing, no korean characters, no labels, no captions, no signs, no watermarks, no posters, no notes.',
    isBerry ? '- All berries MUST be completely hulled. ABSOLUTELY NO green stems, NO green calyx, NO leaves, NO plant parts attached to any berry. Only the round red/blue berry fruit body, exactly like commercial supermarket berries.' : '',
    '- ONLY raspberries (red, round, druplet-textured). NO strawberries, NO blueberries, NO mixed berries. Only red raspberries.',
    '- Physically accurate with correct proportions and realistic gravity. No floating objects, no impossible geometry, no melting or distorted shapes, no duplicate or malformed items, no mold, no frost, no unnatural texture.',
    '',
    'SCENE:',
  ].filter(Boolean).join('\n');
  const backRules = ' Authentic unedited smartphone photograph quality, natural window light from a single source, consistent shadows, natural color temperature, subtle imperfections and slight grain. No AI artifacts.';
  const safePrompt = `${frontRules}\n${prompt}${backRules}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: safePrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart) throw new Error('이미지 응답 없음');
  const b64 = imagePart.inlineData.data;
  const resized = await sharp(Buffer.from(b64, 'base64'))
    .resize(800, 800, { kernel: 'lanczos3', fit: 'cover' })
    .jpeg({ quality: 82 })
    .toBuffer();
  fs.writeFileSync(outputPath, resized);
  return outputPath;
}

const STAMP = '1777009374133';
const BASE = path.join(__dirname, '..', 'naver-blog', 'images');
const TARGETS = [
  {
    num: 2,
    prompt: 'A single white ceramic bowl filled with fresh red raspberries on a warm wooden kitchen table, soft side window light, cozy Korean home kitchen mood, shallow depth of field.'
  },
  {
    num: 6,
    prompt: 'Overhead close-up looking into a clear plastic supermarket raspberry container on a kitchen counter, the plastic bottom showing slight red juice stains and tiny moisture droplets where a few bottom raspberries got crushed, natural kitchen daylight.'
  },
  {
    num: 9,
    prompt: 'Extreme macro close-up of several plump firm glossy red raspberries arranged on a plain white ceramic plate, sharp focus on the bumpy druplet texture and the tiny soft surface hairs on each berry, natural diffused daylight, home kitchen background softly blurred.'
  },
];

(async () => {
  for (const t of TARGETS) {
    const outPath = path.join(BASE, `day-01-naver-${STAMP}-${t.num}.jpg`);
    console.log(`🎨 ${path.basename(outPath)}`);
    try {
      await generateImage(t.prompt, outPath);
      console.log(`   ✓ 교체 완료`);
    } catch (e) {
      console.error(`   ❌ ${e.message}`);
    }
  }
  console.log('\n✅ 완료');
})();
