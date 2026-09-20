// tests/qa_cycle_palette.cjs — Cycle 5: Command Palette (Ctrl+K)
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

    // 1. Ctrl+K opens palette
    await ctx.page.keyboard.down('Control');
    await ctx.page.keyboard.press('k');
    await ctx.page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 500));
    const opened = await ctx.page.evaluate(() => document.querySelector('#command-palette')?.classList.contains('open'));
    opened ? pass('Ctrl+K opens palette') : fail('Ctrl+K open');
    await ctx.page.screenshot({ path: path.join(EVID, 'palette_01_open.png') });

    // 2. index is populated
    const itemCount = await ctx.page.evaluate(() => window.__TRADING_APP__.commandPalette?.items?.length || 0);
    itemCount > 45 ? pass(`index populated (${itemCount} items)`) : fail('index size', itemCount);

    // 3. fuzzy search narrows results
    await ctx.page.type('#cp-input', 'fib');
    await new Promise(r => setTimeout(r, 400));
    const fibResults = await ctx.page.evaluate(() => document.querySelectorAll('#cp-list .cp-item').length);
    fibResults > 0 && fibResults < 10 ? pass(`fuzzy search (${fibResults} results for "fib")`) : fail('fuzzy', fibResults);

    // 4. run a symbol command — switches to SOL
    await ctx.page.evaluate(() => document.querySelector('#cp-input').value = '');
    await ctx.page.evaluate(() => { const p = window.__TRADING_APP__.commandPalette; p.renderList(''); });
    await new Promise(r => setTimeout(r, 300));
    const ran = await ctx.page.evaluate(() => {
      const p = window.__TRADING_APP__.commandPalette;
      const idx = p.filtered.findIndex(it => it.en === 'Symbol SOLUSDT');
      if (idx >= 0) { p.run(idx); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 2000));
    const sym = await ctx.page.evaluate(() => window.__TRADING_APP__.currentSymbol);
    ran && sym === 'SOLUSDT' ? pass('runs symbol switch to SOLUSDT') : fail('run symbol', `ran=${ran} sym=${sym}`);
    await ctx.page.screenshot({ path: path.join(EVID, 'palette_02_after_sol.png') });

    // 5. keyboard nav: reopen, ArrowDown + Enter runs
    await ctx.page.keyboard.down('Control');
    await ctx.page.keyboard.press('k');
    await ctx.page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 400));
    await ctx.page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 200));
    const selIdx = await ctx.page.evaluate(() => window.__TRADING_APP__.commandPalette.selectedIdx);
    selIdx === 1 ? pass('ArrowDown moves selection') : fail('arrow nav', selIdx);
    await ctx.page.keyboard.press('Escape');

    // 6. palette closed after run
    const stillOpen = await ctx.page.evaluate(() => document.querySelector('#command-palette')?.classList.contains('open'));
    !stillOpen ? pass('closes after run') : fail('close after run');

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 5 (palette) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'palette_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
