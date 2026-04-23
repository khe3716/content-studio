// 새 글을 Blogger에 업로드 (썸네일 + Playwright 메타 + 위치 + 선택적 예약 발행)
//
// 사용법:
//   node publish-draft.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>" [slug] [searchDescription] [publishDate]
//
// publishDate (선택):
//   생략/""    → DRAFT 유지
//   "now"       → 즉시 발행
//   ISO 8601   → 예약 발행
//
// 순서: 업로드(DRAFT, location=서울) → Playwright 퍼머링크·검색설명 → publishDate 있으면 /publish

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { spawnSync } = require('child_process');
const { renderThumbnailPng } = require('./economy-blog/generate-thumbnail');

// ========== 환경 변수 로드 (로컬: .env, CI: process.env) ==========
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  });
}
const BLOG_ID = env.BLOG_ID || process.env.BLOG_ID;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
if (!BLOG_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('❌ 환경변수 누락: BLOG_ID / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

// ========== 인자 파싱 ==========
const [dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labelsStr, slugArg, searchDescArg, publishDateArg] = process.argv.slice(2);
if (!dayId || !emoji || !postTitle || !thumbTitle || !htmlPath) {
  console.error(
    '사용법: node publish-draft.js <dayId> <emoji> "<postTitle>" "<thumbTitle>" "<sub1>" "<sub2>" <htmlPath> "<labels>" [slug] [searchDescription] [publishDate]'
  );
  process.exit(1);
}

// Blogger "위치" 필드 기본값 (서울)
const DEFAULT_LOCATION = {
  name: '서울특별시, 대한민국',
  lat: 37.5665,
  lng: 126.9780,
};

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

async function uploadDraft(accessToken, title, labels, content) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?isDraft=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'blogger#post',
      title,
      content,
      labels,
      location: DEFAULT_LOCATION,
    }),
  });
  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 업로드 실패:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  return result;
}

// DRAFT → LIVE/SCHEDULED 전환
// publishDate 미래면 SCHEDULED, 과거/생략이면 즉시 발행
async function publishPost(accessToken, postId, publishDate) {
  const params = new URLSearchParams();
  if (publishDate) params.set('publishDate', publishDate);
  const qs = params.toString();
  const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postId}/publish${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = await res.json();
  if (res.status !== 200) {
    console.error('❌ 발행 전환 실패:');
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`publish API ${res.status}`);
  }
  return result;
}

