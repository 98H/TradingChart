// tests/exhaustive_dogfood_suite.cjs
// Ruthless full-surface QA crawler testing every component, panel, tool, modal, and edge case.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = '/root/TradingChart/screenshots/cycle_master_v2';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullQA() {
  console.log('================================================================');
  console.log('💎 TRADINGCHART — ZERO-DEFECT COMPREHENSIVE QA CRAWLER (V2)');
  console.log('================================================================\n');

  const findings = [];
  const logFinding = (severity, category, title, details) => {
    findings.push({ severity, category, title, details, timestamp: new Date().toISOString() });
    console.log(`[${severity}] [${category}] ${title}: ${details}`);
  };

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      logFinding('HIGH', 'Console Error', 'Browser Console Error', msg.text());
    }
  });

  page.on('pageerror', err => {
    logFinding('CRITICAL', 'Runtime Exception', 'Uncaught Page Error', err.toString());
  });

  // 1. Initial Page Load
  console.log('--- 1. Testing Page Load & WebGL Canvas ---');
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await sleep(2000);

  const canvasExists = await page.evaluate(() => !!document.querySelector('canvas'));
  if (!canvasExists) logFinding('CRITICAL', 'Rendering', 'Chart canvas not rendered', '');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_desktop_home.png') });

  // 2. Chart Styles Switching
  console.log('--- 2. Testing All Chart Styles ---');
  const stylesToTest = ['candles', 'bars', 'heikinashi', 'line', 'area', 'baseline'];
  for (const st of stylesToTest) {
    await page.evaluate((styleId) => {
      window.__TRADING_APP__?.chartStylePicker?.setStyle(styleId);
    }, st);
    await sleep(300);
    const curStyle = await page.evaluate(() => window.__TRADING_APP__?.chartStylePicker?.currentStyle);
    if (curStyle !== st) {
      logFinding('HIGH', 'Feature', `Failed to apply chart style: ${st}`, `Current is ${curStyle}`);
    }
  }
  // Return to candles
  await page.evaluate(() => window.__TRADING_APP__?.chartStylePicker?.setStyle('candles'));
  await sleep(200);

  // 3. Modals Testing (Open, Verify, ESC Dismiss)
  console.log('--- 3. Testing Modals & Dialogs ---');
  const modalsToTest = [
    { name: 'Compare', trigger: '#btn-topbar-compare', selector: '#modal-compare' },
    { name: 'Data Export', trigger: '#btn-topbar-export', selector: '#modal-data-export' },
    { name: 'Shortcuts Help', trigger: '#btn-shortcuts-help', selector: '#modal-shortcuts' },
    { name: 'User Profile', trigger: '.user-avatar-badge', selector: '#modal-user-profile' },
    { name: 'Layout Studio', trigger: '#btn-layout-manager', selector: '#modal-layout-studio' },
    { name: 'Panels Menu', trigger: '#nav-btn-panels', selector: '#modal-panels-menu' }
  ];

  for (const m of modalsToTest) {
    console.log(`Testing Modal: [${m.name}]...`);
    await page.evaluate((trig) => {
      document.querySelector(trig)?.click();
    }, m.trigger);
    await sleep(400);

    const isOpen = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && (el.classList.contains('open') || window.getComputedStyle(el).display !== 'none');
    }, m.selector);

    if (!isOpen) {
      logFinding('HIGH', 'Modal Bug', `Modal ${m.name} failed to open`, `Selector: ${m.selector}`);
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, `02_modal_${m.name.replace(/\s+/g, '_')}.png`) });
      // Test Escape key dismiss
      await page.keyboard.press('Escape');
      await sleep(300);
      const isClosed = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return !el || (!el.classList.contains('open') && window.getComputedStyle(el).display === 'none');
      }, m.selector);
      if (!isClosed) {
        logFinding('HIGH', 'Modal Dismiss', `Modal ${m.name} failed to dismiss on Escape`, '');
        // Force close
        await page.evaluate((sel) => document.querySelector(sel)?.classList.remove('open'), m.selector);
      }
    }
  }

  // 4. Symbol Search Modal
  console.log('--- 4. Testing Symbol Search Modal & Filtering ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.openSymbolSearch();
  });
  await sleep(400);
  const symOpen = await page.evaluate(() => document.querySelector('#modal-symbol-search')?.classList.contains('open'));
  if (!symOpen) {
    logFinding('HIGH', 'Feature', 'Symbol Search modal failed to open', '');
  } else {
    // Type ETH
    await page.type('#symbol-search-input', 'ETH');
    await sleep(300);
    const count = await page.evaluate(() => document.querySelectorAll('.symbol-search-item').length);
    console.log(`Symbol search items for ETH: ${count}`);
    if (count === 0) logFinding('HIGH', 'Search Bug', 'No results found for ETH in symbol search', '');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_symbol_search_eth.png') });
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // 5. Indicators Modal (84+ Library)
  console.log('--- 5. Testing Indicators Modal (84+ Indicators) ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.indicatorsModal?.open();
  });
  await sleep(500);
  const indOpen = await page.evaluate(() => document.querySelector('#modal-indicators')?.classList.contains('open'));
  if (!indOpen) {
    logFinding('HIGH', 'Feature', 'Indicators modal failed to open', '');
  } else {
    const totalInds = await page.evaluate(() => document.querySelectorAll('.indicator-item, .ind-card').length);
    console.log(`Total Indicators rendered: ${totalInds}`);
    if (totalInds < 20) logFinding('HIGH', 'Data Missing', `Indicators count too low: ${totalInds}`, '');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_indicators_modal_open.png') });
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // 6. Test All Right Side-Rail Panels (11 Panels)
  console.log('--- 6. Testing All Right Side-Rail Panels ---');
  const railPanels = [
    'watchlist', 'alerts', 'paper', 'dataWindow', 'objects',
    'pine', 'journal', 'screener', 'dom', 'calendar', 'news'
  ];
  for (const p of railPanels) {
    console.log(`Switching to Side-Rail Panel: [${p}]...`);
    await page.evaluate((panelId) => {
      window.__TRADING_APP__?.chartManager?.togglePanel(panelId, true);
    }, p);
    await sleep(500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `05_rail_${p}.png`) });
  }

  // 7. Test All Bottom Suite Tabs (8 Tabs)
  console.log('--- 7. Testing Bottom Suite Panels ---');
  const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
  for (const b of bottomTabs) {
    console.log(`Switching to Bottom View: [${b}]...`);
    await page.evaluate((tabName) => {
      window.__TRADING_APP__?.switchBottomView(tabName);
    }, b);
    await sleep(400);
    const viewActive = await page.evaluate((tabName) => {
      const v = document.querySelector('#view-' + tabName);
      return v && v.classList.contains('active') && window.getComputedStyle(v).display !== 'none';
    }, b);
    if (!viewActive) {
      logFinding('HIGH', 'Bottom Suite', `Bottom view for ${b} is not active`, '');
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `06_bottom_${b}.png`) });
  }

  // 8. Test Bilingual Mode (Persian RTL)
  console.log('--- 8. Testing Bilingual Mode (Persian RTL) ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.switchLanguage('fa');
  });
  await sleep(600);
  const isPersian = await page.evaluate(() => {
    return document.documentElement.getAttribute('dir') === 'rtl' &&
           document.documentElement.lang === 'fa' &&
           document.querySelector('#nav-label-quant')?.innerText === 'کوانت';
  });
  if (!isPersian) logFinding('HIGH', 'i18n', 'Persian mode failed to apply RTL or translations', '');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_persian_desktop_full.png') });

  // Test Compare modal in Persian
  await page.evaluate(() => window.__TRADING_APP__?.compareModal?.open());
  await sleep(400);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_persian_compare_modal.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  // Switch back to English
  await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('en'));
  await sleep(400);

  // Close any active side dock panel and collapse bottom panel for pristine mobile test
  await page.evaluate(() => {
    window.__TRADING_APP__?.chartManager?.closeActivePanel();
    window.__TRADING_APP__?.toggleBottomPanel(true);
  });
  await sleep(500);

  // 9. Test Mobile Viewport (390x844)
  console.log('--- 9. Testing Mobile Viewport (390x844 iPhone) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(1000);

  const mobileOverflows = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const items = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2 && el.id !== 'chart-alerts-overlay') {
        items.push({ tag: el.tagName, id: el.id, class: el.className, right: rect.right });
      }
    });
    return items;
  });
  if (mobileOverflows.length > 0) {
    logFinding('HIGH', 'Mobile Overflow', 'Elements overflowing mobile viewport', JSON.stringify(mobileOverflows));
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_mobile_home_flawless.png') });

  // Test Mobile Panels Drawer
  await page.evaluate(() => {
    document.querySelector('#nav-btn-panels')?.click();
  });
  await sleep(500);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '10_mobile_panels_drawer.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  console.log('\n================================================================');
  console.log(`Comprehensive QA Test Run Finished. Total Issues: ${findings.length}`);
  console.log('================================================================');

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'findings_summary.json'),
    JSON.stringify(findings, null, 2)
  );

  await browser.close();
  return findings;
}

runFullQA().catch(err => {
  console.error('Fatal QA Error:', err);
  process.exit(1);
});
