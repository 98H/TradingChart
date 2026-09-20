// tests/qa_indicators_unified.cjs
// Verification of Single Unified Comprehensive Indicators Library for TradingChart

const puppeteer = require('puppeteer-core');
const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8088';

async function verifyUnifiedIndicators() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   TradingChart — Unified Comprehensive Indicators Verification   ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Bottom Menu Button Click
    console.log('1. Testing Bottom Menu Indicators Button (.vela-mb-indicators)...');
    const bottomRes = await page.evaluate(async () => {
      const btn = document.querySelector('.vela-mb-indicators');
      if (!btn) return { error: 'no bottom button' };
      btn.click();
      await new Promise(r => setTimeout(r, 600));

      const modal = document.querySelector('#modal-indicators');
      const isOpen = modal?.classList.contains('open');
      const cards = document.querySelectorAll('.ind-card-row');
      const countText = document.querySelector('#ind-count-label')?.innerText;

      // Ensure no Vela native duplicate dialog is open
      const velaDialogs = Array.from(document.querySelectorAll('.vela-dialog')).filter(d => {
        const s = window.getComputedStyle(d);
        return s.display !== 'none' && s.visibility !== 'hidden' && d.offsetParent !== null;
      });

      return { isOpen, totalCards: cards.length, countText, duplicateDialogs: velaDialogs.length };
    });

    console.log('   Bottom menu test result:', bottomRes);
    if (!bottomRes.isOpen || bottomRes.totalCards !== 114 || bottomRes.duplicateDialogs > 0) {
      throw new Error('Bottom menu verification failed: ' + JSON.stringify(bottomRes));
    }
    console.log('   \x1b[32m✓ [PASS]\x1b[0m Bottom menu button opens single unified modal with 114 indicators');

    // 2. Close modal
    await page.evaluate(() => {
      document.querySelector('#modal-close-ind')?.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // 3. Topbar Button Click
    console.log('\n2. Testing Topbar Indicators Button (.vela-widget-indicators)...');
    const topRes = await page.evaluate(async () => {
      const btn = document.querySelector('.vela-widget-indicators');
      if (!btn) return { error: 'no topbar button' };
      btn.click();
      await new Promise(r => setTimeout(r, 600));

      const modal = document.querySelector('#modal-indicators');
      const isOpen = modal?.classList.contains('open');
      const cards = document.querySelectorAll('.ind-card-row');

      return { isOpen, totalCards: cards.length };
    });

    console.log('   Topbar test result:', topRes);
    if (!topRes.isOpen || topRes.totalCards !== 114) {
      throw new Error('Topbar verification failed: ' + JSON.stringify(topRes));
    }
    console.log('   \x1b[32m✓ [PASS]\x1b[0m Topbar button opens the exact same unified modal with 114 indicators');

    // 4. Test Categories: SMC, Trend, Oscillators, Volatility, Volume
    console.log('\n3. Testing Category Filtering in Unified Library...');
    const catRes = await page.evaluate(async () => {
      const select = document.querySelector('#ind-cat-select');
      const results = {};
      for (const cat of ['all', 'smc', 'trend', 'oscillators', 'volatility', 'volume']) {
        select.value = cat;
        select.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 200));
        results[cat] = document.querySelectorAll('.ind-card-row').length;
      }
      return results;
    });

    console.log('   Category counts in unified library:', catRes);
    if (catRes.all !== 114 || catRes.smc < 10 || catRes.trend < 20 || catRes.oscillators < 20 || catRes.volatility < 15 || catRes.volume < 15) {
      throw new Error('Category filter verification failed: ' + JSON.stringify(catRes));
    }
    console.log('   \x1b[32m✓ [PASS]\x1b[0m All categories cleanly partitioned across all 114 indicators');

    // 5. Test Adding Both Native (e.g. ADX) and SMC (e.g. SMC Order Blocks)
    console.log('\n4. Testing Adding Indicators to Active Chart Canvas...');
    const addRes = await page.evaluate(async () => {
      // Ensure modal is open
      const modal = document.querySelector('#modal-indicators');
      if (!modal?.classList.contains('open')) {
        document.querySelector('.vela-mb-indicators')?.click();
        await new Promise(r => setTimeout(r, 400));
      }

      // Reset category to all
      const select = document.querySelector('#ind-cat-select');
      if (select) {
        select.value = 'all';
        select.dispatchEvent(new Event('change'));
      }
      await new Promise(r => setTimeout(r, 200));

      // Add native indicator ADX
      const search = document.querySelector('#ind-search-input');
      search.value = 'ADX';
      search.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 400));
      const adxCard = document.querySelector('.ind-card[data-id="adx"]');
      const adxBtn = adxCard?.querySelector('.add-ind-btn');
      adxBtn?.click();
      await new Promise(r => setTimeout(r, 400));
      const adxAdded = adxBtn?.innerText.includes('Added') || adxBtn?.innerText.includes('افزوده');

      // Add SMC Order Blocks
      search.value = 'Order Blocks';
      search.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 400));
      const smcCard = document.querySelector('.ind-card[data-id="smc_order_blocks"]');
      const smcBtn = smcCard?.querySelector('.add-ind-btn');
      smcBtn?.click();
      await new Promise(r => setTimeout(r, 400));
      const smcAdded = smcBtn?.innerText.includes('Added') || smcBtn?.innerText.includes('افزوده');

      const toast = document.querySelector('#tradingchart-toast');
      return {
        adxFound: !!adxCard,
        adxAdded: !!adxAdded,
        smcFound: !!smcCard,
        smcAdded: !!smcAdded,
        toastText: toast ? toast.innerText : ''
      };
    });

    console.log('   Add indicators test result:', addRes);
    if (!addRes.adxAdded || !addRes.smcAdded) {
      throw new Error('Adding indicators failed: ' + JSON.stringify(addRes));
    }
    console.log('   \x1b[32m✓ [PASS]\x1b[0m Successfully added both native and Pine/SMC indicators');

    // 6. Persian RTL Verification
    console.log('\n5. Testing Persian RTL Localization of Unified Modal...');
    const faRes = await page.evaluate(async () => {
      window.__TRADING_APP__?.switchLanguage('fa');
      await new Promise(r => setTimeout(r, 400));

      const countText = document.querySelector('#ind-count-label')?.innerText;
      const isRtl = document.querySelector('.modal-box')?.getAttribute('dir') === 'rtl' || window.getComputedStyle(document.querySelector('.modal-box')).direction === 'rtl';

      return { countText, isRtl };
    });

    console.log('   Persian mode result:', faRes);
    if (!faRes.countText.includes('۱۱۴') || !faRes.isRtl) {
      throw new Error('Persian verification failed: ' + JSON.stringify(faRes));
    }
    console.log('   \x1b[32m✓ [PASS]\x1b[0m Persian RTL localization fully consistent with ۱۱۴ indicators');

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('   ALL 5 UNIFIED INDICATORS SUITE TESTS PASSED WITH ZERO DEFECTS  ');
    console.log('═══════════════════════════════════════════════════════════════════');
  } finally {
    await browser.close();
  }
}

verifyUnifiedIndicators().catch(err => {
  console.error('Fatal error in unified indicators suite:', err);
  process.exit(1);
});
