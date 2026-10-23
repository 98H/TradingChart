// tests/qa_r1_sweep.cjs — Round-1 feature-by-feature sweep (all panels/tabs/modals)
// Usage: node tests/qa_r1_sweep.cjs <desktop|mobile> <fa|en>
const { launch, INPAGE, EVID } = require('./qa_lib.cjs');
const fs = require('fs'); const path = require('path');
const vp = process.argv[2] || 'desktop'; const lang = process.argv[3] || 'fa';
const OUT = path.join(EVID, 'r1sweep', `${vp}_${lang}`); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const PANELS = ['layouts','watchlist','paper','alerts','pine','strategy','propsim','journal','trackers','calendar','screener','dom','compare','templates','workspaces','news','objects','dataWindow','chartStyle','barReplay','dataExport','gold','tse','sources'];
const TABS = ['pine','strategy','propsim','journal','trackers','calendar','screener','news','gold','tse'];

async function fresh(ctx) {
  try { await ctx.page.close(); } catch (e) {}
  const page = await ctx.browser.newPage();
  await page.setViewport(ctx.viewport);
  ctx.page = page; ctx.logs.length = 0;
  page.on('console', m => ctx.logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => ctx.logs.push({ type: 'pageerror', text: e.toString() }));
  page.on('requestfailed', r => ctx.logs.push({ type: 'requestfailed', text: r.url() + ' ' + ((r.failure() || {}).errorText || '') }));
  await page.goto((process.env.SDD_BASE_URL||'http://127.0.0.1:8088')+'/chart', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => !!window.__TRADING_APP__ && !!document.querySelector('canvas'), { timeout: 30000 }).catch(() => {});
  await sleep(3500);
  await page.evaluate(l => window.__TRADING_APP__.switchLanguage(l), lang);
  await sleep(900);
  ctx.logs.length = 0;
  return page;
}

async function audit(page) {
  return page.evaluate((H) => {
    const r = {};
    r.untranslated = eval('(' + H.untranslated + ')')();
    r.overflow = eval('(' + H.horizontalOverflow + ')()');
    r.innerClip = eval('(' + H.innerClip + ')()');
    r.small = eval('(' + H.smallTargets + ')()');
    r.pageScrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    // visible text sanity: "undefined", "NaN", "null", "[object"
    const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement; if (!el || !el.getClientRects().length) continue;
      if (el.closest('script,style,#pine-code-editor,.code-editor,pre,code,textarea')) continue;
      const t = n.textContent;
      if (/\bundefined\b|\bNaN\b|\[object |\bnull\b|Infinity/.test(t)) bad.push({ cls: (el.className || el.id || el.tagName).toString().slice(0, 40), text: t.trim().slice(0, 80) });
    }
    r.badText = bad.slice(0, 15);
    // RTL: Persian content in LTR modal containers
    if (document.documentElement.lang === 'fa') {
      r.ltrFa = Array.from(document.querySelectorAll('.modal-box, .modal-content, .panel-body, [class*=drawer], [class*=sheet]')).filter(e => e.getClientRects().length && getComputedStyle(e).direction === 'ltr' && /[\u0600-\u06FF]/.test(e.innerText || '') && !e.closest('[dir=ltr]')).map(e => (e.id || e.className.toString()).slice(0, 50)).slice(0, 8);
    }
    return r;
  }, INPAGE);
}

async function openPanel(page, id) {
  return page.evaluate((id) => {
    const app = window.__TRADING_APP__;
    // Prefer the real UI path: + Panels menu item
    const menuBtn = document.querySelector('#nav-btn-panels');
    if (menuBtn && menuBtn.getClientRects().length) menuBtn.click();
    const item = document.querySelector(`.panel-menu-item[data-panel="${id}"]`);
    if (!item) return 'no-menu-item';
    item.click();
    return 'ok';
  }, id);
}

function summarize(name, a, logs) {
  const errs = logs.filter(l => ['error', 'pageerror', 'requestfailed'].includes(l.type));
  const d = [];
  if (a.untranslated.length) d.push(['untranslated', a.untranslated.slice(0, 8).map(x => x.text)]);
  if (a.overflow.length) d.push(['overflow', a.overflow.slice(0, 5).map(x => `${x.id || x.cls}[${x.left}-${x.right}] ${x.text}`)]);
  if (a.innerClip.length) d.push(['innerClip', a.innerClip.slice(0, 5).map(x => `${x.id || x.cls} ${x.scrollW}/${x.clientW} ${x.text}`)]);
  if (vp === 'mobile' && a.small.length) d.push(['small', a.small.slice(0, 6).map(x => `${x.id || x.cls} ${x.w}x${x.h} ${x.text}`)]);
  if (a.pageScrollX) d.push(['pageScrollX', true]);
  if (a.badText.length) d.push(['badText', a.badText]);
  if (a.ltrFa && a.ltrFa.length) d.push(['ltrFa', a.ltrFa]);
  if (errs.length) d.push(['console', errs.slice(0, 5).map(e => e.text.slice(0, 200))]);
  return { name, defects: d };
}

