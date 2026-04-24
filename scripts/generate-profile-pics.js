// 네이버·인스타 프로필 사진 여러 장 생성 (1:1)
// node scripts/generate-profile-pics.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}
loadEnv();

const API_KEY = process.env.GEMINI_API_KEY;

const PROMPTS = [
  {
    name: 'logo-strawberry',
    prompt: 'Minimalist flat vector logo illustration of a single cute stylized red strawberry with a small green leaf on top, soft rounded shapes, clean bold outlines, pastel pink circular background, no animals, no people, no text, no letters, centered composition, modern brand icon style, 1:1',
  },
  {
    name: 'logo-cluster',
    prompt: 'Minimalist flat vector logo illustration showing a small cluster of stylized fruits — a red apple, a bunch of blue-purple grapes, and a yellow lemon with a green leaf — arranged in a tight circular cluster, soft rounded shapes, clean outlines, pastel cream-yellow circular background, no animals, no people, no text, no letters, modern brand mark style, 1:1',
  },
  {
    name: 'logo-leaf-badge',
    prompt: 'Minimalist geometric badge logo of a single stylized green leaf intertwined with a small round orange fruit (tangerine), clean flat vector style, simple rounded shapes, soft mint-green circular background, no animals, no people, no text, no letters, centered modern brand symbol, 1:1',
  },
  {
    name: 'logo-3d-sticker',
    prompt: '3D cute sticker style icon of a smiling stylized red apple with one green leaf, glossy soft plastic look, pastel peach circular background with subtle glow, no animals, no people, no text, no letters, centered composition, modern 3d emoji style, 1:1',
  },
];

async function generateOne(prompt, outPath) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'dont_allow' },
    }),
  });
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('응답에 이미지 없음');
  const img = await sharp(Buffer.from(b64, 'base64'))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .jpeg({ quality: 88 })
    .toBuffer();
  fs.writeFileSync(outPath, img);
  return img.length;
}

async function main() {
  const outDir = path.join(__dirname, '..', 'profile-pics');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const { name, prompt } of PROMPTS) {
    const outPath = path.join(outDir, `${name}.jpg`);
    process.stdout.write(`🎨 ${name}... `);
    try {
      const size = await generateOne(prompt, outPath);
      console.log(`✅ ${Math.round(size / 1024)}KB`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n📁 저장 위치: ${outDir}`);
}

main();
