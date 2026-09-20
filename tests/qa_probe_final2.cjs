// qa_probe_final2.cjs — deeper: TF menu DOM, 872px y-overlap identity, tracked FA leak
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);

  // 1. TF caret: what opens, where do items live?
  await ctx.page.evaluate(() => document.querySelector('.vela-widget-tf-caret')?.click());
  await settle(700);
  const tfInfo = await ctx.page.evaluate(() => {
    const pop = [...document.querySelectorAll('[class*="dropdown"], [class*="popup"], [class*="menu"], [role="menu"], [role="listbox"]')].filter(e => e.offsetParent !== null);
    const out = pop.map(p => ({ cls: (p.className || '').toString().slice(0, 50), items: [...p.querySelectorAll('*')].map(x => (x.innerText || '').trim()).filter(t => /^(1m|3m|5m|15m|30m|45m|1h|2h|4h|1D|1W|1M)$/.test(t)).slice(0, 15) }));
    // fallback: any element with exact tf text now visible
    const anyVisible = ['1m','5m','15m','30m','45m','1h','4h','1D','1W'].filter(tf =>
      [...document.querySelectorAll('*')].some(e => e.children.length === 0 && (e.innerText||'').trim() === tf && e.offsetParent !== null));
    return { popups: out, anyVisible };
  });
  console.log('TF info:', JSON.stringify(tfInfo, null, 1));
  await ctx.page.keyboard.press('Escape');
  await settle(400);

  // 2. What's at y≈861-894 in FA (the flagged overlap)?
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
  await settle(1400);
  const zone = await ctx.page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.top >= 855 && r.top <= 900 && r.height > 10 && r.height < 60 && el.children.length <= 3;
    });
    return els.map(el => ({
      tag: el.tagName, cls: (el.className || '').toString().slice(0, 45),
      rect: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })(),
      txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 35)
    })).slice(0, 20);
  });
  console.log('y≈860-900 zone FA:', JSON.stringify(zone, null, 1));
  await ctx.page.screenshot({ path: 'screenshots/qa_cycles/probe_bottombar_fa.png' });

  // 3. FA roundtrip leak — add a MutationObserver to see which surface re-adds FA text after EN switch
  await ctx.page.evaluate(() => {
    window.__faLeakLog = [];
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.TEXT_NODE && /[؀-ۿ]/.test(n.textContent)) {
            window.__faLeakLog.push({ txt: n.textContent.trim().slice(0, 40), parent: n.parentElement ? n.parentElement.tagName + '.' + (n.parentElement.className || '').toString().slice(0, 40) : '?' });
          } else if (n.nodeType === Node.ELEMENT_NODE && /[؀-ۿ]/.test(n.innerText || '')) {
            window.__faLeakLog.push({ txt: (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), parent: n.tagName + '.' + (n.className || '').toString().slice(0, 40) });
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('en'));
  await settle(1500);
  await settle(3000); // let any tickers/timers fire
  const leakLog = await ctx.page.evaluate(() => window.__faLeakLog.slice(0, 10));
  const leakNow = await ctx.page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || el.getClientRects().length === 0) continue;
      if (/[؀-ۿ]/.test(n.textContent)) out.push({ txt: n.textContent.trim().slice(0, 50), host: el.tagName + '.' + (el.className || '').toString().slice(0, 40) + '#' + (el.id || '') });
    }
    return out.slice(0, 10);
  });
  console.log('FA added AFTER EN switch:', JSON.stringify(leakLog, null, 1));
  console.log('FA still present:', JSON.stringify(leakNow, null, 1));

  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
