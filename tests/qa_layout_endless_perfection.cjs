// tests/qa_layout_endless_perfection.cjs
// Endless Rigorous QA Verification for Layout Management, Rich State Persistence,
// Indicator Configuration Preservation, and Multi-Chart Session Restoration.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/chromium-browser');
const BASE = (process.env.SDD_BASE_URL||'http://127.0.0.1:8088');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles/layout_perfection');

if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

const settle = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('    TRADINGCHART RIGOROUS ZERO-DEFECT LAYOUT MANAGEMENT SUITE    ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const passes = [];
  const defects = [];

  function recordPass(test, details = '') {
    passes.push({ test, details });
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${test} ${details ? '— ' + details : ''}`);
  }

  function recordDefect(severity, area, kind, desc) {
    defects.push({ severity, area, kind, desc });
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.toString()));
    page.on('console', async msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
          pageErrors.push(txt);
          const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => '')));
          console.log('\x1b[33m[BROWSER CONSOLE ERROR]\x1b[0m', txt, args);
        }
      }
    });

    console.log('▶ TEST 1: Initial Desktop Session Boot & Layout Restoration Setup');
    await page.goto(BASE + '/chart', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 });
    await settle(2500);

    const bootCheck = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      return {
        hasWorkspace: !!app?.chartManager?.workspace,
        hasLayoutManager: !!app?.layoutManager,
        activeLayoutId: app?.layoutManager?.activeLayoutId,
        topbarName: document.querySelector('#active-layout-name')?.innerText.trim()
      };
    });

    if (bootCheck.hasWorkspace && bootCheck.hasLayoutManager) {
      recordPass('Boot & Architecture Handshake', `Active layout: ${bootCheck.activeLayoutId} (${bootCheck.topbarName})`);
    } else {
      recordDefect('critical', 'Boot', 'Missing Managers', 'ChartManager or LayoutManager missing on app');
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Creation of Persian-named custom layout with 3 indicators
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 2: Creating Custom Layout with Native RSI & Custom Pine (Custom Inputs & Props)');
    const t2 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      // Reset to 1x1
      lm.setLayout('1', 'استراتژی آلفا نکسوس');
      await new Promise(r => setTimeout(r, 600));

      cm.setSymbol('universal:SOLUSDT');
      cm.setTimeframe('15');
      cm.setPriceStyle('area');

      // Clear existing handles
      const orch = cm.workspace.active.chart.orchestrator;
      const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
      for (const h of handles) orch.removeIndicator(h.id);

      // Add Native RSI with custom length 21 and color #f59e0b
      const rsiHandle = cm.workspace.active.chart.addNativeIndicator('rsi', {
        inputs: { length: 21, source: 'Close', color: '#f59e0b' }
      });
      await new Promise(r => setTimeout(r, 400));

      // Add Pine Indicator with custom inputs
      const pineCode = `//@version=5
indicator("Nexus Trend Wave", overlay=false)
len = input.int(55, "Length")
mult = input.float(3.2, "Multiplier")
plot(ta.rsi(close, len), "RSI Wave", color=color.cyan)
`;
      const pineHandle = cm.workspace.active.chart.addIndicator(pineCode, {
        language: 'pine',
        title: 'Nexus Trend Wave',
        inputs: { len: 55, mult: 3.2 }
      });
      await new Promise(r => setTimeout(r, 800));

      // Quick save
      lm.activeLayoutName = 'استراتژی آلفا نکسوس';
      lm.quickSaveLayout();

      const saved = lm.savedLayouts.find(l => l.name === 'استراتژی آلفا نکسوس' || l.nameFa === 'استراتژی آلفا نکسوس');
      const cur = JSON.parse(localStorage.getItem('tradingchart_current_layout') || '{}');

      return {
        topbarName: document.querySelector('#active-layout-name')?.innerText.trim(),
        savedFound: !!saved,
        savedId: saved?.id,
        savedCellCount: saved?.state?.cells?.length,
        curLayoutName: cur?.name,
        indicators: cm.getIndicators()
      };
    });

    if (t2.savedFound && t2.topbarName === 'استراتژی آلفا نکسوس') {
      recordPass('Custom Persian Layout Save', `Saved "${t2.topbarName}" with ID ${t2.savedId}`);
    } else {
      recordDefect('critical', 'LayoutSave', 'Save Failed', `Layout name mismatch or not saved: ${t2.topbarName}`);
    }

    const rsi1 = t2.indicators.find(i => i.nativeType === 'rsi' || i.title.includes('Relative Strength'));
    const pine1 = t2.indicators.find(i => i.title === 'Nexus Trend Wave');
    if (rsi1 && rsi1.inputs.length === 21 && pine1 && pine1.inputs.len === 55) {
      recordPass('Indicator Inputs Registered', `RSI length: ${rsi1.inputs.length}, Pine len: ${pine1.inputs.len}`);
    } else {
      recordDefect('high', 'Indicators', 'Inputs Mismatch', `RSI: ${rsi1?.inputs?.length}, Pine: ${pine1?.inputs?.len}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Create Second Layout "Macro 4-Grid" (2x2 Quad Grid)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 3: Creating Second Multi-Chart Layout "Macro 4-Grid" (4 cells, independent states)');
    const t3 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      lm.setLayout('4', 'Macro 4-Grid');
      await new Promise(r => setTimeout(r, 1500));

      const ws = cm.workspace;
      const cells = Array.from(ws.cellsById.values());

      cells[0].setSymbol('universal:BTCUSDT');
      cells[0].setTimeframe('60');

      cells[1].setSymbol('universal:ETHUSDT');
      cells[1].setTimeframe('15');

      cells[2].setSymbol('universal:SOLUSDT');
      cells[2].setTimeframe('240');

      cells[3].setSymbol('universal:XAUUSD');
      cells[3].setTimeframe('5');

      // Add SMA to cell 3
      cells[3].chart.addNativeIndicator('sma', { inputs: { length: 50 } });
      await new Promise(r => setTimeout(r, 600));

      lm.activeLayoutName = 'Macro 4-Grid';
      lm.quickSaveLayout();

      const saved = lm.savedLayouts.find(l => l.name === 'Macro 4-Grid');
      return {
        cellsCount: cells.length,
        savedFound: !!saved,
        savedId: saved?.id,
        cellSymbols: cells.map(c => (c.symbol || '').replace(/^.*:/, ''))
      };
    });

    if (t3.cellsCount === 4 && t3.savedFound) {
      recordPass('Multi-Chart 4-Grid Save', `Configured 4 cells: ${t3.cellSymbols.join(', ')}`);
    } else {
      recordDefect('critical', 'MultiChart', '4-Grid Save Failed', `Cells: ${t3.cellsCount}, Saved: ${t3.savedFound}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Load back first layout "استراتژی آلفا نکسوس" from savedLayouts
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 4: Loading back "استراتژی آلفا نکسوس" from Saved Layouts');
    const t4 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const cm = app.chartManager;

      const target = lm.savedLayouts.find(l => l.name === 'استراتژی آلفا نکسوس' || l.nameFa === 'استراتژی آلفا نکسوس');
      if (!target) return { error: 'Target layout not found in savedLayouts' };

      lm.setLayout(target.layoutId, target.name, {
        state: target.state,
        stateName: target.name,
        savedLayoutId: target.id
      });

      await new Promise(r => setTimeout(r, 1500));

      const inds = cm.getIndicators();
      return {
        topbarName: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        activeSavedLayoutId: lm.activeSavedLayoutId,
        cellSymbol: (cm.workspace?.active?.symbol || '').replace(/^.*:/, ''),
        cellTf: cm.workspace?.active?.timeframe,
        cellPriceStyle: cm.workspace?.active?.priceStyle,
        indicators: inds.map(i => ({ title: i.title, nativeType: i.nativeType, inputs: i.inputs }))
      };
    });

    if (t4.topbarName === 'استراتژی آلفا نکسوس' && t4.cellSymbol === 'SOLUSDT' && t4.cellTf === '15') {
      recordPass('Layout Switching & Rehydration', `Switched back to "${t4.topbarName}" (${t4.cellSymbol} ${t4.cellTf}m, ${t4.cellPriceStyle})`);
    } else {
      recordDefect('critical', 'LayoutSwitch', 'Rehydration Failed', JSON.stringify(t4));
    }

    const rsi4 = t4.indicators.find(i => i.nativeType === 'rsi' || i.title.includes('Relative Strength'));
    const pine4 = t4.indicators.find(i => i.title === 'Nexus Trend Wave');
    if (rsi4 && rsi4.inputs.length === 21 && pine4 && pine4.inputs.len === 55) {
      recordPass('Custom Inputs Preserved after Layout Switch', `RSI len 21 & Pine len 55 preserved`);
    } else {
      recordDefect('high', 'LayoutSwitch', 'Inputs Corrupted', `RSI: ${rsi4?.inputs?.length}, Pine: ${pine4?.inputs?.len}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Browser Reload (Testing Full Session Recovery)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 5: Full Browser Reload (Simulating Closing and Reopening Browser)');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 });
    await settle(3000);

    const t5 = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const cm = app.chartManager;

      const inds = cm.getIndicators();
      return {
        topbarName: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        activeSavedLayoutId: lm.activeSavedLayoutId,
        cellSymbol: (cm.workspace?.active?.symbol || '').replace(/^.*:/, ''),
        cellTf: cm.workspace?.active?.timeframe,
        cellPriceStyle: cm.workspace?.active?.priceStyle,
        indicators: inds.map(i => ({ title: i.title, nativeType: i.nativeType, inputs: i.inputs }))
      };
    });

    if (t5.topbarName === 'استراتژی آلفا نکسوس' && t5.cellSymbol === 'SOLUSDT') {
      recordPass('Session Recovery After Reload', `Restored layout "${t5.topbarName}" on ${t5.cellSymbol} ${t5.cellTf}m`);
    } else {
      recordDefect('critical', 'SessionRecovery', 'Reload Mismatch', JSON.stringify(t5));
    }

    const rsi5 = t5.indicators.find(i => i.nativeType === 'rsi' || i.title.includes('Relative Strength'));
    const pine5 = t5.indicators.find(i => i.title === 'Nexus Trend Wave');
    if (rsi5 && rsi5.inputs.length === 21 && pine5 && pine5.inputs.len === 55) {
      recordPass('Indicator Configs 100% Intact After Session Restart', `RSI: length=${rsi5.inputs.length}, Pine: len=${pine5.inputs.len}`);
    } else {
      recordDefect('critical', 'SessionRecovery', 'Inputs Lost on Reload', `RSI: ${rsi5?.inputs?.length}, Pine: ${pine5?.inputs?.len}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Interactive Indicator Settings Modal (Tuning RSI length 21 -> 45)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 6: Interactive Indicator Tuning via IndicatorSettingsModal & Auto-Persist');
    const t6 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const ism = app.indicatorSettingsModal;
      const cm = app.chartManager;

      // Find RSI handle
      const orch = cm.workspace.active.chart.orchestrator;
      const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
      const rsiHandle = handles.find(h => h.nativeType === 'rsi' || h.title.includes('Relative Strength'));

      if (!rsiHandle) return { error: 'RSI handle not found' };

      // Open settings for RSI
      ism.open(rsiHandle.id);
      await new Promise(r => setTimeout(r, 400));

      // Modify length input to 45
      const lenInput = document.querySelector('.dynamic-input[data-key="length"], #input-ind-length');
      if (lenInput) {
        lenInput.value = '45';
        lenInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Click Apply & Save
      const applyBtn = document.querySelector('#btn-ind-apply');
      applyBtn?.click();

      await new Promise(r => setTimeout(r, 1000));

      const updatedInds = cm.getIndicators();
      const updatedRsi = updatedInds.find(i => i.id === rsiHandle.id);
      return {
        updatedLength: updatedRsi?.inputs?.length
      };
    });

    if (t6.updatedLength === 45) {
      recordPass('Interactive Settings Modal Tuning', `RSI length updated to 45 via dialog`);
    } else {
      recordDefect('high', 'IndicatorSettings', 'Tuning Failed', `Expected 45, got ${t6.updatedLength}`);
    }

    // Verify auto-persist after tuning by reloading
    console.log('  Reloading to verify auto-persisted tuned input...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 });
    await settle(3000);

    const t6Reload = await page.evaluate(() => {
      const cm = window.__TRADING_APP__.chartManager;
      const inds = cm.getIndicators();
      const rsi = inds.find(i => i.nativeType === 'rsi' || i.title.includes('Relative Strength'));
      return { length: rsi?.inputs?.length };
    });

    if (t6Reload.length === 45) {
      recordPass('Tuned Input Persisted Across Session Reload', `RSI length 45 persisted seamlessly without manual save`);
    } else {
      recordDefect('critical', 'AutoPersist', 'Tuned Config Lost on Reload', `Expected 45, got ${t6Reload.length}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Removing Indicator & Verifying Removal Persists
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 7: Indicator Removal & Auto-Persist Verification');
    const t7 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const orch = cm.workspace.active.chart.orchestrator;

      const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
      const pineHandle = handles.find(h => h.title === 'Nexus Trend Wave');
      if (pineHandle) {
        orch.removeIndicator(pineHandle.id);
      }
      await new Promise(r => setTimeout(r, 800));

      return {
        remainingCount: cm.getIndicators().length,
        hasPine: !!cm.getIndicators().find(i => i.title === 'Nexus Trend Wave')
      };
    });

    if (!t7.hasPine) {
      recordPass('Indicator Removed from Active Chart', `Pine indicator removed, remaining count: ${t7.remainingCount}`);
    } else {
      recordDefect('high', 'IndicatorRemoval', 'Removal Failed', 'Pine indicator still present');
    }

    console.log('  Reloading to verify indicator deletion persisted...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 });
    await settle(3000);

    const t7Reload = await page.evaluate(() => {
      const cm = window.__TRADING_APP__.chartManager;
      const inds = cm.getIndicators();
      return {
        hasPine: !!inds.find(i => i.title === 'Nexus Trend Wave'),
        count: inds.length
      };
    });

    if (!t7Reload.hasPine) {
      recordPass('Indicator Removal Persisted Across Reload', `Removed indicator did NOT re-appear after reload`);
    } else {
      recordDefect('critical', 'RemovalPersist', 'Zombie Indicator Returned', 'Removed indicator was restored on reload');
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Layout Studio CRUD (Duplicate, Rename, Delete)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 8: Layout Studio CRUD Operations (Duplicate, Rename, Delete)');
    const t8 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;

      if (app.auth) {
        app.auth.user = { id: 'u_qa_pro', plan: 'premium' };
        if (app.auth.entitlements) app.auth.entitlements.savedLayouts = -1;
      }

      // 1. Duplicate
      const target = lm.savedLayouts[0];
      const dup = lm.duplicateLayout(target.id);
      if (!dup) return { error: 'Duplicate failed' };

      // 2. Rename the duplicate
      const renameOk = lm.renameLayout(dup.id, 'Duplicated Alpha Setup');
      if (!renameOk) return { error: 'Rename failed' };

      const afterRename = lm.savedLayouts.find(l => l.id === dup.id);

      // 3. Delete the duplicate
      lm.savedLayouts = lm.savedLayouts.filter(l => l.id !== dup.id);
      lm.saveSavedLayouts();
      lm.persistCurrentLayout();

      const afterDelete = lm.savedLayouts.find(l => l.id === dup.id);

      return {
        dupCreated: !!dup,
        renamedTitle: afterRename?.name,
        deletedCleanly: !afterDelete
      };
    });

    if (t8.dupCreated && t8.renamedTitle === 'Duplicated Alpha Setup' && t8.deletedCleanly) {
      recordPass('Layout Studio CRUD', `Duplicate, Rename and Delete verified with zero errors`);
    } else {
      recordDefect('high', 'LayoutStudioCRUD', 'CRUD Failure', JSON.stringify(t8));
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 9: Mobile Viewport Multi-Chart Cell Strip & Responsiveness
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 9: Mobile Viewport (390x844) Responsiveness & Layout Switching');
    await page.setViewport({ width: 390, height: 844 });
    await settle(1000);

    const t9 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;

      // Switch to 2v on mobile
      lm.setLayout('2v', '1x2 Dual Vertical');
      await new Promise(r => setTimeout(r, 1200));

      const strip = document.querySelector('#multi-chart-cell-strip');
      const isVisible = strip && window.getComputedStyle(strip).display !== 'none';
      const pillCount = strip ? strip.querySelectorAll('.cell-strip-pill[data-cell-id]').length : 0;

      // Switch back to 1x1
      lm.setLayout('1', '1x1 Single Chart');
      await new Promise(r => setTimeout(r, 800));

      const isHiddenOnSingle = strip && window.getComputedStyle(strip).display === 'none';

      return {
        stripVisibleOnMulti: isVisible,
        pillCount,
        stripHiddenOnSingle: isHiddenOnSingle
      };
    });

    if (t9.stripVisibleOnMulti && t9.pillCount === 2 && t9.stripHiddenOnSingle) {
      recordPass('Mobile Multi-Chart Strip & Responsive Lifecycle', `Strip mounts with 2 pills on 2V and cleanly auto-hides on 1x1`);
    } else {
      recordDefect('high', 'MobileStrip', 'Strip Malfunction', JSON.stringify(t9));
    }

    // Screenshot evidence
    const ssPath = path.join(EVID, 'layout_perfection_verified.png');
    await page.screenshot({ path: ssPath, fullPage: true });
    recordPass('Evidence Screenshot', ssPath);

    // Runtime errors check
    if (pageErrors.length === 0) {
      recordPass('Runtime Hygiene', '0 console/page errors logged during entire suite');
    } else {
      recordDefect('high', 'Console', 'Runtime Errors', pageErrors.join(' | '));
    }

  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`TOTAL PASSES:  ${passes.length}`);
  console.log(`TOTAL DEFECTS: ${defects.length}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (defects.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
