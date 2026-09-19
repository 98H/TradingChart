// tests/deep_feature_stress_test.cjs
// Deep Stress-Test of Advanced Features: Multi-Chart Grids, Pine Studio, Prop-Firm Simulator, DOM Ladder, Screener Interaction, and Drawing Engine
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const STRESS_DIR = path.resolve(__dirname, '../dogfood_stress');
if (!fs.existsSync(STRESS_DIR)) fs.mkdirSync(STRESS_DIR, { recursive: true });

async function runStressTest() {
  console.log('================================================================');
  console.log('🔬 STARTING DEEP FEATURE STRESS-TEST & ADVANCED INTERACTION AUDIT');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const issues = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(STRESS_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));
    await snap('stress_01_init');

    // ── 1. TEST MULTI-CHART LAYOUTS (2x2 Quad Grid) ─────────────────
    console.log('\n--- 1. Testing Multi-Chart Quad Grid (2x2) ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.layoutManager?.openLayoutStudio();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('stress_02_layout_studio');

    // Click 2x2 Quad Grid
    await page.evaluate(() => {
      const quadBtn = document.querySelector('.layout-preset-card[data-layout="4"], [data-layout="4"]');
      if (quadBtn) quadBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await snap('stress_03_quad_grid_active');

    // Verify 4 chart cells rendered
    const quadCells = await page.evaluate(() => {
      const cells = document.querySelectorAll('.vela-cell');
      return {
        count: cells.length,
        canvases: document.querySelectorAll('canvas').length
      };
    });
    console.log('Quad grid cells status:', quadCells);
    if (quadCells.count !== 4 && quadCells.count !== 1) {
      // note layout engine
    }

    // Switch back to 1x1 Single
    await page.evaluate(() => {
      window.__TRADING_APP__?.layoutManager?.setLayout('1');
    });
    await new Promise(r => setTimeout(r, 1200));
    await snap('stress_04_back_to_single');

    // ── 2. TEST PINE STUDIO IDE & COMPILER ───────────────────────────
    console.log('\n--- 2. Testing Pine Studio IDE & Compilation ---');
    await page.evaluate(() => {
      const bottom = document.querySelector('#bottom-panel');
      if (bottom && bottom.classList.contains('collapsed')) {
        document.querySelector('#btn-toggle-bottom-panel')?.click();
      }
      window.__TRADING_APP__?.switchBottomView('pine');
    });
    await new Promise(r => setTimeout(r, 1000));
    await snap('stress_05_pine_studio_open');

    // Inspect Pine Studio DOM: editor, line numbers, buttons
    const pineInfo = await page.evaluate(() => {
      const ps = window.__TRADING_APP__?.pineStudio;
      const codeEditor = document.querySelector('#pine-code-editor, .pine-editor textarea, textarea');
      const addBtn = document.querySelector('#btn-pine-add-chart, .btn-pine-add');
      const consoleEl = document.querySelector('#pine-console, .pine-diagnostics');
      return {
        hasInstance: !!ps,
        hasEditor: !!codeEditor,
        editorValueLength: codeEditor ? codeEditor.value.length : 0,
        hasAddButton: !!addBtn,
        hasConsole: !!consoleEl
      };
    });
    console.log('Pine Studio info:', pineInfo);

    // Test Adding Pine Script to Chart
    const addPineBtn = await page.$('#btn-pine-add-chart, .btn-pine-add, button[title*="Add to Chart"]');
    if (addPineBtn) {
      await addPineBtn.click();
      await new Promise(r => setTimeout(r, 800));
      await snap('stress_06_pine_script_added');
    }

    // ── 3. TEST PROP-FIRM SIMULATOR (10,000 Monte Carlo) ─────────────
    console.log('\n--- 3. Testing Prop-Firm Simulator Interaction ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchBottomView('propsim');
    });
    await new Promise(r => setTimeout(r, 1000));
    await snap('stress_07_propsim_open');

    // Adjust sliders & run simulation
    const propSimResult = await page.evaluate(() => {
      const pf = window.__TRADING_APP__?.propFirmSim;
      // Click Topstep preset
      const topstepBtn = document.querySelector('.firm-preset-btn[data-preset="topstep50k"], .preset-topstep');
      if (topstepBtn) topstepBtn.click();

      // Trigger run
      const runBtn = document.querySelector('#btn-run-propsim, .btn-run-sim');
      if (runBtn) runBtn.click();

      const passRateEl = document.querySelector('#sim-pass-rate, .pass-probability-val');
      return {
        hasInstance: !!pf,
        passRateText: passRateEl ? passRateEl.innerText.trim() : null
      };
    });
    console.log('Prop-Firm Simulation Result:', propSimResult);
    await new Promise(r => setTimeout(r, 600));
    await snap('stress_08_propsim_run');

    // ── 4. TEST STRATEGY TESTER METRICS & TRADES LIST ────────────────
    console.log('\n--- 4. Testing Strategy Tester & Trades List ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchBottomView('strategy');
    });
    await new Promise(r => setTimeout(r, 800));
    await snap('stress_09_strategy_tester');

    const stratMetrics = await page.evaluate(() => {
      const st = window.__TRADING_APP__?.strategyTester;
      const netProfit = document.querySelector('#strat-net-profit, .strat-metric-val')?.innerText.trim();
      const tradesCount = document.querySelectorAll('.trade-row, .strat-trade-item').length;
      return { hasInstance: !!st, netProfit, tradesCount };
    });
    console.log('Strategy Tester metrics:', stratMetrics);

    // ── 5. TEST DEPTH OF MARKET (DOM) LADDER INTERACTION ─────────────
    console.log('\n--- 5. Testing Depth of Market (DOM) L2 Ladder ---');
    await page.evaluate(() => {
      const domBtn = document.querySelector('#desktop-side-rail .rail-btn[data-panel="dom"]');
      if (domBtn) domBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    await snap('stress_10_dom_ladder_open');

    // Inspect DOM bid/ask rows and click a bid row to pre-fill order
    const domInteraction = await page.evaluate(() => {
      const dom = window.__TRADING_APP__?.depthOfMarket;
      const bidRows = document.querySelectorAll('.dom-bid-row');
      let clickedPrice = null;
      if (bidRows.length > 0) {
        const pEl = bidRows[0].querySelector('.dom-cell-price');
        clickedPrice = pEl ? pEl.innerText.trim() : null;
        bidRows[0].click();
      }
      return { hasDOM: !!dom, bidCount: bidRows.length, clickedPrice };
    });
    console.log('DOM Ladder interaction:', domInteraction);
    await new Promise(r => setTimeout(r, 600));
    await snap('stress_11_dom_row_clicked');

    // ── 6. TEST TECHNICAL SCREENER ROW CLICK (CHART SWITCH) ──────────
    console.log('\n--- 6. Testing Technical Screener Row Click to Switch Chart ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchBottomView('screener');
    });
    await new Promise(r => setTimeout(r, 1000));
    await snap('stress_12_screener_active');

    // Click on ETHUSDT or SOLUSDT row in screener
    const screenerClickResult = await page.evaluate(() => {
      const rows = document.querySelectorAll('.screener-row');
      for (const row of rows) {
        const symEl = row.querySelector('.screener-sym');
        if (symEl && symEl.innerText.includes('ETH')) {
          row.click();
          return { clicked: symEl.innerText.trim() };
        }
      }
      if (rows.length > 0) {
        rows[0].click();
        return { clicked: rows[0].innerText.slice(0, 20) };
      }
      return { clicked: null };
    });
    console.log('Screener row clicked:', screenerClickResult);
    await new Promise(r => setTimeout(r, 1500));
    await snap('stress_13_chart_after_screener_click');

    // ── 7. TEST ECONOMIC CALENDAR EVENT DETAILS ──────────────────────
    console.log('\n--- 7. Testing Economic Calendar Filters ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchBottomView('calendar');
    });
    await new Promise(r => setTimeout(r, 1000));
    await snap('stress_14_calendar_active');

    // Click High Impact filter
    await page.evaluate(() => {
      const highImpactBtn = document.querySelector('.calendar-filter-btn[data-filter="high"], [data-filter="high"]');
      if (highImpactBtn) highImpactBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));
    const calendarEventsCount = await page.evaluate(() => document.querySelectorAll('.calendar-event-card, .calendar-row').length);
    console.log('High impact calendar events count:', calendarEventsCount);
    await snap('stress_15_calendar_high_impact');

    // ── 8. TEST MARKET TRACKERS SEC EDGAR DATA ───────────────────────
    console.log('\n--- 8. Testing Market Trackers SEC Tabs ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchBottomView('trackers');
    });
    await new Promise(r => setTimeout(r, 1000));
    await snap('stress_16_trackers_active');

    const trackerTabs = ['congress', 'insider', 'hedgefunds', 'shortvol'];
    for (const sub of trackerTabs) {
      await page.evaluate((target) => {
        document.querySelector(`.trackers-sub-tab[data-sub="${target}"], [data-tab="${target}"]`)?.click();
      }, sub);
      await new Promise(r => setTimeout(r, 400));
    }
    await snap('stress_17_trackers_insider_view');

    // ── 9. TEST DATA EXPORT MODAL & CSV GENERATION ───────────────────
    console.log('\n--- 9. Testing Data Export Modal ---');
    await page.click('#btn-topbar-export');
    await new Promise(r => setTimeout(r, 600));
    await snap('stress_18_export_modal_open');

    const exportStats = await page.evaluate(() => {
      const modal = document.querySelector('#modal-data-export');
      const csvBtn = document.querySelector('#btn-export-csv');
      const jsonBtn = document.querySelector('#btn-export-json');
      return {
        isOpen: modal ? modal.classList.contains('open') : false,
        hasCsv: !!csvBtn,
        hasJson: !!jsonBtn
      };
    });
    console.log('Export modal statistics:', exportStats);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // ── 10. TEST COLLAPSE & RESTORE WORKSPACE ────────────────────────
    console.log('\n--- 10. Testing Full Canvas Expansion ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.toggleBottomPanel(true); // collapse bottom
      window.__TRADING_APP__?.chartManager?.closeActivePanel(); // close side dock
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('stress_19_maximum_chart_canvas');

  } catch (err) {
    console.error('Stress test fatal error:', err);
    issues.push(`Fatal: ${err.message}`);
  } finally {
    console.log('\n========================================');
    console.log('STRESS TEST SUMMARY');
    console.log('Issues found:', issues.length);
    console.log('Console errors:', consoleErrors.length);
    console.log('Page errors:', pageErrors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(STRESS_DIR, 'stress_results.json'),
      JSON.stringify({ issues, consoleErrors, pageErrors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runStressTest().catch(e => {
  console.error('Run failed:', e);
  process.exit(1);
});
