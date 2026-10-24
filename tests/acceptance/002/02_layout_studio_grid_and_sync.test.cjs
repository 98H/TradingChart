/**
 * @spec 002
 * @covers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-023
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
  console.log(`  ✓ ${scenario}`);
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
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('Testing Spec 002: Layout Studio, Grids & Sync (FR-001..006, FR-023)...');

  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // Set entitled plan by default so presets can be applied
    await page.evaluate(() => {
      const auth = window.__TRADING_APP__.auth;
      auth.user = { plan: 'ultimate' };
      auth.entitlements = auth.plansMeta?.ultimate || { chartsPerTab: 16 };
    });

    // ── FR-002: Trigger Layout Studio from multiple surface points ──────────
    {
      // 1. Desktop topbar trigger
      await realClick(page, '#btn-layout-manager');
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      assert(await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open')),
        'FR-002 desktop topbar opens layout studio', 'Expected #modal-layout-studio.open');

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-layout-studio')?.classList.contains('open'));

      // 2. Panels drawer menu item trigger
      await realClick(page, '#nav-btn-panels');
      await page.waitForFunction(() => document.querySelector('#modal-panels-menu')?.classList.contains('open'));
      await realClick(page, '.panel-menu-item[data-panel="layouts"]');
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      assert(await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open')),
        'FR-002 panels drawer item opens layout studio', 'Expected studio open from panel item');

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      await page.evaluate(() => document.querySelector('#modal-panels-menu')?.classList.remove('open'));

      // 3. Vela topbar layout trigger
      await realClick(page, '#vela-topbar-layout, .vela-widget-topbar button[aria-label*="Layout"], [aria-label*="layout" i]');
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      assert(await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open')),
        'FR-002 vela widget opens layout studio', 'Expected studio open from vela widget');
    }

    // ── FR-001: Exactly 8 Grid Presets with bilingual metadata ──────────────
    {
      const presetsData = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.layout-preset-card'));
        return cards.map(c => ({
          layoutId: c.getAttribute('data-layout'),
          text: c.innerText.trim(),
          hasMatrix: !!c.querySelector('div'),
          isActive: c.classList.contains('active')
        }));
      });

      assert(presetsData.length === 8, 'FR-001 exactly 8 preset cards rendered', `Expected 8 preset cards, got ${presetsData.length}`);
      const expectedIds = ['1', '2h', '2v', '4', 'g1x3', 'g3x1', 'g2x3', '8'];
      for (const id of expectedIds) {
        assert(presetsData.some(p => p.layoutId === id), `FR-001 preset card ${id} present`, `Missing preset ${id}`);
      }
      assert(presetsData.every(p => p.text.length > 5), 'FR-001 all presets have titles & descriptions', 'Missing text on preset card');
      assert(presetsData.some(p => p.isActive), 'FR-001 active preset is highlighted', 'No active preset highlighted');
    }

    // ── FR-005: 6-Axis Synchronization Switches ─────────────────────────────
    {
      const syncStates = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        const switches = Array.from(document.querySelectorAll('.sync-switch-btn'));
        return {
          switchCount: switches.length,
          keys: switches.map(s => s.getAttribute('data-sync')),
          opts: { ...lm.syncOpts }
        };
      });

      assert(syncStates.switchCount === 6, 'FR-005 six sync switches present', `Expected 6 switches, got ${syncStates.switchCount}`);
      const expectedKeys = ['symbol', 'timeframe', 'crosshair', 'viewport', 'drawings', 'style'];
      for (const k of expectedKeys) {
        assert(syncStates.keys.includes(k), `FR-005 sync switch for ${k} exists`, `Missing sync switch ${k}`);
      }

      // Default state: crosshair & viewport (time & zoom) ON, others OFF
      assert(syncStates.opts.crosshair === true, 'FR-005 default crosshair sync ON', 'crosshair should be true');
      assert(syncStates.opts.viewport === true, 'FR-005 default viewport/time sync ON', 'viewport should be true');
      assert(syncStates.opts.symbol === false, 'FR-005 default symbol sync OFF', 'symbol should be false');
      assert(syncStates.opts.timeframe === false, 'FR-005 default timeframe sync OFF', 'timeframe should be false');
      assert(syncStates.opts.drawings === false, 'FR-005 default drawings sync OFF', 'drawings should be false');
      assert(syncStates.opts.style === false, 'FR-005 default style sync OFF', 'style should be false');

      // Clicking a sync switch toggles state in place without closing modal
      await realClick(page, '.sync-switch-btn[data-sync="symbol"]');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.syncOpts.symbol === true);
      const isModalStillOpen = await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      assert(isModalStillOpen, 'FR-005 toggle sync keeps modal open', 'Studio closed on sync toggle');
      assert(await page.evaluate(() => window.__TRADING_APP__.layoutManager.syncOpts.symbol === true),
        'FR-005 symbol sync toggled ON', 'Expected symbol sync to be true');

      // Revert symbol sync to false
      await realClick(page, '.sync-switch-btn[data-sync="symbol"]');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.syncOpts.symbol === false);
    }

    // ── FR-003: Apply 2x2 Grid, Verify Diversification & Seeding ────────────
    {
      const initialSymbol = await page.evaluate(() => {
        const auth = window.__TRADING_APP__.auth;
        auth.user = { plan: 'ultimate' };
        auth.entitlements = auth.plansMeta?.ultimate || { chartsPerTab: 16 };
        return window.__TRADING_APP__.currentSymbol;
      });

      // Click 2x2 preset card
      await realClick(page, '.layout-preset-card[data-layout="4"]');
      await page.waitForFunction(() => !document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) >= 4);

      const quadInfo = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager.workspace;
        const cells = Array.from(ws?.cellsById?.values() || []);
        const symbols = cells.map(c => (c.symbol || '').replace(/^.*:/, ''));
        const activeLabel = document.querySelector('#active-layout-name')?.innerText?.trim();
        const qtPill = document.querySelector('#quick-trade-widget, .quick-trade-pill, [data-widget="quick-trade"]');
        const qtMinimized = !qtPill || getComputedStyle(qtPill).display === 'none' || qtPill.classList.contains('minimized');
        return { cellCount: cells.length, symbols, activeLabel, qtMinimized };
      });

      assert(quadInfo.cellCount >= 4, 'FR-003 2x2 grid creates 4 cells', `Expected >= 4 cells, got ${quadInfo.cellCount}`);
      assert(quadInfo.symbols[0].includes(initialSymbol.replace(/^.*:/, '')), 'FR-003 cell 1 preserves symbol', `Expected cell 1 to preserve ${initialSymbol}`);
      assert(quadInfo.symbols[1].includes('ETHUSDT'), 'FR-003 cell 2 seeded with ETHUSDT', `Cell 2 symbol was ${quadInfo.symbols[1]}`);
      assert(quadInfo.symbols[2].includes('SOLUSDT'), 'FR-003 cell 3 seeded with SOLUSDT', `Cell 3 symbol was ${quadInfo.symbols[2]}`);
      assert(quadInfo.symbols[3].includes('BNBUSDT'), 'FR-003 cell 4 seeded with BNBUSDT', `Cell 4 symbol was ${quadInfo.symbols[3]}`);
      assert(quadInfo.qtMinimized, 'FR-003 quick trade minimized in multi-cell mode', 'Quick trade should be minimized');

      // Return to 1x1 preset
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.setLayout('1', '1x1 Single Chart'));
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) <= 1);
      const singleCells = await page.evaluate(() => window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0);
      assert(singleCells <= 1, 'FR-003 return to 1x1 leaves 1 cell', `Expected 1 cell, got ${singleCells}`);
    }

    // ── FR-004: Plan Entitlement Locking & Upgrade Routing ──────────────────
    {
      // Open studio, simulate Basic plan where chartsPerTab = 1
      await page.evaluate(() => {
        const auth = window.__TRADING_APP__.auth;
        auth.user = { plan: 'basic' };
        auth.entitlements = auth.plansMeta?.basic || { chartsPerTab: 1 };
        window.__TRADING_APP__.layoutManager.openLayoutStudio();
      });
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));

      const lockedCards = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.layout-preset-card'));
        return cards.filter(c => c.getAttribute('data-locked') === '1');
      });
      assert(lockedCards.length >= 7, 'FR-004 presets with >1 cell locked on Basic plan', `Expected >= 7 locked cards, got ${lockedCards.length}`);

      // Clicking a locked preset must trigger plan modal and not switch layout
      await realClick(page, '.layout-preset-card[data-layout="4"]');
      await page.waitForFunction(() => document.querySelector('#tc-plans-modal')?.classList.contains('open'));
      assert(await page.evaluate(() => document.querySelector('#tc-plans-modal')?.classList.contains('open')),
        'FR-004 locked preset routes to plans modal', 'Expected #tc-plans-modal to open');

      // Layout should remain 1x1
      const activeLayout = await page.evaluate(() => window.__TRADING_APP__.layoutManager.activeLayoutId);
      assert(activeLayout === '1', 'FR-004 layout unchanged on locked preset click', `Expected layout 1, got ${activeLayout}`);

      // Close plans modal and studio
      await page.evaluate(() => {
        document.querySelector('#tc-plans-modal')?.classList.remove('open');
        document.querySelector('#modal-layout-studio')?.classList.remove('open');
        const auth = window.__TRADING_APP__.auth;
        auth.user = { plan: 'ultimate' };
        auth.entitlements = auth.plansMeta?.ultimate || { chartsPerTab: 16 };
      });
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal')?.classList.contains('open'));
    }

    // ── FR-006: Synchronization Propagation Across Grid ─────────────────────
    {
      // Set 2x2 grid with unlimited plan
      await page.evaluate(() => {
        const auth = window.__TRADING_APP__.auth;
        auth.user = { plan: 'ultimate' };
        auth.entitlements = auth.plansMeta?.ultimate || { chartsPerTab: 16 };
        window.__TRADING_APP__.layoutManager.setLayout('4', 'Quad Grid');
      });
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) >= 4);

      // 1. Symbol Sync Propagation
      await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('symbol', true);
        window.__TRADING_APP__.chartManager.setSymbol('XAUUSD');
      });
      await page.waitForFunction(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const symbols = Array.from(ws?.cellsById?.values() || []).map(c => (c.symbol || '').replace(/^.*:/, ''));
        return symbols.length >= 4 && symbols.every(s => s === 'XAUUSD');
      }, { timeout: 10000 });

      const allSymbolsXau = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const symbols = Array.from(ws?.cellsById?.values() || []).map(c => (c.symbol || '').replace(/^.*:/, ''));
        return symbols.every(s => s === 'XAUUSD');
      });
      assert(allSymbolsXau, 'FR-006 symbol sync propagates to all cells', 'Not all cells updated to XAUUSD');
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.toggleSync('symbol', false));

      // 2. Interval / Timeframe Sync Propagation
      await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('timeframe', true);
        window.__TRADING_APP__.chartManager.setTimeframe('15');
      });
      await page.waitForFunction(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const tfs = Array.from(ws?.cellsById?.values() || []).map(c => c.timeframe || c.chart?.orchestrator?.timeframe);
        return tfs.length >= 4 && tfs.every(t => t === '15' || t === 15);
      }, { timeout: 10000 });

      const allTfs15 = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const tfs = Array.from(ws?.cellsById?.values() || []).map(c => c.timeframe || c.chart?.orchestrator?.timeframe);
        return tfs.every(t => t === '15' || t === 15);
      });
      assert(allTfs15, 'FR-006 interval sync propagates to all cells', 'Not all cells updated to timeframe 15');
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.toggleSync('timeframe', false));

      // 3. Style Sync Propagation
      await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('style', true);
        window.__TRADING_APP__.chartManager.setPriceStyle('area');
      });
      await page.waitForFunction(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const styles = Array.from(ws?.cellsById?.values() || []).map(c => c.priceStyle || c.chart?.orchestrator?.priceStyle);
        return styles.length >= 4 && styles.every(s => s === 'area');
      }, { timeout: 10000 });

      const allStylesArea = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager?.workspace;
        const styles = Array.from(ws?.cellsById?.values() || []).map(c => c.priceStyle || c.chart?.orchestrator?.priceStyle);
        return styles.every(s => s === 'area');
      });
      assert(allStylesArea, 'FR-006 style sync propagates to all cells', 'Not all cells updated to price style area');
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.toggleSync('style', false));
    }

    // ── FR-023: Bilingual Parity & Re-localization ──────────────────────────
    {
      await page.evaluate(() => {
        window.__TRADING_APP__.switchLanguage('fa');
        window.__TRADING_APP__.layoutManager.openLayoutStudio();
      });
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));

      const faStrings = await page.evaluate(() => {
        const modal = document.querySelector('#modal-layout-studio');
        const text = modal?.innerText || '';
        const title = modal?.querySelector('h3, .studio-title, .modal-title')?.innerText || '';
        const strip = document.querySelector('#multi-chart-cell-strip')?.innerText || '';
        return {
          hasPersianTitle: title.includes('طرح') || text.includes('طرح') || text.includes('چارت'),
          hasPersianSync: text.includes('همگام‌سازی') || text.includes('نماد') || text.includes('تایم‌فریم'),
          hasPersianStrip: strip.includes('گرید') || strip.includes('چارت') || strip.includes('بزرگ') || strip.includes('تمام‌صفحه')
        };
      });

      assert(faStrings.hasPersianTitle, 'FR-023 layout studio Persian title', 'Expected Persian title in studio modal');
      assert(faStrings.hasPersianSync, 'FR-023 layout studio Persian sync labels', 'Expected Persian sync section');

      // Switch back to English
      await page.evaluate(() => {
        window.__TRADING_APP__.switchLanguage('en');
        document.querySelector('#modal-layout-studio')?.classList.remove('open');
      });
      await page.waitForFunction(() => !document.querySelector('#modal-layout-studio')?.classList.contains('open'));
    }

    // ── FR-002 (Mobile Header Trigger): Switch viewport to mobile ────────────
    {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.waitForSelector('#btn-mobile-layout', { visible: true, timeout: 5000 });
      await realClick(page, '#btn-mobile-layout');
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
      assert(await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open')),
        'FR-002 mobile header trigger opens studio', 'Expected studio open from #btn-mobile-layout');

      // Cleanup: close modal and reset to 1x1
      await page.evaluate(() => {
        document.querySelector('#modal-layout-studio')?.classList.remove('open');
        window.__TRADING_APP__.layoutManager.setLayout('1', '1x1');
      });
    }

    console.log('✔ Spec 002 Layout Studio, Grids & Sync Acceptance Tests Passed.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error('❌ Layout Studio, Grids & Sync fatal error:', err.message);
  process.exit(1);
});
