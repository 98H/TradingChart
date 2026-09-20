// tests/qa_symsearch.cjs — verify symbol search filtering works (real click path)
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  const res = await page.evaluate(async () => {
    const app = window.__TRADING_APP__;
    const modal = document.querySelector('#modal-symbol-search');
    const input = document.querySelector('#symbol-search-input');
    // real path: open then type
    app.openSymbolSearch();
    await new Promise(r => setTimeout(r, 700));
    const initial = document.querySelectorAll('.sym-search-row').length;
    input.value = 'SOL';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    const rows = Array.from(document.querySelectorAll('.sym-search-row')).map(r => r.getAttribute('data-symbol'));
    const badge = document.querySelector('#sym-count-badge')?.innerText;
    return { initial, filtered: rows, badge, apiDirect: await (await fetch('/api/symbols?q=SOL&category=all')).json() };
  });
  console.log(JSON.stringify(res, null, 1));
  await ctx.browser.close();
})();