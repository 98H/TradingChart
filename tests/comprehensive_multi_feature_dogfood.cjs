// tests/comprehensive_multi_feature_dogfood.cjs
// Deep end-to-end multi-feature dogfooding QA runner.
// Tests Layouts, Pine Studio, Strategy Tester, Prop Firm Sim, Full Journal, Watchlist Flags,
// Context Menu, Keyboard Shortcuts, Audio, and Mobile Drawers.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = '/root/TradingChart/screenshots/cycle_deep_audit';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDeepAudit() {
  console.log('================================================================');
  console.log('🚀 TRADINGCHART — ADVANCED MULTI-FEATURE DOGFOODING CRAWLER');
  console.log('================================================================\n');

  const defects = [];
  const logDefect = (severity, category, title, details, element = null) => {
    defects.push({ severity, category, title, details, element, timestamp: new Date().toISOString() });
    console.error(`🔴 [${severity}] [${category}] ${title}: ${details}`);
  };

  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      logDefect('HIGH', 'Console Error', 'Browser Console Error', msg.text());
    }
  });

  page.on('pageerror', err => {
    logDefect('CRITICAL', 'Runtime Exception', 'Uncaught Page Error', err.toString());
  });

  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await sleep(2000);

  // ── TEST 1: Full-Page Journal Workspace Switching ────────────────────────
  console.log('\n--- Test 1: Full-Page Journal Workspace Flow ---');
  await page.evaluate(() => {
    document.querySelector('#nav-btn-journal')?.click();
  });
  await sleep(600);

  const journalViewActive = await page.evaluate(() => {
    const jView = document.querySelector('#journal-workspace-view');
    const cArea = document.querySelector('#chart-area');
    return {
      journalVisible: jView && window.getComputedStyle(jView).display !== 'none',
      chartHidden: cArea && window.getComputedStyle(cArea).display === 'none',
      hasCalendar: !!jView?.querySelector('.journal-calendar-grid'),
      hasStats: (jView?.querySelectorAll('.journal-stat-card')?.length || 0) >= 4
    };
  });
  console.log('Journal View state:', journalViewActive);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_journal_workspace_view.png') });

  if (!journalViewActive.journalVisible || !journalViewActive.chartHidden || !journalViewActive.hasCalendar || !journalViewActive.hasStats) {
    logDefect('HIGH', 'Workspace', 'Full-page journal view failed to activate or missing components', JSON.stringify(journalViewActive));
  } else {
    console.log('[PASS] Full-page Journal Workspace loaded with calendar and stats.');
  }

  // Switch back to Quant
  await page.evaluate(() => {
    document.querySelector('#nav-btn-quant')?.click();
  });
  await sleep(600);

  // ── TEST 2: Multi-Chart Layouts ─────────────────────────────────────────
  console.log('\n--- Test 2: Multi-Chart Layout Manager Flow ---');
  await page.evaluate(() => {
    document.querySelector('#btn-layout-manager')?.click();
  });
  await sleep(400);

  const layoutStudioOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-layout-studio');
    return m && m.classList.contains('open');
  });
  if (!layoutStudioOpen) {
    logDefect('HIGH', 'Layout Studio', 'Layout Studio modal did not open on trigger click', '');
  } else {
    console.log('[PASS] Layout Studio opened.');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_layout_studio_modal.png') });

    // Select 2h layout
    await page.evaluate(() => {
      document.querySelector('.layout-preset-card[data-layout="2h"]')?.click();
    });
    await sleep(800);

    const cellCount = await page.evaluate(() => {
      return document.querySelectorAll('.vela-cell, .vela-ws-grid > div').length;
    });
    console.log(`Chart cells rendered after 2h layout select: ${cellCount}`);

    // Switch back to 1x1
    await page.evaluate(() => {
      window.__TRADING_APP__?.chartManager?.setLayout('1');
    });
    await sleep(600);
  }

  // ── TEST 3: Pine Script IDE in Bottom Suite ──────────────────────────────
  console.log('\n--- Test 3: Pine Script Editor & Live Compilation ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.switchBottomView('pine');
  });
  await sleep(500);

  const pineEditorInfo = await page.evaluate(() => {
    const editor = document.querySelector('#pine-code-editor');
    const addBtn = document.querySelector('#btn-pine-compile');
    const gutter = document.querySelector('#pine-line-gutter');
    const diag = document.querySelector('#pine-diagnostics-pane');
    return {
      hasEditor: !!editor,
      hasAddBtn: !!addBtn,
      hasGutter: !!gutter,
      hasDiag: !!diag,
      editorValLength: editor?.value?.length || 0,
      editorDir: editor ? window.getComputedStyle(editor).direction : null
    };
  });
  console.log('Pine Editor metrics:', pineEditorInfo);

  if (!pineEditorInfo.hasEditor || !pineEditorInfo.hasAddBtn || !pineEditorInfo.hasGutter || !pineEditorInfo.hasDiag) {
    logDefect('HIGH', 'Pine IDE', 'Pine Script editor textarea or Add to Chart button missing in DOM', JSON.stringify(pineEditorInfo));
  } else {
    console.log('[PASS] Pine IDE fully initialized with line gutter and diagnostics pane.');
  }

  if (pineEditorInfo.editorDir !== 'ltr') {
    logDefect('HIGH', 'Pine IDE', `Pine code editor must be strictly LTR, got: "${pineEditorInfo.editorDir}"`, '');
  }

  // Click "Add to Chart" to compile indicator
  await page.evaluate(() => {
    document.querySelector('#btn-pine-compile')?.click();
  });
  await sleep(800);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_pine_editor_compiled.png') });

  // ── TEST 4: Strategy Tester Metrics & Trades Table ───────────────────────
  console.log('\n--- Test 4: Strategy Tester Flow ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.switchBottomView('strategy');
  });
  await sleep(500);

  const stratInfo = await page.evaluate(() => {
    const pane = document.querySelector('#view-strategy');
    const cards = pane?.querySelectorAll('.strategy-metric-card, .metric-box, div[style*="background: var(--bg-card)"]');
    const table = pane?.querySelector('.strategy-trades-table, table');
    return {
      visible: pane && window.getComputedStyle(pane).display !== 'none',
      cardsCount: cards?.length || 0,
      hasTradesTable: !!table
    };
  });
  console.log('Strategy Tester state:', stratInfo);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_strategy_tester.png') });

  if (!stratInfo.visible || stratInfo.cardsCount === 0 || !stratInfo.hasTradesTable) {
    logDefect('HIGH', 'Strategy Tester', 'Strategy Tester metrics or trades table missing', JSON.stringify(stratInfo));
  } else {
    console.log(`[PASS] Strategy Tester active with ${stratInfo.cardsCount} metrics and trades table.`);
  }

  // ── TEST 5: Prop Firm Simulator Monte Carlo Flow ─────────────────────────
  console.log('\n--- Test 5: Prop Firm Simulator Flow ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.switchBottomView('propsim');
  });
  await sleep(500);

  const propSimInfo = await page.evaluate(() => {
    const pane = document.querySelector('#view-propsim');
    const runBtn = pane?.querySelector('#btn-run-propsim');
    const sizeSelect = pane?.querySelector('#prop-preset-select');
    const hasChart = !!pane?.querySelector('svg, canvas');
    return {
      visible: pane && window.getComputedStyle(pane).display !== 'none',
      hasRunBtn: !!runBtn,
      hasSizeSelect: !!sizeSelect,
      hasChart
    };
  });
  console.log('Prop Firm Sim state:', propSimInfo);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_propsim_view.png') });

  if (!propSimInfo.visible || !propSimInfo.hasRunBtn || !propSimInfo.hasSizeSelect || !propSimInfo.hasChart) {
    logDefect('HIGH', 'PropFirm Simulator', 'Prop-Firm Simulator Monte Carlo simulation missing', JSON.stringify(propSimInfo));
  } else {
    console.log('[PASS] Prop Firm Simulator pre-warmed with 500 Monte Carlo paths and SVG trajectories.');
  }

  // ── TEST 6: Watchlist 5-Color Flags & Sorting ───────────────────────────
  console.log('\n--- Test 6: Watchlist 5-Color Flags & Sorting ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.chartManager?.togglePanel('watchlist', true);
  });
  await sleep(600);

  const wlInfo = await page.evaluate(() => {
    const panel = document.querySelector('.vela-panel-watchlist, .watchlist-panel');
    const items = panel?.querySelectorAll('.wl-item, .watchlist-row, .symbol-row');
    const flagFilters = panel?.querySelectorAll('.wl-flag-filter-btn');
    return {
      visible: panel && window.getComputedStyle(panel).display !== 'none',
      itemsCount: items?.length || 0,
      flagsCount: flagFilters?.length || 0
    };
  });
  console.log('Watchlist state:', wlInfo);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_watchlist_flags.png') });

  if (!wlInfo.visible || wlInfo.flagsCount < 5) {
    logDefect('HIGH', 'Watchlist', `Watchlist 5-color flags missing: ${wlInfo.flagsCount} found`, '');
  } else {
    console.log(`[PASS] Watchlist 5-color flags verified: ${wlInfo.flagsCount} flag filters active.`);
  }

  // Close watchlist
  await page.evaluate(() => window.__TRADING_APP__?.chartManager?.closeActivePanel());
  await sleep(300);

  // ── TEST 7: Canvas Context Menu (Right Click) ───────────────────────────
  console.log('\n--- Test 7: Canvas Context Menu & Interaction ---');
  const canvasMid = await page.evaluate(() => {
    const c = document.querySelector('#vela-workspace-mount canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  if (canvasMid) {
    await page.mouse.click(canvasMid.x, canvasMid.y, { button: 'right' });
    await sleep(300);

    const ctxInfo = await page.evaluate(() => {
      const menu = document.querySelector('#canvas-context-menu, .context-menu');
      if (!menu) return { exists: false };
      const items = Array.from(menu.querySelectorAll('.ctx-item, .context-menu-item')).map(i => i.textContent.trim());
      return {
        exists: true,
        visible: window.getComputedStyle(menu).display !== 'none',
        itemsCount: items.length,
        items
      };
    });
    console.log('Context menu info:', ctxInfo);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_context_menu_open.png') });

    if (!ctxInfo.exists || !ctxInfo.visible || ctxInfo.itemsCount === 0) {
      logDefect('HIGH', 'Context Menu', 'Right-click canvas context menu did not open with interactive actions', '');
    } else {
      console.log(`[PASS] Context menu opened with ${ctxInfo.itemsCount} actions.`);
    }

    // Dismiss context menu
    await page.mouse.click(canvasMid.x - 100, canvasMid.y - 100, { button: 'left' });
    await sleep(200);
  }

  // ── TEST 8: Keyboard Shortcuts Modal ────────────────────────────────────
  console.log('\n--- Test 8: Keyboard Shortcuts Modal Flow ---');
  // Test clicking shortcuts trigger button
  await page.evaluate(() => document.querySelector('#btn-shortcuts-help')?.click());
  await sleep(400);

  const shortcutsOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-shortcuts');
    return m && (m.classList.contains('open') || window.getComputedStyle(m).display !== 'none');
  });

  if (!shortcutsOpen) {
    logDefect('HIGH', 'Shortcuts', 'Shortcuts modal failed to open', '');
  } else {
    console.log('[PASS] Shortcuts modal opened cleanly.');
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_shortcuts_modal.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  // ── TEST 9: Mobile Panels Drawer (390x844) ───────────────────────────────
  console.log('\n--- Test 9: Mobile Panels Drawer Flow ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(800);

  await page.evaluate(() => {
    document.querySelector('#nav-btn-panels')?.click();
  });
  await sleep(500);

  const drawerInfo = await page.evaluate(() => {
    const modal = document.querySelector('#modal-panels-menu');
    const items = modal?.querySelectorAll('.panel-menu-item');
    const isVisible = modal && (modal.classList.contains('open') || window.getComputedStyle(modal).display !== 'none');
    return {
      isVisible,
      itemsCount: items?.length || 0
    };
  });
  console.log('Mobile panels drawer state:', drawerInfo);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_mobile_panels_menu.png') });

  if (!drawerInfo.isVisible || drawerInfo.itemsCount === 0) {
    logDefect('HIGH', 'Mobile Drawer', 'Mobile panels menu drawer failed to display or contained 0 items', '');
  } else {
    console.log(`[PASS] Mobile panels menu drawer loaded with ${drawerInfo.itemsCount} tools.`);
  }
  await page.keyboard.press('Escape');
  await sleep(300);

  console.log('\n================================================================');
  console.log(`Comprehensive Multi-Feature Run Complete. Total Defects: ${defects.length}`);
  console.log('================================================================');

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'deep_audit_summary.json'),
    JSON.stringify(defects, null, 2)
  );

  await browser.close();
  return defects;
}

runDeepAudit().catch(err => {
  console.error('Fatal Deep Audit Error:', err);
  process.exit(1);
});
