// tests/qa_diag10.cjs — drive autoLocalizeUI directly and observe the result
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 2000));
  const out = await page.evaluate(async () => {
    const before = Array.from(document.querySelectorAll('.vela-dw-label')).map(e => e.textContent.trim());
    const r1 = window.__TC_AUTO_LOCALIZE__();
    await new Promise(r => setTimeout(r, 500));
    const after = Array.from(document.querySelectorAll('.vela-dw-label')).map(e => e.textContent.trim());
    // does the dictionary contain these keys?
    const dictHas = {};
    for (const k of ['Open', 'High', 'Low', 'Close', 'Volume', 'Date', 'Time', 'Price']) {
      dictHas[k] = (typeof window.__TC_DICT__ === 'object' && window.__TC_DICT__) ? window.__TC_DICT__[k] : 'no-global';
    }
    return { autoReturned: r1, before, after, dictHas, localizedSpans: document.querySelectorAll('span.vela-localized').length };
  });
  console.log(JSON.stringify(out, null, 2));
  await ctx.browser.close();
})();