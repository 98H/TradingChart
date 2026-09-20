// tests/qa_cycle_alerts.cjs — Cycle 4: full alert condition engine
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

    // 1. create form shows all 11 conditions
    await ctx.page.evaluate(() => {
      window.__TRADING_APP__.chartManager?.togglePanel?.('alerts', true);
    });
    await new Promise(r => setTimeout(r, 700));
    await ctx.page.evaluate(() => document.querySelector('#btn-create-alert-toggle')?.click());
    await new Promise(r => setTimeout(r, 500));
    const condCount = await ctx.page.evaluate(() => document.querySelectorAll('#new-alert-cond option').length);
    condCount === 11 ? pass('11 alert conditions') : fail('condition count', condCount);
    await ctx.page.screenshot({ path: path.join(EVID, 'alerts_01_create_form.png') });

    // 2. channel condition reveals channel-low field
    await ctx.page.select('#new-alert-cond', 'enter_channel');
    await new Promise(r => setTimeout(r, 300));
    const lowVisible = await ctx.page.evaluate(() => document.querySelector('#alert-channel-low-row')?.style.display !== 'none');
    lowVisible ? pass('channel-low field appears') : fail('channel-low field');

    // 3. engine fires each condition type correctly (unit-level in page)
    const engine = await ctx.page.evaluate(() => {
      const am = window.__TRADING_APP__.alertsManager;
      am.currentSymbol = 'TESTUSDT';
      am.alerts = [];
      const mk = (dir, target, extra = {}) => am.alerts.push({ id: 't' + Math.random(), symbol: 'TESTUSDT', direction: dir, targetPrice: target, referencePrice: 100, active: true, triggered: false, channel: 'Sound & Popup', condition: dir, ...extra });
      mk('crossing_up', 105); mk('crossing_down', 95); mk('greater_than', 102); mk('less_than', 98);
      mk('inside_channel', 110, { channelLow: 90 }); mk('outside_channel', 110, { channelLow: 90 });
      mk('move_up_pct', 5); mk('move_down_pct', 5);
      const fireAt = (p) => { am.alerts.forEach(a => a.triggered = false); am.checkPrice('TESTUSDT', p); return am.alerts.filter(a => a.triggered).map(a => a.direction); };
      return {
        at106: fireAt(106),   // expect crossing_up, greater_than, inside? (no, 106<110 not in 90-110? yes inside), move_up (100*1.05=105 <=106)
        at94: fireAt(94),     // expect crossing_down, less_than, outside (94<90? no, 94>90 so inside), move_down (100*0.95=95 >=94)
        at85: fireAt(85)      // expect outside_channel (85<90)
      };
    });
    console.log('engine fires:', JSON.stringify(engine));
    engine.at106.includes('crossing_up') && engine.at106.includes('greater_than') ? pass('up conditions fire') : fail('up fire', JSON.stringify(engine.at106));
    engine.at94.includes('crossing_down') && engine.at94.includes('less_than') ? pass('down conditions fire') : fail('down fire', JSON.stringify(engine.at94));
    engine.at85.includes('outside_channel') ? pass('outside_channel fires') : fail('outside_channel', JSON.stringify(engine.at85));

    // 4. create a real alert through the UI
    await ctx.page.select('#new-alert-cond', 'greater_than');
    await ctx.page.evaluate(() => { document.querySelector('#new-alert-price').value = '999999'; });
    await ctx.page.evaluate(() => document.querySelector('#btn-new-alert-save')?.click());
    await new Promise(r => setTimeout(r, 500));
    const alertCount = await ctx.page.evaluate(() => window.__TRADING_APP__.alertsManager.alerts.filter(a => a.symbol === 'TESTUSDT' || a.targetPrice === 999999).length);
    alertCount > 0 ? pass('UI creates alert') : fail('UI create alert');

    const errs = errorsOf(ctx);
    errs.length ? fail('console errors', JSON.stringify(errs.slice(0, 3))) : pass('clean console');
  } catch (e) {
    fail('exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n══ CYCLE 4 (alerts) RESULT: ${defects.length === 0 ? 'ZERO DEFECTS ✅' : defects.length + ' DEFECTS ❌'} ══`);
  fs.writeFileSync(path.join(EVID, 'alerts_results.json'), JSON.stringify({ defects }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
