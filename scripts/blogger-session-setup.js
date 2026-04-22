// 1회성 Blogger 로그인 — Playwright 세션 저장 (storageState 방식)
// 실행 후 브라우저 창이 열리면 구글 로그인 → Blogger 접속 → 창 닫지 말고 스크립트가 자동 저장함
//
// 사용법: node scripts/blogger-session-setup.js
// 결과: .blogger-session/state.json 에 쿠키·로컬스토리지 저장 (gitignore됨)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', '.blogger-session');
const STATE_PATH = path.join(SESSION_DIR, 'state.json');

(async () => {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  console.log('\n🔐 Blogger 로그인 세션 설정');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('잠시 후 크롬 창이 열립니다.');
  console.log('');
  console.log('📝 해야 할 일:');
  console.log('  1. 구글 계정으로 로그인 (평소 Blogger 쓰시는 계정)');
  console.log('  2. Blogger 관리자 페이지(https://www.blogger.com)가 정상 로딩되기까지 대기');
  console.log('  3. 터미널로 돌아와서 Enter 키 1번');
  console.log('');
  console.log('⚠️  절대 창을 수동으로 닫지 마세요. Enter 누르면 자동 저장 후 종료됩니다.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto('https://www.blogger.com');

  console.log('🌐 브라우저가 열렸습니다. Blogger에 로그인하세요.');
  console.log('   로그인 완료 후 이 터미널에서 Enter 누르면 저장됩니다.\n');

  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => resolve());
  });

  console.log('\n💾 세션 저장 중...');
  await context.storageState({ path: STATE_PATH });
  await browser.close();
  console.log(`✅ 완료! 세션이 ${STATE_PATH}에 저장됐습니다.`);
  console.log('\n이제 blogger-finalize-post.js가 이 세션으로 자동 로그인됩니다.');
  process.exit(0);
})().catch(err => {
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
