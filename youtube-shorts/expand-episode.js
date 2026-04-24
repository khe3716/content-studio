// Expand an existing episode by inserting B-roll / variety-angle scenes between existing ones.
// - Keeps all existing scenes verbatim (content unchanged)
// - Inserts NEW scenes at strategic spots
// - Renumbers everything sequentially
// - Renames existing PNG files to new numbers (so existing images are preserved)
// - generate-images.js will then only fill in the genuinely new scenes
//
// Usage: node youtube-shorts/expand-episode.js <episodeId> [insertCount]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-pro';

const EPISODES_DIR = path.join(__dirname, 'episodes');
const IMAGES_BASE = path.join(__dirname, 'images');

const NEW_SCENE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    insertions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          afterScene: { type: Type.INTEGER, description: '이 씬 번호 다음에 삽입 (기존 씬 n)' },
          subtitle: { type: Type.STRING },
          narration: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
          setting: { type: Type.STRING },
          characters: { type: Type.ARRAY, items: { type: Type.STRING } },
          duration: { type: Type.NUMBER },
        },
        required: ['afterScene', 'subtitle', 'narration', 'imagePrompt', 'setting', 'characters', 'duration'],
      },
    },
  },
  required: ['insertions'],
};

async function generateInsertions(episode, insertCount) {
  const sty = episode.episodeStyle;
  const sceneSummary = episode.scenes
    .map((sc) => `[${sc.n}] ${sc.subtitle.replace(/\n/g, ' / ')} (${sc.duration}s, chars=${sc.characters.join('/') || 'none'}, setting=${sc.setting})`)
    .join('\n');

  const prompt = `You are a YouTube Shorts editor. Look at this 21-scene Korean romance shorts script and insert ${insertCount} NEW "B-roll / cutaway / angle-variety" scenes between the existing ones to make pacing richer and more visually dynamic.

CURRENT SCENES (in order):
${sceneSummary}

EPISODE STYLE (must match):
- Heroine: ${sty.heroineHair}
- Heroine outfit: ${sty.heroineOutfit}
- Heroine home outfit: ${sty.heroineHomeOutfit}
- Senior outfit: ${sty.seonbaeOutfit}
- Mood: ${sty.moodPalette}
- Season: ${sty.season}

CONTEXT:
- The heroine NEVER leaves her apartment in this episode. All her scenes use setting="indoor_home".
- The senior is outside on the street. His scenes use setting="outdoor".
- Hairstyle is locked across all scenes.

INSERTION RULES:
1. Pick ${insertCount} good spots between existing scenes for B-roll/variety.
2. Each NEW scene MUST use a DIFFERENT camera angle from its neighbors. Use these angles aggressively:
   - Extreme close-up (eye / lips / hand detail)
   - Bird's-eye view from above
   - Low angle from below
   - Dutch tilt for tension
   - Over-the-shoulder
   - Reflection (in mirror, in phone screen, in window)
   - Detail shot (object only — petals, curtain, latte, phone screen, etc.)
   - Wide establishing
3. Each new scene 2.5-4 seconds. Total added time: ${insertCount * 3} seconds.
4. Subtitle = Narration (with \\n in subtitle replaced by space in narration).
5. Subtitles should be SHORT — feeling/atmosphere/mood, not new plot. Examples: "두근...", "(꿀꺽)", "심장이 미친 듯이", "괜히 봄바람 탓".
6. characters: ["여주"] / ["선배"] / ["none"] / etc. — match what's in frame.
7. setting: indoor_home / outdoor / closeup_only / object_only.
8. imagePrompt: English. NO outfit/hair description (will be auto-injected). Focus on camera angle + mood + composition.
9. afterScene: existing scene number this should come AFTER (1-21).

Return JSON: { insertions: [...] }`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: NEW_SCENE_SCHEMA,
      temperature: 0.9,
    },
  });

  return JSON.parse(response.text);
}

function renameExistingImages(episodeId, oldToNew) {
  const dir = path.join(IMAGES_BASE, episodeId);
  if (!fs.existsSync(dir)) return;
  // First rename to temp names to avoid collision
  const tempEntries = [];
  for (const [oldN, newN] of oldToNew) {
    const oldFile = path.join(dir, `scene_${String(oldN).padStart(2, '0')}.png`);
    if (fs.existsSync(oldFile)) {
      const tmp = path.join(dir, `__tmp_${oldN}_to_${newN}.png`);
      fs.renameSync(oldFile, tmp);
      tempEntries.push({ tmp, finalN: newN });
    }
  }
  // Then move to final names
  for (const { tmp, finalN } of tempEntries) {
    const finalFile = path.join(dir, `scene_${String(finalN).padStart(2, '0')}.png`);
    fs.renameSync(tmp, finalFile);
  }
}

async function main() {
  const arg = process.argv[2];
  const insertCount = parseInt(process.argv[3] || '6', 10);
  const epPath = arg ? path.join(EPISODES_DIR, `${arg}.json`) : (() => {
    const files = fs.readdirSync(EPISODES_DIR).filter((f) => f.startsWith('ep_') && f.endsWith('.json')).sort().reverse();
    return path.join(EPISODES_DIR, files[0]);
  })();
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  console.log(`Expanding ${episode.id} (current ${episode.scenes.length} scenes) by ${insertCount}...`);

  const { insertions } = await generateInsertions(episode, insertCount);
  console.log(`Got ${insertions.length} insertion proposals:`);
  insertions.forEach((ins, i) => {
    console.log(`  +${i + 1} after scene ${ins.afterScene}: "${ins.subtitle.replace(/\n/g, ' / ')}" (${ins.duration}s, ${ins.characters.join(',')}, ${ins.setting})`);
  });

  // Build new scene list
  const merged = [];
  const oldToNew = []; // [[oldN, newN], ...]
  let counter = 1;
  for (const sc of episode.scenes) {
    const newN = counter++;
    oldToNew.push([sc.n, newN]);
    merged.push({ ...sc, n: newN });
    // Insert any new scenes that go after this one
    const ins = insertions.filter((i) => i.afterScene === sc.n);
    for (const i of ins) {
      // Force narration = subtitle
      const subtitle = i.subtitle;
      const narration = subtitle.replace(/\n/g, ' ');
      merged.push({
        n: counter++,
        subtitle,
        narration,
        imagePrompt: i.imagePrompt,
        setting: i.setting,
        characters: i.characters,
        duration: i.duration,
      });
    }
  }

  // Backup old episode
  const backupPath = epPath.replace('.json', `.backup_${Date.now()}.json`);
  fs.copyFileSync(epPath, backupPath);
  console.log(`Backed up old: ${backupPath}`);

  // Rename existing images according to mapping
  renameExistingImages(episode.id, oldToNew);
  console.log(`Renamed ${oldToNew.length} existing images.`);

  // Save new episode
  episode.scenes = merged;
  fs.writeFileSync(epPath, JSON.stringify(episode, null, 2));
  console.log(`✓ Episode now has ${merged.length} scenes (${merged.reduce((s, sc) => s + sc.duration, 0).toFixed(1)}s).`);
  console.log(`Run generate-images.js to fill in the new scenes.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}
