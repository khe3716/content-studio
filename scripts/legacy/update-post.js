// 이미 올린 Blogger 임시저장 글 덮어쓰기
// 사용법: node update-post.js <postId> <htmlFilePath>
// 예: node update-post.js 3154918719720612937 economy-blog/drafts/day-03-danri.html

const fs = require('fs');
const path = require('path');

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
const postId = process.argv[2];
const htmlFile = process.argv[3];
const title = process.argv[4]; // 선택: 제목 교체
const labelsArg = process.argv[5]; // 선택: 라벨 쉼표 구분

if (!postId || !htmlFile) {
  console.error('사용법: node update-post.js <postId> <htmlFilePath> [title] [labels]');
  process.exit(1);
}

// ========== access_token 발급 ==========
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

// ========== 기존 글 가져오기 (제목·라벨 유지 위해) ==========
async function getPost(accessToken) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}?view=AUTHOR`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (res.status !== 200) {
    console.error('❌ 기존 글 조회 실패:', await res.text());
    process.exit(1);
  }
  return res.json();
}

// ========== 글 업데이트 ==========
async function updatePost(accessToken) {
  console.log('⏳ 기존 글 정보 확인 중...');
  const existing = await getPost(accessToken);
  console.log('✓ 기존 글:', existing.title);

  const content = fs.readFileSync(path.join(__dirname, htmlFile), 'utf8');

  const body = {
    kind: 'blogger#post',
    id: postId,
    title: title || existing.title,
    content: content,
    labels: labelsArg ? labelsArg.split(',') : existing.labels,
  };

  console.log('⏳ 글 내용 덮어쓰기 중...');
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 업데이트 실패:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('  ✅ 글 덮어쓰기 성공!');
  console.log('========================================\n');
  console.log('제목:', result.title);
  console.log('포스트 ID:', result.id);
  console.log('상태:', result.status || 'DRAFT');
  console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);
}

// ========== 실행 ==========
(async () => {
  try {
    const token = await getAccessToken();
    await updatePost(token);
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
