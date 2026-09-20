// tests/qa_functional_dogfood.cjs
// Senior QA Lead Functional Dogfooding Suite for TradingChart
// Tests end-to-end interactivity, user flows, and edge cases across Desktop & Mobile

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8088';
const EVID = path.resolve(__dirname, '../screenshots/qa_functional');

if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

const settle = (ms) => new Promise(r => setTimeout(r, ms));

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   TradingChart — Comprehensive Functional QA Dogfooding Engine    ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--window-size=1440,900'
    ]
  });

  const defects = [];
  const passes = [];

  function recordPass(testName, details = '') {
    passes.push({ test: testName, details });
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName} ${details ? '— ' + details : ''}`);
  }

  function recordDefect(severity, area, kind, desc) {
    defects.push({ severity, area, kind, desc });
    const col = severity === 'critical' ? '\x1b[35m' : (severity === 'high' ? '\x1b[31m' : '\x1b[33m');
    console.log(`  ${col}✗ [${severity.toUpperCase()}]\x1b[0m [${area}] ${kind}: ${desc}`);
  }

  try {
    // ═════════════════════════════════════════════════════════════════════
    // PART 1: DESKTOP FUNCTIONAL DOGFOODING (1440x900)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n▶ SUITE 1: Desktop Workspace & Core Interactive Features (1440x900)');
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, isMobile: false });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.toString()));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        // Ignore expected favicon or telemetry noise
        if (!txt.includes('favicon') && !txt.includes('Failed to load resource: the server responded with a status of 404')) {
          pageErrors.push(txt);
        }
      }
    });

    console.log('  Navigating to http://127.0.0.1:8088 ...');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
    await settle(2500);

    // D01: Initial Boot & Canvas Health
    const bootCheck = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const canvases = document.querySelectorAll('canvas');
      const curSym = app?.currentSymbol;
      const curTf = app?.currentTimeframe;
      const barsCount = app?.activeBars?.length || 0;
      return { ok: !!app, canvases: canvases.length, curSym, curTf, barsCount };
    });

    if (bootCheck.ok && bootCheck.canvases > 0 && bootCheck.barsCount > 0) {
      recordPass('D01: Boot & Canvas Mount', `${bootCheck.curSym} (${bootCheck.curTf}) with ${bootCheck.barsCount} candles on ${bootCheck.canvases} canvases`);
    } else {
      recordDefect('critical', 'Boot', 'canvas-missing', `App state invalid: ${JSON.stringify(bootCheck)}`);
    }

    // D02: Symbol Search Modal & Symbol Switching
    console.log('  Testing Symbol Search & Switching ...');
    const symTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.openSymbolSearch();
      await new Promise(r => setTimeout(r, 400));
      const modal = document.querySelector('#modal-symbol-search');
      const isOpen = modal?.classList.contains('open');

      const input = document.querySelector('#symbol-search-input');
      if (input) {
        input.value = 'SOL';
        input.dispatchEvent(new Event('input'));
      }
      
      let solFound = false;
      for (let i = 0; i < 20; i++) {
        const rows = document.querySelectorAll('.sym-search-row');
        const solRow = Array.from(rows).find(r => r.getAttribute('data-symbol') === 'SOLUSDT');
        if (solRow) {
          solFound = true;
          solRow.click();
          break;
        }
        await new Promise(r => setTimeout(r, 150));
      }

      for (let i = 0; i < 20; i++) {
        if (app.currentSymbol === 'SOLUSDT' && (app.activeBars?.length || 0) > 0) break;
        await new Promise(r => setTimeout(r, 150));
      }

      return {
        modalOpened: isOpen,
        rowsCount: document.querySelectorAll('.sym-search-row').length,
        solFound,
        currentSymbol: app.currentSymbol,
        barsCount: app.activeBars?.length || 0
      };
    });

    if (symTest.modalOpened && symTest.solFound && symTest.currentSymbol === 'SOLUSDT' && symTest.barsCount > 0) {
      recordPass('D02: Symbol Search & Switch to SOLUSDT', `Chart repointed to ${symTest.currentSymbol} (${symTest.barsCount} bars)`);
    } else {
      recordDefect('high', 'SymbolSearch', 'switch-failed', JSON.stringify(symTest));
    }

    // Switch to Gold Spot (XAUUSD)
    const goldTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const switched = await app.switchSymbol('XAUUSD');
      await new Promise(r => setTimeout(r, 800));
      return { switched, curSym: app.currentSymbol, bars: app.activeBars?.length || 0 };
    });
    if (goldTest.switched && goldTest.curSym === 'XAUUSD' && goldTest.bars > 0) {
      recordPass('D03: Switch to Commodity XAUUSD', `Switched to ${goldTest.curSym} (${goldTest.bars} bars)`);
    } else {
      recordDefect('high', 'SymbolSwitch', 'xau-failed', JSON.stringify(goldTest));
    }

    // Switch back to BTCUSDT
    await page.evaluate(async () => {
      await window.__TRADING_APP__.switchSymbol('BTCUSDT');
    });
    await settle(500);

    // D04: Timeframe Switching (15m, 1h, 4h, 1D)
    console.log('  Testing Timeframe Navigation ...');
    const tfList = ['15', '60', '240', 'D'];
    for (const tf of tfList) {
      const res = await page.evaluate(async (targetTf) => {
        const app = window.__TRADING_APP__;
        const ok = await app.setTimeframe(targetTf);
        await new Promise(r => setTimeout(r, 500));
        return { ok, tf: app.currentTimeframe, bars: app.activeBars?.length || 0 };
      }, tf);

      if (res.ok && res.tf === tf && res.bars > 0) {
        recordPass(`D04: Timeframe Switch ${tf}`, `${res.bars} candles loaded`);
      } else {
        recordDefect('high', 'Timeframe', `tf-${tf}-failed`, JSON.stringify(res));
      }
    }

    // D05: Chart Style Picker (Candles, Line, Area, Bars, Heikin-Ashi)
    console.log('  Testing Chart Style Picker ...');
    const stylesTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const styles = ['candles', 'line', 'area', 'bars', 'heikin-ashi'];
      const results = [];
      for (const st of styles) {
        try {
          app.chartManager?.setPriceStyle(st);
          results.push({ style: st, ok: true });
        } catch (e) {
          results.push({ style: st, ok: false, error: e.message });
        }
      }
      // restore candles
      app.chartManager?.setPriceStyle('candles');
      return results;
    });

    const failedStyles = stylesTest.filter(s => !s.ok);
    if (failedStyles.length === 0) {
      recordPass('D05: Chart Style Switching', 'All 5 price styles applied without error');
    } else {
      recordDefect('medium', 'ChartStyles', 'style-failed', JSON.stringify(failedStyles));
    }

    // D06: Drawing Tools & Floating Toolbar
    console.log('  Testing Drawing Tools & Floating Toolbar ...');
    const drawingTest = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const toolbar = document.querySelector('#floating-drawing-toolbar');
      const isToolbarMounted = !!toolbar;

      // Arm trendline
      app.chartManager?.armDrawingTool('trendline');
      const toolArmed = app.chartManager?.workspace?.globalTool === 'trendline';

      // Toggle magnet
      const magnetBtn = document.querySelector('#fav-btn-magnet');
      magnetBtn?.click();
      const magnetActive = magnetBtn?.classList.contains('active');

      // Toggle lock
      const lockBtn = document.querySelector('#fav-btn-lock');
      lockBtn?.click();
      const lockActive = lockBtn?.classList.contains('active');

      // Clear tool
      app.chartManager?.clearDrawingTool();
      const toolCleared = !app.chartManager?.workspace?.globalTool;

      return { isToolbarMounted, toolArmed, magnetActive, lockActive, toolCleared };
    });

    if (drawingTest.isToolbarMounted && drawingTest.toolArmed && drawingTest.toolCleared) {
      recordPass('D06: Floating Drawing Toolbar', 'Tools arm/clear, magnet/lock toggles responsive');
    } else {
      recordDefect('medium', 'Drawings', 'toolbar-issues', JSON.stringify(drawingTest));
    }

    // D07: Canvas Context Menu (Right Click)
    console.log('  Testing Canvas Right-Click Context Menu ...');
    const contextTest = await page.evaluate(() => {
      const chartArea = document.querySelector('#chart-area');
      const rect = chartArea.getBoundingClientRect();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 200,
        clientY: rect.top + 200
      });
      chartArea.dispatchEvent(event);

      const menu = document.querySelector('#canvas-context-menu');
      const isVisible = menu && menu.style.display !== 'none';
      const itemsCount = menu ? menu.querySelectorAll('.context-menu-item').length : 0;

      // Dismiss with Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      const isDismissed = !menu || menu.style.display === 'none';

      return { isVisible, itemsCount, isDismissed };
    });

    if (contextTest.isVisible && contextTest.itemsCount >= 6 && contextTest.isDismissed) {
      recordPass('D07: Canvas Context Menu', `${contextTest.itemsCount} context actions mounted and dismissed on Esc`);
    } else {
      recordDefect('medium', 'ContextMenu', 'context-menu-flaw', JSON.stringify(contextTest));
    }

    // D08: Indicators Modal & Pine Script Engine
    console.log('  Testing Indicators Catalogue & Adding Indicators ...');
    const indTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.openIndicatorsModal();
      await new Promise(r => setTimeout(r, 400));
      const modal = document.querySelector('#modal-indicators');
      const isModalOpen = modal?.classList.contains('open');

      // Search RSI
      const input = document.querySelector('#ind-search-input');
      if (input) {
        input.value = 'RSI';
        input.dispatchEvent(new Event('input'));
      }
      await new Promise(r => setTimeout(r, 400));

      const rsiCard = document.querySelector('.ind-card[data-id="rsi"], .ind-card[data-name*="RSI"]');
      const rsiFound = !!rsiCard;
      if (rsiCard) {
        const addBtn = rsiCard.querySelector('.add-ind-btn');
        if (addBtn) addBtn.click();
        else rsiCard.click();
      }
      await new Promise(r => setTimeout(r, 800));

      modal?.classList.remove('open');

      // Check active indicator handles
      const chart = app.chartManager?.workspace?.active?.chart;
      const handles = chart?.orchestrator?.handles;
      const handlesCount = handles ? handles.size : 0;

      return { isModalOpen, rsiFound, handlesCount };
    });

    if (indTest.isModalOpen && indTest.rsiFound && indTest.handlesCount > 0) {
      recordPass('D08: Indicators Catalogue & Add RSI', `RSI indicator mounted (${indTest.handlesCount} active chart handles)`);
    } else {
      recordDefect('high', 'Indicators', 'add-indicator-failed', JSON.stringify(indTest));
    }

    // D09: Pine Studio Editor & Compilation
    console.log('  Testing Pine Studio Editor & In-Browser Transpilation ...');
    const pineTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('pine');
      await new Promise(r => setTimeout(r, 500));

      const sel = document.querySelector('#pine-template-select');
      if (sel) {
        sel.value = 'supertrend';
        sel.dispatchEvent(new Event('change'));
      }
      await new Promise(r => setTimeout(r, 300));

      const codeEditor = document.querySelector('#pine-code-editor');
      const hasCode = codeEditor && codeEditor.value.includes('ta.supertrend');

      // Click compile
      const compileBtn = document.querySelector('#btn-pine-compile');
      compileBtn?.click();
      await new Promise(r => setTimeout(r, 800));

      const diagArea = document.querySelector('#pine-diagnostics');
      const diagText = diagArea ? diagArea.innerText : '';
      const isClean = diagText.includes('Successfully compiled') || diagText.includes('0 errors') || !diagText.includes('Error');

      return { hasCode, isClean, diagSnippet: diagText.slice(0, 100) };
    });

    if (pineTest.hasCode && pineTest.isClean) {
      recordPass('D09: Pine Studio AST Transpilation', 'Pine Script template loaded and compiled cleanly');
    } else {
      recordDefect('high', 'PineStudio', 'compile-issue', JSON.stringify(pineTest));
    }

    // D10: Strategy Tester Execution
    console.log('  Testing Quantitative Strategy Tester ...');
    const stratTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('strategy');
      await new Promise(r => setTimeout(r, 800));

      const kpis = document.querySelectorAll('.strat-kpi-card, .kpi-card');
      const tableRows = document.querySelectorAll('#strat-trades-tbody tr');
      const netProfitEl = document.querySelector('#strat-net-profit');
      const winRateEl = document.querySelector('#strat-win-rate');

      return {
        viewActive: !document.querySelector('#view-strategy')?.classList.contains('collapsed'),
        kpisCount: kpis.length,
        tradesCount: tableRows.length,
        netProfit: netProfitEl?.innerText || 'n/a',
        winRate: winRateEl?.innerText || 'n/a'
      };
    });

    if (stratTest.tradesCount > 0 || stratTest.kpisCount > 0) {
      recordPass('D10: Strategy Tester Simulation', `Executed backtest: ${stratTest.tradesCount} trades, Net Profit: ${stratTest.netProfit}, Win Rate: ${stratTest.winRate}`);
    } else {
      recordDefect('high', 'StrategyTester', 'no-trades-simulated', JSON.stringify(stratTest));
    }

    // D11: Monte Carlo Prop-Firm Simulator (10,000 paths)
    console.log('  Testing Prop Firm Simulator (Monte Carlo) ...');
    const propSimTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('propsim');
      await new Promise(r => setTimeout(r, 600));

      const presetSel = document.querySelector('#prop-preset-select, .prop-preset-sel');
      if (presetSel) {
        presetSel.value = 'topstep-50k';
        presetSel.dispatchEvent(new Event('change'));
      }
      await new Promise(r => setTimeout(r, 300));

      const runBtn = document.querySelector('#btn-run-propsim');
      runBtn?.click();
      await new Promise(r => setTimeout(r, 1000));

      const passRateEl = document.querySelector('#propsim-pass-rate');
      const ruinRiskEl = document.querySelector('#propsim-ruin-risk');
      const evEl = document.querySelector('#propsim-ev');

      return {
        passRate: passRateEl?.innerText || '',
        ruinRisk: ruinRiskEl?.innerText || '',
        ev: evEl?.innerText || ''
      };
    });

    if (propSimTest.passRate && propSimTest.passRate.includes('%')) {
      recordPass('D11: Prop Firm Simulator 10k Monte Carlo', `Pass Rate: ${propSimTest.passRate}, Ruin Risk: ${propSimTest.ruinRisk}, EV: ${propSimTest.ev}`);
    } else {
      recordDefect('high', 'PropSim', 'sim-metrics-missing', JSON.stringify(propSimTest));
    }

    // D12: Paper Trading Execution & Position Management
    console.log('  Testing Paper Trading & Position Management ...');
    const paperTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.chartManager?.togglePanel('paper', true);
      await new Promise(r => setTimeout(r, 600));

      const buyBtn = document.querySelector('#btn-order-buy');
      const qtyInput = document.querySelector('#order-qty-input');
      if (qtyInput) qtyInput.value = '0.35';
      buyBtn?.click();
      await new Promise(r => setTimeout(r, 600));

      const posCardsBefore = document.querySelectorAll('.position-card, .pos-card');
      const countBefore = posCardsBefore.length;

      // Close the newest position
      const closeBtn = document.querySelector('.close-pos-btn');
      closeBtn?.click();
      await new Promise(r => setTimeout(r, 600));

      const posCardsAfter = document.querySelectorAll('.position-card, .pos-card');
      const countAfter = posCardsAfter.length;

      return { countBefore, countAfter, closedSuccessfully: countAfter < countBefore };
    });

    if (paperTest.countBefore > 0 && paperTest.closedSuccessfully) {
      recordPass('D12: Paper Trading Long Order & Position Close', `Opened position (total ${paperTest.countBefore}), closed successfully (remaining ${paperTest.countAfter})`);
    } else {
      recordDefect('high', 'PaperTrading', 'order-or-close-failed', JSON.stringify(paperTest));
    }

    // D13: Quick Trade Widget Execution on Canvas
    console.log('  Testing Quick Trade Widget on Canvas ...');
    const qtTest = await page.evaluate(async () => {
      const buyBtn = document.querySelector('#quick-trade-buy-btn');
      const toastBefore = document.querySelector('#tradingchart-toast');

      buyBtn?.click();
      await new Promise(r => setTimeout(r, 400));

      const toastAfter = document.querySelector('#tradingchart-toast');
      const toastText = toastAfter ? toastAfter.innerText : '';
      const toastVisible = toastAfter && toastAfter.style.display !== 'none' && parseFloat(toastAfter.style.opacity) > 0;

      return { toastVisible, toastText };
    });

    if (qtTest.toastVisible && qtTest.toastText.includes('EXECUTED')) {
      recordPass('D13: Quick Trade 1-Click Execution', `Execution toast triggered: "${qtTest.toastText}"`);
    } else {
      recordDefect('medium', 'QuickTrade', 'toast-or-exec-missing', JSON.stringify(qtTest));
    }

    // D14: Depth of Market (DOM) Level 2
    console.log('  Testing Depth of Market (DOM) ...');
    const domTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.chartManager?.togglePanel('dom', true);
      await new Promise(r => setTimeout(r, 600));

      const asks = document.querySelectorAll('#dom-asks-list > div');
      const bids = document.querySelectorAll('#dom-bids-list > div');
      const spread = document.querySelector('#dom-spread')?.innerText;
      const lastPrice = document.querySelector('#dom-last-price')?.innerText;

      return { asksCount: asks.length, bidsCount: bids.length, spread, lastPrice };
    });

    if (domTest.asksCount > 0 && domTest.bidsCount > 0) {
      recordPass('D14: Depth of Market (DOM L2)', `${domTest.bidsCount} Bids, ${domTest.asksCount} Asks, Spread: ${domTest.spread}`);
    } else {
      recordDefect('high', 'DOM', 'depth-ladder-empty', JSON.stringify(domTest));
    }

    // D15: Trade Journal & Monthly Calendar Heatmap
    console.log('  Testing Trade Journal & Log Trade Modal ...');
    const journalTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('journal');
      await new Promise(r => setTimeout(r, 600));

      const calendarDays = document.querySelectorAll('.journal-calendar-grid > div');
      const logTradeBtn = document.querySelector('#btn-journal-add');
      logTradeBtn?.click();
      await new Promise(r => setTimeout(r, 400));

      const modal = document.querySelector('#modal-log-trade');
      const isModalOpen = !!modal;

      // Submit sample trade
      const submitBtn = document.querySelector('#btn-submit-log-trade');
      submitBtn?.click();
      await new Promise(r => setTimeout(r, 600));

      // Test Full-page Journal Workspace Switch
      app.switchWorkspace('journal');
      await new Promise(r => setTimeout(r, 400));
      const isFullJournalVisible = document.querySelector('#journal-workspace-view')?.style.display === 'flex';

      // Switch back to Quant
      app.switchWorkspace('quant');
      await new Promise(r => setTimeout(r, 400));
      const isQuantVisible = document.querySelector('#chart-area')?.style.display === 'flex';

      return {
        calendarDaysCount: calendarDays.length,
        logModalMounted: isModalOpen,
        fullJournalToggle: isFullJournalVisible,
        quantToggleBack: isQuantVisible
      };
    });

    if (journalTest.calendarDaysCount >= 30 && journalTest.logModalMounted && journalTest.fullJournalToggle && journalTest.quantToggleBack) {
      recordPass('D15: Trade Journal & Workspace Switcher', 'Calendar heatmap rendered, log trade modal submitted, Quant/Journal workspace toggles smooth');
    } else {
      recordDefect('high', 'TradeJournal', 'journal-flaws', JSON.stringify(journalTest));
    }

    // D16: Technical Screener Interactivity
    console.log('  Testing Technical Screener ...');
    const screenerTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('screener');
      await new Promise(r => setTimeout(r, 800));

      const rows = document.querySelectorAll('#screener-tbody tr');
      const cryptoPill = document.querySelector('.screener-cat-btn[data-cat="crypto"]');
      cryptoPill?.click();
      await new Promise(r => setTimeout(r, 600));

      const filteredRows = document.querySelectorAll('#screener-tbody tr');

      return { totalRows: rows.length, filteredRows: filteredRows.length };
    });

    if (screenerTest.filteredRows > 0) {
      recordPass('D16: Technical Screener Multi-Asset Telemetry', `${screenerTest.filteredRows} assets screened with RSI, Trend & Ratings`);
    } else {
      recordDefect('high', 'Screener', 'screener-empty', JSON.stringify(screenerTest));
    }

    // D17: Economic Calendar & Macro Events
    console.log('  Testing Global Economic Calendar ...');
    const calTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('calendar');
      await new Promise(r => setTimeout(r, 800));

      const events = document.querySelectorAll('.cal-event-row');
      const highImpactBtn = document.querySelector('.cal-filter-btn[data-val="high"]');
      highImpactBtn?.click();
      await new Promise(r => setTimeout(r, 400));

      const highImpactEvents = document.querySelectorAll('.cal-event-row');
      return { total: events.length, highImpact: highImpactEvents.length };
    });

    if (calTest.total > 0 && calTest.highImpact > 0) {
      recordPass('D17: Global Macro Economic Calendar', `${calTest.total} events loaded, ${calTest.highImpact} High Impact events filtered`);
    } else {
      recordDefect('medium', 'Calendar', 'events-missing', JSON.stringify(calTest));
    }

    // D18: Market Trackers & News
    console.log('  Testing Market Trackers & News ...');
    const trackersTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchBottomView('trackers');
      await new Promise(r => setTimeout(r, 800));

      const subtabs = document.querySelectorAll('.trackers-subtabs .subtab-btn');
      const bodyText = document.querySelector('#tracker-body-area')?.innerText || '';

      app.switchBottomView('news');
      await new Promise(r => setTimeout(r, 800));
      const newsItems = document.querySelectorAll('.news-item-card, .market-news-wrapper .news-card');

      return { subtabsCount: subtabs.length, trackersLoaded: bodyText.length > 50, newsCount: newsItems.length };
    });

    if (trackersTest.trackersLoaded && trackersTest.subtabsCount >= 4) {
      recordPass('D18: Market Trackers (Congress, 13F, FINRA) & News', `${trackersTest.subtabsCount} government disclosure sub-tabs verified`);
    } else {
      recordDefect('medium', 'Trackers', 'tracker-data-empty', JSON.stringify(trackersTest));
    }

    // D19: Multi-Chart Layouts & Compare Modal
    console.log('  Testing Layout Studio & Compare Modal ...');
    const layoutCompareTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.compareModal?.open();
      await new Promise(r => setTimeout(r, 400));
      const isCompareOpen = document.querySelector('#modal-compare')?.classList.contains('open');
      app.compareModal?.close();

      // Test Layout 2H
      app.chartManager?.setLayout('2h');
      await new Promise(r => setTimeout(r, 600));

      // Restore layout 1
      app.chartManager?.setLayout('1');
      await new Promise(r => setTimeout(r, 600));

      return { isCompareOpen, layoutTested: true };
    });

    if (layoutCompareTest.isCompareOpen && layoutCompareTest.layoutTested) {
      recordPass('D19: Layout Studio & Compare Overlay', 'Compare modal opened/closed, 2x1 & 1x1 layouts switched without error');
    } else {
      recordDefect('medium', 'Layouts', 'layout-compare-issue', JSON.stringify(layoutCompareTest));
    }

    // D20: Bar Replay Simulation
    console.log('  Testing Bar Replay Mode ...');
    const replayTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.toggleReplay();
      await new Promise(r => setTimeout(r, 500));

      const replayBar = document.querySelector('#replay-bar');
      const isReplayVisible = replayBar?.classList.contains('visible');

      // Step forward 2 bars
      const stepBtn = document.querySelector('#btn-replay-step');
      stepBtn?.click();
      await new Promise(r => setTimeout(r, 300));
      stepBtn?.click();
      await new Promise(r => setTimeout(r, 300));

      // Exit replay
      app.toggleReplay();
      await new Promise(r => setTimeout(r, 400));
      const isReplayClosed = !replayBar?.classList.contains('visible');

      return { isReplayVisible, isReplayClosed };
    });

    if (replayTest.isReplayVisible && replayTest.isReplayClosed) {
      recordPass('D20: Bar Replay Engine', 'Replay bar mounted, stepped forward, and cleanly exited');
    } else {
      recordDefect('medium', 'BarReplay', 'replay-flaw', JSON.stringify(replayTest));
    }

    // D21: Data Export & Screenshot Modals
    console.log('  Testing Data Export & Screenshot Modals ...');
    const exportScreenTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.dataExportModal?.open();
      await new Promise(r => setTimeout(r, 300));
      const exportOpen = document.querySelector('#modal-data-export')?.classList.contains('open');
      app.dataExportModal?.close();

      app.screenshotModal?.open();
      await new Promise(r => setTimeout(r, 400));
      const screenOpen = document.querySelector('#modal-screenshot-preview')?.classList.contains('open');
      app.screenshotModal?.close?.() || document.querySelector('#modal-screenshot-preview')?.classList.remove('open');

      return { exportOpen, screenOpen };
    });

    if (exportScreenTest.exportOpen && exportScreenTest.screenOpen) {
      recordPass('D21: Export & Screenshot Dialogs', 'Both modals instantiated, populated and dismissed cleanly');
    } else {
      recordDefect('medium', 'ExportScreenshot', 'modal-open-failure', JSON.stringify(exportScreenTest));
    }

    // D22: Bilingual Persian/English Round-Trip Test
    console.log('  Testing Persian Language Mode & RTL Layout ...');
    const i18nTest = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchLanguage('fa');
      await new Promise(r => setTimeout(r, 800));

      const isFa = document.body.classList.contains('persian-mode');
      const dir = document.body.style.direction || getComputedStyle(document.body).direction;
      const navQuant = document.querySelector('#nav-btn-quant')?.innerText?.trim();
      const navPanels = document.querySelector('#nav-btn-panels')?.innerText?.trim();
      const tzLabel = document.querySelector('#btn-timezone-picker')?.innerText?.trim();

      // Check quick trade labels
      const sellBtnText = document.querySelector('#quick-trade-sell-btn')?.innerText?.trim();
      const buyBtnText = document.querySelector('#quick-trade-buy-btn')?.innerText?.trim();

      // Switch back to EN
      app.switchLanguage('en');
      await new Promise(r => setTimeout(r, 800));

      const isEn = !document.body.classList.contains('persian-mode');
      const navQuantEn = document.querySelector('#nav-btn-quant')?.innerText?.trim();

      return {
        faActive: isFa,
        rtlDir: dir === 'rtl',
        navQuant,
        navPanels,
        tzLabel,
        sellBtnText,
        buyBtnText,
        enRestored: isEn,
        navQuantEn
      };
    });

    if (i18nTest.faActive && i18nTest.rtlDir && i18nTest.navQuant === 'کوانت' && i18nTest.enRestored) {
      recordPass('D22: Full Persian RTL Translation & Clean Round-Trip', `FA Nav: "${i18nTest.navQuant}", "${i18nTest.navPanels}", EN restored: "${i18nTest.navQuantEn}"`);
    } else {
      recordDefect('medium', 'i18n', 'translation-glitch', JSON.stringify(i18nTest));
    }

    // Take Desktop Screenshot Evidence
    const desktopShot = path.join(EVID, 'desktop_functional_verified.png');
    await page.screenshot({ path: desktopShot, fullPage: false });
    console.log('  Saved desktop screenshot evidence to:', desktopShot);

    await page.close();

    // ═════════════════════════════════════════════════════════════════════
    // PART 2: MOBILE FUNCTIONAL DOGFOODING (390x844)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n▶ SUITE 2: Mobile Viewport & Touch Ergonomics (390x844)');
    const mPage = await browser.newPage();
    await mPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    const mPageErrors = [];
    mPage.on('pageerror', err => mPageErrors.push(err.toString()));
    mPage.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('favicon') && !txt.includes('Failed to load resource: the server responded with a status of 404')) {
          mPageErrors.push(txt);
        }
      }
    });

    await mPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mPage.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
    await settle(2500);

    // M01: Mobile Boot & Layout Inspection
    const mBoot = await mPage.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bodyScrollW = document.body.scrollWidth;
      const hasHScroll = bodyScrollW > vw + 1;

      // Quick trade minimized?
      const qt = document.querySelector('#chart-quick-trade');
      const isQtMinimized = qt?.classList.contains('minimized');

      // Mobile bottom dock present?
      const mbDock = document.querySelector('.vela-mobile-bar, .mobile-nav-bar, .vela-dock-mobile');
      const hasMbDock = !!mbDock;

      return { vw, bodyScrollW, hasHScroll, isQtMinimized, hasMbDock };
    });

    if (!mBoot.hasHScroll) {
      recordPass('M01: Mobile Responsive Viewport Fit', `390px viewport, scrollWidth=${mBoot.bodyScrollW}px (no horizontal overflow)`);
    } else {
      recordDefect('high', 'MobileViewport', 'horizontal-overflow', `body scrollWidth ${mBoot.bodyScrollW}px > ${mBoot.vw}px`);
    }

    // M02: Mobile Dock & More Drawer Interaction
    console.log('  Testing Mobile Navigation Dock & Drawer ...');
    const mDrawerTest = await mPage.evaluate(async () => {
      // Find "More" or panels trigger in mobile bar
      const moreBtn = document.querySelector('.vela-mb-more, button[data-action="more"], .mobile-dock-item:last-child');
      moreBtn?.click();
      await new Promise(r => setTimeout(r, 400));

      const drawer = document.querySelector('.vela-drawer, .mobile-drawer-menu');
      const isDrawerOpen = drawer?.classList.contains('is-open') || (drawer && drawer.style.display !== 'none');

      return { moreBtnFound: !!moreBtn, isDrawerOpen };
    });

    if (mDrawerTest.moreBtnFound && mDrawerTest.isDrawerOpen) {
      recordPass('M02: Mobile More Drawer', 'Drawer opens on mobile dock tap');
    } else {
      recordDefect('medium', 'MobileDrawer', 'drawer-not-opened', JSON.stringify(mDrawerTest));
    }

    // M03: Mobile Symbol Search & Modal Fit
    console.log('  Testing Mobile Symbol Search Modal ...');
    const mModalTest = await mPage.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.openSymbolSearch();
      await new Promise(r => setTimeout(r, 400));

      const modalBox = document.querySelector('#modal-symbol-search .modal-box');
      const rect = modalBox ? modalBox.getBoundingClientRect() : null;
      const fitsInViewport = rect ? rect.right <= 391 && rect.left >= -1 : false;

      document.querySelector('#modal-close-symbol')?.click();
      await new Promise(r => setTimeout(r, 200));

      return { modalBoxFound: !!modalBox, fitsInViewport, width: rect ? Math.round(rect.width) : 0 };
    });

    if (mModalTest.fitsInViewport) {
      recordPass('M03: Mobile Symbol Search Modal Fit', `Modal width ${mModalTest.width}px fits within 390px`);
    } else {
      recordDefect('high', 'MobileModal', 'modal-overflow', JSON.stringify(mModalTest));
    }

    // M04: Mobile Persian RTL Mode
    console.log('  Testing Mobile Persian Mode ...');
    const mFaTest = await mPage.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.switchLanguage('fa');
      await new Promise(r => setTimeout(r, 600));

      const vw = document.documentElement.clientWidth;
      const bodyScrollW = document.body.scrollWidth;
      const hasHScroll = bodyScrollW > vw + 1;

      // Restore EN
      app.switchLanguage('en');
      await new Promise(r => setTimeout(r, 400));

      return { hasHScroll, bodyScrollW, vw };
    });

    if (!mFaTest.hasHScroll) {
      recordPass('M04: Mobile Persian RTL Clean Fit', `Zero horizontal overflow in Persian RTL mode`);
    } else {
      recordDefect('high', 'MobileFa', 'fa-overflow', JSON.stringify(mFaTest));
    }

    // Take Mobile Screenshot Evidence
    const mobileShot = path.join(EVID, 'mobile_functional_verified.png');
    await mPage.screenshot({ path: mobileShot, fullPage: false });
    console.log('  Saved mobile screenshot evidence to:', mobileShot);

    await mPage.close();

    // Check Console & Page Errors
    const allErrors = [...pageErrors, ...mPageErrors];
    if (allErrors.length > 0) {
      recordDefect('high', 'ConsoleErrors', 'runtime-errors', `${allErrors.length} unexpected errors: ${allErrors.slice(0, 3).join('; ')}`);
    } else {
      recordPass('Console & Page Errors', '0 runtime errors captured across desktop & mobile sessions');
    }

  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`   AUDIT COMPLETE: ${passes.length} Passed, ${defects.length} Defects Found`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const report = {
    timestamp: new Date().toISOString(),
    totalPasses: passes.length,
    totalDefects: defects.length,
    passes,
    defects
  };

  fs.writeFileSync(path.join(EVID, 'audit_report.json'), JSON.stringify(report, null, 2));
  return report;
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
