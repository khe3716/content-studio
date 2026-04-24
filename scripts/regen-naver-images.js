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
  const isBerry = /raspberr|blueberr|산딸기|블루베리|berry|berries/i.test(prompt);
  const frontRules = [
    'STRICT REQUIREMENTS:',
    '- No people, no hands, no human figures ANYWHERE including blurred background silhouettes.',
    '- No text, no writing, no korean characters, no labels, no captions, no signs, no watermarks.',
    isBerry ? '- All berries MUST be completely hulled. ABSOLUTELY NO green stems, NO green calyx, NO leaves, NO plant parts attached.' : '',
    '- ONLY raspberries (red, round, druplet-textured). NO strawberries, NO blueberries, NO mixed berries.',
    '- Physically accurate. No floating objects, no impossible geometry, no melting shapes.',
    '',
    'SCENE:',
  ].filter(Boolean).join('\n');
  const backRules = ' Authentic unedited smartphone photograph quality, natural window light, consistent shadows, subtle grain. No AI artifacts.';
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

const STAMP = '1777027680444';
const BASE = path.join(__dirname, '..', 'naver-blog', 'images');
const TARGETS = [
  {
    num: 3,
    prompt: 'Extreme macro close-up of a single fresh red raspberry sliced cleanly in half on a white marble countertop, revealing the delicate translucent juicy interior flesh and the fragile thin outer skin with tiny druplets, soft diffused daylight highlighting the vulnerable texture, moody dark background.'
  },
  {
    num: 12,
    prompt: 'Styled lifestyle photo of a clear glass mason jar filled to the top with well-preserved fresh red raspberries on a rustic wooden tray, a soft folded linen napkin next to the jar, a few loose raspberries scattered beside, warm morning window light, mood of successful long-term storage, cozy home feel.'
  },
];

(async () => {
  for (const t of TARGETS) {
    const outPath = path.join(BASE, `day-02-naver-${STAMP}-${t.num}.jpg`);
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
