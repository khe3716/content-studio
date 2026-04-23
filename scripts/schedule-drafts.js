// 쌓인 Blogger DRAFT를 오늘/내일/모레/... 슬롯에 순차 예약 발행
//
// 사용법:
//   node scripts/schedule-drafts.js --blog economy
//   node scripts/schedule-drafts.js --blog fruit
//   node scripts/schedule-drafts.js --blog economy --start-offset 1  # 내일부터
//   node scripts/schedule-drafts.js --blog economy --limit 3         # 최대 3편만
//   node scripts/schedule-drafts.js --blog fruit --dry-run           # 배정만 보고 실제 호출 X
//
// 슬롯:
//   economy: 하루 2편 (07:30 + 17:00 KST) → N편이면 Math.ceil(N/2)일
//   fruit:   하루 1편 (18:00 KST)         → N일 소요
//
// 과거 date의 슬롯은 자동 skip (이미 지난 슬롯은 예약 불가 → 다음 미래 슬롯)

const fs = require('fs');
const path = require('path');
const { allocateSlotsForCount, formatSlotKorean } = require('./slot-utils');

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
  const out = { startOffset: 0, limit: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--blog') out.blog = args[++i];
    else if (args[i] === '--start-offset') out.startOffset = parseInt(args[++i], 10);
    else if (args[i] === '--limit') out.limit = parseInt(args[++i], 10);
    else if (args[i] === '--dry-run') out.dryRun = true;
  }
  return out;
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data).slice(0, 300)}`);
  return data.access_token;
}

// Blogger에서 DRAFT 포스트 목록 (오래된 순)
async function listDrafts(token, blogId) {
  const all = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      status: 'DRAFT',
      fetchBodies: 'false',
      maxResults: '50',
      orderBy: 'updated',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`DRAFT 목록 조회 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.items) all.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  // 오래된 순 (updated 오름차순)
  all.sort((a, b) => new Date(a.updated) - new Date(b.updated));
  return all;
}

async function schedulePost(token, blogId, postId, publishDate) {
  const params = new URLSearchParams({ publishDate });
  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}/publish?${params}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(`publish API ${res.status}: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return result;
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('⚠️ 텔레그램 알림 실패:', e.message);
  }
}

async function main() {
  const args = parseArgs();
  if (!args.blog || !['economy', 'fruit'].includes(args.blog)) {
    console.error('❌ --blog economy 또는 --blog fruit 필수');
    process.exit(1);
  }

  const blogId = args.blog === 'fruit'
    ? (process.env.FRUIT_BLOG_ID)
    : (process.env.BLOG_ID);
  if (!blogId) {
    console.error(`❌ ${args.blog === 'fruit' ? 'FRUIT_BLOG_ID' : 'BLOG_ID'} 환경변수 필요`);
    process.exit(1);
  }

  console.log(`\n📋 ${args.blog === 'fruit' ? '🍎 과일' : '💰 경제'} 블로그 DRAFT 조회 중...`);
  const token = await getAccessToken();
  const drafts = await listDrafts(token, blogId);

  if (drafts.length === 0) {
    console.log('   DRAFT 없음.');
    await notifyTelegram(`ℹ️ <b>예약 스킵</b>\n${args.blog} 블로그에 DRAFT 없음.`);
    return;
  }

  const targets = args.limit ? drafts.slice(0, args.limit) : drafts;
  console.log(`   총 DRAFT ${drafts.length}개, 처리 대상 ${targets.length}개\n`);

  const slots = allocateSlotsForCount(args.blog, targets.length, { startOffset: args.startOffset });

  console.log('📅 배정 계획:');
  targets.forEach((post, i) => {
    console.log(`   ${i + 1}. [${post.id}] ${post.title.slice(0, 40)}`);
    console.log(`      → ${formatSlotKorean(slots[i].iso)} (${slots[i].slot}, offset+${slots[i].offsetDays})`);
  });
  console.log('');

  if (args.dryRun) {
    console.log('✋ --dry-run: 실제 예약은 실행 안 함.');
    return;
  }

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const post = targets[i];
    const slot = slots[i];
    try {
      await schedulePost(token, blogId, post.id, slot.iso);
      console.log(`✅ ${i + 1}/${targets.length}: "${post.title.slice(0, 30)}" → ${formatSlotKorean(slot.iso)}`);
      results.push({ post, slot, ok: true });
    } catch (e) {
      console.error(`❌ ${i + 1}/${targets.length}: "${post.title.slice(0, 30)}" 실패: ${e.message}`);
      results.push({ post, slot, ok: false, error: e.message });
    }
  }

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;

  console.log(`\n🎉 완료: 성공 ${okCount} / 실패 ${failCount}`);

  const blogLabel = args.blog === 'fruit' ? '🍎 과일' : '💰 경제';
  const lines = results.map((r, i) => {
    const icon = r.ok ? '✅' : '❌';
    const when = formatSlotKorean(r.slot.iso);
    return `${icon} <b>${when}</b>\n   ${escapeHtml(r.post.title.slice(0, 50))}`;
  });
  await notifyTelegram(
    `📅 <b>${blogLabel} 블로그 예약 발행 배정</b>\n\n` +
    `총 ${results.length}편 (성공 ${okCount} / 실패 ${failCount})\n\n` +
    lines.join('\n\n')
  );
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

main().catch(async err => {
  console.error('❌ 에러:', err);
  await notifyTelegram(`🚨 <b>예약 발행 스크립트 실패</b>\n\n${String(err.message || err).slice(0, 400)}`);
  process.exit(1);
});
