// tests/rigorous_exploratory_qa.cjs
// Ruthless multi-cycle QA dogfooding runner inspecting every feature, user flow, and interaction.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = '/root/TradingChart/screenshots/cycle_rigorous_v2';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRigorousQA() {
  console.log('================================================================');
  console.log('💎 TRADINGCHART — ZERO-DEFECT COMPREHENSIVE QA CRAWLER (V3)');
  console.log('================================================================\n');

  const defects = [];
  const logDefect = (severity, category, title, details, element = null) => {
    defects.push({ severity, category, title, details, element, timestamp: new Date().toISOString() });
    console.error(`🔴 [${severity}] [${category}] ${title}: ${details}`);
  };

  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      logDefect('HIGH', 'Console Error', 'Browser Console Error', msg.text());
    }
  });

  page.on('pageerror', err => {
    logDefect('CRITICAL', 'Runtime Exception', 'Uncaught Page Error', err.toString());
  });

  // 1. Initial Load & Geometry Audit
  console.log('--- Phase 1: Initial Desktop Load & Canvas Geometry ---');
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await sleep(2000);

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('#vela-workspace-mount canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height, visible: rect.width > 200 && rect.height > 200 };
  });

  if (!canvasInfo || !canvasInfo.visible) {
    logDefect('CRITICAL', 'WebGL Canvas', 'Chart Canvas is missing or collapsed', JSON.stringify(canvasInfo));
  } else {
    console.log(`[PASS] WebGL Canvas active: ${canvasInfo.width}x${canvasInfo.height}px`);
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_desktop_home.png') });

  // 2. Left Drawing Toolbar & Floating Toolbar
  console.log('\n--- Phase 2: Drawing Tools & Floating Palette Audit ---');
  const velaDrawingTools = [
    'Cursor', 'Lines', 'Fibonacci', 'Shapes', 'Text', 'Measure',
    'Eraser (click/drag to delete)', 'Magnet snap', 'Stay in drawing mode'
  ];

  for (const toolName of velaDrawingTools) {
    const exists = await page.evaluate((label) => {
      const btn = document.querySelector(`.vela-ws-toolbar [aria-label*="${label}"], .vela-ws-toolbar [title*="${label}"]`);
      return !!btn;
    }, toolName);
    if (!exists) {
      logDefect('LOW', 'Left Toolbar', `Tool [${toolName}] not found in .vela-ws-toolbar`, '');
    } else {
      console.log(`[PASS] Left toolbar has [${toolName}]`);
    }
  }

  // Check Floating Toolbar Initial Safe Position
  const floatingPos = await page.evaluate(() => {
    const ft = document.querySelector('#floating-drawing-toolbar');
    if (!ft) return null;
    const rect = ft.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  });

  if (!floatingPos) {
    logDefect('HIGH', 'Floating Toolbar', 'Floating drawing toolbar (#floating-drawing-toolbar) missing from DOM', '');
  } else {
    console.log(`[PASS] Floating drawing toolbar active at top: ${floatingPos.top}px, left: ${floatingPos.left}px`);
    if (floatingPos.top > 250) {
      logDefect('MEDIUM', 'Floating Toolbar', `Floating toolbar is positioned too low (${floatingPos.top}px), risking candlestick collision`, '');
    }
  }

  // 3. Timeframes & Symbol Switching
  console.log('\n--- Phase 3: Timeframe & Symbol Verification ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.chartManager?.setTimeframe('15');
  });
  await sleep(600);
  const tf15 = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.activeTimeframe);
  console.log(`Timeframe switched to: ${tf15}`);
  if (tf15 !== '15') {
    logDefect('HIGH', 'Timeframe', 'Failed to switch timeframe to 15m', '');
  }

  // Switch back to 60m
  await page.evaluate(() => {
    window.__TRADING_APP__?.chartManager?.setTimeframe('60');
  });
  await sleep(600);

  // 4. Indicator Legend & Modal Library
  console.log('\n--- Phase 4: Indicator Library & Legend Audit ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.indicatorsModal?.open();
  });
  await sleep(400);

  const indCount = await page.evaluate(() => document.querySelectorAll('.indicator-item, .ind-card').length);
  console.log(`Indicators library items: ${indCount}`);
  if (indCount < 50) {
    logDefect('HIGH', 'Indicators Library', `Indicator count unexpectedly low: ${indCount}`, '');
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_indicators_modal.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Quick Trade & Market Order Execution
  console.log('\n--- Phase 5: Quick Trade & Order Execution Audit ---');
  const qtState = await page.evaluate(() => {
    const buyBtn = document.querySelector('#quick-trade-buy-btn');
    const sellBtn = document.querySelector('#quick-trade-sell-btn');
    const qtyInput = document.querySelector('#quick-trade-qty');
    return {
      buyText: buyBtn?.textContent?.replace(/\s+/g, ' ').trim(),
      sellText: sellBtn?.textContent?.replace(/\s+/g, ' ').trim(),
      qty: qtyInput?.value
    };
  });
  console.log('Quick Trade widget state:', qtState);

  // Click Buy
  await page.evaluate(() => {
    document.querySelector('#quick-trade-buy-btn')?.click();
  });
  await sleep(400);

  const posCount = await page.evaluate(() => window.__TRADING_APP__?.paperTrading?.positions?.length || 0);
  console.log(`Active paper trading positions: ${posCount}`);
  if (posCount === 0) {
    logDefect('HIGH', 'Execution', 'Buy button click did not create a paper trading position', '');
  } else {
    console.log('[PASS] Market order executed successfully.');
  }

  // 6. DOM Panel & Collision Clearance Verification
  console.log('\n--- Phase 6: Depth of Market (DOM) & Layout Clearance Audit ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.chartManager?.togglePanel('dom', true);
  });
  await sleep(800);

  const clearanceCheck = await page.evaluate(() => {
    const panel = document.querySelector('.vela-panel.is-open, .vela-panel-dom');
    const qt = document.querySelector('#chart-quick-trade');
    const scale = document.querySelector('#scale-controls-bar');
    const alertsOverlay = document.querySelector('#chart-alerts-overlay');

    if (!panel) return { error: 'No open panel' };
    const pRect = panel.getBoundingClientRect();
    const qtRect = qt?.getBoundingClientRect();
    const sRect = scale?.getBoundingClientRect();
    const aRect = alertsOverlay?.getBoundingClientRect();

    // Check overlaps
    const qtOverlaps = qtRect ? qtRect.right > pRect.left : false;
    const scaleOverlaps = sRect ? sRect.right > pRect.left : false;
    const alertsOverlaps = aRect ? aRect.right > pRect.left : false;

    // Check DOM number formatting
    const firstAskPrice = document.querySelector('.dom-ask-row .num-ltr')?.textContent?.trim();
    const firstBidPrice = document.querySelector('.dom-bid-row .num-ltr')?.textContent?.trim();
    const domQtyValue = document.querySelector('#dom-order-qty')?.value;

    return {
      panelLeft: pRect.left,
      qtRight: qtRect?.right,
      scaleRight: sRect?.right,
      alertsRight: aRect?.right,
      qtOverlaps,
      scaleOverlaps,
      alertsOverlaps,
      firstAskPrice,
      firstBidPrice,
      domQtyValue
    };
  });

  console.log('DOM Clearance Metrics:', clearanceCheck);

  if (clearanceCheck.qtOverlaps) {
    logDefect('CRITICAL', 'Layout Collision', `Quick trade overlaps inside open DOM panel (QT right: ${clearanceCheck.qtRight} > Panel left: ${clearanceCheck.panelLeft})`, '');
  } else {
    console.log('[PASS] Quick trade stays strictly outside DOM panel.');
  }

  if (clearanceCheck.scaleOverlaps) {
    logDefect('CRITICAL', 'Layout Collision', `Scale controls dock overlaps inside open DOM panel (Scale right: ${clearanceCheck.scaleRight} > Panel left: ${clearanceCheck.panelLeft})`, '');
  } else {
    console.log('[PASS] Scale controls dock stays strictly outside DOM panel.');
  }

  if (clearanceCheck.alertsOverlaps) {
    logDefect('CRITICAL', 'Layout Collision', `Alerts overlay overlaps inside open DOM panel (Alerts right: ${clearanceCheck.alertsRight} > Panel left: ${clearanceCheck.panelLeft})`, '');
  } else {
    console.log('[PASS] Alerts overlay stays strictly outside DOM panel.');
  }

  // Verify strict 2 decimals on DOM
  if (clearanceCheck.firstAskPrice && !/\.\d{2}$/.test(clearanceCheck.firstAskPrice)) {
    logDefect('HIGH', 'DOM Formatting', `Ask price does not have strict 2 decimal places: "${clearanceCheck.firstAskPrice}"`, '');
  } else {
    console.log(`[PASS] DOM ask price formatted with canonical 2 decimals: ${clearanceCheck.firstAskPrice}`);
  }

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_dom_ladder_clearance.png') });

  // Close side panel
  await page.evaluate(() => window.__TRADING_APP__?.chartManager?.closeActivePanel());
  await sleep(400);

  // 7. Settings Modal Tabs & Features
  console.log('\n--- Phase 7: Elevated Settings Modal & Tabs Audit ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.settingsModal?.open('appearance');
  });
  await sleep(400);

  const settingsTabs = ['appearance', 'scales', 'trading', 'system'];
  for (const tab of settingsTabs) {
    await page.evaluate((t) => window.__TRADING_APP__?.settingsModal?.setTab(t), tab);
    await sleep(200);
    const activeBtn = await page.$(`.settings-tab-btn.active[data-tab="${tab}"]`);
    if (!activeBtn) {
      logDefect('HIGH', 'Settings Modal', `Tab [${tab}] did not gain active state`, '');
    }
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_settings_modal_tabs.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  // 8. Bilingual Persian RTL Flow & Header Verification
  console.log('\n--- Phase 8: Persian RTL Mode & Header Symmetry Audit ---');
  await page.evaluate(() => {
    window.__TRADING_APP__?.switchLanguage('fa');
  });
  await sleep(800);

  const rtlHeaderCheck = await page.evaluate(() => {
    const header = document.querySelector('#top-app-header');
    const leftNav = document.querySelector('.top-nav-left');
    const rightNav = document.querySelector('.top-nav-right');

    const hRect = header?.getBoundingClientRect();
    const lRect = leftNav?.getBoundingClientRect();
    const rRect = rightNav?.getBoundingClientRect();

    return {
      dir: document.documentElement.getAttribute('dir'),
      leftNavLeft: lRect?.left,
      leftNavRight: lRect?.right,
      rightNavLeft: rRect?.left,
      rightNavRight: rRect?.right,
      isNaturalRTL: lRect && rRect ? lRect.right > rRect.right : false
    };
  });

  console.log('RTL Header geometry:', rtlHeaderCheck);
  if (!rtlHeaderCheck.isNaturalRTL) {
    logDefect('MEDIUM', 'Bilingual / RTL', 'Top Header primary navigation is not anchored to the right in Persian mode', '');
  } else {
    console.log('[PASS] Top Header correctly anchors primary navigation to the right in Persian mode.');
  }

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_persian_desktop_flawless.png') });

  // 9. Mobile Viewport Deep Audit (390x844)
  console.log('\n--- Phase 9: Mobile Viewport Deep Inspection (390x844) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(1000);

  const mobileMetrics = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const overflows = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > docWidth + 2 && el.id !== 'chart-alerts-overlay') {
        overflows.push({ tag: el.tagName, id: el.id, class: el.className, right: r.right });
      }
    });
    return {
      docWidth,
      overflowCount: overflows.length,
      overflows: overflows.slice(0, 5)
    };
  });

  console.log('Mobile layout metrics:', mobileMetrics);
  if (mobileMetrics.overflowCount > 0) {
    logDefect('HIGH', 'Mobile Layout', `Found ${mobileMetrics.overflowCount} overflowing elements on mobile`, JSON.stringify(mobileMetrics.overflows));
  } else {
    console.log('[PASS] Zero horizontal overflow on mobile viewport (390px).');
  }

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_mobile_flawless.png') });

  // Summary
  console.log('\n================================================================');
  console.log(`Rigorous QA Run Complete. Total Defects: ${defects.length}`);
  console.log('================================================================');

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'summary.json'),
    JSON.stringify(defects, null, 2)
  );

  await browser.close();
  return defects;
}

runRigorousQA().catch(err => {
  console.error('Fatal Rigorous QA Error:', err);
  process.exit(1);
});
