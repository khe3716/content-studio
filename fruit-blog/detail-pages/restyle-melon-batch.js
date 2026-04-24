// 설향·양구 메론 AI 연출컷 배치 생성 (Gemini 2.5 Flash Image)
// 출력: output/seol-yang-melon/restyled/*.jpg

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error('GEMINI_API_KEY 없음'); process.exit(1); }
const MODEL = 'gemini-2.5-flash-image';

const ROOT = path.join(__dirname);
const SEOL = path.join(ROOT, 'source-photos', '설향 메론-', '설향 메론');
const YANG = path.join(ROOT, 'source-photos', '양구 메론-', '양구 메론');
const OUT_DIR = path.join(ROOT, 'output', 'seol-yang-melon', 'restyled');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 연출컷 목록 ──────────────────────────────
const JOBS = [
  {
    id: 'hero-yang-cut',
    input: path.join(YANG, '양구 메론 (1).jpg'),
    prompt: `Transform this into an irresistibly appetizing HERO product photo of a Korean yellow melon (honeydew-type) cut in half.

KEEP EXACTLY:
- The halved melon with its rich golden-yellow flesh
- The seeds in the center cavity (arranged naturally)
- The oval rounded shape of the fruit
- The creamy smooth texture of the flesh

CHANGE:
- MOUTHWATERING close-up of the freshly halved melon
- Visible moisture droplets and natural juice sheen on the cut surface suggesting freshness
- Slight glossy custard-like finish on the flesh
- Warm natural sunlight from the upper-left creating subtle highlights on the golden flesh
- Clean premium background: soft cream linen fabric with gentle folds, slightly out of focus
- Shallow depth of field, the melon is crisp-sharp in the foreground
- Golden-yellow color saturated from light amber to rich honey tones
- A single natural green leaf or wooden spoon as subtle prop (optional, minimal)
- Korean premium fruit gift shop aesthetic (MarketKurly, 29CM, Ohora magazine quality)
- Slightly elevated 30° angle showing the cavity and flesh clearly
- 1:1 square composition, center-focused

STRICTLY AVOID: Any text, watermark, logos, price tags, Korean/English characters, brand marks, packaging, stickers, or overlays. The image must be pure photography.

Result: Irresistible hero image that dominates attention and makes viewers crave the melon.`,
  },
  {
    id: 'seol-cut-editorial',
    input: path.join(SEOL, '설향 메론 (6).jpg'),
    prompt: `Transform this into a clean editorial magazine food photography shot of a Korean WHITE melon (설향/seol-hyang variety) cut in half.

KEEP EXACTLY:
- The pale white/cream colored flesh
- The seeds in the center
- The clean oval halved shape
- The crisp flesh texture

CHANGE:
- Bright, airy Kinfolk-style editorial aesthetic
- Soft natural window light from the left, gentle soft shadows
- Clean pure white or very pale cream background, slightly out of focus
- Place on light birch wood surface or cream ceramic plate
- Minimal props: single fresh mint leaf or tiny linen fold nearby
- Warm natural color grading, cream and soft butter tones
- Subtle specular highlights showing freshness and moisture
- Magazine-cover quality food photography
- Slightly elevated angle, 1:1 square composition

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, price tags, packaging, stickers.

Result: Premium, clean, appetizing editorial shot suitable for a high-end Korean food magazine.`,
  },
  {
    id: 'yang-cut-editorial',
    input: path.join(YANG, '양구 메론 (1).jpg'),
    prompt: `Transform this into a warm editorial magazine food photography shot of a Korean YELLOW melon (양구/yang-gu variety) cut in half.

KEEP EXACTLY:
- The golden-yellow to amber colored flesh
- The seeds in the center
- The halved shape showing the cavity
- The juicy custard-like texture

CHANGE:
- Warm editorial aesthetic (MarketKurly premium commerce style)
- Soft golden-hour natural light from upper-right
- Clean warm cream or pale butter background, slightly out of focus
- Place on aged light wood board or natural linen
- Minimal props: single wooden spoon or tiny bundled herbs
- Rich amber-yellow color grading, warm honey tones
- Subtle glossy sheen on the cut flesh showing natural juice
- Magazine-cover quality food photography
- Slightly elevated angle, 1:1 square composition

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, price tags, packaging, stickers.

Result: Warm, appetizing, premium editorial shot that pairs with the white melon shot as a complementary set.`,
  },
  {
    id: 'farm-editorial',
    input: path.join(SEOL, '설향 메론 (1).jpg'),
    prompt: `Transform this into an editorial farm-to-table photography shot of a Korean melon greenhouse farm.

KEEP EXACTLY:
- The greenhouse vinyl tunnel structure
- The melon vines and foliage on the ground
- The overall farm scene composition

CHANGE:
- Soft warm morning golden-hour natural light
- Slight atmospheric haze/mist in the background for depth
- Warm earthy natural color grading with rich greens
- Shallow depth of field with focus on foreground vines
- Premium agri-commerce magazine quality (29CM, MarketKurly brand stories)
- Peaceful and artisanal feel showing care and craft
- Photorealistic

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, people's faces clearly visible, visible signs or labels.

Result: Evocative farm story image that conveys care and premium origin.`,
  },
  {
    id: 'hand-scale',
    input: path.join(SEOL, '설향 메론 (8).jpg'),
    prompt: `Transform this into a warm commerce photography shot of a hand holding a Korean WHITE melon (설향/seol-hyang).

KEEP EXACTLY:
- The hand holding the melon
- The relative size showing the melon substantially fills the hand
- The natural oval shape of the melon and its pale creamy surface with subtle netting texture

CHANGE:
- Clean premium cream linen or soft pale wood background, out of focus
- Soft natural window light, warm skin tone on the hand
- Natural, elegant composition emphasizing the melon's weight and size
- Premium Korean fruit commerce aesthetic
- Subtle warm color grading

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, price tags, rings or jewelry with text, packaging.

Result: Size-reference hero that conveys the satisfying weight of a premium Korean melon.`,
  },
  {
    id: 'selection-box',
    input: path.join(SEOL, '설향 메론 (9).jpg'),
    prompt: `Transform this into a premium product photography shot of selected Korean melons in a gift box.

KEEP EXACTLY:
- The arrangement of melons in the box
- The number and placement of the melons

CHANGE:
- Replace the box with a clean minimalist kraft gift box or light birch wood crate
- Cream linen lining or soft natural paper cushioning visible
- Soft natural overhead light, gentle shadows
- Premium Korean fruit gift shop aesthetic (like Shinsegae Food Gift, MarketKurly premium)
- Subtle props: a single sprig of greenery or elegant twine
- Clean warm cream surrounding surface, slightly out of focus
- Slightly overhead angle

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, price tags, stickers, printed labels.

Result: Premium gift-quality selection image that conveys careful selection and luxurious presentation.`,
  },
  {
    id: 'hero-both-cut',
    combineInputs: [path.join(SEOL, '설향 메론 (6).jpg'), path.join(YANG, '양구 메론 (1).jpg')],
    prompt: `Transform this image (TWO melon halves shown side by side as reference: a WHITE / pale cream Korean melon half on the LEFT, a GOLDEN YELLOW Korean melon half on the RIGHT) into an irresistibly appetizing HERO product photo showing BOTH melon halves together in the same frame.

KEEP EXACTLY:
- TWO distinct melon halves visible together: one pale-cream WHITE flesh (seol-hyang variety) and one rich GOLDEN YELLOW flesh (yang-gu variety)
- The cut halved shape of both with seeds in the central cavity
- Both halves must appear obviously different in color so viewers can tell them apart

CHANGE:
- MOUTHWATERING close-up showing both halves arranged aesthetically (one slightly in front of the other, or angled to each other)
- Fresh moisture sheen, glossy custard-like flesh on both
- Soft warm natural sunlight from upper-left creating gentle highlights
- Clean premium background: cream linen fabric with gentle folds, slightly out of focus
- Shallow depth of field
- Korean premium fruit gift shop aesthetic (MarketKurly, 29CM, Ohora magazine quality)
- Slightly elevated 30° angle showing both cavities and flesh clearly
- Slight natural prop: a single mint leaf or small wooden spoon may appear subtly
- 1:1 square composition, both halves centered with breathing room

STRICTLY AVOID: Any text, watermark, logos, price tags, Korean/English characters, brand marks, packaging, stickers, overlays, collage/grid lines, seam between the two reference images. The final image must look like ONE natural photograph, not a side-by-side collage.

Result: An irresistible single hero photograph where both the white and yellow Korean melon halves coexist naturally in one scene, making viewers crave both varieties.`,
  },
  {
    id: 'selection-appetizing',
    combineInputs: [path.join(SEOL, '설향 메론 (6).jpg'), path.join(YANG, '양구 메론 (1).jpg')],
    prompt: `Transform this image (TWO Korean melon halves shown side by side as reference: WHITE / pale cream flesh on LEFT, GOLDEN YELLOW flesh on RIGHT) into a premium APPETIZING editorial food styling shot showing BOTH varieties as ready-to-eat cut pieces and halves.

KEEP EXACTLY:
- BOTH varieties — WHITE/cream melon flesh AND GOLDEN YELLOW melon flesh visible together
- The halved shape with seeds in cavity for at least one of each variety
- Both colors clearly distinguishable

CHANGE:
- Arrange melon halves AND several bite-sized peeled cubes or crescent slices on a premium wide wooden board or cream ceramic platter
- Rich moist glossy flesh, fresh just-cut appeal
- Visible natural juice droplets on the cut surfaces
- Soft warm natural window light from upper-left creating appetizing highlights
- Clean cream linen background, slightly out of focus
- Minimal elegant props: folded linen napkin, small wooden spoon, single mint sprig
- Premium MarketKurly / 29CM / Kinfolk food commerce aesthetic
- Slightly elevated 30° angle showing the abundance and variety

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, price tags, packaging, stickers, brand marks, collage/grid lines, seam between reference images. The final image must look like ONE natural photograph.

Result: An appetizing single photograph that screams "premium selected melons, ready to eat" and makes the viewer instantly crave both varieties.`,
  },
  {
    id: 'selection-box-both',
    combineInputs: [path.join(SEOL, '설향 메론 (9).jpg'), path.join(YANG, '양구 메론 (3).jpg')],
    prompt: `Transform this image (TWO Korean melon boxes shown side by side as reference: a box of WHITE / pale cream melons on the LEFT, a box of YELLOW melons on the RIGHT) into a single premium product photography shot showing ONE gift box that contains BOTH varieties of Korean melons together.

KEEP EXACTLY:
- Multiple Korean melons visible in a single box
- BOTH varieties present together: pale-cream WHITE melons (seol-hyang) AND golden YELLOW melons (yang-gu)
- Both varieties should be clearly distinguishable by color

CHANGE:
- One single clean minimalist kraft gift box OR light birch wood crate
- Melons arranged as a mixed premium gift set, white and yellow melons nestled together
- Cream linen lining or soft natural paper cushioning visible
- Soft natural overhead light, gentle shadows
- Premium Korean fruit gift shop aesthetic (Shinsegae Food Gift, MarketKurly premium)
- Subtle props: a single sprig of eucalyptus or elegant twine
- Clean warm cream surrounding surface, slightly out of focus
- Slightly overhead angle

STRICTLY AVOID: Any text, watermark, logos, Korean/English characters, brand marks, price tags, stickers, printed labels, collage/grid lines, seam between the two reference images. The final image must look like ONE natural photograph of one mixed gift box.

Result: Premium mixed-variety gift box image that conveys careful selection and luxurious presentation, with both white and yellow melons visible in the same box.`,
  },
];

