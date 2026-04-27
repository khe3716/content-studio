// 재테크 팀 — 5/마지막 단계 Blogspot 자동 발행
//
// 사용법:
//   node scripts/finance-team/publish-finance.js --slug salary-30-savings-1y-simulation
//   node scripts/finance-team/publish-finance.js --slug ... --publish now      # 즉시 발행
//   node scripts/finance-team/publish-finance.js --slug ... --publish 2026-05-04T08:00:00+09:00  # 예약
//   생략 시 DRAFT 유지
//
// 입력:
//   - finance-blog/drafts/{slug}.html
//   - finance-blog/drafts/{slug}-meta.json
//   - finance-blog/images/{slug}-cover.jpg (있으면 본문 상단에 자동 삽입)
//
// 환경변수:
//   FINANCE_BLOG_ID (재테크 블로그 전용)
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN (다른 블로그와 공유 가능)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  REPO_ROOT,
  getBloggerAccessToken,
  readJSON,
  notifyTelegram,
} = require('./lib');

const DRAFTS_DIR = path.join(REPO_ROOT, 'finance-blog', 'drafts');
const IMAGES_DIR = path.join(REPO_ROOT, 'finance-blog', 'images');

// GitHub raw URL 베이스 (이미지 호스팅용)
const GH_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'khe3716';
const GH_REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'content-studio';
const GH_BRANCH = process.env.GITHUB_REF_NAME || 'main';

