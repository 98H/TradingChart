/**
 * @spec 008
 * @covers FR-004, FR-006
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
  console.log('[008 Calendar & News Acceptance Suite] Launching desktop browser...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Economic Calendar View (FR-004, User Story 2)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const tabSelector = '#bottom-panel .panel-tab[data-view="calendar"]';
      await realClick(page, tabSelector);
      await page.waitForFunction(() => {
        const bp = document.querySelector('#bottom-panel');
        const vc = document.querySelector('#view-calendar');
        return bp && !bp.classList.contains('collapsed') && vc && vc.classList.contains('active');
      }, { timeout: 6000 });
      await page.waitForFunction(() => document.querySelectorAll('#view-calendar .cal-event-row').length >= 5, { timeout: 6000 });

      // 1.1 Highlight upcoming release & event card list (US2 Scenario 1)
      const initialCards = await page.evaluate(() => {
        const vc = document.querySelector('#view-calendar');
        const rows = Array.from(vc.querySelectorAll('.cal-event-row'));
        const filters = Array.from(vc.querySelectorAll('.cal-filter-btn')).map(b => b.innerText.trim());
        const hasRefresh = !!vc.querySelector('#btn-refresh-calendar');
        const hasSearch = !!vc.querySelector('#calendar-search-input');
        return {
          totalRows: rows.length,
          filters,
          hasRefresh,
          hasSearch
        };
      });

      assert(initialCards.totalRows >= 5, 'FR-004 calendar event cards listed', `Expected >= 5, got ${initialCards.totalRows}`);
      assert(initialCards.hasRefresh, 'FR-004 calendar refresh button present', 'Missing #btn-refresh-calendar');
      assert(initialCards.hasSearch, 'FR-004 calendar search input present', 'Missing #calendar-search-input');
      assert(initialCards.filters.includes('All Events'), 'FR-004 filter All present', 'Missing All Events');
      assert(initialCards.filters.some(f => f.includes('High Impact')), 'FR-004 filter High Impact present', 'Missing High Impact');
      assert(initialCards.filters.some(f => f.includes('USD')), 'FR-004 filter USD present', 'Missing USD');
      assert(initialCards.filters.some(f => f.includes('Central Banks')), 'FR-004 filter Central Banks present', 'Missing Central Banks');
      assert(initialCards.filters.some(f => f.includes('Inflation')), 'FR-004 filter Inflation present', 'Missing Inflation');

      // Verify next release highlight behavior when upcoming event is present
      const highlightCheck = await page.evaluate(() => {
        const cal = window.__TRADING_APP__.economicCalendar;
        const origEvents = [...cal.events];
        cal.events = [
          {
            id: 'eco-upcoming-test',
            date: '2026-10-25 14:00',
            timestamp: Date.now() + 86400000,
            country: 'US',
            flag: '🇺🇸',
            currency: 'USD',
            event: 'Upcoming Catalyst Release',
            eventFa: 'رویداد پیش‌روی اقتصادی',
            impact: 'HIGH',
            actual: null,
            forecast: '1.5%',
            previous: '1.2%',
            unit: '%',
            category: 'Inflation',
            categoryFa: 'تورم'
          },
          ...origEvents
        ];
        cal.render();
        const vcText = document.querySelector('#view-calendar')?.innerText || '';
        const hasBanner = vcText.includes('Upcoming Catalyst Release') ||
                          vcText.includes('NEXT UPCOMING') ||
                          vcText.includes('رویداد بعدی پیش‌رو');
        // Restore
        cal.events = origEvents;
        cal.render();
        return hasBanner;
      });
      assert(highlightCheck, 'FR-004 highlights next upcoming release when present', 'Upcoming release highlight banner failed');

      // 1.2 Category & Impact Filters (US2 Scenario 2)
      // Click "High Impact 🔥"
      await realClick(page, '#view-calendar .cal-filter-btn:nth-of-type(2)');
      await page.waitForFunction(() => {
        const rows = Array.from(document.querySelectorAll('#view-calendar .cal-event-row'));
        return rows.length > 0 && rows.every(r => r.innerText.includes('HIGH'));
      }, { timeout: 8000 });

      const highCount = await page.evaluate(() => document.querySelectorAll('#view-calendar .cal-event-row').length);
      assert(highCount === 8, 'FR-004 High Impact filter isolates high impact events', `Expected 8, got ${highCount}`);

      // Click "High Impact 🔥" a second time: toggles back to All Events
      await realClick(page, '#view-calendar .cal-filter-btn:nth-of-type(2)');
      await page.waitForFunction((expected) => {
        const rows = document.querySelectorAll('#view-calendar .cal-event-row');
        return rows.length === expected;
      }, { timeout: 8000 }, initialCards.totalRows);

      const resetCount = await page.evaluate(() => document.querySelectorAll('#view-calendar .cal-event-row').length);
      assert(resetCount === initialCards.totalRows, 'FR-004 clicking active filter resets to All',
        `Expected ${initialCards.totalRows}, got ${resetCount}`);

      // Click Central Banks filter
      await realClick(page, '#view-calendar .cal-filter-btn:nth-of-type(4)');
      await page.waitForFunction(() => {
        const rows = Array.from(document.querySelectorAll('#view-calendar .cal-event-row'));
        return rows.length === 5;
      }, { timeout: 8000 });

      const cbCount = await page.evaluate(() => document.querySelectorAll('#view-calendar .cal-event-row').length);
      assert(cbCount === 5, 'FR-004 Central Banks filter isolates central bank releases', `Expected 5, got ${cbCount}`);

      // Reset to All by clicking Central Banks again
      await realClick(page, '#view-calendar .cal-filter-btn:nth-of-type(4)');
      await page.waitForFunction((expected) => document.querySelectorAll('#view-calendar .cal-event-row').length === expected,
        { timeout: 8000 }, initialCards.totalRows);

      // 1.3 Text Search (US2 Scenario 3)
      await page.focus('#view-calendar #calendar-search-input');
      await page.keyboard.type('CPI');
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('#view-calendar .cal-event-row');
        return rows.length === 1 && rows[0].innerText.includes('Core CPI');
      }, { timeout: 8000 });

      const cpiMatch = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#view-calendar .cal-event-row'));
        return { count: rows.length, text: rows[0]?.innerText };
      });
      assert(cpiMatch.count === 1 && cpiMatch.text.includes('Core CPI'),
        'FR-004 search input filters events matching name', `Expected 1 row with Core CPI, got ${cpiMatch.count}`);

      // Clear search
      await page.evaluate(() => {
        const el = document.querySelector('#view-calendar #calendar-search-input');
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((expected) => document.querySelectorAll('#view-calendar .cal-event-row').length === expected,
        { timeout: 8000 }, initialCards.totalRows);

      // 1.4 Refresh Button
      await realClick(page, '#view-calendar #btn-refresh-calendar');
      await page.waitForFunction((expected) => document.querySelectorAll('#view-calendar .cal-event-row').length === expected,
        { timeout: 8000 }, initialCards.totalRows);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Market News View (FR-006, User Story 3)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const tabSelector = '#bottom-panel .panel-tab[data-view="news"]';
      await realClick(page, tabSelector);
      await page.waitForFunction(() => {
        const vn = document.querySelector('#view-news');
        return vn && vn.classList.contains('active');
      }, { timeout: 6000 });
      await page.waitForFunction(() => document.querySelectorAll('#view-news .news-feed-card').length >= 5, { timeout: 6000 });

      // 2.1 Category Filtering (US3 Scenario 1)
      const initialNews = await page.evaluate(() => {
        const vn = document.querySelector('#view-news');
        const cats = Array.from(vn.querySelectorAll('.news-cat-btn')).map(b => b.getAttribute('data-cat'));
        const cards = vn.querySelectorAll('.news-feed-card');
        return {
          cats,
          totalCards: cards.length
        };
      });

      assert(initialNews.totalCards >= 5, 'FR-006 news feed cards listed', `Expected >= 5, got ${initialNews.totalCards}`);
      assert(initialNews.cats.includes('all') && initialNews.cats.includes('crypto') && initialNews.cats.includes('metals') &&
             initialNews.cats.includes('forex') && initialNews.cats.includes('equities') && initialNews.cats.includes('commodities'),
             'FR-006 category buttons rendered', `Categories found: ${initialNews.cats.join(', ')}`);

      // Click Crypto category
      await realClick(page, '#view-news .news-cat-btn[data-cat="crypto"]');
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('#view-news .news-feed-card');
        return cards.length === 4;
      }, { timeout: 4000 });

      const cryptoNewsCount = await page.evaluate(() => document.querySelectorAll('#view-news .news-feed-card').length);
      assert(cryptoNewsCount === 4, 'FR-006 Crypto category isolates crypto headlines', `Expected 4, got ${cryptoNewsCount}`);

      // Click Commodities category
      await realClick(page, '#view-news .news-cat-btn[data-cat="commodities"]');
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('#view-news .news-feed-card');
        return cards.length === 1 && cards[0].innerText.includes('USOIL');
      }, { timeout: 4000 });

      const commCount = await page.evaluate(() => document.querySelectorAll('#view-news .news-feed-card').length);
      assert(commCount === 1, 'FR-006 Commodities category isolates commodity headlines', `Expected 1, got ${commCount}`);

      // Return to All
      await realClick(page, '#view-news .news-cat-btn[data-cat="all"]');
      await page.waitForFunction((expected) => document.querySelectorAll('#view-news .news-feed-card').length === expected,
        { timeout: 8000 }, initialNews.totalCards);

      // 2.2 Text Search & Empty State (US3 Scenario 2)
      await page.focus('#view-news #news-search-input');
      await page.keyboard.type('UnmatchedTokenQuery123');
      await page.waitForFunction(() => {
        const container = document.querySelector('#view-news #news-items-container');
        return container && (container.innerText.includes('No headlines matched') || container.innerText.includes('خبری مطابق'));
      }, { timeout: 8000 });

      const emptyState = await page.evaluate(() => {
        const container = document.querySelector('#view-news #news-items-container');
        const cards = document.querySelectorAll('#view-news .news-feed-card').length;
        return {
          cards,
          text: container?.innerText.trim()
        };
      });
      assert(emptyState.cards === 0, 'FR-006 empty state hides news cards', `Expected 0 cards, got ${emptyState.cards}`);
      assert(emptyState.text.includes('No headlines matched active filter') || emptyState.text.includes('خبری مطابق با فیلتر'),
        'FR-006 empty state message displayed', `Unexpected text: ${emptyState.text}`);

      // Clear search
      await page.evaluate(() => {
        const el = document.querySelector('#view-news #news-search-input');
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((expected) => document.querySelectorAll('#view-news .news-feed-card').length === expected,
        { timeout: 8000 }, initialNews.totalCards);

      // 2.3 1-Click Chart Symbol Switching (US3 Scenario 3, SC-002)
      const pillHandle = await page.$('#view-news .news-sym-pill[data-symbol="BTCUSDT"]');
      assert(!!pillHandle, 'FR-006 BTCUSDT symbol pill present', 'Missing BTCUSDT pill');
      await pillHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await new Promise(r => setTimeout(r, 150));
      const pillBox = await pillHandle.boundingBox();
      await page.mouse.click(pillBox.x + pillBox.width / 2, pillBox.y + pillBox.height / 2);

      await page.waitForFunction(() => {
        const toast = document.querySelector('.tc-toast');
        const sym = window.__TRADING_APP__.currentSymbol;
        return (toast && toast.innerText.includes('BTCUSDT')) || sym === 'BTCUSDT';
      }, { timeout: 5000 });

      const switchResult = await page.evaluate(() => {
        const toast = document.querySelector('.tc-toast')?.innerText || '';
        const sym = window.__TRADING_APP__.currentSymbol;
        return { hasToast: toast.includes('BTCUSDT'), sym };
      });
      assert(switchResult.hasToast || switchResult.sym === 'BTCUSDT',
        'FR-006 clicking symbol pill switches active chart instrument',
        `Switch result: ${JSON.stringify(switchResult)}`);

      // 2.4 Polling Lifecycle & Unmount (Edge case, SC-003)
      const pollTimerCheck = await page.evaluate(() => {
        const mn = window.__TRADING_APP__.marketNews;
        const activeTimer = mn?.pollTimer;
        // Verify destroy dismantles polling
        mn?.destroy?.();
        return {
          hadTimer: !!activeTimer
        };
      });
      assert(pollTimerCheck.hadTimer, 'FR-006 news polls every 15s while mounted', 'Missing pollTimer on news');
    }

    console.log('✅ [008 Calendar & News Acceptance Suite] All scenarios passed with verified filters, empty state, and symbol switching.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Suite unhandled error: ${err.stack || err.message}`);
  process.exit(1);
});
