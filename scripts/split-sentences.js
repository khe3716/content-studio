// 기존 네이버 HTML의 긴 <p> 단락을 문장 단위로 쪼개서 한 줄씩 보이게 변환.
// 사용: node scripts/split-sentences.js naver-blog/drafts/day-01-*.html
const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('경로 필요'); process.exit(1); }

let html = fs.readFileSync(p, 'utf8');

html = html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (m, attrs = '', content) => {
  if (content.trim() === '&nbsp;' || content.trim() === '') return m;
  if (/<img\b/i.test(content)) return m;
  if (content.length < 60) return m;
  const sentences = content
    .replace(/([.!?~。])\s+/g, '$1|__SPLIT__|')
    .split('|__SPLIT__|')
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return m;
  return sentences.map(s => `<p${attrs || ''}>${s}</p>`).join('\n');
});

// 그 후 네이버 줄바꿈 강화: 각 <p>/<h> 사이 빈 단락 재삽입 (중복 정리)
html = html.replace(/(<\/p>)\s*(<p[^>]*>)/gi, '$1\n<p style="text-align:center;">&nbsp;</p>\n$2');
html = html.replace(/(<p style="text-align:center;">&nbsp;<\/p>\s*){2,}/g, '<p style="text-align:center;">&nbsp;</p>\n');

fs.writeFileSync(p, html, 'utf8');
console.log('✅ 문장 단위 줄바꿈 적용:', p);
