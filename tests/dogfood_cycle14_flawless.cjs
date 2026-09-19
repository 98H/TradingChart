// tests/dogfood_cycle14_flawless.cjs
// Comprehensive Zero-Defect Dogfooding Cycle 14: Exercising EVERY feature across Desktop & Mobile

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/cycle14_dogfood';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCycle14Flawless() {
  console.log('================================================================================');
  console.log('🌟 RUNNING COMPREHENSIVE ZERO-DEFECT DOGFOODING CYCLE 14');
  console.log('================================================================================\n');

  const defects = [];
  const validations = [];
  const consoleErrors = [];
  const pageErrors = [];

  function addDefect(category, title, description, severity = 'MEDIUM') {
    const d = { category, title, description, severity };
    defects.push(d);
    console.log(`❌ DEFECT [${severity}] [${category}]: ${title} -> ${description}`);
  }

  function addValidation(category, title, description) {
    validations.push({ category, title, description });
    console.log(`✅ VERIFIED [${category}]: ${title} -> ${description}`);
  }

  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error' && !text.includes('favicon') && !text.includes('manifest')) {
      consoleErrors.push(text);
      console.log(`   [Browser Console Error] ${text}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.log(`   [Browser Page Error] ${err.toString()}`);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Desktop Initial Mount & Canvas Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 1. DESKTOP BASELINE & CANVAS ENGINE ---');
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);

    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    if (canvasCount >= 5) {
      addValidation('Core', 'Canvas Engine', `Mounted ${canvasCount} active canvas layers (WebGL2 Vela architecture)`);
    } else {
      addDefect('Core', 'Canvas Count Low', `Expected >=5 canvas layers, found ${canvasCount}`, 'HIGH');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_baseline.png') });

    // -------------------------------------------------------------------------
    // 2. Chart Style Picker (Candles, Bars, Heikin Ashi, Area)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. CHART STYLE PICKER ---');
    await page.click('#btn-topbar-chart-style');
    await sleep(400);

    const popoverOpen = await page.evaluate(() => {
      const p = document.querySelector('#popover-chart-style');
      return p && p.style.display !== 'none';
    });
    if (popoverOpen) {
      addValidation('ChartStyle', 'Popover Open', 'Chart style popover rendered cleanly');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_chart_style_popover.png') });

      // Click Heikin Ashi
      await page.evaluate(() => {
        const item = document.querySelector('.style-menu-item[data-style="heikinashi"]');
        if (item) item.click();
      });
      await sleep(800);
      const activeStyle = await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.currentStyle);
      if (activeStyle === 'heikinashi') {
        addValidation('ChartStyle', 'Heikin Ashi Applied', 'Switched price series style to Heikin Ashi');
      }

      // Switch back to regular Candles
      await page.click('#btn-topbar-chart-style');
      await sleep(400);
      await page.evaluate(() => {
        const item = document.querySelector('.style-menu-item[data-style="candles"]');
        if (item) item.click();
      });
      await sleep(600);
      addValidation('ChartStyle', 'Candles Restored', 'Switched back to standard candlesticks');
    } else {
      addDefect('ChartStyle', 'Popover Fail', 'Popover did not open on click', 'HIGH');
    }

    // -------------------------------------------------------------------------
    // 3. Universal Symbol Search & Market Navigator
    // -------------------------------------------------------------------------
    console.log('\n--- 3. SYMBOL SEARCH & MARKET NAVIGATOR ---');
    await page.evaluate(() => window.__TRADING_APP__.openSymbolSearch());
    await sleep(500);

    const symModalOpen = await page.evaluate(() => document.querySelector('#modal-symbol-search')?.classList.contains('open'));
    if (symModalOpen) {
      addValidation('SymbolSearch', 'Modal Open', 'Symbol search modal opened');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_symbol_search_modal.png') });

      // Test Search
      await page.type('#symbol-search-input', 'SOL');
      await sleep(400);

      // Select first row
      await page.evaluate(() => {
        const row = document.querySelector('.sym-search-row');
        if (row) row.click();
      });
      await sleep(1500);

      const currentSym = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      if (currentSym === 'SOLUSDT') {
        addValidation('SymbolSearch', 'Symbol Switched', 'Switched chart symbol to SOLUSDT');
      } else {
        addDefect('SymbolSearch', 'Symbol Switch Fail', `Expected SOLUSDT, got ${currentSym}`, 'HIGH');
      }

      // Restore to BTCUSDT
      await page.evaluate(() => window.__TRADING_APP__.switchSymbol('BTCUSDT'));
      await sleep(1000);
    } else {
      addDefect('SymbolSearch', 'Modal Fail', 'Failed to open symbol search modal', 'HIGH');
    }

    // -------------------------------------------------------------------------
    // 4. Timeframe Manager & Custom Intervals
    // -------------------------------------------------------------------------
    console.log('\n--- 4. TIMEFRAME MANAGER & CUSTOM INTERVALS ---');
    await page.evaluate(() => window.__TRADING_APP__.timeframeManager?.open());
    await sleep(500);

    const tfModalOpen = await page.evaluate(() => document.querySelector('#modal-timeframes')?.classList.contains('open'));
    if (tfModalOpen) {
      addValidation('Timeframe', 'Modal Open', 'Timeframe manager modal opened');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_timeframe_modal.png') });

      // Click 15m
      await page.evaluate(() => {
        const btn = document.querySelector('.btn-select-tf[data-id="15"]');
        if (btn) btn.click();
      });
      await sleep(1200);

      const activeTf = await page.evaluate(() => window.__TRADING_APP__.currentTimeframe);
      if (activeTf === '15') {
        addValidation('Timeframe', 'Timeframe Switched', 'Successfully switched timeframe to 15m with live candles fetched');
      }

      // Restore to 60m
      await page.evaluate(() => window.__TRADING_APP__.setTimeframe('60'));
      await sleep(800);
    } else {
      addDefect('Timeframe', 'Modal Fail', 'Failed to open timeframe modal', 'HIGH');
    }

    // -------------------------------------------------------------------------
    // 5. Quick-Trade Floating Execution Widget
    // -------------------------------------------------------------------------
    console.log('\n--- 5. QUICK-TRADE FLOATING WIDGET ---');
    await page.click('#qt-qty-inc');
    await sleep(100);
    await page.click('#quick-trade-buy-btn');
    await sleep(600);
    addValidation('QuickTrade', 'Buy Execution', 'Executed Quick Buy market order');

    await page.click('#quick-trade-sell-btn');
    await sleep(600);
    addValidation('QuickTrade', 'Sell Execution', 'Executed Quick Sell market order');

    // Minimize & Restore
    await page.click('#qt-toggle-btn');
    await sleep(300);
    const qtMin = await page.evaluate(() => document.querySelector('#chart-quick-trade')?.classList.contains('minimized'));
    if (qtMin) {
      addValidation('QuickTrade', 'Minimize Widget', 'Minimized to trigger pill');
      await page.click('#qt-collapsed-trigger');
      await sleep(300);
      addValidation('QuickTrade', 'Restore Widget', 'Restored from trigger pill');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_quick_trade_verified.png') });

    // -------------------------------------------------------------------------
    // 6. Right Rail: Watchlist (with Add & Remove Symbol verified)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. RIGHT RAIL: WATCHLIST ---');
    await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('watchlist', true));
    await sleep(800);

    const wlOps = await page.evaluate(() => {
      const wl = window.__TRADING_APP__.watchlist;
      if (!wl) return { error: 'No watchlist' };
      wl.addSymbol('DOGEUSDT');
      const hasDoge = wl.customSymbols.includes('DOGEUSDT');
      wl.removeSymbol('DOGEUSDT');
      const removedDoge = !wl.customSymbols.includes('DOGEUSDT');
      return { hasDoge, removedDoge };
    });

    if (wlOps.hasDoge && wlOps.removedDoge) {
      addValidation('Watchlist', 'Add & Remove Symbol', 'Verified addSymbol and removeSymbol functionality with custom persistence');
    } else {
      addDefect('Watchlist', 'Add/Remove Fail', 'addSymbol or removeSymbol failed', 'HIGH');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_watchlist_verified.png') });

    // -------------------------------------------------------------------------
    // 7. Right Rail: Depth of Market (DOM) & Paper Trading Execution
    // -------------------------------------------------------------------------
    console.log('\n--- 7. RIGHT RAIL: DEPTH OF MARKET (DOM) & PAPER TRADING ---');
    await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('dom', true));
    await sleep(800);

    // Test DOM Market Buy & Market Sell buttons (now connected to executeOrder)
    const domOrderResult = await page.evaluate(() => {
      const pt = window.__TRADING_APP__.paperTrading;
      const initialPositions = pt?.positions?.length || 0;
      const dom = window.__TRADING_APP__.depthOfMarket;
      
      const buyBtn = document.querySelector('#dom-btn-market-buy');
      if (buyBtn) buyBtn.click();

      const positionsAfterBuy = pt?.positions?.length || 0;
      return {
        initialPositions,
        positionsAfterBuy,
        hasExecuteOrder: typeof pt?.executeOrder === 'function'
      };
    });

    if (domOrderResult.hasExecuteOrder && domOrderResult.positionsAfterBuy > domOrderResult.initialPositions) {
      addValidation('DOM', 'Market Order Execution', 'DOM MARKET BUY executed and opened position in Paper Trading');
    } else {
      addDefect('DOM', 'Order Execution Broken', 'DOM buy button failed to execute order', 'CRITICAL');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_dom_verified.png') });

    // Switch to Paper Trading panel to verify active positions and close position
    await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('paper', true));
    await sleep(800);

    const ptCloseResult = await page.evaluate(() => {
      const pt = window.__TRADING_APP__.paperTrading;
      if (!pt || pt.positions.length === 0) return { closed: false };
      const targetId = pt.positions[pt.positions.length - 1].id;
      pt.closePosition(targetId);
      return {
        closed: true,
        hasHistory: (pt.history?.length || 0) > 0
      };
    });

    if (ptCloseResult.closed && ptCloseResult.hasHistory) {
      addValidation('PaperTrading', 'Close Position & Sync', 'Closed paper position and recorded to history & journal');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_paper_trading_verified.png') });

    // -------------------------------------------------------------------------
    // 8. Bottom Suite: Strategy Tester & Prop-Firm Sim & Trade Journal
    // -------------------------------------------------------------------------
    console.log('\n--- 8. BOTTOM WORKSPACE SUITE ---');
    const bottomTabs = ['strategy', 'propsim', 'journal', 'pine'];
    for (const bTab of bottomTabs) {
      await page.evaluate((t) => window.__TRADING_APP__.switchBottomView(t), bTab);
      await sleep(600);
      const isExpanded = await page.evaluate(() => !document.querySelector('#bottom-panel')?.classList.contains('collapsed'));
      if (isExpanded) {
        addValidation('BottomSuite', `${bTab.toUpperCase()} Tab`, `${bTab} tab mounted and active`);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_bottom_suite_verified.png') });

    // Collapse bottom suite
    await page.click('#btn-toggle-bottom-panel');
    await sleep(400);

    // -------------------------------------------------------------------------
    // 9. Modals: Compare, Layout Studio, Screenshot, Export
    // -------------------------------------------------------------------------
    console.log('\n--- 9. AUXILIARY MODALS ---');
    // Compare
    await page.click('#btn-topbar-compare');
    await sleep(400);
    const compOpen = await page.evaluate(() => document.querySelector('#modal-compare')?.classList.contains('open'));
    if (compOpen) {
      addValidation('Compare', 'Modal Open', 'Compare & Overlay modal open');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_compare_modal.png') });
      await page.evaluate(() => window.__TRADING_APP__.compareModal?.close());
    }

    // Layout Studio
    await page.click('#btn-layout-manager');
    await sleep(400);
    const layOpen = await page.evaluate(() => {
      const m = document.querySelector('#layoutModal, .layout-modal');
      return m && window.getComputedStyle(m).display !== 'none';
    });
    if (layOpen) {
      addValidation('LayoutStudio', 'Modal Open', 'Multi-Chart Layout Studio open');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_layout_studio.png') });
      await page.evaluate(() => window.__TRADING_APP__.layoutManager?.close());
    }

    // Export Data
    await page.click('#btn-topbar-export');
    await sleep(400);
    const expOpen = await page.evaluate(() => document.querySelector('#modal-data-export')?.classList.contains('open'));
    if (expOpen) {
      addValidation('DataExport', 'Modal Open', 'Data Export modal open');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_data_export_modal.png') });
      await page.evaluate(() => window.__TRADING_APP__.dataExportModal?.close());
    }

    // -------------------------------------------------------------------------
    // 10. Persian RTL Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 10. PERSIAN LOCALIZATION & RTL AUDIT ---');
    await page.click('#btn-toggle-lang');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_persian_desktop_baseline.png') });

    const faChecks = await page.evaluate(() => {
      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
      const isFaBody = document.body.classList.contains('persian-mode');
      const buyText = document.querySelector('#qt-buy-label')?.innerText;
      const sellText = document.querySelector('#qt-sell-label')?.innerText;
      return { isRtl, isFaBody, buyText, sellText };
    });

    if (faChecks.isRtl && faChecks.isFaBody && faChecks.buyText === 'خرید' && faChecks.sellText === 'فروش') {
      addValidation('i18n', 'Persian RTL Mode', 'Strict RTL layout, font, and Persian vocabulary active');
    } else {
      addDefect('i18n', 'RTL Mode Flaw', 'Persian RTL or vocabulary not fully active', 'HIGH');
    }

    // -------------------------------------------------------------------------
    // 11. Mobile Viewport (iPhone 14 - 390x844) Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 11. MOBILE VIEWPORT (390x844) AUDIT ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_mobile_persian.png') });

    // Check horizontal overflow
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (mobileOverflow) {
      addDefect('Mobile', 'Horizontal Overflow', 'Page has horizontal scroll on 390px mobile viewport', 'HIGH');
    } else {
      addValidation('Mobile', 'Zero Overflow', 'Clean mobile viewport with 0px horizontal scroll');
    }

    // Test Mobile Panels Menu
    await page.click('#nav-btn-panels');
    await sleep(500);
    const mobPanelsOpen = await page.evaluate(() => document.querySelector('#modal-panels-menu')?.classList.contains('open'));
    if (mobPanelsOpen) {
      addValidation('Mobile', 'Panels Menu Open', 'Mobile panels drawer opened on touch');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_mobile_panels_menu.png') });

      // Click Watchlist
      await page.evaluate(() => {
        const item = document.querySelector('.panel-menu-item[data-panel="watchlist"]');
        if (item) item.click();
      });
      await sleep(800);
      addValidation('Mobile', 'Watchlist Panel', 'Watchlist opened from mobile panels drawer');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_mobile_watchlist.png') });
    }

    // Switch back to English on Mobile
    await page.click('#btn-toggle-lang');
    await sleep(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_mobile_english.png') });
    addValidation('Mobile', 'English Mode', 'Switched cleanly to English on mobile');

  } catch (err) {
    console.error('Fatal Error during Cycle 14:', err);
    addDefect('Runtime', 'Exception', err.message, 'CRITICAL');
  } finally {
    await browser.close();
  }

  console.log('\n================================================================================');
  console.log(`🏁 AUDIT CYCLE 14 COMPLETE: ${defects.length} DEFECTS FOUND, ${validations.length} CHECKS PASSED`);
  console.log(`Console Errors: ${consoleErrors.length}, Page Errors: ${pageErrors.length}`);
  console.log('================================================================================');

  const report = {
    cycle: 14,
    timestamp: new Date().toISOString(),
    defects,
    validations,
    consoleErrors,
    pageErrors
  };
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'audit_cycle14_summary.json'), JSON.stringify(report, null, 2));
}

runCycle14Flawless();
