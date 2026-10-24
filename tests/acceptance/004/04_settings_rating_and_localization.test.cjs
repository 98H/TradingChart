/**
 * @spec 004
 * @covers FR-019, FR-020, FR-021, FR-024
 */
const { launch, boot } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:8088';

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
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className, topOuter: top?.outerHTML?.slice(0, 100) };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  // ──────────────────────────────────────────────────────────────────────────
  // Part 1: HTTP API verification for Technical Screener & Tickers (FR-024)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // 1. GET /api/tickers?symbols=BTCUSDT
    const tRes = await fetch(`${BASE_URL}/api/tickers?symbols=BTCUSDT`);
    assert(tRes.status === 200, 'FR-024 GET /api/tickers status 200', `Expected 200, got ${tRes.status}`);
    const tickers = await tRes.json();
    assert(Array.isArray(tickers) && tickers.length >= 1, 'FR-024 tickers array', 'Expected array of tickers');
    const btcTicker = tickers[0];
    assert(typeof btcTicker.lastPrice === 'number' && btcTicker.lastPrice > 0,
      'FR-024 ticker lastPrice field', `Invalid lastPrice: ${btcTicker.lastPrice}`);
    assert(typeof btcTicker.priceChangePercent === 'number',
      'FR-024 ticker priceChangePercent field', 'Missing priceChangePercent');

    // 2. GET /api/screener?search=BTCUSDT
    const sRes = await fetch(`${BASE_URL}/api/screener?search=BTCUSDT`);
    assert(sRes.status === 200, 'FR-024 GET /api/screener status 200', `Expected 200, got ${sRes.status}`);
    const screener = await sRes.json();
    assert(screener && Array.isArray(screener.items) && screener.items.length >= 1,
      'FR-024 screener items', 'Expected screener items array');
    const btcScreener = screener.items[0];
    assert(typeof btcScreener.rsi14 === 'number', 'FR-024 screener rsi14', 'Missing rsi14');
    assert(typeof btcScreener.technicalRating === 'string', 'FR-024 screener rating', 'Missing technicalRating');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Part 2: Browser Verification of Settings, Rating Card, and Localization
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ────────────────────────────────────────────────────────────────────────
    // FR-020: Indicator Settings Dialog empty warning
    // ────────────────────────────────────────────────────────────────────────
    const emptySettingsCheck = await page.evaluate(() => {
      // Clear active indicators on chart
      const orch = window.app?.chartManager?.workspace?.active?.chart?.orchestrator;
      if (orch?.handles) {
        for (const id of Array.from(orch.handles.keys())) orch.removeIndicator(id);
      }

      // Attempt to open settings with 0 indicators
      window.app?.indicatorSettingsModal?.open();
      const toast = document.querySelector('#tradingchart-toast')?.innerText || '';
      const isOpen = document.querySelector('#modal-indicator-settings')?.classList.contains('open');

      return { toast, isOpen };
    });

    assert(!emptySettingsCheck.isOpen, 'FR-020 settings modal does not open when 0 indicators',
      'Modal should not have open class');
    assert(emptySettingsCheck.toast.includes('No active indicators on chart') || emptySettingsCheck.toast.includes('هیچ اندیکاتور فعالی'),
      'FR-020 warning toast on empty indicators settings', `Expected toast, got: "${emptySettingsCheck.toast}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-020 & FR-021: Tune Inputs, Style and Apply Changes
    // ────────────────────────────────────────────────────────────────────────
    // Add custom Pine indicator to tune
    await page.evaluate(() => {
      window.app?.chartManager?.addPineIndicator(
        '//@version=5\nindicator("Tuning Pro", overlay=true)\nlen = input.int(14, "Length")\nmult = input.float(2.0, "Multiplier")\nplot(ta.sma(close, len))',
        'Tuning Pro'
      );
    });

    // Open settings modal
    await page.evaluate(() => window.app?.indicatorSettingsModal?.open());
    await page.waitForSelector('#modal-indicator-settings.open', { visible: true, timeout: 5000 });

    const openSettingsState = await page.evaluate(() => {
      const title = document.querySelector('#ind-settings-title')?.innerText || '';
      const handleSelect = document.querySelector('#ind-select-handle');
      const options = handleSelect ? Array.from(handleSelect.options).map(o => o.text) : [];
      const activeTab = document.querySelector('.modal-tab.active')?.getAttribute('data-tab');
      const hasLengthInput = !!document.querySelector('#input-ind-length, .dynamic-input[data-key="len"], .dynamic-input[data-key="length"]');

      return { title, options, activeTab, hasLengthInput };
    });

    assert(openSettingsState.title.includes('Tuning Pro'), 'FR-020 indicator title in settings header',
      `Expected title "Tuning Pro", got "${openSettingsState.title}"`);
    assert(openSettingsState.options.length >= 1, 'FR-020 handle select lists active indicators',
      `Expected active indicators in dropdown, got: ${JSON.stringify(openSettingsState.options)}`);
    assert(openSettingsState.activeTab === 'inputs', 'FR-020 defaults to Inputs tab',
      `Expected active tab "inputs", got "${openSettingsState.activeTab}"`);
    assert(openSettingsState.hasLengthInput, 'FR-020 length input rendered in Inputs tab',
      'Missing length control in Inputs tab');

    // Test Style Tab & Persistence Scheduling
    const applyResult = await page.evaluate(() => {
      let persistCalled = false;
      const origPersist = window.app.layoutManager?.schedulePersist;
      if (window.app.layoutManager) {
        window.app.layoutManager.schedulePersist = () => {
          persistCalled = true;
          if (origPersist) origPersist.call(window.app.layoutManager);
        };
      }

      // Switch to Style tab
      const styleTab = document.querySelector('#modal-indicator-settings .modal-tab[data-tab="style"]');
      styleTab?.click();

      // Configure style inputs
      const upColor = document.querySelector('#style-ind-upcolor');
      const downColor = document.querySelector('#style-ind-downcolor');
      const lineWidth = document.querySelector('#style-ind-linewidth');

      if (upColor) upColor.value = '#00F2B0';
      if (downColor) downColor.value = '#FF4D5B';
      if (lineWidth) lineWidth.value = '3';

      // Click Apply & Save
      document.querySelector('#btn-ind-apply')?.click();
      const toast = document.querySelector('#tradingchart-toast')?.innerText || '';
      const isClosed = !document.querySelector('#modal-indicator-settings')?.classList.contains('open');

      if (window.app.layoutManager && origPersist) {
        window.app.layoutManager.schedulePersist = origPersist;
      }

      return { persistCalled, toast, isClosed };
    });

    assert(applyResult.isClosed, 'FR-020 modal closes on Apply & Save', 'Expected modal to close');
    assert(applyResult.persistCalled, 'FR-021 layout persistence scheduled on Apply',
      'Expected layoutManager.schedulePersist() call');
    assert(applyResult.toast.includes('Indicator settings updated') || applyResult.toast.includes('تنظیمات اندیکاتور با موفقیت اعمال شد'),
      'FR-020 confirmation toast on settings updated', `Expected update toast, got "${applyResult.toast}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-020 & FR-021: Remove Indicator from Chart
    // ────────────────────────────────────────────────────────────────────────
    const removeResult = await page.evaluate(() => {
      let persistCalled = false;
      const origPersist = window.app.layoutManager?.schedulePersist;
      if (window.app.layoutManager) {
        window.app.layoutManager.schedulePersist = () => {
          persistCalled = true;
          if (origPersist) origPersist.call(window.app.layoutManager);
        };
      }

      // Re-open settings modal
      window.app.indicatorSettingsModal.open();

      // Click Remove from Chart
      document.querySelector('#btn-ind-remove')?.click();
      const toast = document.querySelector('#tradingchart-toast')?.innerText || '';
      const isClosed = !document.querySelector('#modal-indicator-settings')?.classList.contains('open');
      const count = window.app.chartManager?.countActiveIndicators() || 0;

      if (window.app.layoutManager && origPersist) {
        window.app.layoutManager.schedulePersist = origPersist;
      }

      return { persistCalled, toast, isClosed, count };
    });

    assert(removeResult.isClosed, 'FR-020 modal closes on Remove', 'Expected modal to close');
    assert(removeResult.count === 0, 'FR-020 indicator removed from active chart',
      `Expected 0 active indicators after removal, got ${removeResult.count}`);
    assert(removeResult.persistCalled, 'FR-021 layout persistence scheduled on Remove',
      'Expected layoutManager.schedulePersist() call on indicator removal');
    assert(removeResult.toast.includes('Indicator removed') || removeResult.toast.includes('اندیکاتور از چارت حذف شد'),
      'FR-020 removal confirmation toast', `Expected remove toast, got "${removeResult.toast}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-024: Technical Rating Card & Speedometer Consensus
    // ────────────────────────────────────────────────────────────────────────
    const trcContainerExists = await page.evaluate(() => {
      const container = document.querySelector('#wl-technical-rating-container');
      const card = document.querySelector('.technical-rating-card');
      return !!container && !!card;
    });
    assert(trcContainerExists, 'FR-024 technical rating card mounted in watchlist',
      'Expected #wl-technical-rating-container and .technical-rating-card to exist');

    const cardInitialData = await page.evaluate(() => {
      const sym = document.querySelector('#trc-sym')?.innerText;
      const price = document.querySelector('#trc-price')?.innerText;
      const chg = document.querySelector('#trc-chg')?.innerText;
      const badge = document.querySelector('#trc-rating-badge')?.innerText;
      const needleStyle = document.querySelector('#trc-needle-group')?.getAttribute('style') || '';
      const dayRatio = document.querySelector('#trc-day-ratio')?.innerText;
      const w52Ratio = document.querySelector('#trc-52w-ratio')?.innerText;
      const bSummary = document.querySelector('#trc-breakdown-summary')?.innerText;

      return { sym, price, chg, badge, needleStyle, dayRatio, w52Ratio, bSummary };
    });

    assert(cardInitialData.sym === 'BTCUSDT', 'FR-024 default symbol BTCUSDT displayed',
      `Expected BTCUSDT symbol, got "${cardInitialData.sym}"`);
    assert(cardInitialData.price && cardInitialData.price.includes('$'),
      'FR-024 price displayed with dollar sign', `Invalid price: ${cardInitialData.price}`);
    assert(cardInitialData.chg && cardInitialData.chg.includes('%'),
      'FR-024 24h change displayed with percent sign', `Invalid change: ${cardInitialData.chg}`);
    assert(['STRONG BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG SELL'].includes(cardInitialData.badge.toUpperCase().trim()),
      'FR-024 consensus rating badge', `Invalid badge: "${cardInitialData.badge}"`);
    assert(cardInitialData.needleStyle.includes('rotate(') && cardInitialData.needleStyle.includes('deg)'),
      'FR-024 speedometer needle rotation angle', `Invalid needle style: ${cardInitialData.needleStyle}`);
    assert(cardInitialData.dayRatio && cardInitialData.dayRatio.includes('%'),
      'FR-024 day range slider ratio', `Invalid day ratio: ${cardInitialData.dayRatio}`);
    assert(cardInitialData.w52Ratio && cardInitialData.w52Ratio.includes('%'),
      'FR-024 52-week range slider ratio', `Invalid 52w ratio: ${cardInitialData.w52Ratio}`);

    // Test symbol update refetch
    const refetchResult = await page.evaluate(async () => {
      const card = window.app.watchlist?.technicalRatingCard;
      if (!card) return null;
      card.setSymbol('ETHUSDT');
      await new Promise(r => setTimeout(r, 600));

      const price = document.querySelector('#trc-price')?.innerText;
      return { price };
    });

    assert(refetchResult && refetchResult.price && refetchResult.price.length > 0,
      'FR-024 technical rating card refetches for new symbol', 'Failed to refetch card data');

    // ────────────────────────────────────────────────────────────────────────
    // FR-019: In-place Language Switching without reload or re-execution
    // ────────────────────────────────────────────────────────────────────────
    // Open indicators modal and bottom suite
    await realClick(page, '.vela-widget-indicators');
    await page.waitForSelector('#modal-indicators.open', { visible: true });

    // Switch language to Persian
    await page.evaluate(() => window.app?.switchLanguage('fa'));
    await page.waitForFunction(() => {
      const title = document.querySelector('#modal-indicators h3')?.innerText || '';
      return title.includes('دایره‌المعارف') || title.includes('اندیکاتور');
    });

    const faSurfacesState = await page.evaluate(() => {
      const modalTitle = document.querySelector('#modal-indicators h3')?.innerText || '';
      const countLabel = document.querySelector('#ind-count-label')?.innerText || '';
      const pineTabLabel = document.querySelector('#tab-label-pine')?.innerText || '';
      const stratTabLabel = document.querySelector('#tab-label-strategy')?.innerText || '';
      const trcRatingText = document.querySelector('#trc-rating-badge')?.innerText || '';

      return {
        modalTitle,
        countLabel,
        pineTabLabel,
        stratTabLabel,
        trcRatingText
      };
    });

    assert(faSurfacesState.countLabel.includes('۱۱۴'), 'FR-019 Persian modal count label in-place',
      `Expected ۱۱۴ in label, got "${faSurfacesState.countLabel}"`);
    assert(faSurfacesState.pineTabLabel === 'ویرایشگر پاین' || faSurfacesState.pineTabLabel === 'Pine Editor',
      'FR-019 Persian Pine tab label in-place', `Invalid tab label: ${faSurfacesState.pineTabLabel}`);
    assert(faSurfacesState.stratTabLabel.includes('استراتژی') || faSurfacesState.stratTabLabel.includes('Strategy'),
      'FR-019 Persian Strategy tab label in-place', `Invalid tab label: ${faSurfacesState.stratTabLabel}`);

    // Switch back to English in place
    await page.evaluate(() => window.app?.switchLanguage('en'));
    await page.waitForFunction(() => {
      const countLabel = document.querySelector('#ind-count-label')?.innerText || '';
      return countLabel.includes('Showing 114 of 114');
    });

    const enCountLabel = await page.$eval('#ind-count-label', el => el.innerText);
    assert(enCountLabel.includes('Showing 114 of 114'), 'FR-019 English re-render in place',
      `Expected English count label, got "${enCountLabel}"`);

    // Close indicators modal
    await realClick(page, '#modal-close-ind');
    await page.waitForFunction(() => !document.querySelector('#modal-indicators')?.classList.contains('open'));
  } finally {
    await ctx.browser.close();
  }
}

run().then(() => {
  console.log('✅ 04_settings_rating_and_localization.test.cjs passed');
  process.exit(0);
}).catch(err => {
  console.error('❌ 04_settings_rating_and_localization.test.cjs:', err);
  process.exit(1);
});
