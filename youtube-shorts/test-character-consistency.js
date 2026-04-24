// Character consistency test using Gemini 2.5 Flash Image (nano-banana)
// Uses reference images to generate same character in different outfits/hairstyles/scenes

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const REF_DIR = path.join(__dirname, 'references');
const OUT_DIR = path.join(__dirname, 'test-output');
const MODEL = 'gemini-2.5-flash-image';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function loadImagePart(filename) {
  const filePath = path.join(REF_DIR, filename);
  const data = fs.readFileSync(filePath).toString('base64');
  return { inlineData: { mimeType: 'image/png', data } };
}

async function generate({ name, refImage, prompt }) {
  console.log(`\n[${name}] generating...`);
  console.log(`  prompt: ${prompt}`);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { role: 'user', parts: [loadImagePart(refImage), { text: prompt }] },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const outPath = path.join(OUT_DIR, `${name}.png`);
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
      console.log(`  saved -> ${outPath}`);
      return outPath;
    }
    if (part.text) {
      console.log(`  text response: ${part.text.slice(0, 200)}`);
    }
  }
  throw new Error('No image returned');
}

const tests = [
  {
    name: 'test1_여주_교복_단발',
    refImage: '여주.png',
    prompt: `Use the character in the reference image as the base.
Keep her face identity exactly the same: same purple eyes, same face shape, same soft blush, same delicate features.
Change her hairstyle to a short bob cut with bangs (still black hair).
Change her outfit to a Korean high school uniform: white button-up shirt, navy blue blazer, red ribbon tie, gray pleated skirt.
Place her in a school hallway with lockers in the background, soft afternoon light through windows.
She is standing, slightly turned, looking at the camera with a small smile.
Style: same soft anime/Korean webtoon art style as the reference, clean cel shading, soft colors.
Vertical 9:16 portrait composition, full body to mid-thigh visible.`,
  },
  {
    name: 'test2_여주_사복_긴머리',
    refImage: '여주.png',
    prompt: `Use the character in the reference image as the base.
Keep her face identity exactly the same: same purple eyes, same face shape, same soft blush, same delicate features.
Keep her original long straight black hair with bangs.
Change her outfit to casual modern Korean fashion: oversized beige cardigan over a white tee, light blue jeans, white sneakers.
Place her sitting at a window seat in a cozy cafe, holding a warm latte mug with both hands, looking out the window with a gentle expression.
Warm afternoon light, blurred cafe interior background with bokeh.
Style: same soft anime/Korean webtoon art style as the reference, clean cel shading, soft warm colors.
Vertical 9:16 portrait composition.`,
  },
  {
    name: 'test3_남주_정장_엘리베이터',
    refImage: '남주.png',
    prompt: `Use the character in the reference image as the base.
Keep his face identity exactly the same: same golden/amber eyes, same face shape, same hairstyle (short brown messy hair), same calm expression.
Change his outfit to a sharp black business suit, white dress shirt, dark navy tie.
Place him standing inside a modern office elevator, leaning slightly against the wall, one hand in his pocket, looking at the camera with a slight smirk.
Soft elevator lighting, brushed metal walls visible.
Style: same soft anime/Korean webtoon art style as the reference, clean cel shading.
Vertical 9:16 portrait composition, full body or upper body composition.`,
  },
];

(async () => {
  console.log(`Model: ${MODEL}`);
  console.log(`Output dir: ${OUT_DIR}`);

  for (const test of tests) {
    try {
      await generate(test);
    } catch (err) {
      console.error(`[${test.name}] FAILED:`, err.message);
    }
  }

  console.log('\nDone. Open the test-output folder to review.');
})();
