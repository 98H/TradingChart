// tests/qa_parity_recon.cjs — Cycle R1: enumerate TradingChart's REAL feature surface
// from the live DOM (not docs), then compare against the TradingView canonical
// drawing-type universe to produce a verified parity matrix.
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');
fs.mkdirSync(EVID, { recursive: true });

// All 75 drawing types supported by the Vela engine (from options .d.ts DrawingTypeKey)
const VELA_TYPES = ('trendline hline ray extendedline vline hray crossline infoline trendangle box text note ' +
  'pricenote comment pricelabel signpost parallelchannel disjointchannel flattopbottom regressionchannel ' +
  'anchoredvwap fixedrangevp pitchfork schiffpitchfork modifiedschiffpitchfork insidepitchfork arrow callout ' +
  'ellipse triangle polyline freehand highlighter circle rotatedrect path arc curve arrowmarkup arrowmarkdown ' +
  'flagmark iconstamp fibretracement fibextension fibextensiontrend fibfan fibtimezones fibchannel fibspeedfan ' +
  'trendfibtime fibcircles fibarcs fibwedge fibspiral gannfan gannbox gannsquare dedekind sonic supersonic ' +
  'goldensonic goldensupersonic datepricerange position magnifier xabcd abcd elliottimpulse elliottcorrection ' +
  'headshoulders gartley bat butterfly crab shark cypher').split(' ');

(async () => {
  const results = { surface: {}, drawingsApi: {}, drawingsUi: [], defects: [] };
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 4500 });

    // 1. Enumerate every interactive control in the DOM
    results.surface = await ctx.page.evaluate(() => {
      const out = { buttons: [], rails: [], menus: [], modals: [], topbar: [], bottombar: [] };
      const seen = new Set();
      document.querySelectorAll('button[id], [data-panel], [data-tool], [data-view], .rail-btn').forEach(el => {
        const key = el.id || el.dataset.panel || el.dataset.tool || el.dataset.view || el.className;
        if (seen.has(key)) return;
        seen.add(key);
        const entry = { id: el.id || null, panel: el.dataset.panel || null, tool: el.dataset.tool || null,
          view: el.dataset.view || null, cls: (el.className || '').toString().slice(0, 60),
          title: (el.getAttribute('title') || '').slice(0, 60),
          text: (el.innerText || '').trim().slice(0, 40) };
        if (el.closest('#desktop-side-rail')) out.rails.push(entry);
        else if (el.closest('.topbar, #topbar, header')) out.topbar.push(entry);
        else if (el.closest('.vela-bottom-dock, #bottom-panel, footer')) out.bottombar.push(entry);
        else out.buttons.push(entry);
      });
      return out;
    });

    // 2. Probe the drawings API with every Vela type — arm + cancel, record which work
    results.drawingsApi = await ctx.page.evaluate((types) => {
      const app = window.__TRADING_APP__;
      const d = app?.chartManager?.workspace?.active?.chart?.drawings;
      if (!d) return { error: 'drawings API not reachable' };
      const ok = [], fail = [];
      for (const t of types) {
        try {
          d.setTool(t);
          const cur = d.getTool();
          if (cur === t) ok.push(t); else fail.push({ t, got: cur });
        } catch (e) { fail.push({ t, err: e.message }); }
      }
      try { d.setTool(null); } catch (e) {}
      return { ok, fail };
    }, VELA_TYPES);

    // 3. Enumerate drawing tools exposed in the UI (floating toolbar + any picker)
    results.drawingsUi = await ctx.page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-tool]')).map(el => ({
        tool: el.dataset.tool, title: el.getAttribute('title') || '' })));

    // 4. Chart style picker inventory
    results.chartStyles = await ctx.page.evaluate(() => {
      const btn = document.querySelector('#btn-topbar-chartstyle, [data-action="chartstyle"], .chart-style-btn');
      if (btn) btn.click();
      return new Promise(res => setTimeout(() => {
        const items = Array.from(document.querySelectorAll('.style-option, .chart-style-option, [data-style]'))
          .map(el => ({ style: el.dataset.style || el.dataset.id || null, text: (el.innerText || '').trim().slice(0, 40) }));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        res(items);
      }, 700));
    });

    // 5. Timeframes offered
    results.timeframes = await ctx.page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-tf], .vela-menu-item, .tf-option'))
        .map(el => (el.dataset.tf || el.innerText || '').trim()).filter(Boolean).slice(0, 40));

    // 6. Indicators count in the unified catalogue
    results.indicatorsCount = await ctx.page.evaluate(() => {
      const app = window.__TRADING_APP__;
      try { app?.indicatorsModal?.open?.(); } catch (e) {}
      return new Promise(res => setTimeout(() => {
        const items = document.querySelectorAll('.indicator-item, .ind-row, [data-indicator]').length;
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        res(items);
      }, 800));
    });

    const errs = errorsOf(ctx);
    if (errs.length) results.defects.push({ sev: 'error', where: 'boot-console', items: errs.slice(0, 10) });

    await ctx.page.screenshot({ path: path.join(EVID, 'r1_recon_desktop.png') });
  } finally {
    await ctx.browser.close();
  }

  fs.writeFileSync(path.join(EVID, 'r1_recon_results.json'), JSON.stringify(results, null, 2));

  // ── Report ──
  const ui = new Set(results.drawingsUi.map(d => d.tool));
  const okApi = new Set(results.drawingsApi.ok || []);
  const missingFromUi = VELA_TYPES.filter(t => !ui.has(t));
  console.log('=== R1 RECON ===');
  console.log('Rails:', results.surface.rails.length, '| Topbar btns:', results.surface.topbar.length,
    '| Bottom btns:', results.surface.bottombar.length, '| Other btns:', results.surface.buttons.length);
  console.log('Drawings API OK:', okApi.size, '/', VELA_TYPES.length,
    '| API fail:', (results.drawingsApi.fail || []).length);
  console.log('Drawings in UI:', ui.size, '| Missing from UI:', missingFromUi.length);
  console.log('UI tools:', [...ui].join(', '));
  console.log('Chart styles:', JSON.stringify(results.chartStyles));
  console.log('Timeframes:', results.timeframes.join(', '));
  console.log('Indicators in catalogue:', results.indicatorsCount);
  console.log('Defects:', results.defects.length);
  console.log('MISSING_UI_TOOLS::' + missingFromUi.join(','));
  console.log('API_FAIL::' + JSON.stringify(results.drawingsApi.fail || []));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
