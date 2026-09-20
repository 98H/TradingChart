// qa_probe_labels.cjs — targeted evidence: which labels are genuinely untranslated in FA mode
const { launch, boot } = require('./qa_lib.cjs');

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  await ctx.page.evaluate(() => { window.__TRADING_APP__?.switchLanguage('fa'); });
  await new Promise(r => setTimeout(r, 2000));
  const res = await ctx.page.evaluate(() => {
    const grab = (sel) => { const el = document.querySelector(sel); return el ? el.innerText.trim() : null; };
    return {
      navQuant: grab('#nav-label-quant'),
      navJournal: grab('#nav-label-journal'),
      navPanels: grab('#nav-label-panels'),
      compare: grab('#topbar-compare-label'),
      exportL: grab('#topbar-export-label'),
      replay: grab('#topbar-replay-label'),
      layoutSave: grab('#layout-save-label'),
      activeLayout: grab('#active-layout-name'),
      chartStyle: grab('#topbar-chart-style-label'),
      qtTrade: grab('#qt-pill-label'),
      tzLabel: grab('#scale-tz-label'),
      journalKPI: (() => { const el = document.querySelector('#view-journal, #journal-workspace-view'); return el ? el.innerText.slice(0, 200) : null; })(),
    };
  });
  console.log(JSON.stringify(res, null, 1));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
