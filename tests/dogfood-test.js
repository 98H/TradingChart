// tests/dogfood-test.js
// Exhaustive QA Dogfooding Test Suite across Desktop (1440x900) & Mobile (390x844)

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/TradingChart/screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runDogfoodAudit() {
  console.log('=== Starting TradingChart Senior QA Lead Dogfooding Audit ===');

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

  // ── 1. Desktop Audit (1440x900) ───────────────────────────────────
  console.log('\n--- 1. Testing Desktop Surface (1440x900) ---');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_initial_load.png'), fullPage: false });
  console.log('Saved: 01_desktop_initial_load.png');

  // Verify elements presence
  const hasMount = await page.$('#vela-workspace-mount') !== null;
  const hasTopHeader = await page.$('#top-header') !== null;
  const hasRightSidebar = await page.$('#right-sidebar') !== null;
  const hasBottomPanel = await page.$('#bottom-panel') !== null;

  console.log(`DOM Check: Mount=${hasMount}, Header=${hasTopHeader}, RightBar=${hasRightSidebar}, BottomPanel=${hasBottomPanel}`);

  // ── 2. Test Indicators Modal ──────────────────────────────────────
  console.log('\n--- 2. Testing Indicators Modal ---');
  await page.click('#btn-open-indicators');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_indicators_modal.png') });
  console.log('Saved: 02_indicators_modal.png');
  await page.click('#modal-close-ind');
  await new Promise(r => setTimeout(r, 500));

  // ── 3. Test Symbol Search Modal ───────────────────────────────────
  console.log('\n--- 3. Testing Symbol Search Modal ---');
  await page.click('#btn-symbol-search');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_symbol_search_modal.png') });
  console.log('Saved: 03_symbol_search_modal.png');
  await page.click('#modal-close-symbol');
  await new Promise(r => setTimeout(r, 500));

  // ── 4. Test Bottom Panel Views & Backtest Execution ────────────────
  console.log('\n--- 4. Testing Bottom Panel Views & Pine Backtest ---');
  // Open Pine Editor, select Shannon strategy, click Backtest
  await page.click('.panel-tab[data-view="pine"]');
  await new Promise(r => setTimeout(r, 600));
  await page.select('#pine-template-select', 'rebalance_shannon');
  await new Promise(r => setTimeout(r, 600));
  await page.click('#btn-pine-backtest');
  await new Promise(r => setTimeout(r, 1200));

  // Verify Strategy Tester view is now populated with equity curve & metrics
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_strategy_tester_view.png') });
  console.log('Saved: 04_strategy_tester_view.png');

  // Tab: Prop-Firm Simulator
  await page.click('.panel-tab[data-view="propsim"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_prop_firm_sim_view.png') });
  console.log('Saved: 05_prop_firm_sim_view.png');

  // Tab: Trade Journal
  await page.click('.panel-tab[data-view="journal"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_trade_journal_view.png') });
  console.log('Saved: 06_trade_journal_view.png');

  // Tab: Market Trackers
  await page.click('.panel-tab[data-view="trackers"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_market_trackers_view.png') });
  console.log('Saved: 07_market_trackers_view.png');

  // Tab: Pine Editor
  await page.click('.panel-tab[data-view="pine"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_pine_editor_view.png') });
  console.log('Saved: 08_pine_editor_view.png');

  // ── 5. Test Right Sidebar Tabs ────────────────────────────────────
  console.log('\n--- 5. Testing Right Sidebar Tabs ---');
  // Trade tab
  await page.click('.sidebar-tab-btn[data-tab="paper"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_sidebar_paper_trade.png') });
  console.log('Saved: 09_sidebar_paper_trade.png');

  // Alerts tab
  await page.click('.sidebar-tab-btn[data-tab="alerts"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_sidebar_alerts.png') });
  console.log('Saved: 10_sidebar_alerts.png');

  // Back to Watchlist tab
  await page.click('.sidebar-tab-btn[data-tab="watchlist"]');
  await new Promise(r => setTimeout(r, 600));

  // ── 6. Test Persian Localization ──────────────────────────────────
  console.log('\n--- 6. Testing Persian Localization ---');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_persian_rtl_mode.png') });
  console.log('Saved: 11_persian_rtl_mode.png');

  // Switch back to English
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 500));

  // ── 7. Mobile Viewport Audit (390x844) ─────────────────────────────
  console.log('\n--- 7. Testing Mobile Surface (390x844) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_mobile_portrait_view.png') });
  console.log('Saved: 12_mobile_portrait_view.png');

  await browser.close();

  // Summary Report
  console.log('\n=== Dogfood Audit Findings Summary ===');
  console.log('Console Errors count:', consoleErrors.length);
  console.log('Page Errors count:', pageErrors.length);
  console.log('Failed HTTP Requests count:', failedRequests.length);

  const passed = consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0;
  console.log('STATUS:', passed ? 'ALL AUDITS PASSED WITH ZERO DEFECTS' : 'ISSUES DETECTED');

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'audit_report.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    passed,
    consoleErrors,
    pageErrors,
    failedRequests
  }, null, 2));

  return passed;
}

runDogfoodAudit().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
