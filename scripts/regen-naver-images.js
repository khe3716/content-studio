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

async function generateImage(prompt, outputPath) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const frontRules = [
    'STRICT REQUIREMENTS:',
    '- No people, no hands.',
    '- No text, no writing, no korean characters, no labels, no captions, no watermarks.',
    '- All berries hulled. NO green stems, NO calyx, NO leaves.',
    '- BERRY TYPE: ONLY raspberries (Rubus idaeus, small round red with hollow center and bumpy druplets). NOT strawberries, NOT blackberries, NOT blueberries.',
    '- Physically accurate, realistic gravity, no AI artifacts.',
    '',
    'SCENE:',
  ].join('\n');
  const backRules = ' Authentic unedited smartphone photograph quality, natural window light, subtle grain.';
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

const STAMP = '1777033929701';
const BASE = path.join(__dirname, '..', 'naver-blog', 'images');
const TARGETS = [
  {
    num: 9,
    prompt: 'Photo of a clean RECTANGULAR clear glass food storage container (NOT round, NOT cylindrical — square/rectangular shape) with fresh red raspberries arranged in a single neat layer on white paper towels inside, the clear rectangular glass lid placed slightly ajar on one side to allow air flow (숨구멍), on a bright kitchen counter with soft natural daylight. The container must be the SAME rectangular glass style used for berry storage.'
  },
];

(async () => {
  for (const t of TARGETS) {
    const outPath = path.join(BASE, `day-02-naver-${STAMP}-${t.num}.jpg`);
    console.log(`🎨 ${path.basename(outPath)}`);
    try {
      await generateImage(t.prompt, outPath);
      console.log(`   ✓`);
    } catch (e) {
      console.error(`   ❌ ${e.message}`);
    }
  }
})();
