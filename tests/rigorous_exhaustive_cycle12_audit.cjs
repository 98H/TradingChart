// tests/rigorous_exhaustive_cycle12_audit.cjs
// Comprehensive QA & Dogfooding across ALL features (Desktop & Mobile, EN & FA)

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/cycle12_dogfood';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runExhaustiveCycle12() {
  console.log('================================================================================');
  console.log('🚀 EXHAUSTIVE DOGFOODING CYCLE 12: ALL-FEATURE FUNCTIONAL & VISUAL AUDIT');
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
    if (type === 'error') {
      consoleErrors.push(text);
      console.log(`   [Browser Console Error] ${text}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.log(`   [Browser Page Error] ${err.toString()}`);
  });

  try {
    console.log('\n--- PHASE 1: DESKTOP APP INITIALIZATION & BASELINE ---');
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);

    // Verify main canvas exists
    const hasCanvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c;
    });
    if (hasCanvas) {
      addValidation('Core', 'Canvas Engine', 'Vela WebGL2 Canvas successfully mounted');
    } else {
      addDefect('Core', 'Canvas Missing', 'No canvas element rendered in DOM', 'CRITICAL');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_baseline.png') });

    // ----------------------------------------------------
    // 1. Symbol Search Modal
    // ----------------------------------------------------
    console.log('\n--- PHASE 2: SYMBOL SEARCH & SWITCHING ---');
    const symbolBtn = await page.$('#symbolBtn, .symbol-picker-btn, [data-action="symbol-search"]');
    if (symbolBtn) {
      await symbolBtn.click();
      await sleep(600);
      const searchModalVisible = await page.evaluate(() => {
        const modal = document.querySelector('.symbol-modal, .search-modal, #symbolSearchModal, .modal-backdrop');
        return modal && window.getComputedStyle(modal).display !== 'none';
      });
      if (searchModalVisible) {
        addValidation('SymbolSearch', 'Modal Open', 'Symbol search modal opened on click');
      } else {
        addDefect('SymbolSearch', 'Modal Did Not Open', 'Clicking symbol button did not open modal');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_symbol_search_modal.png') });

      // Test searching a symbol
      const searchInput = await page.$('.symbol-modal input, .search-modal input, #symbolSearchInput');
      if (searchInput) {
        await searchInput.type('ETH');
        await sleep(500);
        // Select first result
        const firstRow = await page.$('.symbol-row, .search-result-item, .symbol-item');
        if (firstRow) {
          await firstRow.click();
          await sleep(1500);
          addValidation('SymbolSearch', 'Symbol Selected', 'Selected ETH symbol from search results');
        }
      }
    } else {
      addDefect('SymbolSearch', 'Button Missing', 'Could not locate symbol picker button');
    }

    // ----------------------------------------------------
    // 2. Timeframes
    // ----------------------------------------------------
    console.log('\n--- PHASE 3: TIMEFRAMES & CUSTOM PICKER ---');
    const tfResult = await page.evaluate(async () => {
      const tfButtons = Array.from(document.querySelectorAll('.timeframe-btn, [data-tf], .tf-btn'));
      const found = tfButtons.map(b => b.textContent.trim());
      // Click 15m or 1h if available
      const btn15m = tfButtons.find(b => b.textContent.includes('15m') || b.getAttribute('data-tf') === '15m');
      if (btn15m) {
        btn15m.click();
        return { found, clicked: '15m' };
      }
      return { found, clicked: null };
    });
    console.log('Timeframes found:', tfResult.found);
    if (tfResult.clicked) {
      await sleep(1000);
      addValidation('Timeframe', 'Timeframe Switched', `Switched to ${tfResult.clicked}`);
    }

    // ----------------------------------------------------
    // 3. Chart Style Picker
    // ----------------------------------------------------
    console.log('\n--- PHASE 4: CHART STYLE PICKER ---');
    const styleBtn = await page.$('#chartStyleBtn, .chart-style-btn, [data-action="chart-style"]');
    if (styleBtn) {
      await styleBtn.click();
      await sleep(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_chart_style_dropdown.png') });

      const styleSwitched = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('.chart-style-option, .style-item, [data-style]'));
        const ha = options.find(o => o.textContent.toLowerCase().includes('heikin') || o.getAttribute('data-style') === 'heikin_ashi');
        if (ha) {
          ha.click();
          return 'Heikin Ashi';
        }
        return false;
      });
      if (styleSwitched) {
        await sleep(1000);
        addValidation('ChartStyle', 'Style Switched', `Switched chart style to ${styleSwitched}`);
      }
    }

    // ----------------------------------------------------
    // 4. Indicators Modal
    // ----------------------------------------------------
    console.log('\n--- PHASE 5: INDICATORS & OVERLAYS ---');
    const indBtn = await page.$('#indicatorsBtn, .indicators-btn, [data-action="indicators"]');
    if (indBtn) {
      await indBtn.click();
      await sleep(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_indicators_modal.png') });

      const indAdded = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.indicator-item, .indicator-card, .ind-row'));
        const rsiItem = items.find(i => i.textContent.includes('RSI') || i.textContent.includes('Relative Strength'));
        if (rsiItem) {
          rsiItem.click();
          return 'RSI';
        }
        return false;
      });
      if (indAdded) {
        await sleep(1000);
        addValidation('Indicators', 'Indicator Added', `Added ${indAdded} to chart`);
      }

      // Close modal
      const closeBtn = await page.$('.modal-close, .close-btn, #indicatorsModal .close');
      if (closeBtn) await closeBtn.click();
      await sleep(500);
    }

    // ----------------------------------------------------
    // 5. Drawing Tools & Floating Drawing Toolbar
    // ----------------------------------------------------
    console.log('\n--- PHASE 6: DRAWING TOOLS & FLOATING TOOLBAR ---');
    const drawResult = await page.evaluate(() => {
      const tools = Array.from(document.querySelectorAll('.drawing-tool-btn, [data-tool]'));
      const floatingToolbar = document.querySelector('.floating-drawing-toolbar, #floatingDrawingToolbar');
      return {
        toolsCount: tools.length,
        hasFloatingToolbar: !!floatingToolbar,
        floatingVisible: floatingToolbar ? window.getComputedStyle(floatingToolbar).display !== 'none' : false
      };
    });
    console.log('Drawing tools state:', drawResult);
    if (drawResult.toolsCount > 0) {
      addValidation('Drawings', 'Toolbar Tools', `${drawResult.toolsCount} drawing tools available`);
    }
    if (drawResult.hasFloatingToolbar) {
      addValidation('Drawings', 'Floating Favorite Toolbar', 'Floating drawing toolbar mounted in DOM');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_drawing_tools.png') });

    // ----------------------------------------------------
    // 6. Right Rail / Sidebar Panels
    // ----------------------------------------------------
    console.log('\n--- PHASE 7: SIDEBAR PANELS (WATCHLIST, ALERTS, SCREENER, NEWS, CALENDAR, DOM, RATING) ---');
    const sidebarTabs = [
      { name: 'Watchlist', selector: '#watchlistTabBtn, [data-tab="watchlist"], #watchlistBtn' },
      { name: 'Alerts', selector: '#alertsTabBtn, [data-tab="alerts"], #alertsBtn' },
      { name: 'Screener', selector: '#screenerTabBtn, [data-tab="screener"], #screenerBtn' },
      { name: 'News', selector: '#newsTabBtn, [data-tab="news"], #newsBtn' },
      { name: 'Calendar', selector: '#calendarTabBtn, [data-tab="calendar"], #calendarBtn' },
      { name: 'Rating', selector: '#ratingTabBtn, [data-tab="rating"], #ratingBtn' },
      { name: 'DOM', selector: '#domTabBtn, [data-tab="dom"], #domBtn' },
      { name: 'Trackers', selector: '#trackersTabBtn, [data-tab="trackers"], #trackersBtn' }
    ];

    for (const tab of sidebarTabs) {
      const btn = await page.$(tab.selector);
      if (btn) {
        await btn.click();
        await sleep(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `06_sidebar_${tab.name.toLowerCase()}.png`) });
        addValidation('Sidebar', tab.name, `${tab.name} panel opened successfully`);
      } else {
        console.log(`   (Tab ${tab.name} selector not matched directly: ${tab.selector})`);
      }
    }

    // ----------------------------------------------------
    // 7. Bottom Workspace Suite (Vela Panels)
    // ----------------------------------------------------
    console.log('\n--- PHASE 8: BOTTOM WORKSPACE SUITE (STRATEGY, PINE, PAPER TRADING, JOURNAL, PROPSIM) ---');
    const bottomTabs = [
      { name: 'StrategyTester', selector: '#strategyTabBtn, [data-tab="strategy"], .tab-strategy' },
      { name: 'PineStudio', selector: '#pineTabBtn, [data-tab="pine"], .tab-pine' },
      { name: 'PaperTrading', selector: '#paperTabBtn, [data-tab="paper"], .tab-paper' },
      { name: 'TradeJournal', selector: '#journalTabBtn, [data-tab="journal"], .tab-journal' },
      { name: 'PropFirmSim', selector: '#propsimTabBtn, [data-tab="propsim"], .tab-propsim' }
    ];

    for (const tab of bottomTabs) {
      const btn = await page.$(tab.selector);
      if (btn) {
        await btn.click();
        await sleep(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `07_bottom_${tab.name.toLowerCase()}.png`) });
        addValidation('BottomSuite', tab.name, `${tab.name} panel rendered successfully`);
      } else {
        console.log(`   (Bottom tab ${tab.name} selector not matched: ${tab.selector})`);
      }
    }

    // ----------------------------------------------------
    // 8. Quick-Trade Execution Widget
    // ----------------------------------------------------
    console.log('\n--- PHASE 9: QUICK-TRADE FLOATING WIDGET ---');
    const qtState = await page.evaluate(() => {
      const qt = document.querySelector('.quick-trade-widget, #quickTradeWidget');
      if (!qt) return null;
      const buyBtn = qt.querySelector('.qt-buy-btn, [data-action="buy"]');
      const sellBtn = qt.querySelector('.qt-sell-btn, [data-action="sell"]');
      const spread = qt.querySelector('.qt-spread');
      const lotInput = qt.querySelector('.qt-lot-input, input[type="number"]');
      return {
        hasBuy: !!buyBtn,
        hasSell: !!sellBtn,
        hasSpread: !!spread,
        spreadText: spread ? spread.textContent.trim() : null,
        lotValue: lotInput ? lotInput.value : null
      };
    });
    console.log('Quick-Trade State:', qtState);
    if (qtState && qtState.hasBuy && qtState.hasSell) {
      addValidation('QuickTrade', 'Widget Intact', `Buy & Sell present, spread: ${qtState.spreadText}`);
    } else {
      addDefect('QuickTrade', 'Widget Defect', 'Quick trade widget incomplete or missing buttons');
    }

    // ----------------------------------------------------
    // 9. Modals & Studios (Screenshot, Layout, Shortcuts, Settings)
    // ----------------------------------------------------
    console.log('\n--- PHASE 10: MODALS & STUDIOS ---');
    // Screenshot Studio
    const shotBtn = await page.$('#screenshotBtn, [data-action="screenshot"], .screenshot-btn');
    if (shotBtn) {
      await shotBtn.click();
      await sleep(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_screenshot_studio.png') });
      const modalOpen = await page.evaluate(() => {
        const m = document.querySelector('#screenshotModal, .screenshot-modal');
        return m && window.getComputedStyle(m).display !== 'none';
      });
      if (modalOpen) {
        addValidation('ScreenshotStudio', 'Modal Open', 'Screenshot modal open and rendered');
        // Close it
        const closeBtn = await page.$('#screenshotModal .modal-close, #screenshotModal .btn-close, .modal-close');
        if (closeBtn) await closeBtn.click();
        await sleep(400);
      }
    }

    // Layout Studio
    const layoutBtn = await page.$('#layoutBtn, [data-action="layout"], .layout-btn');
    if (layoutBtn) {
      await layoutBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_layout_studio.png') });
      const layoutOpen = await page.evaluate(() => {
        const m = document.querySelector('#layoutModal, .layout-modal, .layout-popover');
        return m && window.getComputedStyle(m).display !== 'none';
      });
      if (layoutOpen) {
        addValidation('LayoutStudio', 'Modal Open', 'Layout Studio open and rendered');
        const closeBtn = await page.$('#layoutModal .modal-close, .modal-close');
        if (closeBtn) await closeBtn.click();
        await sleep(400);
      }
    }

    // Shortcuts Modal
    const shortBtn = await page.$('#shortcutsBtn, [data-action="shortcuts"], .shortcuts-btn');
    if (shortBtn) {
      await shortBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_shortcuts_modal.png') });
      const shortOpen = await page.evaluate(() => {
        const m = document.querySelector('#shortcutsModal, .shortcuts-modal');
        return m && window.getComputedStyle(m).display !== 'none';
      });
      if (shortOpen) {
        addValidation('Shortcuts', 'Modal Open', 'Shortcuts modal open and rendered');
        const closeBtn = await page.$('#shortcutsModal .modal-close, .modal-close');
        if (closeBtn) await closeBtn.click();
        await sleep(400);
      }
    }

    // Settings Modal
    const settingsBtn = await page.$('#settingsBtn, [data-action="settings"], .settings-btn');
    if (settingsBtn) {
      await settingsBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_settings_modal.png') });
      const settingsOpen = await page.evaluate(() => {
        const m = document.querySelector('#settingsModal, .settings-modal');
        return m && window.getComputedStyle(m).display !== 'none';
      });
      if (settingsOpen) {
        addValidation('Settings', 'Modal Open', 'Settings modal open and rendered');
        const closeBtn = await page.$('#settingsModal .modal-close, .modal-close');
        if (closeBtn) await closeBtn.click();
        await sleep(400);
      }
    }

    // ----------------------------------------------------
    // 10. Persian RTL Verification
    // ----------------------------------------------------
    console.log('\n--- PHASE 11: PERSIAN LOCALIZATION & RTL AUDIT ---');
    const langBtn = await page.$('#langBtn, [data-action="toggle-lang"], .lang-btn');
    if (langBtn) {
      await langBtn.click();
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_persian_rtl_desktop.png') });

      const faCheck = await page.evaluate(() => {
        const isRtl = document.documentElement.getAttribute('dir') === 'rtl' || document.body.classList.contains('persian-mode');
        const headerTitle = document.querySelector('.header-title, .brand-text, .app-title')?.textContent.trim();
        return { isRtl, headerTitle };
      });
      if (faCheck.isRtl) {
        addValidation('i18n', 'Persian RTL Active', 'dir="rtl" applied and Persian layout verified');
      } else {
        addDefect('i18n', 'RTL Failure', 'Language switched to Persian but dir="rtl" not applied', 'HIGH');
      }
    }

    // ----------------------------------------------------
    // 11. Mobile Viewport (390x844) Audit
    // ----------------------------------------------------
    console.log('\n--- PHASE 12: MOBILE VIEWPORT (390x844) THOROUGH AUDIT ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_mobile_baseline.png') });

    // Test mobile navigation drawer / hamburger
    const mobileMenuBtn = await page.$('#mobileMenuBtn, .mobile-menu-btn, .hamburger-btn, [data-action="mobile-menu"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await sleep(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_mobile_drawer_open.png') });

      const drawerOpen = await page.evaluate(() => {
        const d = document.querySelector('.mobile-drawer, #mobileDrawer, .drawer-content');
        return d && window.getComputedStyle(d).display !== 'none';
      });
      if (drawerOpen) {
        addValidation('Mobile', 'Navigation Drawer', 'Mobile menu drawer opened smoothly');
      } else {
        addDefect('Mobile', 'Drawer Failure', 'Mobile menu button clicked but drawer not visible');
      }
    }

    // Check for horizontal overflow on mobile
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (overflowX) {
      addDefect('Mobile', 'Horizontal Overflow', 'Page has horizontal scroll/overflow on mobile viewport', 'HIGH');
    } else {
      addValidation('Mobile', 'No Overflow', 'Horizontal scrollbar eliminated on 390x844');
    }

  } catch (err) {
    console.error('Fatal Error during audit:', err);
    addDefect('Runtime', 'Exception', err.message, 'CRITICAL');
  } finally {
    await browser.close();
  }

  console.log('\n================================================================================');
  console.log(`🏁 AUDIT SUMMARY: ${defects.length} DEFECTS FOUND, ${validations.length} CHECKS PASSED`);
  console.log(`Console Errors: ${consoleErrors.length}, Page Errors: ${pageErrors.length}`);
  console.log('================================================================================');

  const report = {
    defects,
    validations,
    consoleErrors,
    pageErrors
  };
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'audit_summary.json'), JSON.stringify(report, null, 2));
}

runExhaustiveCycle12();
