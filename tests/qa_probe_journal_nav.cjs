// qa_probe_journal_nav.cjs — does the Journal nav pill actually show the journal?
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  // click journal nav
  await ctx.page.evaluate(() => document.querySelector('#nav-btn-journal')?.click());
  await settle(1500);
  const res = await ctx.page.evaluate(() => {
    const views = ['#view-quant', '#view-journal', '#journal-workspace-view'];
    const out = {};
    for (const v of views) {
      const el = document.querySelector(v);
      out[v] = el ? { display: getComputedStyle(el).display, visible: el.offsetParent !== null, h: el.getBoundingClientRect().height } : null;
    }
    // active nav pill?
    out.activePill = document.querySelector('.nav-pill.active')?.dataset.view || null;
    // any visible view with journal content?
    out.journalVisible = [...document.querySelectorAll('[id*="journal"]')].filter(e => e.offsetParent !== null).map(e => e.id);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
