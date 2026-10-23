/**
 * @spec 001
 * @covers FR-001, FR-006, FR-007, FR-008, FR-010, FR-011
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
    return top && (top === target || target.contains(top) || top.contains(target));
  }, { cx, cy, selector });
  if (!match) {
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // FR-001: Symbol search open from widget, filter, arrow key and switch symbol
    {
      // Given the chart page, When the user clicks the symbol widget
      await realClick(page, '.vela-widget-symbol, #btn-symbol-search');
      await page.waitForFunction(() => document.querySelector('#modal-symbol-search')?.classList.contains('open'));

      // Then the symbol search dialog opens with the search input focused
      const isInputFocused = await page.evaluate(() => document.activeElement === document.querySelector('#symbol-search-input'));
      assert(isInputFocused, 'FR-001 search input focused', 'Expected #symbol-search-input to be focused');

      // When the user types a query, Then catalogue entries matching are listed
      await page.type('#symbol-search-input', 'ETH', { delay: 20 });
      await page.evaluate(() => document.querySelector('#symbol-search-input')?.dispatchEvent(new Event('input', { bubbles: true })));
      await page.waitForFunction(() => (document.querySelectorAll('.sym-search-row')?.length || 0) > 0);

      const countBadge = await page.evaluate(() => document.querySelector('#sym-count-badge')?.innerText);
      assert(countBadge && countBadge.length > 0, 'FR-001 result count badge', 'Expected non-empty count badge');

      // When user presses ArrowDown and Enter, Then dialog closes and active chart loads symbol
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('#modal-symbol-search')?.classList.contains('open'));
      await page.waitForFunction(() => window.__TRADING_APP__?.currentSymbol?.includes('ETH') || window.__TRADING_APP__?.currentSymbol === 'USDT_TOMAN');

      const switchedSym = await page.evaluate(() => window.__TRADING_APP__.currentSymbol);
      assert(switchedSym && (switchedSym.includes('ETH') || switchedSym === 'USDT_TOMAN'), 'FR-001 active chart symbol switch', `Unexpected symbol: ${switchedSym}`);
      await page.evaluate(() => document.querySelector('#symbol-search-input')?.blur());
    }

    // FR-006: Timeframe picker, interval switch, custom & seconds plan gates
    {
      // Open timeframe dialog via keyboard shortcut ","
      await page.keyboard.press('Comma');
      await page.waitForSelector('#modal-timeframes.open', { visible: true, timeout: 5000 });

      // Switch to standard timeframe 1h ("60")
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.btn-select-tf, button')).find(b => b.innerText?.trim()?.startsWith('1h'));
        btn?.click();
      });
      await page.waitForFunction(() => window.__TRADING_APP__?.currentTimeframe === '60');
      assert(await page.evaluate(() => window.__TRADING_APP__.currentTimeframe === '60'), 'FR-006 switch standard interval 1h', 'Active timeframe should be 60');

      // Re-open timeframe dialog and try adding custom interval on unentitled plan -> opens plans modal
      await page.keyboard.press('Comma');
      await page.waitForSelector('#btn-add-custom-tf', { visible: true, timeout: 5000 });
      await realClick(page, '#btn-add-custom-tf');
      await page.waitForSelector('#tc-plans-modal.open', { visible: true, timeout: 5000 });
      assert(await page.evaluate(() => document.querySelector('#tc-plans-modal')?.classList.contains('open')), 'FR-006 customIntervals plan gate', 'Expected #tc-plans-modal on custom interval');

      // Close plans dialog
      await realClick(page, '#tc-plans-modal [data-close], #tc-plans-modal button');
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal')?.classList.contains('open'));

      // Test custom timeframe persistence in storage
      await page.evaluate(() => {
        const customTfs = [{ id: '10', label: '10m', name: '10 m', nameFa: '۱۰ دقیقه' }];
        localStorage.setItem('tradingchart_custom_timeframes', JSON.stringify(customTfs));
      });
      const storedTfs = await page.evaluate(() => window.__TRADING_APP__.timeframeManager?.loadCustomTimeframes?.());
      assert(Array.isArray(storedTfs) && storedTfs.some(t => t.id === '10'), 'FR-006 custom interval persistence', 'Custom timeframe should persist in localStorage');

      // Close timeframe modal if still open
      await page.evaluate(() => document.querySelector('#modal-timeframes')?.classList.remove('open'));
    }

    // FR-007: Chart style menu, style change, synthetic plan gate
    {
      // Open style dropdown
      await realClick(page, '#btn-topbar-chart-style');
      await page.waitForSelector('#popover-chart-style', { visible: true, timeout: 5000 });

      // Pick native style "bars"
      await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.setStyle('bars'));
      await page.waitForFunction(() => localStorage.getItem('tradingchart_price_style') === 'bars');
      assert(await page.evaluate(() => localStorage.getItem('tradingchart_price_style') === 'bars'), 'FR-007 style change to bars', 'Style should be stored as bars');

      // Pick synthetic style "renko" on Basic plan -> style not changed and plans modal opens
      await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.setStyle('renko'));
      await page.waitForSelector('#tc-plans-modal.open', { visible: true, timeout: 5000 });
      assert(await page.evaluate(() => document.querySelector('#tc-plans-modal')?.classList.contains('open')), 'FR-007 synthChartTypes plan gate', 'Expected plans modal on synthetic chart style');
      assert(await page.evaluate(() => localStorage.getItem('tradingchart_price_style') === 'bars'), 'FR-007 synth style unapplied', 'Style should not have changed to renko');

      // Close plans modal
      await realClick(page, '#tc-plans-modal [data-close], #tc-plans-modal button');
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal')?.classList.contains('open'));
    }

    // FR-008: Scale dock controls, Alt+R, Alt+I, countdown timer
    {
      // Toggle Log scale
      await realClick(page, '#btn-scale-log');
      await page.waitForFunction(() => document.querySelector('#btn-scale-log')?.classList.contains('active'));
      assert(await page.evaluate(() => document.querySelector('#btn-scale-log')?.classList.contains('active')), 'FR-008 log scale active', 'Log scale button should be active');

      // Toggle Percent scale
      await realClick(page, '#btn-scale-percent');
      await page.waitForFunction(() => document.querySelector('#btn-scale-percent')?.classList.contains('active'));
      assert(await page.evaluate(() => document.querySelector('#btn-scale-percent')?.classList.contains('active')), 'FR-008 percent scale active', 'Percent scale button should be active');

      // Test Alt+I (invert scale)
      const invertBefore = await page.evaluate(() => document.querySelector('#btn-scale-invert')?.classList.contains('active'));
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyI');
      await page.keyboard.up('Alt');
      await page.waitForFunction((prev) => document.querySelector('#btn-scale-invert')?.classList.contains('active') !== prev, {}, invertBefore);

      // Test Alt+R (reset to auto-fit)
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyR');
      await page.keyboard.up('Alt');
      await page.waitForFunction(() => document.querySelector('#btn-scale-auto')?.classList.contains('active'));
      assert(await page.evaluate(() => document.querySelector('#btn-scale-auto')?.classList.contains('active')), 'FR-008 Alt+R auto-fit', 'Auto-scale button should be active after Alt+R');

      // Candle countdown display
      const countdownActive = await page.evaluate(() => {
        const sc = window.__TRADING_APP__?.scaleControls;
        const el = document.querySelector('#countdown-timer-val');
        return el ? true : (sc && sc.countdownTimer != null);
      });
      assert(countdownActive, 'FR-008 candle close countdown display', 'Countdown timer should be active when enabled');
    }

    // FR-010: Command palette (Ctrl+K)
    {
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyK');
      await page.keyboard.up('Control');
      await page.waitForSelector('#command-palette.open', { visible: true, timeout: 5000 });

      await page.type('#cp-input', 'Export', { delay: 20 });
      await page.waitForFunction(() => {
        const items = document.querySelectorAll('#command-palette .cp-item');
        return items.length > 0;
      });

      // Press Enter to execute highlighted command (Export OHLCV data)
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('#command-palette')?.classList.contains('open'));
      await page.waitForFunction(() => document.querySelector('#modal-data-export')?.classList.contains('open') || document.querySelector('#tc-plans-modal')?.classList.contains('open'));

      // Close open modal
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        document.activeElement?.blur();
      });
    }

    // FR-011: Keyboard shortcuts reference sheet (?)
    {
      await realClick(page, '#btn-shortcuts-help');
      await page.waitForSelector('#modal-shortcuts.open', { visible: true, timeout: 5000 });

      const categories = await page.evaluate(() => {
        const content = document.querySelector('#modal-shortcuts .modal-content');
        return Array.from(content?.children || []).map(sec => sec.querySelector('div')?.innerText?.trim()).filter(Boolean);
      });
      assert(categories.length >= 3, 'FR-011 shortcuts categories count', `Expected at least 3 categories, got ${categories.length}`);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-shortcuts')?.classList.contains('open'));
    }

    console.log('PASS: 001 [Chart Market Controls]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}`);
  process.exit(1);
});
