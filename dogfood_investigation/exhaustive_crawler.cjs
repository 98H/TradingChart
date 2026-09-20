// dogfood_investigation/exhaustive_crawler.cjs
// Exhaustive Crawler: Tests every single feature, button, modal, panel, and responsive state.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function runExhaustiveCrawler() {
  console.log('>>> Launching Exhaustive QA Crawler on TradingChart <<<');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const findings = [];
  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      console.log(`  [Browser ${msg.type()}]`, msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('  [Browser PageError]', err.message);
  });

  async function snap(name) {
    const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Screenshot: ${name}.png`);
    return p;
  }

  try {
    // 1. Load Application
    console.log('\n=== Step 1: Loading Application ===');
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    await snap('crawler_01_init');

    // 2. Inspect App State
    const appState = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      if (!app) return { initialized: false };
      return {
        initialized: true,
        symbol: app.currentSymbol,
        timeframe: app.currentTimeframe,
        activeBarsCount: app.activeBars ? app.activeBars.length : 0,
        hasChartManager: !!app.chartManager,
        hasWatchlist: !!app.watchlist,
        hasPaperTrading: !!app.paperTrading,
        hasAlerts: !!app.alertsManager,
        hasPineStudio: !!app.pineStudio,
        hasStrategyTester: !!app.strategyTester,
        hasPropFirmSim: !!app.propFirmSim,
        hasTradeJournal: !!app.tradeJournal,
        hasFloatingToolbar: !!app.floatingToolbar,
        hasChartAlertsOverlay: !!app.chartAlertsOverlay,
        hasScaleControls: !!app.scaleControls,
        hasTechnicalScreener: !!app.technicalScreener,
        hasDOM: !!app.depthOfMarket
      };
    });
    console.log('App state:', appState);
    if (!appState.initialized) findings.push({ category: 'Functional', issue: 'window.__TRADING_APP__ is not initialized' });

    // 3. Test Topbar Chart Styles Picker
    console.log('\n=== Step 2: Testing Chart Style Dropdown ===');
    const styleBtn = await page.$('#btn-topbar-chart-style');
    if (styleBtn) {
      await styleBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await snap('crawler_02_chart_style_popover');
      
      // Check options in popover
      const popoverOpts = await page.evaluate(() => {
        const pop = document.querySelector('.chart-style-popover');
        if (!pop) return null;
        return Array.from(pop.querySelectorAll('.chart-style-item')).map(el => ({
          style: el.getAttribute('data-style'),
          text: el.innerText.trim(),
          active: el.classList.contains('active')
        }));
      });
      console.log('Chart style options:', popoverOpts);
      if (!popoverOpts || popoverOpts.length === 0) {
        findings.push({ category: 'UI', issue: 'Chart style popover has no options or did not open' });
      }

      // Close popover
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    } else {
      findings.push({ category: 'UI', issue: '#btn-topbar-chart-style missing' });
    }

    // 4. Test Compare / Overlay Modal
    console.log('\n=== Step 3: Testing Compare Modal ===');
    const compBtn = await page.$('#btn-topbar-compare');
    if (compBtn) {
      await compBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await snap('crawler_03_compare_modal');

      // Check modal content & inputs
      const compModalInfo = await page.evaluate(() => {
        const m = document.querySelector('#modal-compare');
        if (!m) return null;
        return {
          isOpen: m.classList.contains('open'),
          hasInput: !!m.querySelector('input'),
          quickPairs: Array.from(m.querySelectorAll('.quick-pair-btn, .compare-preset-btn')).map(b => b.innerText.trim())
        };
      });
      console.log('Compare modal info:', compModalInfo);

      // Close compare modal
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 5. Test Layout Manager Dropdown
    console.log('\n=== Step 4: Testing Layout Manager Dropdown ===');
    const layoutBtn = await page.$('#btn-layout-manager');
    if (layoutBtn) {
      await layoutBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await snap('crawler_04_layout_dropdown');

      const layoutOpts = await page.evaluate(() => {
        const pop = document.querySelector('.layout-popover, #layout-dropdown');
        if (!pop) return null;
        return Array.from(pop.querySelectorAll('.layout-opt-btn, [data-layout]')).map(b => ({
          layout: b.getAttribute('data-layout'),
          title: b.getAttribute('title') || b.innerText.trim()
        }));
      });
      console.log('Layout options:', layoutOpts);

      // Close
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 6. Test Save Layout Button & Toast
    console.log('\n=== Step 5: Testing Save Layout Toast ===');
    const saveBtn = await page.$('#btn-layout-save');
    if (saveBtn) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const toastVisible = await page.evaluate(() => {
        const t = document.querySelector('.toast-notification, .toast-alert, .notification-toast');
        return t ? { visible: true, text: t.innerText.trim() } : null;
      });
      console.log('Save layout toast feedback:', toastVisible);
      await snap('crawler_05_save_layout_toast');
    }

    // 7. Test Export Modal
    console.log('\n=== Step 6: Testing Export Modal ===');
    const exportBtn = await page.$('#btn-topbar-export');
    if (exportBtn) {
      await exportBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await snap('crawler_06_export_modal');

      const exportModalInfo = await page.evaluate(() => {
        const m = document.querySelector('#modal-data-export');
        return m ? { isOpen: m.classList.contains('open'), text: m.innerText.slice(0, 150) } : null;
      });
      console.log('Export modal info:', exportModalInfo);

      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 8. Test Sound Feedback Toggle
    console.log('\n=== Step 7: Testing Sound Toggle ===');
    const soundBtn = await page.$('#btn-toggle-sound');
    if (soundBtn) {
      const soundStateBefore = await page.evaluate(() => window.__TRADING_APP__?.soundEngine?.enabled);
      await soundBtn.click();
      await new Promise(r => setTimeout(r, 300));
      const soundStateAfter = await page.evaluate(() => window.__TRADING_APP__?.soundEngine?.enabled);
      console.log(`Sound toggled: ${soundStateBefore} -> ${soundStateAfter}`);
    }

    // 9. Test Shortcuts Help Modal
    console.log('\n=== Step 8: Testing Shortcuts Modal ===');
    const shortcutsBtn = await page.$('#btn-shortcuts-help');
    if (shortcutsBtn) {
      await shortcutsBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await snap('crawler_07_shortcuts_modal');

      const shortcutsInfo = await page.evaluate(() => {
        const m = document.querySelector('#modal-shortcuts');
        if (!m) return null;
        return {
          isOpen: m.classList.contains('open'),
          itemCount: m.querySelectorAll('.shortcut-row, .shortcut-item').length
        };
      });
      console.log('Shortcuts modal info:', shortcutsInfo);

      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 10. Test User Profile Modal
    console.log('\n=== Step 9: Testing User Profile Modal ===');
    const userBadge = await page.$('.user-avatar-badge');
    if (userBadge) {
      await userBadge.click();
      await new Promise(r => setTimeout(r, 500));
      await snap('crawler_08_user_profile_modal');

      const profileInfo = await page.evaluate(() => {
        const m = document.querySelector('#modal-user-profile');
        return m ? { isOpen: m.classList.contains('open'), text: m.innerText.slice(0, 100) } : null;
      });
      console.log('User profile modal info:', profileInfo);

      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // 11. Test All Right-Side Rail Panels
    console.log('\n=== Step 10: Testing Right-Side Rail Panels ===');
    const railButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#desktop-side-rail .rail-btn')).map(b => ({
        panel: b.getAttribute('data-panel'),
        title: b.getAttribute('title')
      }));
    });
    console.log('Rail buttons available:', railButtons);

    for (const rb of railButtons) {
      console.log(`Opening rail panel: ${rb.panel} (${rb.title})...`);
      await page.evaluate((panel) => {
        const btn = document.querySelector(`#desktop-side-rail .rail-btn[data-panel="${panel}"]`);
        if (btn) btn.click();
      }, rb.panel);
      await new Promise(r => setTimeout(r, 800));
      await snap(`crawler_09_rail_${rb.panel}`);

      // Check if dock or panel opened and its contents
      const panelState = await page.evaluate((panel) => {
        const dock = document.querySelector('.vela-dock, .side-dock-container');
        const customPanel = document.querySelector(`#dock-panel-${panel}, .panel-${panel}, #view-${panel}`);
        return {
          dockVisible: !!dock && window.getComputedStyle(dock).display !== 'none',
          customPanelFound: !!customPanel,
          bodyTextSample: customPanel ? customPanel.innerText.slice(0, 120).replace(/\n+/g, ' ') : (dock ? dock.innerText.slice(0, 120).replace(/\n+/g, ' ') : '')
        };
      }, rb.panel);
      console.log(`Panel state for ${rb.panel}:`, panelState);
    }

    // 12. Test Bottom Workspace Suite Tabs
    console.log('\n=== Step 11: Testing Bottom Workspace Suite Tabs ===');
    // First expand bottom panel
    await page.evaluate(() => {
      const bottom = document.querySelector('#bottom-panel');
      if (bottom && bottom.classList.contains('collapsed')) {
        const toggleBtn = document.querySelector('#btn-toggle-bottom-panel');
        if (toggleBtn) toggleBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));

    const bottomTabs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#bottom-panel .panel-tab')).map(b => ({
        view: b.getAttribute('data-view'),
        text: b.innerText.trim()
      }));
    });
    console.log('Bottom panel tabs:', bottomTabs);

    for (const tab of bottomTabs) {
      console.log(`Switching bottom tab to: ${tab.view}...`);
      await page.evaluate((view) => {
        const b = document.querySelector(`#bottom-panel .panel-tab[data-view="${view}"]`);
        if (b) b.click();
      }, tab.view);
      await new Promise(r => setTimeout(r, 800));
      await snap(`crawler_10_bottom_${tab.view}`);

      // Check panel content details
      const tabDetail = await page.evaluate((view) => {
        const viewEl = document.querySelector(`#view-${view}`);
        if (!viewEl) return { exists: false };
        return {
          exists: true,
          active: viewEl.classList.contains('active'),
          childCount: viewEl.children.length,
          snippet: viewEl.innerText.slice(0, 120).replace(/\n+/g, ' ')
        };
      }, tab.view);
      console.log(`Tab detail for ${tab.view}:`, tabDetail);
    }

    // 13. Test Quick Trade Widget Interactions
    console.log('\n=== Step 12: Testing Quick Trade Execution Widget ===');
    const qtInfo = await page.evaluate(() => {
      const qt = document.querySelector('#chart-quick-trade');
      if (!qt) return null;
      return {
        visible: window.getComputedStyle(qt).display !== 'none',
        sellPrice: document.querySelector('#quick-sell-price')?.innerText.trim(),
        buyPrice: document.querySelector('#quick-buy-price')?.innerText.trim(),
        qty: document.querySelector('#quick-trade-qty')?.value
      };
    });
    console.log('Quick Trade Widget status:', qtInfo);

    // Click Buy button in Quick Trade
    const buyBtn = await page.$('#quick-trade-buy-btn');
    if (buyBtn) {
      await buyBtn.click();
      await new Promise(r => setTimeout(r, 600));
      const tradeFeedback = await page.evaluate(() => {
        const toast = document.querySelector('.toast-notification, .toast-alert');
        const pos = window.__TRADING_APP__?.paperTrading?.positions;
        return {
          toast: toast ? toast.innerText.trim() : null,
          openPositions: pos ? Object.keys(pos) : []
        };
      });
      console.log('Quick trade execution result:', tradeFeedback);
      await snap('crawler_11_quick_trade_executed');
    }

    // 14. Test Floating Drawing Toolbar Snapping & Magnet
    console.log('\n=== Step 13: Testing Floating Drawing Toolbar ===');
    const floatTools = await page.evaluate(() => {
      const tb = document.querySelector('#floating-drawing-toolbar');
      if (!tb) return null;
      return Array.from(tb.querySelectorAll('.fav-tool-btn')).map(b => ({
        tool: b.getAttribute('data-tool'),
        active: b.classList.contains('active'),
        title: b.getAttribute('title')
      }));
    });
    console.log('Floating tools available:', floatTools);

    // 15. Test Bilingual Mode (Persian RTL)
    console.log('\n=== Step 14: Testing Persian RTL Mode Deeply ===');
    const langBtn = await page.$('#btn-toggle-lang');
    if (langBtn) {
      await langBtn.click();
      await new Promise(r => setTimeout(r, 1200));
      await snap('crawler_12_persian_full_view');

      // Audit RTL properties and translations
      const rtlAudit = await page.evaluate(() => {
        const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
        const bodyHasPersianClass = document.body.classList.contains('persian-mode');
        const quantLabel = document.querySelector('#nav-label-quant')?.innerText;
        const journalLabel = document.querySelector('#nav-label-journal')?.innerText;
        const panelsLabel = document.querySelector('#nav-label-panels')?.innerText;
        const styleLabel = document.querySelector('#topbar-chart-style-label')?.innerText;
        const compareLabel = document.querySelector('#topbar-compare-label')?.innerText;
        const saveLabel = document.querySelector('#layout-save-label')?.innerText;
        const replayLabel = document.querySelector('#topbar-replay-label')?.innerText;
        const exportLabel = document.querySelector('#topbar-export-label')?.innerText;
        
        return {
          isRtl,
          bodyHasPersianClass,
          navPills: { quantLabel, journalLabel, panelsLabel },
          topbar: { styleLabel, compareLabel, saveLabel, replayLabel, exportLabel }
        };
      });
      console.log('Persian RTL audit results:', rtlAudit);

      if (!rtlAudit.isRtl) {
        findings.push({ category: 'i18n', issue: 'document.documentElement dir is not rtl in Persian mode' });
      }

      // Check settings modal in Persian mode
      await page.evaluate(() => {
        window.__TRADING_APP__?.settingsModal?.open();
      });
      await new Promise(r => setTimeout(r, 600));
      await snap('crawler_13_persian_settings');

      // Check tab names in settings modal
      const settingsTabs = await page.evaluate(() => {
        const m = document.querySelector('#modal-settings');
        if (!m) return null;
        return Array.from(m.querySelectorAll('.settings-tab-btn')).map(b => b.innerText.trim());
      });
      console.log('Settings modal tabs in Persian:', settingsTabs);

      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));

      // Switch back to English
      await langBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // 16. Test Mobile Viewport (390x844) & Responsive Layout
    console.log('\n=== Step 15: Testing Mobile Viewport (390x844) ===');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1200));
    await snap('crawler_14_mobile_viewport');

    const mobileElements = await page.evaluate(() => {
      const topbar = document.querySelector('#top-app-header');
      const sideRail = document.querySelector('#desktop-side-rail');
      const bottomPanel = document.querySelector('#bottom-panel');
      const quickTrade = document.querySelector('#chart-quick-trade');
      const floatingToolbar = document.querySelector('#floating-drawing-toolbar');

      const isHidden = (el) => {
        if (!el) return true;
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
      };

      return {
        topbarVisible: !isHidden(topbar),
        sideRailHidden: isHidden(sideRail),
        bottomPanelHidden: isHidden(bottomPanel),
        quickTradeHiddenOrMobile: isHidden(quickTrade),
        floatingToolbarHiddenOrMobile: isHidden(floatingToolbar)
      };
    });
    console.log('Mobile responsive visibility:', mobileElements);

    // 17. Check for Canvas Context Menu
    console.log('\n=== Step 16: Testing Canvas Context Menu Coordinates & Items ===');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const canvas = document.querySelector('#main-chart-canvas, #chart-container canvas, canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const evt = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        canvas.dispatchEvent(evt);
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await snap('crawler_15_context_menu');

    const contextMenuInfo = await page.evaluate(() => {
      const menu = document.querySelector('.canvas-context-menu, #chart-canvas-context-menu');
      if (!menu) return null;
      return {
        isOpen: menu.style.display !== 'none',
        items: Array.from(menu.querySelectorAll('.context-menu-item')).map(i => i.innerText.trim())
      };
    });
    console.log('Context menu info:', contextMenuInfo);

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

  } catch (err) {
    console.error('Crawler failed with error:', err);
    findings.push({ category: 'Runtime', issue: err.message, stack: err.stack });
  } finally {
    console.log('\n=== QA Crawler Final Audit Report ===');
    console.log(`Findings count: ${findings.length}`);
    console.log(`Console issues: ${consoleLogs.length}`);
    console.log(`Page errors: ${pageErrors.length}`);

    fs.writeFileSync(
      path.join(__dirname, 'exhaustive_findings.json'),
      JSON.stringify({ findings, consoleLogs, pageErrors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runExhaustiveCrawler().catch(e => {
  console.error('Crawler fatal error:', e);
  process.exit(1);
});
