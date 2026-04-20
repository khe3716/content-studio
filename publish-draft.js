// 새 글을 Blogger에 임시저장으로 업로드 (썸네일 자동 생성·삽입 포함)
//
// 사용법:
//   node publish-draft.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>"
//
// postTitle = Blogger 글 제목 (SEO용, 길어도 OK)
// thumbTitle = 썸네일 안에 들어갈 짧은 제목 (5자 이내 권장)
//
// 예시:
//   node publish-draft.js day-04 money-bag "이자란? 이자 종류 기본 정리" "이자란?" "이자 개념과 종류," "한 번에 정리!" economy-blog/drafts/day-04-ija.html "경제기초,이자,재테크입문,경제용어"

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { renderThumbnailPng } = require('./economy-blog/generate-thumbnail');

// ========== .env 읽기 ==========
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

// ========== 인자 파싱 ==========
const [dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labelsStr] = process.argv.slice(2);
if (!dayId || !emoji || !postTitle || !thumbTitle || !htmlPath) {
  console.error(
    '사용법: node publish-draft.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>"'
  );
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

async function uploadDraft(accessToken, title, labels, content) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?isDraft=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'blogger#post',
      title,
      content,
      labels,
    }),
  });
  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 업로드 실패:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  return result;
}

(async () => {
  try {
    // 1. 썸네일 생성
    console.log(`\n[1/3] 🎨 ${dayId} 썸네일 생성 중...`);
    const thumbDir = path.join(__dirname, 'economy-blog', 'thumbnails');
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
    const pngPath = path.join(thumbDir, `${dayId}.png`);
    const svgPath = path.join(thumbDir, `${dayId}.svg`);

    const { svg, pngBuffer } = await renderThumbnailPng({
      title: thumbTitle,
      subtitle: [sub1, sub2].filter(Boolean),
      brand: '경제 꿀팁, 하루 5분',
      emoji,
      outputPath: pngPath,
    });
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`  ✓ 썸네일: ${pngPath} (${Math.round(pngBuffer.length / 1024)}KB)`);

    // 2. HTML에 썸네일 삽입
    console.log(`\n[2/3] 📝 HTML에 썸네일 삽입 중...`);
    const htmlFullPath = path.join(__dirname, htmlPath);
    const originalHtml = fs.readFileSync(htmlFullPath, 'utf8');
    const base64 = pngBuffer.toString('base64');
    const thumbnailTag = `<div style="text-align:center;margin:0 0 24px 0;"><img src="data:image/png;base64,${base64}" alt="썸네일" style="max-width:100%;height:auto;border-radius:8px;" /></div>\n`;
    // 기존 썸네일 제거 (중복 방지)
    const cleanedHtml = originalHtml.replace(
      /<div style="text-align:center;margin:0 0 24px 0;"><img src="data:image\/png;base64,[^"]+" alt="썸네일"[^>]*\/><\/div>\s*/g,
      ''
    );
    const finalHtml = thumbnailTag + cleanedHtml;
    fs.writeFileSync(htmlFullPath, finalHtml);
    console.log(`  ✓ HTML 업데이트됨: ${htmlPath}`);

    // 3. Blogger에 임시저장 업로드
    console.log(`\n[3/3] ☁️  Blogger에 임시저장 업로드 중...`);
    const token = await getAccessToken();
    const labels = labelsStr ? labelsStr.split(',').map(s => s.trim()) : [];
    const result = await uploadDraft(token, postTitle, labels, finalHtml);

    console.log('\n========================================');
    console.log('  ✅ Day 업로드 완료!');
    console.log('========================================\n');
    console.log('제목:', result.title);
    console.log('포스트 ID:', result.id);
    console.log('상태:', result.status || 'DRAFT');
    console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);
    console.log('\n➡️  Blogger에서 확인 후 퍼머링크 설정 + 예약 발행하세요.');
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
