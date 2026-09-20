// qa_probe_lang_toggle.cjs — click the real FA / EN button, then inspect state
const { launch, boot } = require('./qa_lib.cjs');

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  const before = await ctx.page.evaluate(() => ({
    lang: document.documentElement.lang, bodyCls: document.body.className,
    navQuant: document.querySelector('#nav-label-quant')?.innerText,
  }));
  // find the toggle button
  const btn = await ctx.page.evaluate(() => {
    const els = [...document.querySelectorAll('button')];
    const b = els.find(e => /FA|EN|فا/i.test((e.innerText || '').trim()) && (e.innerText || '').trim().length < 12);
    if (b) { b.click(); return b.innerText.trim(); }
    return null;
  });
  await new Promise(r => setTimeout(r, 1800));
  const after = await ctx.page.evaluate(() => ({
    lang: document.documentElement.lang, bodyCls: document.body.className,
    navQuant: document.querySelector('#nav-label-quant')?.innerText,
    appLang: (window.__TRADING_APP__ && window.__TRADING_APP__.currentLanguage) || null,
    getLang: window.__TC_AUTO_LOCALIZE__ ? 'engine-present' : 'missing',
  }));
  console.log(JSON.stringify({ clicked: btn, before, after }, null, 1));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
