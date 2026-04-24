// 설향·양구 메론 사진 19장을 그리드로 합쳐서 한눈에 확인
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SEOL = path.join(ROOT, 'fruit-blog', 'detail-pages', 'source-photos', '설향 메론-', '설향 메론');
const YANG = path.join(ROOT, 'fruit-blog', 'detail-pages', 'source-photos', '양구 메론-', '양구 메론');
const OUT = path.join(ROOT, 'tmp', 'seol-yang-photos-grid.png');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

(async () => {
  const files = [];
  for (let i = 1; i <= 11; i++) files.push({ path: path.join(SEOL, `설향 메론 (${i}).jpg`), label: `설향${i}` });
  for (let i = 1; i <= 8; i++) files.push({ path: path.join(YANG, `양구 메론 (${i}).jpg`), label: `양구${i}` });

  const CELL = 240, LABEL_H = 30, COLS = 5;
  const ROWS = Math.ceil(files.length / COLS);
  const W = CELL * COLS, H = (CELL + LABEL_H) * ROWS;
  const layers = [];

  for (let i = 0; i < files.length; i++) {
    const row = Math.floor(i / COLS), col = i % COLS;
    const img = await sharp(files[i].path).resize(CELL, CELL, { fit: 'cover' }).toBuffer();
    const labelSvg = `<svg width="${CELL}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg"><rect width="${CELL}" height="${LABEL_H}" fill="white"/><text x="${CELL / 2}" y="20" font-family="Arial" font-weight="bold" font-size="15" fill="black" text-anchor="middle">${files[i].label}</text></svg>`;
    const label = await sharp(Buffer.from(labelSvg)).png().toBuffer();
    layers.push({ input: img, top: row * (CELL + LABEL_H), left: col * CELL });
    layers.push({ input: label, top: row * (CELL + LABEL_H) + CELL, left: col * CELL });
  }

  const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).composite(layers).png({ quality: 85 }).toBuffer();
  fs.writeFileSync(OUT, out);
  console.log('✅', OUT);
})();
