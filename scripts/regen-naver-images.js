// 특정 Day의 특정 이미지 번호만 재생성 (같은 파일명으로 덮어쓰기).
// 사용: node scripts/regen-naver-images.js
// 대상 Day/타임스탬프/번호/프롬프트는 TARGETS에 직접 수정.

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
  let safePrompt = prompt;
  if (!/no people/i.test(safePrompt)) safePrompt += '. No people, no hands, no human figures.';
  if (!/no text/i.test(safePrompt)) safePrompt += ' No text, no writing, no korean characters, no labels, no captions, no signs, no watermarks, no posters, no notes.';
  if (/raspberr|blueberr|산딸기|블루베리|berry|berries/i.test(safePrompt) && !/calyx|stem/i.test(safePrompt)) {
    safePrompt += ' Berries without green calyx or stem attached — clean, hulled fruit only.';
  }
  safePrompt += ' Physically accurate, correct proportions, consistent shadows and lighting from a single natural light source, realistic depth of field, authentic unedited smartphone photograph quality, natural color temperature, subtle imperfections and slight grain, no AI artifacts, no floating or levitating objects, no impossible geometry, no melting or distorted shapes, no duplicate or malformed items.';

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

const TARGETS = [
  {
    path: path.join(__dirname, '..', 'naver-blog', 'images', 'day-01-naver-1777007589438-2.jpg'),
    prompt: 'Moody editorial lifestyle photograph of fresh raspberries piled in a small white ceramic bowl on a warm wooden table, soft golden-hour window light streaming from the side, a crumpled linen napkin beside the bowl, a few raspberries scattered on the wood surface, cozy Korean home kitchen atmosphere, cinematic shallow depth of field, everyday authentic mood, slight film grain'
  },
  {
    path: path.join(__dirname, '..', 'naver-blog', 'images', 'day-01-naver-1777007589438-9.jpg'),
    prompt: 'Unedited close-up phone photo of perfectly plump glossy fresh raspberries tightly packed together on a plain white ceramic plate, macro focus on the delicate druplet texture and the tiny soft hairs on the surface of each berry, natural diffused window light from above, softly blurred Korean home kitchen background, realistic everyday lifestyle food photography'
  },
];

(async () => {
  for (const t of TARGETS) {
    console.log(`🎨 ${path.basename(t.path)}`);
    try {
      await generateImage(t.prompt, t.path);
      console.log(`   ✓ 덮어씀`);
    } catch (e) {
      console.error(`   ❌ ${e.message}`);
    }
  }
  console.log('\n✅ 완료');
})();
