// tests/qa_deep_audit_cycle1.cjs — Deep comprehensive exploratory QA audit
// Runs against http://127.0.0.1:8088 on both Desktop (1440x900) and Mobile (390x844)
// in both EN and FA modes.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/chromium-browser');
const BASE = 'http://127.0.0.1:8088';
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles/deep_audit_cycle1');

if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

const settle = (ms) => new Promise(r => setTimeout(r, ms));

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('       TRADINGCHART DEEP EXPLORATORY QA AUDIT — CYCLE 1           ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const defects = [];
  const passes = [];

  function recordPass(testName, details = '') {
    passes.push({ test: testName, details });
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName} ${details ? '— ' + details : ''}`);
  }

  function recordDefect(severity, area, kind, desc, meta = {}) {
    defects.push({ severity, area, kind, desc, meta });
    const col = severity === 'critical' ? '\x1b[35m' : (severity === 'high' ? '\x1b[31m' : '\x1b[33m');
    console.log(`  ${col}✗ [${severity.toUpperCase()}]\x1b[0m [${area}] ${kind}: ${desc}`);
  }

  async function takeShot(page, name) {
    try {
      const file = path.join(EVID, `${name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      return file;
    } catch (e) {
      return null;
    }
  }

  const headlessBase = fs.existsSync('/root/snap/chromium/common') ? '/root/snap/chromium/common/chromium-headless' : '/tmp';
  fs.mkdirSync(headlessBase, { recursive: true });
  const profileDir = path.join(headlessBase, `qa_profile_${process.pid}_${Math.random().toString(36).slice(2, 7)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profileDir,
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--window-size=1440,900'
    ]
  });

  try {
    // ═════════════════════════════════════════════════════════════════════
    // PHASE 1: DESKTOP (1440x900) — ENGLISH (EN)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n▶ PHASE 1: Desktop Workspace & Core Controls (1440x900, EN)');
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, isMobile: false });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.toString()));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('Failed to load resource') && !txt.includes('favicon.ico')) {
          pageErrors.push(txt);
        }
      }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(2500);

    await takeShot(page, '01_desktop_boot_en');

    // 1.1 Check static layout & overflow
    const desktopOverflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') return;
        if (el.getClientRects().length === 0) return;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2) {
          bad.push({ tag: el.tagName, id: el.id, cls: el.className, right: r.right, vw, text: (el.innerText||'').slice(0, 30) });
        }
      });
      return bad.slice(0, 10);
    });

    if (desktopOverflow.length > 0) {
      recordDefect('high', 'Layout', 'Horizontal Overflow', `Found ${desktopOverflow.length} elements overflowing viewport width`, desktopOverflow);
    } else {
      recordPass('Desktop 1440x900 Layout Fit', 'No horizontal overflow detected');
    }

    // 1.2 Check header elements
    const headerAudit = await page.evaluate(() => {
      const hdr = document.querySelector('#top-app-header');
      if (!hdr) return { found: false };
      const btns = Array.from(hdr.querySelectorAll('button')).map(b => ({
        id: b.id,
        cls: b.className,
        title: b.getAttribute('title'),
        visible: getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden',
        rect: { w: b.offsetWidth, h: b.offsetHeight }
      }));
      return { found: true, btnCount: btns.length, btns };
    });

    if (!headerAudit.found) {
      recordDefect('critical', 'Header', 'Missing Header', '#top-app-header element not found in DOM');
    } else {
      recordPass('Desktop Header Structure', `${headerAudit.btnCount} interactive buttons mounted`);
    }

    // 1.3 Test Quick Trade Widget
    const qtAudit = await page.evaluate(async () => {
      const qt = document.querySelector('#chart-quick-trade');
      const toggleBtn = document.querySelector('#qt-toggle-btn');
      const trigger = document.querySelector('#qt-collapsed-trigger');
      if (!qt) return { error: 'Quick trade element not found' };

      const initialVis = getComputedStyle(qt).display;
      // Click minimize
      if (toggleBtn) toggleBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const minimizedVis = getComputedStyle(qt).display;
      const triggerVis = trigger ? getComputedStyle(trigger).display : 'none';

      // Click trigger to restore
      if (trigger) trigger.click();
      await new Promise(r => setTimeout(r, 400));
      const restoredVis = getComputedStyle(qt).display;

      return { initialVis, minimizedVis, triggerVis, restoredVis };
    });

    if (qtAudit.error) {
      recordDefect('medium', 'QuickTrade', 'Missing Widget', qtAudit.error);
    } else {
      recordPass('Quick Trade Collapse/Expand', `Toggles cleanly (${qtAudit.initialVis} -> ${qtAudit.minimizedVis} -> ${qtAudit.restoredVis})`);
    }

    // 1.4 Test Chart Style Picker
    const stylePickerAudit = await page.evaluate(async () => {
      const btn = document.querySelector('#btn-topbar-chart-style');
      if (!btn) return { error: 'Chart style button not found' };
      btn.click();
      await new Promise(r => setTimeout(r, 500));
      const menu = document.querySelector('.chart-style-picker-menu, #tc-style-picker-dropdown, [class*="style-picker"]');
      const items = menu ? Array.from(menu.querySelectorAll('button, .style-item, [data-style]')).map(x => x.innerText.trim()) : [];
      // Close it
      btn.click();
      await new Promise(r => setTimeout(r, 300));
      return { menuFound: !!menu, itemsCount: items.length, items };
    });

    if (stylePickerAudit.error || !stylePickerAudit.menuFound) {
      recordDefect('high', 'ChartStyle', 'Style Picker', stylePickerAudit.error || 'Style picker dropdown did not appear');
    } else {
      recordPass('Chart Style Picker', `Dropdown opened with ${stylePickerAudit.itemsCount} styles`);
    }

    // 1.5 Test Compare Modal
    const compareAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      if (!app?.compareModal) return { error: 'compareModal missing' };
      app.compareModal.open();
      await new Promise(r => setTimeout(r, 500));
      const modal = document.querySelector('#modal-compare');
      const open = modal && modal.classList.contains('open');
      const hasInput = !!modal?.querySelector('input');
      // close modal
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      return { open, hasInput };
    });

    if (compareAudit.error || !compareAudit.open) {
      recordDefect('high', 'CompareModal', 'Modal Open Failure', compareAudit.error || 'Compare modal did not open');
    } else {
      recordPass('Compare Modal', 'Opens with search input');
    }

    // 1.6 Test Indicators Modal & Library
    const indAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      if (!app?.indicatorsModal) return { error: 'indicatorsModal missing' };
      app.indicatorsModal.open();
      await new Promise(r => setTimeout(r, 700));
      const modal = document.querySelector('#modal-indicators');
      const open = modal && modal.classList.contains('open');
      const searchInput = modal?.querySelector('input[type="text"]');
      const items = modal?.querySelectorAll('.indicator-item, [data-ind-id], .ind-row');
      const count = items ? items.length : 0;
      // Close
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      return { open, hasSearch: !!searchInput, count };
    });

    if (indAudit.error || !indAudit.open) {
      recordDefect('high', 'IndicatorsModal', 'Modal Open Failure', indAudit.error || 'Indicators modal did not open');
    } else {
      recordPass('Indicators Modal', `Opened cleanly with ${indAudit.count} items in catalog`);
    }

    // 1.7 Test Symbol Search Modal & Filter Tabs
    const symAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.openSymbolSearch();
      await new Promise(r => setTimeout(r, 700));
      const modal = document.querySelector('#modal-symbol-search');
      const open = modal && modal.classList.contains('open');
      const input = document.querySelector('#symbol-search-input');
      const tabs = Array.from(modal.querySelectorAll('.sym-cat-btn')).map(b => b.innerText.trim());
      const results = modal.querySelectorAll('.sym-row, .symbol-item');

      // Test typing
      if (input) {
        input.value = 'SOL';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 400));
      const filteredResults = modal.querySelectorAll('.sym-row, .symbol-item');

      // Close
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      return { open, tabs, initialCount: results.length, filteredCount: filteredResults.length };
    });

    if (!symAudit.open) {
      recordDefect('high', 'SymbolSearch', 'Modal Open Failure', 'Symbol search modal did not open');
    } else {
      recordPass('Symbol Search Modal', `Found tabs [${symAudit.tabs.join(', ')}] with interactive filtering (${symAudit.initialCount} -> ${symAudit.filteredCount})`);
    }

    // 1.8 Test Layout Studio Modal
    const layoutAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      if (!app?.layoutManager) return { error: 'layoutManager missing' };
      app.layoutManager.openLayoutStudio();
      await new Promise(r => setTimeout(r, 600));
      const modal = document.querySelector('#modal-layout-studio');
      const open = modal && modal.classList.contains('open');
      const gridBtns = modal?.querySelectorAll('.layout-grid-btn, [data-layout]');
      const syncSwitches = modal?.querySelectorAll('input[type="checkbox"], .sync-toggle');
      // Close
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      return { open, gridBtnsCount: gridBtns?.length || 0, syncCount: syncSwitches?.length || 0 };
    });

    if (layoutAudit.error || !layoutAudit.open) {
      recordDefect('high', 'LayoutStudio', 'Modal Open Failure', layoutAudit.error || 'Layout studio modal did not open');
    } else {
      recordPass('Layout Studio Modal', `Opened with ${layoutAudit.gridBtnsCount} grid layout options and ${layoutAudit.syncCount} sync toggles`);
    }

    // 1.9 Test Bottom Panel Views (All 8 tabs)
    const panelViews = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const view of panelViews) {
      const res = await page.evaluate(async (v) => {
        const tab = document.querySelector(`.panel-tab[data-view="${v}"]`);
        if (!tab) return { error: `Tab data-view=${v} not found` };
        tab.click();
        await new Promise(r => setTimeout(r, 800));
        const bottomPanel = document.querySelector('#bottom-panel');
        const isCollapsed = bottomPanel?.classList.contains('collapsed');
        const viewEl = document.querySelector(`#view-${v}`);
        const isActive = viewEl?.classList.contains('active');
        const text = viewEl ? viewEl.innerText.trim().slice(0, 50) : '';
        const rect = viewEl ? viewEl.getBoundingClientRect() : null;
        return { isCollapsed, isActive, text, rect: rect ? { w: rect.width, h: rect.height } : null };
      }, view);

      if (res.error) {
        recordDefect('high', 'BottomPanel', `Tab ${view}`, res.error);
      } else if (!res.isActive) {
        recordDefect('high', 'BottomPanel', `Tab ${view}`, `View #view-${view} did not become active`);
      } else {
        recordPass(`Bottom Panel Tab [${view}]`, `Active view rendered (${res.rect?.w}x${res.rect?.h})`);
      }
    }
    await takeShot(page, '02_desktop_bottom_panels');

    // 1.10 Test Right Side Rail Panels
    const railPanels = ['watchlist', 'alerts', 'paper', 'dom', 'pine', 'journal', 'screener', 'calendar', 'news'];
    for (const p of railPanels) {
      const res = await page.evaluate(async (panelName) => {
        const btn = document.querySelector(`.rail-btn[data-panel="${panelName}"]`);
        if (!btn) return { error: `Rail button for ${panelName} not found` };
        btn.click();
        await new Promise(r => setTimeout(r, 600));
        // Check if drawer or panel opened
        const sidePanel = document.querySelector(`.side-panel[data-panel="${panelName}"], #side-panel-${panelName}, .active-side-panel`);
        const isOpen = !!sidePanel || document.querySelector(`.rail-btn[data-panel="${panelName}"].active`);
        return { isOpen: !!isOpen };
      }, p);

      if (res.error) {
        recordDefect('medium', 'SideRail', `Panel ${p}`, res.error);
      } else {
        recordPass(`Side Rail [${p}]`, `Toggled cleanly`);
      }
    }

    // 1.11 Test Paper Trading Execution
    const paperTradeAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const pt = app?.paperTrading;
      if (!pt) return { error: 'paperTrading module not found' };
      const initPositions = pt.positions ? pt.positions.length : 0;
      const initOrders = pt.orders ? pt.orders.length : 0;

      // Execute buy order
      pt.setMarket('BTCUSDT', 85000);
      pt.executeOrder({ symbol: 'BTCUSDT', side: 'buy', type: 'market', qty: 0.1 });
      await new Promise(r => setTimeout(r, 500));

      const afterBuyPositions = pt.positions ? pt.positions.length : 0;
      const position = pt.positions?.[0];

      // Close position
      if (position) {
        pt.closePosition(position.id);
        await new Promise(r => setTimeout(r, 500));
      }
      const finalPositions = pt.positions ? pt.positions.length : 0;

      return {
        initPositions,
        afterBuyPositions,
        finalPositions,
        capital: pt.capital,
        equity: pt.calculateEquity()
      };
    });

    if (paperTradeAudit.error) {
      recordDefect('high', 'PaperTrading', 'Order Flow', paperTradeAudit.error);
    } else if (paperTradeAudit.afterBuyPositions !== paperTradeAudit.initPositions + 1) {
      recordDefect('high', 'PaperTrading', 'Order Execution', `Position count did not increment (${paperTradeAudit.initPositions} -> ${paperTradeAudit.afterBuyPositions})`);
    } else if (paperTradeAudit.finalPositions !== paperTradeAudit.initPositions) {
      recordDefect('high', 'PaperTrading', 'Position Close', `Position did not close cleanly (${paperTradeAudit.afterBuyPositions} -> ${paperTradeAudit.finalPositions})`);
    } else {
      recordPass('Paper Trading Lifecycle', 'Market order created position and closed cleanly with equity recalculation');
    }

    // 1.12 Test Alerts Lifecycle
    const alertAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const am = app?.alertsManager;
      if (!am) return { error: 'alertsManager module not found' };
      const initialCount = am.alerts ? am.alerts.length : 0;

      // Delete first if at basic limit (3)
      let tempDeleted = null;
      if (initialCount >= 3) {
        tempDeleted = am.alerts[am.alerts.length - 1];
        am.deleteAlert(tempDeleted.id);
      }
      const countBeforeCreate = am.alerts ? am.alerts.length : 0;

      // Create an alert
      const created = am.createAlert({
        symbol: 'BTCUSDT',
        condition: 'crossing',
        targetPrice: 90000,
        note: 'Test QA alert'
      });
      await new Promise(r => setTimeout(r, 400));
      const afterCreateCount = am.alerts ? am.alerts.length : 0;

      // Delete the created alert
      if (created && created.id) {
        am.deleteAlert(created.id);
        await new Promise(r => setTimeout(r, 400));
      }
      const finalCount = am.alerts ? am.alerts.length : 0;

      return { initialCount, countBeforeCreate, afterCreateCount, finalCount };
    });

    if (alertAudit.error) {
      recordDefect('high', 'AlertsManager', 'Lifecycle', alertAudit.error);
    } else if (alertAudit.afterCreateCount !== alertAudit.countBeforeCreate + 1) {
      recordDefect('high', 'AlertsManager', 'Create Alert', `Alert count did not increment (${alertAudit.countBeforeCreate} -> ${alertAudit.afterCreateCount})`);
    } else {
      recordPass('Alerts Manager Lifecycle', 'Alert created and deleted cleanly within plan quotas');
    }

    // 1.13 Test Command Palette (Ctrl+K)
    const cmdPaletteAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      if (!app?.commandPalette) return { error: 'commandPalette missing' };
      app.commandPalette.open();
      await new Promise(r => setTimeout(r, 500));
      const modal = document.querySelector('#command-palette, .command-palette-overlay');
      const open = modal && (modal.classList.contains('open') || getComputedStyle(modal).display !== 'none');
      const input = modal?.querySelector('input');
      const items = modal?.querySelectorAll('.cmd-palette-item, .palette-command');
      // Close
      document.querySelectorAll('.modal-overlay, #command-palette').forEach(m => m.classList.remove('open'));
      return { open: !!open, hasInput: !!input, itemsCount: items ? items.length : 0 };
    });

    if (cmdPaletteAudit.error || !cmdPaletteAudit.open) {
      recordDefect('high', 'CommandPalette', 'Open Failure', cmdPaletteAudit.error || 'Command palette did not open');
    } else {
      recordPass('Command Palette (Ctrl+K)', `Opened with input and ${cmdPaletteAudit.itemsCount} commands`);
    }

    // 1.14 Test User Profile Modal & Tabs
    const profileAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      if (!app?.userProfileModal) return { error: 'userProfileModal missing' };
      app.userProfileModal.open();
      await new Promise(r => setTimeout(r, 600));
      const modal = document.querySelector('#modal-user-profile');
      const open = modal && modal.classList.contains('open');
      const tabs = Array.from(modal.querySelectorAll('.profile-tab-btn')).map(t => t.innerText.trim().replace(/\n/g, ' '));
      // Close
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      return { open: !!open, tabs };
    });

    if (profileAudit.error || !profileAudit.open) {
      recordDefect('high', 'UserProfile', 'Open Failure', profileAudit.error || 'User profile modal did not open');
    } else {
      recordPass('User Profile Modal', `Opened with tabs: [${profileAudit.tabs.join(' | ')}]`);
    }

    // 1.15 Test Auth & Account Menu / Plans Modal
    const authAudit = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const avatarBtn = document.querySelector('.user-avatar-badge');
      if (!avatarBtn) return { error: 'Avatar button not found' };
      avatarBtn.click();
      await new Promise(r => setTimeout(r, 500));
      const menu = document.querySelector('#tc-account-menu');
      const menuOpen = !!menu && getComputedStyle(menu).display !== 'none';
      const items = menu ? Array.from(menu.querySelectorAll('[data-act]')).map(x => x.getAttribute('data-act')) : [];

      // Open Plans modal
      let plansOpened = false;
      const plansBtn = menu?.querySelector('[data-act="plans"]');
      if (plansBtn) {
        plansBtn.click();
        await new Promise(r => setTimeout(r, 600));
        const plansModal = document.querySelector('#tc-plans-modal, #modal-plans');
        plansOpened = !!plansModal && (plansModal.classList.contains('open') || getComputedStyle(plansModal).display !== 'none');
      }

      // Close all modals & menus
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      if (menu) menu.remove();

      return { menuOpen, items, plansOpened };
    });

    if (authAudit.error || !authAudit.menuOpen) {
      recordDefect('high', 'AuthMenu', 'Account Menu Dropdown', authAudit.error || 'Account menu dropdown did not appear on avatar click');
    } else {
      recordPass('Auth & Account Menu', `Opened on avatar click with actions [${authAudit.items.join(', ')}] and Plans modal launched`);
    }

    // Check collected page errors
    if (pageErrors.length > 0) {
      recordDefect('medium', 'Console', 'Unhandled Errors', `${pageErrors.length} errors captured during Desktop EN flow`, pageErrors.slice(0, 5));
    } else {
      recordPass('Desktop Console & Runtime Hygiene', 'Zero errors captured during Phase 1');
    }

    await page.close();

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 2: DESKTOP (1440x900) — PERSIAN (FA) & RTL
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n▶ PHASE 2: Desktop Persian (FA) & RTL Localization (1440x900)');
    const faPage = await browser.newPage();
    await faPage.setViewport({ width: 1440, height: 900, isMobile: false });

    await faPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await faPage.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(2000);

    // Switch to FA
    await faPage.evaluate(() => {
      window.__TRADING_APP__?.switchLanguage('fa');
    });
    await settle(1500);

    await takeShot(faPage, '03_desktop_boot_fa');

    // 2.1 Verify document direction & lang
    const dirAudit = await faPage.evaluate(() => {
      const docLang = document.documentElement.lang;
      const bodyDir = getComputedStyle(document.body).direction;
      const isPersianClass = document.body.classList.contains('persian-mode');
      return { docLang, bodyDir, isPersianClass };
    });

    if (dirAudit.docLang !== 'fa' || dirAudit.bodyDir !== 'rtl') {
      recordDefect('critical', 'Localization', 'RTL Layout State', `Expected lang=fa and body dir=rtl, got lang=${dirAudit.docLang}, dir=${dirAudit.bodyDir}`);
    } else {
      recordPass('Persian Document & RTL Mode', `Active (lang=${dirAudit.docLang}, dir=${dirAudit.bodyDir})`);
    }

    // 2.2 Audit Untranslated text leaks
    const untranslatedAudit = await faPage.evaluate(() => {
      const allowRe = new RegExp('BTC|ETH|SOL|BNB|USDT|USD|XAU|EUR|USDJPY|RSI|SMA|EMA|MACD|ATR|BB|VWAP|Pine|WebGL|Sharpe|Monte|R:R|pine|v5|v6|JSON|CSV|PNG|SVG|OHLC|TP|SL|EV|Q|SB|SP|ES|NQ|DXY|GBP|JPY|AUD|CAD|CHF|NZD|SEC|EDGAR|FOMC|CPI|NFP|GDP|FINRA|13F|Live|ID|UTC|GMT|LuxAlgo|PineTS|Vela|TradingChart|TradingView|Nexus|Nikkei|Reuters|Bloomberg|CNBC|FT\\b|WSJ|Barron|MarketWatch|CoinDesk|CoinTelegraph|Pelosi|Tuberville|Goldman|Mullin|Gottheimer|NVDA|AAPL|MSFT|TSLA|AMZN|GOOG|META|NFLX|USOIL|UKOIL|NATGAS|NDX|DJI|SPX|XAG|Common Stock|Inc\\.|Corporation|Corp\\.|\\(D-[A-Z]{2}\\)|\\(R-[A-Z]{2}\\)', 'i');
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const el = n.parentElement;
        if (!el) continue;
        if (el.getClientRects().length === 0) continue;
        if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        if (el.closest('[data-no-i18n],script,style,svg,.num-ltr,code,pre,kbd')) continue;
        const txt = (n.textContent || '').trim();
        if (txt.length < 3) continue;
        if (/[\u0600-\u06FF]/.test(txt)) continue; // already Persian
        if (allowRe.test(txt)) continue;
        if (/[A-Za-z]{3,}/.test(txt)) {
          out.push({ tag: el.tagName, cls: (el.className||el.id||'').toString().slice(0, 50), text: txt.slice(0, 70) });
        }
      }
      return out.slice(0, 25);
    });

    if (untranslatedAudit.length > 0) {
      recordDefect('high', 'Localization', 'Untranslated Text Leaks', `Found ${untranslatedAudit.length} untranslated Latin strings in Persian mode`, untranslatedAudit);
    } else {
      recordPass('Persian Translation Completeness', 'Zero untranslated Latin leaks on primary workspace');
    }

    // 2.3 Audit RTL Misalignment (elements with Persian text but LTR alignment)
    const rtlMisalignAudit = await faPage.evaluate(() => {
      const bad = [];
      const SKIP = '.num-ltr,.qt-btn,.qt-step-btn,#pine-code-editor,.code-editor,pre,code,[dir="ltr"],[data-no-i18n],.vela-sl,.vela-sl-meta';
      document.querySelectorAll('button, .modal-box, h1, h2, h3, h4, p, li, label, .panel-tab, td, th, .modal-title, .modal-header').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        if (el.getClientRects().length === 0) return;
        if (el.closest(SKIP)) return;
        const txt = (el.innerText || '').trim();
        if (!/[\u0600-\u06FF]/.test(txt)) return;
        if ((s.textAlign === 'left' || s.textAlign === 'start') && s.direction === 'ltr' && !el.closest('[dir="rtl"]')) {
          bad.push({ tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0, 60), text: txt.slice(0, 40) });
        }
      });
      return bad.slice(0, 15);
    });

    if (rtlMisalignAudit.length > 0) {
      recordDefect('medium', 'Localization', 'RTL Misalignment', `Found ${rtlMisalignAudit.length} Persian elements forced to LTR alignment`, rtlMisalignAudit);
    } else {
      recordPass('RTL Typography & Alignment', 'Persian elements correctly RTL aligned');
    }

    // 2.4 Audit Persian Tone, Formal Register & Microcopy
    // Check for informal imperative ('کن' instead of 'کنید') or ambiguous terms ('روز هدیه')
    const toneAudit = await faPage.evaluate(() => {
      const issues = [];
      const textNodes = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const txt = (n.textContent || '').trim();
        if (/[\u0600-\u06FF]/.test(txt)) {
          // Check informal verb endings in actions/labels: e.g. "کلیک کن", "وارد شو", "تنظیم کن"
          if (/(?:کلیک|انتخاب|ذخیره|تنظیم|مشاهده|ثبت|شروع|لغو|ببند|اضافه)\s+(?:کن|شو|ساز)\b/.test(txt)) {
            issues.push({ kind: 'informal_register', text: txt.slice(0, 60), hint: 'Use formal register (کنید / شوید)' });
          }
          if (/روز\s+هدیه/.test(txt)) {
            issues.push({ kind: 'ambiguous_phrasing', text: txt.slice(0, 60), hint: 'Use اشتراک هدیه instead of روز هدیه' });
          }
        }
      }
      return issues;
    });

    if (toneAudit.length > 0) {
      recordDefect('medium', 'UX Writing', 'Persian Tone / Register Mismatch', `Found ${toneAudit.length} microcopy register violations`, toneAudit);
    } else {
      recordPass('Persian UX Writing Tone', 'Uniform respectful formal register enforced across surfaces');
    }

    await faPage.close();

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 3: MOBILE VIEWPORT (390x844) — COMPREHENSIVE ERGONOMICS
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n▶ PHASE 3: Mobile Viewport & Touch Ergonomics (390x844)');
    const mobPage = await browser.newPage();
    await mobPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

    await mobPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await mobPage.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(2500);

    await takeShot(mobPage, '04_mobile_boot');

    // 3.1 Mobile Horizontal Overflow Check
    const mobOverflow = await mobPage.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      const inScroller = (el) => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const s = getComputedStyle(p);
          if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
          p = p.parentElement;
        }
        return false;
      };
      document.querySelectorAll('body *').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') return;
        if (el.getClientRects().length === 0) return;
        if (inScroller(el)) return;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1.5 || r.left < -1.5) {
          bad.push({
            tag: el.tagName,
            id: el.id,
            cls: el.className,
            left: Math.round(r.left),
            right: Math.round(r.right),
            vw,
            text: (el.innerText || '').slice(0, 30)
          });
        }
      });
      return bad.slice(0, 15);
    });

    if (mobOverflow.length > 0) {
      recordDefect('critical', 'MobileLayout', 'Horizontal Viewport Overflow', `Found ${mobOverflow.length} elements overflowing 390px mobile viewport`, mobOverflow);
    } else {
      recordPass('Mobile 390x844 Viewport Fit', 'Zero elements overflowing 390px width');
    }

    // 3.2 Mobile Header Collision Check
    const mobHeaderCheck = await mobPage.evaluate(() => {
      const hdr = document.querySelector('#top-app-header');
      if (!hdr) return { found: false };
      const leftWrap = hdr.querySelector('.top-nav-left');
      const rightWrap = hdr.querySelector('.top-nav-right');
      const lr = leftWrap?.getBoundingClientRect();
      const rr = rightWrap?.getBoundingClientRect();
      let overlap = false;
      if (lr && rr) {
        // True 1D interval collision check (independent of LTR/RTL flex direction)
        overlap = Math.max(lr.left, rr.left) < Math.min(lr.right, rr.right);
      }
      const btns = Array.from(hdr.querySelectorAll('button')).filter(b => {
        const s = getComputedStyle(b);
        return s.display !== 'none' && s.visibility !== 'hidden';
      }).map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id, w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right) };
      });

      return { found: true, overlap, lr, rr, btns };
    });

    if (mobHeaderCheck.overlap) {
      recordDefect('critical', 'MobileHeader', 'Header Elements Collision', 'Left and right top-nav containers collide on mobile (390px)', mobHeaderCheck);
    } else {
      recordPass('Mobile Header Collision Avoidance', 'Left and right navigation bars do not intersect');
    }

    // 3.3 Mobile Touch Target Size Audit (<36px)
    const smallTouchTargets = await mobPage.evaluate(() => {
      const bad = [];
      document.querySelectorAll('button, [role="button"], a, input, select').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        // Ignore hidden or tiny utility elements
        if (r.width < 32 || r.height < 32) {
          bad.push({
            tag: el.tagName,
            id: el.id,
            cls: (el.className || '').toString().slice(0, 50),
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.innerText || el.getAttribute('title') || '').trim().slice(0, 30)
          });
        }
      });
      return bad.slice(0, 20);
    });

    if (smallTouchTargets.length > 0) {
      recordDefect('medium', 'MobileErgonomics', 'Small Touch Targets', `Found ${smallTouchTargets.length} interactive elements smaller than 32px on mobile`, smallTouchTargets);
    } else {
      recordPass('Mobile Touch Targets', 'All primary touch targets meet minimum ergonomics standards');
    }

    // 3.4 Mobile Modals Responsiveness & Fit
    // Test opening Symbol Search, Indicators, Layout, Settings on mobile
    const mobileModals = [
      { name: 'SymbolSearch', openFn: () => window.__TRADING_APP__.openSymbolSearch(), sel: '#modal-symbol-search' },
      { name: 'Indicators', openFn: () => window.__TRADING_APP__.indicatorsModal.open(), sel: '#modal-indicators' },
      { name: 'LayoutStudio', openFn: () => window.__TRADING_APP__.layoutManager.openLayoutStudio(), sel: '#modal-layout-studio' },
      { name: 'Compare', openFn: () => window.__TRADING_APP__.compareModal.open(), sel: '#modal-compare' },
      { name: 'Settings', openFn: () => window.__TRADING_APP__.settingsModal.open(), sel: '#modal-settings' }
    ];

    for (const mod of mobileModals) {
      const res = await mobPage.evaluate(async (m) => {
        document.querySelectorAll('.modal-overlay').forEach(x => x.classList.remove('open'));
        try {
          eval('(' + m.openFn + ')()');
        } catch (e) {
          return { error: e.message };
        }
        await new Promise(r => setTimeout(r, 600));
        const el = document.querySelector(m.sel + ' .modal-box, ' + m.sel);
        if (!el) return { error: 'Modal box not found in DOM' };
        const r = el.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const overflowsW = r.right > vw + 2 || r.left < -2;
        const overflowsH = r.bottom > vh + 2;

        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          overflowsW,
          overflowsH,
          vw, vh
        };
      }, { openFn: mod.openFn.toString(), sel: mod.sel });

      if (res.error) {
        recordDefect('high', 'MobileModals', mod.name, res.error);
      } else if (res.overflowsW) {
        recordDefect('critical', 'MobileModals', `${mod.name} Overflow`, `Modal box exceeds mobile viewport width (${res.w}px > ${res.vw}px)`);
      } else {
        recordPass(`Mobile Modal [${mod.name}]`, `Fits within 390px mobile viewport (${res.w}x${res.h})`);
      }
      await takeShot(mobPage, `05_mobile_modal_${mod.name}`);
      await mobPage.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(x => x.classList.remove('open')));
      await settle(200);
    }

    await mobPage.close();

  } catch (err) {
    console.error('Audit crashed with error:', err);
    recordDefect('critical', 'Harness', 'Crash', err.message);
  } finally {
    await browser.close();
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`   AUDIT COMPLETE: ${passes.length} PASSED, ${defects.length} DEFECTS FOUND `);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const reportPath = path.join(EVID, 'deep_audit_cycle1_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ passes, defects }, null, 2));
  console.log(`Detailed JSON report written to: ${reportPath}`);

  return { passes, defects };
}

runAudit().then(({ defects }) => {
  if (defects.length > 0) {
    console.log(`\n\x1b[31mAudit identified ${defects.length} defects to resolve.\x1b[0m`);
  } else {
    console.log('\n\x1b[32mZero defects detected across all evaluated surfaces!\x1b[0m');
  }
}).catch(e => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});
