// tests/qa_cycle_ctx_depth.cjs — Cycle 2: drawing context menu + deep history
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  // ── History depth ──
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 6000 });
    const depth = await ctx.page.evaluate(() => {
      const scene = window.__TRADING_APP__.chartManager.workspace?.active?.chart?.orchestrator?.renderer?.scene;
      const bars = scene?.bars || [];
      return { len: bars.length, oldest: bars.length ? new Date(bars[0].time).toISOString() : null };
    });
    console.log('boot depth:', JSON.stringify(depth));
    depth.len >= 1500 ? pass(`boot loads ${depth.len} bars`) : fail('boot depth', depth.len);

    // timeframe switch keeps depth
    const tfDepth = await ctx.page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      await app.setTimeframe('D');
      await new Promise(r => setTimeout(r, 3000));
      const bars = app.chartManager.workspace?.active?.chart?.orchestrator?.renderer?.scene?.bars || [];
      return { len: bars.length, oldest: bars.length ? new Date(bars[0].time).toISOString().slice(0, 4) : null };
    });
    (tfDepth.len >= 1500 && parseInt(tfDepth.oldest) <= 2022) ? pass(`daily depth ${tfDepth.len} from ${tfDepth.oldest}`) : fail('daily depth', JSON.stringify(tfDepth));
    await ctx.page.screenshot({ path: path.join(EVID, 'ctx2_daily_depth.png') });

    // ── Drawing context menu ──
    // programmatically add + select a drawing, then right-click
    const drawProbe = await ctx.page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const d = app.chartManager.workspace?.active?.chart?.drawings;
      if (!d) return { err: 'no drawings api' };
      const dr = d.add('trendline', { points: [{ time: Date.now() - 86400000 * 5, price: 78000 }, { time: Date.now() - 86400000, price: 80000 }] });
      if (!dr) return { err: 'add returned null' };
      d.select([dr.id]);
      await new Promise(r => setTimeout(r, 400));
      return { id: dr.id, type: dr.type };
    });
    console.log('drawing added:', JSON.stringify(drawProbe));

    if (drawProbe.id) {
      // right-click on canvas center
      await ctx.page.mouse.click(700, 400, { button: 'right' });
      await new Promise(r => setTimeout(r, 600));
      const menuState = await ctx.page.evaluate(() => ({
        visible: document.querySelector('#canvas-context-menu')?.style.display === 'block',
        hasSettings: !!document.querySelector('#ctx-draw-settings'),
        hasDuplicate: !!document.querySelector('#ctx-draw-duplicate'),
        hasRemove: !!document.querySelector('#ctx-draw-remove')
      }));
      (menuState.visible && menuState.hasSettings && menuState.hasDuplicate && menuState.hasRemove)
        ? pass('drawing context menu opens with object actions')
        : fail('drawing context menu', JSON.stringify(menuState));
      await ctx.page.screenshot({ path: path.join(EVID, 'ctx2_drawing_menu.png') });

      // duplicate action works
      if (menuState.hasDuplicate) {
        const beforeCount = await ctx.page.evaluate(() => window.__TRADING_APP__.chartManager.workspace?.active?.chart?.drawings?.all()?.length || 0);
        await ctx.page.evaluate(() => document.querySelector('#ctx-draw-duplicate')?.click());
        await new Promise(r => setTimeout(r, 600));
        const afterCount = await ctx.page.evaluate(() => window.__TRADING_APP__.chartManager.workspace?.active?.chart?.drawings?.all()?.length || 0);
        afterCount === beforeCount + 1 ? pass('duplicate adds a drawing') : fail('duplicate', `${beforeCount} -> ${afterCount}`);
      }
    } else {
      fail('drawing add probe', JSON.stringify(drawProbe));
    }

    // plain canvas right-click still shows price menu (clear drawings first)
    await ctx.page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    await ctx.page.evaluate(() => {
      const d = window.__TRADING_APP__.chartManager.workspace?.active?.chart?.drawings;
      d?.all()?.forEach(dr => { try { d.remove(dr.id); } catch (e) {} });
    });
    await ctx.page.mouse.click(700, 400, { button: 'right' });
    await new Promise(r => setTimeout(r, 500));
    const priceMenu = await ctx.page.evaluate(() => ({
      visible: document.querySelector('#canvas-context-menu')?.style.display === 'block',
      hasAlert: !!document.querySelector('#ctx-add-alert')
    }));
    (priceMenu.visible && priceMenu.hasAlert) ? pass('canvas right-click shows price menu') : fail('price menu', JSON.stringify(priceMenu));
    await ctx.page.keyboard.press('Escape');

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 2 (ctx+depth) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'ctx2_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
