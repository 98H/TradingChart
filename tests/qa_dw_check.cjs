// tests/qa_dw_check.cjs — verify data-window localization + lossless EN restore
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2200));
  const read = () => page.evaluate(() => ({
    labels: Array.from(document.querySelectorAll('.vela-dw-label, .vela-dw-group')).map(e => e.textContent.trim())
  }));
  const en1 = await read();
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 2500));
  const fa = await read();
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
  await new Promise(r => setTimeout(r, 2500));
  const en2 = await read();
  const faBad = fa.labels.filter(t => /^(Date|Time|Open|High|Low|Close|Volume|Price)$/.test(t));
  const enBad = en2.labels.filter(t => /[\u0600-\u06FF]/.test(t));
  console.log('EN(initial):', JSON.stringify(en1.labels));
  console.log('FA         :', JSON.stringify(fa.labels));
  console.log('EN(restored):', JSON.stringify(en2.labels));
  console.log('FA leaks (must be 0):', faBad.length, faBad);
  console.log('EN regression (must be 0):', enBad.length, enBad);
  await ctx.browser.close();
})();