const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, 'output', 'peach-house');
const OUT_FINAL = path.join(SRC, 'peach-house-final.jpg');

async function main() {
  const files = Array.from({ length: 10 }, (_, i) => path.join(SRC, `${String(i + 1).padStart(2, '0')}-detail.jpg`));

  for (const f of files) {
    if (!fs.existsSync(f)) throw new Error(`Missing: ${f}`);
  }

  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const targetWidth = Math.min(...metas.map((m) => m.width));
  const totalHeight = metas.reduce((sum, m) => sum + Math.round((m.height * targetWidth) / m.width), 0);

  console.log(`Combined size: ${targetWidth} x ${totalHeight}`);

  const buffers = await Promise.all(
    files.map((f) => sharp(f).resize({ width: targetWidth }).toBuffer())
  );

  const composites = [];
  let y = 0;
  for (let i = 0; i < buffers.length; i++) {
    const m = await sharp(buffers[i]).metadata();
    composites.push({ input: buffers[i], top: y, left: 0 });
    y += m.height;
  }

  await sharp({
    create: {
      width: targetWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(OUT_FINAL);

  const stats = fs.statSync(OUT_FINAL);
  console.log(`Saved: ${OUT_FINAL} (${Math.round(stats.size / 1024)}KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
