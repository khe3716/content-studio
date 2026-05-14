// 재테크 팀 — 메인 오케스트레이터
//
// 사용법:
//   node scripts/finance-team/run.js --day 4
//   node scripts/finance-team/run.js --slug salary-30-savings-1y-simulation
//   node scripts/finance-team/run.js --day 4 --publish now           # DRAFT가 아닌 즉시 발행
//   node scripts/finance-team/run.js --day 4 --publish 2026-05-04T08:00:00+09:00  # 예약
//   node scripts/finance-team/run.js --day 4 --skip-video           # 영상 없이 글만
//   node scripts/finance-team/run.js --day 4 --skip-publish         # 발행 단계 생략 (로컬만)
//
// 단계:
//   1. researcher  → research/{slug}.json
//   2. copywriter  → drafts/{slug}.html + narration.json + meta.json
//   3. images      → images/{slug}-*.jpg (generate-images.js)
//   4. tts         → remotion/public/audio/{slug}-*.wav (generate-tts.js)
//   5. video       → videos/{slug}-{long,short}.mp4 (Remotion render)
//   6. publish     → Blogspot DRAFT/발행 (publish-finance.js)
//
// 환경변수:
//   GEMINI_API_KEY (필수, write-draft.js)
//   FINANCE_BLOG_ID (publish 시 필수)
//   GOOGLE_CLIENT_ID / SECRET / REFRESH_TOKEN (publish 시 필수)
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (선택, 진행 알림)

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawn } = require('child_process');

const { REPO_ROOT, notifyTelegram } = require('./lib');

const TOPICS_PATH = path.join(REPO_ROOT, 'finance-blog', 'topics.yaml');

// ========== 인자 파싱 ==========
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    day: null,
    slug: null,
    publish: null,
    skipVideo: false,
    skipPublish: false,
    forceTrend: false,
    trending: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--day' && args[i + 1]) { out.day = parseInt(args[i + 1], 10); i += 1; }
    else if (args[i] === '--slug' && args[i + 1]) { out.slug = args[i + 1]; i += 1; }
    else if (args[i] === '--publish' && args[i + 1]) { out.publish = args[i + 1]; i += 1; }
    else if (args[i] === '--skip-video') out.skipVideo = true;
    else if (args[i] === '--skip-publish') out.skipPublish = true;
    else if (args[i] === '--force-trend') out.forceTrend = true;
    else if (args[i] === '--trending') out.trending = true;
  }
  if (!out.day && !out.slug && !out.trending) {
    console.error('❌ --day N | --slug <slug> | --trending 중 하나 필요');
    process.exit(1);
  }
  return out;
}

// 트렌드 키워드를 박재은 토픽으로 변환 + topics.yaml에 추가
function createTrendingTopic() {
  const { spawnSync } = require('child_process');
  console.log('🔍 트렌드 조사 중 (네이버 + 구글)...');
  const r = spawnSync('node', ['scripts/trend-research.js', '--count', '20'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`트렌드 조사 실패: ${r.stderr}`);
  const trendData = JSON.parse(r.stdout);

  // 최근 발행 토픽 키워드 회피
  const config = yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const recentTitles = (config.topics || []).slice(-10).map(t => t.title || '').join(' ');
  const pick = trendData.keywords.find(k => !recentTitles.includes(k.keyword)) || trendData.keywords[0];
  if (!pick) throw new Error('트렌드 키워드 추출 실패');
  console.log(`   ✓ 선정 키워드: ${pick.keyword} (점수 ${pick.total_score})`);

  // 카테고리 + 이모지 자동 추론
  const k = pick.keyword;
  let category = 'savings';
  let emoji = '🏦';
  if (/대출|디딤돌|버팀목|마이너스|전세자금/.test(k)) { category = 'loan'; emoji = '💸'; }
  else if (/카드|체크카드|마일리지|포인트/.test(k)) { category = 'card'; emoji = '💳'; }
  else if (/보험|실손|암보험|치아|자동차보험/.test(k)) { category = 'insurance'; emoji = '🛡️'; }
  else if (/주식|코스피|비트코인|환율|투자|펀드/.test(k)) { emoji = '📈'; }

  // pattern + 제목 어미 자동 추론 (박재은 페르소나 패턴)
  let pattern = 'guide';
  let titleSuffix = '꼭 알아야 할 5가지';
  if (/TOP|순위|랭킹/.test(k)) { pattern = 'ranking'; titleSuffix = 'TOP 5'; }
  else if (/vs|차이/.test(k)) { pattern = 'vs'; titleSuffix = '뭐가 다른가요?'; }

  const nextDay = ((config.topics || []).slice(-1)[0]?.day || 0) + 1;
  // ASCII-safe slug (한글 URL 인코딩 이슈 방지 — Blogger raw 이미지 호스팅 안정성)
  const slug = `${category}-${Date.now()}`;
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const topic = {
    day: nextDay,
    slug,
    category,
    title: `${year}년 ${month}월 ${k} ${titleSuffix} ${emoji}`,
    keywords: [k, '재테크', '월급쟁이'],
    season: `${month}월`,
    pattern,
    trending_source: pick.sources,
    trending_score: pick.total_score,
  };
  config.topics = config.topics || [];
  config.topics.push(topic);
  fs.writeFileSync(TOPICS_PATH, yaml.dump(config, { lineWidth: 120, noRefs: true }), 'utf8');
  console.log(`   ✓ 임시 토픽 Day ${nextDay} 추가 (category=${category}, pattern=${pattern})\n`);
  return slug;
}

// ========== 토픽에서 slug 해석 ==========
function resolveSlug({ day, slug }) {
  if (slug) return slug;
  const config = yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const topic = (config.topics || []).find(t => t.day === day);
  if (!topic) throw new Error(`Day ${day} 토픽 없음 (topics.yaml 확인)`);
  return topic.slug;
}

// ========== 자식 프로세스 ==========
function run(cmd, args, cwd = REPO_ROOT) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    p.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))
    );
  });
}