(async () => {
  const ctx = await launch(vp);
  const results = [];
  const run = async (name, fn) => {
    if (ONLY && !ONLY.test(name)) return;
    try {
      if (!ctx.browser.isConnected()) { const n = await launch(vp); ctx.browser = n.browser; ctx.page = n.page; ctx.logs = n.logs; }
      const page = await fresh(ctx);
      await fn(page);
      await sleep(1500);
      const a = await audit(page);
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      const s = summarize(name, a, ctx.logs);
      results.push(s);
      console.log((s.defects.length ? '✗ ' : '✓ ') + name + (s.defects.length ? '  ' + JSON.stringify(s.defects).slice(0, 900) : ''));
    } catch (e) { console.log('ERR ' + name + ' ' + e.message.slice(0, 200)); results.push({ name, defects: [['harness', e.message]] }); }
  };
  await run('home', async () => {});
  for (const p of PANELS) await run('panel_' + p, async (page) => { const r = await openPanel(page, p); if (r !== 'ok') throw new Error(r); });
  if (vp === 'desktop') {
    for (const t of TABS) await run('tab_' + t, async (page) => {
      await page.evaluate(v => { const b = document.querySelector(`.panel-tab[data-view="${v}"]`); b.click(); }, t);
    });
    for (const p of ['watchlist','alerts','paper','dataWindow','objects','pine','journal','screener','dom','calendar','news','gold','tse']) await run('rail_' + p, async (page) => {
      await page.evaluate(v => document.querySelector(`.rail-btn[data-panel="${v}"]`).click(), p);
    });
  }
  // engine surfaces
  await run('indicators_modal', async (page) => { await page.evaluate(() => (document.querySelector('.vela-widget-indicators, .vela-mb-indicators')).click()); });
  await run('symbol_search', async (page) => { await page.evaluate(() => window.__TRADING_APP__.openSymbolSearch()); });
  await run('settings_modal', async (page) => { await page.evaluate(() => window.__TRADING_APP__.openSettingsModal()); });
  await run('shortcuts_modal', async (page) => { await page.evaluate(() => window.__TRADING_APP__.shortcutsModal.open()); });
  await run('command_palette', async (page) => { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); });
  await run('account_menu', async (page) => { await page.evaluate(() => document.querySelector('#topbar-avatar, .topbar-avatar, [id*=avatar]')?.click()); });
  await run('plans_modal', async (page) => { await page.evaluate(() => window.__TRADING_APP__.auth?.openPlansModal?.()); });
  await run('login_modal', async (page) => { await page.evaluate(() => window.__TRADING_APP__.auth?.openAuthModal?.('login')); });
  await run('goto_date', async (page) => { await page.evaluate(() => window.__TRADING_APP__.goToDateModal.open()); });
  await run('timeframe_menu', async (page) => { await page.evaluate(() => (document.querySelector('.vela-topbar-tf, .vela-mb-tf')).click()); });
  await run('chart_settings_engine', async (page) => { await page.evaluate(() => (document.querySelector('.vela-bb-settings, .vela-mb-settings')).click()); });
  if (vp === 'mobile') {
    await run('mb_more', async (page) => { await page.evaluate(() => document.querySelector('.vela-mb-more').click()); });
    await run('mb_drawings', async (page) => { await page.evaluate(() => document.querySelector('.vela-mb-drawings').click()); });
    await run('mb_quicktrade', async (page) => { await page.evaluate(() => document.querySelector('#qt-collapsed-trigger').click()); });
  } else {
    await run('chart_style_picker', async (page) => { await page.evaluate(() => document.querySelector('#btn-topbar-chart-style').click()); });
    await run('market_source', async (page) => { await page.evaluate(() => document.querySelector('#btn-topbar-market-source').click()); });
    await run('export', async (page) => { await page.evaluate(() => document.querySelector('#btn-topbar-export').click()); });
    await run('replay', async (page) => { await page.evaluate(() => document.querySelector('#btn-topbar-replay').click()); });
    await run('layout_save', async (page) => { await page.evaluate(() => document.querySelector('#btn-layout-save').click()); });
    await run('ctx_menu', async (page) => { await page.mouse.click(700, 400, { button: 'right' }); });
    await run('journal_workspace', async (page) => { await page.evaluate(() => document.querySelector('#nav-btn-journal').click()); });
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.defects.length);
  console.log(`\n== ${vp}/${lang}: ${results.length - bad.length}/${results.length} clean`);
  await ctx.browser.close(); process.exit(0);
})();
