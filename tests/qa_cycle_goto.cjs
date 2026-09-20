// tests/qa_cycle_goto.cjs — Cycle 4b: Go-to-Date navigation
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

    // 1. Alt+G opens the dialog
    await ctx.page.keyboard.down('Alt');
    await ctx.page.keyboard.press('g');
    await ctx.page.keyboard.up('Alt');
    await new Promise(r => setTimeout(r, 500));
    const opened = await ctx.page.evaluate(() => document.querySelector('#goto-date-modal')?.classList.contains('open'));
    opened ? pass('Alt+G opens Go-to-Date') : fail('Alt+G open');
    await ctx.page.screenshot({ path: path.join(EVID, 'goto_01_modal.png') });

    // 2. quick chip sets date
    await ctx.page.evaluate(() => document.querySelector('.gtd-quick[data-off="604800000"]')?.click());
    await new Promise(r => setTimeout(r, 300));
    const inputVal = await ctx.page.evaluate(() => document.querySelector('#gtd-input')?.value);
    inputVal ? pass('quick chip sets date') : fail('quick chip');

    // 3. apply jumps the visible range to ~1 week ago
    const before = await ctx.page.evaluate(() => {
      const vr = window.__TRADING_APP__.chartManager.workspace?.active?.chart?.getVisibleRange?.();
      return vr ? { from: vr.from, to: vr.to } : null;
    });
    await ctx.page.evaluate(() => document.querySelector('#gtd-apply')?.click());
    await new Promise(r => setTimeout(r, 1200));
    const after = await ctx.page.evaluate(() => {
      const vr = window.__TRADING_APP__.chartManager.workspace?.active?.chart?.getVisibleRange?.();
      return vr ? { from: vr.from, to: vr.to } : null;
    });
    console.log('range before:', before && new Date(before.to).toISOString().slice(0, 10), '→ after:', after && new Date(after.to).toISOString().slice(0, 10));
    const jumped = before && after && after.to < before.to - 3 * 86400000;
    jumped ? pass('visible range jumped into history') : fail('range jump', JSON.stringify({ before, after }));

    // 4. context menu exposes Go to Date
    await ctx.page.mouse.click(700, 400, { button: 'right' });
    await new Promise(r => setTimeout(r, 500));
    const hasGoto = await ctx.page.evaluate(() => !!document.querySelector('#ctx-goto-date'));
    hasGoto ? pass('context menu has Go to Date') : fail('ctx goto');
    await ctx.page.keyboard.press('Escape');

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 4b (goto-date) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'goto_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
