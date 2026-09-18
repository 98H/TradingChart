// tests/exploratory_qa.js
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/exploratory_qa';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runExploratoryQA() {
  console.log('=== Starting Full Exploratory QA of TradingChart ===');

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
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const consoleLogs = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.error('[Browser Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('[Page Error]', err.message);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push({ url: resp.url(), status: resp.status() });
      console.error(`[HTTP Error ${resp.status}]`, resp.url());
    }
  });

  console.log('\n1. Navigating to http://127.0.0.1:8088...');
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_state.png') });

  // 2. Test Topbar Elements
  console.log('\n2. Inspecting Topbar elements...');
  const topbarInfo = await page.evaluate(() => {
    const symbolBtn = document.querySelector('.vela-widget-symbol');
    const tfCaret = document.querySelector('.vela-widget-tf-caret');
    const styleBtn = document.querySelector('.vela-widget-style');
    const layoutBtn = document.querySelector('.vela-widget-layout');
    const indBtn = document.querySelector('.vela-widget-indicators');
    const undoBtn = document.querySelector('.vela-widget-undo');
    const redoBtn = document.querySelector('.vela-widget-redo');
    return {
      symbolBtn: symbolBtn ? { text: symbolBtn.innerText, rect: symbolBtn.getBoundingClientRect() } : null,
      tfCaret: tfCaret ? { rect: tfCaret.getBoundingClientRect() } : null,
      styleBtn: styleBtn ? { rect: styleBtn.getBoundingClientRect() } : null,
      layoutBtn: layoutBtn ? { rect: layoutBtn.getBoundingClientRect() } : null,
      indBtn: indBtn ? { text: indBtn.innerText, rect: indBtn.getBoundingClientRect() } : null,
      undoBtn: undoBtn ? { rect: undoBtn.getBoundingClientRect() } : null,
      redoBtn: redoBtn ? { rect: redoBtn.getBoundingClientRect() } : null
    };
  });
  console.log('Topbar Info:', JSON.stringify(topbarInfo, null, 2));

  // 3. Test Clicking Symbol button
  console.log('\n3. Clicking Symbol button in topbar...');
  await page.click('.vela-widget-symbol');
  await new Promise(r => setTimeout(r, 1000));
  const symbolModalOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-symbol-search');
    return m ? m.classList.contains('open') : false;
  });
  console.log('Symbol search modal opened:', symbolModalOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_symbol_search_open.png') });

  // Test searching in symbol modal
  console.log('Typing ETH into symbol search...');
  await page.type('#symbol-search-input', 'ETH');
  await new Promise(r => setTimeout(r, 600));
  const resultsCount = await page.evaluate(() => document.querySelectorAll('#symbol-results-list .sym-search-row').length);
  console.log('Search results found:', resultsCount);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_symbol_search_results.png') });

  // Select ETHUSDT
  console.log('Selecting ETHUSDT...');
  const ethRow = await page.$('.sym-search-row[data-symbol="ETHUSDT"]');
  if (ethRow) {
    await ethRow.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  const currentSymbolAfter = await page.evaluate(() => window.app?.currentSymbol);
  console.log('Current symbol after selection:', currentSymbolAfter);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_after_symbol_select.png') });

  // 4. Test Clicking Indicators button in topbar
  console.log('\n4. Clicking Indicators button in topbar...');
  await page.click('.vela-widget-indicators');
  await new Promise(r => setTimeout(r, 1000));
  const indModalOpen = await page.evaluate(() => {
    const m = document.querySelector('#modal-indicators');
    return m ? m.classList.contains('open') : false;
  });
  console.log('Indicators modal opened:', indModalOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_indicators_modal_open.png') });

  // Close Indicators modal
  await page.click('#modal-close-ind');
  await new Promise(r => setTimeout(r, 500));

  // 5. Test Right Tool Rail (Watchlist, Alerts, Paper, Data Window, Object Tree, Pine, Journal)
  console.log('\n5. Testing Right Tool Rail buttons...');
  const railItems = ['watchlist', 'alerts', 'paper', 'dataWindow', 'objects', 'pine', 'journal'];
  for (const item of railItems) {
    console.log(`Clicking rail item: ${item}...`);
    const btn = await page.$(`.rail-btn[data-panel="${item}"]`);
    if (btn) {
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
      const openPanel = await page.evaluate(() => window.app?.chartManager?.openPanelId);
      console.log(`Open panel after click: ${openPanel}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `06_rail_${item}.png`) });
    }
  }

  // 6. Test Bottom Collapsible Panel
  console.log('\n6. Testing Bottom Collapsible Panel...');
  await page.click('#btn-toggle-bottom-panel');
  await new Promise(r => setTimeout(r, 800));
  const isBottomOpen = await page.evaluate(() => !document.querySelector('#bottom-panel').classList.contains('collapsed'));
  console.log('Bottom panel expanded:', isBottomOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_bottom_panel_expanded.png') });

  // Test tabs in bottom panel
  const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers'];
  for (const tab of bottomTabs) {
    console.log(`Clicking bottom tab: ${tab}...`);
    await page.click(`.panel-tab[data-view="${tab}"]`);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `08_bottom_tab_${tab}.png`) });
  }

  // 7. Test Keyboard Shortcuts Reference (?)
  console.log('\n7. Testing Keyboard Shortcuts modal (?)...');
  await page.click('#btn-shortcuts-help');
  await new Promise(r => setTimeout(r, 800));
  const shortcutsOpen = await page.evaluate(() => document.querySelector('#modal-shortcuts')?.classList.contains('open'));
  console.log('Shortcuts modal opened:', shortcutsOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_shortcuts_modal.png') });
  await page.click('#modal-close-shortcuts');
  await new Promise(r => setTimeout(r, 500));

  // 8. Test Left Drawing Tools
  console.log('\n8. Testing Left Drawing Toolbar tools...');
  const toolsInfo = await page.evaluate(() => {
    const toolbar = document.querySelector('.vela-ws-toolbar');
    if (!toolbar) return { exists: false };
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    return {
      exists: true,
      buttonCount: buttons.length,
      buttons: buttons.map((b, i) => ({ index: i, title: b.getAttribute('title') || b.getAttribute('aria-label') || b.className }))
    };
  });
  console.log('Left drawing toolbar info:', JSON.stringify(toolsInfo, null, 2));

  // Click on trend line tool (first tool group)
  console.log('Clicking trendline tool group...');
  const toolButtons = await page.$$('.vela-ws-toolbar button');
  if (toolButtons.length > 1) {
    await toolButtons[1].click(); // First drawing group
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_drawing_tool_clicked.png') });
  }

  // 9. Test Mobile Viewport (390x844)
  console.log('\n9. Testing Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_mobile_initial.png') });

  // Inspect mobile DOM and elements
  const mobileDOM = await page.evaluate(() => {
    const mobileBar = document.querySelector('.vela-mobilebar');
    const bottomPanel = document.querySelector('#bottom-panel');
    const sideRail = document.querySelector('#desktop-side-rail');
    return {
      mobileBar: mobileBar ? { rect: mobileBar.getBoundingClientRect(), visible: mobileBar.offsetParent !== null } : null,
      bottomPanel: bottomPanel ? { display: window.getComputedStyle(bottomPanel).display } : null,
      sideRail: sideRail ? { display: window.getComputedStyle(sideRail).display } : null
    };
  });
  console.log('Mobile DOM Layout:', JSON.stringify(mobileDOM, null, 2));

  // Click mobile more drawer [⋮]
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    console.log('Clicking mobile more drawer button...');
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_mobile_more_drawer.png') });

    // Check what is inside more drawer
    const drawerInfo = await page.evaluate(() => {
      const drawer = document.querySelector('.vela-more-drawer');
      if (!drawer) return null;
      const items = Array.from(drawer.querySelectorAll('.vela-md-item, .vela-drawer-item, button'));
      return {
        open: drawer.classList.contains('open') || drawer.style.display !== 'none',
        items: items.map(it => it.innerText.trim()).filter(Boolean)
      };
    });
    console.log('Mobile Drawer Info:', JSON.stringify(drawerInfo, null, 2));
  }

  await browser.close();

  console.log('\n=== Exploratory QA Completed ===');
  console.log(`Page Errors: ${pageErrors.length}`);
  console.log(`Failed HTTP: ${failedRequests.length}`);
}

runExploratoryQA().catch(err => {
  console.error('Exploratory QA Error:', err);
  process.exit(1);
});
