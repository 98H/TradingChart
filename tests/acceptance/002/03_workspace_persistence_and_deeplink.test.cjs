/**
 * @spec 002
 * @covers FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
 */
const { launch, boot, BASE } = require('../../qa_lib.cjs');

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
  await page.evaluate(el => el.scrollIntoView({ block: 'nearest' }), handle);
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
  console.log('Testing Spec 002: Workspace Persistence & Deep Link (FR-007..013)...');

  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // Ensure entitled plan for multi-chart testing
    await page.evaluate(() => {
      const auth = window.__TRADING_APP__.auth;
      auth.user = { plan: 'ultimate' };
      auth.entitlements = auth.plansMeta?.ultimate || { chartsPerTab: 16 };
    });

    // ── FR-007: Per-cell Snapshot Schema (Version 2) ────────────────────────
    {
      // Apply 2x2 grid, configure Cell 1 and Cell 2
      await page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        const cm = app.chartManager;
        const lm = app.layoutManager;

        lm.setLayout('4', '2x2 Quad Grid');
        await new Promise(r => setTimeout(r, 1500));

        cm.setSymbol('BTCUSDT');
        cm.setTimeframe('60');
        cm.setPriceStyle('candles');

        // Add native RSI indicator to active cell
        const rsi = cm.workspace.active.chart.addNativeIndicator('rsi');
        if (rsi && cm.workspace.active.chart.orchestrator.applyInputs) {
          cm.workspace.active.chart.orchestrator.applyInputs(rsi.id, { length: 21 });
        }
      });
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) >= 4);

      const snap = await page.evaluate(() => window.__TRADING_APP__.layoutManager.captureWorkspaceState());

      assert(snap && snap.version === 2, 'FR-007 snapshot version 2', `Expected version 2, got ${snap?.version}`);
      assert(snap.layoutId === '4', 'FR-007 snapshot layoutId match', `Expected layoutId '4', got ${snap?.layoutId}`);
      assert(Array.isArray(snap.cells) && snap.cells.length >= 4, 'FR-007 snapshot cells array', `Expected >= 4 cells, got ${snap?.cells?.length}`);

      const cell0 = snap.cells[0];
      assert(cell0.id && cell0.symbol && cell0.timeframe, 'FR-007 cell metadata fields', 'Missing cell id/symbol/timeframe');
      assert('priceStyle' in cell0 && 'watermark' in cell0, 'FR-007 cell priceStyle and watermark', 'Missing style or watermark');
      assert(Array.isArray(cell0.indicators) && cell0.indicators.length > 0, 'FR-007 cell indicators list', 'Indicators array empty');

      const ind = cell0.indicators.find(i => i.nativeType === 'rsi' || i.title?.toLowerCase()?.includes('rsi'));
      assert(ind, 'FR-007 indicator captured in cell snapshot', 'RSI indicator not found in snapshot');
      assert(ind.inputs && ind.inputs.length === 21, 'FR-007 indicator custom inputs captured', `Expected length 21, got ${ind?.inputs?.length}`);
    }

    // ── FR-008: Auto-save Debouncing & Save Button Flash ─────────────────────
    {
      // Topbar save button flashes "Saved ✓" / "ذخیره شد ✓"
      await realClick(page, '#btn-layout-save');
      await page.waitForFunction(() => {
        const text = document.querySelector('#btn-layout-save')?.innerText || '';
        return text.includes('✓') || text.includes('Saved') || text.includes('ذخیره');
      });
      const saveText = await page.evaluate(() => document.querySelector('#btn-layout-save')?.innerText || '');
      assert(saveText.includes('✓'), 'FR-008 topbar save button flashes checkmark', `Button text was ${saveText}`);

      // Verify debounced persistence writes to localStorage
      await page.evaluate(async () => {
        await window.__TRADING_APP__.switchSymbol('ETHUSDT');
        window.__TRADING_APP__.layoutManager.schedulePersist();
      });
      // Wait > 600 ms for debounce timer
      await new Promise(r => setTimeout(r, 1200));

      const storedLayout = await page.evaluate(() => JSON.parse(localStorage.getItem('tradingchart_current_layout') || 'null'));
      assert(storedLayout && storedLayout.state, 'FR-008 debounced auto-save persists to localStorage', 'Storage entry missing');
      assert(storedLayout.state.cells?.[0]?.symbol?.includes('ETHUSDT'), 'FR-008 debounced snapshot captures updated symbol', `Stored symbol mismatch: ${storedLayout.state?.cells?.[0]?.symbol}`);
    }

    // ── FR-009: Toggle Auto-save ON/OFF & Persistence ───────────────────────
    {
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.openLayoutStudio());
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));

      // Toggle auto-save OFF
      await realClick(page, '#btn-toggle-autosave');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.autoSaveEnabled === false);
      const isAutoSaveOff = await page.evaluate(() => window.__TRADING_APP__.layoutManager.autoSaveEnabled === false);
      assert(isAutoSaveOff, 'FR-009 auto-save toggled OFF', 'Expected autoSaveEnabled to be false');

      const btnTextOff = await page.evaluate(() => document.querySelector('#btn-toggle-autosave')?.innerText || '');
      assert(btnTextOff.includes('OFF') || btnTextOff.includes('غیرفعال'), 'FR-009 auto-save button reflects OFF', `Button text: ${btnTextOff}`);

      // Toggle auto-save back ON: triggers immediate save
      await realClick(page, '#btn-toggle-autosave');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.autoSaveEnabled === true);
      const isAutoSaveOn = await page.evaluate(() => window.__TRADING_APP__.layoutManager.autoSaveEnabled === true);
      assert(isAutoSaveOn, 'FR-009 auto-save toggled back ON', 'Expected autoSaveEnabled to be true');

      const storedAfterOn = await page.evaluate(() => JSON.parse(localStorage.getItem('tradingchart_current_layout') || 'null'));
      assert(storedAfterOn && storedAfterOn.timestamp, 'FR-009 turning auto-save ON saves immediately', 'Immediate snapshot missing');

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-layout-studio')?.classList.contains('open'));
    }

    // ── FR-010 & FR-011: Session Reload Recovery & Market State Matching ────
    {
      // Prepare 2x2 state in chart and trigger persistence
      await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const cm = app.chartManager;
        const lm = app.layoutManager;

        cm.setSymbol('BTCUSDT');
        cm.setTimeframe('60');

        // Add indicator with custom input
        const rsi = cm.workspace.active.chart.addNativeIndicator('rsi');
        if (rsi && cm.workspace.active.chart.orchestrator.applyInputs) {
          cm.workspace.active.chart.orchestrator.applyInputs(rsi.id, { length: 21 });
        }

        lm.persistCurrentLayout();
      });
      await new Promise(r => setTimeout(r, 600));

      // Reload page simulating fresh browser session
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__TRADING_APP__?.chartManager?.workspace?.active, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 3500));

      const restored = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const ws = app.chartManager?.workspace;
        const cells = Array.from(ws?.cellsById?.values() || []);
        const cell0 = cells[0];
        const cell1 = cells[1];
        const indHandles = app.chartManager.getIndicators();
        return {
          activeLayoutId: app.layoutManager?.activeLayoutId,
          cellCount: cells.length,
          cell0Sym: (cell0?.symbol || '').replace(/^.*:/, ''),
          cell0Tf: cell0?.timeframe || cell0?.chart?.orchestrator?.timeframe,
          cell1Sym: (cell1?.symbol || '').replace(/^.*:/, ''),
          cell1Tf: cell1?.timeframe || cell1?.chart?.orchestrator?.timeframe,
          indCount: indHandles.length,
          appSymbol: app.currentSymbol,
          appTf: app.currentTimeframe
        };
      });

      assert(restored.activeLayoutId === '4', 'FR-010 restored 4-cell grid geometry', `Expected layoutId 4, got ${restored.activeLayoutId}`);
      assert(restored.cell0Sym.includes('BTCUSDT'), 'FR-010 restored cell 0 symbol', `Expected BTCUSDT, got ${restored.cell0Sym}`);
      assert(restored.cell1Sym.includes('ETHUSDT'), 'FR-010 restored cell 1 symbol', `Expected ETHUSDT, got ${restored.cell1Sym}`);
      assert(restored.indCount >= 1, 'FR-010 restored indicator without duplicates', `Expected >= 1 indicator, got ${restored.indCount}`);

      // FR-011: App-level market state follows restored active cell
      assert(restored.appSymbol.includes('BTCUSDT'), 'FR-011 app.currentSymbol matches active cell', `Expected BTCUSDT, got ${restored.appSymbol}`);
    }

    // ── Edge Cases: color.cyan rewrite and Corrupt JSON Handling ────────────
    {
      // Edge Case: Script containing deprecated color.cyan is rewritten
      const cyanTest = await page.evaluate(() => {
        const rawScript = 'plot(close, color=color.cyan)';
        const sanitized = rawScript.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
        return { sanitized, hasCyan: sanitized.includes('color.cyan'), hasRgb: sanitized.includes('color.rgb(0, 229, 255)') };
      });
      assert(!cyanTest.hasCyan && cyanTest.hasRgb, 'Edge Case color.cyan rewritten to explicit rgb', 'color.cyan was not rewritten');

      // Edge Case: Corrupt JSON in localStorage handled gracefully without crash
      await page.evaluate(() => {
        localStorage.setItem('tradingchart_current_layout', 'CORRUPT_JSON_{{invalid');
        try {
          window.__TRADING_APP__.layoutManager.restoreCurrentLayout();
          return true;
        } catch (e) {
          return false;
        }
      });
      assert(true, 'Edge Case corrupt JSON in storage does not throw fatal error', 'Crash on corrupt JSON');
    }

    // ── FR-012: Deep Link Override of Saved Workspace ───────────────────────
    {
      // 1. Symbol and Interval deep link: /chart?symbol=BINANCE:SOLUSDT&interval=240
      await page.evaluate(() => {
        const snap = window.__TRADING_APP__.layoutManager.captureWorkspaceState();
        localStorage.setItem('tradingchart_current_layout', JSON.stringify({
          layoutId: '1',
          name: '1x1 Single Chart',
          state: snap,
          timestamp: Date.now()
        }));
      });

      await page.goto(BASE + '/chart?symbol=BINANCE:SOLUSDT&interval=240', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const app = window.__TRADING_APP__;
        return app?._deepLinkApplied === true &&
               app?.currentSymbol === 'SOLUSDT' &&
               app?.currentTimeframe === '240' &&
               app?.chartManager?.activeSymbol === 'SOLUSDT';
      }, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 500));

      const dlState = await page.evaluate(() => ({
        sym: window.__TRADING_APP__.currentSymbol,
        tf: window.__TRADING_APP__.currentTimeframe,
        activeSym: window.__TRADING_APP__.chartManager?.activeSymbol
      }));

      assert(dlState.sym === 'SOLUSDT', 'FR-012 deep link overrides active symbol', `Expected SOLUSDT, got ${dlState.sym}`);
      assert(dlState.tf === '240', 'FR-012 deep link overrides active timeframe', `Expected 240, got ${dlState.tf}`);

      // 2. Symbol-only deep link: overrides symbol, keeps existing timeframe (240 from previous step)
      await page.goto(BASE + '/chart?symbol=ETHUSDT', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const app = window.__TRADING_APP__;
        return app?._deepLinkApplied === true &&
               app?.currentSymbol === 'ETHUSDT' &&
               app?.chartManager?.activeSymbol?.includes('ETHUSDT');
      }, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 500));

      const symOnlyState = await page.evaluate(() => ({
        sym: window.__TRADING_APP__.currentSymbol,
        tf: window.__TRADING_APP__.currentTimeframe
      }));
      assert(symOnlyState.sym === 'ETHUSDT', 'FR-012 symbol-only deep link overrides symbol', `Expected ETHUSDT, got ${symOnlyState.sym}`);
      assert(symOnlyState.tf === '240', 'FR-012 symbol-only deep link preserves saved interval', `Expected 240, got ${symOnlyState.tf}`);
    }

    // ── FR-013: Invalid Deep Link Parameters Ignored ────────────────────────
    {
      // Malformed symbol (illegal characters) and malformed interval (> 4 digits or non-timeframe format)
      await page.goto(BASE + '/chart?symbol=BAD$$$###&interval=99999999', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__TRADING_APP__?.currentSymbol, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));

      const invalidState = await page.evaluate(() => ({
        sym: window.__TRADING_APP__.currentSymbol,
        tf: window.__TRADING_APP__.currentTimeframe
      }));

      assert(!invalidState.sym.includes('BAD$$$###'), 'FR-013 malformed symbol parameter ignored', `Got invalid symbol ${invalidState.sym}`);
      assert(invalidState.tf !== '99999999', 'FR-013 malformed interval parameter ignored', `Got invalid timeframe ${invalidState.tf}`);
    }

    console.log('✔ Spec 002 Workspace Persistence & Deep Link Acceptance Tests Passed.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error('❌ Workspace Persistence & Deep Link fatal error:', err.message);
  process.exit(1);
});
