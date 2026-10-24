/**
 * @spec 004
 * @covers FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017
 */
const { launch, boot } = require('../../qa_lib.cjs');

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
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className, topOuter: top?.outerHTML?.slice(0, 100) };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // Expand bottom suite on desktop
    await realClick(page, '#btn-toggle-bottom-panel');
    await page.waitForFunction(() => {
      const p = document.querySelector('#bottom-panel');
      return p && !p.classList.contains('collapsed') && p.clientHeight > 200;
    }, { timeout: 5000 });

    // ────────────────────────────────────────────────────────────────────────
    // FR-010 & US3 Scenario 1: Initial empty state before backtest run
    // ────────────────────────────────────────────────────────────────────────
    await page.evaluate(() => window.app?.switchBottomView('strategy'));
    await page.waitForFunction(() => {
      const view = document.querySelector('#view-strategy');
      return view && view.classList.contains('active');
    }, { timeout: 4000 });

    const emptyStateInfo = await page.evaluate(() => {
      const v = document.querySelector('#view-strategy');
      return {
        text: v?.innerText || '',
        hasNetProfitCard: !!document.querySelector('#view-strategy #strat-net-profit')
      };
    });

    assert(emptyStateInfo.text.includes('No Strategy Backtest Results Yet') || emptyStateInfo.text.includes('هنوز بک‌تستی اجرا نشده است'),
      'FR-010 empty state message on initial open', `Expected initial empty state, got: "${emptyStateInfo.text}"`);
    assert(!emptyStateInfo.hasNetProfitCard, 'FR-010 no fake/sample report on empty state',
      'Report cards must not be present before a backtest runs');

    // ────────────────────────────────────────────────────────────────────────
    // FR-011: Refusal of non-strategy scripts (Pine Editor & Strategy Tester)
    // ────────────────────────────────────────────────────────────────────────
    // 1. In Pine Studio, clicking Backtest on an indicator script warns the user
    await page.evaluate(() => window.app?.switchBottomView('pine'));
    await page.select('#view-pine #pine-template-select', 'ma_cross'); // indicator template
    await realClick(page, '#view-pine #btn-pine-backtest');

    await page.waitForFunction(() => {
      const diag = document.querySelector('#view-pine #pine-diag-content');
      return diag && (diag.innerText.includes('This script is an indicator, not a strategy') || diag.innerText.includes('اندیکاتور است، نه استراتژی'));
    }, { timeout: 5000 });

    const nonStrategyDiag = await page.$eval('#view-pine #pine-diag-content', el => el.innerText);
    assert(nonStrategyDiag.includes('This script is an indicator, not a strategy') || nonStrategyDiag.includes('اندیکاتور است، نه استراتژی'),
      'FR-011 Pine studio warns on indicator script backtest', `Expected indicator warning, got: "${nonStrategyDiag}"`);

    // 2. Direct runSimulation refusal on non-strategy script
    const nonStratMsg = await page.evaluate(async () => {
      await window.app.strategyTester.runSimulation('//@version=5\nindicator("Plain Indicator")\nplot(close)');
      return window.app.strategyTester.container.innerText;
    });
    assert(nonStratMsg.includes('This script is not a strategy') || nonStratMsg.includes('یک استراتژی نیست'),
      'FR-011 strategyTester refuses indicator script', `Expected refusal message, got: "${nonStratMsg}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-011: Requirement for at least 30 historical bars
    // ────────────────────────────────────────────────────────────────────────
    const fewBarsMsg = await page.evaluate(async () => {
      const dummyBars = Array.from({ length: 15 }, (_, i) => ({
        time: 1700000000000 + i * 60000,
        open: 100, high: 105, low: 95, close: 102, volume: 10
      }));
      await window.app.strategyTester.runSimulation('//@version=5\nstrategy("S")\nstrategy.entry("L", strategy.long)', dummyBars);
      return window.app.strategyTester.container.innerText;
    });
    assert(fewBarsMsg.includes('Need at least 30 historical bars') || fewBarsMsg.includes('حداقل ۳۰ کندل تاریخی'),
      'FR-011 requires at least 30 bars', `Expected bar requirement error, got: "${fewBarsMsg}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-010, FR-012, FR-014: Full Simulation Run, Report KPI Cards & Metrics Derivation
    // ────────────────────────────────────────────────────────────────────────
    // Switch to Pine Editor, pick Shannon Rebalance Strategy template and backtest
    await page.evaluate(() => window.app?.switchBottomView('pine'));
    await page.select('#view-pine #pine-template-select', 'rebalance_shannon');
    await realClick(page, '#view-pine #btn-pine-backtest');

    // View auto-switches to Strategy Tester
    await page.waitForFunction(() => {
      const view = document.querySelector('#view-strategy');
      return view && view.classList.contains('active');
    }, { timeout: 5000 });

    // Wait for simulation to finish and report to render
    await page.waitForSelector('#view-strategy #strat-net-profit', { visible: true, timeout: 20000 });

    const reportMetrics = await page.evaluate(() => {
      const st = window.app.strategyTester;
      const res = st.results;

      const netProfitEl = document.querySelector('#view-strategy #strat-net-profit')?.innerText;
      const profitFactorEl = document.querySelector('#view-strategy #strat-profit-factor')?.innerText;
      const winRateEl = document.querySelector('#view-strategy #strat-win-rate')?.innerText;
      const maxDdEl = document.querySelector('#view-strategy #strat-max-drawdown')?.innerText;
      const sharpeEl = document.querySelector('#view-strategy #strat-sharpe')?.innerText;
      const tradesCountInTable = document.querySelectorAll('#view-strategy #strat-trades-tbody tr').length;
      const svgCurve = document.querySelector('#view-strategy svg path[fill^="url"]');

      return {
        res,
        netProfitEl,
        profitFactorEl,
        winRateEl,
        maxDdEl,
        sharpeEl,
        tradesCountInTable,
        hasSvgCurve: !!svgCurve
      };
    });

    const { res } = reportMetrics;
    assert(res !== null, 'FR-010 backtest results generated', 'Expected strategyTester.results to be populated');
    assert(res.totalTrades > 0, 'FR-010 strategy executed and returned closed trades',
      `Expected totalTrades > 0, got ${res.totalTrades}`);
    assert(res.barsTested >= 30, 'FR-010 evaluated historical bars',
      `Expected barsTested >= 30, got ${res.barsTested}`);

    // FR-012: Mathematical derivation strictly from closed trades and initial capital
    const computedNet = res.finalEquity - res.initialCapital;
    assert(Math.abs(res.netProfit - computedNet) < 0.05, 'FR-012 netProfit matches finalEquity - initialCapital',
      `netProfit ${res.netProfit} !== computed ${computedNet}`);

    const expectedWinRate = (res.winTradesCount / res.totalTrades) * 100;
    assert(Math.abs(res.winRate - expectedWinRate) < 0.1, 'FR-012 winRate matches closed trades win count',
      `winRate ${res.winRate} !== expected ${expectedWinRate}`);

    assert(reportMetrics.netProfitEl && reportMetrics.netProfitEl.includes('$'),
      'FR-012 Net Profit card rendered', `Invalid net profit text: ${reportMetrics.netProfitEl}`);
    assert(reportMetrics.profitFactorEl && reportMetrics.profitFactorEl.length > 0,
      'FR-012 Profit Factor card rendered', `Invalid profit factor: ${reportMetrics.profitFactorEl}`);
    assert(reportMetrics.winRateEl && reportMetrics.winRateEl.includes('%'),
      'FR-012 Win Rate card rendered', `Invalid win rate: ${reportMetrics.winRateEl}`);
    assert(reportMetrics.maxDdEl && reportMetrics.maxDdEl.includes('%'),
      'FR-012 Max Drawdown card rendered', `Invalid max DD: ${reportMetrics.maxDdEl}`);
    assert(reportMetrics.sharpeEl && reportMetrics.sharpeEl.length > 0,
      'FR-012 Sharpe / Expectancy card rendered', `Invalid Sharpe: ${reportMetrics.sharpeEl}`);

    // Edge Case 5: Trades table lists up to 8 recent trades
    assert(reportMetrics.tradesCountInTable === Math.min(8, res.totalTrades),
      'Edge Case 5 trades table shows up to 8 trades',
      `Expected table rows to equal min(8, ${res.totalTrades}), got ${reportMetrics.tradesCountInTable}`);

    // Edge Case 6: SVG equity curve rendered
    assert(reportMetrics.hasSvgCurve, 'Edge Case 6 SVG equity curve rendered', 'Expected SVG curve path');

    // ────────────────────────────────────────────────────────────────────────
    // FR-013: Undefined metric display ("—" and "∞")
    // ────────────────────────────────────────────────────────────────────────
    const undefinedMetricsCheck = await page.evaluate(() => {
      const st = window.app.strategyTester;
      // Mock result with 1 trade (sd = 0 -> sharpe = null) and 0 loss trades -> profitFactor = Infinity
      st.results = {
        totalTrades: 1,
        initialCapital: 100000,
        finalEquity: 101000,
        netProfit: 1000,
        netProfitPct: 1.0,
        grossProfit: 1000,
        grossLoss: 0,
        profitFactor: Infinity,
        winRate: 100,
        winTradesCount: 1,
        lossTradesCount: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        sharpeRatio: null,
        expectancy: 1000,
        trades: [
          { id: 1, side: 'long', entryTime: 1700000000000, entryPrice: 100, exitTime: 1700003600000, exitPrice: 110, qty: 10, profit: 1000, profitPct: 10, equity: 101000 }
        ]
      };
      st.renderReport();

      const pfText = document.querySelector('#view-strategy #strat-profit-factor')?.innerText;
      const sharpeText = document.querySelector('#view-strategy #strat-sharpe')?.innerText;
      return { pfText, sharpeText };
    });

    assert(undefinedMetricsCheck.pfText === '∞', 'FR-013 profit factor with 0 loss displays infinity symbol',
      `Expected "∞", got "${undefinedMetricsCheck.pfText}"`);
    assert(undefinedMetricsCheck.sharpeText.includes('—'), 'FR-013 undefined Sharpe ratio displays em-dash',
      `Expected "—" for single-trade Sharpe, got "${undefinedMetricsCheck.sharpeText}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-015: Explanatory messages (zero closed trades & runtime error)
    // ────────────────────────────────────────────────────────────────────────
    // Zero closed trades handling
    const zeroTradesState = await page.evaluate(() => {
      const st = window.app.strategyTester;
      st.results = {
        totalTrades: 0,
        openTrades: 2,
        barsTested: 150,
        initialCapital: 100000,
        trades: []
      };
      st.renderReport();
      return st.container.innerText;
    });

    assert(zeroTradesState.includes('produced no closed trades') || zeroTradesState.includes('هیچ معاملهٔ بسته‌شده‌ای تولید نکرد'),
      'FR-015 zero closed trades explanatory message', `Expected zero closed trades note, got: "${zeroTradesState}"`);
    assert(zeroTradesState.includes('150') || zeroTradesState.includes('۱۵۰'),
      'FR-015 bar count in zero closed trades note', `Expected bar count 150, got: "${zeroTradesState}"`);

    // Strategy runtime error handling with HTML escaping
    const runtimeErrorState = await page.evaluate(async () => {
      const st = window.app.strategyTester;
      // Pass script that fails at runtime in PineTS
      await st.runSimulation('//@version=5\nstrategy("RuntimeCrash")\nthrow_runtime_error_unknown_func()');
      return {
        text: st.container.innerText,
        html: st.container.innerHTML
      };
    });

    assert(runtimeErrorState.text.includes('Strategy runtime error') || runtimeErrorState.text.includes('خطا در اجرای استراتژی'),
      'FR-015 runtime error message rendered', `Expected runtime error message, got: "${runtimeErrorState.text}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-014: Silent re-run on new bars
    // ────────────────────────────────────────────────────────────────────────
    const silentRerunResult = await page.evaluate(async () => {
      const st = window.app.strategyTester;
      st.lastCode = '//@version=5\nstrategy("SilentTest", overlay=true)\nif (close > open)\n    strategy.entry("L", strategy.long)\nif (close < open)\n    strategy.close("L")';
      const initialRuns = st.results ? st.results.barsTested : 0;

      // Provide new mock bars
      const newCandles = Array.from({ length: 45 }, (_, i) => ({
        time: 1700000000000 + i * 60000,
        open: 100 + (i % 2 === 0 ? 1 : -1),
        high: 105,
        low: 95,
        close: 100 + (i % 2 === 0 ? 2 : -2),
        volume: 100
      }));

      // Call setCandles silently
      st.setCandles(newCandles);
      await new Promise(r => setTimeout(r, 600));

      return {
        barsTested: st.results?.barsTested,
        totalTrades: st.results?.totalTrades
      };
    });

    assert(silentRerunResult.barsTested === 45, 'FR-014 silent re-run on new candles updates barsTested',
      `Expected 45 bars tested, got ${silentRerunResult.barsTested}`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-016: Trades CSV export with plan entitlement gating
    // ────────────────────────────────────────────────────────────────────────
    const csvExportGate = await page.evaluate(async () => {
      const st = window.app.strategyTester;
      // Setup mock results with 2 closed trades
      st.results = {
        totalTrades: 2,
        initialCapital: 100000,
        finalEquity: 100500,
        netProfit: 500,
        netProfitPct: 0.5,
        winRate: 50,
        profitFactor: 2.0,
        maxDrawdown: 100,
        maxDrawdownPct: 0.1,
        sharpeRatio: 1.2,
        expectancy: 250,
        winTradesCount: 1,
        lossTradesCount: 1,
        trades: [
          { id: 1, side: 'long', entryTime: 1700000000000, entryPrice: 100, exitTime: 1700003600000, exitPrice: 110, qty: 1, profit: 10, profitPct: 10, equity: 100010 },
          { id: 2, side: 'short', entryTime: 1700007200000, entryPrice: 110, exitTime: 1700010800000, exitPrice: 115, qty: 1, profit: -5, profitPct: -4.55, equity: 100005 }
        ]
      };
      st.renderReport();

      // Case A: Basic plan (csvTradesExport: false)
      window.app.auth.user = { plan: 'basic' };
      window.app.auth.entitlements = { csvTradesExport: false };
      document.querySelector('#btn-export-csv').click();
      const toastText = document.querySelector('#tradingchart-toast')?.innerText || '';

      // Case B: Plus plan (csvTradesExport: true)
      window.app.auth.user = { plan: 'plus' };
      window.app.auth.entitlements = { csvTradesExport: true };

      let exportedBlob = null;
      let exportedFilename = '';
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        exportedBlob = blob;
        return origCreate(blob);
      };

      document.querySelector('#btn-export-csv').click();
      URL.createObjectURL = origCreate;

      let csvText = '';
      if (exportedBlob) {
        csvText = await exportedBlob.text();
      }

      return {
        toastText,
        csvText
      };
    });

    assert(csvExportGate.toastText.includes('trades CSV export') || csvExportGate.toastText.includes('خروجی CSV'),
      'FR-016 CSV export blocked on Basic plan with upgrade toast', `Expected upgrade toast, got "${csvExportGate.toastText}"`);
    assert(csvExportGate.csvText.includes('Trade ID,Side,Entry Time,Entry Price,Exit Time,Exit Price,Size,P&L ($),P&L (%)'),
      'FR-016 CSV header matches exact contract specification', `Invalid CSV header: ${csvExportGate.csvText.slice(0, 100)}`);
    assert(csvExportGate.csvText.includes('1,LONG') && csvExportGate.csvText.includes('2,SHORT'),
      'FR-016 CSV contains 100% of closed trades', `Missing trades in CSV: ${csvExportGate.csvText}`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-017: Export to Prop-Firm Simulator
    // ────────────────────────────────────────────────────────────────────────
    const propSimExport = await page.evaluate(async () => {
      let forwardedProfile = null;
      const origSetProfile = window.app.propFirmSim?.setProfileParams;
      if (window.app.propFirmSim) {
        window.app.propFirmSim.setProfileParams = (p) => {
          forwardedProfile = p;
          if (origSetProfile) origSetProfile.call(window.app.propFirmSim, p);
        };
      }

      document.querySelector('#btn-export-propsim').click();
      await new Promise(r => setTimeout(r, 400));

      const isPropSimActive = document.querySelector('#view-propsim')?.classList.contains('active');
      return { isPropSimActive, forwardedProfile };
    });

    assert(propSimExport.isPropSimActive, 'FR-017 export switches to Prop-Sim view',
      'Expected #view-propsim to become active');
    assert(propSimExport.forwardedProfile && typeof propSimExport.forwardedProfile.winRate === 'number',
      'FR-017 forwarded profile contains winRate', `Unexpected profile: ${JSON.stringify(propSimExport.forwardedProfile)}`);
  } finally {
    await ctx.browser.close();
  }
}

run().then(() => {
  console.log('✅ 03_strategy_tester_and_backtest.test.cjs passed');
  process.exit(0);
}).catch(err => {
  console.error('❌ 03_strategy_tester_and_backtest.test.cjs:', err);
  process.exit(1);
});
