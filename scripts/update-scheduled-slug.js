// SCHEDULED 상태 Blogger 글의 퍼머링크를 Playwright로 재설정
//
// 전략 B: API /publish로 이미 예약된 상태에서
//   편집 페이지 → 맞춤 퍼머링크 → slug 입력 → "업데이트" 버튼 → 재저장
//
// 사용법:
//   node scripts/update-scheduled-slug.js --blog-id ... --post-id ... --slug ...
//   node scripts/update-scheduled-slug.js --post-id 7567302671676126866 --slug what-is-exchange-rate
//
// 결과: 스크린샷이 debug-scheduled-edit.png로 저장됨

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { headless: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--blog-id') out.blogId = args[++i];
    else if (args[i] === '--post-id') out.postId = args[++i];
    else if (args[i] === '--slug') out.slug = args[++i];
    else if (args[i] === '--no-headless') out.headless = false;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const blogId = args.blogId || process.env.BLOG_ID;
  const { postId, slug, headless } = args;

  if (!blogId || !postId || !slug) {
    console.error('❌ --blog-id, --post-id, --slug 필수');
    process.exit(1);
  }

  const statePath = path.join(__dirname, '..', '.blogger-session', 'state.json');
  if (!fs.existsSync(statePath)) {
    console.error('❌ 세션 없음:', statePath);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    storageState: statePath,
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  try {
    const editUrl = `https://www.blogger.com/blog/post/edit/${blogId}/${postId}`;
    console.log(`🔗 편집 페이지: ${editUrl}`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (page.url().includes('accounts.google.com')) {
      throw new Error('로그인 만료');
    }

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 퍼머링크 섹션 열기
    console.log('🔧 퍼머링크 섹션 열기');
    const permalinkToggle = page.locator('text=퍼머링크').first();
    if (await permalinkToggle.isVisible({ timeout: 3000 })) {
      await permalinkToggle.click();
      await page.waitForTimeout(1500);
    }

    // 맞춤 퍼머링크 라디오
    console.log('🔘 맞춤 퍼머링크 라디오 선택');
    const radioCandidates = [
      '[role="radio"][aria-label*="맞춤"]',
      'input[type="radio"][aria-label*="맞춤"]',
      'text=맞춤 퍼머링크',
    ];
    for (const sel of radioCandidates) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 })) {
          await el.click();
          console.log(`  ✓ 클릭: ${sel}`);
          break;
        }
      } catch {}
    }

    // slug input 대기 + 입력
    const slugLocator = page.locator('input[aria-label="맞춤 퍼머링크 입력"], input[aria-label*="맞춤 퍼머"]').first();
    await slugLocator.waitFor({ state: 'visible', timeout: 6000 });
    console.log('✍️  slug 입력');
    await slugLocator.click();
    await slugLocator.fill('');
    await page.waitForTimeout(300);
    await slugLocator.type(slug, { delay: 30 });
    await slugLocator.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    });
    console.log(`  ✓ 입력 완료: ${slug}`);

    // "업데이트" 버튼 찾기 — Blogger SCHEDULED 편집의 주황색 버튼
    console.log('💾 "업데이트" 버튼 탐색');
    await page.waitForTimeout(2000);

    // 디버그: 오른쪽 위 버튼 dump
    const btnDump = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('div[role="button"], button')];
      return buttons
        .filter(b => b.offsetParent !== null && b.textContent && b.textContent.trim().length > 0 && b.textContent.trim().length < 20)
        .slice(0, 30)
        .map(b => ({
          text: b.textContent.trim(),
          aria: b.getAttribute('aria-label') || '',
        }));
    });
    console.log('[DEBUG] 보이는 버튼들:', JSON.stringify(btnDump));

    // 여러 셀렉터 시도
    const updateBtnCandidates = [
      '[aria-label="게시"]',
      '[aria-label="업데이트"]',
      '[aria-label*="게시"]',
      '[aria-label*="업데이트"]',
      '[aria-label="Publish"]',
      '[aria-label="Update"]',
      'div[role="button"]:has-text("업데이트")',
      'div[role="button"]:has-text("게시")',
      'button:has-text("업데이트")',
      'button:has-text("게시")',
    ];
    let clicked = false;
    for (const sel of updateBtnCandidates) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click();
          console.log(`  ✓ 클릭: ${sel}`);
          clicked = true;
          break;
        }
      } catch {}
    }

    if (!clicked) {
      await page.screenshot({ path: path.join(__dirname, '..', 'debug-no-update-btn.png') });
      console.warn('  ⚠️ "업데이트" 버튼 못 찾음 — 스크린샷 저장');
    } else {
      // 확인 다이얼로그가 뜨면 확인 클릭
      await page.waitForTimeout(2000);
      for (const sel of ['[aria-label="확인"]', 'div[role="button"]:has-text("확인")', 'button:has-text("확인")']) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            console.log(`  ✓ 확인 다이얼로그: ${sel}`);
            break;
          }
        } catch {}
      }
      console.log('💾 저장 중 (5초 대기)');
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: path.join(__dirname, '..', 'debug-scheduled-edit.png') }).catch(() => {});
    console.log('✅ 완료 — 스크린샷: debug-scheduled-edit.png');
  } catch (e) {
    console.error('❌ 에러:', e.message);
    await page.screenshot({ path: path.join(__dirname, '..', 'debug-error.png') }).catch(() => {});
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
