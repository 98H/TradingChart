// tests/qa_diag12.cjs — inspect the dataWindowReadout shape and locate the renderer
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await new Promise(r => setTimeout(r, 2500));
  const out = await page.evaluate(() => {
    const w = window.app?.chartManager?.workspace?.active;
    const ch = w?.chart || w?.orchestrator?.chart;
    const r = ch?.renderer || w?.orchestrator?.renderer;
    if (!r) return { err: 'no renderer', hasChart: !!ch, keys: w ? Object.keys(w).slice(0, 8) : null };
    const ro = r.dataWindowReadout?.();
    return { rendererName: r.name, ctor: r.constructor?.name, readout: ro, sample: ro ? JSON.parse(JSON.stringify(ro)).slice?.(0, 3) : null, shape: ro ? Object.keys(ro) : null };
  });
  console.log(JSON.stringify(out, null, 2).slice(0, 3500));
  await ctx.browser.close();
})();