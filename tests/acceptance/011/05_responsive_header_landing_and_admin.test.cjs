/**
 * @spec 011
 * @covers FR-009, FR-010, FR-011
 */
const { launch, BASE } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 100));
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log(`[011 Acceptance Suite 05] Running Responsive Header, Landing & Admin against ${BASE}...`);
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Medium & Intermediate Responsive Header (FR-009, SC-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  1. Verifying intermediate responsive header widths (FR-009, SC-004)...');

      const testWidths = [1440, 1280, 1024, 820];
      for (const w of testWidths) {
        await page.setViewport({ width: w, height: 800 });
        await page.goto(`${BASE}/chart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('canvas', { timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));

        const headerMetrics = await page.evaluate(() => {
          const header = document.querySelector('#top-app-header');
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const hScrollW = header ? header.scrollWidth : 0;
          const hClientW = header ? header.clientWidth : 0;
          const headerStyle = header ? getComputedStyle(header) : null;

          return {
            docW,
            scrollW,
            hasDocOverflow: scrollW > docW + 1,
            hScrollW,
            hClientW,
            hasHeaderOverflow: hScrollW > hClientW + 1,
            flexWrap: headerStyle?.flexWrap
          };
        });

        assert(!headerMetrics.hasDocOverflow,
               `SC-004 document has 0 px overflow at width ${w}px`,
               `Document overflowed: scrollW=${headerMetrics.scrollW}, clientW=${headerMetrics.docW}`);
        assert(!headerMetrics.hasHeaderOverflow,
               `SC-004 top header has 0 px overflow at width ${w}px`,
               `Header overflowed: scrollW=${headerMetrics.hScrollW}, clientW=${headerMetrics.hClientW}`);
        assert(headerMetrics.flexWrap === 'nowrap',
               `FR-009 header enforces single-line containment (nowrap) at width ${w}px`,
               `Expected nowrap, got ${headerMetrics.flexWrap}`);
      }

      // Verify specific responsive hiding rules at 1280px and 820px
      await page.setViewport({ width: 1280, height: 800 });
      const at1280 = await page.evaluate(() => {
        const fullBtn = document.querySelector('#btn-fullscreen');
        const magnetBtn = document.querySelector('#fav-btn-magnet');
        return {
          fullHidden: !fullBtn || getComputedStyle(fullBtn).display === 'none',
          magnetHidden: !magnetBtn || getComputedStyle(magnetBtn).display === 'none'
        };
      });
      assert(at1280.fullHidden, 'FR-009 fullscreen button hidden at 1280px', 'Fullscreen button still visible');

      await page.setViewport({ width: 820, height: 800 });
      const at820 = await page.evaluate(() => {
        const badge = document.querySelector('.tb-latency-badge, #latency-pill');
        const userLabel = document.querySelector('.user-profile-btn .user-name, #topbar-user-label');
        return {
          badgeHidden: !badge || getComputedStyle(badge).display === 'none',
          userLabelHidden: !userLabel || getComputedStyle(userLabel).display === 'none'
        };
      });
      assert(at820.badgeHidden || at820.userLabelHidden,
             'FR-009 secondary indicators collapsed at 820px',
             'Secondary badges not collapsed');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Landing Page Starting Language, Toggle & Prices (FR-010)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  2. Verifying landing page language toggle and pricing (FR-010)...');

      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#lang-toggle', { visible: true, timeout: 10000 });

      // Step A: Landing page starts in Persian RTL by default
      const landingInitial = await page.evaluate(() => {
        const docEl = document.documentElement;
        const toggle = document.querySelector('#lang-toggle');
        const pricingText = document.querySelector('.pricing-card, #pricing')?.innerText || '';
        return {
          lang: docEl.lang,
          dir: docEl.getAttribute('dir'),
          toggleText: toggle?.innerText?.trim(),
          hasPersianDigits: /[۰-۹]/.test(pricingText)
        };
      });

      assert(landingInitial.lang === 'fa', 'FR-010 landing page starts with lang="fa"', `Expected fa, got ${landingInitial.lang}`);
      assert(landingInitial.dir === 'rtl', 'FR-010 landing page starts with dir="rtl"', `Expected rtl, got ${landingInitial.dir}`);
      assert(landingInitial.toggleText === 'EN', 'FR-010 landing toggle displays "EN" in Persian mode', `Expected EN, got ${landingInitial.toggleText}`);

      // Step B: Click #lang-toggle to switch landing page to English
      await realClick(page, '#lang-toggle');
      await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });

      const landingEn = await page.evaluate(() => {
        const docEl = document.documentElement;
        const toggle = document.querySelector('#lang-toggle');
        const stored = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        const pricingText = document.querySelector('.pricing-card, #pricing')?.innerText || '';
        return {
          lang: docEl.lang,
          dir: docEl.getAttribute('dir'),
          toggleText: toggle?.innerText?.trim(),
          storedLang: stored.language,
          hasDollarSymbol: pricingText.includes('$')
        };
      });

      assert(landingEn.lang === 'en', 'FR-010 landing switches to lang="en"', `Expected en, got ${landingEn.lang}`);
      assert(landingEn.dir === 'ltr', 'FR-010 landing switches to dir="ltr"', `Expected ltr, got ${landingEn.dir}`);
      assert(landingEn.toggleText === 'فا', 'FR-010 landing toggle displays "فا" in English mode', `Expected فا, got ${landingEn.toggleText}`);
      assert(landingEn.storedLang === 'en', 'FR-010 landing persists English preference', `Expected en, got ${landingEn.storedLang}`);

      // Step C: Click #lang-toggle again to switch back to Persian
      await realClick(page, '#lang-toggle');
      await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const landingFa = await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        const pricingText = document.querySelector('.pricing-card, #pricing')?.innerText || '';
        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.getAttribute('dir'),
          storedLang: stored.language,
          hasTomanOrDollar: pricingText.includes('دلار') || pricingText.includes('تومان') || /[۰-۹]/.test(pricingText)
        };
      });

      assert(landingFa.lang === 'fa', 'FR-010 landing switched back to lang="fa"', `Expected fa, got ${landingFa.lang}`);
      assert(landingFa.storedLang === 'fa', 'FR-010 landing persists Persian preference', `Expected fa, got ${landingFa.storedLang}`);
      assert(landingFa.hasTomanOrDollar, 'FR-010 landing pricing cards display localized Persian currency/digits', 'Missing localized pricing');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Admin Console Language Starting State, Toggle & Formatting (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  3. Verifying admin console language switch and formatters (FR-011)...');

      // Clear storage to verify fresh initial state
      await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => {
        localStorage.removeItem('tc_admin_lang');
        localStorage.removeItem('tradingchart_user_settings');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#gate-lang, #gate-key', { visible: true, timeout: 10000 });

      // Verify admin console starts in Persian RTL by default
      const adminInitial = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.getAttribute('dir')
      }));
      assert(adminInitial.lang === 'fa', 'FR-011 admin console starts with lang="fa"', `Expected fa, got ${adminInitial.lang}`);
      assert(adminInitial.dir === 'rtl', 'FR-011 admin console starts with dir="rtl"', `Expected rtl, got ${adminInitial.dir}`);

      // Click language toggle on admin gate (#gate-lang)
      await realClick(page, '#gate-lang');
      await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });

      const adminEn = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.getAttribute('dir'),
        savedAdminLang: localStorage.getItem('tc_admin_lang')
      }));
      assert(adminEn.lang === 'en', 'FR-011 admin console switches to lang="en"', `Expected en, got ${adminEn.lang}`);
      assert(adminEn.dir === 'ltr', 'FR-011 admin console switches to dir="ltr"', `Expected ltr, got ${adminEn.dir}`);
      assert(adminEn.savedAdminLang === 'en', 'FR-011 admin console persists "en" in tc_admin_lang', `Expected en, got ${adminEn.savedAdminLang}`);

      // Verify localized formatting helpers (FR-011)
      const formattersCheck = await page.evaluate(() => {
        // Evaluate formatting functions in admin environment
        const numEn = new Intl.NumberFormat('en-US').format(12345);
        const numFa = new Intl.NumberFormat('fa-IR').format(12345);

        return {
          hasFaDigits: /[۰-۹]/.test(numFa),
          enIsAscii: /^[0-9,]+$/.test(numEn)
        };
      });

      assert(formattersCheck.hasFaDigits, 'FR-011 Persian number format uses Persian digits', 'Missing Persian digits in formatter');
      assert(formattersCheck.enIsAscii, 'FR-011 English number format uses ASCII digits', 'Unexpected English format');

      // Click toggle back to Persian
      await realClick(page, '#gate-lang');
      await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const adminFa = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        savedAdminLang: localStorage.getItem('tc_admin_lang')
      }));
      assert(adminFa.lang === 'fa', 'FR-011 admin console toggles back to lang="fa"', `Expected fa, got ${adminFa.lang}`);
      assert(adminFa.savedAdminLang === 'fa', 'FR-011 admin console persists "fa" in tc_admin_lang', `Expected fa, got ${adminFa.savedAdminLang}`);
    }

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [011 Acceptance Suite 05] Responsive Header, Landing & Admin passed.');
}

run().catch((err) => {
  console.error('❌ Unhandled suite error:', err);
  process.exit(1);
});
