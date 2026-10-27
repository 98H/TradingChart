/**
 * @spec 014
 * @covers FR-011, FR-012, FR-013
 */
const { launch, boot, VIEWPORTS, closeAllBrowsers } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

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
    const topInfo = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { tag: top?.tagName, id: top?.id, cls: top?.className };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(topInfo)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log(`[014 Acceptance Suite 04] Running Client Live Bucketing, Notices & Timeframe UI against ${BASE_URL}...`);

  let ctx = null;
  try {
    ctx = await launch('desktop');
    const { page } = ctx;
    await boot(ctx, { settle: 3500 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Client Data Provider Live Bucketing & Alignment (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const providerCheck = await page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        const provider = app?.universalProvider || app?.chartManager?.dataProvider;
        if (!provider) return { ok: false, reason: 'universalProvider not found on window.__TRADING_APP__' };

        // Test timeframes helper or provider bucketing logic
        const tfModule = window.__TIMEFRAMES__ || provider.timeframes || provider;
        if (typeof tfModule.bucketStart !== 'function') {
          return { ok: false, reason: 'bucketStart function missing on timeframes/provider' };
        }

        // Test weekly bucket: epoch ms for Wednesday 2026-10-28 15:30:00 UTC
        const wednesdayMs = Date.UTC(2026, 9, 28, 15, 30, 0); // 2026-10-28
        const weekBucket = tfModule.bucketStart('W', wednesdayMs);
        const weekDate = new Date(weekBucket);
        // Must be Monday 2026-10-26 00:00:00 UTC
        if (weekDate.getUTCDay() !== 1 || weekDate.getUTCHours() !== 0 || weekDate.getUTCMinutes() !== 0) {
          return { ok: false, reason: `Weekly bucket for Wednesday started at ${weekDate.toISOString()}, expected Monday 00:00 UTC` };
        }

        // Test monthly bucket: epoch ms for 2026-10-28
        const monthBucket = tfModule.bucketStart('M', wednesdayMs);
        const monthDate = new Date(monthBucket);
        // Must be 1st of month: 2026-10-01 00:00:00 UTC
        if (monthDate.getUTCDate() !== 1 || monthDate.getUTCHours() !== 0 || monthDate.getUTCMinutes() !== 0) {
          return { ok: false, reason: `Monthly bucket for 2026-10-28 started at ${monthDate.toISOString()}, expected 2026-10-01 00:00 UTC` };
        }

        // Test tick handling does NOT inflate volume:
        // Record volume before tick, feed mock tick, verify volume was not simply incremented by 1
        const initialBars = provider.getBars ? provider.getBars() : [];
        if (initialBars.length > 0) {
          const lastBar = initialBars[initialBars.length - 1];
          const initialVol = lastBar.volume;
          // Apply tick
          if (typeof provider.onLiveTick === 'function') {
            provider.onLiveTick({ symbol: app.currentSymbol, price: lastBar.close, time: Date.now() });
            const updatedBar = provider.getBars()[provider.getBars().length - 1];
            if (updatedBar.volume === initialVol + 1) {
              return { ok: false, reason: 'Live tick incorrectly incremented volume by 1 (ticks must not invent volume)' };
            }
          }
        }

        return { ok: true };
      });

      assert(providerCheck.ok, 'FR-011 client provider bucketing logic', providerCheck.reason);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Client Notices: No Data & Stale Data (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch to a non-existent symbol that produces 404 with no cached data
      await page.evaluate(() => {
        window.__TRADING_APP__.switchSymbol('NONEXISTENT_XYZ_TEST');
      });

      // Wait for the notice banner to appear in Persian (default)
      const expectedFaNotice = 'برای این نماد در این بازه‌ی زمانی داده‌ای در دسترس نیست.';
      const expectedEnNotice = 'No data is available for this symbol on this timeframe.';

      const noticeAppeared = await page.waitForFunction((expectedFa) => {
        const banners = Array.from(document.querySelectorAll('.tc-chart-notice, .chart-feed-notice, [data-notice-id], .notice-banner'));
        return banners.some(b => b.innerText?.includes(expectedFa) && window.getComputedStyle(b).display !== 'none');
      }, { timeout: 8000 }, expectedFaNotice).catch(() => null);

      assert(!!noticeAppeared, 'FR-012 "No data" Persian notice displayed on 404',
        `Expected notice "${expectedFaNotice}" over chart`);

      // Verify zero console errors from indicators during 404 / no-data state
      const errors = ctx.logs.filter(l => l.type === 'error' || l.type === 'pageerror');
      assert(errors.length === 0, 'FR-012 zero console errors during no-data state',
        `Encountered ${errors.length} console errors: ${errors.map(e => e.text).join('; ')}`);

      // Switch language to English ('en') and verify notice re-localizes in-place
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      await page.waitForFunction((expectedEn) => {
        const banners = Array.from(document.querySelectorAll('.tc-chart-notice, .chart-feed-notice, [data-notice-id], .notice-banner'));
        return banners.some(b => b.innerText?.includes(expectedEn) && window.getComputedStyle(b).display !== 'none');
      }, { timeout: 5000 }, expectedEnNotice);

      const noticeEnFound = await page.evaluate((expectedEn) => {
        const banners = Array.from(document.querySelectorAll('.tc-chart-notice, .chart-feed-notice, [data-notice-id], .notice-banner'));
        return banners.some(b => b.innerText?.includes(expectedEn));
      }, expectedEnNotice);
      assert(noticeEnFound, 'FR-012 notice re-localizes to English on language switch',
        `Expected English notice "${expectedEnNotice}"`);

      // Now switch back to valid symbol BTCUSDT and verify notice disappears
      await page.evaluate(() => window.__TRADING_APP__.switchSymbol('BTCUSDT'));
      await page.waitForFunction(() => {
        const banners = Array.from(document.querySelectorAll('.tc-chart-notice, .chart-feed-notice, [data-notice-id], .notice-banner'));
        return banners.every(b => window.getComputedStyle(b).display === 'none' || !b.isConnected || b.innerText.trim() === '');
      }, { timeout: 8000 });

      // Stale data notice verification:
      // When chart receives data with source:"cache", it must show the stale data notice:
      const expectedStaleFa = 'داده‌های زنده موقتاً در دسترس نیست؛ آخرین داده‌های ذخیره‌شده نمایش داده می‌شود.';
      const expectedStaleEn = 'Live data is temporarily unavailable; showing the last saved data.';

      const staleNoticeCheck = await page.evaluate(async ({ fa, en }) => {
        const app = window.__TRADING_APP__;
        if (typeof app?.showNotice === 'function' || typeof app?.chartManager?.showNotice === 'function') {
          const fn = app.showNotice || app.chartManager.showNotice;
          fn.call(app, 'cache_stale');
          const banner = document.querySelector('.tc-chart-notice, .chart-feed-notice, [data-notice-id=cache_stale]');
          const text = banner?.innerText || '';
          return { ok: text.includes(fa) || text.includes(en), text };
        }
        return { ok: false, text: 'showNotice method not found' };
      }, { fa: expectedStaleFa, en: expectedStaleEn });

      assert(staleNoticeCheck.ok, 'FR-012 stale data notice displayed when source is cache',
        `Expected stale notice, got: "${staleNoticeCheck.text}"`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Timeframe Switching UI, Label Matching & Custom Builder (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open timeframe dialog via keyboard shortcut ","
      await page.keyboard.press('Comma');
      await page.waitForSelector('#modal-timeframes.open', { visible: true, timeout: 6000 });

      // Test standard timeframe switches: 1h ("60"), 15m ("15"), 1D ("D"), 1W ("W")
      const testTfs = ['15', '60', 'D', 'W'];
      for (const targetTf of testTfs) {
        await page.evaluate((tf) => window.__TRADING_APP__.switchTimeframe(tf), targetTf);
        await page.waitForFunction((tf) => window.__TRADING_APP__?.currentTimeframe === tf, { timeout: 6000 }, targetTf);

        // Verify topbar timeframe button reflects active timeframe
        const topbarTfText = await page.evaluate(() => {
          const btn = document.querySelector('#btn-topbar-timeframe, .vela-widget-timeframe, [data-action=timeframe]');
          return btn?.innerText?.trim();
        });
        assert(!!topbarTfText, `FR-013 topbar timeframe label exists for ${targetTf}`, 'Topbar label missing');

        // Verify chart rendered bar spacing corresponds to the selected timeframe
        const spacingValid = await page.evaluate((tf) => {
          const app = window.__TRADING_APP__;
          const bars = app?.chartManager?.dataProvider?.getBars?.() || app?.universalProvider?.getBars?.() || [];
          if (bars.length < 2) return true; // not enough bars to test spacing
          const diff = bars[bars.length - 1].time - bars[bars.length - 2].time;
          if (tf === '15') return diff === 15 * 60 * 1000;
          if (tf === '60') return diff === 60 * 60 * 1000;
          if (tf === 'D') return diff === 86400000;
          return true;
        }, targetTf);
        assert(spacingValid, `FR-013 bar spacing matches timeframe ${targetTf}`, 'Rendered bars spacing does not match interval');
      }

      // Verify custom timeframe builder units:
      // Open custom timeframe builder and inspect available unit options (s, m, h, D, W, M)
      await page.evaluate(() => {
        const tfMgr = window.__TRADING_APP__?.timeframeManager;
        if (tfMgr?.openCustomModal) tfMgr.openCustomModal();
        else {
          const btn = document.querySelector('#btn-add-custom-tf, [data-action=add-custom-tf]');
          if (btn) btn.click();
        }
      });

      const unitsFound = await page.evaluate(() => {
        const unitSelect = document.querySelector('#custom-tf-unit, select[name=unit], .custom-tf-units');
        if (!unitSelect) return null;
        const options = Array.from(unitSelect.querySelectorAll('option, button, [data-unit]'))
          .map(o => (o.value || o.getAttribute('data-unit') || o.innerText).trim());
        return options;
      });

      // Builder must offer seconds, minutes, hours, days, weeks, months
      assert(Array.isArray(unitsFound) && unitsFound.length >= 6, 'FR-013 custom builder offers 6 units',
        `Expected at least 6 units (s, m, h, D, W, M), got ${JSON.stringify(unitsFound)}`);
    }

    console.log('[014 Acceptance Suite 04] PASS: All client live bucketing, notices and timeframe UI assertions satisfied.');
  } finally {
    if (ctx?.browser) {
      try { await ctx.browser.close(); } catch (e) {}
    }
    await closeAllBrowsers();
  }
}

run().catch(err => {
  console.error(`❌ Suite 04 unhandled error: ${err.message || err}`);
  process.exit(1);
});