// ========== 가독성 강화 CSS — 시원한 여백, 부드러운 톤 ==========
const STYLE_BLOCK = `<style>
.post-finance {
  font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #1f2937;
  line-height: 1.75;
  font-size: 15pt;
  max-width: 720px;
  margin: 0 auto;
  word-break: keep-all;
  letter-spacing: -0.01em;
}
.post-finance > p:first-of-type {
  font-size: 16pt;
  font-weight: 600;
  color: #0f172a;
  background: #f8fafc;
  padding: 22px 24px;
  border-radius: 12px;
  margin: 0 0 22px;
  line-height: 1.65;
}
.post-finance p {
  margin: 32px 0;
  font-size: 15pt;
  line-height: 1.85;
}
.post-finance p + p { margin-top: 36px; }
.post-finance h2 {
  font-size: 19pt;
  font-weight: 800;
  color: #0f172a;
  margin: 56px 0 22px;
  line-height: 1.45;
  letter-spacing: -0.02em;
  position: relative;
  padding-left: 16px;
  border-left: 5px solid #2563eb;
}
.post-finance h2:first-of-type { margin-top: 36px; }
.post-finance strong { color: #1e293b; font-weight: 700; }
.post-finance img {
  max-width: 540px;
  width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
  margin: 0 auto;
  box-shadow: 0 4px 14px rgba(15,23,42,0.06);
}
.post-finance .img-wrap {
  text-align: center;
  margin: 32px 0;
}
.post-finance .thumb-wrap {
  margin: 0 0 32px 0;
}
.post-finance .thumb-wrap img {
  max-width: 600px;
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 6px 22px rgba(15,23,42,0.12);
}
.post-finance table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 22px 0;
  font-size: 13.5pt;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.post-finance th {
  background: #f1f5f9;
  color: #0f172a;
  padding: 12px 10px;
  text-align: left;
  font-weight: 700;
  font-size: 13pt;
  border-bottom: 2px solid #cbd5e1;
}
.post-finance td {
  padding: 12px 10px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
  font-size: 13.5pt;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.post-finance td:last-child {
  font-size: 12.5pt;
  color: #475569;
  line-height: 1.55;
  word-break: keep-all;
}
.post-finance tr:last-child td { border-bottom: none; }
.post-finance tr:nth-child(even) td { background: #fafbfc; }
.post-finance ul {
  margin: 28px 0;
  padding-left: 22px;
}
.post-finance li {
  margin: 22px 0;
  line-height: 1.85;
  font-size: 15pt;
}
.post-finance li + li { margin-top: 28px; }
.post-finance li br { display: block; content: ""; margin-top: 6px; }
.post-finance .info-box {
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 14px 20px;
  margin: 24px 0;
  border-radius: 8px;
  font-size: 14pt;
  font-weight: 500;
  color: #78350f;
  line-height: 1.65;
}
.post-finance .point-box {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
  padding: 14px 20px;
  margin: 24px 0;
  border-radius: 8px;
  font-size: 14pt;
  font-weight: 500;
  color: #065f46;
  line-height: 1.65;
}
.post-finance .warn-box {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
  padding: 16px 20px;
  margin: 28px 0;
  border-radius: 8px;
  font-size: 14pt;
  color: #991b1b;
  line-height: 1.7;
}
.post-finance .signature {
  text-align: center;
  margin: 48px 0 8px;
  padding: 22px 0 8px;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13pt;
}
@media (max-width: 640px) {
  .post-finance {
    font-size: 16pt;
    line-height: 1.8;
    padding: 0 4px;
  }
  .post-finance > p:first-of-type {
    font-size: 16.5pt;
    padding: 22px 20px;
    line-height: 1.7;
    margin-bottom: 28px;
  }
  .post-finance p {
    margin: 36px 0;
    font-size: 16pt;
    line-height: 1.85;
  }
  .post-finance p + p { margin-top: 40px; }
  .post-finance li {
    font-size: 16pt;
    line-height: 1.85;
    margin: 26px 0;
  }
  .post-finance li + li { margin-top: 32px; }
  .post-finance h2 {
    font-size: 19pt;
    padding-left: 14px;
    margin: 52px 0 22px;
    line-height: 1.4;
  }
  .post-finance .info-box,
  .post-finance .point-box,
  .post-finance .warn-box {
    font-size: 15.5pt;
    padding: 18px 20px;
    line-height: 1.8;
    margin: 28px 0;
  }
  .post-finance .img-wrap { margin: 28px 0; }
  .post-finance img { max-width: 100%; }
  /* 모바일: 표를 카드 형태로 변환 (가로 스크롤 X) */
  .post-finance .finance-table-responsive,
  .post-finance .finance-table-responsive thead,
  .post-finance .finance-table-responsive tbody,
  .post-finance .finance-table-responsive tr,
  .post-finance .finance-table-responsive td {
    display: block;
    width: 100%;
  }
  .post-finance .finance-table-responsive thead {
    display: none;
  }
  .post-finance .finance-table-responsive {
    border: none;
    box-shadow: none;
    margin: 24px 0;
  }
  .post-finance .finance-table-responsive tr {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin: 14px 0;
    padding: 14px 14px;
    box-shadow: 0 2px 8px rgba(15,23,42,0.04);
    box-sizing: border-box;
  }
  .post-finance .finance-table-responsive tr:nth-child(even) td {
    background: transparent;
  }
  .post-finance .finance-table-responsive td {
    border: none;
    padding: 7px 0;
    font-size: 14pt;
    line-height: 1.6;
    background: transparent !important;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .post-finance .finance-table-responsive td:before {
    content: attr(data-label);
    color: #6b7280;
    font-weight: 700;
    font-size: 12.5pt;
    min-width: 88px;
    flex-shrink: 0;
    flex-grow: 0;
    line-height: 1.6;
  }
  /* 일반 표 (responsive 클래스 없는) */
  .post-finance table:not(.finance-table-responsive),
  .post-finance table:not(.finance-table-responsive) th,
  .post-finance table:not(.finance-table-responsive) td { font-size: 13pt; }
  .post-finance table:not(.finance-table-responsive) th,
  .post-finance table:not(.finance-table-responsive) td { padding: 11px 8px; }
  .post-finance .signature {
    font-size: 14pt;
    margin: 44px 0 4px;
  }
}
</style>
`;

// ========== 인자 파싱 ==========
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { slug: null, publish: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--slug' && args[i + 1]) { out.slug = args[i + 1]; i += 1; }
    else if (args[i] === '--publish' && args[i + 1]) { out.publish = args[i + 1]; i += 1; }
  }
  if (!out.slug) {
    console.error('❌ --slug <slug> 필요');
    process.exit(1);
  }
  return out;
}

