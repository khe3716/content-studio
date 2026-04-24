// Use Gemini to (1) rank candidates and pick the best, (2) adapt into Korean 달콤설렘썰 with scene breakdown.

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const RANK_MODEL = 'gemini-2.5-flash';
const ADAPT_MODEL = 'gemini-2.5-pro';

// ─── Stage 1: pick the best candidate ──────────────────────────────────────────

async function rankAndPick(candidates, seenIds = new Set()) {
  const eligible = candidates.filter((c) => !seenIds.has(c.id));
  if (eligible.length === 0) throw new Error('No new candidates (all seen)');

  const summaries = eligible.map((c, i) => ({
    idx: i,
    id: c.id,
    subreddit: c.subreddit,
    title: c.title,
    snippet: c.body.slice(0, 500),
    length: c.body.length,
    score: c.score,
  }));

  const prompt = `You are picking the best story for a Korean YouTube Shorts series called "달콤 설렘썰" (sweet butterflies-in-stomach romantic stories), narrated in first person from a young woman's POV. Format: 30-50 second vertical video, 8-12 scenes, anime/webtoon illustration.

Score each candidate 0-10 on these axes:
- romantic: clear romance/crush/meet-cute (NOT family/friends)
- emotional_pull: makes the viewer feel something (butterflies, tension, sweetness)
- adaptable: can be told in 8-12 short narration lines
- korean_fit: feels natural when retold in a young Korean speaker's voice
- visual: has clear scenes that translate to anime illustration

Then pick the SINGLE BEST candidate. Prefer first-person POV stories about a young woman with a crush or a sweet romantic moment. Avoid: marriage, kids, breakups, abuse, anything heavy.

Candidates:
${JSON.stringify(summaries, null, 2)}

Return JSON with: pickedId, pickedIdx, reason (한국어로 1-2 문장), runnerUpIds (array of 2-3 backup ids).`;

  const response = await ai.models.generateContent({
    model: RANK_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pickedId: { type: Type.STRING },
          pickedIdx: { type: Type.INTEGER },
          reason: { type: Type.STRING },
          runnerUpIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['pickedId', 'pickedIdx', 'reason'],
      },
    },
  });

  const result = JSON.parse(response.text);
  const picked = eligible[result.pickedIdx];
  if (!picked || picked.id !== result.pickedId) {
    // fallback: lookup by id
    const byId = eligible.find((c) => c.id === result.pickedId);
    if (!byId) throw new Error(`Picked id ${result.pickedId} not found`);
    return { picked: byId, reason: result.reason, runnerUps: result.runnerUpIds || [] };
  }
  return { picked, reason: result.reason, runnerUps: result.runnerUpIds || [] };
}

// ─── Stage 2: adapt to Korean scene-based script ───────────────────────────────

const SCENE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    video: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: '유튜브 쇼츠 제목, 60자 이내, 후킹 강하게' },
        description: { type: Type.STRING, description: '영상 설명란 (해시태그 포함)' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        hook: { type: Type.STRING, description: '상단 가짜 댓글창에 띄울 도입 한 줄, 예: "아니 근데 있잖아..."' },
      },
      required: ['title', 'description', 'tags', 'hook'],
    },
    scenes: {
      type: Type.ARRAY,
      minItems: 8,
      maxItems: 12,
      items: {
        type: Type.OBJECT,
        properties: {
          n: { type: Type.INTEGER },
          subtitle: { type: Type.STRING, description: '화면 자막 (1~2줄, 짧고 임팩트)' },
          narration: { type: Type.STRING, description: 'TTS가 읽을 문장. 자막과 같거나 자연스럽게 풀어쓴 버전' },
          imagePrompt: {
            type: Type.STRING,
            description: 'nano-banana 영문 프롬프트. 캐릭터(여주/선배/기타)와 장면 묘사 포함. "Use the reference character" 같은 지시어는 넣지 말고 순수 묘사만',
          },
          characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ['여주', '선배', '친구', '기타'] },
          },
          duration: { type: Type.NUMBER, description: '초 단위, 3~6 권장' },
        },
        required: ['n', 'subtitle', 'narration', 'imagePrompt', 'characters', 'duration'],
      },
    },
  },
  required: ['video', 'scenes'],
};

async function adaptToKorean(post) {
  const prompt = `You are adapting an English Reddit story into a Korean YouTube Shorts script in the "달콤 설렘썰" (sweet romantic story) genre.

Original post:
- Subreddit: r/${post.subreddit}
- Title: ${post.title}
- Body:
${post.body}

Adaptation rules:
1. Voice: first-person young Korean woman in her early 20s, casual spoken style ("~거든", "~잖아", "~더라").
2. POV character: 여주 (the narrator). Love interest: 선배 (or whatever fits).
3. Korean naming: NEVER use proper names — use roles only: "선배", "그 사람", "걔", "친구".
4. Length: 8-12 scenes, total ~30-50 seconds.
5. Hook: scene 1 must start with a curiosity-gap line like "아니 근데 있잖아…", "내 친구한테 이런 일이 있었는데", "어제 진짜 별일이 있었어".
6. Build-up: scenes 2-7 set the stage and tension.
7. Reveal/peak: scenes 8-10 deliver the sweet/twist moment.
8. Outro: final scene leaves a lingering feeling, NOT a moral lesson.
9. Adapt freely — change country, names, settings to Korean college/early-20s context. The English story is just inspiration.
10. Image prompts: write in English, describe scene + character + emotion + composition. Use "young Korean woman with long straight black hair and bangs, purple eyes" for 여주, "young Korean man with short brown messy hair, golden amber eyes" for 선배. Always anime/Korean webtoon style, soft cel shading, vertical 9:16.
11. Each subtitle must be 1-2 short lines (max ~20 chars per line) for shorts readability.

Generate the full script now.`;

  const response = await ai.models.generateContent({
    model: ADAPT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCENE_SCHEMA,
      temperature: 0.9,
    },
  });

  return JSON.parse(response.text);
}

module.exports = { rankAndPick, adaptToKorean };
