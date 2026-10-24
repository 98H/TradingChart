/**
 * @spec 008
 * @covers FR-002
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
  console.log('[008 Trackers Acceptance Suite] Launching desktop browser...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Expand Trackers View in Bottom Panel (FR-002, User Story 1 Scenario 1)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const tabSelector = '#bottom-panel .panel-tab[data-view="trackers"]';
      await realClick(page, tabSelector);
      await page.waitForFunction(() => {
        const bp = document.querySelector('#bottom-panel');
        const vt = document.querySelector('#view-trackers');
        return bp && !bp.classList.contains('collapsed') && vt && vt.classList.contains('active');
      }, { timeout: 6000 });

      const state = await page.evaluate(() => {
        const bp = document.querySelector('#bottom-panel');
        const vt = document.querySelector('#view-trackers');
        const subtabs = Array.from(vt.querySelectorAll('.subtab-btn')).map(b => ({
          text: b.innerText.trim(),
          active: b.classList.contains('active')
        }));
        const hasDisclaimer = vt.innerText.includes('Sample data') || vt.innerText.includes('داده نمونه');
        const hasInput = !!vt.querySelector('#tracker-filter-input');
        const hasBodyArea = !!vt.querySelector('#tracker-body-area');
        return {
          panelExpanded: bp && !bp.classList.contains('collapsed'),
          viewActive: vt && vt.classList.contains('active'),
          subtabs,
          hasDisclaimer,
          hasInput,
          hasBodyArea
        };
      });

      assert(state.panelExpanded, 'FR-002 bottom panel expanded on trackers click', 'Bottom panel still collapsed');
      assert(state.viewActive, 'FR-002 view-trackers active', '#view-trackers missing active class');
      assert(state.subtabs.length === 4, 'FR-002 four sub-tabs rendered', `Expected 4 subtabs, got ${state.subtabs.length}`);
      assert(state.subtabs[0].active, 'FR-002 first sub-tab selected by default', 'First subtab is not active');
      assert(state.subtabs[0].text === 'Congressional Stock Trades', 'FR-002 subtab 1 title', `Expected Congressional Stock Trades, got ${state.subtabs[0].text}`);
      assert(state.subtabs[1].text === 'SEC Form 4 Insider Trades', 'FR-002 subtab 2 title', `Expected SEC Form 4 Insider Trades, got ${state.subtabs[1].text}`);
      assert(state.subtabs[2].text === 'Hedge Fund 13F Portfolios', 'FR-002 subtab 3 title', `Expected Hedge Fund 13F Portfolios, got ${state.subtabs[2].text}`);
      assert(state.subtabs[3].text === 'FINRA Short Sale Volume', 'FR-002 subtab 4 title', `Expected FINRA Short Sale Volume, got ${state.subtabs[3].text}`);
      assert(state.hasDisclaimer, 'FR-002 sample data disclaimer banner rendered', 'Missing disclaimer note');
      assert(state.hasInput, 'FR-002 tracker filter input rendered', 'Missing #tracker-filter-input');
      assert(state.hasBodyArea, 'FR-002 tracker body area rendered', 'Missing #tracker-body-area');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Official Source Links in Congress Rows (FR-002, User Story 1 Scenario 3)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const links = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#view-trackers table tbody tr'));
        return rows.map(r => {
          const a = r.querySelector('a');
          return {
            rowText: r.innerText.slice(0, 40),
            hasLink: !!a,
            href: a ? a.href : null,
            target: a ? a.target : null
          };
        });
      });

      assert(links.length > 0, 'FR-002 congressional trades rendered', 'No rows in table');
      assert(links.every(l => l.hasLink && l.href && (l.href.startsWith('https://disclosures-clerk.house.gov/') || l.href.startsWith('https://efdsearch.senate.gov/'))),
        'FR-002 congressional trades carry official filing sourceUrl links',
        `Invalid source links: ${JSON.stringify(links)}`);
      assert(links.every(l => l.target === '_blank'), 'FR-002 filing links open in new tab', 'Missing target="_blank"');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Sub-Tab Switching & Verification across all 4 Disclosure Categories (FR-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch to Sub-tab 2: SEC Form 4 Insider Trades
      await realClick(page, '#view-trackers .subtab-btn:nth-of-type(2)');
      await page.waitForFunction(() => {
        const table = document.querySelector('#view-trackers table');
        return table && table.innerText.includes('Huang');
      }, { timeout: 5000 });

      const insiderState = await page.evaluate(() => {
        const table = document.querySelector('#view-trackers table');
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        return {
          rowCount: rows.length,
          headers,
          hasHuang: table.innerText.includes('Huang Jen Hsun'),
          hasRule10b5: table.innerText.includes('Rule 10b5-1')
        };
      });
      assert(insiderState.rowCount >= 3, 'FR-002 SEC Form 4 insider rows rendered', `Expected >= 3, got ${insiderState.rowCount}`);
      assert(insiderState.hasHuang, 'FR-002 SEC Form 4 displays insider name', 'Missing Huang Jen Hsun');
      assert(insiderState.hasRule10b5, 'FR-002 SEC Form 4 displays Rule 10b5-1 transaction type', 'Missing transaction type');

      // Switch to Sub-tab 3: Hedge Fund 13F Portfolios
      await realClick(page, '#view-trackers .subtab-btn:nth-of-type(3)');
      await page.waitForFunction(() => {
        const body = document.querySelector('#view-trackers #tracker-body-area');
        return body && body.innerText.includes('Berkshire Hathaway');
      }, { timeout: 5000 });

      const fundState = await page.evaluate(() => {
        const body = document.querySelector('#view-trackers #tracker-body-area');
        return {
          hasBerkshire: body.innerText.includes('Berkshire Hathaway'),
          hasCitadel: body.innerText.includes('Citadel Advisors'),
          hasHoldingsTable: !!body.querySelector('table')
        };
      });
      assert(fundState.hasBerkshire && fundState.hasCitadel, 'FR-002 13F portfolios rendered', 'Missing Berkshire or Citadel');

      // Switch to Sub-tab 4: FINRA Short Sale Volume
      await realClick(page, '#view-trackers .subtab-btn:nth-of-type(4)');
      await page.waitForFunction(() => {
        const table = document.querySelector('#view-trackers table');
        return table && table.innerText.includes('Short Volume');
      }, { timeout: 5000 });

      const shortVolState = await page.evaluate(() => {
        const table = document.querySelector('#view-trackers table');
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        return {
          rowCount: rows.length,
          hasPercentages: rows.every(r => r.innerText.includes('%'))
        };
      });
      assert(shortVolState.rowCount >= 5, 'FR-002 FINRA short volume rows rendered', `Expected >= 5, got ${shortVolState.rowCount}`);
      assert(shortVolState.hasPercentages, 'FR-002 FINRA short ratios display percentage', 'Percentage sign missing');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Text Filtering over Member, Company, Fund & Symbol (FR-002, US1 Scenario 2)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const filterSelector = '#view-trackers #tracker-filter-input';

      // 4.1 Filter Short Volume by Symbol "TSLA"
      await page.focus(filterSelector);
      await page.keyboard.type('TSLA');
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('#view-trackers table tbody tr');
        return rows.length === 1 && rows[0].innerText.includes('TSLA');
      }, { timeout: 4000 });

      const tslaFilter = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#view-trackers table tbody tr'));
        return { count: rows.length, text: rows[0]?.innerText };
      });
      assert(tslaFilter.count === 1 && tslaFilter.text.includes('TSLA'),
        'FR-002 short volume filter by symbol', `Expected 1 row with TSLA, got ${tslaFilter.count}`);

      // Clear filter
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, filterSelector);
      await page.waitForFunction(() => document.querySelectorAll('#view-trackers table tbody tr').length >= 5);

      // 4.2 Switch to 13F and filter by Fund "Citadel"
      await realClick(page, '#view-trackers .subtab-btn:nth-of-type(3)');
      await page.waitForFunction(() => document.querySelector('#view-trackers #tracker-body-area')?.innerText.includes('Citadel'));
      await page.focus(filterSelector);
      await page.keyboard.type('Citadel');
      await page.waitForFunction(() => {
        const body = document.querySelector('#view-trackers #tracker-body-area');
        return body.innerText.includes('Citadel') && !body.innerText.includes('Berkshire Hathaway');
      }, { timeout: 4000 });

      const citadelFilter = await page.evaluate(() => {
        const body = document.querySelector('#view-trackers #tracker-body-area');
        return {
          hasCitadel: body.innerText.includes('Citadel Advisors'),
          hasBerkshire: body.innerText.includes('Berkshire Hathaway')
        };
      });
      assert(citadelFilter.hasCitadel && !citadelFilter.hasBerkshire,
        'FR-002 13F filter by fund name', 'Citadel not isolated');

      // Clear filter
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, filterSelector);

      // 4.3 Switch to Congress and filter by Member "Pelosi"
      await realClick(page, '#view-trackers .subtab-btn:nth-of-type(1)');
      await page.waitForFunction(() => document.querySelector('#view-trackers table tbody tr'));
      await page.focus(filterSelector);
      await page.keyboard.type('Pelosi');
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('#view-trackers table tbody tr');
        return rows.length === 1 && rows[0].innerText.includes('Pelosi');
      }, { timeout: 4000 });

      const pelosiFilter = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#view-trackers table tbody tr'));
        return { count: rows.length, text: rows[0]?.innerText };
      });
      assert(pelosiFilter.count === 1 && pelosiFilter.text.includes('Nancy Pelosi'),
        'FR-002 congress filter by member name', `Expected Nancy Pelosi row, got ${pelosiFilter.text}`);

      // Clear filter
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, filterSelector);
      await page.waitForFunction(() => document.querySelectorAll('#view-trackers table tbody tr').length >= 5);
    }

    console.log('✅ [008 Trackers Acceptance Suite] All scenarios passed with verified interactions and official filing links.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Suite unhandled error: ${err.message}`);
  process.exit(1);
});
