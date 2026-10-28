/**
 * @spec 015
 * @covers FR-009, FR-010, FR-013
 */
const fs = require('fs');
const path = require('path');
const { launch, boot, closeAllBrowsers } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 8000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 100));
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
    const topInfo = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { tag: top?.tagName, id: top?.id, cls: top?.className };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(topInfo)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log(`[015 Acceptance Suite 05] Running Client Badges, Timeframes UI & Accuracy Audit against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Accuracy Audit Tool File & Logic Verification (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const auditPath = path.resolve(__dirname, '../../../tools/accuracy_audit.mjs');
    assert(fs.existsSync(auditPath), 'FR-010 accuracy audit script exists',
      `File ${auditPath} does not exist`);

    const auditSrc = fs.readFileSync(auditPath, 'utf8');
    assert(auditSrc.includes('200') || auditSrc.includes('sample'),
      'FR-010 audit script samples symbols across categories', 'Missing sampling logic');
    assert(auditSrc.includes('accuracy.json'),
      'FR-010 audit script outputs accuracy.json', 'Missing accuracy.json output');
    assert(auditSrc.includes('mismatches'),
      'FR-010 audit script checks mismatches', 'Missing mismatches check');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Real Browser UX: Badges, Timeframe Gating & Notices (FR-009, FR-013)
  // ──────────────────────────────────────────────────────────────────────────
  let ctx = null;
  try {
    ctx = await launch('desktop');
    const { page } = ctx;
    await boot(ctx, { settle: 3500 });

    // ── 2.1 Topbar Source and Status Badges (FR-009) ──
    {
      // (a) Switch to Delayed Instrument: SP:SPX
      await page.evaluate(() => {
        window.__TRADING_APP__?.switchLanguage?.('fa');
        window.__TRADING_APP__?.switchSymbol?.('SP:SPX');
      });
      await new Promise(r => setTimeout(r, 1000));

      const spxBadge = await page.evaluate(() => {
        const badge = document.querySelector('#topbar-source-badge, .topbar-data-status, [data-testid="market-status-badge"]');
        return badge?.innerText?.trim() || '';
      });

      // Must show "تأخیر ۱۰ دقیقه" or "Delayed 10 min", NEVER "LIVE" or "زنده"
      assert(spxBadge.includes('تأخیر') || spxBadge.toLowerCase().includes('delayed'),
        'FR-009 SP:SPX badge shows delayed status in Persian',
        `Expected delayed badge for SP:SPX, got "${spxBadge}"`);
      assert(!spxBadge.includes('زنده') && !spxBadge.toLowerCase().includes('live'),
        'FR-009 SP:SPX badge never shows LIVE', `SP:SPX badge was "${spxBadge}"`);

      // Switch to English to test bilingual parity
      await page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      await new Promise(r => setTimeout(r, 500));

      const spxBadgeEn = await page.evaluate(() => {
        const badge = document.querySelector('#topbar-source-badge, .topbar-data-status, [data-testid="market-status-badge"]');
        return badge?.innerText?.trim() || '';
      });
      assert(spxBadgeEn.toLowerCase().includes('delayed') || spxBadgeEn.includes('10 min'),
        'FR-009 SP:SPX badge shows delayed in English', `Got "${spxBadgeEn}"`);

      // (b) Switch to Real-time Binance Crypto: BINANCE:BTCUSDT
      await page.evaluate(() => window.__TRADING_APP__?.switchSymbol?.('BINANCE:BTCUSDT'));
      await new Promise(r => setTimeout(r, 1000));

      const btcBadge = await page.evaluate(() => {
        const badge = document.querySelector('#topbar-source-badge, .topbar-data-status, [data-testid="market-status-badge"]');
        return badge?.innerText?.trim() || '';
      });
      assert(btcBadge.toUpperCase().includes('LIVE'),
        'FR-009 BTCUSDT badge shows LIVE', `Expected LIVE badge, got "${btcBadge}"`);

      // (c) Switch to TGJU Instrument: IR:COIN_EMAMI
      await page.evaluate(() => window.__TRADING_APP__?.switchSymbol?.('IR:COIN_EMAMI'));
      await new Promise(r => setTimeout(r, 1000));

      const coinBadge = await page.evaluate(() => {
        const badge = document.querySelector('#topbar-source-badge, .topbar-data-status, [data-testid="market-status-badge"]');
        return badge?.innerText?.trim() || '';
      });
      assert(coinBadge.toUpperCase().includes('EOD') || coinBadge.toLowerCase().includes('tgju') || coinBadge.includes('پایان روز'),
        'FR-009 IR:COIN_EMAMI badge reflects EOD / TGJU status', `Got "${coinBadge}"`);
    }

    // ── 2.2 Timeframe Restriction for TGJU Symbols (FR-009) ──
    {
      await page.evaluate(() => {
        window.__TRADING_APP__?.switchLanguage?.('fa');
        window.__TRADING_APP__?.switchSymbol?.('IR:COIN_EMAMI');
      });
      await new Promise(r => setTimeout(r, 1000));

      // Intraday timeframe buttons (1m, 5m, 15m, 1h, 4h) must be disabled
      const tfGating = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const entry = app?.symbolCatalog?.get?.('IR:COIN_EMAMI') || app?.currentCatalogEntry;
        const btn1h = document.querySelector('[data-tf="60"], [data-timeframe="60"], #tf-btn-60');
        const is1hDisabled = btn1h?.disabled || btn1h?.getAttribute('aria-disabled') === 'true' ||
          btn1h?.classList?.contains('disabled') || btn1h?.classList?.contains('is-disabled');
        const tooltip = btn1h?.getAttribute('title') || btn1h?.getAttribute('data-tooltip') || '';
        return { is1hDisabled, tooltip, allowed: entry?.timeframes };
      });

      assert(tfGating.is1hDisabled,
        'FR-009 intraday 1h button disabled for TGJU symbol',
        'Intraday button should be disabled for IR:COIN_EMAMI');
      assert(tfGating.tooltip.includes('روزانه') || tfGating.tooltip.includes('daily'),
        'FR-009 disabled timeframe tooltip shows explanation',
        `Expected tooltip with daily-only notice, got "${tfGating.tooltip}"`);
    }

    // ── 2.3 Removed Symbol in Saved State / Watchlist Notice (FR-009) ──
    {
      // Simulate loading a removed symbol into the chart or watchlist
      await page.evaluate(() => {
        window.__TRADING_APP__?.switchLanguage?.('fa');
        window.__TRADING_APP__?.switchSymbol?.('FOOLAD');
      });
      await new Promise(r => setTimeout(r, 1000));

      const noticeState = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasFaNotice = bodyText.includes('این نماد دیگر پشتیبانی نمی‌شود');
        const hasEnNotice = bodyText.includes('This symbol is no longer supported');
        return { hasFaNotice, hasEnNotice };
      });

      assert(noticeState.hasFaNotice || noticeState.hasEnNotice,
        'FR-009 removed symbol shows "این نماد دیگر پشتیبانی نمی‌شود" notice',
        'Notice for removed symbol was not found in the DOM');
    }

    // ── 2.4 Depth Panel for Non-Binance Instrument (FR-013) ──
    {
      await page.evaluate(() => {
        window.__TRADING_APP__?.switchLanguage?.('fa');
        window.__TRADING_APP__?.switchSymbol?.('OANDA:EURUSD');
      });
      await new Promise(r => setTimeout(r, 1000));

      const depthPanelText = await page.evaluate(() => {
        const panel = document.querySelector('#depth-of-market-panel, .depth-panel, [data-testid="dom-panel"]');
        return panel?.innerText || '';
      });

      assert(depthPanelText.includes('دفتر سفارش برای این نماد در دسترس نیست') ||
             depthPanelText.includes('Order book unavailable for this symbol') ||
             depthPanelText.includes('در دسترس نیست'),
        'FR-013 depth panel displays unavailable notice for non-Binance symbol',
        `Expected unavailable notice in depth panel, got "${depthPanelText}"`);
    }

  } finally {
    if (ctx) {
      await closeAllBrowsers();
    }
  }

  console.log('✅ [015 Acceptance Suite 05] Passed all Client UX Badges & Accuracy Audit checks.');
}

run().catch(err => {
  console.error(`❌ Suite run error: ${err.message}`);
  process.exit(1);
});
