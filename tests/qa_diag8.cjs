// tests/qa_diag8.cjs — why are .vela-dw-label nodes skipped by auto-localization?
const { launch, boot } = require('./qa_lib.cjs');
const SKIP = 'script,style,svg,.num-ltr,#pine-code-editor,.code-editor,pre,code,[data-no-i18n],[class*="price-badge"],[class*="axis-badge"]';
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 3000));
  const out = await page.evaluate((SKIP) => {
    const res = [];
    document.querySelectorAll('.vela-dw-label').forEach(el => {
      const tn = Array.from(el.childNodes).filter(n => n.nodeType === 3);
      res.push({
        text: el.textContent.trim(),
        ownTextNodes: tn.map(n => JSON.stringify(n.nodeValue)),
        childEls: Array.from(el.children).map(c => c.tagName + '.' + c.className),
        skippedBy: el.closest(SKIP) ? (el.closest(SKIP).tagName + '.' + el.closest(SKIP).className) : null,
        parentChain: (() => { const c = []; let p = el.parentElement; while (p && c.length < 6) { c.push(p.tagName + '[' + Array.from(p.attributes).map(a => a.name + '=' + a.value.slice(0, 25)).join(' ') + ']'); p = p.parentElement; } return c; })()
      });
    });
    return res;
  }, SKIP);
  console.log(JSON.stringify(out.slice(0, 3), null, 2));
  await ctx.browser.close();
})();