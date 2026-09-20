// qa_probe_modal_layer.cjs — screenshot + z-index check of compare modal vs bottom panel
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
  await settle(1400);
  await ctx.page.evaluate(() => {
    for (const el of document.querySelectorAll('button')) {
      if ((el.innerText || '').trim() === 'مقایسه') { el.click(); return; }
    }
  });
  await settle(1100);
  const layer = await ctx.page.evaluate(() => {
    const modal = document.querySelector('#modal-compare');
    const footer = document.querySelector('footer');
    const mr = modal ? modal.getBoundingClientRect() : null;
    const fr = footer ? footer.getBoundingClientRect() : null;
    // elementFromPoint at the overlap point (468+60, 878+10)
    const hit = document.elementFromPoint(530, 888);
    return {
      modal: mr ? { z: getComputedStyle(modal).zIndex, disp: getComputedStyle(modal).display, rect: [mr.x, mr.y, mr.width, mr.height] } : null,
      footer: fr ? { z: getComputedStyle(footer).zIndex, disp: getComputedStyle(footer).display, rect: [fr.x, fr.y, fr.width, fr.height] } : null,
      hitAtOverlap: hit ? hit.tagName + '.' + (hit.className || '').toString().slice(0, 40) + ' text=' + (hit.innerText || '').slice(0, 20) : null,
    };
  });
  console.log(JSON.stringify(layer, null, 1));
  await ctx.page.screenshot({ path: 'screenshots/qa_cycles/probe_modal_layer.png' });
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