(async () => {
  try {
    // 1. 썸네일 생성
    console.log(`\n[1/3] 🎨 ${dayId} 썸네일 생성 중...`);
    const thumbDir = path.join(__dirname, 'economy-blog', 'thumbnails');
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
    const pngPath = path.join(thumbDir, `${dayId}.png`);
    const svgPath = path.join(thumbDir, `${dayId}.svg`);

    const { svg, pngBuffer } = await renderThumbnailPng({
      title: thumbTitle,
      subtitle: [sub1, sub2].filter(Boolean),
      brand: '경제 꿀팁, 하루 5분',
      emoji,
      outputPath: pngPath,
    });
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`  ✓ 썸네일: ${pngPath} (${Math.round(pngBuffer.length / 1024)}KB)`);

    // 2. HTML에 썸네일 삽입 (CI: GitHub raw URL 사용, 로컬: base64 폴백)
    console.log(`\n[2/3] 📝 HTML에 썸네일 삽입 중...`);
    const htmlFullPath = path.join(__dirname, htmlPath);
    const originalHtml = fs.readFileSync(htmlFullPath, 'utf8');

    let thumbSrc;
    const repo = process.env.GITHUB_REPOSITORY; // "owner/repo" format
    const isCI = process.env.GITHUB_ACTIONS === 'true' && repo;

    if (isCI) {
      // GitHub에 썸네일 먼저 푸시
      const relThumb = `economy-blog/thumbnails/${dayId}.png`;
      const run = (args) => {
        const r = spawnSync('git', args, { cwd: __dirname, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${r.stderr || r.stdout}`);
        return r.stdout;
      };
      try {
        run(['config', 'user.name', 'github-actions[bot]']);
        run(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
        run(['add', relThumb]);
        const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: __dirname });
        if (diff.status !== 0) {
          run(['commit', '-m', `chore: thumbnail for ${dayId} [skip ci]`]);
          run(['push']);
          console.log(`  ✓ 썸네일 GitHub 푸시 완료`);
        } else {
          console.log(`  ✓ 썸네일 변경 없음 (이미 푸시됨)`);
        }
        thumbSrc = `https://raw.githubusercontent.com/${repo}/main/${relThumb}`;
      } catch (e) {
        console.warn(`  ⚠️ 썸네일 푸시 실패, base64로 폴백: ${e.message}`);
        const base64 = pngBuffer.toString('base64');
        thumbSrc = `data:image/png;base64,${base64}`;
      }
    } else {
      // 로컬 실행: base64
      const base64 = pngBuffer.toString('base64');
      thumbSrc = `data:image/png;base64,${base64}`;
    }

    const thumbnailTag = `<div style="text-align:center;margin:0 0 24px 0;"><img src="${thumbSrc}" alt="썸네일" style="max-width:100%;height:auto;border-radius:8px;" /></div>\n`;
    // 기존 썸네일 제거 (base64 또는 raw URL 둘 다)
    const cleanedHtml = originalHtml.replace(
      /<div style="text-align:center;margin:0 0 24px 0;"><img src="(?:data:image\/png;base64,[^"]+|https:\/\/raw\.githubusercontent\.com\/[^"]+)" alt="썸네일"[^>]*\/><\/div>\s*/g,
      ''
    );
    const finalHtml = thumbnailTag + cleanedHtml;
    fs.writeFileSync(htmlFullPath, finalHtml);
    console.log(`  ✓ HTML 업데이트됨: ${htmlPath}`);

    // 3. Blogger에 임시저장 업로드
    console.log(`\n[3/3] ☁️  Blogger에 임시저장 업로드 중...`);
    const token = await getAccessToken();
    const labels = labelsStr ? labelsStr.split(',').map(s => s.trim()) : [];
    const result = await uploadDraft(token, postTitle, labels, finalHtml);

    console.log('\n========================================');
    console.log('  ✅ Day 업로드 완료!');
    console.log('========================================\n');
    console.log('제목:', result.title);
    console.log('포스트 ID:', result.id);
    console.log('상태:', result.status || 'DRAFT');
    console.log('편집 URL:', `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${result.id}`);

    // 4. Playwright로 퍼머링크·검색설명 자동 세팅 (DRAFT 상태에서만 작동)
    // 순서 중요: Playwright 먼저 → publishDate 적용
    const sessionExists = fs.existsSync(path.join(__dirname, '.blogger-session', 'state.json'));
    if (!sessionExists) {
      console.log('\nℹ️ Blogger 세션 없음 → Playwright 스킵 (로컬에선 node scripts/blogger-session-setup.js)');
    } else if (!slugArg && !searchDescArg) {
      console.log('\nℹ️ slug·searchDescription 인자 없음 → Playwright 스킵');
    } else {
      console.log('\n🤖 Playwright로 퍼머링크·검색설명 자동 설정 중...');
      try {
        const { finalizePost } = require('./scripts/blogger-finalize-post');
        await finalizePost({
          blogId: BLOG_ID,
          postId: result.id,
          slug: slugArg || '',
          description: searchDescArg || '',
          headless: true,
        });
        // 서버 저장 반영 위한 안전 대기
        console.log('   ⏳ publish API 호출 전 추가 3초 대기');
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.warn(`   ⚠️ Playwright 자동화 실패 (무시하고 진행): ${e.message}`);
      }
    }

    // 5. (선택) publishDate 지정되면 발행 전환
    if (publishDateArg) {
      const isoDate = publishDateArg === 'now' ? '' : publishDateArg;
      console.log(`\n☁️  [발행] publishDate=${isoDate || '(즉시)'}`);
      try {
        const pubResult = await publishPost(token, result.id, isoDate);
        const isFuture = isoDate && new Date(isoDate).getTime() > Date.now();
        console.log(`   ✓ 상태: ${pubResult.status || (isFuture ? 'SCHEDULED' : 'LIVE')}`);
        if (isFuture) {
          console.log(`   📅 예약 발행: ${isoDate}`);
        } else {
          console.log(`   🚀 즉시 발행됨`);
          if (pubResult.url) console.log(`   URL: ${pubResult.url}`);
        }
      } catch (e) {
        console.warn(`   ⚠️ 발행 전환 실패 (DRAFT 유지): ${e.message}`);
      }
    } else {
      console.log('\nℹ️ publishDate 미지정 → DRAFT 유지');
    }
  } catch (err) {
    console.error('❌ 에러:', err);
    process.exit(1);
  }
})();
