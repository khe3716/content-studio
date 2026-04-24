const fs = require('fs');
const p = 'naver-blog/drafts/day-01-how-to-pick-korean-raspberry.html';
const stamp = Date.now();
let html = fs.readFileSync(p, 'utf8');
['2', '9'].forEach(n => {
  const file = 'day-01-naver-1777007589438-' + n + '.jpg';
  html = html.split(file + '"').join(file + '?v=' + stamp + '"');
});
fs.writeFileSync(p, html, 'utf8');
console.log('Cache-bust applied: v=' + stamp);
