// tests/test_journal_and_timeframe.cjs
// End-to-End Browser QA Test for Trade Journal Modal Submission and Custom Timeframe Creation
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../dogfood_cycle7');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

async function runCycle7() {
  console.log('================================================================');
  console.log('📝 CYCLE 7: TRADE JOURNAL LOGGING & CUSTOM TIMEFRAME BUILDER');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await snap('01_cycle7_init');

    // ── 1. TEST LOG TRADE MODAL INTERACTION ──────────────────────────
    console.log('\n--- 1. Testing Trade Journal Modal Submission ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.tradeJournalModal?.open?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('02_log_trade_modal_open');

    // Click SELL / SHORT direction pill
    await page.click('#side-pill-sell');
    await new Promise(r => setTimeout(r, 300));

    // Fill trade values: entry 81500, exit 81000, qty 0.25
    await page.evaluate(() => {
      const entry = document.querySelector('#log-trade-entry');
      const exit = document.querySelector('#log-trade-exit');
      const qty = document.querySelector('#log-trade-qty');
      if (entry) entry.value = '81500';
      if (exit) exit.value = '81000';
      if (qty) qty.value = '0.25';
      entry?.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 400));
    await snap('03_log_trade_short_filled');

    // Submit trade
    await page.click('#btn-save-log-trade');
    await new Promise(r => setTimeout(r, 800));

    // Verify toast & trade logged into TradeJournal
    const journalCheck = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const executions = app?.tradeJournal?.sampleExecutions || [];
      const firstExec = executions[0];
      return {
        totalExecutions: executions.length,
        firstSymbol: firstExec?.symbol,
        firstPrice: firstExec?.price,
        firstSide: firstExec?.side
      };
    });
    console.log('Trade Journal check after log:', journalCheck);

    // ── 2. TEST CUSTOM TIMEFRAME BUILDER ─────────────────────────────
    console.log('\n--- 2. Testing Custom Timeframe Builder ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.timeframeManager?.open?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('04_timeframe_modal_open');

    // Enter custom value 45 minutes
    await page.evaluate(() => {
      const valInput = document.querySelector('#input-custom-tf-val');
      const unitSelect = document.querySelector('#select-custom-tf-unit');
      if (valInput) valInput.value = '45';
      if (unitSelect) unitSelect.value = 'm';
    });
    await page.click('#btn-add-custom-tf');
    await new Promise(r => setTimeout(r, 600));
    await snap('05_custom_timeframe_added');

    // Select the 45m timeframe
    const select45mResult = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.btn-select-tf')).find(b => b.innerText.trim() === '45m' || b.getAttribute('data-id') === '45');
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    console.log('Clicked 45m timeframe:', select45mResult);
    await new Promise(r => setTimeout(r, 1200));

    const activeTfAfter = await page.evaluate(() => window.__TRADING_APP__?.currentTimeframe);
    console.log('Active timeframe after switch:', activeTfAfter);
    await snap('06_chart_on_45m');

  } catch (err) {
    console.error('Cycle 7 error:', err);
    errors.push({ type: 'fatal', text: err.message });
  } finally {
    console.log('\n========================================');
    console.log('CYCLE 7 AUDIT SUMMARY');
    console.log('Errors encountered:', errors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(DIR, 'cycle7_results.json'),
      JSON.stringify({ errors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runCycle7().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
