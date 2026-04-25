// 재테크 콘텐츠 풀 파이프라인 오케스트레이터
// 사용법: node scripts/finance-team/orchestrator.js <slug>
// 전제: finance-blog/drafts/{slug}.html + {slug}-narration.json 이 이미 작성되어 있음
// (글 + 대본은 Claude/사람이 직접, 자동화는 이미지·TTS·영상 단계만)

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const slug = process.argv[2];
if (!slug) {
  console.error('❌ 사용법: node scripts/finance-team/orchestrator.js <slug>');
  process.exit(1);
}

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    p.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    );
  });
}

function check(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 전제 파일 누락: ${label} → ${filePath}`);
    process.exit(1);
  }
}

(async () => {
  const draft = path.join(ROOT, 'finance-blog', 'drafts', `${slug}.html`);
  const narration = path.join(ROOT, 'finance-blog', 'drafts', `${slug}-narration.json`);
  check(draft, '본문 HTML');
  check(narration, 'TTS narration JSON');

  const t0 = Date.now();
  console.log(`\n▶ ${slug} 풀 파이프라인 시작`);
  console.log('─'.repeat(60));

  console.log('\n[1/4] 🎨 Nano Banana 이미지 생성');
  await run('node', ['scripts/finance-team/generate-images.js', slug]);

  console.log('\n[2/4] 🎙️  Gemini Leda TTS (1.3x)');
  await run('node', ['scripts/finance-team/generate-tts.js', slug]);

  const remDir = path.join(ROOT, 'finance-blog', 'remotion');
  const longOut = path.join(remDir, 'out', `${slug}-long.mp4`);
  const shortOut = path.join(remDir, 'out', `${slug}-short.mp4`);

  console.log('\n[3/4] 🎬 Remotion LongForm 렌더 (1920×1080, 60s)');
  await run('npx', ['remotion', 'render', 'src/index.ts', 'LongForm', `out/${slug}-long.mp4`], remDir);

  console.log('\n[3.5/4] 🎬 Remotion ShortForm 렌더 (1080×1920, 30s)');
  await run('npx', ['remotion', 'render', 'src/index.ts', 'ShortForm', `out/${slug}-short.mp4`], remDir);

  console.log('\n[4/4] 📦 산출물 정리');
  const videosDir = path.join(ROOT, 'finance-blog', 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  fs.copyFileSync(longOut, path.join(videosDir, `${slug}-long.mp4`));
  fs.copyFileSync(shortOut, path.join(videosDir, `${slug}-short.mp4`));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '─'.repeat(60));
  console.log(`✓ 완료 (${elapsed}s)`);
  console.log('산출물:');
  console.log(`  • finance-blog/drafts/${slug}.html`);
  console.log(`  • finance-blog/videos/${slug}-long.mp4`);
  console.log(`  • finance-blog/videos/${slug}-short.mp4`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
