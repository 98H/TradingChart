// Round-1 recon: screenshots + surface inventory + static audits (desktop/mobile × en/fa)
const { launch, auditStatic, EVID } = require('./qa_lib.cjs');
const fs = require('fs'); const path = require('path');
const OUT = path.join(EVID, 'r1'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const report = {};
  for (const vp of ['desktop', 'mobile']) {
    const ctx = await launch(vp);
    const { page } = ctx;
    await page.goto((process.env.SDD_BASE_URL||'http://127.0.0.1:8088')+'/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__TRADING_APP__ && !!document.querySelector('canvas'), { timeout: 30000 }).catch(() => {});
    await sleep(5000);
    for (const lang of ['en', 'fa']) {
      await page.evaluate(l => window.__TRADING_APP__.switchLanguage(l), lang);
      await sleep(1500);
      ctx.logs.length = 0;
      await page.screenshot({ path: path.join(OUT, `${vp}_${lang}_home.png`) });
      const st = await auditStatic(ctx);
      const inv = await page.evaluate(() => {
        const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
        return Array.from(document.querySelectorAll('button,[role=button],a')).filter(vis).map(b => (b.id || b.className.toString().slice(0, 30)) + ' :: ' + (b.innerText || b.title || b.getAttribute('aria-label') || '').trim().slice(0, 30));
      });
      report[`${vp}_${lang}`] = { st, inv, logs: ctx.logs.slice(0, 10) };
    }
    await ctx.browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'recon.json'), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) {
    console.log('==', k, 'overflow', v.st.horizontalOverflow.length, 'clip', v.st.innerClip.length, 'small', v.st.smallTargets.length, 'overlaps', v.st.overlaps.length, 'bodyW', v.st.bodyScrollW, v.st.clientW, 'buttons', v.inv.length, 'logs', v.logs.length);
    console.log('  clip:', JSON.stringify(v.st.innerClip.slice(0, 5)));
    console.log('  small:', JSON.stringify(v.st.smallTargets.slice(0, 8)));
    console.log('  overlaps:', JSON.stringify(v.st.overlaps.slice(0, 5)));
    console.log('  logs:', JSON.stringify(v.logs.slice(0, 4)));
  }
  process.exit(0);
})();
