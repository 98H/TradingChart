// tests/qa_i18n_probe.cjs — full visible untranslated list while fa (all panels opened)
const { launch, boot } = require('./qa_lib.cjs');
const H = require('./qa_lib.cjs').INPAGE;
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 1200));
  // open each bottom view to render its content, collect leaks
  const views = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')).filter(Boolean));
  const all = {};
  for (const v of views) {
    await page.evaluate((x) => document.querySelector(`.panel-tab[data-view="${x}"]`)?.click(), v);
    await new Promise(r => setTimeout(r, 1400));
    const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
    all[v] = unt;
  }
  // also open panels menu, indicators, symbol search
  for (const [name, expr] of [['panelsMenu', "document.querySelector('#nav-btn-panels').click()"],
                              ['indicators', "window.__TRADING_APP__.openIndicatorsModal()"],
                              ['symbolSearch', "window.__TRADING_APP__.openSymbolSearch()"]]) {
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
    await page.evaluate((e) => eval(e), expr);
    await new Promise(r => setTimeout(r, 900));
    const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
    all[name] = unt;
  }
  for (const [k, v] of Object.entries(all)) {
    console.log(`\n### ${k} (${v.length})`);
    v.forEach(u => console.log('   ', JSON.stringify(u)));
  }
  await ctx.browser.close();
})();