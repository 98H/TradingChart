const { page } = ctx;
const collect = async () => page.evaluate(() => {
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!el || !el.getClientRects().length) continue;
    if (el.closest('script,style,svg,.num-ltr,code,pre,kbd,[data-no-i18n],textarea')) continue;
    const t = n.textContent.trim();
    if (t.length < 2 || /[\u0600-\u06FF]/.test(t) || !/[A-Za-z]{2,}/.test(t)) continue;
    out.add(t);
  }
  document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e => {
    if (!e.getClientRects().length) return;
    for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && !/[\u0600-\u06FF]/.test(v) && /[A-Za-z]{3,}/.test(v)) out.add('@' + a + ':' + v); }
  });
  return Array.from(out);
});
const res = {};
const sleep2 = ms => new Promise(r => setTimeout(r, ms));
res.home = await collect();
// chart settings dialog: each tab
await page.evaluate(() => document.querySelector('.vela-bb-settings')?.click()); await sleep2(900);
res.settings = await collect();
const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab], .vela-settings-tab, [class*=settings] [class*=tab]')).filter(e => e.getClientRects().length).length);
for (let i = 0; i < tabs; i++) {
  await page.evaluate(i => Array.from(document.querySelectorAll('[role=tab], .vela-settings-tab, [class*=settings] [class*=tab]')).filter(e => e.getClientRects().length)[i]?.click(), i);
  await sleep2(500);
  res['settings_tab' + i] = await collect();
}
await page.keyboard.press('Escape'); await sleep2(400);
await page.mouse.click(700, 400, { button: 'right' }); await sleep2(700);
res.ctx = await collect();
await page.keyboard.press('Escape'); await sleep2(300);
await page.evaluate(() => document.querySelector('.vela-topbar-tf')?.click()); await sleep2(600);
res.tf = await collect();
await page.keyboard.press('Escape'); await sleep2(300);
await page.evaluate(() => document.querySelector('.vela-topbar-style')?.click()); await sleep2(600);
res.style = await collect();
await page.keyboard.press('Escape'); await sleep2(300);
await page.evaluate(() => document.querySelector('.vela-bb-tz')?.click()); await sleep2(600);
res.tz = await collect();
await page.keyboard.press('Escape'); await sleep2(300);
// left toolbar flyouts
const arrows = await page.evaluate(() => document.querySelectorAll('.vela-dtb-arrow').length);
const fly = new Set();
for (let i = 0; i < arrows; i++) {
  await page.evaluate(i => document.querySelectorAll('.vela-dtb-arrow')[i].click(), i); await sleep2(400);
  (await collect()).forEach(x => fly.add(x));
  await page.keyboard.press('Escape'); await sleep2(200);
}
res.flyouts = Array.from(fly);
// dedupe vs home
const home = new Set(res.home);
for (const k of Object.keys(res)) if (k !== 'home') res[k] = res[k].filter(x => !home.has(x));
return res;