// ========== Blogger API ==========
async function uploadDraft({ accessToken, blogId, title, labels, content }) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?isDraft=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'blogger#post',
      title,
      labels,
      content,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blogger draft 업로드 실패 ${res.status}: ${err.slice(0, 400)}`);
  }
  return await res.json();
}

async function publishPost({ accessToken, blogId, postId, publishDate }) {
  let url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}/publish`;
  if (publishDate && publishDate !== 'now') {
    url += `?publishDate=${encodeURIComponent(publishDate)}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blogger 발행 실패 ${res.status}: ${err.slice(0, 400)}`);
  }
  return await res.json();
}

async function deleteDraft({ accessToken, blogId, postId }) {
  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    console.warn(`   ⚠ 이전 DRAFT 삭제 실패 (${res.status}, 무시): ${err.slice(0, 150)}`);
    return false;
  }
  return true;
}

// 같은 제목 가진 모든 DRAFT 검색 후 삭제 (중복 정리)
async function deleteAllDraftsWithSameTitle({ accessToken, blogId, title }) {
  // DRAFT 글 목록 조회 (최대 50개)
  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=draft&view=ADMIN&maxResults=50&fetchBodies=false`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.warn(`   ⚠ DRAFT 목록 조회 실패 (무시): ${res.status}`);
    return 0;
  }
  const data = await res.json();
  const matches = (data.items || []).filter(p => p.title === title);
  if (matches.length === 0) return 0;

  console.log(`   🧹 같은 제목 DRAFT ${matches.length}개 발견, 정리 중...`);
  let deleted = 0;
  for (const p of matches) {
    const ok = await deleteDraft({ accessToken, blogId, postId: p.id });
    if (ok) deleted += 1;
  }
  return deleted;
}

// ========== 본문 보강 ==========
// 1) 가독성 CSS 자동 prepend
// 2) cover/section-N 이미지를 GitHub raw URL로 본문 H2 직전 삽입 (Blogger가 base64 막아서)
// 3) 💡/⚠️ 인라인 패턴을 박스 div로 변환
// 4) 시그니처 div 감싸기
async function enrichContent({ html, meta, slug }) {
  let body = html.trim();

  if (!body.startsWith('<div class="post-finance"')) {
    body = `<div class="post-finance">\n${body}\n</div>`;
  }

  body = transformBoxes(body);
  body = addTableMobileLabels(body);
  body = applyLineBreaks(body);
  body = await injectImages(body, slug);
  body = injectThumbnail(body, slug);
  body = STYLE_BLOCK + body;
  return body;
}

// 썸네일 자동 생성·git push 후 본문 맨 위에 삽입 (Blogger OG 자동 사용)
function injectThumbnail(html, slug) {
  const thumbPath = path.join(REPO_ROOT, 'finance-blog', 'thumbnails', `${slug}-thumb-tone1.png`);

  // 썸네일이 없거나 7일 넘으면 자동 재생성
  let needsGen = !fs.existsSync(thumbPath);
  if (!needsGen) {
    const ageDays = (Date.now() - fs.statSync(thumbPath).mtimeMs) / (1000 * 60 * 60 * 24);
    needsGen = ageDays > 7;
  }
  if (needsGen) {
    console.log('   ↳ 썸네일 자동 생성');
    const result = spawnSync('node', ['finance-blog/generate-thumbnail.js', slug, '1'], {
      cwd: REPO_ROOT,
    });
    if (result.status !== 0) {
      console.warn('   ⚠ 썸네일 생성 실패, 스킵');
      return html;
    }
  }

  if (!fs.existsSync(thumbPath)) {
    console.warn('   ⚠ 썸네일 파일 없음, 스킵');
    return html;
  }

  const relInRepo = ensureImageInGit(thumbPath);
  if (!relInRepo) {
    console.warn('   ⚠ 썸네일 git push 실패');
    return html;
  }

  const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${relInRepo}`;
  console.log(`   ✓ 썸네일 → ${path.basename(thumbPath)}`);

  const tag = `<div class="img-wrap thumb-wrap"><img src="${url}" alt="${slug} 썸네일" loading="eager" /></div>`;
  // <div class="post-finance"> 직후에 삽입
  return html.replace(/(<div class="post-finance"[^>]*>)/, `$1\n${tag}`);
}

