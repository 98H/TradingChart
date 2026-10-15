// Probe: DOM-level facts behind cycle-1 visual findings (header pill, icon
// order in RTL buttons, sticky bar opacity, disabled primary styling, text
// contrast, matrix overflow source, tap-target sizes).
const fs = require('fs');
const path = require('path');
const { launch, BASE } = require('../qa_lib.cjs');
const KEY = fs.readFileSync(path.resolve(__dirname, '../../server/data/admin_master.key'), 'utf8').trim();
const VP = process.argv[2] || 'mobile';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FACTS = `(() => {
  const out = {};
  const q = (s) => document.querySelector(s);
  const desc = (el) => el ? { tag: el.tagName, cls: String(el.className).slice(0, 60), id: el.id, text: el.textContent.trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  // header children
  const top = q('.topbar') || q('header');
  out.topbar = top ? [...top.querySelectorAll('*')].filter(e => e.children.length === 0 || e.tagName === 'BUTTON').map(desc).slice(0, 20) : 'no topbar';
  // icon order in buttons (RTL: icon should be on the right of the label)
  const dir = document.documentElement.dir;
  out.dir = dir;
  out.iconOrder = [...document.querySelectorAll('button, a')].filter(b => b.querySelector('svg') && b.querySelector('span') && b.offsetParent).slice(0, 25).map(b => {
    const s = b.querySelector('svg').getBoundingClientRect(), t = b.querySelector('span').getBoundingClientRect();
    return { text: b.textContent.trim().slice(0, 24), iconRight: s.left > t.left, fd: getComputedStyle(b).flexDirection };
  });
  // colors
  const cs = getComputedStyle(document.documentElement);
  out.vars = {};
  for (const v of ['--bg', '--bg-2', '--panel', '--card', '--surface', '--text', '--muted', '--dim', '--line', '--accent']) out.vars[v] = cs.getPropertyValue(v).trim();
  const toRGB = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return p; };
  const lum = (p) => { const a = p.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const bgOf = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; const p = toRGB(b); if (p && (p[3] === undefined || p[3] > 0.5)) return p; el = el.parentElement; } return [11, 14, 20]; };
  const lowContrast = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent || !el.childNodes.length) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const st = getComputedStyle(el);
    const fg = toRGB(st.color); if (!fg) continue;
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(st.fontSize) >= 18.66 || (parseFloat(st.fontSize) >= 14 && parseInt(st.fontWeight) >= 700);
    if (ratio < (big ? 3 : 4.5) && !el.closest('[disabled], .btn:disabled')) lowContrast.push({ t: el.textContent.trim().slice(0, 30), ratio: Math.round(ratio * 100) / 100, fs: st.fontSize, color: st.color });
  }
  out.lowContrast = lowContrast.slice(0, 20);
  // tap targets
  out.small = [...document.querySelectorAll('button, a, select, input, [role=tab], label.switch')].filter(e => e.offsetParent).map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.height < 40 || x.r.width < 40).map(x => (x.e.getAttribute('aria-label') || x.e.textContent.trim() || x.e.tagName + '.' + x.e.className).slice(0, 26) + ' ' + Math.round(x.r.width) + 'x' + Math.round(x.r.height)).slice(0, 30);
  return out;
})()`;

(async () => {
  const ctx = await launch(VP);
  const { page } = ctx;
  try {
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tc_admin_lang', 'fa'); } catch (e) {} });
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#gate-key');
    await page.type('#gate-key', KEY);
    await page.click('#gate-submit');
    await page.waitForSelector('.app', { timeout: 15000 });
    await sleep(1500);
    const res = {};
    res.dashboard = await page.evaluate(FACTS);
    await page.evaluate(() => { location.hash = '#/plans'; });
    await sleep(1800);
    if (VP === 'mobile') { await page.click('[data-pick="plus"]'); await sleep(900); }
    res.planEditor = await page.evaluate(`(() => {
      const bar = document.querySelector('.sticky-save, .save-bar, [class*=sticky]');
      const save = document.querySelector('#pe-save');
      const sv = save && getComputedStyle(save);
      return { bar: bar && { cls: bar.className, bg: getComputedStyle(bar).backgroundColor, backdrop: getComputedStyle(bar).backdropFilter, pos: getComputedStyle(bar).position, bottom: getComputedStyle(bar).bottom },
        save: save && { disabled: save.disabled, bg: sv.backgroundColor, opacity: sv.opacity, cursor: sv.cursor, text: save.textContent.trim() },
        back: (() => { const b = document.querySelector('#pe-back'); if (!b) return null; const s = b.querySelector('svg').getBoundingClientRect(), t = b.querySelector('span')?.getBoundingClientRect(); return { iconLeft: s.left, textLeft: t && t.left, transform: getComputedStyle(b.querySelector('svg')).transform, html: b.innerHTML.slice(0, 200) }; })(),
        reset: (() => { const b = document.querySelector('#pl-reset'); return b && { w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), cls: b.className }; })(),
        del: (() => { const b = document.querySelector('#pe-delete'); return b && { disabled: b.disabled, cls: b.className, color: getComputedStyle(b).color, opacity: getComputedStyle(b).opacity, title: b.title }; })()
      };
    })()`);
    res.planEditorFacts = await page.evaluate(FACTS);
    console.log(JSON.stringify(res, null, 1));
  } finally { await ctx.browser.close(); }
})();
