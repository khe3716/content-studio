// 글에 썸네일 자동 삽입 + Blogger 업데이트 (제목도 교체 가능)
// 사용법: node add-thumbnail.js <postId> <svgPath> <htmlPath> [newTitle]
// 예: node add-thumbnail.js 3154918719720612937 economy-blog/thumbnails/day-03.svg economy-blog/drafts/day-03-danri.html "단리란? 복리와 차이 한번에 정리"

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
});
const { BLOG_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env;

const postId = process.argv[2];
const svgPath = process.argv[3];
const htmlPath = process.argv[4];
const newTitle = process.argv[5]; // 선택: 제목 교체

if (!postId || !svgPath || !htmlPath) {
  console.error('사용법: node add-thumbnail.js <postId> <svgPath> <htmlPath> [newTitle]');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('❌ access_token 발급 실패:', data);
    process.exit(1);
  }
  return data.access_token;
}

async function getPost(accessToken) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}?view=AUTHOR`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 200) {
    console.error('❌ 기존 글 조회 실패:', await res.text());
    process.exit(1);
  }
  return res.json();
}

async function updatePost(accessToken, title, labels, newContent) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'blogger#post',
      id: postId,
      title,
      content: newContent,
      labels,
    }),
  });
  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 업데이트 실패:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  return result;
}

(async () => {
  try {
    // generate-thumbnail.js에서 이미 만든 PNG 파일을 그대로 사용 (슈퍼샘플링 적용된 버전)
    const pngPath = svgPath.replace('.svg', '.png');
    const pngFullPath = path.join(__dirname, pngPath);
    if (!fs.existsSync(pngFullPath)) {
      console.error(`❌ PNG 파일 없음: ${pngPath}\n먼저 generate-thumbnail.js를 실행하세요.`);
      process.exit(1);
    }
    const pngBuffer = fs.readFileSync(pngFullPath);
    console.log(`✓ PNG 로드: ${pngPath} (${Math.round(pngBuffer.length / 1024)}KB)`);

    // 2. base64 인코딩
    const base64 = pngBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    // 3. HTML 읽고 맨 위에 이미지 삽입
    console.log('⏳ HTML에 썸네일 삽입 중...');
    const originalHtml = fs.readFileSync(path.join(__dirname, htmlPath), 'utf8');

    const thumbnailTag = `<div style="text-align:center;margin:0 0 24px 0;"><img src="${dataUrl}" alt="썸네일" style="max-width:100%;height:auto;border-radius:8px;" /></div>\n`;

    // 기존 썸네일 제거 (중복 방지)
    const cleanedHtml = originalHtml.replace(
      /<div style="text-align:center;margin:0 0 24px 0;"><img src="data:image\/png;base64,[^"]+" alt="썸네일"[^>]*\/><\/div>\s*/g,
      ''
    );
    const newHtml = thumbnailTag + cleanedHtml;

    fs.writeFileSync(path.join(__dirname, htmlPath), newHtml);
    console.log('✓ 로컬 HTML 업데이트 완료');

    // 4. Blogger에 업로드
    console.log('⏳ Blogger 글 덮어쓰기 중...');
    const token = await getAccessToken();
    const existing = await getPost(token);
    const finalTitle = newTitle || existing.title;
    const result = await updatePost(token, finalTitle, existing.labels || [], newHtml);

    console.log('\n========================================');
    console.log('  ✅ 완료!');
    console.log('========================================\n');
    console.log('제목:', result.title);
    console.log('상태:', result.status || 'DRAFT');
    console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