// 표의 td에 data-label="컬럼명" 자동 주입 → 모바일에서 CSS로 카드 변환
function addTableMobileLabels(html) {
  return html.replace(/<table([^>]*)>([\s\S]*?)<\/table>/g, (match, attrs, content) => {
    // thead의 th 텍스트 추출
    const theadMatch = content.match(/<thead[\s\S]*?<\/thead>/);
    if (!theadMatch) return match;
    const headers = [];
    const reTh = /<th[^>]*>([\s\S]*?)<\/th>/g;
    let m;
    while ((m = reTh.exec(theadMatch[0])) !== null) {
      // 인라인 태그 제거하고 텍스트만 추출
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      headers.push(text);
    }
    if (headers.length === 0) return match;

    // tbody의 각 tr 안 td에 data-label 추가
    const newContent = content.replace(/<tbody[\s\S]*?<\/tbody>/g, (tbodyMatch) => {
      return tbodyMatch.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/g, (trMatch, trAttrs, trInner) => {
        let cellIdx = 0;
        const newInner = trInner.replace(/<td([^>]*)>/g, (tdMatch, tdAttrs) => {
          if (tdAttrs.includes('data-label')) return tdMatch;
          const label = headers[cellIdx] || '';
          cellIdx += 1;
          return `<td${tdAttrs} data-label="${label}">`;
        });
        return `<tr${trAttrs}>${newInner}</tr>`;
      });
    });

    // 클래스 추가
    let newAttrs = attrs;
    if (!/class\s*=/i.test(newAttrs)) {
      newAttrs = ` class="finance-table-responsive"${newAttrs}`;
    } else {
      newAttrs = newAttrs.replace(/class\s*=\s*"([^"]*)"/i, 'class="$1 finance-table-responsive"');
    }

    return `<table${newAttrs}>${newContent}</table>`;
  });
}

// 한국어 가독성을 위해 문장 끝(., ?, !) 다음에 자동 <br> 삽입
// 표·헤딩·시그니처 영역은 보호
function applyLineBreaks(html) {
  // 보호 영역: 표, 헤딩, 시그니처, img-wrap, code/pre
  const placeholders = [];
  const protect = (regex) => {
    html = html.replace(regex, (m) => {
      placeholders.push(m);
      return `__PROTECT_${placeholders.length - 1}__`;
    });
  };
  protect(/<table[\s\S]*?<\/table>/g);
  protect(/<h[1-6][\s\S]*?<\/h[1-6]>/g);
  protect(/<div class="signature"[\s\S]*?<\/div>/g);
  protect(/<div class="img-wrap"[\s\S]*?<\/div>/g);
  protect(/<pre[\s\S]*?<\/pre>/g);
  protect(/<code[\s\S]*?<\/code>/g);

  // 문장 단위 자동 줄바꿈은 적용하지 않음 (단락은 자연스럽게 흐름)
  // 단, 리스트 li 안의 "(최고 X.XX%):" 같은 라벨 다음에만 본문 분리용 <br>
  html = html.replace(/(%\))(\s*[:：])\s*(<\/strong>)?\s+/g, (m, pct, colon, strongClose) => {
    return pct + colon + (strongClose || '') + '<br>';
  });

  // 복원
  placeholders.forEach((p, i) => {
    html = html.replace(`__PROTECT_${i}__`, p);
  });

  return html;
}

