// tests/deep_ux_probe.cjs — Comprehensive UX & UI Deep Audit for TradingChart
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8088';
const EVID = '/root/TradingChart/screenshots/deep_probe';
if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

async function runAudit() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const findings = [];
  const logFinding = (severity, category, surface, issue, details = null) => {
    findings.push({ severity, category, surface, issue, details });
    console.log(`[${severity.toUpperCase()}] [${category}] [${surface}] ${issue}`);
  };

  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', m => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    // ==========================================
    // CYCLE 1: DESKTOP AUDIT (1440x900)
    // ==========================================
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log('--- 1. Desktop Initial Shell Audit ---');
    await page.screenshot({ path: path.join(EVID, '01_desktop_init.png') });

    // 1.1 Check Top Header Navigation elements
    const headerAudit = await page.evaluate(() => {
      const issues = [];
      const header = document.querySelector('#top-app-header');
      if (!header) return [{ issue: 'Missing #top-app-header' }];
      const r = header.getBoundingClientRect();
      if (r.width > 1440) issues.push({ issue: 'Header overflows viewport width', width: r.width });

      // Check all buttons inside header
      const btns = Array.from(header.querySelectorAll('button'));
      btns.forEach(b => {
        const br = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        if (s.display !== 'none' && s.visibility !== 'hidden' && (br.width < 16 || br.height < 16)) {
          issues.push({ issue: 'Header button too small', id: b.id, className: b.className, size: `${br.width}x${br.height}` });
        }
        // Check tooltip or title/aria-label
        if (s.display !== 'none' && s.visibility !== 'hidden' && !b.getAttribute('title') && !b.getAttribute('aria-label')) {
          issues.push({ issue: 'Header button missing title and aria-label', id: b.id, text: b.innerText });
        }
      });
      return issues;
    });
    headerAudit.forEach(i => logFinding('medium', 'accessibility', 'top-header', i.issue, i));

    // 1.2 Check Quick Trade Widget Layout
    const qtAudit = await page.evaluate(() => {
      const qt = document.querySelector('#chart-quick-trade');
      if (!qt) return { issue: 'Missing #chart-quick-trade' };
      const r = qt.getBoundingClientRect();
      const sellBtn = document.querySelector('#quick-trade-sell-btn');
      const buyBtn = document.querySelector('#quick-trade-buy-btn');
      const qtyInput = document.querySelector('#quick-trade-qty');
      const spread = document.querySelector('#quick-trade-spread');
      return {
        visible: getComputedStyle(qt).display !== 'none',
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        sellPrice: document.querySelector('#quick-sell-price')?.innerText,
        buyPrice: document.querySelector('#quick-buy-price')?.innerText,
        spreadText: spread?.innerText,
        qtyVal: qtyInput?.value
      };
    });
    console.log('Quick trade state:', qtAudit);
    if (!qtAudit.visible) logFinding('high', 'functionality', 'quick-trade', 'Quick Trade widget not visible');
    if (qtAudit.sellPrice === '...' || qtAudit.buyPrice === '...') {
      logFinding('medium', 'data', 'quick-trade', 'Quick Trade prices showing unpopulated dots ...');
    }

    // 1.3 Test Quick Trade Minimize / Expand
    console.log('--- 1.3 Testing Quick Trade Minimize & Restore ---');
    await page.click('#qt-toggle-btn');
    await new Promise(r => setTimeout(r, 400));
    const qtMinState = await page.evaluate(() => {
      const qt = document.querySelector('#chart-quick-trade');
      const trigger = document.querySelector('#qt-collapsed-trigger');
      return {
        qtMinimized: qt.classList.contains('minimized'),
        triggerDisplay: getComputedStyle(trigger).display
      };
    });
    console.log('Quick trade minimized state:', qtMinState);
    if (!qtMinState.qtMinimized) logFinding('high', 'functionality', 'quick-trade', 'Quick trade did not add .minimized class on minimize');
    if (qtMinState.triggerDisplay === 'none') logFinding('high', 'ux', 'quick-trade', 'Trigger pill not shown when quick trade is minimized');

    // Restore Quick trade
    await page.click('#qt-collapsed-trigger');
    await new Promise(r => setTimeout(r, 400));

    // 1.4 Audit Bottom Panel Tabs & Views
    console.log('--- 1.4 Auditing All Bottom Panel Views ---');
    // First expand bottom panel
    await page.click('#btn-toggle-bottom-panel');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '02_desktop_bottom_expanded.png') });

    const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const tab of bottomTabs) {
      await page.click(`.panel-tab[data-view="${tab}"]`);
      await new Promise(r => setTimeout(r, 800));
      const tabAudit = await page.evaluate((tabName) => {
        const view = document.querySelector(`#view-${tabName}`);
        if (!view) return { missing: true };
        const r = view.getBoundingClientRect();
        const text = view.innerText.trim();
        const scroller = view.scrollHeight > view.clientHeight;
        // Check for undefined / null / [object Object] text leaks
        const hasLeak = /\b(undefined|null|NaN|\[object\s+Object\])\b/.test(text);
        // Check for broken images or buttons
        const emptyButtons = Array.from(view.querySelectorAll('button')).filter(b => !b.innerText.trim() && !b.querySelector('svg') && !b.querySelector('img'));
        return {
          width: r.width,
          height: r.height,
          textLength: text.length,
          hasLeak,
          emptyButtonsCount: emptyButtons.length,
          sample: text.slice(0, 100).replace(/\s+/g, ' ')
        };
      }, tab);

      console.log(`Tab [${tab}]:`, tabAudit.sample);
      if (tabAudit.missing) logFinding('critical', 'functional', `bottom-${tab}`, 'View container missing');
      if (tabAudit.hasLeak) logFinding('high', 'data-leak', `bottom-${tab}`, `View contains undefined/null/NaN/[object Object] leak`);
      if (tabAudit.textLength < 20) logFinding('medium', 'ux', `bottom-${tab}`, `View has almost no content rendered (${tabAudit.textLength} chars)`);
      if (tabAudit.emptyButtonsCount > 0) logFinding('medium', 'accessibility', `bottom-${tab}`, `View has ${tabAudit.emptyButtonsCount} empty buttons`);
      await page.screenshot({ path: path.join(EVID, `03_tab_${tab}.png`) });
    }

    // 1.5 Audit Side Rail Panels
    console.log('--- 1.5 Auditing All Side Rail Panels ---');
    const sidePanels = ['watchlist', 'alerts', 'paper', 'dataWindow', 'objects', 'screener', 'dom', 'calendar', 'news'];
    for (const panel of sidePanels) {
      const btn = await page.$(`#desktop-side-rail .rail-btn[data-panel="${panel}"]`);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 800));
        const panelAudit = await page.evaluate((panelName) => {
          const app = window.__TRADING_APP__;
          // check if panel opened
          const dock = document.querySelector('.vela-dock-panel') || document.querySelector(`.vela-panel-${panelName}`) || document.querySelector(`[data-panel-id="${panelName}"]`);
          const text = dock ? dock.innerText.trim() : '';
          const hasLeak = /\b(undefined|null|NaN|\[object\s+Object\])\b/.test(text);
          return {
            openId: app?.chartManager?.openPanelId,
            found: !!dock,
            w: dock ? dock.getBoundingClientRect().width : 0,
            textLen: text.length,
            hasLeak,
            sample: text.slice(0, 80).replace(/\s+/g, ' ')
          };
        }, panel);
        console.log(`Side Panel [${panel}]:`, panelAudit);
        if (!panelAudit.found && panelAudit.openId !== panel) {
          logFinding('medium', 'functional', `side-rail-${panel}`, `Panel did not open on click`);
        }
        if (panelAudit.hasLeak) {
          logFinding('high', 'data-leak', `side-rail-${panel}`, `Panel contains undefined/null/NaN/[object Object] text leak`);
        }
        await page.screenshot({ path: path.join(EVID, `04_rail_${panel}.png`) });
      }
    }

    // 1.6 Audit Modals (Indicators, Settings, Symbol Search, Layout Studio, Shortcuts, Profile, Export)
    console.log('--- 1.6 Auditing Modals ---');
    // Indicators modal
    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.open?.());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '05_modal_indicators.png') });
    const indAudit = await page.evaluate(() => {
      const m = document.querySelector('#modal-indicators');
      const cards = m ? m.querySelectorAll('.indicator-card, .ind-card, [class*="indicator-item"]').length : 0;
      const search = m ? m.querySelector('input[type="text"]') : null;
      return { open: m?.classList.contains('open'), cards, hasSearch: !!search };
    });
    console.log('Indicators modal:', indAudit);
    if (!indAudit.open) logFinding('high', 'functional', 'modal-indicators', 'Indicators modal not opening');
    if (indAudit.cards < 10) logFinding('medium', 'functional', 'modal-indicators', `Too few indicator cards (${indAudit.cards})`);
    await page.evaluate(() => document.querySelector('#modal-indicators')?.classList.remove('open'));

    // Symbol Search modal
    await page.evaluate(() => {
      window.__TRADING_APP__?.openSymbolSearch?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '06_modal_symbol_search.png') });
    const symAudit = await page.evaluate(() => {
      const m = document.querySelector('#modal-symbol-search');
      const items = m ? m.querySelectorAll('.sym-search-row, .symbol-search-item').length : 0;
      const cats = m ? m.querySelectorAll('.sym-cat-btn').length : 0;
      return { open: m?.classList.contains('open'), items, cats };
    });
    console.log('Symbol search modal:', symAudit);
    if (!symAudit.open) logFinding('high', 'functional', 'modal-symbol-search', 'Symbol search modal not opening');
    if (symAudit.items < 5) logFinding('medium', 'functional', 'modal-symbol-search', `Symbol search has only ${symAudit.items} items`);
    await page.evaluate(() => document.querySelector('#modal-symbol-search')?.classList.remove('open'));

    // Settings modal
    await page.evaluate(() => window.__TRADING_APP__?.settingsModal?.open?.());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '07_modal_settings.png') });
    const setAudit = await page.evaluate(() => {
      const m = document.querySelector('#modal-settings');
      const tabs = m ? m.querySelectorAll('.settings-tab, [data-tab]').length : 0;
      const inputs = m ? m.querySelectorAll('input, select').length : 0;
      return { open: m?.classList.contains('open'), tabs, inputs };
    });
    console.log('Settings modal:', setAudit);
    if (!setAudit.open) logFinding('high', 'functional', 'modal-settings', 'Settings modal not opening');
    await page.evaluate(() => document.querySelector('#modal-settings')?.classList.remove('open'));

    // Compare modal
    await page.evaluate(() => window.__TRADING_APP__?.compareModal?.open?.());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '08_modal_compare.png') });
    await page.evaluate(() => document.querySelector('#modal-compare')?.classList.remove('open'));

    // Export modal
    await page.evaluate(() => window.__TRADING_APP__?.dataExportModal?.open?.());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '09_modal_export.png') });
    await page.evaluate(() => document.querySelector('#modal-data-export')?.classList.remove('open'));

    // User Profile modal
    await page.evaluate(() => window.__TRADING_APP__?.userProfileModal?.open?.());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '10_modal_user_profile.png') });
    await page.evaluate(() => document.querySelector('#modal-user-profile')?.classList.remove('open'));

    // 1.7 Audit Persian / RTL Mode on Desktop
    console.log('--- 1.7 Auditing Persian RTL Mode on Desktop ---');
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(EVID, '11_desktop_fa_overview.png') });

    const rtlDesktopAudit = await page.evaluate(() => {
      const issues = [];
      const dir = document.documentElement.dir;
      const bodyDir = getComputedStyle(document.body).direction;
      if (dir !== 'rtl' || bodyDir !== 'rtl') {
        issues.push({ issue: 'HTML or body direction is not rtl in fa mode', dir, bodyDir });
      }

      // Check font family: must use Vazirmatn or Persian font
      const bodyFont = getComputedStyle(document.body).fontFamily;
      if (!bodyFont.toLowerCase().includes('vazir')) {
        issues.push({ issue: 'Persian font (Vazirmatn) not active on body', bodyFont });
      }

      // Check numbers and currency: are numbers with $ or % wrapped or dir="ltr"?
      // Check top header layout in RTL
      const header = document.querySelector('#top-app-header');
      const leftNav = document.querySelector('.top-nav-left');
      const rightNav = document.querySelector('.top-nav-right');
      const hr = header?.getBoundingClientRect();
      const lr = leftNav?.getBoundingClientRect();
      const rr = rightNav?.getBoundingClientRect();

      return { issues, bodyFont, hr, lr, rr };
    });
    console.log('RTL desktop audit:', rtlDesktopAudit);
    rtlDesktopAudit.issues.forEach(i => logFinding('high', 'rtl', 'desktop', i.issue, i));

    // ==========================================
    // CYCLE 2: MOBILE AUDIT (390x844)
    // ==========================================
    console.log('\n--- 2. Mobile Viewport Audit (390x844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(EVID, '12_mobile_init_en.png') });

    const mobileInitAudit = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const issues = [];

      // Check horizontal overflow
      if (document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) {
        issues.push({
          issue: `Mobile horizontal page overflow: scrollWidth=${document.documentElement.scrollWidth} > clientWidth=${vw}`
        });
      }

      // Check top header fit
      const header = document.querySelector('#top-app-header');
      const hr = header ? header.getBoundingClientRect() : null;
      if (hr && hr.right > vw + 1) {
        issues.push({ issue: `Top header overflows mobile screen: right=${hr.right} > ${vw}` });
      }

      // Check quick trade widget on mobile
      const qt = document.querySelector('#chart-quick-trade');
      const qtr = qt ? qt.getBoundingClientRect() : null;
      if (qtr) {
        if (qtr.right > vw + 1) issues.push({ issue: `Quick trade overflows mobile screen: right=${qtr.right} > ${vw}` });
        if (qtr.left < -1) issues.push({ issue: `Quick trade clips mobile screen left: left=${qtr.left}` });
      }

      // Check touch targets (minimum 36px recommended for mobile)
      const allButtons = Array.from(document.querySelectorAll('button:not(.qt-step-btn):not(.sym-cat-btn):not(.delete-alert-btn)'));
      const smallButtons = allButtons.filter(b => {
        const r = b.getBoundingClientRect();
        const vis = getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden';
        return vis && r.width > 2 && r.height > 2 && (r.width < 32 || r.height < 32);
      }).map(b => ({ id: b.id, cls: b.className.slice(0, 30), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));

      return { issues, smallButtonsCount: smallButtons.length, smallButtons: smallButtons.slice(0, 8) };
    });
    console.log('Mobile init audit:', mobileInitAudit);
    mobileInitAudit.issues.forEach(i => logFinding('high', 'layout', 'mobile', i.issue, i));
    if (mobileInitAudit.smallButtonsCount > 0) {
      logFinding('medium', 'accessibility', 'mobile', `${mobileInitAudit.smallButtonsCount} buttons have touch targets < 32px`, mobileInitAudit.smallButtons);
    }

    // 2.2 Test Mobile Drawer & Navigation
    console.log('--- 2.2 Testing Mobile Drawer ---');
    await page.click('#nav-btn-panels');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '13_mobile_panels_drawer.png') });

    const drawerAudit = await page.evaluate(() => {
      const modal = document.querySelector('#modal-panels-menu');
      const box = modal ? modal.querySelector('.modal-box') : null;
      const br = box ? box.getBoundingClientRect() : null;
      const items = modal ? Array.from(modal.querySelectorAll('.panel-menu-item')) : [];
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const issues = [];
      if (br && br.right > vw + 2) issues.push({ issue: `Panels menu box overflows mobile width: right=${br.right} > ${vw}` });
      if (br && br.bottom > vh + 2) issues.push({ issue: `Panels menu box overflows mobile height: bottom=${br.bottom} > ${vh}` });

      // Check items touch targets
      const smallItems = items.filter(it => {
        const r = it.getBoundingClientRect();
        return r.height < 44;
      });
      return { issues, itemsCount: items.length, smallItemsCount: smallItems.length };
    });
    console.log('Mobile drawer audit:', drawerAudit);
    drawerAudit.issues.forEach(i => logFinding('high', 'layout', 'mobile-drawer', i.issue, i));
    if (drawerAudit.smallItemsCount > 0) {
      logFinding('medium', 'ux', 'mobile-drawer', `${drawerAudit.smallItemsCount} drawer items have height < 44px`);
    }

    // Close drawer
    await page.click('#modal-close-panels-menu');
    await new Promise(r => setTimeout(r, 400));

    // 2.3 Test Mobile Persian / RTL Mode
    console.log('--- 2.3 Testing Mobile Persian / RTL Mode ---');
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(EVID, '14_mobile_fa_overview.png') });

    const mobileFaAudit = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const issues = [];
      if (document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) {
        issues.push({ issue: `Mobile FA horizontal scroll overflow: ${document.documentElement.scrollWidth} > ${vw}` });
      }
      return { issues };
    });
    console.log('Mobile FA audit:', mobileFaAudit);
    mobileFaAudit.issues.forEach(i => logFinding('high', 'rtl', 'mobile-fa', i.issue, i));

    // Check all captured console errors
    console.log('--- Captured Console & Page Errors ---');
    console.log(consoleErrors);
    consoleErrors.forEach(err => logFinding('high', 'error', 'runtime', `Console/Page error: ${err}`));

    // Summary of Findings
    console.log('\n=============================================');
    console.log(`TOTAL FINDINGS: ${findings.length}`);
    console.log('=============================================');
    fs.writeFileSync(path.join(EVID, 'audit_summary.json'), JSON.stringify(findings, null, 2));

  } finally {
    await browser.close();
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
