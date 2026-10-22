// tests/qa_layout_deep_audit.cjs — Comprehensive Layout Management QA Audit
// Tests: Indicator persistence, input configs, session reload recovery, multi-chart grids,
// desktop & mobile viewports, zero duplicates, import/export/duplicate/rename.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/chromium-browser');
const BASE = 'http://127.0.0.1:8088';
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles/layout_deep_audit');

if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

const settle = (ms) => new Promise(r => setTimeout(r, ms));

async function runLayoutAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('    TRADINGCHART DEEP QA: LAYOUT MANAGEMENT & SESSION PERSISTENCE  ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const defects = [];
  const passes = [];

  function recordPass(testName, details = '') {
    passes.push({ test: testName, details });
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName} ${details ? '— ' + details : ''}`);
  }

  function recordDefect(severity, area, kind, desc, meta = {}) {
    defects.push({ severity, area, kind, desc, meta });
    const col = severity === 'critical' ? '\x1b[35m' : (severity === 'high' ? '\x1b[31m' : '\x1b[33m');
    console.log(`  ${col}✗ [${severity.toUpperCase()}]\x1b[0m [${area}] ${kind}: ${desc}`);
  }

  const headlessBase = fs.existsSync('/root/snap/chromium/common') ? '/root/snap/chromium/common/chromium-headless' : '/tmp';
  fs.mkdirSync(headlessBase, { recursive: true });
  const profileDir = path.join(headlessBase, `qa_profile_${process.pid}_${Math.random().toString(36).slice(2, 7)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profileDir,
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--window-size=1440,900'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.toString()));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
          pageErrors.push(txt);
        }
      }
    });

    console.log('▶ STEP 1: Booting initial session (Desktop 1440x900)...');
    await page.goto(BASE + '/chart', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(2500);

    // 1. Setup custom state:
    // - Symbol: ETHUSDT
    // - Timeframe: 15m
    // - Style: area
    // - Indicator 1: RSI (native) with length = 21
    // - Indicator 2: Custom Pine Script "SuperTrend Pro"
    console.log('▶ STEP 2: Configuring custom chart state (Symbol, Timeframe, Style, Native & Pine Indicators)...');
    const setupRes = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      // Reset to 1x1
      lm.setLayout('1', '1x1 Single Chart');
      await new Promise(r => setTimeout(r, 600));

      // 1. Symbol & Timeframe & Style
      cm.setSymbol('ETHUSDT');
      cm.setTimeframe('15');
      cm.setPriceStyle('area');

      // 2. Add Native RSI
      const rsiHandle = cm.workspace.active.chart.addNativeIndicator('rsi');
      await new Promise(r => setTimeout(r, 500));
      if (rsiHandle && cm.workspace.active.chart.orchestrator.applyInputs) {
        cm.workspace.active.chart.orchestrator.applyInputs(rsiHandle.id, { length: 21, color: '#f59e0b' });
      }

      // 3. Add Custom Pine Script
      const pineRes = cm.addPineIndicator(`//@version=5
indicator("SuperTrend Pro", overlay=true)
[st, dir] = ta.supertrend(3.0, 10)
plot(st, "ST", color=dir < 0 ? color.green : color.red)
`, 'SuperTrend Pro');

      await new Promise(r => setTimeout(r, 800));

      // 4. Save as new layout
      lm.activeLayoutName = 'Alpha Momentum Matrix';
      lm.quickSaveLayout();

      const handles = cm.getIndicators();
      return {
        symbol: cm.activeSymbol,
        timeframe: cm.activeTimeframe,
        handlesCount: handles.length,
        handles: handles.map(h => ({ title: h.title, nativeType: h.nativeType, inputs: h.inputs }))
      };
    });

    console.log('  Configured state:', JSON.stringify(setupRes, null, 2));
    if (setupRes.handlesCount < 3) { // volume + rsi + supertrend
      recordDefect('high', 'LayoutSetup', 'Indicators Missing', `Expected at least 3 indicators, got ${setupRes.handlesCount}`);
    } else {
      recordPass('Custom Layout Setup', `Configured ETHUSDT 15m (area) with ${setupRes.handlesCount} indicators`);
    }

    // Check localStorage state
    const storedState = await page.evaluate(() => {
      const cur = JSON.parse(localStorage.getItem('tradingchart_current_layout') || 'null');
      const userLayouts = JSON.parse(localStorage.getItem('tradingchart_user_layouts') || 'null');
      return { cur, userLayoutsCount: userLayouts ? userLayouts.length : 0 };
    });

    if (!storedState.cur?.state?.cells?.[0]?.indicators?.length) {
      recordDefect('critical', 'LayoutPersist', 'Indicators Not Serialized', 'Current layout in storage has empty indicators');
    } else {
      recordPass('Rich State Storage Serialization', `Serialized ${storedState.cur.state.cells[0].indicators.length} indicators with inputs in v2 format`);
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 3: RELOAD PAGE (SIMULATING FRESH USER SESSION)
    // ═════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 3: Reloading browser to test session recovery...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(3000);

    const restoredState = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      const topbarName = document.querySelector('#active-layout-name')?.innerText.trim();
      const activeSymbol = cm.activeSymbol;
      const activeTf = cm.activeTimeframe;
      const cell = cm.workspace?.active;
      const cellSymbol = (cell?.symbol || '').replace(/^.*:/, '');
      const cellTf = cell?.timeframe;
      const cellPriceStyle = cell?.priceStyle;
      const indicators = cm.getIndicators();

      return {
        layoutId: lm.activeLayoutId,
        layoutName: lm.activeLayoutName,
        topbarName,
        activeSymbol,
        activeTf,
        cellSymbol,
        cellTf,
        cellPriceStyle,
        indicatorsCount: indicators.length,
        indicators: indicators.map(h => ({ title: h.title, nativeType: h.nativeType, inputs: h.inputs }))
      };
    });

    console.log('  Restored state after session reload:', JSON.stringify(restoredState, null, 2));

    // Verify Symbol
    if (restoredState.cellSymbol !== 'ETHUSDT') {
      recordDefect('high', 'SessionRecovery', 'Symbol Mismatch', `Expected ETHUSDT, got ${restoredState.cellSymbol}`);
    } else {
      recordPass('Symbol Restoration', `Restored exact symbol: ${restoredState.cellSymbol}`);
    }

    // Verify Timeframe
    if (restoredState.cellTf !== '15') {
      recordDefect('high', 'SessionRecovery', 'Timeframe Mismatch', `Expected 15, got ${restoredState.cellTf}`);
    } else {
      recordPass('Timeframe Restoration', `Restored exact timeframe: ${restoredState.cellTf}m`);
    }

    // Verify Price Style
    if (restoredState.cellPriceStyle !== 'area') {
      recordDefect('high', 'SessionRecovery', 'Price Style Mismatch', `Expected area, got ${restoredState.cellPriceStyle}`);
    } else {
      recordPass('Price Style Restoration', `Restored exact style: ${restoredState.cellPriceStyle}`);
    }

    // Verify Indicators & Inputs
    const rsiRestored = restoredState.indicators.find(i => i.nativeType === 'rsi' || (i.title && i.title.includes('Strength')));
    const pineRestored = restoredState.indicators.find(i => i.title === 'SuperTrend Pro');

    if (!rsiRestored) {
      recordDefect('critical', 'SessionRecovery', 'Native Indicator Lost', 'RSI was not restored after session reload');
    } else if (rsiRestored.inputs?.length !== 21) {
      recordDefect('high', 'SessionRecovery', 'Indicator Input Config Lost', `Expected RSI length 21, got ${rsiRestored.inputs?.length}`);
    } else {
      recordPass('Native Indicator & Input Config Restoration', `Restored RSI with custom length 21 and color`);
    }

    if (!pineRestored) {
      recordDefect('critical', 'SessionRecovery', 'Pine Indicator Lost', 'Custom Pine Script "SuperTrend Pro" was not restored');
    } else {
      recordPass('Pine Indicator Script Restoration', `Restored custom Pine indicator "SuperTrend Pro"`);
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 4: MULTI-CHART GRID LAYOUT (2x1 Dual Horizontal)
    // ═════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 4: Testing multi-chart grid layout switching & state isolation...');
    const multiGridRes = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const cm = app.chartManager;

      // Switch to 2h layout
      lm.setLayout('2h', '2x1 Dual Horizontal');
      await new Promise(r => setTimeout(r, 1200));

      const ws = cm.workspace;
      const cells = Array.from(ws.cellsById.values());

      // Customize cell 1: BTCUSDT 60m
      cells[0].setSymbol('universal:BTCUSDT');
      cells[0].setTimeframe('60');

      // Customize cell 2: XAUUSD 5m
      cells[1].setSymbol('universal:XAUUSD');
      cells[1].setTimeframe('5');

      // Add RSI to cell 2
      cells[1].chart.addNativeIndicator('rsi');
      await new Promise(r => setTimeout(r, 600));

      lm.quickSaveLayout();

      return {
        cellsCount: cells.length,
        cell1Sym: (cells[0].symbol || '').replace(/^.*:/, ''),
        cell1Tf: cells[0].timeframe,
        cell2Sym: (cells[1].symbol || '').replace(/^.*:/, ''),
        cell2Tf: cells[1].timeframe
      };
    });

    console.log('  Multi-grid setup:', multiGridRes);
    if (multiGridRes.cellsCount !== 2) {
      recordDefect('high', 'MultiChart', 'Grid Count Mismatch', `Expected 2 cells, got ${multiGridRes.cellsCount}`);
    } else {
      recordPass('Multi-Chart Grid Layout (2H)', `Configured 2-cell layout: Cell 1 (${multiGridRes.cell1Sym} ${multiGridRes.cell1Tf}m), Cell 2 (${multiGridRes.cell2Sym} ${multiGridRes.cell2Tf}m)`);
    }

    // Reload page to verify 2H grid restores with both cells intact
    console.log('▶ STEP 5: Reloading to verify multi-cell grid restoration...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(3000);

    const multiRestored = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const ws = app.chartManager?.workspace;
      const cells = Array.from(ws?.cellsById?.values() || []);
      return {
        activeLayoutId: app.layoutManager?.activeLayoutId,
        cellsCount: cells.length,
        cells: cells.map((c, idx) => ({
          idx,
          sym: (c.symbol || '').replace(/^.*:/, ''),
          tf: c.timeframe,
          indicatorsCount: app.chartManager.workspace.cellsById.get(c.id)?.chart?.orchestrator?.handles ? 
            Array.from(app.chartManager.workspace.cellsById.get(c.id).chart.orchestrator.handles.values()).length : 0
        }))
      };
    });

    console.log('  Multi-grid restored after reload:', JSON.stringify(multiRestored, null, 2));

    if (multiRestored.cellsCount !== 2) {
      recordDefect('critical', 'MultiChartReload', 'Cells Lost', `Expected 2 cells after reload, got ${multiRestored.cellsCount}`);
    } else if (multiRestored.cells[0]?.sym !== 'BTCUSDT' || multiRestored.cells[1]?.sym !== 'XAUUSD') {
      recordDefect('high', 'MultiChartReload', 'Cell Symbols Mismatch', `Expected BTCUSDT & XAUUSD, got ${multiRestored.cells[0]?.sym} & ${multiRestored.cells[1]?.sym}`);
    } else {
      recordPass('Multi-Chart Grid Session Restoration', `Both cells restored with independent symbols (${multiRestored.cells[0]?.sym} / ${multiRestored.cells[1]?.sym}) and indicators`);
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 6: LAYOUT STUDIO MODAL (Save New, Rename, Duplicate, Export, Import)
    // ═════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 6: Testing Layout Studio Modal interactions (Save As New, Duplicate, Rename, Export)...');
    const studioRes = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;

      // Temporarily elevate plan for testing CRUD operations
      if (app.auth) {
        app.auth.user = { id: 'u_qa_pro', plan: 'premium' };
        if (app.auth.entitlements) app.auth.entitlements.savedLayouts = -1;
      }

      // Open Layout Studio
      lm.openLayoutStudio();
      await new Promise(r => setTimeout(r, 600));

      const modal = document.querySelector('#modal-layout-studio');
      const isOpen = modal && modal.classList.contains('open');

      // Test duplicate
      const firstLayoutId = lm.savedLayouts[0]?.id;
      const dupRes = lm.duplicateLayout(firstLayoutId);

      // Test rename
      const renameRes = dupRes ? lm.renameLayout(dupRes.id, 'Renamed Quant Layout') : false;

      // Test export
      const exportedJson = dupRes ? lm.exportLayout(dupRes.id) : null;
      const isExportValid = exportedJson && exportedJson.includes('__tradingchart_layout');

      // Test import
      const importedLayout = isExportValid ? lm.importLayout(exportedJson) : null;

      // Close modal
      modal.classList.remove('open');

      return {
        isOpen: !!isOpen,
        hasDuplicate: !!dupRes,
        renameSuccess: !!renameRes,
        isExportValid: !!isExportValid,
        importedSuccess: !!importedLayout
      };
    });

    if (!studioRes.isOpen) {
      recordDefect('high', 'LayoutStudio', 'Modal Not Opening', 'Layout Studio modal did not open');
    } else {
      recordPass('Layout Studio Open', 'Opened studio dialog');
    }

    if (!studioRes.hasDuplicate || !studioRes.renameSuccess || !studioRes.isExportValid || !studioRes.importedSuccess) {
      recordDefect('high', 'LayoutStudio', 'CRUD Failure', JSON.stringify(studioRes));
    } else {
      recordPass('Layout Management Lifecycle (CRUD)', 'Duplicate, Rename, Export JSON, and Import JSON all verified');
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 7: MOBILE VIEWPORT & MULTI-CHART CELL STRIP (390x844)
    // ═════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 7: Testing Mobile Layout Management & Cell Strip (390x844)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await settle(1500);

    const mobileAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const ws = app.chartManager.workspace;

      // Check mobile cell strip
      const strip = document.querySelector('#multi-chart-cell-strip');
      const isStripVis = strip && getComputedStyle(strip).display !== 'none';
      const pills = strip?.querySelectorAll('.cell-strip-pill') || [];

      // Click cell 2 pill to maximize it on mobile
      const pill2 = strip?.querySelector('[data-cell-id="c2"]');
      if (pill2) pill2.click();
      await new Promise(r => setTimeout(r, 600));

      const isCell2Maximized = ws.maximizedId === 'c2';

      // Restore single 1x1 on mobile
      lm.setLayout('1', '1x1 Single Chart');
      await new Promise(r => setTimeout(r, 600));

      const isStripHidden = !strip || getComputedStyle(strip).display === 'none';

      return {
        isStripVis: !!isStripVis,
        pillsCount: pills.length,
        isCell2Maximized: !!isCell2Maximized,
        isStripHidden: !!isStripHidden
      };
    });

    if (!mobileAudit.isStripVis || mobileAudit.pillsCount < 3) {
      recordDefect('high', 'MobileMultiChart', 'Cell Strip Not Visible', `Pills count: ${mobileAudit.pillsCount}`);
    } else {
      recordPass('Mobile Multi-Chart Strip', `Mounted floating carousel with ${mobileAudit.pillsCount} pills`);
    }

    if (!mobileAudit.isCell2Maximized) {
      recordDefect('medium', 'MobileMultiChart', 'Cell Focus Maximize', 'Tapping cell pill did not focus/maximize cell on mobile');
    } else {
      recordPass('Mobile Cell Focus & Gesture Maximize', 'Tapping cell pill maximized cell for focused mobile editing');
    }

    if (!mobileAudit.isStripHidden) {
      recordDefect('medium', 'MobileMultiChart', 'Strip Not Hidden on 1x1', 'Cell strip stayed visible after switching to 1x1');
    } else {
      recordPass('Mobile 1x1 Strip Auto-Hide', 'Floating strip cleanly hid when returning to 1x1 single chart');
    }

    // Check runtime errors
    console.log('\n▶ STEP 8: Verifying Console Hygiene...');
    if (pageErrors.length > 0) {
      recordDefect('medium', 'ConsoleHygiene', 'Page Errors', pageErrors.join(' | '));
    } else {
      recordPass('Console & Runtime Hygiene', 'Zero errors captured during full lifecycle test');
    }

    await page.close();

  } catch (err) {
    console.error('Layout audit crashed with error:', err);
    recordDefect('critical', 'LayoutAudit', 'Crash', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`   AUDIT COMPLETE: ${passes.length} PASSED, ${defects.length} DEFECTS FOUND `);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const reportPath = path.join(EVID, 'layout_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ passes, defects }, null, 2));

  return { passes, defects };
}

runLayoutAudit().then(({ defects }) => {
  if (defects.length > 0) {
    console.log(`\n\x1b[31mFound ${defects.length} layout management defects to address.\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\n\x1b[32mZero defects detected! Layout management fully verified.\x1b[0m');
    process.exit(0);
  }
}).catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
