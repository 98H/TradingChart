// tests/qa_diag11.cjs — discover the Vela workspace object graph to find the DW panel
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2000));
  const out = await page.evaluate(() => {
    const w = window.app?.chartManager?.workspace?.active;
    if (!w) return { err: 'no workspace' };
    const keys = Object.keys(w);
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(w));
    // look for anything holding panels / dock / entries
    const candidates = {};
    for (const k of keys) {
      const v = w[k];
      if (v && typeof v === 'object') {
        candidates[k] = {
          ctor: v.constructor?.name,
          ownKeys: Object.keys(v).slice(0, 14),
          hasEntries: Array.isArray(v.entries),
          entryIds: Array.isArray(v.entries) ? v.entries.map(e => e?.id || e?.panelId || e?.entry?.id) : undefined,
          hasPanels: !!v.panels,
        };
      }
    }
    return { keys, proto: proto.slice(0, 30), candidates };
  });
  console.log(JSON.stringify(out, null, 2).slice(0, 4000));
  await ctx.browser.close();
})();