// 과일 블로그(Blogger) 글 → 네이버 스마트에디터 호환 HTML 변환
// 네이버는 공식 API 없음 → 반자동. 사장님이 HTML 복사 → 스마트에디터 붙여넣기.
//
// 사용법:
//   node auto-publish-naver.js                # fruit-blog/topics.yaml의 최근 draft/ready 주제
//   node auto-publish-naver.js --day 2        # 특정 Day
//
// 출력:
//   naver-blog/drafts/day-02-<slug>.html
//   (텔레그램 알림: raw URL + 복사 안내)

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ========== env ==========
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
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

const FRUIT_DRAFTS_DIR = path.join(__dirname, 'fruit-blog', 'drafts');
const NAVER_DRAFTS_DIR = path.join(__dirname, 'naver-blog', 'drafts');
const TOPICS_PATH = path.join(__dirname, 'fruit-blog', 'topics.yaml');

// ========== 텔레그램 ==========
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) console.error('⚠️ 텔레그램 실패:', await res.text());
  } catch (e) { console.error('⚠️ 텔레그램 예외:', e.message); }
}

// ========== HTML 변환 ==========
// 네이버 스마트에디터가 복붙 시 안정적으로 받아들이는 포맷으로 정리.
// 유지: <h2> <h3> <p> <img> <table>, <blockquote>, <ul> <ol> <li>, inline style (text-align/color/background-color/font-weight/padding/margin/border)
// 제거: class, script, iframe, 썸네일 대형 <div>, <style>
function cleanForNaver(html, { imageBaseUrl } = {}) {
  let out = html;

  // 1. script / style / iframe 제거
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // 2. Blogger 커버 썸네일 div 제거 (네이버는 별도 대표 이미지 설정)
  out = out.replace(
    /<div[^>]*text-align:center;margin:0 0 (?:24|32)px 0;[^>]*>\s*<img[^>]*\/?>[\s\S]*?<\/div>\s*/gi,
    ''
  );

  // 3. class 속성 제거 (네이버 CSS와 충돌 방지)
  out = out.replace(/\sclass="[^"]*"/gi, '');

  // 4. 이미지 src 치환 — 로컬 상대경로 → GitHub raw URL
  if (imageBaseUrl) {
    out = out.replace(/src="(?!https?:)([^"]+)"/gi, (m, relPath) => {
      const clean = relPath.replace(/^\.?\/?/, '');
      return `src="${imageBaseUrl}/${clean}"`;
    });
  }

  // 5. data URL (base64) 이미지는 경고만 (네이버 복붙 시 용량 이슈)
  const base64Count = (out.match(/src="data:image\/[^"]{100,}"/gi) || []).length;
  if (base64Count > 0) {
    console.warn(`  ⚠️ base64 이미지 ${base64Count}개 — 네이버 스마트에디터 복붙 시 느릴 수 있음`);
  }

  // 6. 빈 p/div 정리
  out = out.replace(/<p>\s*<\/p>/gi, '');
  out = out.replace(/<div>\s*<\/div>/gi, '');
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

// 네이버용 안내 문구를 맨 위에 주석으로 삽입 (복붙 시 HTML 주석은 무시됨)
function wrapForCopyPaste(cleanedHtml, { title, day }) {
  return `<!--
  네이버 블로그 ${day ? 'Day ' + day + ' — ' : ''}${title}
  이 HTML 전체를 복사해서 네이버 블로그 스마트에디터 '아래쪽 ⋮ 메뉴 → HTML 모드'에 붙여넣으세요.
  이미지는 자동으로 네이버 서버에 재업로드됩니다 (약간 기다리세요).
-->
${cleanedHtml}
`;
}

// ========== Day 선택 ==========
function loadTopics() {
  return yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8'));
}

function pickTopic(dayArg) {
  const data = loadTopics();
  if (dayArg) {
    const t = data.topics.find(t => t.day === dayArg);
    if (!t) throw new Error(`Day ${dayArg} 주제 없음`);
    return t;
  }
  // 우선순위: 가장 최근 draft > ready
  const draft = [...data.topics].reverse().find(t => t.status === 'draft');
  if (draft) return draft;
  const ready = data.topics.find(t => t.status === 'ready');
  if (ready) return ready;
  throw new Error('변환할 주제 없음 (draft/ready 없음)');
}

function findDraftFile(topic) {
  const slug = topic.slug;
  const prefix = `day-${String(topic.day).padStart(2, '0')}-${slug}`;
  const candidates = fs.readdirSync(FRUIT_DRAFTS_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.html'));
  if (candidates.length === 0) {
    throw new Error(`Blogger 드래프트 없음: ${FRUIT_DRAFTS_DIR}/${prefix}*.html`);
  }
  return path.join(FRUIT_DRAFTS_DIR, candidates[0]);
}

// ========== 메인 ==========
(async () => {
  try {
    const args = process.argv.slice(2);
    const dayArg = args.indexOf('--day') >= 0 ? parseInt(args[args.indexOf('--day') + 1]) : null;

    const topic = pickTopic(dayArg);
    console.log(`\n🍎 네이버 변환: Day ${topic.day} — ${topic.title}`);

    const srcPath = findDraftFile(topic);
    const originalHtml = fs.readFileSync(srcPath, 'utf8');
    console.log(`   📄 원본: ${path.relative(__dirname, srcPath)} (${Math.round(originalHtml.length / 1024)}KB)`);

    // GitHub raw URL 계산 (환경변수 또는 기본값)
    const repo = process.env.GITHUB_REPOSITORY || 'khe3716/content-studio';
    const imageBaseUrl = `https://raw.githubusercontent.com/${repo}/main`;

    const cleaned = cleanForNaver(originalHtml, { imageBaseUrl });
    const wrapped = wrapForCopyPaste(cleaned, { title: topic.title, day: topic.day });

    if (!fs.existsSync(NAVER_DRAFTS_DIR)) fs.mkdirSync(NAVER_DRAFTS_DIR, { recursive: true });
    const outName = path.basename(srcPath);
    const outPath = path.join(NAVER_DRAFTS_DIR, outName);
    fs.writeFileSync(outPath, wrapped, 'utf8');
    console.log(`   💾 저장: ${path.relative(__dirname, outPath)} (${Math.round(wrapped.length / 1024)}KB)`);

    const rawUrl = `${imageBaseUrl}/naver-blog/drafts/${outName}`;
    console.log(`   🔗 ${rawUrl}`);

    await notifyTelegram(
      `📝 <b>네이버 블로그 변환 완료</b>\n\n` +
      `Day ${topic.day} — ${topic.title}\n\n` +
      `1️⃣ 아래 링크 눌러서 HTML 열기\n` +
      `<a href="${rawUrl}">${outName}</a>\n\n` +
      `2️⃣ <b>HTML 주석(&lt;!-- --&gt;) 아래</b>부터 전체 복사\n\n` +
      `3️⃣ 네이버 블로그 <b>글쓰기 → 우하단 &lt;/&gt;(HTML) 버튼</b> 누르고 붙여넣기\n\n` +
      `⚠️ 초기 3개월 지수 쌓을 때까지 <b>달콤살랑 링크·언급 금지</b>`
    );

    console.log('\n✅ 완료. 텔레그램에서 복사 안내 확인하세요.');
  } catch (err) {
    console.error('❌ 실패:', err.message);
    process.exit(1);
  }
})();