// 💡 / ⚠️ / 시그니처를 컬러 박스 div로 변환
function transformBoxes(html) {
  let result = html;

  // 💡 한눈에 보기 → info-box (노란)
  result = result.replace(
    /<p>\s*💡\s*(<strong>한눈에 보기[:：]?<\/strong>|한눈에 보기[:：]?)([\s\S]*?)<\/p>/g,
    '<div class="info-box">💡 <strong>한눈에 보기:</strong>$2</div>'
  );

  // 💡 핵심 포인트 → point-box (그린)
  result = result.replace(
    /<p>\s*💡\s*(<strong>핵심 포인트[:：]?<\/strong>|핵심 포인트[:：]?)([\s\S]*?)<\/p>/g,
    '<div class="point-box">💡 <strong>핵심 포인트:</strong>$2</div>'
  );

  // ⚠️ 주의 → warn-box (빨간)
  result = result.replace(
    /<p>\s*⚠️\s*([\s\S]*?)<\/p>/g,
    '<div class="warn-box">⚠️ $1</div>'
  );

  // 박재은 시그니처 → 가운데 정렬 시그니처 div
  result = result.replace(
    /<p>\s*💼\s*월급쟁이 재테크\s*[—-]\s*박재은이 정리합니다\s*<\/p>/g,
    '<div class="signature">💼 월급쟁이 재테크 — 박재은이 정리합니다</div>'
  );

  return result;
}

// git에 추적되지 않은 이미지를 add+commit+push해서 GitHub raw URL 사용 가능하게
function ensureImageInGit(filePath) {
  const relative = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', relative], {
    cwd: REPO_ROOT,
  }).status === 0;

  if (tracked) {
    // 이미 추적 중이면 변경분만 push (변경 없으면 스킵)
    const status = spawnSync('git', ['status', '--porcelain', relative], { cwd: REPO_ROOT });
    if (status.stdout.toString().trim()) {
      console.log(`   ↻ ${relative} 변경됨, push 중...`);
      spawnSync('git', ['add', relative], { cwd: REPO_ROOT });
      spawnSync('git', ['commit', '-m', `chore(finance): update image ${path.basename(filePath)} [skip ci]`], { cwd: REPO_ROOT });
      spawnSync('git', ['push'], { cwd: REPO_ROOT });
    }
    return relative;
  }

  console.log(`   ↑ ${relative} git에 추가 + push`);
  spawnSync('git', ['add', relative], { cwd: REPO_ROOT });
  spawnSync('git', ['commit', '-m', `chore(finance): add image ${path.basename(filePath)} [skip ci]`], { cwd: REPO_ROOT });
  const pushResult = spawnSync('git', ['push'], { cwd: REPO_ROOT });
  if (pushResult.status !== 0) {
    console.warn(`   ⚠ git push 실패. base64 fallback`);
    return null;
  }
  return relative;
}

