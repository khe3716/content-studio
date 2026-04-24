// Generate all scene images for an episode using nano-banana with character refs.
// Usage: node youtube-shorts/generate-images.js <episodeId>
//   episodeId defaults to the most recent episode in episodes/

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash-image';

const ROOT = __dirname;
const EPISODES_DIR = path.join(ROOT, 'episodes');
const REF_DIR = path.join(ROOT, 'references');
const IMAGES_BASE = path.join(ROOT, 'images');

function loadImagePart(filename) {
  const filePath = path.join(REF_DIR, filename);
  const data = fs.readFileSync(filePath).toString('base64');
  return { inlineData: { mimeType: 'image/png', data } };
}

function getRefsForScene(characters) {
  const parts = [];
  if (characters.includes('여주')) parts.push(loadImagePart('여주.png'));
  if (characters.includes('선배')) parts.push(loadImagePart('남주.png'));
  return parts;
}

function describeHeroine(style, useHomeOutfit) {
  const outfit = useHomeOutfit ? style.heroineHomeOutfit : style.heroineOutfit;
  return `여주 (heroine): KEEP her face identity from the reference EXACTLY (large purple eyes, soft delicate features, gentle blush).

HAIRSTYLE (CRITICAL — must be IDENTICAL in every scene of this episode, no variation allowed):
${style.heroineHair}

OUTFIT: ${outfit}`;
}

function describeSeonbae(style) {
  return `선배 (love interest): KEEP his face identity from the reference EXACTLY (golden amber eyes, calm composed expression). Hair this episode: ${style.seonbaeHair}. Wearing: ${style.seonbaeOutfit}.`;
}

function buildPromptText(scene, style) {
  const useHome = scene.setting === 'indoor_home';
  const hasHeroine = scene.characters.includes('여주');
  const hasSeonbae = scene.characters.includes('선배');

  const charBlocks = [];
  if (hasHeroine) charBlocks.push(describeHeroine(style, useHome));
  if (hasSeonbae) charBlocks.push(describeSeonbae(style));
  const charNote = charBlocks.join('\n\n');

  return `${charNote}

Scene description:
${scene.imagePrompt}

Episode mood: ${style.moodPalette}
Season: ${style.season}

Style requirements:
- Korean webtoon anime aesthetic, soft cel shading, clean line art, romantic atmosphere
- Vertical 9:16 portrait composition
- Cinematic framing
- No text, no speech bubbles, no UI elements in the image
- Maintain consistent outfit and hairstyle across ALL scenes of this episode (only switch to home outfit when setting is indoor_home)`.trim();
}

async function generateScene(scene, outDir, style) {
  const outPath = path.join(outDir, `scene_${String(scene.n).padStart(2, '0')}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  [scene ${scene.n}] already exists, skip`);
    return outPath;
  }

  const refs = getRefsForScene(scene.characters);
  const prompt = buildPromptText(scene, style);

  const parts = [...refs, { text: prompt }];

  let attempt = 0;
  let lastErr;
  while (attempt < 3) {
    attempt += 1;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
      });

      const respParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of respParts) {
        if (part.inlineData) {
          fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
          return outPath;
        }
      }
      lastErr = new Error('No image returned');
    } catch (err) {
      lastErr = err;
    }
    console.log(`  [scene ${scene.n}] attempt ${attempt} failed: ${lastErr.message}; retrying...`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw lastErr;
}

function pickEpisode(arg) {
  if (arg) {
    const p = path.join(EPISODES_DIR, `${arg}.json`);
    if (fs.existsSync(p)) return p;
    throw new Error(`Episode not found: ${arg}`);
  }
  const files = fs
    .readdirSync(EPISODES_DIR)
    .filter((f) => f.startsWith('ep_') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No episodes found');
  return path.join(EPISODES_DIR, files[0]);
}

async function main() {
  const episodePath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(episodePath, 'utf8'));
  console.log(`═══ Episode: ${episode.id} — ${episode.video.title} ═══`);
  console.log(`Scenes: ${episode.scenes.length}`);

  const outDir = path.join(IMAGES_BASE, episode.id);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const style = episode.episodeStyle;
  if (!style) throw new Error('episode.episodeStyle missing — rebuild episode with new schema');
  console.log(`Style: ${style.season}`);
  console.log(`  여주 hair: ${style.heroineHair}`);
  console.log(`  여주 outfit: ${style.heroineOutfit}`);
  console.log(`  여주 home: ${style.heroineHomeOutfit}`);
  console.log(`  선배 hair: ${style.seonbaeHair}`);
  console.log(`  선배 outfit: ${style.seonbaeOutfit}`);

  for (const scene of episode.scenes) {
    const charLabel = scene.characters.join(',');
    console.log(`\n[scene ${scene.n}] characters=[${charLabel}] setting=${scene.setting}`);
    console.log(`  subtitle: ${scene.subtitle.replace(/\n/g, ' / ')}`);
    try {
      const outPath = await generateScene(scene, outDir, style);
      console.log(`  ✓ ${outPath}`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
  }

  console.log(`\n═══ Done. Images saved to: ${outDir} ═══`);
  return outDir;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { main, generateScene };
