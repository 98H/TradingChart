/**
 * @spec 003
 * @covers FR-010, FR-011
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ──────────────────────────────────────────────────────────────────────────
    // FR-010: Drawings stash per symbol in tc_drawings_by_symbol & restore on switch
    // ──────────────────────────────────────────────────────────────────────────
    {
      // 1. Ensure current symbol is BTCUSDT and add a drawing
      await page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        if (app.currentSymbol !== 'BTCUSDT') {
          await app.switchSymbol('BTCUSDT');
        }
        const d = app.chartManager.workspace.active.chart.drawings;
        // Clean any leftovers
        d.all().forEach(dr => { try { d.remove(dr.id); } catch (e) {} });
        d.add('trendline', {
          points: [
            { time: Date.now() - 3600000 * 5, price: 65000 },
            { time: Date.now() - 3600000, price: 68000 }
          ]
        });
      });

      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);
      const btcInitial = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        return {
          sym: app.currentSymbol,
          count: app.chartManager.workspace.active.chart.drawings.all().length
        };
      });
      assert(btcInitial.sym === 'BTCUSDT' && btcInitial.count === 1,
        'FR-010 initial drawing on BTCUSDT', `Expected 1 drawing on BTCUSDT, got ${JSON.stringify(btcInitial)}`);

      // 2. Switch symbol to ETHUSDT
      await page.evaluate(async () => {
        await window.__TRADING_APP__.switchSymbol('ETHUSDT');
      });
      await page.waitForFunction(() => window.__TRADING_APP__?.currentSymbol === 'ETHUSDT');

      // Verify BTCUSDT drawings were stashed in localStorage
      const stash = await page.evaluate(() => {
        const d = window.__TRADING_APP__.chartManager.workspace.active.chart.drawings;
        const stored = JSON.parse(localStorage.getItem('tc_drawings_by_symbol') || '{}');
        const btcData = stored['BTCUSDT'];
        const btcDrawings = Array.isArray(btcData) ? btcData : btcData?.drawings;
        return {
          ethCount: d.all().length,
          hasBtcInStash: Array.isArray(btcDrawings) && btcDrawings.length === 1
        };
      });
      assert(stash.hasBtcInStash, 'FR-010 BTCUSDT drawing stashed in tc_drawings_by_symbol',
        'tc_drawings_by_symbol did not contain BTCUSDT drawing document');
      assert(stash.ethCount === 0, 'FR-010 ETHUSDT canvas starts clean',
        `Expected 0 drawings on fresh ETHUSDT, got ${stash.ethCount}`);

      // 3. Add distinct drawing on ETHUSDT (box)
      await page.evaluate(() => {
        const d = window.__TRADING_APP__.chartManager.workspace.active.chart.drawings;
        d.add('box', {
          points: [
            { time: Date.now() - 3600000 * 2, price: 3400 },
            { time: Date.now(), price: 3600 }
          ]
        });
      });
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);

      // 4. Switch back to BTCUSDT: verify BTCUSDT trendline is restored
      await page.evaluate(async () => {
        await window.__TRADING_APP__.switchSymbol('BTCUSDT');
      });
      await page.waitForFunction(() => window.__TRADING_APP__?.currentSymbol === 'BTCUSDT');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);

      const btcRestored = await page.evaluate(() => {
        const d = window.__TRADING_APP__.chartManager.workspace.active.chart.drawings;
        const all = d.all();
        return {
          count: all.length,
          type: all[0]?.type
        };
      });
      assert(btcRestored.count === 1 && btcRestored.type === 'trendline',
        'FR-010 restore BTCUSDT trendline drawing', `Expected restored trendline, got ${JSON.stringify(btcRestored)}`);

      // 5. Switch back to ETHUSDT: verify ETHUSDT box is restored
      await page.evaluate(async () => {
        await window.__TRADING_APP__.switchSymbol('ETHUSDT');
      });
      await page.waitForFunction(() => window.__TRADING_APP__?.currentSymbol === 'ETHUSDT');
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);

      const ethRestored = await page.evaluate(() => {
        const d = window.__TRADING_APP__.chartManager.workspace.active.chart.drawings;
        const all = d.all();
        return {
          count: all.length,
          type: all[0]?.type
        };
      });
      assert(ethRestored.count === 1 && ethRestored.type === 'box',
        'FR-010 restore ETHUSDT box drawing', `Expected restored box, got ${JSON.stringify(ethRestored)}`);

      // Switch back to BTCUSDT for subsequent tests
      await page.evaluate(async () => {
        await window.__TRADING_APP__.switchSymbol('BTCUSDT');
      });
      await page.waitForFunction(() => window.__TRADING_APP__?.currentSymbol === 'BTCUSDT');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-011: Layouts save/restore drawings per cell & drawings sync across grid
    // ──────────────────────────────────────────────────────────────────────────
    {
      // 1. Switch to 2-chart grid layout ("2h")
      await page.evaluate(async () => {
        const lm = window.__TRADING_APP__.layoutManager;
        await lm.setLayout('2h');
      });
      await page.waitForFunction(() => {
        const ws = window.__TRADING_APP__?.chartManager?.workspace;
        return ws && ws.order && ws.order.length === 2 && ws.cellsById && ws.cellsById.size === 2;
      });

      // 2. Enable drawings sync in layoutManager
      await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('drawings', true);
      });
      const syncEnabled = await page.evaluate(() => window.__TRADING_APP__.layoutManager.syncOpts.drawings);
      assert(syncEnabled === true, 'FR-011 toggle drawings sync on', 'Expected layoutManager.syncOpts.drawings to be true');

      // 3. Draw in cell 0 and verify automatic mirroring in cell 1
      await page.evaluate(async () => {
        const ws = window.__TRADING_APP__.chartManager.workspace;
        const cell0 = ws.cellsById.get(ws.order[0]);
        const d0 = cell0.chart.drawings;
        // Clean cell 0
        d0.all().forEach(dr => { try { d0.remove(dr.id); } catch (e) {} });
        d0.add('trendline', {
          points: [
            { time: Date.now() - 3600000 * 3, price: 62000 },
            { time: Date.now() - 3600000, price: 64000 }
          ]
        });
      });

      // Wait for drawings sync to mirror to cell 1
      await page.waitForFunction(() => {
        const ws = window.__TRADING_APP__?.chartManager?.workspace;
        const cell1 = ws?.cellsById?.get(ws?.order?.[1]);
        return (cell1?.chart?.drawings?.all()?.length || 0) === 1;
      }, { timeout: 8000 });

      const syncResult = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager.workspace;
        const cell0 = ws.cellsById.get(ws.order[0]);
        const cell1 = ws.cellsById.get(ws.order[1]);
        return {
          c0Count: cell0.chart.drawings.all().length,
          c1Count: cell1.chart.drawings.all().length,
          c1Type: cell1.chart.drawings.all()[0]?.type
        };
      });
      assert(syncResult.c0Count === 1 && syncResult.c1Count === 1 && syncResult.c1Type === 'trendline',
        'FR-011 drawings sync mirrors drawing across cells', `Expected synced drawing in cell 1, got ${JSON.stringify(syncResult)}`);

      // 4. Capture workspace state and verify per-cell drawings serialization
      const workspaceSnapshot = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        const state = lm.captureWorkspaceState();
        return {
          hasCells: Array.isArray(state?.cells) && state.cells.length === 2,
          c0HasDrawings: !!state?.cells?.[0]?.drawings,
          c1HasDrawings: !!state?.cells?.[1]?.drawings,
          layoutSyncDrawings: state?.layoutSync?.drawings
        };
      });
      assert(workspaceSnapshot.hasCells, 'FR-011 workspace state has cells', 'captureWorkspaceState missing cells');
      assert(workspaceSnapshot.c0HasDrawings && workspaceSnapshot.c1HasDrawings,
        'FR-011 layout state captures drawings per cell', `Missing per-cell drawings: ${JSON.stringify(workspaceSnapshot)}`);

      // 5. Restore 1x1 Single chart layout for cleanup
      await page.evaluate(async () => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('drawings', false);
        await lm.setLayout('1');
      });
      await page.waitForFunction(() => {
        const lm = window.__TRADING_APP__?.layoutManager;
        return lm && lm.activeLayoutId === '1';
      });
    }

  } catch (err) {
    console.error(`❌ Unexpected failure: ${err.stack || err.message}`);
    process.exit(1);
  } finally {
    await ctx.browser.close();
  }

  console.log('PASS: 003 [04_symbol_and_layout_drawings_sync]');
}

run().catch(err => {
  console.error(`❌ Unexpected fatal failure: ${err.message}`);
  process.exit(1);
});
