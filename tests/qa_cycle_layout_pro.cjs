// tests/qa_cycle_layout_pro.cjs — Cycle 7: pro layout mgmt + user profile
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 5000 });

    // 1. Set a 4-grid, then RELOAD and confirm it persists (TradingView parity)
    await ctx.page.evaluate(() => window.__TRADING_APP__.layoutManager.setLayout('4', 'Quad'));
    await new Promise(r => setTimeout(r, 3500));
    await ctx.page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    const persisted = await ctx.page.evaluate(() => {
      const ws = window.__TRADING_APP__.chartManager?.workspace;
      return { cells: ws?.cellsById?.size || 0, activeId: window.__TRADING_APP__.layoutManager?.activeLayoutId };
    });
    (persisted.activeId === '4') ? pass(`layout persists after reload (activeId=4)`) : fail('layout persistence', JSON.stringify(persisted));

    // 2. Open studio, test rename / duplicate / export
    await ctx.page.evaluate(() => window.__TRADING_APP__.layoutManager.openLayoutStudio());
    await new Promise(r => setTimeout(r, 700));
    const hasBtns = await ctx.page.evaluate(() => ({
      rename: !!document.querySelector('.btn-rename-layout'),
      dup: !!document.querySelector('.btn-dup-layout'),
      exp: !!document.querySelector('.btn-export-layout'),
      imp: !!document.querySelector('#btn-import-layout'),
    }));
    (hasBtns.rename && hasBtns.dup && hasBtns.exp && hasBtns.imp) ? pass('rename/dup/export/import buttons') : fail('layout action buttons', JSON.stringify(hasBtns));

    // 3. Duplicate via API
    const dup = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      const before = lm.savedLayouts.length;
      const c = lm.duplicateLayout(lm.savedLayouts[0].id);
      return { before, after: lm.savedLayouts.length, copied: !!c };
    });
    (dup.after === dup.before + 1 && dup.copied) ? pass('duplicate layout works') : fail('duplicate', JSON.stringify(dup));

    // 4. Export returns valid JSON, import restores it
    const exim = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      const json = lm.exportLayout(lm.savedLayouts[0].id);
      const before = lm.savedLayouts.length;
      const imported = lm.importLayout(json);
      return { validJson: json.includes('__tradingchart_layout'), imported: !!imported, after: lm.savedLayouts.length, before };
    });
    (exim.validJson && exim.imported && exim.after === exim.before + 1) ? pass('export+import round-trip') : fail('export/import', JSON.stringify(exim));
    await ctx.page.screenshot({ path: path.join(EVID, 'layoutpro_01_studio.png') });

    // 5. Sync switches are interactive
    const syncTest = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      const before = lm.syncOpts.symbol;
      lm.toggleSync('symbol', !before);
      return { before, after: lm.syncOpts.symbol };
    });
    (syncTest.before !== syncTest.after) ? pass('sync switch toggles') : fail('sync toggle', JSON.stringify(syncTest));

    // 6. Profile: theme toggle + display name
    await ctx.page.keyboard.press('Escape');
    await ctx.page.evaluate(() => window.__TRADING_APP__.userProfileModal?.open());
    await new Promise(r => setTimeout(r, 600));
    const profileUi = await ctx.page.evaluate(() => ({
      theme: !!document.querySelector('#btn-profile-theme'),
      nameInput: !!document.querySelector('#profile-display-name'),
    }));
    (profileUi.theme && profileUi.nameInput) ? pass('profile has theme toggle + name edit') : fail('profile ui', JSON.stringify(profileUi));
    await ctx.page.screenshot({ path: path.join(EVID, 'layoutpro_02_profile.png') });

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 7 (layout+profile pro) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'layoutpro_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
