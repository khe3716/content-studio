// Day N1~N2 범위의 경제 블로그 썸네일 재생성 + 포스트 HTML의 썸네일 URL에 버전 쿼리 부가
//
// 사용법:
//   node scripts/refresh-economy-thumbnails.js --from 12 --to 21
//   node scripts/refresh-economy-thumbnails.js --days 12,13,14
//
// 동작:
//   1) topics.yaml에서 각 Day 정보 읽기
//   2) economy-blog/thumbnails/day-NN.png 재생성 (덮어쓰기)
//   3) 해당 SCHEDULED 포스트 찾아서 content HTML의 <img src>에 ?v=<timestamp> 붙여 Blogger 캐시 강제 무효화 (PATCH)

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { renderThumbnailPng } = require('../economy-blog/generate-thumbnail');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}
loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') out.from = parseInt(args[++i], 10);
    else if (args[i] === '--to') out.to = parseInt(args[++i], 10);
    else if (args[i] === '--days') out.days = args[++i].split(',').map(n => parseInt(n, 10));
    else if (args[i] === '--no-patch') out.noPatch = true;
  }
  return out;
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('토큰 발급 실패: ' + JSON.stringify(d).slice(0, 200));
  return d.access_token;
}

async function listPosts(token) {
  const all = [];
  for (const st of ['SCHEDULED', 'DRAFT']) {
    const u = `https://www.googleapis.com/blogger/v3/blogs/${process.env.BLOG_ID}/posts?status=${st}&fetchBodies=true&maxResults=50`;
    const res = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
    const d = await res.json();
    if (d.items) all.push(...d.items);
  }
  return all;
}

async function patchPostContent(token, postId, newContent) {
  const u = `https://www.googleapis.com/blogger/v3/blogs/${process.env.BLOG_ID}/posts/${postId}`;
  const res = await fetch(u, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: newContent }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const args = parseArgs();
  const dayList = args.days || (() => {
    const out = [];
    for (let d = args.from; d <= args.to; d++) out.push(d);
    return out;
  })();

  if (!dayList.length) {
    console.error('❌ --from N --to N 또는 --days 12,13,14 필요');
    process.exit(1);
  }

  const topicsPath = path.join(__dirname, '..', 'economy-blog', 'topics.yaml');
  const topicsData = yaml.load(fs.readFileSync(topicsPath, 'utf8'));

  const token = await getAccessToken();
  const posts = await listPosts(token);
  console.log(`📋 조회된 DRAFT/SCHEDULED: ${posts.length}편\n`);

  const stamp = Date.now();

  for (const day of dayList) {
    const topic = topicsData.topics.find(t => t.day === day);
    if (!topic) {
      console.warn(`⚠️ Day ${day} 주제 없음 in topics.yaml`);
      continue;
    }

    const dayId = `day-${String(day).padStart(2, '0')}`;
    const pngPath = path.join(__dirname, '..', 'economy-blog', 'thumbnails', `${dayId}.png`);

    // 1. 썸네일 재생성
    await renderThumbnailPng({
      title: topic.thumb_title,
      subtitle: topic.subtitle,
      brand: '경제 꿀팁, 하루 5분',
      emoji: topic.emoji,
      outputPath: pngPath,
    });
    const size = fs.statSync(pngPath).size;
    console.log(`✅ ${dayId} 썸네일 재생성 (${Math.round(size / 1024)}KB)`);

    // 2. 해당 post 찾기 & HTML patch
    if (!args.noPatch) {
      const match = posts.find(p => p.title === topic.title);
      if (!match) {
        console.warn(`   ⚠️ 일치하는 post 없음 (title: ${topic.title.slice(0, 30)})`);
        continue;
      }
      let content = match.content || '';
      // 기존 썸네일 URL에 ?v=stamp 붙이기 (이미 쿼리 있으면 교체)
      const repo = process.env.GITHUB_REPOSITORY || 'khe3716/content-studio';
      const pattern = new RegExp(`(https://raw\\.githubusercontent\\.com/${repo.replace('/', '\\/')}/main/economy-blog/thumbnails/${dayId}\\.png)(\\?v=\\d+)?`, 'g');
      const newUrl = `$1?v=${stamp}`;
      if (!pattern.test(content)) {
        console.warn(`   ⚠️ 썸네일 URL 패턴 못 찾음. 스킵.`);
        continue;
      }
      // re-test로 pattern 리셋
      pattern.lastIndex = 0;
      const newContent = content.replace(pattern, newUrl);
      await patchPostContent(token, match.id, newContent);
      console.log(`   🔄 post ${match.id} content 업데이트 (?v=${stamp})`);
    }
  }

  console.log(`\n🎉 완료 (stamp=${stamp})`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