async function restyleOne(job) {
  const outPath = path.join(OUT_DIR, `${job.id}.jpg`);
  if (fs.existsSync(outPath)) {
    console.log(`⏭  skip (exists): ${job.id}.jpg`);
    return outPath;
  }

  let inputBuffer;
  if (job.combineInputs) {
    const imgs = await Promise.all(
      job.combineInputs.map((p) => sharp(p).resize(512, 512, { fit: 'cover' }).toBuffer())
    );
    inputBuffer = await sharp({
      create: { width: 1024, height: 512, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([
        { input: imgs[0], left: 0, top: 0 },
        { input: imgs[1], left: 512, top: 0 },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  } else {
    inputBuffer = await sharp(job.input).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  }
  const base64 = inputBuffer.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: job.prompt },
      ],
    }],
  };

  console.log(`🎨 ${job.id}...`);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${job.id} HTTP ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart) {
    const textResponse = parts.find(p => p.text)?.text || '(no text)';
    throw new Error(`${job.id} no image. text: ${textResponse.slice(0, 200)}`);
  }
  const outBuf = Buffer.from(imagePart.inlineData.data, 'base64');
  const final = await sharp(outBuf).jpeg({ quality: 92 }).toBuffer();
  fs.writeFileSync(outPath, final);
  console.log(`  ✅ ${outPath} (${Math.round(final.length / 1024)}KB)`);
  return outPath;
}

(async () => {
  for (const job of JOBS) {
    try {
      await restyleOne(job);
    } catch (err) {
      console.error(`  ❌ ${job.id}: ${err.message}`);
    }
  }
  console.log('\n🎉 배치 완료');
})();
