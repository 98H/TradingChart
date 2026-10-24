/**
 * @spec 001
 * @covers FR-019, FR-020, FR-023, FR-024
 */
const { launch, boot } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
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
  // ── Desktop Suite: FR-019, FR-020, FR-023 ──
  const desktopCtx = await launch('desktop');
  const { page: dPage } = desktopCtx;

  try {
    await boot(desktopCtx);

    // ── FR-019: FA/EN Language Switch, Direction, Fonts, Labels & Persistence ──
    {
      const langBtn = '#btn-toggle-lang';
      await dPage.waitForSelector(langBtn, { visible: true, timeout: 5000 });

      // 1. Switch EN -> FA
      await realClick(dPage, langBtn);
      await dPage.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.getAttribute('dir') === 'rtl', { timeout: 5000 });

      const isPersianMode = await dPage.evaluate(() => document.body.classList.contains('persian-mode'));
      assert(isPersianMode, 'FR-019 FA font mode active', 'document.body must have "persian-mode" class in Persian');

      const quantLabelFa = await dPage.evaluate(() => document.querySelector('#nav-label-quant')?.innerText?.trim());
      assert(quantLabelFa === 'کوانت', 'FR-019 shell label localized to Persian', `Expected "کوانت", got "${quantLabelFa}"`);

      const storedLangFa = await dPage.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}').language; } catch (e) { return null; }
      });
      assert(storedLangFa === 'fa', 'FR-019 language persistence in FA', `Expected stored language "fa", got "${storedLangFa}"`);

      // 2. Switch FA -> EN
      await realClick(dPage, langBtn);
      await dPage.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.getAttribute('dir') === 'ltr', { timeout: 5000 });

      const isPersianModeDisabled = await dPage.evaluate(() => !document.body.classList.contains('persian-mode'));
      assert(isPersianModeDisabled, 'FR-019 Persian font mode removed in EN', 'document.body must not have "persian-mode" in English');

      const quantLabelEn = await dPage.evaluate(() => document.querySelector('#nav-label-quant')?.innerText?.trim());
      assert(quantLabelEn === 'Quant', 'FR-019 shell label localized to English', `Expected "Quant", got "${quantLabelEn}"`);

      const storedLangEn = await dPage.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}').language; } catch (e) { return null; }
      });
      assert(storedLangEn === 'en', 'FR-019 language persistence in EN', `Expected stored language "en", got "${storedLangEn}"`);
    }

    // ── FR-020: Sound Toggle Mute/Unmute, Visual State & Persistence ──
    {
      const soundBtn = '#btn-toggle-sound';
      await dPage.waitForSelector(soundBtn, { visible: true, timeout: 5000 });

      // 1. Click to mute sound
      await realClick(dPage, soundBtn);
      await dPage.waitForFunction(() => {
        const btn = document.querySelector('#btn-toggle-sound');
        return btn && btn.style.opacity === '0.35' && btn.getAttribute('title') === 'Sound Muted';
      }, { timeout: 5000 });

      const isMuted = await dPage.evaluate(() => window.__TRADING_APP__?.soundEngine?.muted);
      assert(isMuted === true, 'FR-020 soundEngine muted state', 'soundEngine.muted should be true after toggle');

      const storedMuted = await dPage.evaluate(() => localStorage.getItem('tradingchart_sound_muted'));
      assert(storedMuted === 'true', 'FR-020 sound muted persistence', `Expected 'true', got "${storedMuted}"`);

      // 2. Click to unmute sound
      await realClick(dPage, soundBtn);
      await dPage.waitForFunction(() => {
        const btn = document.querySelector('#btn-toggle-sound');
        return btn && btn.style.opacity === '1' && btn.getAttribute('title') === 'Sound Active';
      }, { timeout: 5000 });

      const isUnmuted = await dPage.evaluate(() => !window.__TRADING_APP__?.soundEngine?.muted);
      assert(isUnmuted === true, 'FR-020 soundEngine unmuted state', 'soundEngine.muted should be false after unmute');

      const storedUnmuted = await dPage.evaluate(() => localStorage.getItem('tradingchart_sound_muted'));
      assert(storedUnmuted === 'false', 'FR-020 sound unmuted persistence', `Expected 'false', got "${storedUnmuted}"`);
    }

    // ── FR-023: Corrupt Profile & Malformed Deep Links Resilience ──
    {
      // 1. Corrupt profile in localStorage fallback to defaults
      await dPage.evaluate(() => {
        localStorage.setItem('tradingchart_user_profile', 'CORRUPT_PROFILE_MALFORMED_{{bad json');
      });
      await dPage.goto(`${BASE_URL}/chart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      const appBootWithCorruptProfile = await dPage.evaluate(() => {
        const app = window.__TRADING_APP__;
        return {
          hasApp: !!app,
          symbol: app?.currentSymbol,
          tf: app?.currentTimeframe
        };
      });
      assert(appBootWithCorruptProfile.hasApp, 'FR-023 app boot with corrupt profile', 'App must boot even with corrupt user profile');
      assert(appBootWithCorruptProfile.symbol === 'BTCUSDT', 'FR-023 fallback default symbol', `Expected BTCUSDT, got ${appBootWithCorruptProfile.symbol}`);
      assert(appBootWithCorruptProfile.tf === '60', 'FR-023 fallback default timeframe', `Expected 60, got ${appBootWithCorruptProfile.tf}`);

      // Clean up corrupt profile
      await dPage.evaluate(() => localStorage.removeItem('tradingchart_user_profile'));

      // 2. Malformed deep-link query parameters
      await dPage.goto(`${BASE_URL}/chart?symbol=MALFORMED!!$$@@&interval=999999999xyz`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      const appBootWithMalformedDeepLink = await dPage.evaluate(() => {
        const app = window.__TRADING_APP__;
        return {
          hasApp: !!app,
          symbol: app?.currentSymbol,
          tf: app?.currentTimeframe
        };
      });
      assert(appBootWithMalformedDeepLink.hasApp, 'FR-023 app boot with malformed deep link', 'App must boot with malformed query parameters');
      assert(appBootWithMalformedDeepLink.symbol === 'BTCUSDT', 'FR-023 sanitize symbol query param', `Expected fallback BTCUSDT, got ${appBootWithMalformedDeepLink.symbol}`);
    }
  } finally {
    await desktopCtx.browser.close();
  }

  // ── Mobile Suite: FR-024 Viewport <= 768px Off-Canvas Drawer & Reachable Shell Controls ──
  const mobileCtx = await launch('mobile');
  const { page: mPage } = mobileCtx;

  try {
    await boot(mobileCtx);

    // 1. Mobile layout verifies desktop side rail and bottom panel are hidden
    const desktopHidden = await mPage.evaluate(() => {
      const rail = document.querySelector('#desktop-side-rail');
      const btm = document.querySelector('#bottom-panel');
      const railHidden = !rail || window.getComputedStyle(rail).display === 'none';
      const btmHidden = !btm || window.getComputedStyle(btm).display === 'none';
      return { railHidden, btmHidden };
    });
    assert(desktopHidden.railHidden, 'FR-024 desktop rail hidden on mobile', 'Expected #desktop-side-rail to be hidden on mobile');
    assert(desktopHidden.btmHidden, 'FR-024 bottom panel hidden on mobile', 'Expected #bottom-panel to be hidden on mobile');

    // 2. Open side dock panel (e.g. Watchlist) as off-canvas drawer
    await mPage.evaluate(() => window.__TRADING_APP__.chartManager.togglePanel('watchlist', true));
    await mPage.waitForFunction(() => {
      const p = document.querySelector('.vela-panel-watchlist');
      return p && window.getComputedStyle(p).display !== 'none';
    }, { timeout: 6000 });

    const drawerMetrics = await mPage.evaluate(() => {
      const p = document.querySelector('.vela-panel-watchlist');
      const s = window.getComputedStyle(p);
      const r = p.getBoundingClientRect();
      const closeBtn = p.querySelector('.vela-panel-close');
      const cRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

      return {
        position: s.position,
        width: Math.round(r.width),
        top: Math.round(r.top),
        zIndex: parseInt(s.zIndex, 10),
        hasCloseBtn: !!closeBtn,
        closeWidth: cRect ? Math.round(cRect.width) : 0,
        closeHeight: cRect ? Math.round(cRect.height) : 0
      };
    });

    assert(drawerMetrics.position === 'fixed', 'FR-024 off-canvas drawer fixed position', `Expected fixed, got ${drawerMetrics.position}`);
    assert(drawerMetrics.width >= 380, 'FR-024 off-canvas drawer full viewport width', `Expected width >= 380, got ${drawerMetrics.width}`);
    assert(drawerMetrics.top <= 55, 'FR-024 off-canvas drawer anchored below header', `Expected top <= 55, got ${drawerMetrics.top}`);
    assert(drawerMetrics.zIndex >= 100, 'FR-024 off-canvas drawer elevated z-index', `Expected zIndex >= 100, got ${drawerMetrics.zIndex}`);
    assert(drawerMetrics.hasCloseBtn, 'FR-024 drawer contains close control', 'Missing .vela-panel-close in panel drawer');
    assert(drawerMetrics.closeWidth >= 40 && drawerMetrics.closeHeight >= 40, 'FR-024 drawer close button touch target', `Expected >= 40x40, got ${drawerMetrics.closeWidth}x${drawerMetrics.closeHeight}`);

    // 3. Close the drawer via .vela-panel-close
    await realClick(mPage, '.vela-panel-watchlist .vela-panel-close');
    await mPage.waitForFunction(() => {
      const p = document.querySelector('.vela-panel-watchlist');
      return !p || window.getComputedStyle(p).display === 'none';
    }, { timeout: 5000 });

    const drawerClosed = await mPage.evaluate(() => {
      const p = document.querySelector('.vela-panel-watchlist');
      return !p || window.getComputedStyle(p).display === 'none';
    });
    assert(drawerClosed, 'FR-024 drawer close control dismisses panel', 'Panel should be hidden after clicking close');

    // 4. Reachability of shell controls on mobile
    const controlsReachable = await mPage.evaluate(() => {
      const isVisible = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      return {
        langToggle: isVisible('#btn-toggle-lang'),
        panelsBtn: isVisible('#nav-btn-panels'),
        scaleAuto: isVisible('#btn-scale-auto'),
        scaleLog: isVisible('#btn-scale-log'),
        mobileMore: isVisible('.vela-mb-more'),
        mobileTf: isVisible('.vela-mb-tf')
      };
    });

    assert(controlsReachable.langToggle, 'FR-024 #btn-toggle-lang reachable on mobile', 'Language toggle not reachable');
    assert(controlsReachable.panelsBtn, 'FR-024 #nav-btn-panels reachable on mobile', 'Panels button not reachable');
    assert(controlsReachable.scaleAuto, 'FR-024 #btn-scale-auto reachable on mobile', 'Scale auto button not reachable');
    assert(controlsReachable.scaleLog, 'FR-024 #btn-scale-log reachable on mobile', 'Scale log button not reachable');
    assert(controlsReachable.mobileMore, 'FR-024 .vela-mb-more reachable on mobile', 'Mobile more drawer button not reachable');
    assert(controlsReachable.mobileTf, 'FR-024 .vela-mb-tf reachable on mobile', 'Mobile timeframe button not reachable');

    console.log('PASS: 001 [Shell Toggles & Resilience]');
  } finally {
    await mobileCtx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error in 04_shell_toggles_and_resilience: ${err.message}`);
  process.exit(1);
});
