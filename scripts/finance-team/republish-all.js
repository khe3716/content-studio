// 발행된 적금·예금·대출 글들을 새 금리 데이터로 자동 재발행
//
// 사용법:
//   node scripts/finance-team/republish-all.js
//   node scripts/finance-team/republish-all.js --categories savings,deposit
//   node scripts/finance-team/republish-all.js --dry-run
//
// 흐름:
//   1. finance-blog/drafts/ 안의 *-meta.json 스캔
//   2. 카테고리 필터링 (savings·deposit 우선)
//   3. 각 슬러그별로:
//      - research.js (verified_rate_data 갱신)
//      - write-draft.js (박재은 새로 작성)
//      - publish-finance.js --publish now (즉시 재발행, 같은 제목 자동 정리)
//   4. 텔레그램 진행 보고

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { REPO_ROOT, notifyTelegram } = require('./lib');

const DRAFTS_DIR = path.join(REPO_ROOT, 'finance-blog', 'drafts');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    categories: ['savings', 'deposit'],
    dryRun: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--categories' && args[i + 1]) {
      out.categories = args[i + 1].split(',').map(s => s.trim());
      i += 1;
    } else if (args[i] === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

function listPublishedSlugs(categoryFilter) {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  const metaFiles = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('-meta.json'));
  const slugs = [];
  for (const f of metaFiles) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8'));
      // last_post_id 있으면 = 발행 또는 임시저장 한 적 있음
      if (!meta.last_post_id) continue;
      // 카테고리 필터
      if (categoryFilter && !categoryFilter.includes(meta.category)) continue;
      slugs.push({ slug: meta.slug, category: meta.category, title: meta.title });
    } catch (e) {
      // 파싱 실패 스킵
    }
  }
  return slugs;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: REPO_ROOT, shell: true, stdio: 'inherit' });
    p.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))
    );
  });
}

(async () => {
  const opts = parseArgs();
  console.log(`▶ 재발행 시작 (카테고리: ${opts.categories.join(', ')})`);

  const slugs = listPublishedSlugs(opts.categories);
  if (slugs.length === 0) {
    console.log('재발행 대상 글 없음');
    return;
  }

  console.log(`재발행 대상 ${slugs.length}개:`);
  for (const s of slugs) console.log(`  - ${s.slug} (${s.category}): ${s.title}`);

  if (opts.dryRun) {
    console.log('\n--dry-run 모드: 실제 실행 생략');
    return;
  }

  await notifyTelegram(`💼 재테크 매월 재발행 시작 (${slugs.length}개)`);

  const results = [];
  for (const { slug } of slugs) {
    console.log(`\n${'═'.repeat(60)}\n▶ ${slug}\n${'═'.repeat(60)}`);
    try {
      await run('node', ['scripts/finance-team/research.js', '--slug', slug, '--force']);
      await run('node', ['scripts/finance-team/write-draft.js', '--slug', slug]);
      await run('node', ['scripts/finance-team/publish-finance.js', '--slug', slug, '--publish', 'now']);
      results.push({ slug, ok: true });
    } catch (e) {
      console.error(`❌ ${slug}: ${e.message}`);
      results.push({ slug, ok: false, error: e.message });
    }
  }

  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✓ 완료 — 성공 ${ok} / 실패 ${fail}`);
  await notifyTelegram(
    `${fail === 0 ? '✅' : '⚠️'} 재테크 매월 재발행 완료\n성공 ${ok} / 실패 ${fail}`
  );
})().catch(async e => {
  console.error('❌ 전체 실패:', e.message);
  await notifyTelegram(`❌ 재테크 매월 재발행 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
