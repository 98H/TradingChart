// tests/probes/admin_explore.cjs — exploratory real-browser walk of the back-office
// console. Captures screenshots + machine checks (console errors, horizontal
// overflow, clipped text, untranslated strings) for every section × viewport × lang.
// Usage: node tests/probes/admin_explore.cjs [desktop|mobile] [fa|en] [tag]
const fs = require('fs');
const path = require('path');
const { launch, BASE, EVID } = require('../qa_lib.cjs');

const VP = process.argv[2] || 'desktop';
const LANG = process.argv[3] || 'fa';
const TAG = process.argv[4] || 'c1';
const KEY = fs.readFileSync(path.resolve(__dirname, '../../server/data/admin_master.key'), 'utf8').trim();
const OUT = path.join(EVID, 'admin');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CHECKS = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { hOverflow: document.documentElement.scrollWidth - vw, offenders: [], clipped: [], latin: [], tiny: [] };
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    // clipped by a scroll container is fine
    let clipAnc = el.parentElement, clipped = false;
    while (clipAnc && clipAnc !== document.body) { const s = getComputedStyle(clipAnc); if (/(auto|scroll|hidden)/.test(s.overflowX)) { clipped = true; break; } clipAnc = clipAnc.parentElement; }
    if (!clipped && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') out.offenders.push((el.className && String(el.className).slice(0, 40)) || el.tagName);
    // text truncated without ellipsis
    // (.sr-only = intentionally 1px visually-hidden screen-reader text, not a clip defect)
    if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2 && !el.closest('.sr-only') && !(getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().width <= 1)) {
      const s = getComputedStyle(el);
      if (s.textOverflow !== 'ellipsis' && /(hidden|clip)/.test(s.overflowX)) out.clipped.push(el.textContent.trim().slice(0, 40));
    }
    // interactive targets below the 44×44 touch minimum on mobile (WCAG 2.5.5 / Apple HIG)
    if (${VP === 'mobile'} && el.matches('button, a, input[type=checkbox], select, [role=tab], label.check-hit, .chip') && !el.closest('.swatches')) {
      // real hit area of an input = its own box ∪ the <label> that forwards clicks to it
      let hr = el.getBoundingClientRect();
      if (el.matches('input')) {
        const lab = el.closest('label');
        if (lab) { const lr = lab.getBoundingClientRect(); hr = { width: Math.max(hr.width, lr.width), height: Math.max(hr.height, lr.height) }; }
      }
      if (hr.width < 43.5 || hr.height < 43.5) out.tiny.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30) + ' ' + Math.round(hr.width) + 'x' + Math.round(hr.height));
    }
  }
  if (document.documentElement.lang === 'fa') {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; const allow = /^(TradingChart|CSV|IP|USD|UTC|Node|MB|KB|2FA|PRO|FREE|\\$|ID|@|[\\d.,:/\\-+%()\\s·$—–]+)$/;
    // Persian copy may legitimately carry standard technical acronyms (CSV, RSI, POC, DOM, SEC, 13F, XLSX…)
    const acr = /^(CSV|JSON|XLSX|RSI|POC|DOM|SEC|13F|P&F|IP|USD|UTC|2FA|ID|Node)$/;
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim();
      if (!t || !/[A-Za-z]{3,}/.test(t)) continue;
      const p = n.parentElement;
      if (!p || !vis(p) || p.closest('.ltr, .mono, [dir=ltr], [dir=auto], code, script, style, option, textarea, input, .user-meta span, .dim.ltr')) continue;
      // bidi-isolated user data inside UI copy (\u2068@user\u2069) is data, not an untranslated string
      if (/^[^A-Za-z]*(\u2068[^\u2069]*\u2069[^A-Za-z]*)+$/.test(t)) continue;
      if (allow.test(t)) continue;
      const words = t.match(/[A-Za-z][A-Za-z0-9&]*/g) || [];
      if (words.length && words.every(w => acr.test(w) || w.length < 3)) continue;
      // the language toggle shows the OTHER language's endonym by design
      if (t === 'English' && p.closest('[data-act=lang], #gate-lang, .lang-btn')) continue;
      out.latin.push(t.slice(0, 50));
    }
  }
  out.offenders = [...new Set(out.offenders)].slice(0, 12);
  out.clipped = [...new Set(out.clipped)].slice(0, 12);
  out.latin = [...new Set(out.latin)].slice(0, 25);
  out.tiny = [...new Set(out.tiny)].slice(0, 15);
  return out;
})()`;

(async () => {
  const ctx = await launch(VP);
  const { page, logs } = ctx;
  const report = { vp: VP, lang: LANG, sections: {} };
  const errs = () => logs.filter(l => l.type === 'error' || l.type === 'pageerror' || l.type === 'requestfailed').map(l => l.text.slice(0, 160));
  const shot = async (name, full = false) => page.screenshot({ path: path.join(OUT, `${TAG}_${VP}_${LANG}_${name}.png`), fullPage: full });
  try {
    await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('tc_admin_lang', l); } catch (e) {} }, LANG);
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#gate-key', { timeout: 15000 });
    await sleep(400);
    report.sections.gate = { checks: await page.evaluate(CHECKS), errors: errs() };
    await shot('00_gate');
    // wrong key
    await page.type('#gate-key', 'wrong-key-123');
    await page.click('#gate-submit');
    await page.waitForFunction(() => !document.querySelector('#gate-err')?.hidden, { timeout: 8000 });
    report.sections.gateWrong = { msg: await page.$eval('#gate-err', e => e.textContent.trim()) };
    await shot('01_gate_wrong');
    // correct key
    await page.click('#gate-key', { clickCount: 3 });
    await page.type('#gate-key', KEY);
    await page.click('#gate-submit');
    await page.waitForSelector('.app', { timeout: 15000 });
    logs.length = 0;
    for (const sec of ['dashboard', 'users', 'plans', 'audit', 'settings', 'system']) {
      await page.evaluate((s) => { location.hash = '#/' + s; }, sec);
      await sleep(1800);
      report.sections[sec] = { title: await page.$eval('#page-title', e => e.textContent), checks: await page.evaluate(CHECKS), errors: errs() };
      logs.length = 0;
      await shot(`10_${sec}`);
      await shot(`11_${sec}_full`, true);
    }
    // users: open the first user drawer
    await page.evaluate(() => { location.hash = '#/users'; });
    await sleep(1500);
    await page.evaluate(() => { const s = document.querySelector('#u-type'); s.value = 'all'; s.dispatchEvent(new Event('change')); });
    await sleep(1500);
    const userBtn = VP === 'mobile' ? '.mlist [data-user]' : '.tbl [data-user]';
    await page.click(userBtn);
    await page.waitForSelector('.drawer .tabs', { timeout: 10000 });
    await sleep(600);
    report.sections.drawer = { checks: await page.evaluate(CHECKS), errors: errs() };
    await shot('20_user_drawer');
    for (const t of ['sessions', 'activity']) {
      await page.click(`.drawer [data-tab="${t}"]`);
      await sleep(500);
      await shot(`21_user_drawer_${t}`);
    }
    await page.keyboard.press('Escape');
    await sleep(400);
    // plans: matrix + mobile editor
    await page.evaluate(() => { location.hash = '#/plans'; });
    await sleep(1500);
    if (VP === 'mobile') {
      await page.click('[data-pick="plus"]');
      await sleep(700);
      report.sections.plansEditorMobile = { checks: await page.evaluate(CHECKS), errors: errs() };
      await shot('30_plan_editor');
      await shot('31_plan_editor_full', true);
    }
    await page.click('[data-mode="matrix"]');
    await sleep(800);
    report.sections.matrix = { checks: await page.evaluate(CHECKS), errors: errs() };
    await shot('32_plans_matrix');
  } catch (e) {
    report.fatal = String(e && e.stack || e).slice(0, 600);
    try { await shot('99_fatal'); } catch (e2) { /* ignore */ }
  } finally {
    fs.writeFileSync(path.join(OUT, `${TAG}_${VP}_${LANG}_report.json`), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report, null, 1).slice(0, 6000));
    // end the console session this probe opened (no residue on the System page)
    try { await ctx.page.evaluate(() => fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })); } catch (e) { /* page may be gone */ }
    await ctx.browser.close();
  }
})();
