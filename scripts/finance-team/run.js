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

// ========== Blogger OAuth (회피 풀 fetch용) ==========
async function getBloggerAccessToken() {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await tokenRes.json();
  if (!data.access_token) throw new Error('Blogger 토큰 발급 실패: ' + JSON.stringify(data));
  return data.access_token;
}

// 트렌드 키워드를 박재은 토픽으로 변환 + topics.yaml에 추가
async function createTrendingTopic() {
  const { spawnSync } = require('child_process');
  console.log('🔍 트렌드 조사 중 (네이버 + 구글)...');
  const r = spawnSync('node', ['scripts/trend-research.js', '--count', '20'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`트렌드 조사 실패: ${r.stderr}`);
  const trendData = JSON.parse(r.stdout);

  // 중복 회피 강화: yaml + Blogger API 둘 다
  //  - yaml: 로컬 토픽 (최근 20개) — commit 실패 시 빈 풀
  //  - Blogger API: 실제 발행된 글 (박재은+김하나 최근 30개씩 cross-blog)
  const config = yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const yamlTitles = (config.topics || []).slice(-20).map(t => t.title || '').join(' ');
  let bloggerTitles = '';
  try {
    const accessToken = await getBloggerAccessToken();
    const blogIds = [process.env.FINANCE_BLOG_ID, process.env.BLOG_ID].filter(Boolean);
    for (const bid of blogIds) {
      const url = `https://www.googleapis.com/blogger/v3/blogs/${bid}/posts?maxResults=30&fetchBodies=false`;
      const bRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (bRes.ok) {
        const bData = await bRes.json();
        bloggerTitles += ' ' + (bData.items || []).map(p => p.title).join(' ');
      }
    }
    console.log(`   ↳ Blogger 회피 풀: 박재은·김하나 최근 글 ${bloggerTitles.length}자`);
  } catch (e) {
    console.warn(`   ⚠ Blogger 회피 실패 (yaml만 사용): ${e.message}`);
  }
  const allRecentTitles = yamlTitles + ' ' + bloggerTitles;

  // 박재은 페르소나 위반 키워드 차단 (자본시장법: 종목 추천 금지 / 환테크 가격 전망 금지)
  // 5/18 사고: "비트코인", "코스피"가 잡혀 QA에서 막힘 → 재발 방지
  const BANNED = /비트코인|코스피|코스닥|삼성전자|SK하이닉스|네이버\b|카카오\b|주식|종목|상장|환율|환테크|달러|코인|이더리움|리플|도지|솔라나|선물|옵션|레버리지|공매도|채권|부동산|재개발|아파트값|집값/;
  const safeKeywords = trendData.keywords.filter(k => !BANNED.test(k.keyword));
  console.log(`   ↳ 안전 키워드: ${safeKeywords.length}/${trendData.keywords.length}개 (자본시장 종목·환율·부동산 가격 제외)`);

  const candidates = safeKeywords.length > 0 ? safeKeywords : trendData.keywords;
  const pick = candidates.find(k => !allRecentTitles.includes(k.keyword)) || candidates[0];
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

async function stepQaReview({ slug }) {
  // exit 2 = QA 차단 (사실·정책 critical) → publish 스킵
  // exit 0 = 통과
  // exit 1 = 시스템 에러
  return new Promise((resolve, reject) => {
    const p = spawn('node', ['scripts/finance-team/qa-review.js', '--slug', slug], {
      cwd: REPO_ROOT, shell: true, stdio: 'inherit',
    });
    p.on('close', code => {
      if (code === 0) resolve({ blocked: false });
      else if (code === 2) resolve({ blocked: true });
      else reject(new Error(`qa-review exit ${code}`));
    });
  });
}

async function stepFix({ slug }) {
  await run('node', ['scripts/finance-team/fix-draft.js', '--slug', slug]);
}

async function stepPublish({ slug, publish }) {
  const args = ['scripts/finance-team/publish-finance.js', '--slug', slug];
  if (publish) args.push('--publish', publish);
  await run('node', args);
}

// ========== 한 주제로 글 생성 + QA→Fix 루프 ==========
// 반환: { passed, slug, steps, lastQa }
// passed=true 면 publish까지 호출됐고 끝.
// passed=false 면 4번 검수 후에도 실패 → 호출자가 주제 변경 결정.
async function tryOneTopic({ slug, opts }) {
  const steps = [];

  console.log('\n[1] 🔎 Researcher');
  await stepResearch({ day: opts.day, slug, forceTrend: opts.forceTrend });
  steps.push('research');

  console.log('\n[2] ✍️  Copywriter (박재은)');
  await stepWrite({ slug });
  steps.push('write');

  console.log('\n[3] 🎨 Image Generator');
  await stepImages({ slug });
  steps.push('images');

  if (!opts.skipVideo) {
    console.log('\n[4] 🎙️  TTS');
    await stepTTS({ slug });
    steps.push('tts');

    console.log('\n[5] 🎬 Remotion 렌더');
    await stepVideo({ slug });
    steps.push('video');
  }

  // QA→Fix 루프 (최대 4번 검수 = 첫 QA + 수정 3회)
  let lastQa = null;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const label = attempt === 0 ? '첫 검수' : `재검수 ${attempt}/3`;
    console.log(`\n[QA] 🔍 ${label}`);
    lastQa = await stepQaReview({ slug });
    steps.push(`qa${attempt}`);

    if (!lastQa.blocked) {
      // 통과 → 발행
      if (opts.skipPublish) {
        console.log('\n[publish] ⏭  --skip-publish 지정 → 발행 생략');
      } else {
        console.log('\n[publish] 📤 Blogspot 업로드');
        await stepPublish({ slug, publish: opts.publish });
        steps.push('publish');
      }
      return { passed: true, slug, steps, lastQa };
    }

    if (attempt < 3) {
      console.log(`\n[fix] 🔧 QA 피드백 반영 수정 (${attempt + 1}/3)`);
      try {
        await stepFix({ slug });
        steps.push(`fix${attempt + 1}`);
      } catch (e) {
        console.warn(`   ⚠ Fix 실패: ${e.message.split('\n')[0]} — 다음 단계로`);
        // fix 자체가 실패해도 루프는 계속 (다음 QA는 동일 본문 검수 → 또 실패 → 어차피 종료)
        break;
      }
    }
  }

  console.log('\n⚠ 4회 검수 모두 실패');
  return { passed: false, slug, steps, lastQa };
}

// ========== 메인 ==========
(async () => {
  const opts = parseArgs();
  const t0 = Date.now();
  const isTrending = !!(opts.trending && !opts.slug && !opts.day);

  // 첫 주제
  let slug = isTrending ? await createTrendingTopic() : resolveSlug(opts);
  console.log('\n' + '═'.repeat(60));
  console.log(`▶ 재테크 팀 풀 파이프라인 — ${slug}`);
  console.log('═'.repeat(60));
  await notifyTelegram(`💼 재테크 자동화 시작\nslug: \`${slug}\``);

  let result = await tryOneTopic({ slug, opts });
  const allSteps = [...result.steps];

  // 첫 주제 6번(write 3 + QA 4) 다 막혔으면 → trending 모드일 때만 새 주제로 1회 더 시도
  if (!result.passed && isTrending) {
    console.log('\n' + '─'.repeat(60));
    console.log('🔄 첫 주제 6회 실패 — 다른 주제로 1회 재시도');
    console.log('─'.repeat(60));
    try {
      slug = await createTrendingTopic();
      await notifyTelegram(`🔄 박재은 주제 교체\n새 slug: \`${slug}\` (이전 주제 검수 통과 못함)`);
      result = await tryOneTopic({ slug, opts });
      allSteps.push('---', ...result.steps);
    } catch (e) {
      console.warn(`주제 교체 실패: ${e.message}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(60));

  if (result.passed) {
    console.log(`✓ 풀 파이프라인 완료 (${elapsed}s)`);
    console.log(`  단계: ${allSteps.join(' → ')}`);
    console.log('═'.repeat(60));
    await notifyTelegram(
      `✅ 재테크 자동화 완료 (${elapsed}s)\nslug: \`${result.slug}\`\n단계: ${allSteps.join(' → ')}`
    );
  } else {
    // 모든 시도 실패 → DRAFT만 + 알림 (옵션 B)
    console.log(`🛑 모든 시도 실패 — DRAFT만 저장 (${elapsed}s)`);
    console.log(`  단계: ${allSteps.join(' → ')}`);
    console.log('═'.repeat(60));
    const criticals = (result.lastQa?.criticalCount ?? '?');
    await notifyTelegram(
      `🚨 *박재은 자동 발행 차단*\n` +
      `최종 slug: \`${result.slug}\`\n` +
      `검수·수정 6회 모두 실패. DRAFT만 저장됨.\n` +
      `→ 사장님이 직접 검토 후 수동 발행 필요.`
    );
    // 워크플로는 success로 끝남 (점검이 의도대로 막은 것 = 에러 아님)
  }
})().catch(async e => {
  console.error('\n❌ 파이프라인 실패:', e.message);
  await notifyTelegram(`❌ 재테크 자동화 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
