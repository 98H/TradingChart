// tests/qa_diag.cjs — Targeted root-cause diagnostics
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 1200));

  const out = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const s = getComputedStyle(el);
      return { sel, textAlign: s.textAlign, direction: s.direction, cls: (el.className||'').toString().slice(0,60) };
    };
    return {
      probes: [
        probe('.panel-menu-item'),
        probe('#modal-indicators .modal-box'),
        probe('#modal-indicators .modal-box h3'),
        probe('#quick-trade-sell-btn'),
        probe('.vela-widget-indicators'),
        probe('#modal-symbol-search .modal-box'),
        probe('body')
      ],
      symSearch: (() => {
        const m = document.querySelector('#modal-symbol-search');
        if (!m) return 'no modal';
        return { html: m.innerHTML.slice(0, 1500) };
      })(),
      panelsGrid: (() => {
        const g = document.querySelector('.panels-grid-menu');
        if (!g) return 'none';
        const items = Array.from(g.querySelectorAll('.panel-menu-item')).map(i => {
          const r = i.getBoundingClientRect();
          const is = getComputedStyle(i);
          return { w: Math.round(r.width), left: Math.round(r.left), minW: is.minWidth, ta: is.textAlign };
        });
        const gs = getComputedStyle(g);
        return { cols: gs.gridTemplateColumns, width: g.getBoundingClientRect().width, padding: gs.padding, items: items.slice(0,4) };
      })(),
      modules: (() => {
        const app = window.__TRADING_APP__;
        const names = ['templateManager','pineStudio','strategyTester','propFirmSim','technicalScreener','economicCalendar','depthOfMarket','marketNews','watchlistManager','tradeJournalModal','indicatorSettingsModal','layoutManager','compareModal','dataExportModal','barReplay','scaleControls','floatingToolbar','userProfileModal','screenshotModal','indicatorsModal','settingsModal','timeframeManager','chartStylePicker','marketTrackers'];
        return names.map(n => {
          const m = app[n];
          return { n, has: !!m, render: !!(m && typeof m.render === 'function'),
                   remount: !!(m && (typeof m.mount === 'function')), keys: m ? Object.keys(m).slice(0,6) : [] };
        });
      })()
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await ctx.browser.close();
})();