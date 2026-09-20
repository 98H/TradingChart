// tests/qa_cycle_dtl.cjs — Cycle 1 verification: Drawing Tools Library
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  for (const vp of ['desktop', 'mobile']) {
    const ctx = await launch(vp);
    try {
      await boot(ctx, { settle: 4500 });

      // 1. Library opens from floating toolbar grid button (desktop) or app API (mobile — toolbar hidden by design)
      if (vp === 'mobile') {
        await ctx.page.evaluate(() => window.__TRADING_APP__?.drawingToolsLibrary?.open());
      } else {
        await ctx.page.click('#fav-btn-all-tools');
      }
      await new Promise(r => setTimeout(r, 700));
      const open1 = await ctx.page.evaluate(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      open1 ? pass(`${vp} library opens`) : fail(`${vp} library opens`);
      await ctx.page.screenshot({ path: path.join(EVID, `dtl_${vp}_01_open.png`) });

      // 2. Tool count = all supported types
      const count = await ctx.page.evaluate(() => document.querySelectorAll('#drawing-tools-modal [data-dtool]').length);
      console.log(`${vp} tools rendered:`, count);
      count >= 60 ? pass(`${vp} >=60 tools`) : fail(`${vp} tool count`, count);

      // 3. Search filters
      await ctx.page.type('#dtl-search', 'fib');
      await new Promise(r => setTimeout(r, 400));
      const fibCount = await ctx.page.evaluate(() => document.querySelectorAll('#drawing-tools-modal [data-dtool]').length);
      (fibCount >= 8 && fibCount < count) ? pass(`${vp} search filters (${fibCount} fib tools)`) : fail(`${vp} search`, fibCount);
      await ctx.page.evaluate(() => { document.querySelector('#dtl-search').value = ''; });
      await ctx.page.type('#dtl-search', ' ');
      await new Promise(r => setTimeout(r, 200));
      await ctx.page.evaluate(() => { const i = document.querySelector('#dtl-search'); i.value = ''; i.dispatchEvent(new Event('input')); });
      await new Promise(r => setTimeout(r, 300));

      // 4. Selecting a tool arms the engine and closes modal
      await ctx.page.evaluate(() => document.querySelector('[data-dtool="pitchfork"]')?.click());
      await new Promise(r => setTimeout(r, 500));
      const armed = await ctx.page.evaluate(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        return { tool: d?.getTool?.(), modalOpen: document.querySelector('#drawing-tools-modal')?.classList.contains('open') };
      });
      (armed.tool === 'pitchfork' && !armed.modalOpen) ? pass(`${vp} tool arms engine + modal closes`) : fail(`${vp} arm`, JSON.stringify(armed));

      // 5. Star toggling adds to floating toolbar
      if (vp === 'mobile') {
        await ctx.page.evaluate(() => window.__TRADING_APP__?.drawingToolsLibrary?.open());
      } else {
        await ctx.page.click('#fav-btn-all-tools');
      }
      await new Promise(r => setTimeout(r, 500));
      await ctx.page.evaluate(() => document.querySelector('[data-star="gannbox"]')?.click());
      await new Promise(r => setTimeout(r, 400));
      const inToolbar = await ctx.page.evaluate(() => !!document.querySelector('#floating-drawing-toolbar [data-tool="gannbox"]'));
      inToolbar ? pass(`${vp} star pins tool to floating toolbar`) : fail(`${vp} star pin`);
      // unstar to restore defaults
      await ctx.page.evaluate(() => document.querySelector('[data-star="gannbox"]')?.click());
      await ctx.page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));

      // 6. No horizontal overflow
      const overflow = await ctx.page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      !overflow ? pass(`${vp} no page h-overflow`) : fail(`${vp} h-overflow`);

      const errs = errorsOf(ctx);
      errs.length ? fail(`${vp} console errors`, JSON.stringify(errs.slice(0, 3))) : pass(`${vp} clean console`);

      await ctx.page.screenshot({ path: path.join(EVID, `dtl_${vp}_02_final.png`) });
    } catch (e) {
      fail(`${vp} exception`, e.message);
    } finally {
      await ctx.browser.close();
    }
  }

  // 7. RTL / Persian mode check
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { lang: 'fa', settle: 4500 });
    await ctx.page.click('#fav-btn-all-tools');
    await new Promise(r => setTimeout(r, 700));
    const faCheck = await ctx.page.evaluate(() => {
      const box = document.querySelector('.dtl-box');
      const label = document.querySelector('#drawing-tools-modal [data-dtool="pitchfork"] .dtl-label');
      return { dir: box?.getAttribute('dir'), label: label?.innerText };
    });
    (faCheck.dir === 'rtl' && /چنگال/.test(faCheck.label || '')) ? pass('fa RTL + translated labels') : fail('fa mode', JSON.stringify(faCheck));
    await ctx.page.screenshot({ path: path.join(EVID, 'dtl_fa_01_open.png') });
    const errs = errorsOf(ctx);
    errs.length ? fail('fa console errors', JSON.stringify(errs.slice(0, 3))) : pass('fa clean console');
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE DTL RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'dtl_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
