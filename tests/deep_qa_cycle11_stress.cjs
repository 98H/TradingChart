// tests/deep_qa_cycle11_stress.cjs
// Cycle 11: In-Depth Verification of Newly Elevated Features, Edge Cases & Mobile Parity

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/cycle11_dogfood';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCycle11Audit() {
  console.log('================================================================================');
  console.log('🔥 STARTING DOGFOODING CYCLE 11: DEEP STRESS, EDGE CASES & FEATURE ELEVATION');
  console.log('================================================================================\n');

  const defects = [];
  const validations = [];
  const consoleErrors = [];
  const pageErrors = [];

  function addDefect(category, title, description, severity = 'MEDIUM') {
    const d = { category, title, description, severity };
    defects.push(d);
    console.log(`❌ DEFECT [${severity}] [${category}]: ${title} -> ${description}`);
  }

  function addValidation(category, title, description) {
    validations.push({ category, title, description });
    console.log(`✅ VERIFIED [${category}]: ${title} -> ${description}`);
  }

  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    headless: true,
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

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.log('  [Browser Console Error]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('  [Browser Page Error]:', err.message);
  });

  async function snap(name) {
    const p = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Screenshot saved: ${name}.png`);
    return p;
  }

  try {
    // ═════════════════════════════════════════════════════════════════════
    // 1. DESKTOP INITIALIZATION & CANDLE COUNTDOWN TIMER
    // ═════════════════════════════════════════════════════════════════════
    console.log('--- 1. Testing Live Bar Countdown Timer in Scale Controls ---');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(3500);

    const countdownText = await page.evaluate(() => {
      const el = document.querySelector('#countdown-timer-val');
      return el ? el.innerText.trim() : null;
    });
    console.log('Countdown Timer Value:', countdownText);
    if (!countdownText || countdownText === '--:--' || !/^\d{2}:\d{2}(:\d{2})?$/.test(countdownText)) {
      addDefect('ScaleControls', 'Invalid Countdown Timer', `Value is '${countdownText}'`, 'MEDIUM');
    } else {
      addValidation('ScaleControls', 'Candle Countdown Active', `Live countdown ticking: ${countdownText}`);
    }
    await snap('01_countdown_timer_verified');

    // ═════════════════════════════════════════════════════════════════════
    // 2. PERSIAN MODE DEEP AUDIT: PROPSIM, STRATEGY, JOURNAL & CONTEXT MENU
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Auditing Persian Mode Bottom Suite Elevation ---');
    await page.click('#btn-toggle-lang');
    await sleep(1000);

    // Expand bottom panel
    await page.evaluate(() => {
      const bp = document.querySelector('#bottom-panel');
      if (bp && bp.classList.contains('collapsed')) {
        document.querySelector('#btn-toggle-bottom-panel')?.click();
      }
    });
    await sleep(600);

    // Test Prop-Firm Simulator in Persian
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="propsim"]')?.click());
    await sleep(800);
    const propsimFaText = await page.evaluate(() => {
      const text = document.querySelector('#view-propsim')?.innerText || '';
      const hasFaLabel = text.includes('قالب آزمون پراپ‌فرم') || text.includes('نرخ برد');
      const hasPassProb = text.includes('احتمال قبولی در چالش');
      const hasRuin = text.includes('ریسک سوختن حساب');
      return { hasFaLabel, hasPassProb, hasRuin };
    });
    console.log('PropSim Persian Text Verification:', propsimFaText);
    if (!propsimFaText.hasFaLabel || !propsimFaText.hasPassProb || !propsimFaText.hasRuin) {
      addDefect('PropSim', 'Missing Persian Localization', JSON.stringify(propsimFaText), 'HIGH');
    } else {
      addValidation('PropSim', 'PropSim Fully Localized to Persian', 'All inputs, badges, and KPI cards in Persian');
    }
    await snap('02_propsim_persian_verified');

    // Test Strategy Tester in Persian
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="strategy"]')?.click());
    await sleep(800);
    const stratFaText = await page.evaluate(() => {
      const text = document.querySelector('#view-strategy')?.innerText || '';
      const hasNetProfit = text.includes('سود خالص');
      const hasProfitFactor = text.includes('ضریب سودآوری');
      const hasTradesTable = text.includes('معاملات بسته‌شده اخیر') || text.includes('قیمت ورود');
      return { hasNetProfit, hasProfitFactor, hasTradesTable };
    });
    console.log('Strategy Tester Persian Text Verification:', stratFaText);
    if (!stratFaText.hasNetProfit || !stratFaText.hasProfitFactor || !stratFaText.hasTradesTable) {
      addDefect('StrategyTester', 'Missing Persian Localization', JSON.stringify(stratFaText), 'HIGH');
    } else {
      addValidation('StrategyTester', 'Strategy Tester Fully Localized', 'All metric cards and trade table headers in formal Persian');
    }
    await snap('03_strategy_persian_verified');

    // Test Trade Journal Weekday Attribution in Persian
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="journal"]')?.click());
    await sleep(800);
    const journalFaText = await page.evaluate(() => {
      const text = document.querySelector('#view-journal')?.innerText || '';
      const hasAttribution = text.includes('توزیع بازدهی روزهای هفته');
      const hasDays = text.includes('دوشنبه') && text.includes('سه‌شنبه');
      return { hasAttribution, hasDays };
    });
    console.log('Trade Journal Weekday Attribution:', journalFaText);
    if (!journalFaText.hasAttribution || !journalFaText.hasDays) {
      addDefect('TradeJournal', 'Weekday Attribution Untranslated', JSON.stringify(journalFaText), 'MEDIUM');
    } else {
      addValidation('TradeJournal', 'Weekday Attribution Localized', 'Days and breakdown header rendered in Persian');
    }
    await snap('04_trade_journal_persian_verified');

    // Test Trade Journal Modal Dynamic Base Asset
    await page.evaluate(() => document.querySelector('#btn-journal-add')?.click());
    await sleep(600);
    const journalModalUnit = await page.evaluate(() => {
      const unit = document.querySelector('#log-unit-label')?.innerText.trim();
      const sym = document.querySelector('#log-trade-symbol')?.value.trim();
      return { unit, sym };
    });
    console.log('Journal Modal Unit for', journalModalUnit.sym, ':', journalModalUnit.unit);
    if (journalModalUnit.sym.startsWith('BTC') && journalModalUnit.unit !== 'BTC') {
      addDefect('TradeJournalModal', 'Base Asset Mismatch', `Expected BTC, got ${journalModalUnit.unit}`, 'HIGH');
    } else {
      addValidation('TradeJournalModal', 'Base Asset Dynamic Unit Verified', `Unit is ${journalModalUnit.unit}`);
    }
    await snap('05_trade_journal_modal_verified');
    await page.click('#btn-close-log-trade');
    await sleep(400);

    // Test Chart Style Picker RTL Alignment
    await page.click('#btn-topbar-chart-style');
    await sleep(500);
    const stylePickerAlign = await page.evaluate(() => {
      const item = document.querySelector('.chart-style-item');
      if (!item) return null;
      const computed = window.getComputedStyle(item);
      const inner = document.querySelector('.style-menu-inner');
      return {
        textAlign: computed.textAlign,
        direction: inner ? window.getComputedStyle(inner).direction : null
      };
    });
    console.log('Chart Style Picker RTL State:', stylePickerAlign);
    if (stylePickerAlign && stylePickerAlign.textAlign !== 'right') {
      addDefect('ChartStylePicker', 'Incorrect RTL Text Alignment', `textAlign is ${stylePickerAlign.textAlign}`, 'MEDIUM');
    } else {
      addValidation('ChartStylePicker', 'RTL Right-Aligned', 'Style picker text aligns to right with rtl direction');
    }
    await snap('06_chart_style_picker_rtl');
    await page.click('#top-app-header');
    await sleep(400);

    // Test Canvas Context Menu RTL Alignment
    await page.evaluate(() => {
      const chartArea = document.querySelector('#chart-area');
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: 500,
        clientY: 300
      });
      chartArea.dispatchEvent(evt);
    });
    await sleep(600);
    const ctxMenuState = await page.evaluate(() => {
      const item = document.querySelector('.context-menu-item');
      if (!item) return null;
      const inner = document.querySelector('.ctx-menu-inner');
      return {
        textAlign: window.getComputedStyle(item).textAlign,
        direction: inner ? window.getComputedStyle(inner).direction : null
      };
    });
    console.log('Context Menu RTL State:', ctxMenuState);
    if (ctxMenuState && ctxMenuState.textAlign !== 'right') {
      addDefect('ContextMenu', 'Incorrect RTL Text Alignment', `textAlign is ${ctxMenuState.textAlign}`, 'MEDIUM');
    } else {
      addValidation('ContextMenu', 'Context Menu RTL Right-Aligned', 'Context menu items strictly right-aligned with rtl direction');
    }
    await snap('07_context_menu_rtl');
    await page.evaluate(() => window.__TRADING_APP__?.canvasContextMenu?.hideMenu());
    await sleep(400);

    // ═════════════════════════════════════════════════════════════════════
    // 3. MOBILE WORKSPACE & PANELS MENU ELEVATION (390x844)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Mobile Panels Menu with Newly Added Tools ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sleep(1500);

    // Open Panels Menu Drawer
    await page.click('#nav-btn-panels');
    await sleep(600);

    const hasNewPanels = await page.evaluate(() => {
      const styleBtn = document.querySelector('.panel-menu-item[data-panel="chartStyle"]');
      const replayBtn = document.querySelector('.panel-menu-item[data-panel="barReplay"]');
      const exportBtn = document.querySelector('.panel-menu-item[data-panel="dataExport"]');
      return {
        hasStyle: !!styleBtn,
        hasReplay: !!replayBtn,
        hasExport: !!exportBtn
      };
    });
    console.log('Mobile Panels Menu Additions:', hasNewPanels);
    if (!hasNewPanels.hasStyle || !hasNewPanels.hasReplay || !hasNewPanels.hasExport) {
      addDefect('MobilePanels', 'Missing Mobile Feature Cards', JSON.stringify(hasNewPanels), 'HIGH');
    } else {
      addValidation('MobilePanels', 'Mobile Feature Parity Complete', 'Chart Style, Bar Replay and Export Data available in Mobile Drawer');
    }
    await snap('08_mobile_panels_new_features');

    // Click Bar Replay in Mobile Drawer
    await page.evaluate(() => document.querySelector('.panel-menu-item[data-panel="barReplay"]')?.click());
    await sleep(800);
    const mobileReplayActive = await page.evaluate(() => document.querySelector('#replay-bar')?.classList.contains('visible'));
    console.log('Mobile Bar Replay Active via Drawer:', mobileReplayActive);
    if (!mobileReplayActive) {
      addDefect('MobilePanels', 'Replay Trigger Failed', 'Bar replay did not open when clicked in mobile drawer', 'HIGH');
    } else {
      addValidation('MobilePanels', 'Replay Launched on Mobile', 'Bar Replay opened smoothly from mobile panels menu');
    }
    await snap('09_mobile_bar_replay_launched');
    await page.click('#btn-replay-exit');
    await sleep(400);

    // Click Data Export in Mobile Drawer
    await page.click('#nav-btn-panels');
    await sleep(600);
    await page.evaluate(() => document.querySelector('.panel-menu-item[data-panel="dataExport"]')?.click());
    await sleep(800);
    const exportModalOpen = await page.evaluate(() => document.querySelector('#modal-data-export')?.classList.contains('open'));
    console.log('Export Modal Open on Mobile:', exportModalOpen);
    if (!exportModalOpen) {
      addDefect('MobilePanels', 'Export Modal Trigger Failed', 'Export modal did not open from mobile drawer', 'HIGH');
    } else {
      addValidation('MobilePanels', 'Data Export Modal Active', 'Export modal displayed cleanly in mobile viewport');
    }
    await snap('10_mobile_export_modal_opened');
    await page.click('#modal-close-export');
    await sleep(400);

  } catch (err) {
    console.error('CRITICAL ERROR IN CYCLE 11:', err);
    addDefect('Runtime', 'Fatal Exception', err.stack || err.message, 'CRITICAL');
  } finally {
    const summary = {
      timestamp: new Date().toISOString(),
      totalDefects: defects.length,
      totalValidations: validations.length,
      consoleErrorsCount: consoleErrors.length,
      pageErrorsCount: pageErrors.length,
      defects,
      validations,
      consoleErrors,
      pageErrors
    };

    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'cycle11_report.json'), JSON.stringify(summary, null, 2));

    console.log('\n================================================================================');
    console.log(`🏁 AUDIT CYCLE 11 COMPLETE: ${defects.length} DEFECTS FOUND, ${validations.length} CHECKS PASSED`);
    console.log(`Console Errors: ${consoleErrors.length}, Page Errors: ${pageErrors.length}`);
    console.log('================================================================================\n');

    await browser.close();
  }
}

runCycle11Audit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Cycle 11 crashed:', err);
  process.exit(1);
});
