// Blogger CDN 캐시 문제 해결용
// Blogger에서 포스트를 읽어 모든 img 태그 제거 → 새 썸네일 삽입 → PUT
//
// 사용법: node force-thumbnail-refresh.js <postId> <pngPath>

const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});
const { BLOG_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env;

const postId = process.argv[2];
const pngPath = process.argv[3];
if (!postId || !pngPath) {
  console.error('사용법: node force-thumbnail-refresh.js <postId> <pngPath>');
  process.exit(1);
}

async function getToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  return (await r.json()).access_token;
}

(async () => {
  const token = await getToken();

  // 1. 현재 포스트 읽기
  console.log('⏳ Blogger에서 현재 포스트 읽는 중...');
  const getRes = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}?view=AUTHOR`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const post = await getRes.json();
  console.log('✓ 제목:', post.title);
  console.log('✓ 상태:', post.status);

  // 2. 모든 img 태그를 포함한 div 제거 (Blogger 포맷·로컬 포맷 모두 대응)
  let cleanedContent = post.content;
  // (a) data: base64 형태
  cleanedContent = cleanedContent.replace(
    /<div[^>]*>\s*<img[^>]*src="data:image\/[^"]+"[^>]*\/?>\s*<\/div>/g,
    ''
  );
  // (b) Blogger CDN 형태
  cleanedContent = cleanedContent.replace(
    /<div[^>]*>\s*<img[^>]*src="https:\/\/blogger\.googleusercontent\.com[^"]+"[^>]*\/?>\s*<\/div>/g,
    ''
  );
  // (c) 앞쪽 연속 개행 제거
  cleanedContent = cleanedContent.replace(/^\s+/, '');

  console.log('✓ 기존 img 태그 제거 완료');
  const remainingImgs = cleanedContent.match(/<img[^>]*>/g);
  console.log(`  남은 img 태그: ${remainingImgs ? remainingImgs.length : 0}개`);

  // 3. 새 썸네일 base64로 임베드
  const pngBuffer = fs.readFileSync(path.join(__dirname, pngPath));
  const base64 = pngBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  const thumbnailTag = `<div style="text-align:center;margin:0 0 24px 0;"><img src="${dataUrl}" alt="썸네일" style="max-width:100%;height:auto;border-radius:8px;" /></div>\n`;
  const newContent = thumbnailTag + cleanedContent;

  console.log(`⏳ 새 썸네일 PUT 중... (썸네일 크기: ${Math.round(pngBuffer.length / 1024)}KB)`);

  // 4. PUT
  const putRes = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'blogger#post',
        id: postId,
        title: post.title,
        content: newContent,
        labels: post.labels || [],
      }),
    }
  );
  const result = await putRes.json();
  if (putRes.status !== 200) {
    console.error('❌ PUT 실패:', result);
    process.exit(1);
  }

  console.log('\n✅ 완료!');
  console.log('제목:', result.title);
  console.log('상태:', result.status);
  console.log('편집:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);
  console.log('\nBlogger 편집 페이지에서 Ctrl+Shift+R (강제 새로고침)');
})();
