// Blogger 포스트 편집 페이지에서 검색 설명 + 맞춤 영구 링크 자동 입력
// Blogger API가 이 필드들을 안 열어서 Playwright로 UI 자동화
//
// 사용법:
//   node scripts/blogger-finalize-post.js --post-id 123456 --slug korean-raspberry-recipe --description "..."
//
// 선행:
//   node scripts/blogger-session-setup.js   (1회성 로그인)

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

const SESSION_DIR = path.join(__dirname, '..', '.blogger-session');
const STATE_PATH = path.join(SESSION_DIR, 'state.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--post-id') out.postId = args[++i];
    else if (args[i] === '--blog-id') out.blogId = args[++i];
    else if (args[i] === '--slug') out.slug = args[++i];
    else if (args[i] === '--description') out.description = args[++i];
    else if (args[i] === '--headless') out.headless = true;
    else if (args[i] === '--no-headless') out.headless = false;
  }
  return out;
}

async function finalizePost({ blogId, postId, slug, description, headless = true }) {
  if (!fs.existsSync(STATE_PATH)) {
    throw new Error('세션 없음. 먼저 `node scripts/blogger-session-setup.js` 실행하세요.');
  }

  console.log(`🤖 Blogger 편집 자동화 시작`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   Slug: ${slug || '(변경 없음)'}`);
  console.log(`   Description: ${description ? description.slice(0, 50) + '...' : '(변경 없음)'}`);

  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  try {
    const editUrl = `https://www.blogger.com/blog/post/edit/${blogId}/${postId}`;
    console.log(`   📄 편집 페이지 여는 중: ${editUrl}`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 로그인 페이지로 redirect 되면 실패
    if (page.url().includes('accounts.google.com')) {
      throw new Error('로그인 만료 — `node scripts/blogger-session-setup.js` 재실행 필요');
    }

    // 에디터 로딩 대기
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000); // 에디터 완전 로딩

    // 우측 사이드바의 "게시물 설정" 패널 열기
    // Blogger 에디터는 iframe·Angular라 여러 셀렉터 시도
    console.log(`   🔧 게시물 설정 패널 탐색 중...`);

    // "퍼머링크" 섹션 열기 (Blogger에선 "영구 링크" 아니고 "퍼머링크")
    if (slug) {
      const permalinkToggleSelectors = [
        'text=퍼머링크',
        'text=Permalink',
        '[aria-label*="퍼머"]',
        '[aria-label*="Permalink"]',
      ];

      let permalinkClicked = false;
      for (const sel of permalinkToggleSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            permalinkClicked = true;
            console.log(`   ✓ "퍼머링크" 섹션 확장 (${sel})`);
            break;
          }
        } catch {}
      }

      if (permalinkClicked) {
        await page.waitForTimeout(1500);

        // "맞춤 퍼머링크" 라디오 버튼 선택
        const customRadioSelectors = [
          'text=맞춤 퍼머링크',
          'text=맞춤 영구 링크',
          'text=Custom Permalink',
          'input[type="radio"][aria-label*="맞춤"]',
        ];
        for (const sel of customRadioSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 1500 })) {
              await el.click();
              console.log(`   ✓ "맞춤 퍼머링크" 선택`);
              await page.waitForTimeout(1500); // 입력란 나타날 시간
              break;
            }
          } catch {}
        }

        // slug 입력란 찾아 입력 (셀렉터 다양화)
        const slugInputSelectors = [
          'input[aria-label*="퍼머"]',
          'input[aria-label*="영구"]',
          'input[aria-label*="Permalink"]',
          'input[placeholder*="퍼머"]',
          'input[placeholder*="영구"]',
          'input[placeholder*="permalink"]',
          'input[name*="permalink"]',
          'input[name*="url"]',
          'input[jsname]:visible',
        ];
        let slugInputFound = false;
        for (const sel of slugInputSelectors) {
          try {
            const inputs = await page.locator(sel).all();
            for (const input of inputs) {
              if (await input.isVisible({ timeout: 800 })) {
                const placeholder = await input.getAttribute('placeholder').catch(() => '');
                const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
                // 검색어·날짜 입력 제외
                if ((placeholder + ariaLabel).match(/검색|날짜|시간|year/i)) continue;
                await input.click();
                await input.fill('');
                await input.fill(slug);
                await page.keyboard.press('Tab'); // blur → 자동 저장
                console.log(`   ✓ Slug 입력: ${slug}`);
                slugInputFound = true;
                break;
              }
            }
            if (slugInputFound) break;
          } catch {}
        }
        if (!slugInputFound) console.warn(`   ⚠️ Slug 입력란을 못 찾음`);
      } else {
        console.warn(`   ⚠️ "퍼머링크" 섹션을 못 찾음`);
      }
    }

    // "검색 설명" 섹션 열기
    if (description) {
      const descToggleSelectors = [
        'text=검색 설명',
        'text=Search Description',
        '[aria-label*="검색 설명"]',
      ];
      let descClicked = false;
      for (const sel of descToggleSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            descClicked = true;
            console.log(`   ✓ "검색 설명" 섹션 확장`);
            break;
          }
        } catch {}
      }

      if (descClicked) {
        await page.waitForTimeout(1000);
        const descInputSelectors = [
          'textarea[aria-label*="검색"]',
          'textarea[aria-label*="Search"]',
          'textarea[placeholder*="검색"]',
          'textarea[placeholder*="search"]',
        ];
        for (const sel of descInputSelectors) {
          try {
            const input = page.locator(sel).last();
            if (await input.isVisible({ timeout: 1500 })) {
              await input.click();
              await input.fill('');
              await input.fill(description);
              await page.keyboard.press('Tab'); // blur → 자동 저장 트리거
              console.log(`   ✓ 검색 설명 입력 (${description.length}자)`);
              break;
            }
          } catch {}
        }
      } else {
        console.warn(`   ⚠️ "검색 설명" 섹션을 못 찾음`);
      }
    }

    // DRAFT 자동 저장 대기 (Blogger 서버 반영까지 12초)
    console.log(`   💾 자동 저장 대기 중... (12초)`);
    await page.waitForTimeout(12000);

    // ==========================================
    // 서버 저장 실제 검증: reload 후 slug + description 둘 다 확인
    // 제목 필드 오염 방지를 위해 좁은 셀렉터만 사용
    // ==========================================
    console.log(`   🔁 새로고침으로 서버 저장 검증 중...`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ========== slug 재검증 ==========
    if (slug) {
      // 퍼머링크 섹션 다시 열기
      try {
        const permalinkEl = page.locator('text=퍼머링크').first();
        if (await permalinkEl.isVisible({ timeout: 3000 })) {
          await permalinkEl.click();
          await page.waitForTimeout(1500);
        }
      } catch {}

      // 검증 셀렉터: 퍼머링크 전용만 (제목 필드 건드리지 않도록)
      const SAFE_PERMALINK_SELECTORS = [
        'input[aria-label*="퍼머"]',
        'input[aria-label*="영구"]',
        'input[aria-label*="Permalink"]',
        'input[placeholder*="퍼머"]',
        'input[placeholder*="permalink"]',
        'input[name*="permalink"]',
      ];

      async function findSlugInput() {
        for (const sel of SAFE_PERMALINK_SELECTORS) {
          try {
            const inputs = await page.locator(sel).all();
            for (const input of inputs) {
              if (!(await input.isVisible({ timeout: 500 }))) continue;
              const placeholder = await input.getAttribute('placeholder').catch(() => '') || '';
              const ariaLabel = await input.getAttribute('aria-label').catch(() => '') || '';
              // 제목·검색·날짜·라벨 등 완전 배제
              if ((placeholder + ariaLabel).match(/제목|Title|검색|Search|날짜|date|라벨|Label|year/i)) continue;
              return input;
            }
          } catch {}
        }
        return null;
      }

      const slugInput = await findSlugInput();
      if (slugInput) {
        const val = await slugInput.inputValue().catch(() => '');
        if (val && val.includes(slug)) {
          console.log(`   ✓ 서버에 slug 저장 확인: ${val}`);
        } else {
          console.warn(`   ⚠️ slug 사라짐 (현재값: "${val}") — 재입력 시도`);
          // "맞춤 퍼머링크" 라디오 다시 선택
          for (const sel of ['text=맞춤 퍼머링크', 'text=맞춤 영구 링크', 'text=Custom Permalink']) {
            try {
              const el = page.locator(sel).first();
              if (await el.isVisible({ timeout: 1500 })) {
                await el.click();
                await page.waitForTimeout(1500);
                break;
              }
            } catch {}
          }
          const slugInput2 = await findSlugInput();
          if (slugInput2) {
            await slugInput2.click();
            await slugInput2.fill('');
            await slugInput2.fill(slug);
            await page.keyboard.press('Tab');
            console.log(`   ✓ slug 재입력: ${slug}`);
            await page.waitForTimeout(10000);
          } else {
            console.warn(`   ⚠️ slug input 재탐색 실패`);
          }
        }
      } else {
        console.warn(`   ⚠️ slug input 자체를 못 찾음 (퍼머링크 필터 통과 못함)`);
      }
    }

    // ========== 검색 설명 재검증 ==========
    if (description) {
      try {
        // 검색 설명 섹션 열기 (닫혀있으면)
        const descToggle = page.locator('text=검색 설명').first();
        if (await descToggle.isVisible({ timeout: 2000 })) {
          // 이미 열려있으면 클릭하면 닫힘 — 일단 클릭해서 상태 확인
          await descToggle.click();
          await page.waitForTimeout(1000);
          // 열림 후 textarea 찾아보고 없으면 한 번 더 클릭 (원래 열려있었던 것)
        }

        async function findDescTextarea() {
          const sels = [
            'textarea[aria-label*="검색"]',
            'textarea[aria-label*="Search"]',
            'textarea[placeholder*="검색"]',
            'textarea[placeholder*="Search"]',
          ];
          for (const sel of sels) {
            const items = await page.locator(sel).all();
            for (const t of items) {
              if (await t.isVisible({ timeout: 500 })) return t;
            }
          }
          return null;
        }

        let descInput = await findDescTextarea();
        if (!descInput) {
          // 토글이 오히려 닫은 경우 다시 열기
          await descToggle.click().catch(() => {});
          await page.waitForTimeout(1000);
          descInput = await findDescTextarea();
        }

        if (descInput) {
          const val = await descInput.inputValue().catch(() => '');
          if (val && val.length >= 30 && val.includes(description.slice(0, 15))) {
            console.log(`   ✓ 서버에 검색 설명 저장 확인 (${val.length}자)`);
          } else {
            console.warn(`   ⚠️ 검색 설명 사라짐 (길이: ${val.length}) — 재입력`);
            await descInput.click();
            await descInput.fill('');
            await descInput.type(description, { delay: 10 });
            await page.waitForTimeout(500);
            // 명시적 blur: 다른 곳 클릭 대신 키보드 이동
            await page.keyboard.press('Tab');
            console.log(`   ✓ 검색 설명 재입력 (${description.length}자)`);
            await page.waitForTimeout(10000);
          }
        } else {
          console.warn(`   ⚠️ 검색 설명 textarea 못 찾음`);
        }
      } catch (e) {
        console.warn(`   ⚠️ 검색 설명 검증 실패: ${e.message}`);
      }
    }

    console.log(`✅ Blogger 메타 자동 설정 완료`);
    return true;
  } catch (err) {
    try {
      await page.screenshot({ path: path.join(__dirname, '..', 'debug-blogger-error.png') });
    } catch {}
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

// CLI
if (require.main === module) {
  const args = parseArgs();
  if (!args.postId) {
    console.error('❌ --post-id 필수');
    process.exit(1);
  }
  const blogId = args.blogId || process.env.FRUIT_BLOG_ID || process.env.BLOG_ID;
  if (!blogId) {
    console.error('❌ --blog-id 또는 FRUIT_BLOG_ID 환경변수 필수');
    process.exit(1);
  }

  finalizePost({
    blogId,
    postId: args.postId,
    slug: args.slug,
    description: args.description,
    headless: args.headless !== false,
  }).then(() => process.exit(0))
    .catch(err => {
      console.error('❌ 실패:', err.message);
      process.exit(1);
    });
}

module.exports = { finalizePost };
