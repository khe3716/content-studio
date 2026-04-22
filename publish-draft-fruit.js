// 과일 블로그 Blogger 임시저장 업로드 (썸네일 생성 + raw URL 반영)
//
// 사용법:
//   node publish-draft-fruit.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>"

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderThumbnailPng } = require('./fruit-blog/generate-thumbnail');

// ========== 환경 변수 ==========
const envPath = path.join(__dirname, '.env');
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
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
if (!BLOG_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('❌ 환경변수 누락: FRUIT_BLOG_ID / GOOGLE_*');
  process.exit(1);
}

const [dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labelsStr, slugArg, searchDescArg] = process.argv.slice(2);
if (!dayId || !emoji || !postTitle || !thumbTitle || !htmlPath) {
  console.error('사용법: node publish-draft-fruit.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>" [slug] [searchDescription]');
  process.exit(1);
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
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

async function uploadDraft(token, title, labels, content) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?isDraft=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'blogger#post', title, content, labels }),
  });
  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 업로드 실패:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  return result;
}

(async () => {
  try {
    // 1. 디자인 썸네일 생성 (빨강/핑크 텍스트 스타일)
    // 매 업로드마다 파일명에 타임스탬프 붙여 Blogger CDN 캐시 방지
    const ts = Date.now();
    const thumbId = `${dayId}-${ts}`;
    console.log(`\n[1/3] 🎨 ${thumbId} 디자인 썸네일 생성 중...`);
    const thumbDir = path.join(__dirname, 'fruit-blog', 'thumbnails');
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
    const pngPath = path.join(thumbDir, `${thumbId}.png`);
    const svgPath = path.join(thumbDir, `${thumbId}.svg`);
    const { svg, pngBuffer } = await renderThumbnailPng({
      title: thumbTitle,
      subtitle: [sub1, sub2].filter(Boolean),
      brand: '과일정보연구소',
      emoji,
      outputPath: pngPath,
    });
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`  ✓ 썸네일 생성 (${Math.round(pngBuffer.length / 1024)}KB)`);

    // 2. HTML 맨 위에 썸네일 삽입 (CI: raw URL, 로컬: base64)
    console.log(`\n[2/3] 📝 HTML에 썸네일 삽입 중...`);
    const htmlFullPath = path.join(__dirname, htmlPath);
    const originalHtml = fs.readFileSync(htmlFullPath, 'utf8');

    let thumbSrc;
    const repo = process.env.GITHUB_REPOSITORY;
    const isCI = process.env.GITHUB_ACTIONS === 'true' && repo;
    if (isCI) {
      const relThumb = `fruit-blog/thumbnails/${thumbId}.png`;
      const run = (args) => {
        const r = spawnSync('git', args, { cwd: __dirname, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${r.stderr || r.stdout}`);
        return r.stdout;
      };
      try {
        run(['config', 'user.name', 'github-actions[bot]']);
        run(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
        run(['add', relThumb, `fruit-blog/thumbnails/${thumbId}.svg`]);
        // 같은 dayId의 오래된 썸네일 파일들은 git rm (cleanup)
        const oldPngs = fs.readdirSync(thumbDir).filter(f => f.startsWith(dayId + '-') && f !== `${thumbId}.png` && f !== `${thumbId}.svg` && (f.endsWith('.png') || f.endsWith('.svg')));
        if (oldPngs.length > 0) {
          try { run(['rm', '-f', ...oldPngs.map(f => `fruit-blog/thumbnails/${f}`)]); } catch {}
        }
        const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: __dirname });
        if (diff.status !== 0) {
          run(['commit', '-m', `chore: thumbnail for fruit ${thumbId} [skip ci]`]);
          run(['push']);
          console.log(`  ✓ 썸네일 GitHub 푸시 완료`);
        }
        thumbSrc = `https://raw.githubusercontent.com/${repo}/main/${relThumb}`;
      } catch (e) {
        console.warn(`  ⚠️ 푸시 실패, base64 폴백: ${e.message}`);
        thumbSrc = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      }
    } else {
      thumbSrc = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    }

    const coverTag = `<div style="text-align:center;margin:0 0 32px 0;"><img src="${thumbSrc}" alt="${thumbTitle}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"/></div>\n`;
    // 기존 커버 제거 (base64 · raw URL · 외부 URL 모두)
    const cleanedHtml = originalHtml.replace(
      /<div style="text-align:center;margin:0 0 (?:24|32)px 0;"><img src="[^"]+" alt="[^"]*"[^>]*\/><\/div>\s*/g,
      ''
    );
    const finalHtml = coverTag + cleanedHtml;
    fs.writeFileSync(htmlFullPath, finalHtml);
    console.log(`  ✓ HTML 업데이트됨`);

    // 3. Blogger 업로드
    console.log(`\n[3/3] ☁️  Blogger 임시저장 업로드 중...`);
    const token = await getAccessToken();
    const labels = labelsStr ? labelsStr.split(',').map(s => s.trim()) : [];
    const result = await uploadDraft(token, postTitle, labels, finalHtml);

    console.log('\n========================================');
    console.log('  ✅ 과일블로그 업로드 완료!');
    console.log('========================================\n');
    console.log('제목:', result.title);
    console.log('포스트 ID:', result.id);
    console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);

    // Playwright로 퍼머링크 + 검색 설명 자동 세팅 (DRAFT 상태에서만 작동)
    const sessionExists = fs.existsSync(path.join(__dirname, '.blogger-session', 'state.json'));
    if (!sessionExists) {
      console.log('\nℹ️ Blogger 세션 없음 (.blogger-session/state.json) → Playwright 자동화 스킵');
      console.log('   로컬에서 1회성 로그인: node scripts/blogger-session-setup.js');
    } else if (!slugArg && !searchDescArg) {
      console.log('\nℹ️ slug·searchDescription 인자 없음 → Playwright 자동화 스킵');
    } else {
      console.log('\n🤖 [보너스] Playwright로 퍼머링크·검색설명 자동 설정 중...');
      try {
        const { finalizePost } = require('./scripts/blogger-finalize-post');
        await finalizePost({
          blogId: BLOG_ID,
          postId: result.id,
          slug: slugArg || '',
          description: searchDescArg || '',
          headless: true,
        });
      } catch (e) {
        console.warn(`   ⚠️ Playwright 자동화 실패 (무시하고 진행): ${e.message}`);
      }
    }
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
