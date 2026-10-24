/**
 * @spec 004
 * @covers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
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
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className, topOuter: top?.outerHTML?.slice(0, 100) };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  // ──────────────────────────────────────────────────────────────────────────
  // Part 1: Immutable Indicators Catalogue & PineTS Compilation (FR-001, FR-002, FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const { INDICATORS_LIBRARY } = await import('../../../client/src/indicatorsData.js');
    const { INDICATORS_FA } = await import('../../../client/src/indicatorsFa.js');
    const { Indicator } = await import('pinets');

    // FR-001: Exactly 114 library indicators
    assert(Array.isArray(INDICATORS_LIBRARY), 'FR-001 library is array', 'Expected INDICATORS_LIBRARY to be an array');
    assert(INDICATORS_LIBRARY.length === 114, 'FR-001 catalogue size 114',
      `Expected exactly 114 indicators, found ${INDICATORS_LIBRARY.length}`);

    // FR-001: Unique identifiers across all 114 entries
    const idSet = new Set(INDICATORS_LIBRARY.map(i => i.id));
    assert(idSet.size === 114, 'FR-001 unique ids',
      `Expected 114 unique indicator ids, found ${idSet.size}`);

    // FR-001: Category distribution partitions
    const validCats = new Set(['smc', 'trend', 'oscillators', 'volatility', 'volume']);
    const catCounts = { smc: 0, trend: 0, oscillators: 0, volatility: 0, volume: 0 };
    let nativeCount = 0;

    for (const item of INDICATORS_LIBRARY) {
      assert(validCats.has(item.category), 'FR-001 valid category enum',
        `Indicator ${item.id} has invalid category "${item.category}"`);
      catCounts[item.category]++;

      assert(typeof item.name === 'string' && item.name.trim().length > 0,
        'FR-001 indicator English name', `Indicator ${item.id} missing name`);
      assert(typeof item.description === 'string' && item.description.trim().length > 0,
        'FR-001 indicator English description', `Indicator ${item.id} missing description`);
      assert(typeof item.script === 'string' && item.script.includes('//@version=5'),
        'FR-001 indicator Pine v5 version directive', `Indicator ${item.id} missing //@version=5`);
      assert(/\bindicator\s*\(/.test(item.script) && !/\bstrategy\s*\(/.test(item.script),
        'FR-001 indicator declaration type', `Indicator ${item.id} must declare indicator(), not strategy()`);

      if (item.nativeName) nativeCount++;
    }

    assert(catCounts.smc === 18, 'FR-001 SMC category count 18', `Expected 18 SMC indicators, got ${catCounts.smc}`);
    assert(catCounts.trend === 28, 'FR-001 Trend category count 28', `Expected 28 Trend indicators, got ${catCounts.trend}`);
    assert(catCounts.oscillators === 29, 'FR-001 Oscillators category count 29', `Expected 29 Oscillators, got ${catCounts.oscillators}`);
    assert(catCounts.volatility === 19, 'FR-001 Volatility category count 19', `Expected 19 Volatility indicators, got ${catCounts.volatility}`);
    assert(catCounts.volume === 20, 'FR-001 Volume category count 20', `Expected 20 Volume indicators, got ${catCounts.volume}`);

    // FR-006: Exactly 30 indicators have native engine acceleration
    assert(nativeCount === 30, 'FR-006 native indicator entries 30', `Expected 30 native indicator entries, got ${nativeCount}`);

    // FR-001: 100% of library scripts compile with PineTS engine after color.cyan rewrite
    for (const item of INDICATORS_LIBRARY) {
      try {
        const sanitized = item.script.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
        const parsed = Indicator.from(sanitized);
        assert(parsed && typeof parsed.getDeclarationType === 'function',
          'FR-001 Pine script engine compilation', `Script ${item.id} did not produce valid Indicator instance`);
      } catch (err) {
        assert(false, `FR-001 script compile ${item.id}`, `PineTS compilation failed: ${err.message}`);
      }
    }

    // FR-002: Exact 1:1 Persian parity in INDICATORS_FA
    const faKeys = Object.keys(INDICATORS_FA);
    assert(faKeys.length === 114, 'FR-002 Persian translation count 114',
      `Expected 114 Persian entries, found ${faKeys.length}`);

    for (const item of INDICATORS_LIBRARY) {
      const fa = INDICATORS_FA[item.id];
      assert(!!fa, 'FR-002 Persian translation present', `Missing Persian entry for indicator ${item.id}`);
      assert(typeof fa.name === 'string' && fa.name.trim().length > 0,
        'FR-002 Persian name non-empty', `Missing Persian name for ${item.id}`);
      assert(typeof fa.description === 'string' && fa.description.trim().length > 0,
        'FR-002 Persian description non-empty', `Missing Persian description for ${item.id}`);
      assert(/[\u0600-\u06FF]/.test(fa.name),
        'FR-002 Persian character validation', `Persian name for ${item.id} lacks Persian characters: ${fa.name}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Part 2: Interactive Browser Testing (FR-002, FR-003, FR-004, FR-005, FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ────────────────────────────────────────────────────────────────────────
    // FR-003: Open indicators modal and verify default state
    // ────────────────────────────────────────────────────────────────────────
    await realClick(page, '.vela-widget-indicators');
    await page.waitForSelector('#modal-indicators.open', { visible: true, timeout: 6000 });

    const defaultState = await page.evaluate(() => {
      const modal = document.querySelector('#modal-indicators');
      const search = document.querySelector('#ind-search-input');
      const countLabel = document.querySelector('#ind-count-label');
      const cards = document.querySelectorAll('.ind-card-row');
      const catSelect = document.querySelector('#ind-cat-select');

      return {
        isOpen: modal?.classList.contains('open'),
        isSearchFocused: document.activeElement === search,
        searchValue: search?.value,
        countText: countLabel?.innerText,
        totalCards: cards.length,
        selectedCategory: catSelect?.value
      };
    });

    assert(defaultState.isOpen, 'FR-003 modal opens', 'Expected #modal-indicators to have class "open"');
    assert(defaultState.searchValue === '', 'FR-003 search input empty', 'Expected empty search input on open');
    assert(defaultState.totalCards === 114, 'FR-003 lists 114 indicators',
      `Expected 114 rows, got ${defaultState.totalCards}`);
    assert(defaultState.countText.includes('114 of 114'), 'FR-003 count label text',
      `Expected count label to mention "114 of 114", got "${defaultState.countText}"`);
    assert(defaultState.selectedCategory === 'all', 'FR-003 category resets to all',
      `Expected category "all", got "${defaultState.selectedCategory}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-003: Category filter dropdown
    // ────────────────────────────────────────────────────────────────────────
    const expectedCatCounts = [
      { cat: 'smc', expected: 18, label: 'Smart Money Concepts' },
      { cat: 'trend', expected: 28, label: 'Trend' },
      { cat: 'oscillators', expected: 29, label: 'Oscillators' },
      { cat: 'volatility', expected: 19, label: 'Volatility' },
      { cat: 'volume', expected: 20, label: 'Volume' }
    ];

    for (const c of expectedCatCounts) {
      await page.select('#ind-cat-select', c.cat);
      await page.waitForFunction((exp) => {
        const count = document.querySelectorAll('.ind-card-row').length;
        const text = document.querySelector('#ind-count-label')?.innerText || '';
        return count === exp && text.includes(String(exp));
      }, {}, c.expected);

      const catResult = await page.evaluate(() => ({
        count: document.querySelectorAll('.ind-card-row').length,
        label: document.querySelector('#ind-count-label')?.innerText
      }));

      assert(catResult.count === c.expected, `FR-003 filter ${c.label} count`,
        `Expected ${c.expected} rows for category ${c.cat}, got ${catResult.count}`);
    }

    // Reset category to all
    await page.select('#ind-cat-select', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.ind-card-row').length === 114);

    // ────────────────────────────────────────────────────────────────────────
    // FR-003: Free-text search, clear button, and empty state
    // ────────────────────────────────────────────────────────────────────────
    // Search "ADX"
    await page.type('#ind-search-input', 'ADX');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.ind-card-row');
      return rows.length > 0 && rows.length < 114;
    });

    const adxSearchCount = await page.evaluate(() => document.querySelectorAll('.ind-card-row').length);
    assert(adxSearchCount >= 1 && adxSearchCount <= 10, 'FR-003 search ADX matches',
      `Expected 1-10 matches for ADX, got ${adxSearchCount}`);

    // Clear search via #ind-clear-search button
    await realClick(page, '#ind-clear-search');
    await page.waitForFunction(() => {
      const search = document.querySelector('#ind-search-input');
      const rows = document.querySelectorAll('.ind-card-row');
      return search?.value === '' && rows.length === 114;
    });

    // Search non-existent query -> empty state message
    await page.type('#ind-search-input', 'nonexistent_token_xyz_999');
    await page.waitForFunction(() => {
      const container = document.querySelector('#ind-items-container');
      const text = container?.innerText || '';
      return text.includes('No matching indicators') || text.includes('یافت نشد');
    });

    const emptySearchMsg = await page.$eval('#ind-items-container', el => el.innerText);
    assert(emptySearchMsg.includes('No matching indicators') || emptySearchMsg.includes('یافت نشد'),
      'FR-003 no matches empty state', `Expected empty state message, got "${emptySearchMsg}"`);

    // Clear search for add tests
    await realClick(page, '#ind-clear-search');
    await page.waitForFunction(() => document.querySelectorAll('.ind-card-row').length === 114);

    // ────────────────────────────────────────────────────────────────────────
    // FR-005, FR-006 & Edge Case 1: Add indicator, button confirmation & busy lock
    // ────────────────────────────────────────────────────────────────────────
    // Clear default indicators on chart to start with a clean slate of 0
    await page.evaluate(() => {
      const orch = window.app?.chartManager?.workspace?.active?.chart?.orchestrator;
      if (orch?.handles) {
        for (const id of Array.from(orch.handles.keys())) {
          orch.removeIndicator(id);
        }
      }
    });

    // Search and add Order Blocks (SMC)
    await page.type('#ind-search-input', 'Order Blocks');
    await page.waitForSelector('.add-ind-btn[data-id="smc_order_blocks"]', { visible: true, timeout: 5000 });

    const beforeAddCount = await page.evaluate(() => window.app?.chartManager?.countActiveIndicators() || 0);
    assert(beforeAddCount === 0, 'FR-004 initial clear count 0', `Expected 0 indicators after clearing, got ${beforeAddCount}`);

    // Click Add
    await realClick(page, '.add-ind-btn[data-id="smc_order_blocks"]');

    // Button should report "✓ Added" (or Persian "✓ افزوده شد") and be busy
    await page.waitForFunction(() => {
      const btn = document.querySelector('.add-ind-btn[data-id="smc_order_blocks"]');
      const text = btn?.innerText || '';
      return (text.includes('Added') || text.includes('افزوده')) && btn?.getAttribute('data-busy') === '1';
    }, { timeout: 4000 });

    // Edge Case 1: Rapid second click within 1.5s is blocked by data-busy="1"
    const rapidClickHandled = await page.evaluate(async () => {
      const btn = document.querySelector('.add-ind-btn[data-id="smc_order_blocks"]');
      const isBusy = btn?.getAttribute('data-busy') === '1';
      // Attempt click while busy
      btn?.click();
      return isBusy;
    });
    assert(rapidClickHandled, 'Edge Case 1 rapid double click busy guard',
      'Expected data-busy="1" guard to prevent duplicate addition');

    const afterFirstAddCount = await page.evaluate(() => window.app?.chartManager?.countActiveIndicators() || 0);
    assert(afterFirstAddCount === beforeAddCount + 1, 'FR-005 chart orchestrator accepted indicator',
      `Expected active indicators ${beforeAddCount + 1}, got ${afterFirstAddCount}`);

    // Clear search
    await realClick(page, '#ind-clear-search');
    await page.waitForFunction(() => document.querySelectorAll('.ind-card-row').length === 114);

    // ────────────────────────────────────────────────────────────────────────
    // FR-004: Plan quota enforcement (Basic plan quota = 2 indicators per chart)
    // ────────────────────────────────────────────────────────────────────────
    // Add second indicator (Native ADX)
    await page.type('#ind-search-input', 'Average Directional Index');
    await page.waitForSelector('.add-ind-btn[data-id="adx"]', { visible: true, timeout: 5000 });
    await realClick(page, '.add-ind-btn[data-id="adx"]');
    await page.waitForFunction(() => {
      const btn = document.querySelector('.add-ind-btn[data-id="adx"]');
      return btn && (btn.innerText.includes('Added') || btn.innerText.includes('افزوده'));
    });

    const twoIndsCount = await page.evaluate(() => window.app?.chartManager?.countActiveIndicators() || 0);
    assert(twoIndsCount === 2, 'FR-004 two indicators active',
      `Expected 2 indicators active on chart, got ${twoIndsCount}`);

    // Attempt to add a 3rd indicator (Supertrend) on Basic plan (quota is 2)
    await realClick(page, '#ind-clear-search');
    await page.waitForFunction(() => document.querySelectorAll('.ind-card-row').length === 114);

    await page.type('#ind-search-input', 'Supertrend');
    await page.waitForSelector('.add-ind-btn[data-id="supertrend"]', { visible: true, timeout: 5000 });
    await realClick(page, '.add-ind-btn[data-id="supertrend"]');

    // Wait for the button to show "✕ Not added" (or "✕ افزوده نشد") and upgrade toast
    await page.waitForFunction(() => {
      const btn = document.querySelector('.add-ind-btn[data-id="supertrend"]');
      const text = btn?.innerText || '';
      return text.includes('Not added') || text.includes('افزوده نشد');
    }, { timeout: 4000 });

    const quotaBlockedCount = await page.evaluate(() => window.app?.chartManager?.countActiveIndicators() || 0);
    assert(quotaBlockedCount === 2, 'FR-004 3rd indicator blocked by plan quota',
      `Expected count to remain capped at 2, got ${quotaBlockedCount}`);

    const toastInfo = await page.evaluate(() => {
      const toast = document.querySelector('#tradingchart-toast');
      return toast ? toast.innerText : '';
    });
    assert(toastInfo.length > 0, 'FR-004 upgrade toast shown on quota limit',
      'Expected upgrade toast message on exceeding indicators quota');

    // Clear search for Persian mode verification
    await realClick(page, '#ind-clear-search');
    await page.waitForFunction(() => document.querySelectorAll('.ind-card-row').length === 114);

    // ────────────────────────────────────────────────────────────────────────
    // FR-002 & US1 Scenario 7: Persian RTL localization of indicators modal
    // ────────────────────────────────────────────────────────────────────────
    await page.evaluate(() => window.app?.switchLanguage('fa'));
    await page.waitForFunction(() => {
      const count = document.querySelector('#ind-count-label')?.innerText || '';
      return count.includes('۱۱۴');
    }, { timeout: 5000 });

    const faModalState = await page.evaluate(() => {
      const modalBox = document.querySelector('#modal-indicators .modal-box');
      const dir = modalBox?.getAttribute('dir') || window.getComputedStyle(modalBox).direction;
      const countText = document.querySelector('#ind-count-label')?.innerText || '';
      const sampleCard = document.querySelector('.ind-card-row[data-id="smc_order_blocks"]');
      const title = sampleCard?.querySelector('bdi')?.innerText || '';
      const desc = sampleCard?.querySelector('div[dir="auto"]')?.innerText || '';

      return {
        isRtl: dir === 'rtl',
        countText,
        title,
        desc
      };
    });

    assert(faModalState.isRtl, 'FR-002 Persian modal direction RTL', 'Expected modal box to be RTL');
    assert(faModalState.countText.includes('۱۱۴'), 'FR-002 Persian digits in count label',
      `Expected Persian digits ۱۱۴ in label, got "${faModalState.countText}"`);
    assert(faModalState.title.includes('اوردر بلاک') || faModalState.title.includes('نقدینگی'),
      'FR-002 Persian indicator title', `Expected Persian title for smc_order_blocks, got "${faModalState.title}"`);
    assert(faModalState.desc.length > 0 && /[\u0600-\u06FF]/.test(faModalState.desc),
      'FR-002 Persian indicator description', `Expected Persian text in description, got "${faModalState.desc}"`);

    // Close modal
    await realClick(page, '#modal-close-ind');
    await page.waitForFunction(() => !document.querySelector('#modal-indicators')?.classList.contains('open'));

    // Switch language back to English for following tests
    await page.evaluate(() => window.app?.switchLanguage('en'));
  } finally {
    await ctx.browser.close();
  }
}

run().then(() => {
  console.log('✅ 01_indicators_library_and_dialog.test.cjs passed');
  process.exit(0);
}).catch(err => {
  console.error('❌ 01_indicators_library_and_dialog.test.cjs:', err);
  process.exit(1);
});
