// 네이버 블로그 변환본 HTML 파일을 풀페이지 PNG로 렌더링
// node scripts/screenshot-naver-drafts.js --days 2,3,4,5

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { days: [2, 3, 4, 5] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') out.days = args[++i].split(',').map(n => parseInt(n, 10));
  }
  return out;
}

function findDraftFile(day) {
  const dir = path.join(__dirname, '..', 'naver-blog', 'drafts');
  const prefix = `day-${String(day).padStart(2, '0')}`;
  const matches = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.html'));
  return matches.length > 0 ? path.join(dir, matches[0]) : null;
}

async function main() {
  const { days } = parseArgs();
  const outDir = path.join(__dirname, '..', 'naver-blog', 'previews');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 1.5,
  });

  for (const day of days) {
    const file = findDraftFile(day);
    if (!file) {
      console.log(`⚠️ Day ${day} 파일 없음`);
      continue;
    }
    console.log(`📸 Day ${day}: ${path.basename(file)}`);

    const page = await context.newPage();
    // HTML을 네이버 블로그 스타일 래퍼로 감싸기
    const raw = fs.readFileSync(file, 'utf8');
    const wrapped = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #333; line-height: 1.75; font-size: 16px; }
  h1 { font-size: 24px; line-height: 1.4; margin: 40px 0 30px; color: #1a1a1a; font-weight: 800; }
  h2 { font-size: 20px; line-height: 1.4; margin: 50px 0 20px; color: #1a1a1a; font-weight: 700; border-left: 4px solid #ff6b35; padding-left: 12px; }
  h3 { font-size: 17px; margin: 30px 0 15px; color: #444; }
  p { margin: 0 0 20px; }
  strong { color: #e55a2b; font-weight: 700; }
  ol, ul { margin: 20px 0; padding-left: 24px; line-height: 1.9; }
  li { margin-bottom: 10px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 40px 0; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
  blockquote { border-left: 3px solid #ff6b35; padding: 8px 16px; margin: 20px 0; background: #fff8f0; }
  table { border-collapse: collapse; width: 100%; margin: 20px 0; }
  td, th { border: 1px solid #ddd; padding: 10px; }
</style>
</head>
<body>
${raw}
</body>
</html>`;
    await page.setContent(wrapped, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const outPath = path.join(outDir, `day-${String(day).padStart(2, '0')}-preview.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`   ✓ ${outPath.split(/[\\/]/).pop()} (${sizeKB}KB)`);
    await page.close();
  }

  await browser.close();
  console.log(`\n📁 저장 위치: ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
