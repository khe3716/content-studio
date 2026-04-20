// Day 3 (단리) 글을 Blogger에 임시저장으로 업로드

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

const {
  BLOG_ID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
} = env;

// ========== 1단계: refresh_token → access_token 교환 ==========
async function getAccessToken() {
  console.log('⏳ access_token 발급 중...');
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
  console.log('✓ access_token 받음');
  return data.access_token;
}

// ========== 2단계: 글 내용 준비 ==========
const htmlPath = path.join(__dirname, 'economy-blog', 'drafts', 'day-03-danri.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const postData = {
  kind: 'blogger#post',
  title: '📌 Day 3: 단리란? 복리와 차이 한번에 정리',
  content: content,
  labels: ['경제기초', '단리', '복리', '재테크입문', '경제용어'],
};

// ========== 3단계: Blogger에 임시저장으로 업로드 ==========
async function uploadDraft(accessToken) {
  console.log('⏳ Blogger에 임시저장으로 업로드 중...');
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?isDraft=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postData),
  });

  const result = await res.json();

  if (res.status !== 200) {
    console.error('❌ 업로드 실패:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('  ✅ Day 3 임시저장 업로드 성공!');
  console.log('========================================\n');
  console.log('제목:', result.title);
  console.log('포스트 ID:', result.id);
  console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);
  console.log('상태:', result.status || 'DRAFT');
  console.log('\n이제 Blogger 관리자 페이지에서 확인하고 "게시" 버튼 누르시면 공개됩니다.');
}

// ========== 실행 ==========
(async () => {
  try {
    const token = await getAccessToken();
    await uploadDraft(token);
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
