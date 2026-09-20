// qa_probe_fa_persist.cjs — after switching to FA, click the FA/EN toggle
// (which switches to EN) then back to FA, and inspect what stays untranslated.
// Also inspect what the journal view shows when OPENED while FA is active.
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  const clickLang = async () => ctx.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => /FA|EN/.test((e.innerText||'').trim()) && (e.innerText||'').trim().length < 12);
    if (b) { b.click(); return true; } return false;
  });
  const grab = () => ctx.page.evaluate(() => ({
    lang: document.documentElement.lang,
    navQuant: document.querySelector('#nav-label-quant')?.innerText,
    navPanels: document.querySelector('#nav-label-panels')?.innerText,
    compare: document.querySelector('#topbar-compare-label')?.innerText,
    qtPill: document.querySelector('#qt-pill-label')?.innerText,
    scaleBtns: [...document.querySelectorAll('.scale-dock-btn span')].map(s => s.innerText).slice(0, 5),
    slMeta: document.querySelector('.vela-sl-meta')?.innerText,
  }));
  console.log('EN0   :', JSON.stringify(await grab()));
  await clickLang(); await settle(1500);
  console.log('FA1   :', JSON.stringify(await grab()));
  await clickLang(); await settle(1500);
  console.log('EN1   :', JSON.stringify(await grab()));
  await clickLang(); await settle(1500);
  console.log('FA2   :', JSON.stringify(await grab()));
  // open journal view while FA
  await ctx.page.evaluate(() => document.querySelector('#nav-btn-journal')?.click());
  await settle(1200);
  const journal = await ctx.page.evaluate(() => {
    const v = document.querySelector('#view-journal');
    if (!v) return 'no-view';
    const txt = v.innerText.replace(/\s+/g, ' ');
    return { fa: /[؀-ۿ]/.test(txt), sample: txt.slice(0, 120), visible: v.offsetParent !== null, display: getComputedStyle(v).display };
  });
  console.log('JOURNAL:', JSON.stringify(journal));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
