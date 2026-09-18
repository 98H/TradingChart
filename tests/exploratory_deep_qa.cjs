// tests/exploratory_deep_qa.cjs
// Comprehensive Senior QA Lead Dogfooding Suite (Cycle 2 Verification)
// Evaluates every single surface, panel, modal, interaction, and responsive breakpoint

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/deep_qa_audit_v2';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runDeepAudit() {
  console.log('================================================================');
  console.log('🚀 TRADINGCHART SENIOR QA & PRODUCT DESIGN SUITE (CYCLE 2)');
  console.log('================================================================\n');

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
  const defects = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.error(' [Browser Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error(' [Browser Page Error]', err.message);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push({ url: resp.url(), status: resp.status() });
      console.error(` [HTTP ${resp.status}] ${resp.url()}`);
    }
  });

  async function snap(name) {
    const file = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(` 📸 Saved screenshot: ${name}.png`);
    return file;
  }

  async function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP VIEWPORT INITIAL LOAD (1440x900)
    // -------------------------------------------------------------
    console.log('\n--- 1. Desktop Initial Load & Layout Ergonomics ---');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(3500);
    await snap('01_desktop_initial_load');

    const candleCheck = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      return {
        barsCount: app?.activeBars?.length || 0,
        currentSymbol: app?.currentSymbol,
        currentTimeframe: app?.currentTimeframe,
        hasCanvas: !!document.querySelector('canvas')
      };
    });
    console.log(' Initial State:', candleCheck);
    if (candleCheck.barsCount < 100) {
      defects.push({ id: 'D1', severity: 'Critical', desc: 'Candle count under 100' });
    }

    // -------------------------------------------------------------
    // 2. CHART STYLE PICKER (Candles, Bars, Heikin Ashi, Line, Area, Baseline)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Chart Style Picker Popover ---');
    await page.click('#btn-topbar-chart-style');
    await wait(600);
    await snap('02_style_picker_open');

    const stylePopover = await page.evaluate(() => {
      const el = document.querySelector('#popover-chart-style');
      if (!el) return { visible: false };
      const isVis = el.style.display !== 'none';
      const items = Array.from(el.querySelectorAll('.style-menu-item')).map(it => ({
        id: it.getAttribute('data-style'),
        text: it.innerText.trim().replace(/\n/g, ' ')
      }));
      return { visible: isVis, count: items.length, items };
    });
    console.log(' Style Picker Items:', stylePopover);
    if (!stylePopover.visible || stylePopover.count < 6) {
      defects.push({ id: 'D2', severity: 'High', desc: 'Style picker popover missing or incomplete styles' });
    }

    // Switch to Heikin Ashi
    await page.click('.style-menu-item[data-style="heikinashi"]');
    await wait(600);
    const labelAfterHA = await page.evaluate(() => document.querySelector('#topbar-chart-style-label')?.innerText);
    console.log(' Label after switching to Heikin Ashi:', labelAfterHA);

    // Switch back to Candles
    await page.click('#btn-topbar-chart-style');
    await wait(500);
    await page.click('.style-menu-item[data-style="candles"]');
    await wait(600);

    // -------------------------------------------------------------
    // 3. MULTI-CHART LAYOUT STUDIO
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Layout Studio Modal ---');
    await page.click('#btn-layout-manager');
    await wait(800);
    await snap('03_layout_studio_modal');

    const layoutStudioAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-layout-studio');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const cards = document.querySelectorAll('.layout-preset-card');
      const switches = document.querySelectorAll('.sync-switch-btn');
      return { isOpen, cardCount: cards.length, switchCount: switches.length };
    });
    console.log(' Layout Studio Audit:', layoutStudioAudit);
    if (!layoutStudioAudit.isOpen || layoutStudioAudit.cardCount < 4) {
      defects.push({ id: 'D3', severity: 'High', desc: 'Layout studio modal did not open or has too few presets' });
    }
    await page.click('#btn-close-layout-studio');
    await wait(500);

    // -------------------------------------------------------------
    // 4. COMPARE SYMBOL MODAL
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Compare Symbol Modal ---');
    await page.click('#btn-topbar-compare');
    await wait(800);
    await snap('04_compare_modal');

    const compareAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-compare');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const searchInput = document.querySelector('#compare-search-input');
      const benchmarks = document.querySelectorAll('.compare-item-row');
      return { isOpen, hasInput: !!searchInput, benchmarkCount: benchmarks.length };
    });
    console.log(' Compare Modal Audit:', compareAudit);
    if (!compareAudit.isOpen || compareAudit.benchmarkCount < 5) {
      defects.push({ id: 'D4', severity: 'High', desc: 'Compare modal failed to open or missing benchmark rows' });
    }
    await page.click('#modal-close-compare');
    await wait(500);

    // -------------------------------------------------------------
    // 5. BAR REPLAY CONTROLS & INTERACTIVE SIMULATION
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Bar Replay Engine & Simulated Order Execution ---');
    await page.click('#btn-topbar-replay');
    await wait(800);
    await snap('05_bar_replay_active');

    const replayState = await page.evaluate(() => {
      const bar = document.querySelector('#replay-bar');
      const isVis = bar && bar.classList.contains('visible');
      const playBtn = document.querySelector('#btn-replay-playpause');
      const stepBtn = document.querySelector('#btn-replay-step');
      const buyBtn = document.querySelector('#btn-replay-buy');
      const sellBtn = document.querySelector('#btn-replay-sell');
      return { isVis, hasPlay: !!playBtn, hasStep: !!stepBtn, hasBuy: !!buyBtn, hasSell: !!sellBtn };
    });
    console.log(' Replay Bar State:', replayState);

    // Step forward 3 times
    for (let i = 0; i < 3; i++) {
      await page.click('#btn-replay-step');
      await wait(200);
    }
    // Execute simulated BUY
    await page.click('#btn-replay-buy');
    await wait(400);
    await snap('05_replay_after_buy');

    const posPill = await page.evaluate(() => {
      const pill = document.querySelector('#replay-pos-wrap');
      return { visible: pill && pill.style.display !== 'none', text: pill?.innerText };
    });
    console.log(' Simulated Position Pill:', posPill);

    // Exit replay
    await page.click('#btn-replay-exit');
    await wait(500);

    // -------------------------------------------------------------
    // 6. DATA EXPORT MODAL
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Data Export Modal ---');
    await page.click('#btn-topbar-export');
    await wait(800);
    await snap('06_data_export_modal');

    const exportAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-data-export');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const formatBtns = document.querySelectorAll('.btn-export-format');
      const downloadBtn = document.querySelector('#btn-trigger-download');
      return { isOpen, formatBtnCount: formatBtns.length, hasDownload: !!downloadBtn };
    });
    console.log(' Export Modal Audit:', exportAudit);
    if (!exportAudit.isOpen || !exportAudit.hasDownload) {
      defects.push({ id: 'D6', severity: 'Medium', desc: 'Data export modal failed to open' });
    }
    await page.click('#modal-close-export');
    await wait(500);

    // -------------------------------------------------------------
    // 7. KEYBOARD SHORTCUTS MODAL
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Keyboard Shortcuts Modal ---');
    await page.click('#btn-shortcuts-help');
    await wait(800);
    await snap('07_shortcuts_modal');

    const shortcutsAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-shortcuts');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const rows = document.querySelectorAll('.shortcut-row');
      return { isOpen, rowCount: rows.length };
    });
    console.log(' Shortcuts Modal Audit:', shortcutsAudit);
    if (!shortcutsAudit.isOpen || shortcutsAudit.rowCount < 10) {
      defects.push({ id: 'D7', severity: 'Medium', desc: 'Shortcuts modal failed to open or rows missing' });
    }
    await page.click('#modal-close-shortcuts');
    await wait(500);

    // -------------------------------------------------------------
    // 8. USER PROFILE MODAL (Institutional White-Label Verification)
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing User Profile Modal & White-Label Integrity ---');
    await page.click('.user-avatar-badge');
    await wait(800);
    await snap('08_user_profile_modal');

    const profileAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const text = modal?.innerText || '';
      const hasProperName = /Hussein|Mohammadi|حسین|محمدی/i.test(text);
      const isInstitutional = /Institutional|پورتفوی نهادی/i.test(text);
      return { isOpen, hasProperName, isInstitutional, textHead: text.slice(0, 150) };
    });
    console.log(' User Profile Audit:', profileAudit);
    if (profileAudit.hasProperName) {
      defects.push({ id: 'D8', severity: 'Critical', desc: 'Proper personal name detected in white-label user profile modal' });
    }
    if (!profileAudit.isInstitutional) {
      defects.push({ id: 'D8_inst', severity: 'High', desc: 'White-label institutional title missing from user profile modal' });
    }
    await page.click('#btn-close-user-profile');
    await wait(500);

    // -------------------------------------------------------------
    // 9. QUICK TRADE EXECUTION WIDGET
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Quick Trade Execution Widget ---');
    const qtAudit = await page.evaluate(() => {
      const widget = document.querySelector('#chart-quick-trade');
      const sellPrice = document.querySelector('#quick-sell-price')?.innerText;
      const buyPrice = document.querySelector('#quick-buy-price')?.innerText;
      const isVisible = widget && window.getComputedStyle(widget).display !== 'none';
      return { isVisible, sellPrice, buyPrice };
    });
    console.log(' Quick Trade Widget Audit:', qtAudit);

    // Test BUY order execution
    await page.click('#quick-trade-buy-btn');
    await wait(800);
    await snap('09_quick_trade_executed');

    // -------------------------------------------------------------
    // 10. FLOATING DRAWING TOOLBAR
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Floating Favorite Drawings Toolbar ---');
    const floatBarAudit = await page.evaluate(() => {
      const bar = document.querySelector('#floating-drawing-toolbar');
      if (!bar) return { exists: false };
      const tools = Array.from(bar.querySelectorAll('button')).map(b => ({
        id: b.id,
        tool: b.getAttribute('data-tool'),
        active: b.classList.contains('active')
      }));
      return { exists: true, isVisible: bar.style.display !== 'none', tools };
    });
    console.log(' Floating Drawings Toolbar:', floatBarAudit);

    // -------------------------------------------------------------
    // 11. DESKTOP RIGHT-HAND VERTICAL TOOL RAIL (All 11 Panels)
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Desktop Tool Rail (All 11 Panels) ---');
    const railPanels = [
      'watchlist', 'alerts', 'paper', 'dataWindow', 'objects',
      'pine', 'journal', 'screener', 'dom', 'calendar', 'news'
    ];

    for (const p of railPanels) {
      console.log(` > Testing Rail Button: [${p}]`);
      await page.click(`.rail-btn[data-panel="${p}"]`);
      await wait(1000);
      await snap(`11_rail_panel_${p}`);

      const panelCheck = await page.evaluate((panelName) => {
        const btn = document.querySelector(`.rail-btn[data-panel="${panelName}"]`);
        const isActive = btn?.classList.contains('active');
        return { panelName, buttonActive: isActive };
      }, p);
      console.log(`   Rail [${p}] check:`, panelCheck);
    }

    // -------------------------------------------------------------
    // 12. BOTTOM SUITE TABS (Pine, Strategy, PropSim, Journal, Trackers, Calendar, Screener, News)
    // -------------------------------------------------------------
    console.log('\n--- 12. Testing Collapsible Bottom Suite & Tabs ---');
    // Open bottom panel
    await page.click('#btn-toggle-bottom-panel');
    await wait(800);
    await snap('12_bottom_suite_open');

    const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const t of bottomTabs) {
      console.log(` > Testing Bottom Tab: [${t}]`);
      await page.click(`.panel-tab[data-view="${t}"]`);
      await wait(800);
      await snap(`12_bottom_tab_${t}`);

      const tabState = await page.evaluate((tabName) => {
        const view = document.querySelector(`#view-${tabName}`);
        const isVis = view && view.classList.contains('active');
        return { tabName, hasContent: view?.children.length > 0, isVis };
      }, t);
      console.log(`   Tab [${t}] state:`, tabState);
      if (!tabState.hasContent) {
        defects.push({ id: `D_tab_${t}`, severity: 'High', desc: `Bottom tab [${t}] view container is empty` });
      }
    }

    // Collapse bottom panel
    await page.click('#btn-toggle-bottom-panel');
    await wait(600);

    // -------------------------------------------------------------
    // 13. INDICATORS LIBRARY MODAL (84+ Indicators)
    // -------------------------------------------------------------
    console.log('\n--- 13. Testing Indicators Library Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.open());
    await wait(800);
    await snap('13_indicators_modal');

    const indAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-indicators');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const items = document.querySelectorAll('.ind-card-row');
      const countLabel = document.querySelector('#ind-count-label')?.innerText;
      return { isOpen, count: items.length, countLabel };
    });
    console.log(' Indicators Library Audit:', indAudit);
    if (!indAudit.isOpen || indAudit.count < 80) {
      defects.push({ id: 'D13', severity: 'Critical', desc: `Indicators library missing or less than 80 indicators (found ${indAudit.count})` });
    }

    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.close());
    await wait(500);

    // -------------------------------------------------------------
    // 14. SYMBOL SEARCH & MARKET NAVIGATOR
    // -------------------------------------------------------------
    console.log('\n--- 14. Testing Symbol Search Modal & Real-Time Filtering ---');
    await page.evaluate(() => {
      const modal = document.querySelector('#modal-symbol-search');
      modal?.classList.add('open');
    });
    await wait(600);
    await snap('14_symbol_search_open');

    // Type 'SOL' into search
    await page.type('#symbol-search-input', 'SOL');
    await wait(600);
    await snap('14_symbol_search_sol');

    const symAudit = await page.evaluate(() => {
      const rows = document.querySelectorAll('.sym-search-row');
      return { count: rows.length };
    });
    console.log(' Filtered Symbol Results for SOL:', symAudit);
    if (symAudit.count === 0) {
      defects.push({ id: 'D14', severity: 'High', desc: 'Symbol search returned 0 results for SOL' });
    }

    await page.click('#modal-close-symbol');
    await wait(500);

    // -------------------------------------------------------------
    // 15. SETTINGS MODAL & APPEARANCE PREFERENCES
    // -------------------------------------------------------------
    console.log('\n--- 15. Testing Chart Settings Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.settingsModal?.open());
    await wait(800);
    await snap('15_settings_modal');

    const settingsAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-settings');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const hasBull = !!document.querySelector('#cfg-bull-color');
      const hasBear = !!document.querySelector('#cfg-bear-color');
      const hasWatermark = !!document.querySelector('#cfg-watermark');
      return { isOpen, hasBull, hasBear, hasWatermark };
    });
    console.log(' Settings Modal Audit:', settingsAudit);
    if (!settingsAudit.isOpen || !settingsAudit.hasBull) {
      defects.push({ id: 'D15', severity: 'Medium', desc: 'Settings modal not opening or missing inputs' });
    }
    await page.evaluate(() => window.__TRADING_APP__?.settingsModal?.close());
    await wait(500);

    // -------------------------------------------------------------
    // 16. BILINGUAL PERSIAN MODE & STRICT ZWNJ VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 16. Testing Bilingual Persian (FA) Mode ---');
    await page.click('#btn-toggle-lang');
    await wait(1200);
    await snap('16_persian_desktop_mode');

    const faAudit = await page.evaluate(() => {
      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
      const quantText = document.querySelector('#nav-label-quant')?.innerText;
      const journalText = document.querySelector('#nav-label-journal')?.innerText;
      const panelsText = document.querySelector('#nav-label-panels')?.innerText;
      const styleText = document.querySelector('#topbar-chart-style-label')?.innerText;
      const newsTabText = document.querySelector('#tab-label-news')?.innerText;
      const layoutLabel = document.querySelector('#active-layout-name')?.innerText;

      return { isRtl, quantText, journalText, panelsText, styleText, newsTabText, layoutLabel };
    });
    console.log(' Persian Mode Audit:', faAudit);
    if (!faAudit.isRtl) {
      defects.push({ id: 'D16_rtl', severity: 'High', desc: 'RTL attribute not set on root when Persian selected' });
    }
    if (faAudit.newsTabText !== 'اخبار بازار') {
      defects.push({ id: 'D16_news', severity: 'Medium', desc: `News tab translation incorrect: ${faAudit.newsTabText}` });
    }

    // Switch back to English
    await page.click('#btn-toggle-lang');
    await wait(800);

    // -------------------------------------------------------------
    // 17. MOBILE VIEWPORT (390x844) & RESPONSIVE TOUCH EXPERIENCE
    // -------------------------------------------------------------
    console.log('\n--- 17. Testing Mobile Viewport (390x844) ---');
    // Ensure any open dock panel is closed for clean mobile chart view
    await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      if (app?.chartManager?.openPanelId) {
        app.chartManager.togglePanel(app.chartManager.openPanelId, false);
      }
    });
    await wait(500);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await wait(2000);
    await snap('17_mobile_main_chart');

    const mobileAudit = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const hasHScroll = scrollW > innerW;
      const floatBar = document.querySelector('#floating-drawing-toolbar');
      const floatBarHidden = !floatBar || window.getComputedStyle(floatBar).display === 'none';
      const desktopRail = document.querySelector('#desktop-side-rail');
      const railHidden = !desktopRail || window.getComputedStyle(desktopRail).display === 'none';
      const bottomSuite = document.querySelector('#bottom-panel');
      const bottomHidden = !bottomSuite || window.getComputedStyle(bottomSuite).display === 'none';
      const qtTrigger = document.querySelector('#qt-collapsed-trigger');
      const qtTriggerVisible = qtTrigger && window.getComputedStyle(qtTrigger).display !== 'none';

      return {
        hasHScroll,
        scrollW,
        innerW,
        floatBarHidden,
        railHidden,
        bottomHidden,
        qtTriggerVisible
      };
    });
    console.log(' Mobile Layout Audit:', mobileAudit);
    if (mobileAudit.hasHScroll) {
      defects.push({ id: 'D17_scroll', severity: 'Critical', desc: `Mobile viewport has horizontal scrollbar: ${mobileAudit.scrollW} > ${mobileAudit.innerW}` });
    }
    if (!mobileAudit.floatBarHidden) {
      defects.push({ id: 'D17_floatbar', severity: 'High', desc: 'Floating drawing toolbar visible on mobile screen' });
    }

    // Test mobile + Panels menu
    console.log(' > Testing Mobile Panels Menu Drawer...');
    await page.click('#nav-btn-panels');
    await wait(800);
    await snap('17_mobile_panels_menu');

    const mobileMenuAudit = await page.evaluate(() => {
      const menu = document.querySelector('#modal-panels-menu');
      const isOpen = menu && (menu.classList.contains('open') || menu.classList.contains('active'));
      const items = document.querySelectorAll('.panel-menu-item');
      return { isOpen, itemCount: items.length };
    });
    console.log(' Mobile Panels Menu State:', mobileMenuAudit);
    if (!mobileMenuAudit.isOpen || mobileMenuAudit.itemCount < 10) {
      defects.push({ id: 'D17_menu', severity: 'High', desc: 'Mobile panels menu not opening or missing items' });
    }
    await page.click('#modal-close-panels-menu');
    await wait(600);

  } catch (err) {
    console.error('❌ Exception during audit execution:', err);
    defects.push({ id: 'EXC', severity: 'Critical', desc: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('📋 AUDIT EXECUTION SUMMARY & DEFECT TAXONOMY (CYCLE 2)');
  console.log(`Total Defects Identified: ${defects.length}`);
  console.log(`Console Errors count: ${consoleErrors.length}`);
  console.log(`Page Errors count: ${pageErrors.length}`);
  console.log(`Failed Requests count: ${failedRequests.length}`);
  console.log('Defects List:', JSON.stringify(defects, null, 2));
  console.log('================================================================\n');

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'audit_report_v2.json'),
    JSON.stringify({ defects, consoleErrors, pageErrors, failedRequests }, null, 2)
  );
}

runDeepAudit().catch(console.error);
