// tests/deep_qa_crawl_v5.cjs
// Ruthless full-surface QA crawler testing every component, panel, tool, and edge case.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function run() {
  const issues = [];
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    protocolTimeout: 120000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      issues.push({ type: 'CONSOLE_ERROR', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    issues.push({ type: 'PAGE_ERROR', text: err.toString() });
  });

  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('--- 1. Testing Topbar Elements ---');
  // Check symbol button
  const symBtn = await page.$('.vela-widget-symbol');
  if (!symBtn) issues.push({ type: 'MISSING_ELEMENT', text: 'Symbol button missing in topbar' });

  // Check timeframe buttons
  const tfCount = await page.evaluate(() => document.querySelectorAll('.vela-widget-timeframes button, .timeframe-btn').length);
  if (tfCount === 0) issues.push({ type: 'MISSING_ELEMENT', text: 'Timeframe buttons missing' });

  // Test Symbol Search Modal
  console.log('--- 2. Testing Symbol Search Modal ---');
  await page.evaluate(() => {
    const btn = document.querySelector('.vela-widget-symbol');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const symModalOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-symbol-search') || document.querySelector('.symbol-search-modal');
    return m ? m.classList.contains('open') || window.getComputedStyle(m).display !== 'none' : false;
  });
  if (!symModalOpen) issues.push({ type: 'BEHAVIOR_DEFECT', text: 'Symbol modal did not open on click' });

  // Test search typing in symbol search
  if (symModalOpen) {
    const searchInput = await page.$('#symbol-search-input');
    if (searchInput) {
      await searchInput.type('ETH');
      await new Promise(r => setTimeout(r, 300));
      const resultsCount = await page.evaluate(() => document.querySelectorAll('.symbol-search-item').length);
      if (resultsCount === 0) issues.push({ type: 'BEHAVIOR_DEFECT', text: 'Symbol search returned 0 items for ETH' });
    } else {
      issues.push({ type: 'MISSING_ELEMENT', text: '#symbol-search-input not found' });
    }
    // Close modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // Test Indicators Modal
  console.log('--- 3. Testing Indicators Modal ---');
  await page.evaluate(() => {
    const btn = document.querySelector('.vela-widget-indicators') || document.querySelector('#vela-topbar-indicators');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const indModalOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-indicators');
    return m ? m.classList.contains('open') : false;
  });
  if (!indModalOpen) issues.push({ type: 'BEHAVIOR_DEFECT', text: 'Indicators modal did not open on click' });

  if (indModalOpen) {
    // Check categories filter tabs
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.ind-cat-tab')).map(t => t.innerText.trim()));
    if (tabs.length < 3) issues.push({ type: 'CONTENT_DEFECT', text: 'Indicators category tabs missing or incomplete' });
    // Check indicators search input
    const indSearch = await page.$('#ind-search-input');
    if (indSearch) {
      await indSearch.type('EMA');
      await new Promise(r => setTimeout(r, 300));
      const filtered = await page.evaluate(() => document.querySelectorAll('.ind-item-card:not([style*="display: none"])').length);
      if (filtered === 0) issues.push({ type: 'BEHAVIOR_DEFECT', text: 'Indicator search for EMA returned 0' });
    }
    await page.evaluate(() => document.querySelector('#btn-close-indicators')?.click());
    await new Promise(r => setTimeout(r, 300));
  }

  // Test Right Sidebar Dock Panels
  console.log('--- 4. Testing Right Sidebar Dock Panels ---');
  const panelsToTest = ['watchlist', 'alerts', 'paper', 'data-window', 'object-tree', 'pine', 'journal'];
  for (const pId of panelsToTest) {
    const clicked = await page.evaluate((id) => {
      const railBtn = document.querySelector(`.rail-btn[data-panel="${id}"]`);
      if (railBtn) {
        railBtn.click();
        return true;
      }
      return false;
    }, pId);
    await new Promise(r => setTimeout(r, 400));
    const isDockOpen = await page.evaluate((id) => {
      const dock = document.querySelector('#sidebar-dock');
      const activePanel = document.querySelector(`.dock-panel[data-panel="${id}"]`);
      return dock && dock.classList.contains('open') && activePanel && (activePanel.classList.contains('active') || window.getComputedStyle(activePanel).display !== 'none');
    }, pId);
    if (!isDockOpen) {
      issues.push({ type: 'PANEL_DEFECT', text: `Right dock panel "${pId}" failed to open or activate properly` });
    }
  }

  // Test Bottom Panel Suite
  console.log('--- 5. Testing Bottom Suite Tabs ---');
  const bottomTabs = ['pine', 'strategy', 'prop', 'journal', 'trackers'];
  for (const bTab of bottomTabs) {
    await page.evaluate((tab) => {
      const btn = document.querySelector(`.bottom-suite-tab[data-tab="${tab}"]`);
      if (btn) btn.click();
    }, bTab);
    await new Promise(r => setTimeout(r, 400));
    const tabActive = await page.evaluate((tab) => {
      const panel = document.querySelector(`.bottom-suite-panel[data-tab="${tab}"]`);
      return panel && (panel.classList.contains('active') || window.getComputedStyle(panel).display !== 'none');
    }, bTab);
    if (!tabActive) {
      issues.push({ type: 'BOTTOM_PANEL_DEFECT', text: `Bottom suite tab "${bTab}" failed to activate` });
    }
  }

  // Test Prop-Firm Simulator Button
  console.log('--- 6. Testing Prop-Firm Simulator Run Button ---');
  await page.evaluate(() => {
    const btn = document.querySelector(`.bottom-suite-tab[data-tab="prop"]`);
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  const propRunBtn = await page.$('#btn-run-prop-sim');
  if (propRunBtn) {
    await propRunBtn.click();
    await new Promise(r => setTimeout(r, 800));
    const passRateText = await page.evaluate(() => document.querySelector('#prop-pass-rate')?.innerText.trim());
    if (!passRateText || passRateText === '--' || passRateText === '0%') {
      issues.push({ type: 'CALC_DEFECT', text: `Prop-firm simulator returned empty or invalid pass rate: "${passRateText}"` });
    }
  } else {
    issues.push({ type: 'MISSING_ELEMENT', text: '#btn-run-prop-sim not found' });
  }

  // Test Market Trackers Sub-tabs
  console.log('--- 7. Testing Market Trackers Sub-tabs ---');
  await page.evaluate(() => {
    const btn = document.querySelector(`.bottom-suite-tab[data-tab="trackers"]`);
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  const subTabs = ['congress', 'insider', '13f', 'short-vol'];
  for (const sTab of subTabs) {
    await page.evaluate((st) => {
      const b = document.querySelector(`.tracker-subtab[data-tracker="${st}"]`);
      if (b) b.click();
    }, sTab);
    await new Promise(r => setTimeout(r, 300));
    const rows = await page.evaluate((st) => {
      const container = document.querySelector(`.tracker-view[data-tracker="${st}"]`);
      return container ? container.querySelectorAll('tr, .tracker-row, .tracker-card').length : 0;
    }, sTab);
    if (rows === 0) {
      issues.push({ type: 'DATA_DEFECT', text: `Tracker subtab "${sTab}" rendered 0 rows or data items` });
    }
  }

  // Test Drawing Tools on Left Toolbar
  console.log('--- 8. Testing Left Drawing Toolbar Tools ---');
  const drawingToolBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.drawing-tool-btn, .vela-tool-btn')).map(b => ({
      id: b.id || b.getAttribute('data-tool') || b.title,
      title: b.title
    }));
  });
  console.log(`Found ${drawingToolBtns.length} drawing tools`);
  if (drawingToolBtns.length === 0) {
    issues.push({ type: 'DRAWING_DEFECT', text: 'No drawing tools found in toolbar' });
  }

  // Test Persian RTL Mode and Layout Integrity
  console.log('--- 9. Testing Persian Localization & RTL Layout ---');
  await page.evaluate(() => {
    if (window.app?.switchLanguage) window.app.switchLanguage('fa');
  });
  await new Promise(r => setTimeout(r, 800));

  const isRTL = await page.evaluate(() => {
    return document.documentElement.getAttribute('dir') === 'rtl' || document.body.classList.contains('persian-mode');
  });
  if (!isRTL) issues.push({ type: 'I18N_DEFECT', text: 'Persian mode failed to set RTL direction or class' });

  // Check for broken fonts or missing translations in Persian mode
  const untranslatedKeys = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, .nav-pill, .side-tab, .vela-lp-label'));
    const suspicious = [];
    buttons.forEach(b => {
      const txt = b.innerText.trim();
      if (txt.includes('undefined') || txt.includes('NaN') || txt.includes('[object')) {
        suspicious.push(txt);
      }
    });
    return suspicious;
  });
  if (untranslatedKeys.length > 0) {
    issues.push({ type: 'I18N_DEFECT', text: `Found broken text/keys: ${untranslatedKeys.join(', ')}` });
  }

  // Test Mobile Viewport (iPhone 14/15: 390x844)
  console.log('--- 10. Testing Mobile Viewport (390x844) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 1000));

  // Check Mobile Bottom Bar
  const mobileBarVisible = await page.evaluate(() => {
    const bar = document.querySelector('.vela-mobile-bottom-bar, #mobile-bottom-bar, .mobile-nav-bar');
    return bar ? window.getComputedStyle(bar).display !== 'none' : false;
  });
  console.log('Mobile bottom bar visible:', mobileBarVisible);

  // Check Mobile More Drawer
  const moreBtn = await page.$('.vela-mb-more, #btn-mobile-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const drawerOpen = await page.evaluate(() => {
      const drawer = document.querySelector('.vela-more-drawer') || document.querySelector('#mobile-more-drawer');
      return drawer ? drawer.classList.contains('open') || window.getComputedStyle(drawer).display !== 'none' : false;
    });
    if (!drawerOpen) issues.push({ type: 'MOBILE_DEFECT', text: 'Mobile More Drawer failed to open' });

    // Check if drawer content overflows or is clipped by bottom bar
    const drawerScrollable = await page.evaluate(() => {
      const drawerBody = document.querySelector('.vela-more-drawer .drawer-body') || document.querySelector('.vela-more-drawer');
      if (!drawerBody) return false;
      const rect = drawerBody.getBoundingClientRect();
      const lastChild = drawerBody.lastElementChild;
      if (!lastChild) return true;
      const lastRect = lastChild.getBoundingClientRect();
      return lastRect.bottom <= (window.innerHeight + 10);
    });
    console.log('Drawer bottom item within viewable scroll:', drawerScrollable);
  } else {
    issues.push({ type: 'MOBILE_DEFECT', text: 'Mobile More button not found' });
  }

  // Switch back to English & desktop
  await page.evaluate(() => {
    if (window.app?.switchLanguage) window.app.switchLanguage('en');
  });
  await page.setViewport({ width: 1440, height: 900 });

  await browser.close();

  console.log('\n=========================================');
  console.log(`CRAWL COMPLETED: Found ${issues.length} issues`);
  console.log('=========================================');
  issues.forEach((iss, idx) => {
    console.log(`[${idx + 1}] [${iss.type}] ${iss.text}`);
  });

  return issues;
}

run().catch(console.error);
