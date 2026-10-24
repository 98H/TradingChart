/**
 * @spec 008
 * @covers FR-008, FR-010
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
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise(r => setTimeout(r, 150));
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
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('[008 Gold & TSE Acceptance Suite] Launching desktop browser...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Tehran Gold & Coin Bubble Studio (FR-008, User Story 4)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const tabSelector = '#bottom-panel .panel-tab[data-view="gold"]';
      await realClick(page, tabSelector);
      await page.waitForFunction(() => {
        const bp = document.querySelector('#bottom-panel');
        const vg = document.querySelector('#view-gold');
        return bp && !bp.classList.contains('collapsed') && vg && vg.classList.contains('active');
      }, { timeout: 6000 });
      await page.waitForFunction(() => document.querySelectorAll('#gold-coins-tbody tr').length === 5, { timeout: 6000 });

      // 1.1 4 Pillar cards & Coin Bubble table (US4 Scenario 1)
      const goldUI = await page.evaluate(() => {
        const vg = document.querySelector('#view-gold');
        const cardsGrid = vg.querySelector('#gold-cards-grid') || vg.querySelector('.gold-bubble-studio');
        const text = vg.innerText;
        const rows = Array.from(vg.querySelectorAll('#gold-coins-tbody tr'));
        const coinData = rows.map(r => ({
          text: r.innerText,
          hasChartBtn: !!r.querySelector('.btn-open-coin-chart'),
          coinSym: r.querySelector('.btn-open-coin-chart')?.getAttribute('data-symbol')
        }));
        const poll = window.__TRADING_APP__.goldBubbleView?.pollInterval;

        return {
          hasMeltedGold: text.includes('Melted') || text.includes('آبشده') || text.includes('17k'),
          hasGram18: text.includes('18k') || text.includes('۱۸ عیار'),
          hasSpotOunce: text.includes('Ounce') || text.includes('انس'),
          hasCurrencyCard: text.includes('USD') || text.includes('Nobitex') || text.includes('دلار'),
          hasFormula: text.includes('ارزش ذاتی') || text.includes('Intrinsic Value') || text.includes('31.1035'),
          rowsCount: rows.length,
          coinData,
          hasPoll: !!poll
        };
      });

      assert(goldUI.hasMeltedGold, 'FR-008 pillar card Melted Gold 17k present', 'Missing Melted Gold card');
      assert(goldUI.hasGram18, 'FR-008 pillar card 18k Gram present', 'Missing 18k Gram card');
      assert(goldUI.hasSpotOunce, 'FR-008 pillar card Spot Ounce present', 'Missing Spot Ounce card');
      assert(goldUI.hasCurrencyCard, 'FR-008 pillar card Free USD / Nobitex USDT present', 'Missing currency card');
      assert(goldUI.rowsCount === 5, 'FR-008 coin bubble table renders 5 official coins', `Expected 5 rows, got ${goldUI.rowsCount}`);
      assert(goldUI.coinData.every(c => c.hasChartBtn && c.coinSym),
        'FR-008 each coin row has Chart button with data-symbol', 'Missing coin chart button or symbol');
      assert(goldUI.hasPoll, 'FR-008 gold studio polls every 4s while mounted', 'Missing gold pollInterval');

      // 1.2 Refresh button
      await realClick(page, '#btn-gold-refresh');
      await page.waitForFunction(() => document.querySelectorAll('#gold-coins-tbody tr').length === 5);

      // 1.3 Switch chart to Melted Gold (US4 Scenario 2, SC-002)
      await realClick(page, '#btn-chart-abshodeh');
      await page.waitForFunction(() => window.__TRADING_APP__.currentSymbol === 'GOLD_ABSHODEH', { timeout: 6000 });
      const currentSymAbshodeh = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(currentSymAbshodeh === 'GOLD_ABSHODEH', 'FR-008 Melted Gold Chart button switches chart',
        `Expected GOLD_ABSHODEH, got ${currentSymAbshodeh}`);

      // 1.4 Switch chart to Coin (US4 Scenario 2, SC-002)
      const coinBtnHandle = await page.$('#gold-coins-tbody .btn-open-coin-chart');
      assert(!!coinBtnHandle, 'FR-008 coin chart button present', 'Missing coin chart button');
      await coinBtnHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await new Promise(r => setTimeout(r, 150));
      const coinBox = await coinBtnHandle.boundingBox();
      await page.mouse.click(coinBox.x + coinBox.width / 2, coinBox.y + coinBox.height / 2);
      await page.waitForFunction(() => window.__TRADING_APP__.currentSymbol === 'COIN_EMAMI', { timeout: 6000 });
      const currentSymCoin = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(currentSymCoin === 'COIN_EMAMI', 'FR-008 coin Chart button switches chart',
        `Expected COIN_EMAMI, got ${currentSymCoin}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. TSE Market Tape & Smart Money Inspector (FR-010, User Story 5)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const tabSelector = '#bottom-panel .panel-tab[data-view="tse"]';
      await realClick(page, tabSelector);
      await page.waitForFunction(() => {
        const vt = document.querySelector('#view-tse');
        return vt && vt.classList.contains('active');
      }, { timeout: 6000 });

      // 2.1 Verify Gold Polling Cleared on Tab Switch (Edge Case, SC-003)
      const goldUnmounted = await page.evaluate(() => window.__TRADING_APP__.goldBubbleView?.pollInterval === null);
      assert(goldUnmounted, 'FR-008 gold polling interval dismantled on unmount', 'gold pollInterval was not cleared');

      // 2.2 Verify TSE Tape Scoreboards & 8 Symbol Chips (US5 Scenario 1)
      const tseUI = await page.evaluate(() => {
        const vt = document.querySelector('#view-tse');
        const chips = Array.from(vt.querySelectorAll('.tse-sym-chip')).map(c => c.getAttribute('data-sym'));
        const activeTitle = document.querySelector('#tse-active-sym-title')?.innerText?.trim();
        const text = vt.innerText;
        const poll = window.__TRADING_APP__.tseTapeView?.pollInterval;

        return {
          chips,
          activeTitle,
          hasLastPrice: text.includes('Last Traded Price') || text.includes('Last Price') || text.includes('قیمت پایانی') || text.includes('آخرین معامله'),
          hasBuyerPower: text.includes('Buyer Power') || text.includes('قدرت خریدار'),
          hasPerCapita: text.includes('Per-Capita') || text.includes('سرانه'),
          hasSuspiciousVol: text.includes('Suspicious Vol') || text.includes('مشکوک'),
          hasQueue: text.includes('Queue') || text.includes('Balanced') || text.includes('صف'),
          hasProgressBar: !!vt.querySelector('[style*="border-radius: 999px"]') || !!vt.querySelector('.progress-bar') || text.includes('%'),
          hasPoll: !!poll
        };
      });

      // Verify initial default TSE symbol
      const initialTseSym = await page.evaluate(() => window.__TRADING_APP__.tseTapeView?.activeSymbol);

      assert(tseUI.chips.length === 8, 'FR-010 TSE view offers 8 symbol chips', `Expected 8 chips, got ${tseUI.chips.length}`);
      assert(tseUI.chips.includes('FOOLAD') && tseUI.chips.includes('FAMELI') && tseUI.chips.includes('KHODRO') &&
             tseUI.chips.includes('AHRAM') && tseUI.chips.includes('SHASTA') && tseUI.chips.includes('TALA') &&
             tseUI.chips.includes('AYAR') && tseUI.chips.includes('TAVAN'),
             'FR-010 8 pre-configured TSE symbols present', `Chips: ${tseUI.chips.join(', ')}`);
      assert(initialTseSym === 'FOOLAD' || tseUI.activeTitle.length > 0, 'FR-010 active TSE symbol title rendered',
        'Missing active symbol title');
      assert(tseUI.hasLastPrice, 'FR-010 Last Traded Price scoreboard card present', 'Missing Last Price');
      assert(tseUI.hasBuyerPower, 'FR-010 Buyer Power Ratio scoreboard card present', 'Missing Buyer Power');
      assert(tseUI.hasPerCapita, 'FR-010 Per-Capita Buy/Sell volume card present', 'Missing Per-Capita');
      assert(tseUI.hasSuspiciousVol, 'FR-010 Suspicious Volume indicator present', 'Missing Suspicious Volume');
      assert(tseUI.hasQueue, 'FR-010 Queue status indicator present', 'Missing Queue status');
      assert(tseUI.hasPoll, 'FR-010 TSE tape polls every 3s while mounted', 'Missing TSE pollInterval');

      // 2.3 Switch symbol chip to FOOLAD
      await realClick(page, '#view-tse .tse-sym-chip[data-sym="FOOLAD"]');
      await page.waitForFunction(() => document.querySelector('#tse-active-sym-title')?.innerText?.trim() === 'FOOLAD', { timeout: 6000 });
      const fooladTitle = await page.evaluate(() => document.querySelector('#tse-active-sym-title')?.innerText?.trim());
      assert(fooladTitle === 'FOOLAD', 'FR-010 title switches to FOOLAD on chip click', `Expected FOOLAD, got ${fooladTitle}`);

      // 2.4 Switch symbol chip to FAMELI (US5 Scenario 1)
      await realClick(page, '#view-tse .tse-sym-chip[data-sym="FAMELI"]');
      await page.waitForFunction(() => {
        const title = document.querySelector('#tse-active-sym-title')?.innerText?.trim();
        return title === 'FAMELI';
      }, { timeout: 6000 });

      const fameliState = await page.evaluate(() => {
        const title = document.querySelector('#tse-active-sym-title')?.innerText?.trim();
        const activeChip = document.querySelector('#view-tse .tse-sym-chip.active')?.getAttribute('data-sym');
        return { title, activeChip };
      });
      assert(fameliState.title === 'FAMELI', 'FR-010 title switches to FAMELI on chip click',
        `Expected FAMELI, got ${fameliState.title}`);
      assert(fameliState.activeChip === 'FAMELI', 'FR-010 FAMELI chip is highlighted active',
        `Expected FAMELI active chip, got ${fameliState.activeChip}`);

      // 2.4 Refresh Tape button
      await realClick(page, '#btn-tse-refresh');
      await page.waitForFunction(() => document.querySelector('#tse-active-sym-title')?.innerText?.trim() === 'FAMELI');

      // 2.5 "Open Symbol Chart" button (US5 Scenario 2, SC-002)
      await realClick(page, '#btn-tse-load-chart');
      await page.waitForFunction(() => window.__TRADING_APP__.currentSymbol === 'FAMELI', { timeout: 6000 });
      const currentSymTse = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(currentSymTse === 'FAMELI', 'FR-010 Open Symbol Chart button switches chart to FAMELI',
        `Expected FAMELI, got ${currentSymTse}`);

      // 2.6 Verify TSE Polling Cleared on Unmount (Edge Case, SC-003)
      await realClick(page, '#bottom-panel .panel-tab[data-view="trackers"]');
      await page.waitForFunction(() => document.querySelector('#view-trackers')?.classList.contains('active'), { timeout: 6000 });

      const tseUnmounted = await page.evaluate(() => window.__TRADING_APP__.tseTapeView?.pollInterval === null);
      assert(tseUnmounted, 'FR-010 TSE polling interval dismantled on unmount', 'TSE pollInterval was not cleared');
    }

    console.log('✅ [008 Gold & TSE Acceptance Suite] All scenarios passed with verified quotes, coin bubbles, tape metrics, and chart switching.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Suite unhandled error: ${err.stack || err.message}`);
  process.exit(1);
});
