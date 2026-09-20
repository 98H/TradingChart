// dogfood_investigation/audit_cycle1.cjs
// Cycle 1: Comprehensive Exploratory Browser Dogfooding
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runCycle1() {
  console.log('>>> [CYCLE 1] Starting Comprehensive Exploratory QA Audit on TradingChart <<<');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

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

  async function takeSnap(name) {
    const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`  [Screenshot] Saved: ${name}.png`);
    return p;
  }

  try {
    // 1. Initial Load & Desktop View
    console.log('\n--- 1. Testing Initial Load & Desktop Layout ---');
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await takeSnap('01_desktop_initial_load');

    const title = await page.title();
    console.log('Page title:', title);

    // Verify canvas exists and is visible
    const canvasVisible = await page.evaluate(() => {
      const c = document.querySelector('#main-chart-canvas, #chart-container canvas, .chart-canvas, canvas');
      return !!c && c.getBoundingClientRect().width > 200;
    });
    console.log('Chart Canvas Rendered & Visible:', canvasVisible);
    if (!canvasVisible) issues.push('Chart Canvas not rendered or width <= 200px');

    // 2. Test Topbar Modals and Affordances
    console.log('\n--- 2. Testing Topbar Modals and Affordances ---');

    // 2.1 Symbol Search Modal
    console.log('Testing Symbol Search...');
    const symbolBtn = await page.$('#symbol-search-btn, button[data-action="symbol-search"], .symbol-btn');
    if (symbolBtn) {
      await symbolBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('02_symbol_search_modal');
      
      // Type in search
      const searchInput = await page.$('#symbol-search-input, .symbol-search-modal input');
      if (searchInput) {
        await searchInput.type('ETH', { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
        await takeSnap('02b_symbol_search_eth');
      } else {
        issues.push('Symbol search input field missing inside search modal');
      }

      // Close modal (Escape or close button)
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
    } else {
      issues.push('Symbol Search button not found in topbar');
    }

    // 2.2 Timeframe Dropdown / Custom Timeframe
    console.log('Testing Timeframe controls...');
    const tfBtns = await page.$$('.tf-btn, [data-tf]');
    console.log('Timeframe quick buttons found:', tfBtns.length);

    // Test Custom Timeframe modal if button exists
    const customTfBtn = await page.$('#custom-tf-btn, [data-action="custom-tf"]');
    if (customTfBtn) {
      await customTfBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('03_custom_timeframe_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.3 Chart Style Dropdown
    console.log('Testing Chart Style Dropdown...');
    const styleBtn = await page.$('#chart-style-picker-btn, #chart-style-btn, [data-action="chart-style"]');
    if (styleBtn) {
      await styleBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('04_chart_style_dropdown');
      
      // Click Heikin Ashi or Bars
      const styleOptions = await page.$$('.chart-style-option, [data-style]');
      console.log('Chart style options count:', styleOptions.length);
      if (styleOptions.length > 0) {
        // click back to close or select
        await page.keyboard.press('Escape');
      }
      await new Promise(r => setTimeout(r, 300));
    } else {
      issues.push('Chart style selector button not found');
    }

    // 2.4 Indicators Modal
    console.log('Testing Indicators Modal...');
    const indBtn = await page.$('#indicators-modal-btn, [data-action="indicators"], #open-indicators-btn');
    if (indBtn) {
      await indBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('05_indicators_modal_open');

      // Check indicator search & category filters
      const indSearch = await page.$('#indicator-search-input, .indicators-modal input');
      if (indSearch) {
        await indSearch.type('SMC', { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
        await takeSnap('05b_indicators_modal_search_smc');
      }
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
    } else {
      issues.push('Indicators modal button missing in topbar');
    }

    // 2.5 Compare Modal
    console.log('Testing Compare Modal...');
    const compareBtn = await page.$('#compare-modal-btn, [data-action="compare"]');
    if (compareBtn) {
      await compareBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('06_compare_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.6 Layout Selector (Multi-chart)
    console.log('Testing Layout Selector...');
    const layoutBtn = await page.$('#layout-picker-btn, #layout-btn, [data-action="layouts"]');
    if (layoutBtn) {
      await layoutBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('07_layout_picker_dropdown');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.7 Screenshot / Share Studio Modal
    console.log('Testing Screenshot & Share Studio...');
    const screenshotBtn = await page.$('#screenshot-btn, [data-action="screenshot"]');
    if (screenshotBtn) {
      await screenshotBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('08_screenshot_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.8 Settings Modal
    console.log('Testing Chart Settings Modal...');
    const settingsBtn = await page.$('#chart-settings-btn, #settings-btn, [data-action="settings"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('09_settings_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.9 Shortcuts Modal
    console.log('Testing Shortcuts Modal...');
    const shortcutsBtn = await page.$('#shortcuts-btn, [data-action="shortcuts"]');
    if (shortcutsBtn) {
      await shortcutsBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('10_shortcuts_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 2.10 User Profile Modal
    console.log('Testing User Profile Modal...');
    const profileBtn = await page.$('#user-profile-btn, [data-action="profile"]');
    if (profileBtn) {
      await profileBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('11_user_profile_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 3. Testing Bottom Panels (Vela Panels)
    console.log('\n--- 3. Testing Bottom Workspace Panels ---');
    const panelTabs = await page.$$('.bottom-panel-tab, .vela-tab, [data-panel-target]');
    console.log('Bottom workspace tabs found:', panelTabs.length);
    
    // Inspect each tab
    const tabsToTest = [
      'pine-studio',
      'strategy-tester',
      'prop-firm',
      'paper-trading',
      'trade-journal',
      'technical-screener',
      'economic-calendar',
      'market-trackers',
      'market-news',
      'depth-of-market'
    ];

    for (const tabName of tabsToTest) {
      const tab = await page.$(`[data-panel="${tabName}"], [data-panel-target="${tabName}"], #tab-${tabName}`);
      if (tab) {
        await tab.click();
        await new Promise(r => setTimeout(r, 600));
        await takeSnap(`12_panel_${tabName}`);
      } else {
        console.log(`Tab for ${tabName} not directly matched by simple selector, checking buttons...`);
      }
    }

    // 4. Testing Right Sidebar (Watchlist, Alerts, Object Tree)
    console.log('\n--- 4. Testing Right Sidebar ---');
    const rightNavBtns = await page.$$('.right-toolbar-btn, .sidebar-nav-btn, [data-sidebar-tab]');
    console.log('Right sidebar tabs found:', rightNavBtns.length);
    for (let i = 0; i < rightNavBtns.length; i++) {
      try {
        await rightNavBtns[i].click();
        await new Promise(r => setTimeout(r, 500));
        await takeSnap(`13_right_sidebar_tab_${i}`);
      } catch (e) {
        // ignore click error if obscured
      }
    }

    // 5. Testing Left Drawing Toolbar & Floating Favorites
    console.log('\n--- 5. Testing Left Drawing Toolbar & Favorites ---');
    const drawTools = await page.$$('.drawing-tool-btn, [data-tool]');
    console.log('Drawing tool buttons count:', drawTools.length);
    await takeSnap('14_drawing_toolbar');

    // 6. Testing Canvas Context Menu
    console.log('\n--- 6. Testing Canvas Context Menu ---');
    const chartBox = await page.evaluate(() => {
      const el = document.querySelector('#main-chart-canvas, #chart-container, .chart-canvas');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (chartBox) {
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('15_canvas_context_menu');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 7. Testing Bar Replay Bar
    console.log('\n--- 7. Testing Bar Replay Bar ---');
    const replayBtn = await page.$('#bar-replay-btn, [data-action="replay"]');
    if (replayBtn) {
      await replayBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('16_bar_replay_active');
      
      // Close replay
      const closeReplay = await page.$('#replay-exit-btn, .replay-close-btn');
      if (closeReplay) await closeReplay.click();
      else await replayBtn.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // 8. Testing Bilingual Persian (FA) Toggle & RTL Layout
    console.log('\n--- 8. Testing Persian RTL Mode ---');
    const langBtn = await page.$('#lang-toggle-btn, [data-action="toggle-lang"]');
    if (langBtn) {
      await langBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('17_persian_rtl_mode');

      // Check dir attribute
      const htmlDir = await page.evaluate(() => document.documentElement.dir);
      console.log('HTML dir in Persian mode:', htmlDir);
      if (htmlDir !== 'rtl') {
        issues.push(`Expected html dir='rtl' in Persian mode, found: '${htmlDir}'`);
      }

      // Check RTL styling and fonts
      const fontCheck = await page.evaluate(() => {
        const bodyFont = window.getComputedStyle(document.body).fontFamily;
        return bodyFont;
      });
      console.log('Body font family in Persian mode:', fontCheck);

      // Open a few modals in Persian mode to verify RTL alignment
      if (settingsBtn) {
        await settingsBtn.click();
        await new Promise(r => setTimeout(r, 500));
        await takeSnap('18_persian_settings_modal');
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
      }

      if (indBtn) {
        await indBtn.click();
        await new Promise(r => setTimeout(r, 500));
        await takeSnap('19_persian_indicators_modal');
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      issues.push('Language toggle button not found');
    }

    // 9. Testing Light Theme Mode
    console.log('\n--- 9. Testing Light Theme Mode ---');
    const themeBtn = await page.$('#theme-toggle-btn, [data-action="toggle-theme"]');
    if (themeBtn) {
      await themeBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await takeSnap('20_light_theme_mode');

      // Toggle back to dark theme
      await themeBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // 10. Testing Mobile Viewport (390x844)
    console.log('\n--- 10. Testing Mobile Viewport (390x844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 800));
    await takeSnap('21_mobile_viewport_390x844');

    // Check mobile navigation drawer / bottom dock
    const mobileDock = await page.$('.mobile-dock, #mobile-nav-bar, .mobile-bottom-nav');
    console.log('Mobile dock present:', !!mobileDock);

    // Open mobile symbol search
    const mobSearch = await page.$('.mobile-symbol-btn, [data-action="mobile-search"]');
    if (mobSearch) {
      await mobSearch.click();
      await new Promise(r => setTimeout(r, 500));
      await takeSnap('22_mobile_search_modal');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

  } catch (err) {
    console.error('Fatal error during Cycle 1 audit:', err);
    issues.push(`Audit fatal error: ${err.message}`);
  } finally {
    console.log('\n========================================');
    console.log('Audit Summary:');
    console.log('Issues identified:', issues.length);
    console.log('Console errors:', consoleErrors.length);
    console.log('Page errors:', pageErrors.length);
    console.log('========================================');
    
    fs.writeFileSync(
      path.join(__dirname, 'audit_cycle1_results.json'),
      JSON.stringify({ issues, consoleErrors, pageErrors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runCycle1().catch(e => {
  console.error('Run failed:', e);
  process.exit(1);
});
