// 재테크 블로그 이미지 생성 (Nano Banana)
// 사용법: node scripts/finance-team/generate-images.js <slug>
// 예:    node scripts/finance-team/generate-images.js day-01-may-high-rate-savings-top10

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const envPath = path.join(__dirname, '..', '..', '.env');
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
if (!GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY 없음'); process.exit(1); }

const slug = process.argv[2];
if (!slug) { console.error('❌ slug 인자 필요'); process.exit(1); }

const NARRATION_PATH = path.join(__dirname, '..', '..', 'finance-blog', 'drafts', `${slug}-narration.json`);
const customPrompts = (() => {
  if (!fs.existsSync(NARRATION_PATH)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(NARRATION_PATH, 'utf8'));
    return j.image_prompts || null;
  } catch {
    return null;
  }
})();

const FRONT_RULES = [
  'STRICT REQUIREMENTS:',
  '- No people faces, no hands, no human figures.',
  '- No text, no writing, no korean characters, no labels, no captions, no watermarks.',
  '- No company logos, no brand names, no bank names visible.',
  '- Clean minimal Korean home/office aesthetic, natural soft window light.',
  '- Object-centric still life: coins, banknotes, bankbook (passbook), calculator, calendar, charts on paper, plants.',
  '- Physically accurate, realistic gravity, no AI artifacts, no melting shapes.',
  '- Color palette friendly: muted blues, soft beige, warm wood, white background.',
  '',
  'SCENE:',
].join('\n');
const BACK = ' Authentic unedited smartphone photograph quality, slight grain, depth of field.';

const DEFAULT_TARGETS = [
  {
    slot: 'cover',
    aspect: { w: 1080, h: 1080 },
    prompt: 'A clean minimalist desk top-down flat-lay: a small Korean bankbook (passbook) closed on the left, a stack of Korean coins (500won, 100won) neatly piled in the center, a small green plant in a white ceramic pot on the right, warm beige fabric tablecloth, soft morning window light from upper right. Cozy, trustworthy, financial planning mood.',
  },
  {
    slot: 'section-1',
    aspect: { w: 1920, h: 1080 },
    prompt: 'A side-angle desktop shot: a wooden desk with a paper calendar showing May, a small calculator with white buttons, several Korean banknotes (10000won) fanned out, a ceramic coffee cup with steam. Soft natural daylight from the left window. Warm, planning, decision-making atmosphere.',
  },
  {
    slot: 'section-2',
    aspect: { w: 1920, h: 1080 },
    prompt: 'Top-down minimalist shot: stacked Korean 500won coins forming a growing column from short to tall (like a bar chart) on a clean white desk surface, soft shadows, single key light. Symbolizing saving and growth. No labels, no numbers visible.',
  },
];

const ASPECT_MAP = {
  cover: { w: 1080, h: 1080 },
  'section-1': { w: 1920, h: 1080 },
  'section-2': { w: 1920, h: 1080 },
};

const TARGETS = customPrompts
  ? Object.entries(customPrompts).map(([slot, prompt]) => ({
      slot,
      aspect: ASPECT_MAP[slot] || { w: 1920, h: 1080 },
      prompt,
    }))
  : DEFAULT_TARGETS;

async function generateImage(prompt, outputPath, w, h) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const safePrompt = `${FRONT_RULES}\n${prompt}${BACK}`;

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
    .resize(w, h, { kernel: 'lanczos3', fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();
  fs.writeFileSync(outputPath, resized);
}

const OUT_DIR = path.join(__dirname, '..', '..', 'finance-blog', 'images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  for (const t of TARGETS) {
    const outPath = path.join(OUT_DIR, `${slug}-${t.slot}.jpg`);
    process.stdout.write(`🎨 ${path.basename(outPath)} ... `);
    try {
      await generateImage(t.prompt, outPath, t.aspect.w, t.aspect.h);
      console.log('✓');
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }
})();
