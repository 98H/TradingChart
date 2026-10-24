/**
 * @spec 003
 * @covers FR-009
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
    // FR-009: Drawing right-click context menu and actions
    // ──────────────────────────────────────────────────────────────────────────
    {
      // 1. Programmatically place a single drawing on the chart
      await page.evaluate(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        d.add('trendline', {
          points: [
            { time: Date.now() - 3600000 * 4, price: 60000 },
            { time: Date.now() - 3600000 * 2, price: 62000 }
          ]
        });
      });

      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);
      const initialCount = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length);
      assert(initialCount === 1, 'FR-009 initial drawings placed', `Expected 1 drawing, got ${initialCount}`);

      // 2. Right-click on chart canvas (targets the drawing)
      const chartBox = await page.$eval('#chart-area', el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      });
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => {
        const menu = document.querySelector('#canvas-context-menu');
        return menu && menu.style.display === 'block';
      });

      // Verify all 6 drawing menu actions exist in the context menu
      const actions = await page.evaluate(() => {
        return {
          settings: !!document.querySelector('#ctx-draw-settings'),
          duplicate: !!document.querySelector('#ctx-draw-duplicate'),
          lock: !!document.querySelector('#ctx-draw-lock'),
          front: !!document.querySelector('#ctx-draw-front'),
          back: !!document.querySelector('#ctx-draw-back'),
          remove: !!document.querySelector('#ctx-draw-remove')
        };
      });
      assert(actions.settings, 'FR-009 context menu #ctx-draw-settings', 'Missing Drawing Settings option');
      assert(actions.duplicate, 'FR-009 context menu #ctx-draw-duplicate', 'Missing Duplicate option');
      assert(actions.lock, 'FR-009 context menu #ctx-draw-lock', 'Missing Lock option');
      assert(actions.front, 'FR-009 context menu #ctx-draw-front', 'Missing Bring to Front option');
      assert(actions.back, 'FR-009 context menu #ctx-draw-back', 'Missing Send to Back option');
      assert(actions.remove, 'FR-009 context menu #ctx-draw-remove', 'Missing Remove Drawing option');

      // 3. Test Lock action -> drawing locked flag becomes true
      await realClick(page, '#ctx-draw-lock');
      await page.waitForFunction(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        const all = d?.all() || [];
        return all.length > 0 && all[0].locked === true;
      });
      const isLocked = await page.evaluate(() => {
        const all = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all() || [];
        return all[0]?.locked;
      });
      assert(isLocked === true, 'FR-009 lock action toggles drawing locked', 'Expected target drawing to be locked');

      // 4. Test Unlock action -> right-click again (all locked -> targets newest drawing) and unlock
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-lock');
      await page.waitForFunction(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        const all = d?.all() || [];
        return all.length > 0 && all[0].locked === false;
      });
      const isUnlocked = await page.evaluate(() => {
        const all = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all() || [];
        return all[0]?.locked;
      });
      assert(isUnlocked === false, 'FR-009 unlock action toggles drawing unlocked', 'Expected target drawing to be unlocked');

      // 5. Test Duplicate action -> drawing count increases by 1
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-duplicate');
      await page.waitForFunction((count) => {
        return (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === count + 1;
      }, {}, initialCount);
      const afterDuplicateCount = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length);
      assert(afterDuplicateCount === initialCount + 1, 'FR-009 duplicate increases drawing count by 1',
        `Expected ${initialCount + 1}, got ${afterDuplicateCount}`);

      // 6. Test Bring to Front and Send to Back
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-front');
      await page.waitForFunction(() => !document.querySelector('#canvas-context-menu') || document.querySelector('#canvas-context-menu').style.display !== 'block');

      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-back');
      await page.waitForFunction(() => !document.querySelector('#canvas-context-menu') || document.querySelector('#canvas-context-menu').style.display !== 'block');

      // 7. Test Settings action
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-settings');
      await page.waitForFunction(() => !document.querySelector('#canvas-context-menu') || document.querySelector('#canvas-context-menu').style.display !== 'block');

      // 8. Test Remove Drawing action -> drawing count decreases by 1
      const countBeforeRemove = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length);
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      await realClick(page, '#ctx-draw-remove');
      await page.waitForFunction((count) => {
        return (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === count - 1;
      }, {}, countBeforeRemove);
      const countAfterRemove = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length);
      assert(countAfterRemove === countBeforeRemove - 1, 'FR-009 remove drawing decreases drawing count by 1',
        `Expected ${countBeforeRemove - 1}, got ${countAfterRemove}`);

      // 9. Edge case: Plain canvas right-click when no drawings exist opens price context menu
      await page.evaluate(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        const all = d?.all() || [];
        all.forEach(dr => { try { d.remove(dr.id); } catch (e) {} });
      });
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 0);

      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');
      const isPriceMenu = await page.evaluate(() => {
        return !!document.querySelector('#ctx-add-alert') && !document.querySelector('#ctx-draw-remove');
      });
      assert(isPriceMenu, 'FR-009 empty canvas right-click shows price menu', 'Expected price action menu when no drawings exist');
      await page.keyboard.press('Escape');
    }

  } catch (err) {
    console.error(`❌ Unexpected failure: ${err.stack || err.message}`);
    process.exit(1);
  } finally {
    await ctx.browser.close();
  }

  console.log('PASS: 003 [03_drawing_context_menu_and_actions]');
}

run().catch(err => {
  console.error(`❌ Unexpected fatal failure: ${err.message}`);
  process.exit(1);
});
