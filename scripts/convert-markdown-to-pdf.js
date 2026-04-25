// 마크다운 → PDF 변환 (Playwright + marked CDN)
// 사용법: node scripts/convert-markdown-to-pdf.js <input.md> <output.pdf>

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('사용법: node scripts/convert-markdown-to-pdf.js <input.md> <output.pdf>');
    process.exit(1);
  }

  const md = fs.readFileSync(inputPath, 'utf8');
  const title = path.basename(inputPath, '.md');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      color: #1a1a1a;
      line-height: 1.65;
      font-size: 11pt;
      max-width: 100%;
    }
    h1 {
      font-size: 22pt;
      color: #1e3a8a;
      border-bottom: 3px solid #1e3a8a;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 15pt;
      color: #1e40af;
      margin-top: 24px;
      margin-bottom: 10px;
      padding-left: 10px;
      border-left: 4px solid #3b82f6;
    }
    h3 {
      font-size: 12pt;
      color: #374151;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    p { margin: 8px 0; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 9.5pt;
      color: #be185d;
    }
    pre {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-size: 9pt;
    }
    pre code { background: transparent; padding: 0; color: #111827; }
    table {
      border-collapse: collapse;
      margin: 12px 0;
      width: 100%;
      font-size: 10pt;
    }
    th {
      background: #eff6ff;
      color: #1e3a8a;
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #bfdbfe;
    }
    td {
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
    }
    tr:nth-child(even) td { background: #f9fafb; }
    blockquote {
      border-left: 4px solid #fbbf24;
      background: #fffbeb;
      padding: 8px 14px;
      margin: 12px 0;
      color: #78350f;
    }
    hr { border: none; border-top: 1px dashed #d1d5db; margin: 20px 0; }
    strong { color: #1e3a8a; font-weight: 700; }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 9pt;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="content"></div>
  <div class="footer">달콤살랑 야간 리서치 팀 자동 생성 · 2026-04-25</div>
  <script>
    const md = ${JSON.stringify(md)};
    marked.setOptions({ breaks: true, gfm: true });
    document.getElementById('content').innerHTML = marked.parse(md);
  </script>
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
  });
  await browser.close();
  console.log(`✅ PDF 저장: ${outputPath}`);
})().catch(err => {
  console.error('❌ PDF 변환 실패:', err);
  process.exit(1);
});