async function injectImages(html, slug) {
  const sharp = require('sharp');
  // cover는 썸네일과 중복돼 제외. section-1·section-2만 본문 중간 H2 위에 삽입
  const slots = ['section-1', 'section-2'];
  const imageTags = [];

  for (const slot of slots) {
    // 슬러그-매칭 우선, 없으면 day-NN-{slug} fallback
    let file = path.join(IMAGES_DIR, `${slug}-${slot}.jpg`);
    if (!fs.existsSync(file)) {
      const fallback = fs.readdirSync(IMAGES_DIR).find(f => f.endsWith(`${slug}-${slot}.jpg`));
      if (fallback) file = path.join(IMAGES_DIR, fallback);
      else {
        console.log(`   ℹ ${slot} 이미지 없음, 스킵`);
        continue;
      }
    }

    // git에 push해서 raw URL 사용 (Blogger가 base64를 자동 sanitize함)
    const relInRepo = ensureImageInGit(file);

    let imgSrc;
    if (relInRepo) {
      imgSrc = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${relInRepo}`;
      console.log(`   ✓ ${slot} → ${imgSrc.split('/').slice(-1)[0]}`);
    } else {
      // base64 fallback (작동 안 할 가능성 큼)
      const buf = await sharp(file).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      imgSrc = `data:image/jpeg;base64,${buf.toString('base64')}`;
      console.log(`   ⚠ ${slot} base64 fallback`);
    }

    imageTags.push(
      `<div class="img-wrap"><img src="${imgSrc}" alt="${slot}" loading="lazy" /></div>`
    );
  }

  if (imageTags.length === 0) return html;

  // 첫 H2 위에는 사진 안 넣음 (썸네일과 너무 가까워 중복 느낌)
  // 두 번째 H2부터 imageTags[0], 세 번째 H2부터 imageTags[1] ...
  let result = html;
  let h2Count = 0;
  result = result.replace(/<h2(\s|>)/g, (match, after) => {
    h2Count += 1;
    const tagIdx = h2Count - 2; // 첫 H2(h2Count=1) 스킵, 두 번째(h2Count=2)부터 [0]
    if (tagIdx >= 0 && tagIdx < imageTags.length) {
      return imageTags[tagIdx] + '\n<h2' + after;
    }
    return match;
  });

  return result;
}

// ========== 메인 ==========
(async () => {
  const { slug, publish } = parseArgs();
  console.log('▶ Publish-Finance 시작');

  // 입력 파일 검증
  const htmlPath = path.join(DRAFTS_DIR, `${slug}.html`);
  const metaPath = path.join(DRAFTS_DIR, `${slug}-meta.json`);
  if (!fs.existsSync(htmlPath)) throw new Error(`본문 없음: ${htmlPath}`);
  if (!fs.existsSync(metaPath)) throw new Error(`메타 없음: ${metaPath}\n   먼저 write-draft.js 실행`);

  const html = fs.readFileSync(htmlPath, 'utf8');
  const meta = readJSON(metaPath);
  console.log(`   ✓ ${meta.title}`);

  const blogId = process.env.FINANCE_BLOG_ID;
  if (!blogId) {
    console.error('\n❌ FINANCE_BLOG_ID 환경변수 미설정');
    console.error('   .env에 추가: FINANCE_BLOG_ID=<재테크 블로그 ID>');
    console.error('   ID는 Blogger 관리자 URL의 blogID= 뒤 숫자');
    process.exit(1);
  }

  console.log('\n[1/3] OAuth 토큰');
  const accessToken = await getBloggerAccessToken();
  console.log('   ✓ access_token 발급');

  // 같은 제목 가진 모든 DRAFT 정리 (중복 임시저장 방지)
  console.log('\n[1.5/3] 같은 제목 DRAFT 정리');
  const cleaned = await deleteAllDraftsWithSameTitle({ accessToken, blogId, title: meta.title });
  if (cleaned > 0) console.log(`   ✓ ${cleaned}개 정리`);
  else console.log('   ℹ 정리할 중복 없음');

  console.log('\n[2/3] DRAFT 업로드');
  const enriched = await enrichContent({ html, meta, slug });
  const draft = await uploadDraft({
    accessToken,
    blogId,
    title: meta.title,
    labels: meta.labels || [],
    content: enriched,
  });
  console.log(`   ✓ postId=${draft.id}`);
  console.log(`   ↳ DRAFT URL: ${draft.url || '(미발행)'}`);

  // last_post_id 저장 (다음 publish에서 자동 삭제하도록)
  meta.last_post_id = draft.id;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  if (!publish) {
    console.log('\n─'.repeat(60));
    console.log(`✓ DRAFT 저장 완료 (발행 안 함). slug=${slug}`);
    console.log('   발행하려면 --publish now 또는 --publish 2026-05-04T08:00:00+09:00');
    await notifyTelegram(`💼 재테크 DRAFT 저장: *${meta.title}*\nslug: \`${slug}\``);
    return;
  }

  console.log(`\n[3/3] 발행 (${publish})`);
  const published = await publishPost({
    accessToken,
    blogId,
    postId: draft.id,
    publishDate: publish,
  });
  console.log(`   ✓ 발행 완료: ${published.url}`);

  console.log('\n─'.repeat(60));
  console.log(`✓ Publish 완료: ${published.url}`);
  await notifyTelegram(
    `💼 재테크 발행 완료\n*${meta.title}*\n${published.url}`
  );
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
