// tests/qa_diag6.cjs — why does the Vela data-window skip auto-localization?
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('mobile');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 2000));
  const info = await page.evaluate(() => {
    const el = document.querySelector('.vela-dw-label');
    const grp = document.querySelector('.vela-dw-group');
    const details = (n) => n ? {
      tag: n.tagName, cls: n.className,
      text: n.textContent,
      marked: n.hasAttribute('data-i18n-done') || n.dataset.i18nDone || null,
      dataset: JSON.stringify(n.dataset),
      inObserverRoot: !!document.querySelector('body').contains(n),
      closestHidden: !!n.closest('[aria-hidden="true"]'),
      style: getComputedStyle(n).visibility + '/' + getComputedStyle(n).display
    } : null;
    return {
      label: details(el),
      group: details(grp),
      dwCount: document.querySelectorAll('.vela-dw-label').length,
      // what does the engine's own translate say?
      engineSelfTest: (typeof window.__TC_TRANSLATE__ === 'function') ? window.__TC_TRANSLATE__('Open') : 'no-global',
      bodyClass: document.body.className,
      htmlLang: document.documentElement.lang
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await ctx.browser.close();
})();