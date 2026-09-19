// tests/rigorous_full_dogfood_cycle8.cjs
// Senior Product Designer & QA Lead Full-Surface Exploration for TradingChart

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/root/TradingChart/screenshots/cycle8_dogfood';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCycle8Audit() {
  console.log('========================================================================');
  console.log('🔍 COMMENCING CYCLE 8: FULL-SURFACE PRODUCT DESIGN & QA RIGOROUS AUDIT');
  console.log('========================================================================\n');

  const issues = [];
  const findings = [];
  const consoleErrors = [];
  const pageErrors = [];

  function recordIssue(category, title, detail, severity = 'MEDIUM') {
    const item = { category, title, detail, severity };
    issues.push(item);
    console.log(`❌ [${severity}] [${category}] ${title} -> ${detail}`);
  }

  function recordFinding(category, title, detail) {
    findings.push({ category, title, detail });
    console.log(`✅ [${category}] ${title}: ${detail}`);
  }

  // Connect to Chrome on 9222
  console.log('Connecting to Chrome on 127.0.0.1:9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

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
    const p = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    console.log('\n--- 1. Initial Page Load (English Desktop 1440x900) ---');
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    await snap('01_desktop_initial_en');

    // Check basic elements
    const topHeader = await page.$('#top-app-header');
    const mainViewport = await page.$('#main-viewport');
    const sideRail = await page.$('#desktop-side-rail');
    const bottomPanel = await page.$('#bottom-panel');
    const velaMount = await page.$('#vela-workspace-mount');
    const quickTrade = await page.$('#chart-quick-trade');

    if (!topHeader) recordIssue('Layout', 'Missing Header', '#top-app-header not found', 'CRITICAL');
    if (!mainViewport) recordIssue('Layout', 'Missing Viewport', '#main-viewport not found', 'CRITICAL');
    if (!sideRail) recordIssue('Layout', 'Missing Side Rail', '#desktop-side-rail not found', 'HIGH');
    if (!bottomPanel) recordIssue('Layout', 'Missing Bottom Panel', '#bottom-panel not found', 'HIGH');
    if (!velaMount) recordIssue('Canvas', 'Missing Vela Mount', '#vela-workspace-mount not found', 'CRITICAL');
    if (!quickTrade) recordIssue('Trading', 'Missing Quick Trade', '#chart-quick-trade not found', 'MEDIUM');

    // ── 2. Test Quick Trade Widget ───────────────────────────────────────
    console.log('\n--- 2. Testing Quick Trade Widget ---');
    const qtBuyBtn = await page.$('#quick-trade-buy-btn');
    const qtSellBtn = await page.$('#quick-trade-sell-btn');
    const qtPriceBuy = await page.$eval('#quick-buy-price', el => el.textContent.trim()).catch(() => '');
    const qtPriceSell = await page.$eval('#quick-sell-price', el => el.textContent.trim()).catch(() => '');
    const qtSpread = await page.$eval('#quick-trade-spread', el => el.textContent.trim()).catch(() => '');

    console.log(`Quick Trade: BuyPrice=${qtPriceBuy}, SellPrice=${qtPriceSell}, Spread=${qtSpread}`);
    if (!qtPriceBuy || qtPriceBuy === '...') recordIssue('QuickTrade', 'Empty Buy Price', 'Buy price not updating', 'HIGH');
    if (!qtPriceSell || qtPriceSell === '...') recordIssue('QuickTrade', 'Empty Sell Price', 'Sell price not updating', 'HIGH');

    // Click Buy button
    if (qtBuyBtn) {
      await qtBuyBtn.click();
      await sleep(600);
      await snap('02_quick_trade_buy_clicked');
    }

    // Toggle minimize quick trade
    const qtToggle = await page.$('#qt-toggle-btn');
    if (qtToggle) {
      await qtToggle.click();
      await sleep(400);
      await snap('03_quick_trade_minimized');
      const collapsedPill = await page.$('#qt-collapsed-trigger');
      if (collapsedPill) {
        await collapsedPill.click();
        await sleep(400);
        await snap('04_quick_trade_restored');
      }
    }

    // ── 3. Test Symbol Search Modal ──────────────────────────────────────
    console.log('\n--- 3. Testing Symbol Search Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.openSymbolSearch?.());
    await sleep(600);
    await snap('05_symbol_search_modal');

    // Test Search input
    const symInput = await page.$('#symbol-search-input');
    if (symInput) {
      await symInput.click({ clickCount: 3 });
      await symInput.type('ETH', { delay: 30 });
      await sleep(500);
      await snap('06_symbol_search_filtered_eth');
      
      const ethRow = await page.$('#symbol-results-list .sym-search-row');
      if (ethRow) {
        await ethRow.click();
        await sleep(1500);
        const curSym = await page.evaluate(() => window.__TRADING_APP__?.currentSymbol);
        console.log('Symbol after selecting ETH:', curSym);
        if (curSym !== 'ETHUSDT') recordIssue('SymbolSearch', 'Symbol switch failed', `Expected ETHUSDT but got ${curSym}`, 'HIGH');
      }
    }
    await snap('07_chart_ethusdt');

    // ── 4. Test Timeframe Switching ──────────────────────────────────────
    console.log('\n--- 4. Testing Timeframe Switching ---');
    const tfList = ['1', '5', '15', '60', '240', 'D', 'W'];
    for (const tf of tfList) {
      const switched = await page.evaluate(async (t) => {
        try {
          if (window.__TRADING_APP__?.timeframeManager?.setTimeframe) {
            window.__TRADING_APP__.timeframeManager.setTimeframe(t);
            return true;
          } else if (window.__TRADING_APP__?.setTimeframe) {
            window.__TRADING_APP__.setTimeframe(t);
            return true;
          }
          return 'no method';
        } catch (e) {
          return e.message;
        }
      }, tf);
      await sleep(600);
      const activeTf = await page.evaluate(() => window.__TRADING_APP__?.currentTimeframe);
      console.log(`Switching TF to ${tf} -> result: ${switched}, active: ${activeTf}`);
      if (activeTf !== tf) recordIssue('Timeframe', `TF ${tf} switch mismatch`, `Active TF is ${activeTf}`, 'MEDIUM');
    }
    await snap('08_timeframe_1w_active');

    // Switch back to 15m
    await page.evaluate(() => {
      if (window.__TRADING_APP__?.timeframeManager?.setTimeframe) {
        window.__TRADING_APP__.timeframeManager.setTimeframe('15');
      } else if (window.__TRADING_APP__?.setTimeframe) {
        window.__TRADING_APP__.setTimeframe('15');
      }
    });
    await sleep(800);

    // ── 5. Test Chart Style Picker ───────────────────────────────────────
    console.log('\n--- 5. Testing Chart Style Picker ---');
    const styleBtn = await page.$('#btn-topbar-chart-style');
    if (styleBtn) {
      await styleBtn.click();
      await sleep(500);
      await snap('09_chart_style_dropdown');
      
      // Select Heikin Ashi or Bars
      const styleItems = await page.$$('.chart-style-item, .style-menu-item');
      console.log('Found chart style items:', styleItems.length);
      if (styleItems.length === 0) {
        recordIssue('ChartStyle', 'Missing Style Options', 'No .chart-style-item elements found', 'HIGH');
      } else {
        // Click second item
        await page.evaluate(el => el.click(), styleItems[1]);
        await sleep(800);
        await snap('10_chart_style_changed');
      }
    }

    // ── 6. Test Indicators Library (84+ Library) ────────────────────────
    console.log('\n--- 6. Testing Indicators Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.open?.());
    await sleep(600);
    await snap('11_indicators_library_modal');

    // Verify indicator search and categories
    const indSearch = await page.$('#ind-search-input');
    if (indSearch) {
      await indSearch.click({ clickCount: 3 });
      await indSearch.type('RSI', { delay: 30 });
      await sleep(500);
      await snap('12_indicators_search_rsi');

      // Click first indicator row to add it
      const firstAddBtn = await page.$('.add-ind-btn');
      if (firstAddBtn) {
        await page.evaluate(el => el.click(), firstAddBtn);
        await sleep(800);
      }
    }

    // Close indicators modal
    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.close?.());
    await sleep(500);
    await snap('13_chart_with_rsi_indicator');

    // ── 7. Test Right Tool Rail Panels ───────────────────────────────────
    console.log('\n--- 7. Testing Right Tool Rail Panels ---');
    const railPanels = ['watchlist', 'alerts', 'paper', 'dataWindow', 'objects', 'screener', 'dom', 'calendar', 'news'];
    for (const p of railPanels) {
      console.log(`Opening Rail Panel: ${p}...`);
      const railBtn = await page.$(`.rail-btn[data-panel="${p}"]`);
      if (railBtn) {
        await railBtn.click();
        await sleep(700);
        await snap(`14_panel_${p}`);

        // Specific checks per panel
        if (p === 'paper') {
          const buyPaperBtn = await page.$('#btn-order-buy, #btn-paper-buy');
          const sellPaperBtn = await page.$('#btn-order-sell, #btn-paper-sell');
          if (!buyPaperBtn || !sellPaperBtn) {
            recordIssue('PaperTrading', 'Missing Buy/Sell buttons', 'Paper trading panel buttons missing', 'HIGH');
          } else {
            // Test placing a paper trade
            await page.evaluate(() => document.querySelector('#btn-order-buy, #btn-paper-buy')?.click());
            await sleep(800);
            await snap('15_paper_trade_placed');
            const posCount = await page.$$eval('.position-card, .pos-card, tr.position-row', els => els.length).catch(() => 0);
            console.log('Active paper positions count:', posCount);
            if (posCount === 0) {
              recordIssue('PaperTrading', 'Order Placement', 'Position card not rendered after buy click', 'MEDIUM');
            }
          }
        } else if (p === 'watchlist') {
          const wlItems = await page.$$('.wl-item, .watchlist-row');
          console.log('Watchlist items count:', wlItems.length);
          if (wlItems.length === 0) {
            recordIssue('Watchlist', 'Empty Watchlist', 'No watchlist rows rendered', 'HIGH');
          }
        } else if (p === 'alerts') {
          const alertRows = await page.$$('.alert-item, .alert-row');
          console.log('Alert rows count:', alertRows.length);
        } else if (p === 'screener') {
          const screenerRows = await page.$$('.screener-row, tr.screener-tr');
          console.log('Screener rows count:', screenerRows.length);
          if (screenerRows.length === 0) {
            recordIssue('Screener', 'Empty Screener', 'No screener table rows rendered', 'HIGH');
          }
        } else if (p === 'dom') {
          const domBids = await page.$$('.dom-bid-row');
          const domAsks = await page.$$('.dom-ask-row');
          console.log(`DOM: Bids=${domBids.length}, Asks=${domAsks.length}`);
          if (domBids.length === 0 || domAsks.length === 0) {
            recordIssue('DOM', 'Empty Depth Ladder', 'DOM bids or asks not rendered', 'HIGH');
          }
        } else if (p === 'calendar') {
          const calEvents = await page.$$('.calendar-event-card, .calendar-event-row, .cal-item');
          console.log('Calendar events count:', calEvents.length);
          if (calEvents.length === 0) {
            recordIssue('Calendar', 'Empty Calendar', 'No calendar events rendered', 'MEDIUM');
          }
        } else if (p === 'news') {
          const newsItems = await page.$$('.news-feed-card, .news-item, .news-card');
          console.log('News items count:', newsItems.length);
          if (newsItems.length === 0) {
            recordIssue('News', 'Empty News Feed', 'No news cards rendered', 'MEDIUM');
          }
        }
      } else {
        recordIssue('ToolRail', `Missing rail button for ${p}`, `Button .rail-btn[data-panel="${p}"] not found`, 'HIGH');
      }
    }

    // ── 8. Test Bottom Panel Suite ───────────────────────────────────────
    console.log('\n--- 8. Testing Bottom Panel Suite ---');
    const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    
    // First expand bottom panel if collapsed
    const bottomExpandBtn = await page.$('#btn-toggle-bottom-panel');
    if (bottomExpandBtn) {
      await bottomExpandBtn.click();
      await sleep(600);
      await snap('16_bottom_panel_expanded');
    }

    for (const tab of bottomTabs) {
      console.log(`Switching bottom tab: ${tab}...`);
      const tabBtn = await page.$(`.panel-tab[data-view="${tab}"]`);
      if (tabBtn) {
        await tabBtn.click();
        await sleep(800);
        await snap(`17_bottom_${tab}`);

        if (tab === 'pine') {
          // Check pine editor line gutter and templates
          const gutter = await page.$('.line-gutter, .pine-gutter, .editor-gutter');
          const tmplSelect = await page.$('#pine-template-select');
          const backtestBtn = await page.$('#btn-pine-backtest');
          console.log(`Pine: Gutter=${gutter !== null}, TmplSelect=${tmplSelect !== null}, BacktestBtn=${backtestBtn !== null}`);
          
          if (tmplSelect && backtestBtn) {
            await page.select('#pine-template-select', 'rebalance_shannon').catch(() => {});
            await sleep(400);
            await page.evaluate(() => document.querySelector('#btn-pine-backtest')?.click());
            await sleep(1500);
            await snap('18_shannon_strategy_backtested');
          }
        } else if (tab === 'propsim') {
          await page.evaluate(() => document.querySelector('#btn-run-propsim, #btn-run-simulation')?.click());
          await sleep(1200);
          await snap('19_propsim_executed');
        } else if (tab === 'journal') {
          const calDays = await page.$$('.calendar-day-cell, .journal-cell');
          console.log('Journal calendar days rendered:', calDays.length);
        }
      } else {
        recordIssue('BottomPanel', `Missing tab ${tab}`, `.panel-tab[data-view="${tab}"] not found`, 'MEDIUM');
      }
    }

    // ── 9. Test Modals: Compare, Layout, Export, Shortcuts, Settings ────
    console.log('\n--- 9. Testing Secondary Modals ---');
    
    // Compare Modal
    const btnCompare = await page.$('#btn-topbar-compare');
    if (btnCompare) {
      await btnCompare.click();
      await sleep(600);
      await snap('20_modal_compare');
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // Layout Manager Modal
    const btnLayout = await page.$('#btn-layout-manager');
    if (btnLayout) {
      await btnLayout.click();
      await sleep(600);
      await snap('21_modal_layout_manager');
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // Export Modal
    const btnExport = await page.$('#btn-topbar-export');
    if (btnExport) {
      await btnExport.click();
      await sleep(600);
      await snap('22_modal_export_data');
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // Shortcuts Modal
    const btnShortcuts = await page.$('#btn-shortcuts-help');
    if (btnShortcuts) {
      await btnShortcuts.click();
      await sleep(600);
      await snap('23_modal_shortcuts');
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // ── 10. Test Language Switching & Persian RTL/Typography ─────────────
    console.log('\n--- 10. Testing Language Switcher (Persian FA) ---');
    const langBtn = await page.$('#btn-toggle-lang');
    if (langBtn) {
      await langBtn.click();
      await sleep(1000);
      await snap('24_desktop_persian_fa');

      // Check document direction and font
      const htmlDir = await page.$eval('html', el => el.getAttribute('dir'));
      const bodyFont = await page.$eval('body', el => window.getComputedStyle(el).fontFamily);
      console.log(`Persian Switch: dir="${htmlDir}", fontFamily="${bodyFont}"`);
      if (htmlDir !== 'rtl') {
        recordIssue('i18n', 'RTL Direction not set', 'html[dir] is not "rtl" when Persian is active', 'HIGH');
      }
      if (!bodyFont.toLowerCase().includes('vazirmatn')) {
        recordIssue('i18n', 'Vazirmatn font not applied', `font-family is ${bodyFont}`, 'MEDIUM');
      }

      // Check Persian text across navigation and tabs
      const quantLabel = await page.$eval('#nav-label-quant', el => el.textContent.trim()).catch(() => '');
      const journalLabel = await page.$eval('#nav-label-journal', el => el.textContent.trim()).catch(() => '');
      console.log(`Persian labels: Quant="${quantLabel}", Journal="${journalLabel}"`);

      // Switch language back to English for mobile test or keep testing Persian
      await langBtn.click();
      await sleep(600);
    }

    // ── 11. Test Mobile Viewport (390x844 iPhone 14) ──────────────────────
    console.log('\n--- 11. Testing Mobile Viewport (390x844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sleep(1000);
    await snap('25_mobile_viewport_en');

    // Check mobile dock / bottom navigation
    const mobileDock = await page.$('#mobile-bottom-dock, .mobile-dock, #mobile-nav');
    console.log('Mobile dock present:', mobileDock !== null);

    // Switch to Persian on Mobile
    if (langBtn) {
      await langBtn.click();
      await sleep(800);
      await snap('26_mobile_viewport_fa');
    }

  } catch (err) {
    console.error('CRITICAL UNCAUGHT ERROR DURING DOGFOOD:', err);
    recordIssue('Runtime', 'Uncaught Fatal Exception', err.stack || err.message, 'CRITICAL');
  } finally {
    console.log('\n========================================================================');
    console.log(`🏁 AUDIT COMPLETED. Issues: ${issues.length}, Findings: ${findings.length}`);
    console.log(`Console Errors: ${consoleErrors.length}, Page Errors: ${pageErrors.length}`);
    console.log('========================================================================\n');

    const report = {
      timestamp: new Date().toISOString(),
      issues,
      findings,
      consoleErrors,
      pageErrors
    };

    fs.writeFileSync('/root/TradingChart/screenshots/cycle8_dogfood/report.json', JSON.stringify(report, null, 2));
    await page.close();
  }
}

runCycle8Audit().then(() => {
  console.log('Cycle 8 script finished successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal crash in cycle 8:', err);
  process.exit(1);
});
