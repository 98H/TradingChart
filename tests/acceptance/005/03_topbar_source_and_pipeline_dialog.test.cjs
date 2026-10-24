/**
 * @spec 005
 * @covers FR-010, FR-012
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('[005 UI Test] Launching desktop browser for Topbar & Pipeline Dialog...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Honest Source Labelling in Topbar (FR-010, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Default symbol is BTCUSDT (Crypto -> Binance Direct LIVE)
      await page.waitForSelector('#btn-topbar-market-source', { visible: true });
      const btcState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-topbar-market-source');
        const label = document.querySelector('#topbar-source-label')?.innerText?.trim();
        const route = document.querySelector('#topbar-source-route')?.innerText?.trim();
        const isDemo = btn?.classList.contains('is-demo-feed');
        return { label, route, isDemo };
      });

      assert(btcState.label === 'BINANCE', 'FR-010 crypto source label BINANCE', `Expected "BINANCE", got "${btcState.label}"`);
      assert(btcState.route === 'LIVE', 'FR-010 crypto source route LIVE', `Expected "LIVE", got "${btcState.route}"`);
      assert(btcState.isDemo === false, 'FR-010 crypto not marked demo feed', 'Crypto should not have .is-demo-feed class');

      // Switch to Tehran Stock (FOOLAD) -> TEHRAN BOURSE / DEMO
      await page.evaluate(() => window.__TRADING_APP__.switchSymbol('FOOLAD'));
      await page.waitForFunction(() => document.querySelector('#topbar-source-label')?.innerText?.includes('TEHRAN') ||
        document.querySelector('#topbar-source-label')?.innerText?.includes('بورس'));

      const fooladState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-topbar-market-source');
        const label = document.querySelector('#topbar-source-label')?.innerText?.trim();
        const route = document.querySelector('#topbar-source-route')?.innerText?.trim();
        const isDemo = btn?.classList.contains('is-demo-feed');
        return { label, route, isDemo };
      });

      assert(fooladState.label === 'TEHRAN BOURSE', 'FR-010 FOOLAD source label', `Expected "TEHRAN BOURSE", got "${fooladState.label}"`);
      assert(fooladState.route === 'DEMO', 'FR-010 FOOLAD source route', `Expected "DEMO", got "${fooladState.route}"`);
      assert(fooladState.isDemo === true, 'FR-010 FOOLAD marked demo feed', 'Non-crypto must have .is-demo-feed class');

      // Switch to Tehran Gold (GOLD_ABSHODEH) -> TEHRAN GOLD / DEMO
      await page.evaluate(() => window.__TRADING_APP__.switchSymbol('GOLD_ABSHODEH'));
      await page.waitForFunction(() => document.querySelector('#topbar-source-label')?.innerText?.includes('GOLD') ||
        document.querySelector('#topbar-source-label')?.innerText?.includes('طلا'));

      const goldState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-topbar-market-source');
        const label = document.querySelector('#topbar-source-label')?.innerText?.trim();
        const route = document.querySelector('#topbar-source-route')?.innerText?.trim();
        const isDemo = btn?.classList.contains('is-demo-feed');
        return { label, route, isDemo };
      });

      assert(goldState.label === 'TEHRAN GOLD', 'FR-010 GOLD_ABSHODEH source label', `Expected "TEHRAN GOLD", got "${goldState.label}"`);
      assert(goldState.route === 'DEMO', 'FR-010 GOLD_ABSHODEH source route', `Expected "DEMO", got "${goldState.route}"`);
      assert(goldState.isDemo === true, 'FR-010 GOLD_ABSHODEH marked demo feed', 'Tehran gold must have .is-demo-feed class');

      // Switch to Forex (EURUSD) -> FOREX / DEMO
      await page.evaluate(() => window.__TRADING_APP__.switchSymbol('EURUSD'));
      await page.waitForFunction(() => document.querySelector('#topbar-source-label')?.innerText?.includes('FOREX') ||
        document.querySelector('#topbar-source-label')?.innerText?.includes('فارکس'));

      const forexState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-topbar-market-source');
        const label = document.querySelector('#topbar-source-label')?.innerText?.trim();
        const route = document.querySelector('#topbar-source-route')?.innerText?.trim();
        const isDemo = btn?.classList.contains('is-demo-feed');
        return { label, route, isDemo };
      });

      assert(forexState.label === 'FOREX', 'FR-010 EURUSD source label', `Expected "FOREX", got "${forexState.label}"`);
      assert(forexState.route === 'DEMO', 'FR-010 EURUSD source route', `Expected "DEMO", got "${forexState.route}"`);
      assert(forexState.isDemo === true, 'FR-010 EURUSD marked demo feed', 'Forex must have .is-demo-feed class');

      // Bilingual Parity: Switch to Persian ('fa')
      await page.evaluate(() => {
        window.__TRADING_APP__.switchLanguage('fa');
        window.__TRADING_APP__.switchSymbol('FOOLAD');
      });
      await page.waitForFunction(() => document.querySelector('#topbar-source-label')?.innerText?.includes('بورس'));

      const faFooladState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-topbar-market-source');
        const label = document.querySelector('#topbar-source-label')?.innerText?.trim();
        const route = document.querySelector('#topbar-source-route')?.innerText?.trim();
        const isDemo = btn?.classList.contains('is-demo-feed');
        return { label, route, isDemo };
      });

      assert(faFooladState.label === 'بورس تهران', 'FR-010 Persian FOOLAD label', `Expected "بورس تهران", got "${faFooladState.label}"`);
      assert(faFooladState.route === 'نمایشی', 'FR-010 Persian FOOLAD route', `Expected "نمایشی", got "${faFooladState.route}"`);
      assert(faFooladState.isDemo === true, 'FR-010 Persian FOOLAD demo styling', 'Expected .is-demo-feed class');

      // Switch back to English and BTCUSDT for pipeline dialog test
      await page.evaluate(() => {
        window.__TRADING_APP__.switchLanguage('en');
        window.__TRADING_APP__.switchSymbol('BTCUSDT');
      });
      await page.waitForFunction(() => document.querySelector('#topbar-source-label')?.innerText === 'BINANCE');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Market Data Pipeline Modal (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open modal via real click on topbar source badge
      await realClick(page, '#btn-topbar-market-source');
      await page.waitForSelector('#modal-market-sources.open', { visible: true, timeout: 5000 });
      await page.waitForFunction(() => document.querySelectorAll('#modal-market-sources .source-card').length === 5, { timeout: 8000 });

      // Verify rendered content: 5 route cards with status & latency
      const modalData = await page.evaluate(() => {
        const modal = document.querySelector('#modal-market-sources');
        const cards = Array.from(modal?.querySelectorAll('.source-card') || []);
        const content = modal?.querySelector('#market-sources-content')?.innerText || '';
        const hasPingButton = !!modal?.querySelector('#btn-sources-refresh-ping');
        const hasCloseButton = !!modal?.querySelector('#modal-close-sources');
        return {
          cardCount: cards.length,
          hasPingButton,
          hasCloseButton,
          hasLatency: content.includes('ms'),
          cardTiers: cards.map(c => c.querySelector('.source-card-tier, [class*="tier"]')?.innerText?.trim())
        };
      });

      assert(modalData.cardCount === 5, 'FR-012 exactly 5 route cards rendered', `Expected 5 cards, got ${modalData.cardCount}`);
      assert(modalData.hasPingButton, 'FR-012 Ping Test button present', 'Missing #btn-sources-refresh-ping');
      assert(modalData.hasCloseButton, 'FR-012 close button present', 'Missing #modal-close-sources');
      assert(modalData.hasLatency, 'FR-012 telemetry latency displayed', 'Missing latency in ms');

      // Click Ping Test via real click and verify latency refresh
      await realClick(page, '#btn-sources-refresh-ping');
      await page.waitForFunction(() => {
        const text = document.querySelector('#market-sources-content')?.innerText || '';
        return text.includes('ms');
      }, { timeout: 8000 });

      // Dismiss via close button click
      await realClick(page, '#modal-close-sources');
      await page.waitForFunction(() => !document.querySelector('#modal-market-sources')?.classList.contains('open'));

      const isClosedBtn = await page.evaluate(() => !document.querySelector('#modal-market-sources')?.classList.contains('open'));
      assert(isClosedBtn, 'FR-012 modal closed via close button', 'Modal still open after close click');

      // Reopen and dismiss via backdrop click
      await realClick(page, '#btn-topbar-market-source');
      await page.waitForSelector('#modal-market-sources.open', { visible: true, timeout: 5000 });

      const modalHandle = await page.$('#modal-market-sources');
      const box = await modalHandle.boundingBox();
      // Click outside content card, in the dark backdrop region
      await page.mouse.click(box.x + 15, box.y + 15);
      await page.waitForFunction(() => !document.querySelector('#modal-market-sources')?.classList.contains('open'));

      const isClosedBackdrop = await page.evaluate(() => !document.querySelector('#modal-market-sources')?.classList.contains('open'));
      assert(isClosedBackdrop, 'FR-012 modal closed via backdrop click', 'Modal still open after backdrop click');
    }

    console.log('PASS: 005 [Topbar Source & Pipeline Dialog]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error in 03_topbar_source_and_pipeline_dialog: ${err.message}`);
  process.exit(1);
});
