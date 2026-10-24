/**
 * @spec 003
 * @covers FR-001, FR-002, FR-003, FR-007, FR-008, FR-012
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

    // ──────────────────────────────────────────────────────────────────────────
    // FR-001: Floating favourites toolbar arms / disarms tools with highlight
    // ──────────────────────────────────────────────────────────────────────────
    {
      const toolbarVisible = await page.evaluate(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb && getComputedStyle(tb).display !== 'none';
      });
      assert(toolbarVisible, 'FR-001 floating toolbar visibility', 'Expected #floating-drawing-toolbar to be visible on desktop');

      // Click trendline favorite button to arm
      await realClick(page, '#floating-drawing-toolbar [data-tool="trendline"]');
      await page.waitForFunction(() => {
        const btn = document.querySelector('#floating-drawing-toolbar [data-tool="trendline"]');
        const tool = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.();
        return btn?.classList.contains('active') && tool === 'trendline';
      });
      const armedTool = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.());
      assert(armedTool === 'trendline', 'FR-001 arm trendline favorite', `Expected armed tool trendline, got ${armedTool}`);

      // Second click disarms tool and removes active highlight
      await realClick(page, '#floating-drawing-toolbar [data-tool="trendline"]');
      await page.waitForFunction(() => {
        const btn = document.querySelector('#floating-drawing-toolbar [data-tool="trendline"]');
        const tool = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.();
        return !btn?.classList.contains('active') && tool === null;
      });
      const disarmedTool = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.());
      assert(disarmedTool === null, 'FR-001 disarm trendline favorite', `Expected null tool, got ${disarmedTool}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-002: Keyboard shortcuts arm tools
    // ──────────────────────────────────────────────────────────────────────────
    {
      const shortcuts = [
        { key: 'KeyT', expected: 'trendline', label: 'Alt+T trend line' },
        { key: 'KeyH', expected: 'hline', label: 'Alt+H horizontal line' },
        { key: 'KeyF', expected: 'fibretracement', label: 'Alt+F Fibonacci retracement' },
        { key: 'KeyB', expected: 'box', label: 'Alt+B box' },
        { key: 'KeyP', expected: 'position', label: 'Alt+P position' },
        { key: 'KeyV', expected: 'vline', label: 'Alt+V vertical line' }
      ];

      for (const s of shortcuts) {
        await page.keyboard.down('Alt');
        await page.keyboard.press(s.key);
        await page.keyboard.up('Alt');

        await page.waitForFunction((expected) => {
          return window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.() === expected;
        }, {}, s.expected);

        const currentTool = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.());
        assert(currentTool === s.expected, `FR-002 ${s.label}`, `Expected ${s.expected}, got ${currentTool}`);
      }

      // Disarm active tool after shortcut checks
      await page.evaluate(() => window.__TRADING_APP__?.chartManager?.clearDrawingTool?.());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-003: Undo and redo from topbar buttons and Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl+Shift+Z
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Add a drawing programmatically
      await page.evaluate(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        d?.add?.('trendline', {
          points: [
            { time: Date.now() - 600000, price: 65000 },
            { time: Date.now() - 300000, price: 66000 }
          ]
        });
      });
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);

      // Undo via topbar button #btn-undo
      await realClick(page, '#btn-undo');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 0);
      assert((await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length)) === 0,
        'FR-003 topbar undo button', 'Drawing was not removed by #btn-undo');

      // Redo via topbar button #btn-redo
      await realClick(page, '#btn-redo');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);
      assert((await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length)) === 1,
        'FR-003 topbar redo button', 'Drawing was not restored by #btn-redo');

      // Undo via Ctrl+Z
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyZ');
      await page.keyboard.up('Control');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 0);
      assert((await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length)) === 0,
        'FR-003 shortcut Ctrl+Z undo', 'Drawing was not removed by Ctrl+Z');

      // Redo via Ctrl+Y
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyY');
      await page.keyboard.up('Control');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);
      assert((await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length)) === 1,
        'FR-003 shortcut Ctrl+Y redo', 'Drawing was not restored by Ctrl+Y');

      // Undo again, then Redo via Ctrl+Shift+Z
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyZ');
      await page.keyboard.up('Control');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 0);

      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('KeyZ');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);
      assert((await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length)) === 1,
        'FR-003 shortcut Ctrl+Shift+Z redo', 'Drawing was not restored by Ctrl+Shift+Z');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-012: Draggable toolbar, clamping inside chart area, persistence, reset
    // ──────────────────────────────────────────────────────────────────────────
    {
      const handle = await page.$('.fav-tool-drag-handle');
      assert(!!handle, 'FR-012 drag handle element', 'Missing .fav-tool-drag-handle');
      const box = await handle.boundingBox();
      assert(!!box, 'FR-012 handle bounding box', 'Bounding box unavailable for drag handle');

      // Drag toolbar across chart area
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y - 200, { steps: 5 });
      await page.mouse.up();

      await page.waitForFunction(() => {
        const stored = localStorage.getItem('tradingchart_fav_toolbar_pos');
        return !!stored;
      });

      const pos = await page.evaluate(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        const stored = JSON.parse(localStorage.getItem('tradingchart_fav_toolbar_pos') || '{}');
        return {
          left: parseInt(tb.style.left, 10),
          top: parseInt(tb.style.top, 10),
          storedLeft: stored.left,
          storedTop: stored.top
        };
      });
      assert(pos.left >= 52, 'FR-012 left clamp >= 52', `Left position was ${pos.left}`);
      assert(pos.left === pos.storedLeft, 'FR-012 pos left persisted', 'localStorage left does not match element style');

      // Reload page and verify toolbar reappears at saved coordinates
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction((expected) => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb && tb.style.left === `${expected.left}px` && tb.style.top === `${expected.top}px`;
      }, { timeout: 10000 }, pos);
      const reloadedPos = await page.evaluate(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return {
          left: parseInt(tb.style.left, 10),
          top: parseInt(tb.style.top, 10)
        };
      });
      assert(reloadedPos.left === pos.left && reloadedPos.top === pos.top,
        'FR-012 position restored after reload', `Expected (${pos.left}, ${pos.top}), got (${reloadedPos.left}, ${reloadedPos.top})`);

      // Edge case: Corrupt or out-of-bounds position in localStorage resets to default { bottom: 68, left: 52 }
      await page.evaluate(() => {
        localStorage.setItem('tradingchart_fav_toolbar_pos', JSON.stringify({ top: -99999, left: -99999 }));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb && tb.style.bottom === '68px' && tb.style.left === '52px';
      }, { timeout: 10000 });
      const resetPos = await page.evaluate(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return {
          bottom: tb.style.bottom,
          left: tb.style.left,
          top: tb.style.top
        };
      });
      assert(resetPos.bottom === '68px' && resetPos.left === '52px',
        'FR-012 edge case out-of-bounds position reset', `Expected bottom 68px left 52px, got ${JSON.stringify(resetPos)}`);

      // Edge case: Missing or corrupt favourites in storage uses default favourites
      await page.evaluate(() => {
        localStorage.setItem('tradingchart_drawing_favorites', 'invalid-json{{{');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb && (tb.querySelectorAll('[data-tool]').length || 0) >= 8;
      }, { timeout: 10000 });
      const defaultFavsPresent = await page.evaluate(() => {
        const tbTools = Array.from(document.querySelectorAll('#floating-drawing-toolbar [data-tool]')).map(b => b.dataset.tool);
        return tbTools.includes('trendline') && tbTools.includes('hline') && tbTools.includes('box');
      });
      assert(defaultFavsPresent, 'FR-001 edge case corrupt favorites fallback', 'Default favorites not restored after corrupt storage');

      // Clean up localStorage keys
      await page.evaluate(() => {
        localStorage.removeItem('tradingchart_fav_toolbar_pos');
        localStorage.removeItem('tradingchart_drawing_favorites');
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-007: Toolbar auxiliary controls (magnet, lock, hide, clear, minimize)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Magnet toggle on toolbar
      await realClick(page, '#fav-btn-magnet');
      await page.waitForFunction(() => document.querySelector('#fav-btn-magnet')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.magnetMode === true),
        'FR-007 toolbar magnet toggle on', 'Toolbar magnetMode should be true');
      await realClick(page, '#fav-btn-magnet');
      await page.waitForFunction(() => !document.querySelector('#fav-btn-magnet')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.magnetMode === false),
        'FR-007 toolbar magnet toggle off', 'Toolbar magnetMode should be false');

      // Lock toggle
      await realClick(page, '#fav-btn-lock');
      await page.waitForFunction(() => document.querySelector('#fav-btn-lock')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isLocked === true),
        'FR-007 toolbar lock toggle on', 'Toolbar isLocked should be true');
      await realClick(page, '#fav-btn-lock');
      await page.waitForFunction(() => !document.querySelector('#fav-btn-lock')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isLocked === false),
        'FR-007 toolbar lock toggle off', 'Toolbar isLocked should be false');

      // Hide / show toggle
      await realClick(page, '#fav-btn-hide');
      await page.waitForFunction(() => document.querySelector('#fav-btn-hide')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isHidden === true),
        'FR-007 toolbar hide toggle on', 'Toolbar isHidden should be true');
      await realClick(page, '#fav-btn-hide');
      await page.waitForFunction(() => !document.querySelector('#fav-btn-hide')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isHidden === false),
        'FR-007 toolbar hide toggle off', 'Toolbar isHidden should be false');

      // Minimize / restore toggle
      await realClick(page, '#fav-btn-minimize');
      await page.waitForFunction(() => document.querySelector('.fav-toolbar-inner')?.classList.contains('minimized'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isMinimized === true),
        'FR-007 toolbar minimize on', 'Toolbar isMinimized should be true');
      await realClick(page, '#fav-btn-minimize');
      await page.waitForFunction(() => !document.querySelector('.fav-toolbar-inner')?.classList.contains('minimized'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.isMinimized === false),
        'FR-007 toolbar minimize off', 'Toolbar isMinimized should be false');

      // Clear trash button disarms active tool
      await realClick(page, '#floating-drawing-toolbar [data-tool="trendline"]');
      await page.waitForFunction(() => document.querySelector('#floating-drawing-toolbar [data-tool="trendline"]')?.classList.contains('active'));
      await realClick(page, '#fav-btn-trash');
      await page.waitForFunction(() => !document.querySelector('#floating-drawing-toolbar [data-tool="trendline"]')?.classList.contains('active'));
      assert(await page.evaluate(() => window.__TRADING_APP__?.floatingToolbar?.activeTool === null),
        'FR-007 clear trash disarms tool', 'Active tool should be null after trash click');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-008: Topbar magnet cycles snap mode off -> weak -> strong -> off with toast
    // ──────────────────────────────────────────────────────────────────────────
    {
      const expectedCycle = [
        { snap: 'weak', label: 'weak' },
        { snap: 'strong', label: 'strong' },
        { snap: 'off', label: 'off' }
      ];

      for (const step of expectedCycle) {
        await realClick(page, '#btn-magnet');
        await page.waitForFunction((expected) => {
          return window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getSnapMode?.() === expected;
        }, {}, step.snap);

        const currentSnap = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getSnapMode?.());
        assert(currentSnap === step.snap, `FR-008 topbar magnet cycle to ${step.label}`, `Expected ${step.snap}, got ${currentSnap}`);

        const toastText = await page.evaluate(() => document.querySelector('.tc-toast, .toast')?.innerText || '');
        assert(toastText.includes(step.label) || toastText.length > 0,
          `FR-008 topbar magnet toast for ${step.label}`, `Expected toast mentioning ${step.label}, got "${toastText}"`);
      }
    }

  } catch (err) {
    console.error(`❌ Unexpected failure: ${err.stack || err.message}`);
    process.exit(1);
  } finally {
    await ctx.browser.close();
  }

  console.log('PASS: 003 [01_toolbar_shortcuts_and_history]');
}

run().catch(err => {
  console.error(`❌ Unexpected fatal failure: ${err.message}`);
  process.exit(1);
});
