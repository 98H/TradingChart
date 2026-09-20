// tests/qa_diag9.cjs — probes: shadow/iframe containment + forced mutation re-run
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 3000));

  const probe = await page.evaluate(async () => {
    const el = document.querySelector('.vela-dw-label');
    const info = {
      iframes: document.querySelectorAll('iframe').length,
      rootNodeOfLabel: (() => { const r = el.getRootNode(); return r === document ? 'document' : (r.host ? 'shadow:' + r.host.tagName : 'other'); })(),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      bodyHasLabel: document.body.contains(el),
      labelCount: document.querySelectorAll('.vela-dw-label').length
    };
    // Force a DOM mutation so the MutationObserver must fire
    const junk = document.createElement('div');
    junk.id = 'qa-force-mutation';
    document.body.appendChild(junk);
    await new Promise(r => setTimeout(r, 1500));
    info.afterMutation = Array.from(document.querySelectorAll('.vela-dw-label')).map(e => e.textContent.trim()).slice(0, 6);
    // Count how many text nodes under the dw panel still hold latin labels
    const panel = document.querySelector('.vela-panel.vela-dw');
    info.panelHTMLsample = panel ? panel.innerHTML.slice(0, 400) : null;
    return info;
  });
  console.log(JSON.stringify(probe, null, 2));
  await ctx.browser.close();
})();