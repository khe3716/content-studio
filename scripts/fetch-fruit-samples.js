// 과일 블로그 기존 글 5편을 Blogger API로 가져와 fruit-blog/samples/에 저장
// Gemini few-shot 학습용 — 사장님 기존 글 스타일 90%+ 모방 가능해짐
//
// 사용법: node scripts/fetch-fruit-samples.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
}
const BLOG_ID = env.FRUIT_BLOG_ID || process.env.FRUIT_BLOG_ID;
const CLIENT_ID = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

if (!BLOG_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ 환경변수 누락: FRUIT_BLOG_ID / GOOGLE_*');
  process.exit(1);
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) {
    console.error('❌ 토큰 발급 실패:', d);
    process.exit(1);
  }
  return d.access_token;
}

async function listPosts(token, maxResults = 5) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?status=live&maxResults=${maxResults}&orderBy=published&fetchBodies=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error('❌ 글 목록 조회 실패:', await res.text());
    process.exit(1);
  }
  const d = await res.json();
  return d.items || [];
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

// Blogger HTML에서 학습에 쓸 핵심만 추출 (이미지·스크립트·광고 제거)
function extractCoreContent(html) {
  return html
    // 이미지 div 블록 제거
    .replace(/<div[^>]*text-align:center[^>]*>\s*<img[^>]*\/?>[\s\S]*?<\/div>/gi, '')
    // 단독 img 태그 제거
    .replace(/<img[^>]*\/?>/gi, '')
    // script·style·iframe 제거
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    // 빈 div·p 정리
    .replace(/<div[^>]*>\s*<\/div>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

(async () => {
  console.log('🔑 액세스 토큰 발급 중...');
  const token = await getAccessToken();

  console.log('📥 기존 글 5편 조회 중...');
  const posts = await listPosts(token, 5);
  console.log(`   ✓ ${posts.length}개 글 발견\n`);

  const samplesDir = path.join(__dirname, '..', 'fruit-blog', 'samples');
  if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true });

  const index = [];
  for (const [i, post] of posts.entries()) {
    const title = post.title || `untitled-${i + 1}`;
    const slug = slugify(title) || `sample-${i + 1}`;
    const filename = `${String(i + 1).padStart(2, '0')}-${slug}.html`;
    const filepath = path.join(samplesDir, filename);
    const core = extractCoreContent(post.content || '');

    fs.writeFileSync(filepath, core, 'utf8');
    const sizeKB = Math.round(core.length / 1024);
    console.log(`   ${i + 1}. ${filename} (${sizeKB}KB, ${core.length}자)`);
    console.log(`      제목: ${title}`);

    index.push({
      file: filename,
      title,
      url: post.url,
      published: post.published,
      labels: post.labels || [],
      chars: core.length,
    });
  }

  const indexPath = path.join(samplesDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`\n💾 인덱스 저장: fruit-blog/samples/index.json`);
  console.log(`\n🎉 완료! 박과일이 이 글들을 학습해서 스타일 모방합니다.`);
})().catch(err => {
  console.error('❌ 실패:', err);
  process.exit(1);
});
