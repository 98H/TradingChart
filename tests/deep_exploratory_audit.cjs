const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/deep_audit';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function inspectPage() {
  console.log('=== TRADINGCHART DEEP EXPLORATORY QA AUDIT ===\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const issues = [];
  const consoleLogs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push({ type: 'error', text: msg.text() });
    }
  });

  page.on('pageerror', err => {
    issues.push({ type: 'PageError', detail: err.toString() });
  });

  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // --- Cycle A: Desktop EN & FA Inspection ---
  console.log('[Test 1] Checking Initial Desktop DOM & Hidden Overflows...');
  const overflowElements = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2 && el.id !== 'chart-alerts-overlay') {
        bad.push({ tag: el.tagName, id: el.id, class: el.className, right: rect.right, docWidth });
      }
    });
    return bad.slice(0, 10);
  });
  if (overflowElements.length > 0) {
    issues.push({ type: 'HorizontalOverflow', detail: overflowElements });
  }

  // Check all bottom suite tabs
  console.log('[Test 2] Testing All Bottom Suite Panels...');
  const bottomTabs = ['pine', 'strategy', 'propfirm', 'journal', 'trackers', 'calendar', 'screener', 'news'];
  for (const tab of bottomTabs) {
    try {
      const tabBtn = await page.$(`.panel-tab[data-view="${tab}"]`);
      if (tabBtn) {
        await tabBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const pane = await page.$(`#view-${tab}`);
        const isVisible = pane ? await page.evaluate(el => window.getComputedStyle(el).display !== 'none', pane) : false;
        if (!isVisible) {
          issues.push({ type: 'BottomTabVisibility', detail: `Tab ${tab} did not become visible` });
        }
      } else {
        issues.push({ type: 'BottomTabMissing', detail: `Tab button for ${tab} not found` });
      }
    } catch (e) {
      issues.push({ type: 'BottomTabError', detail: `${tab}: ${e.message}` });
    }
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_bottom_suite_news.png') });

  // Check all Right Side-Rail Panels
  console.log('[Test 3] Testing All Right Side-Rail Panels...');
  const railPanels = ['watchlist', 'alerts', 'dom', 'news', 'trackers', 'calendar', 'journal', 'propfirm'];
  for (const panel of railPanels) {
    try {
      const btn = await page.$(`#desktop-side-rail .rail-btn[data-panel="${panel}"]`);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 500));
        const pane = await page.$(`#side-panel-${panel}`);
        const isVisible = pane ? await page.evaluate(el => window.getComputedStyle(el).display !== 'none', pane) : false;
        if (!isVisible) {
          issues.push({ type: 'SidePanelVisibility', detail: `Side panel ${panel} did not open` });
        }
      } else {
        issues.push({ type: 'SidePanelButtonMissing', detail: `Rail button for ${panel} not found` });
      }
    } catch (e) {
      issues.push({ type: 'SidePanelError', detail: `${panel}: ${e.message}` });
    }
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_side_panel_propfirm.png') });

  // Check All Modals
  console.log('[Test 4] Testing Modals Open/Close...');
  const modalsToTest = [
    { name: 'Settings', trigger: () => document.querySelector('.vela-widget-settings')?.click(), selector: '#modal-settings', close: () => document.querySelector('#modal-close-settings')?.click() },
    { name: 'Indicators', trigger: () => document.querySelector('.vela-widget-indicators')?.click(), selector: '#modal-indicators', close: () => document.querySelector('#modal-close-ind')?.click() },
    { name: 'Compare', trigger: () => document.querySelector('.vela-widget-compare')?.click(), selector: '#modal-compare', close: () => document.querySelector('#btn-close-compare')?.click() },
    { name: 'Shortcuts', trigger: () => document.querySelector('#vela-tool-shortcuts')?.click(), selector: '#modal-shortcuts', close: () => document.querySelector('#btn-close-shortcuts')?.click() },
    { name: 'UserProfile', trigger: () => document.querySelector('.user-avatar-badge')?.click(), selector: '#modal-user-profile', close: () => document.querySelector('#btn-close-user-profile')?.click() },
    { name: 'PanelsMenu', trigger: () => document.querySelector('#nav-btn-panels')?.click(), selector: '#modal-panels-menu', close: () => document.querySelector('#modal-close-panels-menu')?.click() }
  ];

  for (const m of modalsToTest) {
    try {
      await page.evaluate(m.trigger);
      await new Promise(r => setTimeout(r, 400));
      const isOpen = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.classList.contains('open') || window.getComputedStyle(el).display !== 'none' : false;
      }, m.selector);
      if (!isOpen) {
        issues.push({ type: 'ModalOpenFailed', detail: `Modal ${m.name} failed to open` });
      } else {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `modal_${m.name}.png`) });
      }
      await page.evaluate(m.close);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      issues.push({ type: 'ModalError', detail: `${m.name}: ${e.message}` });
    }
  }

  // --- Cycle B: Persian RTL Inspection & Linguistic Review ---
  console.log('[Test 5] Switching to Persian Mode & Checking UI Labels...');
  await page.evaluate(() => window.app?.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_persian_desktop_mode.png') });

  // Inspect Persian text for untranslated strings, undefined text, or raw keys
  const persianAudit = await page.evaluate(() => {
    const rawKeys = [];
    const untranslatedEnglish = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue.trim();
      if (!txt) continue;
      // Check if text is a raw translation key like "i18n.something" or "t('...')" or "undefined"
      if (/^[a-z]+[A-Z][a-zA-Z0-9]*$/.test(txt) && txt.length > 8 && !['TradingView', 'LuxAlgo', 'PineTS', 'TradingChart', 'BTCUSDT', 'ETHUSDT'].includes(txt)) {
        // Potential unrendered camelCase key
      }
      if (txt.includes('undefined') || txt.includes('null') || txt.includes('[object Object]')) {
        rawKeys.push({ txt, parent: node.parentElement ? node.parentElement.outerHTML.slice(0, 100) : '' });
      }
    }
    return { rawKeys };
  });

  if (persianAudit.rawKeys.length > 0) {
    issues.push({ type: 'PersianRawKeysOrUndefined', detail: persianAudit.rawKeys });
  }

  // --- Cycle C: Mobile Responsive Viewport (390x844) ---
  console.log('[Test 6] Testing Mobile Viewport & Drawers...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_mobile_viewport_main.png') });

  // Mobile More Drawer
  const mobileMoreBtn = await page.$('#mobile-btn-more');
  if (mobileMoreBtn) {
    await mobileMoreBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_mobile_more_drawer.png') });
    
    // Check items inside drawer
    const drawerItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.mobile-drawer-item, .more-menu-item, .mobile-dock-btn'));
      return items.map(el => el.innerText.trim());
    });
    console.log('Mobile Drawer Items:', drawerItems.slice(0, 8));
  }

  console.log('\n--- AUDIT SUMMARY ---');
  console.log('Console Errors:', consoleLogs);
  console.log('Detected Issues:', JSON.stringify(issues, null, 2));

  await browser.close();
}

inspectPage().catch(console.error);
