// 기존 네이버 HTML에 박스형 섹션 헤더를 소급 적용.
// 사용: node scripts/add-section-boxes.js naver-blog/drafts/day-01-*.html
const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('경로 필요'); process.exit(1); }

let html = fs.readFileSync(p, 'utf8');

html = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (m, attrs = '', content) => {
  if (/border:1\.?5?px|naver-section-box/i.test(content)) return m;
  const inner = content.trim();
  const boxSpan = `<span style="display:inline-block; padding:10px 32px; border:1.5px solid #d0d0d0; border-radius:28px; background:#fff; font-weight:700; color:#333;">${inner}</span>`;
  return `<h2 style="text-align:center; margin:56px 0 28px;">${boxSpan}</h2>`;
});

fs.writeFileSync(p, html, 'utf8');
console.log('✅ 섹션 박스 헤더 적용:', p);
