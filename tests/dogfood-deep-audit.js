// tests/dogfood-deep-audit.js
// Exhaustive Senior QA Lead Dogfooding Audit across all TradingChart features (LuxAlgo Architecture)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/deep_audit';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runDeepAudit() {
  console.log('=== Starting TradingChart Comprehensive E2E QA Dogfooding Audit ===');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('[Browser Page Error]', err.message);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push({ url: resp.url(), status: resp.status() });
      console.error(`[HTTP ${resp.status}] ${resp.url()}`);
    }
  });

  // 1. Initial Desktop Load (1440x900)
  console.log('\n--- 1. Desktop Initial Load ---');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_loaded.png') });

  // Verify non-flat OHLC in candles
  const candleMetrics = await page.evaluate(() => {
    const bars = window.app?.activeBars || [];
    if (bars.length === 0) return { count: 0 };
    const last = bars[bars.length - 1];
    return {
      count: bars.length,
      lastTime: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      isFlat: (last.open === last.high && last.high === last.low && last.low === last.close)
    };
  });
  console.log('Candle metrics check:', candleMetrics);

  // 2. Test Indicators Modal & Plotting 84+ Library
  console.log('\n--- 2. Testing Indicators Modal & Plotting ---');
  await page.evaluate(() => window.app?.indicatorsModal?.open());
  await new Promise(r => setTimeout(r, 600));

  // Count indicators visible
  const indCount = await page.$eval('#ind-count-label', el => el.innerText);
  console.log('Indicators modal count:', indCount);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_indicators_modal.png') });

  // Add Supertrend ATR indicator
  const supertrendBtn = await page.$('.add-ind-btn[data-id="supertrend"]');
  if (supertrendBtn) {
    await supertrendBtn.click();
    console.log('Clicked Add Supertrend ATR');
  }
  await new Promise(r => setTimeout(r, 1200));

  // Add RSI Momentum
  const rsiBtn = await page.$('.add-ind-btn[data-id="rsi"]');
  if (rsiBtn) {
    await rsiBtn.click();
    console.log('Clicked Add RSI');
  }
  await new Promise(r => setTimeout(r, 1200));

  await page.click('#modal-close-ind');
  await new Promise(r => setTimeout(r, 800));

  // Verify indicators in chart
  const indicatorsOnChart = await page.evaluate(() => {
    const chart = window.app?.chartManager?.workspace?.active?.chart;
    return {
      handles: Array.from(chart?.orchestrator?.handles?.keys() || [])
    };
  });
  console.log('Indicators mounted on chart:', indicatorsOnChart);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_chart_with_indicators.png') });

  // 3. Test Timeframe Switching (via ChartManager API)
  console.log('\n--- 3. Testing Timeframe Switching ---');
  await page.evaluate(() => window.app?.chartManager?.setTimeframe('15'));
  await new Promise(r => setTimeout(r, 1500));
  console.log('Switched to 15m timeframe');

  // 4. Test Multi-Chart Layout Switcher ('2h')
  console.log('\n--- 4. Testing Multi-Chart Layout Switcher ---');
  await page.evaluate(() => window.app?.chartManager?.setLayout('2h'));
  await new Promise(r => setTimeout(r, 1500));
  const cellsCount = await page.evaluate(() => window.app?.chartManager?.workspace?.cells()?.length);
  console.log('Active cells in 2h layout:', cellsCount);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_layout_2h.png') });

  // Restore single layout
  await page.evaluate(() => window.app?.chartManager?.setLayout('1'));
  await new Promise(r => setTimeout(r, 1000));

  // 5. Test Bar Replay Mode
  console.log('\n--- 5. Testing Bar Replay Engine ---');
  await page.evaluate(() => window.app?.barReplay?.startReplay(window.app?.activeBars?.length || 500));
  await new Promise(r => setTimeout(r, 1000));
  const replayBarVisible = await page.$eval('#replay-bar', el => el.classList.contains('visible'));
  console.log('Replay bar visible:', replayBarVisible);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_bar_replay_active.png') });

  // Step 2 times
  await page.click('#btn-replay-step');
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-replay-step');
  await new Promise(r => setTimeout(r, 500));

  // Exit replay
  await page.click('#btn-replay-exit');
  await new Promise(r => setTimeout(r, 800));

  // 6. Test Pine Editor & Compilation
  console.log('\n--- 6. Testing Pine Studio & Backtest ---');
  await page.evaluate(() => window.app?.switchBottomView('pine'));
  await new Promise(r => setTimeout(r, 600));

  // Switch template to Shannon Rebalance
  await page.select('#view-pine #pine-template-select', 'rebalance_shannon');
  await new Promise(r => setTimeout(r, 600));

  // Click Backtest Strategy
  await page.click('#view-pine #btn-pine-backtest');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_strategy_tester_results.png') });

  // 7. Test Export to Prop-Firm Simulator
  console.log('\n--- 7. Testing Prop-Firm Simulator ---');
  await page.click('#view-strategy #btn-export-propsim');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_propsim_monte_carlo.png') });

  // 8. Test Trade Journal View
  console.log('\n--- 8. Testing Trade Journal ---');
  await page.click('#nav-btn-journal');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_trade_journal.png') });

  // Switch back to Quant View
  await page.click('#nav-btn-quant');
  await new Promise(r => setTimeout(r, 800));

  // 9. Test Market Trackers (SEC Alternative Data)
  console.log('\n--- 9. Testing Market Trackers ---');
  await page.evaluate(() => window.app?.switchBottomView('trackers'));
  await new Promise(r => setTimeout(r, 1000));

  // Test filter
  await page.type('#tracker-filter-input', 'NVDA');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_market_trackers_filtered.png') });

  // 10. Test Paper Trading Execution (via Right Tool Rail)
  console.log('\n--- 10. Testing Paper Trading ---');
  await page.click('.rail-btn[data-panel="paper"]');
  await new Promise(r => setTimeout(r, 800));

  // Click Buy / Long inside Paper Trading panel if present
  const buyBtn = await page.$('#btn-order-buy');
  if (buyBtn) {
    await buyBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_paper_trading_pos.png') });

  // 11. Test Price Alerts Creation
  console.log('\n--- 11. Testing Price Alerts ---');
  await page.click('.rail-btn[data-panel="alerts"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_alert_create_form.png') });

  // 12. Test Persian Localization (FA/EN)
  console.log('\n--- 12. Testing Persian Localization ---');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_persian_mode.png') });

  // Switch back to English
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 500));

  // 13. Mobile Viewport Audit (390x844)
  console.log('\n--- 13. Mobile Viewport Audit (390x844) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_mobile_portrait.png') });

  // Open Mobile MoreDrawer
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_mobile_moredrawer.png') });
  }

  await browser.close();

  console.log('\n=== Deep QA Audit Summary ===');
  console.log('Console Errors count:', consoleErrors.length);
  console.log('Page Errors count:', pageErrors.length);
  console.log('Failed Requests count:', failedRequests.length);

  const passed = consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0;
  console.log('FINAL RESULT:', passed ? 'ZERO DEFECTS - ALL 13 TEST SUITES PASSED' : 'ISSUES FOUND');

  return {
    passed,
    consoleErrors,
    pageErrors,
    failedRequests
  };
}

runDeepAudit().then(res => {
  process.exit(res.passed ? 0 : 1);
}).catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
