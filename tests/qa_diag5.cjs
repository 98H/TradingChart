// tests/qa_diag5.cjs — persistence key + live leak source mapping
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  const r = await page.evaluate(async () => {
    const app = window.__TRADING_APP__;
    // open settings and hit save to see what it writes
    app.settingsModal?.open?.();
    await new Promise(x => setTimeout(x, 600));
    // switch lang via settings UI if selectable
    const sel = document.querySelector('#set-language, #settings-language, select[id*="lang"]');
    if (sel) { sel.value = 'fa'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    document.querySelector('#btn-settings-save')?.click();
    await new Promise(x => setTimeout(x, 800));
    const keys = Object.keys(localStorage);
    const settings = localStorage.getItem('tradingchart_user_settings');
    return { keys, settings, bodyFa: document.body.classList.contains('persian-mode'), langSelect: !!sel };
  });
  console.log('SETTINGS PERSIST:', JSON.stringify(r, null, 1));

  // now map leak sources for the template panel
  const leak = await page.evaluate(async () => {
    const app = window.__TRADING_APP__;
    const out = [];
    document.querySelectorAll('*').forEach(el => {
      const t = (el.innerText || '').trim();
      if (!t) return;
      if (el.children.length > 0) return;
      if (/^(Curated Algorithmic Setups|Apply Setup to Chart|Save Current Setup|TREND)$/.test(t.replace('✓ ','').replace('+ ',''))) {
        const path = [];
        let p = el;
        while (p && p !== document.body) { path.unshift((p.id || '') + '.' + (p.className || '').toString().split(' ')[0]); p = p.parentElement; }
        out.push({ text: t, path: path.join(' > ').slice(0, 170), rects: el.getClientRects().length, disp: getComputedStyle(el).display });
      }
    });
    return out.slice(0, 8);
  });
  console.log('\nLEAK SOURCES:'); console.log(JSON.stringify(leak, null, 1));
  await ctx.browser.close();
})();