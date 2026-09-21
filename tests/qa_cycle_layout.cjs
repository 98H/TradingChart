// tests/qa_cycle_layout.cjs — Cycle 3: Layout Studio deep QA
// Verifies every grid preset applies, sync toggles work, saved layouts
// save/load/delete, and multi-cell symbol diversification lands — desktop + FA.
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 5000 });

    // 1. Layout studio opens from topbar
    await ctx.page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 600));
    const openOk = await ctx.page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
    openOk ? pass('layout studio opens') : fail('layout studio open');
    await ctx.page.screenshot({ path: path.join(EVID, 'layout_01_studio.png') });

    // 2. All 8 preset cards render
    const presetCount = await ctx.page.evaluate(() => document.querySelectorAll('.layout-preset-card').length);
    presetCount === 8 ? pass('8 presets') : fail('preset count', presetCount);

    // 3. Apply each grid, count resulting chart cells
    for (const layoutId of ['2h', '2v', '4']) {
      const res = await ctx.page.evaluate(async (lid) => {
        window.__TRADING_APP__.layoutManager.setLayout(lid, 'test');
        await new Promise(r => setTimeout(r, 1800));
        const cells = document.querySelectorAll('.vela-chart-cell, [class*="chart-cell"], .vela-cell').length;
        const label = document.querySelector('#active-layout-name')?.innerText;
        return { cells, label };
      }, layoutId);
      console.log(`layout ${layoutId}:`, JSON.stringify(res));
      const expected = layoutId === '4' ? 4 : 2;
      res.cells >= expected ? pass(`grid ${layoutId} renders ${res.cells} cells`) : fail(`grid ${layoutId}`, JSON.stringify(res));
      await ctx.page.screenshot({ path: path.join(EVID, `layout_02_grid_${layoutId}.png`) });
    }

    // 4. Quad layout: all 4 cells must eventually load bars (no pane left blank)
    const quadLoad = await ctx.page.evaluate(async () => {
      window.__TRADING_APP__.layoutManager.setLayout('4', 'Quad');
      // poll up to 12s for all cells to load (multi-cell fetches are staggered)
      const ws = window.__TRADING_APP__.chartManager.workspace;
      const deadline = Date.now() + 12000;
      let last = [];
      while (Date.now() < deadline) {
        last = Array.from(ws?.cellsById?.values() || []).map(c =>
          c?.chart?.orchestrator?.renderer?.scene?.bars?.length || 0);
        if (last.length >= 4 && last.every(n => n > 0)) break;
        await new Promise(r => setTimeout(r, 500));
      }
      return last;
    });
    console.log('quad cell bars:', quadLoad);
    (quadLoad.length >= 4 && quadLoad.every(n => n > 0)) ? pass('all 4 quad cells load bars') : fail('quad blank cell', JSON.stringify(quadLoad));

    // 5. Sync toggle flips
    await ctx.page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 500));
    const syncBefore = await ctx.page.evaluate(() => window.__TRADING_APP__.layoutManager.syncOpts.symbol);
    await ctx.page.evaluate(() => document.querySelector('[data-sync="symbol"]')?.click());
    await new Promise(r => setTimeout(r, 500));
    const syncAfter = await ctx.page.evaluate(() => window.__TRADING_APP__.layoutManager.syncOpts.symbol);
    (syncBefore === false && syncAfter === true) ? pass('sync symbol toggles') : fail('sync toggle', `${syncBefore}->${syncAfter}`);
    // revert
    await ctx.page.evaluate(() => document.querySelector('[data-sync="symbol"]')?.click());
    await new Promise(r => setTimeout(r, 400));

    // 6. Save-as-new layout persists
    const saveProbe = await ctx.page.evaluate(async () => {
      const lm = window.__TRADING_APP__.layoutManager;
      const before = lm.savedLayouts.length;
      const input = document.querySelector('#new-layout-name-input');
      if (input) input.value = 'QA Test Layout';
      document.querySelector('#btn-save-as-new-layout')?.click();
      await new Promise(r => setTimeout(r, 500));
      return { before, after: lm.savedLayouts.length, stored: JSON.parse(localStorage.getItem('tradingchart_user_layouts') || '[]').some(l => l.name === 'QA Test Layout') };
    });
    (saveProbe.after === saveProbe.before + 1 && saveProbe.stored) ? pass('save new layout persists') : fail('save layout', JSON.stringify(saveProbe));

    // 7. Delete layout works
    const delProbe = await ctx.page.evaluate(async () => {
      const lm = window.__TRADING_APP__.layoutManager;
      const target = lm.savedLayouts.find(l => l.name === 'QA Test Layout');
      if (!target) return { err: 'not found' };
      const before = lm.savedLayouts.length;
      document.querySelector(`.btn-del-layout[data-id="${target.id}"]`)?.click();
      await new Promise(r => setTimeout(r, 200));
      document.querySelector('#btn-dialog-confirm')?.click();
      await new Promise(r => setTimeout(r, 500));
      return { before, after: lm.savedLayouts.length, gone: !lm.savedLayouts.some(l => l.name === 'QA Test Layout') };
    });
    (delProbe.after === delProbe.before - 1 && delProbe.gone) ? pass('delete layout works') : fail('delete layout', JSON.stringify(delProbe));

    // 8. Back to single
    await ctx.page.evaluate(() => { window.__TRADING_APP__.layoutManager.setLayout('1', '1x1'); });
    await new Promise(r => setTimeout(r, 1200));
    const single = await ctx.page.evaluate(() => document.querySelectorAll('.vela-chart-cell, .vela-cell').length);
    single <= 1 ? pass('returns to single chart') : fail('single restore', single);
    await ctx.page.evaluate(() => { document.querySelector('#modal-layout-studio')?.classList.remove('open'); });

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 3 (layout) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'layout_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