// ========== 단계 ==========
async function stepResearch({ day, slug, forceTrend }) {
  const args = ['scripts/finance-team/research.js'];
  if (day) args.push('--day', String(day));
  else args.push('--slug', slug);
  if (forceTrend) args.push('--force');
  await run('node', args);
}

async function stepWrite({ slug }) {
  await run('node', ['scripts/finance-team/write-draft.js', '--slug', slug]);
}

async function stepImages({ slug }) {
  await run('node', ['scripts/finance-team/generate-images.js', slug]);
}

async function stepTTS({ slug }) {
  await run('node', ['scripts/finance-team/generate-tts.js', slug]);
}

async function stepVideo({ slug }) {
  const remDir = path.join(REPO_ROOT, 'finance-blog', 'remotion');
  await run('npx', ['remotion', 'render', 'src/index.ts', 'LongForm', `out/${slug}-long.mp4`], remDir);
  await run('npx', ['remotion', 'render', 'src/index.ts', 'ShortForm', `out/${slug}-short.mp4`], remDir);
  // out → videos 복사
  const videosDir = path.join(REPO_ROOT, 'finance-blog', 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  fs.copyFileSync(
    path.join(remDir, 'out', `${slug}-long.mp4`),
    path.join(videosDir, `${slug}-long.mp4`)
  );
  fs.copyFileSync(
    path.join(remDir, 'out', `${slug}-short.mp4`),
    path.join(videosDir, `${slug}-short.mp4`)
  );
}

async function stepPublish({ slug, publish }) {
  const args = ['scripts/finance-team/publish-finance.js', '--slug', slug];
  if (publish) args.push('--publish', publish);
  await run('node', args);
}

// ========== 메인 ==========
(async () => {
  const opts = parseArgs();
  if (opts.trending && !opts.slug && !opts.day) {
    opts.slug = createTrendingTopic();
  }
  const slug = resolveSlug(opts);
  const t0 = Date.now();

  console.log('\n' + '═'.repeat(60));
  console.log(`▶ 재테크 팀 풀 파이프라인 시작 — ${slug}`);
  console.log('═'.repeat(60));
  await notifyTelegram(`💼 재테크 자동화 시작\nslug: \`${slug}\``);

  const steps = [];

  console.log('\n[1/6] 🔎 Researcher (Datalab + 플레이북)');
  await stepResearch({ day: opts.day, slug, forceTrend: opts.forceTrend });
  steps.push('research');

  console.log('\n[2/6] ✍️  Copywriter (박재은 본문 + 영상 대본)');
  await stepWrite({ slug });
  steps.push('write');

  console.log('\n[3/6] 🎨 Image Generator (Nano Banana)');
  await stepImages({ slug });
  steps.push('images');

  if (opts.skipVideo) {
    console.log('\n[4-5/6] ⏭  영상 단계 스킵 (--skip-video)');
  } else {
    console.log('\n[4/6] 🎙️  TTS (Gemini Leda 1.3x)');
    await stepTTS({ slug });
    steps.push('tts');

    console.log('\n[5/6] 🎬 Remotion 렌더 (롱폼 + 쇼츠)');
    await stepVideo({ slug });
    steps.push('video');
  }

  if (opts.skipPublish) {
    console.log('\n[6/6] ⏭  발행 단계 스킵 (--skip-publish)');
  } else {
    console.log('\n[6/6] 📤 Blogspot 업로드');
    await stepPublish({ slug, publish: opts.publish });
    steps.push('publish');
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log(`✓ 풀 파이프라인 완료 (${elapsed}s)`);
  console.log(`  단계: ${steps.join(' → ')}`);
  console.log('═'.repeat(60));

  await notifyTelegram(
    `✅ 재테크 자동화 완료 (${elapsed}s)\nslug: \`${slug}\`\n단계: ${steps.join(' → ')}`
  );
})().catch(async e => {
  console.error('\n❌ 파이프라인 실패:', e.message);
  await notifyTelegram(`❌ 재테크 자동화 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
