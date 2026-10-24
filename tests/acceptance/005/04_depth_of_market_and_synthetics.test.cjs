/**
 * @spec 005
 * @covers FR-014, FR-015
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
  console.log('[005 UI Test] Launching desktop browser for DOM Panel & Synthetic Styles...');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Synthetic Chart Styles Calculation & Contracts (FR-015)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const synth = await import('../../../client/src/syntheticChartTypes.js');
    const requiredExports = ['SYNTHETIC_TYPES', 'defaultBoxSize', 'toRenko', 'toKagi', 'toLineBreak', 'toRangeBars', 'toPnF', 'toHollow', 'toVolumeCandles'];
    for (const exp of requiredExports) {
      assert(typeof synth[exp] === 'function' || typeof synth[exp] === 'object',
        `FR-015 synthetic module export ${exp}`, `Missing export ${exp}`);
    }

    const typeKeys = Object.keys(synth.SYNTHETIC_TYPES);
    const expectedTypes = ['renko', 'kagi', 'linebreak', 'range', 'pnf', 'hollow', 'volumecandles'];
    for (const t of expectedTypes) {
      assert(typeKeys.includes(t), `FR-015 SYNTHETIC_TYPES registry entry ${t}`, `Missing ${t} in SYNTHETIC_TYPES`);
      assert(typeof synth.SYNTHETIC_TYPES[t].fn === 'function', `FR-015 ${t} transformer function`, `Missing fn for ${t}`);
      assert(typeof synth.SYNTHETIC_TYPES[t].name === 'string', `FR-015 ${t} English name`, `Missing name for ${t}`);
      assert(typeof synth.SYNTHETIC_TYPES[t].fa === 'string', `FR-015 ${t} Persian name`, `Missing fa for ${t}`);
    }

    // Deterministic test bars
    const testBars = [
      { time: 1000, open: 100, high: 105, low: 98, close: 103, volume: 10 },
      { time: 2000, open: 103, high: 108, low: 102, close: 107, volume: 20 },
      { time: 3000, open: 107, high: 107, low: 95, close: 96, volume: 15 },
      { time: 4000, open: 96, high: 102, low: 94, close: 101, volume: 30 },
      { time: 5000, open: 101, high: 110, low: 100, close: 109, volume: 25 },
      { time: 6000, open: 109, high: 115, low: 108, close: 114, volume: 18 }
    ];

    // toRenko
    const renkoBars = synth.toRenko(testBars, 2);
    assert(Array.isArray(renkoBars) && renkoBars.length > 0, 'FR-015 toRenko generates bars', 'Expected non-empty Renko bars');
    for (const b of renkoBars) {
      assert(Number.isFinite(b.time) && Number.isFinite(b.open) && Number.isFinite(b.close),
        'FR-015 renko bar numeric fields', 'Non-numeric field in Renko bar');
      assert(b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close),
        'FR-015 renko bar OHLC bounds', 'Invalid OHLC bounds in Renko bar');
    }

    // toKagi
    const kagiBars = synth.toKagi(testBars, 3);
    assert(Array.isArray(kagiBars) && kagiBars.length > 0, 'FR-015 toKagi generates bars', 'Expected non-empty Kagi bars');
    assert(kagiBars.some(b => '_yang' in b), 'FR-015 kagi _yang flag', 'Missing _yang flag in Kagi series');

    // toLineBreak
    const lbBars = synth.toLineBreak(testBars, 3);
    assert(Array.isArray(lbBars) && lbBars.length > 0, 'FR-015 toLineBreak generates bars', 'Expected non-empty LineBreak bars');

    // toRangeBars
    const rangeBars = synth.toRangeBars(testBars, 5);
    assert(Array.isArray(rangeBars) && rangeBars.length > 0, 'FR-015 toRangeBars generates bars', 'Expected non-empty Range bars');

    // toPnF
    const pnfBars = synth.toPnF(testBars, 2, 3);
    assert(Array.isArray(pnfBars) && pnfBars.length > 0, 'FR-015 toPnF generates bars', 'Expected non-empty PnF bars');

    // toHollow
    const hollowBars = synth.toHollow(testBars);
    assert(hollowBars.length === testBars.length, 'FR-015 toHollow preserves bar count', 'Hollow bar count mismatch');
    assert(hollowBars.every(b => typeof b._hollow === 'boolean' && typeof b._upBar === 'boolean'),
      'FR-015 hollow metadata flags', 'Missing _hollow or _upBar flags');

    // toVolumeCandles
    const volBars = synth.toVolumeCandles(testBars);
    assert(volBars.length === testBars.length, 'FR-015 toVolumeCandles preserves bar count', 'Volume bar count mismatch');
    assert(volBars.every(b => typeof b._volWidth === 'number' && b._volWidth >= 0 && b._volWidth <= 1),
      'FR-015 volume candle _volWidth fraction', 'Invalid _volWidth fraction');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Real Browser DOM Panel & Interactive Trading (FR-014)
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3000 });

    // Open Depth of Market panel via real click on right dock icon
    await realClick(page, '[data-panel="dom"]');
    await page.waitForSelector('.dom-wrapper', { visible: true, timeout: 6000 });

    // Fetch initial depth for default symbol (BTCUSDT)
    await page.evaluate(async () => {
      await window.__TRADING_APP__?.depthOfMarket?.fetchDepth?.();
    });
    await page.waitForFunction(() => document.querySelectorAll('.btn-dom-limit-buy').length >= 10, { timeout: 8000 });

    // 12-level ladder structure
    const ladderState = await page.evaluate(() => {
      const dom = window.__TRADING_APP__?.depthOfMarket;
      const bids = document.querySelectorAll('.dom-row.bid, .dom-ladder-bid, [class*="bid"]');
      const asks = document.querySelectorAll('.dom-row.ask, .dom-ladder-ask, [class*="ask"]');
      const lastPrice = document.querySelector('#dom-last-price')?.innerText?.trim();
      const spread = document.querySelector('#dom-spread')?.innerText?.trim();
      const badge = document.querySelector('#dom-source-badge')?.innerText?.trim();
      return {
        isVisible: dom?.isVisible?.(),
        bidCount: bids.length,
        askCount: asks.length,
        hasLastPrice: !!lastPrice && lastPrice.length > 0,
        hasSpread: !!spread && spread.length > 0,
        badge
      };
    });

    assert(ladderState.isVisible === true, 'FR-014 DOM isVisible returns true when open', 'Expected isVisible=true');
    assert(ladderState.bidCount === 12, 'FR-014 exactly 12 bid ladder rungs', `Expected 12 bids, got ${ladderState.bidCount}`);
    assert(ladderState.askCount === 12, 'FR-014 exactly 12 ask ladder rungs', `Expected 12 asks, got ${ladderState.askCount}`);
    assert(ladderState.hasLastPrice, 'FR-014 mark price rendered', 'Missing #dom-last-price');
    assert(ladderState.hasSpread, 'FR-014 spread rendered', 'Missing #dom-spread');
    assert(ladderState.badge === 'Live · Binance', 'FR-014 crypto source badge Live · Binance', `Expected "Live · Binance", got "${ladderState.badge}"`);

    // Visibility-gated polling: halts when switching away to another panel
    await realClick(page, '[data-panel="watchlist"]');
    await page.waitForFunction(() => !window.__TRADING_APP__?.depthOfMarket?.isVisible?.());
    const isVisibleAway = await page.evaluate(() => window.__TRADING_APP__?.depthOfMarket?.isVisible?.());
    assert(isVisibleAway === false, 'FR-014 visibility gating halts polling when panel hidden', 'Expected isVisible=false when panel hidden');

    // Switch back to DOM panel
    await realClick(page, '[data-panel="dom"]');
    await page.waitForSelector('.dom-wrapper', { visible: true, timeout: 5000 });

    // Non-crypto symbol switch -> Simulated ladder
    await page.evaluate(async () => {
      window.__TRADING_APP__.depthOfMarket?.setSymbol?.('FOOLAD');
      await window.__TRADING_APP__?.depthOfMarket?.fetchDepth?.();
    });
    await page.waitForFunction(() => document.querySelector('#dom-source-badge')?.innerText?.includes('Simulated') ||
      document.querySelector('#dom-source-badge')?.innerText?.includes('شبیه‌سازی'));

    const nonCryptoBadge = await page.evaluate(() => document.querySelector('#dom-source-badge')?.innerText?.trim());
    assert(nonCryptoBadge === 'Simulated', 'FR-014 non-crypto simulated badge', `Expected "Simulated", got "${nonCryptoBadge}"`);

    // Bilingual mode for DOM panel
    await page.evaluate(async () => {
      window.__TRADING_APP__.switchLanguage('fa');
      window.__TRADING_APP__.depthOfMarket?.setSymbol?.('FOOLAD');
      await window.__TRADING_APP__?.depthOfMarket?.fetchDepth?.();
    });
    await page.waitForFunction(() => document.querySelector('#dom-source-badge')?.innerText?.includes('شبیه‌سازی'));

    const faSimulatedBadge = await page.evaluate(() => document.querySelector('#dom-source-badge')?.innerText?.trim());
    assert(faSimulatedBadge === 'شبیه‌سازی‌شده', 'FR-014 Persian simulated badge', `Expected "شبیه‌سازی‌شده", got "${faSimulatedBadge}"`);

    // Switch back to English and BTCUSDT for quantity stepper & order placement
    await page.evaluate(async () => {
      window.__TRADING_APP__.switchLanguage('en');
      window.__TRADING_APP__.depthOfMarket?.setSymbol?.('BTCUSDT');
      await window.__TRADING_APP__?.depthOfMarket?.fetchDepth?.();
    });
    await page.waitForSelector('.btn-dom-limit-buy', { visible: true, timeout: 5000 });

    // Quantity stepper controls: increment (+0.05) and decrement (-0.05, min 0.01)
    const initialQty = await page.$eval('#dom-order-qty', el => parseFloat(el.value));
    await realClick(page, '#dom-qty-inc');
    const incQty = await page.$eval('#dom-order-qty', el => parseFloat(el.value));
    assert(Math.abs(incQty - (initialQty + 0.05)) < 0.001, 'FR-014 quantity stepper increment step 0.05',
      `Expected ${initialQty + 0.05}, got ${incQty}`);

    await realClick(page, '#dom-qty-dec');
    const decQty = await page.$eval('#dom-order-qty', el => parseFloat(el.value));
    assert(Math.abs(decQty - initialQty) < 0.001, 'FR-014 quantity stepper decrement step 0.05',
      `Expected ${initialQty}, got ${decQty}`);

    // Paper Market Buy order execution
    await realClick(page, '#dom-btn-market-buy');
    await page.waitForFunction(() => document.querySelector('#tradingchart-toast')?.classList.contains('is-visible'), { timeout: 5000 });
    const marketBuyToast = await page.$eval('#tradingchart-toast', el => el.innerText);
    assert(marketBuyToast.includes('BUY') && marketBuyToast.includes('market'),
      'FR-014 paper market buy execution toast', `Unexpected toast: "${marketBuyToast}"`);

    // One-click Limit Buy from ladder row
    await realClick(page, '.btn-dom-limit-buy');
    await page.waitForFunction(() => {
      const t = document.querySelector('#tradingchart-toast');
      return t?.classList.contains('is-visible') && t?.innerText?.includes('limit');
    }, { timeout: 5000 });
    const limitBuyToast = await page.$eval('#tradingchart-toast', el => el.innerText);
    assert(limitBuyToast.includes('Buy limit') || limitBuyToast.includes('placed'),
      'FR-014 one-click limit buy from ladder row toast', `Unexpected toast: "${limitBuyToast}"`);

    // Plan gate: Selecting synthetic chart type on Basic plan prompts plans modal (FR-014, FR-015)
    await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.setStyle?.('renko'));
    await page.waitForSelector('#tc-plans-modal.open', { visible: true, timeout: 5000 });
    const isPlansModalOpen = await page.evaluate(() => document.querySelector('#tc-plans-modal')?.classList.contains('open'));
    assert(isPlansModalOpen, 'FR-014/FR-015 synthetic chart type plan gate opens plans modal', 'Expected plans modal on renko style');

    console.log('PASS: 005 [DOM Panel & Synthetic Styles]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error in 04_depth_of_market_and_synthetics: ${err.stack || err.message}`);
  process.exit(1);
});
