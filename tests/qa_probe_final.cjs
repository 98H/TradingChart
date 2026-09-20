// qa_probe_final.cjs — investigate: 45m in tf menu, compare modal overlap,
// FA roundtrip leak (2 nodes), congress names, Nikkei Asia
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);

  // 1. 45m timeframe: list the dropdown contents
  await ctx.page.evaluate(() => document.querySelector('.vela-widget-tf-caret')?.click());
  await settle(600);
  const tfMenu = await ctx.page.evaluate(() => {
    const items = [...document.querySelectorAll('.vela-mb-item')].filter(e => e.offsetParent !== null);
    return items.map(e => (e.innerText || '').trim()).slice(0, 20);
  });
  console.log('TF menu items:', JSON.stringify(tfMenu));
  await ctx.page.keyboard.press('Escape');

  // 2. FA switch, open compare modal, check overlap pair
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
  await settle(1400);
  await ctx.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => (e.innerText||'').includes('مقایسه'));
    if (b) b.click();
  });
  await settle(900);
  const cmp = await ctx.page.evaluate(() => {
    const els = [...document.querySelectorAll('.panel-tab, .rail-btn, header button, .modal-box button')].filter(el => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4;
    });
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) {
        const inter = ox * oy;
        if (inter / Math.min(a.width * a.height, b.width * b.height) > 0.35) {
          bad.push({ a: (els[i].innerText||els[i].className).toString().slice(0,30), b: (els[j].innerText||els[j].className).toString().slice(0,30),
            aRect: [Math.round(a.x), Math.round(a.y), Math.round(a.width), Math.round(a.height)],
            bRect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] });
        }
      }
    }
    return bad.slice(0, 5);
  });
  console.log('compare overlap:', JSON.stringify(cmp, null, 1));
  await ctx.page.screenshot({ path: 'screenshots/qa_cycles/probe_compare_fa.png' });
  await ctx.page.keyboard.press('Escape');
  await settle(400);

  // 3. roundtrip leak: switch EN and find the 2 FA nodes
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('en'));
  await settle(1200);
  const leak = await ctx.page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || el.getClientRects().length === 0) continue;
      if (/[؀-ۿ]/.test(n.textContent)) {
        out.push({ txt: n.textContent.trim().slice(0, 50), host: el.tagName + '.' + (el.className || '').toString().slice(0, 40) + '#' + (el.id || ''), visible: el.offsetParent !== null });
      }
    }
    return out.slice(0, 10);
  });
  console.log('FA leak in EN mode:', JSON.stringify(leak, null, 1));

  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
