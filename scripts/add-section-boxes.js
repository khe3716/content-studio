// 기존 네이버 HTML의 <h2>를 네이버 친화 스타일(유니코드 구분선 + 배경색 헤더)로 변환.
// 사용: node scripts/add-section-boxes.js naver-blog/drafts/day-01-*.html
const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('경로 필요'); process.exit(1); }

let html = fs.readFileSync(p, 'utf8');

html = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (m, attrs = '', content) => {
  // 기존 span·strong 장식 제거
  const inner = content.replace(/<\/?span[^>]*>/gi, '').replace(/<\/?strong>/gi, '').trim();
  const divider = `<p style="text-align:center;"><span style="color:#cccccc; font-size:14pt;">━━━━━━━━━━━━━━</span></p>\n<p style="text-align:center;">&nbsp;</p>`;
  const h2New = `<h2 style="text-align:center; background-color:#fdf6e3; padding:14px; font-size:17pt; color:#2a2a2a;"><strong>${inner}</strong></h2>`;
  return `<p style="text-align:center;">&nbsp;</p>\n${divider}\n${h2New}`;
});

// 중복 빈 단락 정리 (연속 3개 이상 → 1개)
html = html.replace(/(<p style="text-align:center;">&nbsp;<\/p>\n){3,}/g, '<p style="text-align:center;">&nbsp;</p>\n');

fs.writeFileSync(p, html, 'utf8');
console.log('✅ 섹션 헤더 네이버 친화 스타일 적용:', p);
