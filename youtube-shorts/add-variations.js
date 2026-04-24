// Generate N angle-variation scenes RIGHT AFTER a specific anchor scene.
// Same mood/moment, different camera angles.
// Keeps the anchor scene unchanged.
//
// Usage: node youtube-shorts/add-variations.js <episodeId> <anchorSceneN> [count]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-pro';

const EPISODES_DIR = path.join(__dirname, 'episodes');
const IMAGES_BASE = path.join(__dirname, 'images');

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    variations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subtitle: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
          setting: { type: Type.STRING },
          characters: { type: Type.ARRAY, items: { type: Type.STRING } },
          duration: { type: Type.NUMBER },
          angleNote: { type: Type.STRING },
        },
        required: ['subtitle', 'imagePrompt', 'setting', 'characters', 'duration', 'angleNote'],
      },
    },
  },
  required: ['variations'],
};

async function generateVariations(episode, anchor, count) {
  const sty = episode.episodeStyle;

  const prompt = `You are a YouTube Shorts editor. We have one anchor scene that the user loves and wants to keep. Generate ${count} additional NEW scenes that re-interpret the SAME moment from DIFFERENT camera angles to extend that beat for visual variety.

ANCHOR SCENE (unchanged, just for context):
- Subtitle: ${anchor.subtitle.replace(/\n/g, ' / ')}
- Setting: ${anchor.setting}
- Characters: ${anchor.characters.join(',')}
- Image prompt: ${anchor.imagePrompt}

EPISODE STYLE (must match):
- Heroine hair: ${sty.heroineHair}
- Heroine home outfit: ${sty.heroineHomeOutfit}
- Mood: ${sty.moodPalette}
- Season: ${sty.season}

VARIATION RULES:
1. Same mood/moment as anchor (heroine on balcony at sunset for this anchor).
2. Each variation = COMPLETELY DIFFERENT camera angle from anchor and from each other.
3. Aggressive angle variety. Pick from:
   - Wide establishing (whole balcony from far away)
   - Low angle (looking up at heroine from below)
   - Bird's eye (top-down)
   - Over-the-shoulder (her looking at sunset)
   - Hand on railing detail
   - Hair blowing detail
   - Sunset reflected in her eye
   - Silhouette against the sun
   - Dutch tilt
   - Profile close-up
   - Wind catching her cardigan/hair
   - The sunset itself with her hand visible at edge
4. Subtitle: SHORT mood/atmosphere lines (NOT new plot). Examples: "...", "(노을이 너무 예뻐서)", "괜히 마음이 일렁였어", "그 순간이었어", "바람 한 줄기".
5. Narration = subtitle (no \\n needed since these are short).
6. Duration: 2.5-4 seconds each.
7. characters: ["여주"] or ["none"] (for sunset/object detail).
8. setting: indoor_home (heroine still on balcony) or object_only (sunset/railing close-up).
9. imagePrompt: English. NO outfit/hair description (auto-injected). Focus on angle + composition + mood.
10. angleNote: 한국어 한 줄로 어떤 앵글인지 메모.

Return JSON: { variations: [...] }`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0.95,
    },
  });

  return JSON.parse(response.text);
}

function renameExistingImages(episodeId, oldToNew) {
  const dir = path.join(IMAGES_BASE, episodeId);
  if (!fs.existsSync(dir)) return;
  const tempEntries = [];
  for (const [oldN, newN] of oldToNew) {
    if (oldN === newN) continue;
    const oldFile = path.join(dir, `scene_${String(oldN).padStart(2, '0')}.png`);
    if (fs.existsSync(oldFile)) {
      const tmp = path.join(dir, `__tmp_${oldN}_to_${newN}.png`);
      fs.renameSync(oldFile, tmp);
      tempEntries.push({ tmp, finalN: newN });
    }
  }
  for (const { tmp, finalN } of tempEntries) {
    const finalFile = path.join(dir, `scene_${String(finalN).padStart(2, '0')}.png`);
    fs.renameSync(tmp, finalFile);
  }
}

async function main() {
  const epId = process.argv[2];
  const anchorN = parseInt(process.argv[3], 10);
  const count = parseInt(process.argv[4] || '3', 10);
  if (!epId || !anchorN) {
    console.error('Usage: node add-variations.js <episodeId> <anchorSceneN> [count]');
    process.exit(1);
  }

  const epPath = path.join(EPISODES_DIR, `${epId}.json`);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const anchor = episode.scenes.find((s) => s.n === anchorN);
  if (!anchor) throw new Error(`Anchor scene ${anchorN} not found`);

  console.log(`Anchor scene ${anchorN}: "${anchor.subtitle.replace(/\n/g, ' / ')}"`);
  console.log(`Generating ${count} angle variations...`);

  const { variations } = await generateVariations(episode, anchor, count);
  console.log(`Got ${variations.length}:`);
  variations.forEach((v, i) => console.log(`  +${i + 1}: "${v.subtitle}" — ${v.angleNote}`));

  // Build merged scenes
  const merged = [];
  const oldToNew = [];
  let counter = 1;
  for (const sc of episode.scenes) {
    const newN = counter++;
    oldToNew.push([sc.n, newN]);
    merged.push({ ...sc, n: newN });
    if (sc.n === anchorN) {
      for (const v of variations) {
        merged.push({
          n: counter++,
          subtitle: v.subtitle,
          narration: v.subtitle.replace(/\n/g, ' '),
          imagePrompt: v.imagePrompt,
          setting: v.setting,
          characters: v.characters,
          duration: v.duration,
        });
      }
    }
  }

  // Backup
  const backupPath = epPath.replace('.json', `.backup_${Date.now()}.json`);
  fs.copyFileSync(epPath, backupPath);
  console.log(`Backed up: ${backupPath}`);

  // Rename existing images
  renameExistingImages(episode.id, oldToNew);

  // Save
  episode.scenes = merged;
  fs.writeFileSync(epPath, JSON.stringify(episode, null, 2));
  const total = merged.reduce((s, sc) => s + sc.duration, 0);
  console.log(`✓ Episode now has ${merged.length} scenes (${total.toFixed(1)}s).`);
}

if (require.main === module) main().catch((err) => { console.error(err); process.exit(1); });
