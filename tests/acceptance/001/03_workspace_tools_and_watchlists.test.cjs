/**
 * @spec 001
 * @covers FR-009, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018
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
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    console.log("03: starting FR-009");
    // FR-009: Watchlists, multi-list, flags, Space/Shift+Space stepping, plan quotas
    {
      const initialSymbol = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);

      // Add symbol and flag color
      await page.evaluate(() => {
        const wm = window.__TRADING_APP__?.watchlist;
        wm?.addSymbol?.('BNBUSDT');
        wm?.setFlag?.('BNBUSDT', 'red');
      });

      const flags = await page.evaluate(() => JSON.parse(localStorage.getItem('tradingchart_watchlist_flags') || '{}'));
      assert(flags['BNBUSDT'] === 'red', 'FR-009 watchlist flag persistence', 'Expected BNBUSDT flag to be red');

      // Test Space (next) and Shift+Space (prev) stepping
      await page.keyboard.press('Space');
      await page.waitForFunction((prev) => window.__TRADING_APP__.currentSymbol !== prev, {}, initialSymbol);
      const nextSymbol = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(nextSymbol !== initialSymbol, 'FR-009 Space key advances symbol', `Expected switch from ${initialSymbol}`);

      await page.keyboard.down('Shift');
      await page.keyboard.press('Space');
      await page.keyboard.up('Shift');
      await page.waitForFunction((prev) => window.__TRADING_APP__.currentSymbol !== prev, {}, nextSymbol);
      const prevSymbol = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(prevSymbol === initialSymbol, 'FR-009 Shift+Space steps back', `Expected return to ${initialSymbol}, got ${prevSymbol}`);
    }

    console.log("03: starting FR-012");
    // FR-012: Go to date (Alt+G)
    {
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyG');
      await page.keyboard.up('Alt');
      await page.waitForSelector('#goto-date-modal.open', { visible: true, timeout: 5000 });

      // Click quick offset "1w ago" then "Go"
      await page.evaluate(() => {
        const quick = Array.from(document.querySelectorAll('#goto-date-modal .gtd-quick, #goto-date-modal button')).find(b => b.innerText?.includes('1w'));
        quick?.click();
      });
      await realClick(page, '#gtd-apply, #goto-date-modal .btn-primary');
      await page.waitForFunction(() => !document.querySelector('#goto-date-modal')?.classList.contains('open'));
    }

    console.log("03: starting FR-013");
    // FR-013: Chart settings modal (4 tabs, persistence)
    {
      await page.evaluate(() => window.__TRADING_APP__.settingsModal?.open());
      await page.waitForSelector('#modal-settings.open', { visible: true, timeout: 5000 });

      const tabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#modal-settings [data-tab]')).map(t => t.getAttribute('data-tab'));
      });
      assert(tabs.includes('appearance'), 'FR-013 settings appearance tab', 'Missing appearance tab');
      assert(tabs.includes('scales'), 'FR-013 settings scales tab', 'Missing scales tab');
      assert(tabs.includes('trading'), 'FR-013 settings trading tab', 'Missing trading tab');
      assert(tabs.includes('system'), 'FR-013 settings system tab', 'Missing system tab');

      // Click each tab
      await page.evaluate(() => window.__TRADING_APP__.settingsModal?.setTab('scales'));
      await page.evaluate(() => window.__TRADING_APP__.settingsModal?.setTab('trading'));
      await page.evaluate(() => window.__TRADING_APP__.settingsModal?.setTab('system'));

      await realClick(page, '#modal-settings [data-close], #modal-settings .modal-close-btn');
      await page.waitForFunction(() => !document.querySelector('#modal-settings')?.classList.contains('open'));
    }

    console.log("03: starting FR-014");
    // FR-014: Right-click context menus (Price Pane, Price Scale, Drawing)
    {
      // 1. Price Pane context menu
      const canvas = await page.$('canvas');
      const box = await canvas.boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      await page.mouse.click(cx, cy, { button: 'right' });
      await page.waitForSelector('#canvas-context-menu', { visible: true, timeout: 5000 });

      const paneMenuText = await page.evaluate(() => document.querySelector('#canvas-context-menu')?.innerText || '');
      assert(paneMenuText.includes('Add Alert at') || paneMenuText.includes('Alert'), 'FR-014 context menu Add Alert', 'Missing Add Alert in menu');
      assert(paneMenuText.includes('Buy') || paneMenuText.includes('Sell'), 'FR-014 context menu Limit orders', 'Missing Buy/Sell Limit in menu');

      // Dismiss menu
      await page.keyboard.press('Escape');

      // 2. Dedicated Price Scale context menu
      const scaleX = box.x + box.width - 25;
      await page.mouse.click(scaleX, cy, { button: 'right' });
      await page.waitForSelector('#canvas-context-menu', { visible: true, timeout: 5000 });
      const scaleMenuText = await page.evaluate(() => document.querySelector('#canvas-context-menu')?.innerText || '');
      assert(scaleMenuText.includes('Price Scale') || scaleMenuText.includes('Auto'), 'FR-014 price scale context menu', 'Expected scale-specific actions');

      await page.keyboard.press('Escape');

      // 3. Drawing context menu
      await page.evaluate(() => {
        window.__TRADING_APP__.contextMenu?.showDrawingMenu({ clientX: 200, clientY: 200, preventDefault: () => {} }, { id: 'd_test', type: 'line' });
      });
      await page.waitForSelector('#canvas-context-menu', { visible: true, timeout: 5000 });
      const drawingMenuText = await page.evaluate(() => document.querySelector('#canvas-context-menu')?.innerText || '');
      assert(drawingMenuText.includes('Drawing') || drawingMenuText.includes('Duplicate') || drawingMenuText.includes('Remove'), 'FR-014 drawing context menu', 'Missing drawing menu actions');

      await page.keyboard.press('Escape');
    }

    console.log("03: starting FR-015");
    // FR-015: Data export (Alt+E and plan gate)
    {
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyE');
      await page.keyboard.up('Alt');
      await page.waitForSelector('#modal-data-export.open', { visible: true, timeout: 5000 });

      // Click Download on Basic plan -> prompts #tc-plans-modal
      await page.evaluate(() => {
        const modal = document.querySelector('#modal-data-export');
        const dlBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('Download'));
        dlBtn?.click();
      });
      await page.waitForSelector('#tc-plans-modal.open', { visible: true, timeout: 5000 });
      assert(await page.evaluate(() => document.querySelector('#tc-plans-modal')?.classList.contains('open')), 'FR-015 dataExport plan gate', 'Expected plans dialog on export without entitlement');

      // Close plans and export dialogs
      await realClick(page, '#tc-plans-modal [data-close]');
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal'));
      await page.evaluate(() => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        document.activeElement?.blur();
      });
    }

    console.log("03: starting FR-016");
    // FR-016: Screenshot composite studio (Alt+S)
    {
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyS');
      await page.keyboard.up('Alt');
      await page.waitForSelector('#modal-screenshot-preview.open', { visible: true, timeout: 5000 });

      const actions = await page.evaluate(() => ({
        download: !!document.querySelector('#btn-dl-screenshot'),
        print: !!document.querySelector('#btn-print-chart'),
        embed: !!document.querySelector('#btn-embed-code'),
        link: !!document.querySelector('#btn-copy-screenshot-link'),
        social: !!document.querySelector('#btn-copy-social-text')
      }));

      assert(actions.download, 'FR-016 screenshot Download PNG', 'Missing download action');
      assert(actions.print, 'FR-016 screenshot Print', 'Missing print action');
      assert(actions.embed, 'FR-016 screenshot Embed', 'Missing embed action');
      assert(actions.link, 'FR-016 screenshot Copy link', 'Missing copy link action');
      assert(actions.social, 'FR-016 screenshot Copy post text', 'Missing copy social text action');

      await realClick(page, '#btn-close-screenshot');
      await page.waitForFunction(() => !document.querySelector('#modal-screenshot-preview')?.classList.contains('open'));
    }

    console.log("03: starting FR-017");
    // FR-017: Compare symbols overlay modal (Alt+C)
    {
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyC');
      await page.keyboard.up('Alt');
      await page.waitForSelector('#modal-compare.open', { visible: true, timeout: 5000 });

      const compareModes = await page.evaluate(() => {
        const modal = document.querySelector('#modal-compare');
        return Array.from(modal.querySelectorAll('button')).map(b => b.innerText?.trim());
      });
      assert(compareModes.some(m => m.includes('% Scale') || m.includes('Scale')), 'FR-017 compare percent/price modes', 'Missing comparison scale options');

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-compare')?.classList.contains('open'));
    }

    console.log("03: starting FR-018");
    // FR-018: Side dock toggle and Quant/Journal navigation
    {
      // Quant -> Journal
      await realClick(page, '#nav-btn-journal');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#journal-workspace-view')).display !== 'none');
      assert(await page.evaluate(() => window.__TRADING_APP__.activeWorkspaceView === 'journal'), 'FR-018 journal view active', 'Active view should be journal');

      // Journal -> Quant
      await realClick(page, '#nav-btn-quant');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#chart-area')).display !== 'none');
      assert(await page.evaluate(() => window.__TRADING_APP__.activeWorkspaceView === 'quant'), 'FR-018 quant view active', 'Active view should be quant');

      // Open side dock panel (watchlist)
      await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('watchlist', true));
      await page.waitForSelector('.vela-panel-watchlist', { visible: true, timeout: 5000 });
      assert(await page.evaluate(() => !!document.querySelector('.vela-panel-watchlist')), 'FR-018 side dock open', 'Watchlist panel should be mounted in side dock');

      // Collapse side dock
      await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('watchlist', false));
      await page.waitForFunction(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        return !p || getComputedStyle(p).display === 'none';
      });
      assert(await page.evaluate(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        return !p || getComputedStyle(p).display === 'none';
      }), 'FR-018 side dock collapse', 'Watchlist panel should be hidden');
    }

    console.log('PASS: 001 [Workspace Tools & Watchlists]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}`);
  process.exit(1);
});
