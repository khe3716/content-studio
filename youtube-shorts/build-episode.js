// Take a manually-picked Korean story and split it into 8-12 scenes.
// Saves as episodes/ep_YYYYMMDD_NNN.json
//
// Usage: node youtube-shorts/build-episode.js [storyIndex]
//   storyIndex defaults to 1 (top of the Excel list)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const ADAPT_MODEL = 'gemini-2.5-pro';

// Same story list as build-story-excel.js (keep in sync)
const STORIES = require('./stories.js');

const SCENE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    video: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'MAX 22 chars, single line, hook style. e.g. "짝남 선배한테 전화 걸었더니 생긴 일"' },
        description: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        hook: { type: Type.STRING },
      },
      required: ['title', 'description', 'tags', 'hook'],
    },
    episodeStyle: {
      type: Type.OBJECT,
      properties: {
        season: { type: Type.STRING },
        heroineHair: { type: Type.STRING },
        heroineOutfit: { type: Type.STRING },
        heroineHomeOutfit: { type: Type.STRING },
        seonbaeHair: { type: Type.STRING },
        seonbaeOutfit: { type: Type.STRING },
        moodPalette: { type: Type.STRING },
      },
      required: ['season', 'heroineHair', 'heroineOutfit', 'heroineHomeOutfit', 'seonbaeHair', 'seonbaeOutfit', 'moodPalette'],
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          n: { type: Type.INTEGER },
          subtitle: { type: Type.STRING },
          narration: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
          setting: { type: Type.STRING },
          characters: { type: Type.ARRAY, items: { type: Type.STRING } },
          duration: { type: Type.NUMBER },
        },
        required: ['n', 'subtitle', 'narration', 'imagePrompt', 'setting', 'characters', 'duration'],
      },
    },
  },
  required: ['video', 'episodeStyle', 'scenes'],
};

async function splitIntoScenes(story) {
  const prompt = `You are converting a short Korean romance story into a YouTube Shorts script in the "달콤 설렘썰" (sweet butterflies) genre.

Story (already in Korean, casual young-woman first-person voice):
"""
${story.adapted}
"""

Original source for reference (do not copy verbatim):
"""
${story.original}
"""

Adaptation rules:
1. Voice: keep the same casual first-person Korean tone ("~거든", "~잖아", "~더라"). Narrator = 여주.
2. POV character: 여주 (the narrator). Love interest: 선배 (or fits the story).
3. Korean naming: NEVER use proper names — use roles only: "선배", "그 사람", "걔".
4. **Length**: 14-22 scenes, total **60-90 seconds** (each scene 3.5-6 seconds, average ~4.5s). MUST be at least 60 seconds total.
5. Hook: scene 1 must be a strong curiosity-gap line (≤15 chars). Examples: "아니 근데 있잖아...", "이거 진짜 실화야", "어제 역대급으로 설렜어".
6. Structure (use this rhythm):
   - Scenes 1-2: Hook + setup the situation
   - Scenes 3-6: Backstory / why this matters / character introduction
   - Scenes 7-12: Rising tension and detail (the slow build is what keeps viewers)
   - Scenes 13-18: The peak moment + reaction
   - Scenes 19-22 (or last 2-3): Aftermath, lingering feeling, hook for follow-up
7. Pacing tip: don't rush. The original story is short — EXPAND with inner monologue, sensory details, reaction beats, anticipation moments. Korean shorts viewers love the slow burn.
8. Outro: final scene leaves a lingering feeling, NOT a moral lesson.
9. Subtitle = Narration. Both fields MUST contain the EXACT SAME text — what's shown on screen is what TTS reads, word for word. Subtitle can have a "\n" line-break for screen layout (each line ≤20 chars), narration must be the same text but with the line-break replaced by a single space (so TTS reads it as one flow). Do NOT make narration a longer/different version.
10. **episodeStyle**: Pick a season + outfit + hair that fits the story context. **Different from the reference character defaults**. The story decides:
    - Outdoor balcony at sunset → could be autumn cardigan + jeans, or summer light tee
    - Cafe/library → cozy knitwear
    - Home/balcony scene → also need heroineHomeOutfit for indoor moments
    - Vary heroine hair too (e.g., shoulder bob, ponytail, half-up, wavy) — NOT the default long straight black with bangs every time
11. Image prompts: English. Style tag mandatory: "Korean webtoon anime style, soft cel shading, vertical 9:16". DO NOT re-describe outfit/hair in scene prompts — that comes from episodeStyle. Just describe scene + camera angle + emotion.
12. Mark each scene's setting — exactly ONE of: indoor_home, indoor_school, indoor_other, outdoor, closeup_only, object_only.
13. characters: array of strings, each must be exactly one of: "여주", "선배", "친구", "기타", "none".
14. episodeStyle.season: one of "봄", "여름", "가을", "겨울" (just the season name).
15. All other episodeStyle fields (hair, outfit, etc.): write in English, concise (under 25 words each).

Generate the full script now in JSON.`;

  const response = await ai.models.generateContent({
    model: ADAPT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCENE_SCHEMA,
      temperature: 0.85,
    },
  });

  return JSON.parse(response.text);
}

function todayId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dir = path.join(__dirname, 'episodes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const todays = fs.readdirSync(dir).filter((f) => f.startsWith(`ep_${ymd}_`));
  const n = String(todays.length + 1).padStart(3, '0');
  return `ep_${ymd}_${n}`;
}

async function main() {
  const storyIdx = parseInt(process.argv[2] || '1', 10);
  const story = STORIES.find((s) => s.n === storyIdx);
  if (!story) throw new Error(`Story #${storyIdx} not found`);

  console.log(`═══ Story #${story.n}: ${story.adaptedTitle} ═══`);
  console.log(`출처: ${story.sourceUrl}`);
  console.log(`\n각색 본문:\n${story.adapted}\n`);

  console.log('═══ Splitting into scenes (gemini-2.5-pro) ═══');
  const adapted = await splitIntoScenes(story);
  console.log(`✓ Title: ${adapted.video.title}`);
  console.log(`  Scenes: ${adapted.scenes.length}`);
  console.log(`  Hook: ${adapted.video.hook}`);

  const id = todayId();
  const episode = {
    id,
    storyIdx: story.n,
    createdAt: new Date().toISOString(),
    source: {
      platform: 'natepann',
      url: story.sourceUrl,
      originalTitle: story.sourceTitle,
      popularity: story.popularity,
      originalText: story.original,
      adaptedText: story.adapted,
    },
    characters: [
      { key: '여주', role: 'narrator', ref: 'references/여주.png' },
      { key: '선배', role: 'love_interest', ref: 'references/남주.png' },
    ],
    ...adapted,
  };

  const outPath = path.join(__dirname, 'episodes', `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(episode, null, 2));
  console.log(`\n✓ Saved: ${outPath}`);
  return episode;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { splitIntoScenes, main };
