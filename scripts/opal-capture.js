// Opal 앱 캡처용 — 로그인 세션 유지 + 신호 파일 대기
// 실행: node scripts/opal-capture.js
// 캡처 트리거: 같은 폴더에 opal-ready.txt 파일이 생기면 즉시 스크린샷 + HTML 덤프

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OPAL_URL = 'https://opal.google/app/1EEQTS_NUio9qtw6sTCVCQ9yyCW7zqhxS';
const SESSION_DIR = path.join(__dirname, '..', '.opal-session');
const OUT_DIR = path.join(__dirname, '..', 'tmp', 'opal-capture');
const SIGNAL_FILE = path.join(OUT_DIR, 'opal-ready.txt');
const SHOT_FILE = path.join(OUT_DIR, 'opal-screen.png');
const HTML_FILE = path.join(OUT_DIR, 'opal-screen.html');
const TEXT_FILE = path.join(OUT_DIR, 'opal-text.txt');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(SIGNAL_FILE)) fs.unlinkSync(SIGNAL_FILE);

(async () => {
  console.log('🌐 브라우저 창을 엽니다...');
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--start-maximized'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(OPAL_URL, { waitUntil: 'domcontentloaded' });
  console.log('✅ 페이지 로드 완료');
  console.log('   URL:', OPAL_URL);
  console.log('');
  console.log('👉 이제 창에서 Google 로그인하시고, 원하는 Opal 화면까지 이동해주세요.');
  console.log('   준비되면 Claude에게 "됐어"라고 말씀하시면 자동 캡처됩니다.');
  console.log('');
  console.log('⏳ 신호 대기 중:', SIGNAL_FILE);

  const start = Date.now();
  const TIMEOUT_MS = 15 * 60 * 1000;
  while (!fs.existsSync(SIGNAL_FILE)) {
    if (Date.now() - start > TIMEOUT_MS) {
      console.log('⏱️  15분 초과 — 자동 캡처');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('📸 캡처 시작...');
  try {
    await page.screenshot({ path: SHOT_FILE, fullPage: true });
    console.log('  ✅ 스크린샷:', SHOT_FILE);
  } catch (e) {
    console.log('  ⚠️  fullPage 실패, 뷰포트 캡처:', e.message);
    await page.screenshot({ path: SHOT_FILE });
  }

  try {
    const html = await page.content();
    fs.writeFileSync(HTML_FILE, html);
    console.log('  ✅ HTML:', HTML_FILE);

    const text = await page.evaluate(() => document.body.innerText || '');
    fs.writeFileSync(TEXT_FILE, text);
    console.log('  ✅ 텍스트:', TEXT_FILE);
  } catch (e) {
    console.log('  ⚠️  DOM 덤프 실패:', e.message);
  }

  await context.close();
  console.log('🎉 캡처 완료. 브라우저 종료됨.');
})();
