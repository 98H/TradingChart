// Probe: find what widens the page in the plans comparison matrix on mobile.
const fs = require('fs');
const path = require('path');
const { launch, BASE } = require('../qa_lib.cjs');
const KEY = fs.readFileSync(path.resolve(__dirname, '../../server/data/admin_master.key'), 'utf8').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = await launch('mobile');
  const { page } = ctx;
  try {
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tc_admin_lang', 'fa'); } catch (e) {} });
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#gate-key');
    await page.type('#gate-key', KEY);
    await page.click('#gate-submit');
    await page.waitForSelector('.app', { timeout: 15000 });
    await page.evaluate(() => { location.hash = '#/plans'; });
    await sleep(2000);
    await page.click('[data-mode="matrix"]');
    await sleep(1200);
    const out = await page.evaluate(async () => {
      const sw = () => document.documentElement.scrollWidth;
      const res = { base: sw() };
      const tryHide = (sel) => { const els = [...document.querySelectorAll(sel)]; const prev = els.map(e => e.style.display); els.forEach(e => e.style.display = 'none'); const v = sw(); els.forEach((e, i) => e.style.display = prev[i]); return v; };
      for (const sel of ['.toasts', '.bottom-nav', '.mx-wrap', 'table.matrix', '.mx-cat', '.matrix thead', '.matrix tbody', '.page-head', '.alert']) res[sel] = tryHide(sel);
      // sticky off
      const st = document.createElement('style'); st.textContent = '.matrix *{position:static !important}'; document.head.appendChild(st);
      res.noSticky = sw(); st.remove();
      const st2 = document.createElement('style'); st2.textContent = '.mx-cat-label{position:static !important}'; document.head.appendChild(st2);
      res.noCatSticky = sw(); st2.remove();
      const st3 = document.createElement('style'); st3.textContent = '.matrix tbody th[scope=row]{position:static !important}'; document.head.appendChild(st3);
      res.noRowSticky = sw(); st3.remove();
      const st4 = document.createElement('style'); st4.textContent = '.matrix thead th{position:static !important}'; document.head.appendChild(st4);
      res.noHeadSticky = sw(); st4.remove();
      for (const css of ['.mx-wrap{contain:paint}', '.mx-wrap{contain:layout paint}', 'section.card:has(.mx-wrap){overflow:hidden}', 'section.card:has(.mx-wrap){overflow:clip}', '.mx-wrap{max-height:70vh}', '.mx-wrap{overflow:auto;overscroll-behavior:contain;transform:translateZ(0)}']) {
        const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        res[css] = sw(); st.remove();
      }
      // does sticky still work horizontally with contain:paint? scroll the wrap and check the row header stays put
      const stP = document.createElement('style'); stP.textContent = '.mx-wrap{contain:paint}'; document.head.appendChild(stP);
      const w = document.querySelector('.mx-wrap'); const th = document.querySelector('.matrix tbody th[scope=row]');
      const before = th.getBoundingClientRect().right; w.scrollLeft = -200; await new Promise(r => setTimeout(r, 100));
      res.stickyStill = { before, after: th.getBoundingClientRect().right, wsl: w.scrollLeft };
      return res;
    });
    console.log(JSON.stringify(out, null, 1));
  } finally { await ctx.browser.close(); }
})();
