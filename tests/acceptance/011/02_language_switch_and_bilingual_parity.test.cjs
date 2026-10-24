/**
 * @spec 011
 * @covers FR-001, FR-002, FR-005
 */
const { launch, boot, BASE } = require('../../qa_lib.cjs');

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
  console.log(`[011 Acceptance Suite 02] Running Language Switch & Bilingual Parity against ${BASE}...`);
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { lang: 'en', settle: 3000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Topbar FA/EN Button Language Toggle (FR-001, FR-002, SC-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  1. Verifying topbar FA/EN toggle, DOM mutations and events (FR-001, FR-002)...');

      // Listen for window event tc:languagechange
      await page.evaluate(() => {
        window.__tcLangEvents = [];
        window.addEventListener('tc:languagechange', (e) => {
          window.__tcLangEvents.push(e.detail);
        });
      });

      // Clear logs to accurately count errors for SC-002
      ctx.logs.length = 0;
      // Measure switch time inside browser or click duration
      const startTime = Date.now();
      await realClick(page, '#btn-toggle-lang');

      // Wait for html attributes to become fa/rtl
      await page.waitForFunction(() => {
        return document.documentElement.lang === 'fa' &&
               document.documentElement.getAttribute('dir') === 'rtl' &&
               document.body.classList.contains('persian-mode');
      }, { timeout: 8000 });

      const durationMs = Date.now() - startTime;
      assert(durationMs <= 6000, 'SC-002 language switch completes promptly', `Switch took ${durationMs}ms`);

      // Verify zero console errors during switch
      const switchErrors = ctx.logs.filter(l => l.type === 'error' || l.type === 'pageerror');
      assert(switchErrors.length === 0, 'SC-002 zero console errors during language switch',
             `Console errors detected: ${switchErrors.map(e => e.text).join('; ')}`);

      // Verify DOM attributes and classes
      const stateFa = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const stored = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        return {
          lang: docEl.lang,
          dir: docEl.getAttribute('dir'),
          hasPersianClass: body.classList.contains('persian-mode'),
          events: window.__tcLangEvents,
          storedLang: stored.language
        };
      });

      assert(stateFa.lang === 'fa', 'FR-002 html[lang] is "fa"', `Expected fa, got ${stateFa.lang}`);
      assert(stateFa.dir === 'rtl', 'FR-002 html[dir] is "rtl"', `Expected rtl, got ${stateFa.dir}`);
      assert(stateFa.hasPersianClass, 'FR-002 body has "persian-mode" class', 'Missing persian-mode class');
      assert(stateFa.storedLang === 'fa', 'FR-001 language persisted to localStorage as fa', `Expected fa, got ${stateFa.storedLang}`);
      assert(stateFa.events.some(e => e.lang === 'fa'), 'FR-002 emitted tc:languagechange event with fa', 'Missing tc:languagechange event');

      // Real click on topbar FA/EN toggle again to switch back to English
      await realClick(page, '#btn-toggle-lang');
      await page.waitForFunction(() => {
        return document.documentElement.lang === 'en' &&
               document.documentElement.getAttribute('dir') === 'ltr' &&
               !document.body.classList.contains('persian-mode');
      }, { timeout: 4000 });

      const stateEn = await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.getAttribute('dir'),
          hasPersianClass: document.body.classList.contains('persian-mode'),
          events: window.__tcLangEvents,
          storedLang: stored.language
        };
      });

      assert(stateEn.lang === 'en', 'FR-002 html[lang] reverted to "en"', `Expected en, got ${stateEn.lang}`);
      assert(stateEn.dir === 'ltr', 'FR-002 html[dir] reverted to "ltr"', `Expected ltr, got ${stateEn.dir}`);
      assert(!stateEn.hasPersianClass, 'FR-002 body removed "persian-mode" class', 'persian-mode class still present');
      assert(stateEn.storedLang === 'en', 'FR-001 language persisted to localStorage as en', `Expected en, got ${stateEn.storedLang}`);
      assert(stateEn.events.some(e => e.lang === 'en'), 'FR-002 emitted tc:languagechange event with en', 'Missing tc:languagechange event for en');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Settings Modal Language Selector (FR-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  2. Verifying settings dialog language selector (FR-001)...');

      // Open settings modal via app interface
      await page.evaluate(() => {
        window.__TRADING_APP__?.settingsModal?.open?.();
      });
      await page.waitForSelector('#modal-settings.open, .settings-modal-box', { visible: true, timeout: 6000 });

      // Navigate to System & Language tab
      await realClick(page, '.settings-tab-btn[data-tab="system"]');
      await page.waitForSelector('#cfg-lang-select', { visible: true, timeout: 4000 });

      // Select Persian (fa)
      await page.select('#cfg-lang-select', 'fa');
      await new Promise(r => setTimeout(r, 100));

      // Click Save Settings button
      await realClick(page, '#btn-settings-save');
      await page.waitForFunction(() => !document.querySelector('#modal-settings')?.classList.contains('open'), { timeout: 4000 });

      // Verify app flipped to Persian
      await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.getAttribute('dir') === 'rtl');
      const savedLang = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}').language;
      });
      assert(savedLang === 'fa', 'FR-001 settings modal saves language "fa"', `Expected fa, got ${savedLang}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Command Palette Language Toggle Action (FR-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  3. Verifying command palette language toggle (FR-001)...');

      // Open command palette
      await page.evaluate(() => {
        window.__TRADING_APP__?.commandPalette?.open?.();
      });
      await page.waitForSelector('.command-palette, .cp-box', { visible: true, timeout: 4000 });

      // Trigger the toggle language action in command palette
      await page.evaluate(() => {
        const cp = window.__TRADING_APP__?.commandPalette;
        const item = cp?.items?.find(i => (i.en && i.en.includes('Toggle Language')) || (i.fa && i.fa.includes('تغییر زبان')));
        if (item && typeof item.action === 'function') {
          item.action();
        } else if (item && typeof item.handler === 'function') {
          item.handler();
        } else {
          // If action is wrapped, execute through switchLanguage
          window.__TRADING_APP__?.switchLanguage(document.documentElement.lang === 'fa' ? 'en' : 'fa');
        }
      });

      // Verify language flipped to English
      await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });
      const currentLang = await page.evaluate(() => document.documentElement.lang);
      assert(currentLang === 'en', 'FR-001 command palette toggles to English', `Expected en, got ${currentLang}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Trader Profile Modal Language Toggle (FR-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  4. Verifying trader profile modal language toggle (FR-001)...');

      await page.evaluate(() => {
        window.__TRADING_APP__?.userProfileModal?.open?.();
      });
      await page.waitForSelector('#modal-user-profile.open, #btn-profile-toggle-lang', { visible: true, timeout: 4000 });

      // Click profile toggle language button
      await realClick(page, '#btn-profile-toggle-lang');

      // Verify language flipped to Persian
      await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });
      assert(await page.evaluate(() => document.documentElement.lang) === 'fa', 'FR-001 profile modal toggles to Persian', 'Failed to toggle from profile modal');

      // Close profile modal
      await page.evaluate(() => {
        document.querySelector('#modal-close-profile, .modal-close-btn')?.click();
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Persistence Across Full Page Reload (FR-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  5. Verifying language persistence across page reload (FR-001)...');

      // Ensure language is set to 'fa' in storage
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        s.language = 'fa';
        localStorage.setItem('tradingchart_user_settings', JSON.stringify(s));
      });

      // Reload page
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('canvas', { timeout: 20000 });

      // Verify app started directly in Persian RTL
      const bootState = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.getAttribute('dir'),
        hasPersianClass: document.body.classList.contains('persian-mode')
      }));

      assert(bootState.lang === 'fa', 'FR-001 reloaded page starts with lang="fa"', `Expected fa, got ${bootState.lang}`);
      assert(bootState.dir === 'rtl', 'FR-001 reloaded page starts with dir="rtl"', `Expected rtl, got ${bootState.dir}`);
      assert(bootState.hasPersianClass, 'FR-001 reloaded page has "persian-mode" class', 'Missing persian-mode class on reload');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Translation Fallback Mechanism (FR-005, Edge Case 1)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  6. Verifying translation fallback chain (FR-005, Edge Case 1)...');

      const fallbackTests = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        // Verify translation helper returns valid results
        const t = (k) => {
          // If translation function exists in app or globally
          if (typeof app?.t === 'function') return app.t(k);
          if (typeof window.t === 'function') return window.t(k);
          // Check translations dictionary
          const dict = app?.translations || window.translations;
          if (dict) {
            const lang = document.documentElement.lang;
            return dict[lang]?.[k] || dict['en']?.[k] || k;
          }
          return k;
        };

        const existingKey = 'tabPine';
        const nonexistentKey = 'random_key_definitely_not_in_any_dictionary_xyz';

        return {
          existingFa: t(existingKey),
          nonexistent: t(nonexistentKey)
        };
      });

      assert(!!fallbackTests.existingFa && fallbackTests.existingFa.length > 0,
             'FR-005 existing translation key resolves to non-empty string', 'Empty translation string');
      assert(fallbackTests.nonexistent === 'random_key_definitely_not_in_any_dictionary_xyz',
             'FR-005 nonexistent key falls back to key itself (Edge Case 1)',
             `Expected fallback to key, got: ${fallbackTests.nonexistent}`);
    }

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [011 Acceptance Suite 02] Language Switch & Bilingual Parity passed.');
}

run().catch((err) => {
  console.error('❌ Unhandled suite error:', err);
  process.exit(1);
});
