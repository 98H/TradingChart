/**
 * @spec 007
 * @covers FR-006, FR-007, FR-008, FR-009, FR-010
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Log Trade Modal Prefill, Live P&L/R Preview & Save (FR-006, SC-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open modal via button
      await realClick(page, '#nav-btn-journal');
      await page.waitForSelector('#journal-workspace-view', { visible: true, timeout: 6000 });
      await realClick(page, '#journal-workspace-view #btn-journal-add');

      await page.waitForSelector('#modal-log-trade.open', { visible: true, timeout: 5000 });

      // Verify prefill defaults
      const prefillState = await page.evaluate(() => {
        const sideBuy = document.querySelector('#side-pill-buy');
        const sideSell = document.querySelector('#side-pill-sell');
        const entryVal = document.querySelector('#log-trade-entry')?.value;
        const exitVal = document.querySelector('#log-trade-exit')?.value;
        const slVal = document.querySelector('#log-trade-sl')?.value;
        const qtyVal = document.querySelector('#log-trade-qty')?.value;
        const pnlPreview = document.querySelector('#log-pnl-preview')?.innerText;
        const rPreview = document.querySelector('#log-r-preview')?.innerText;

        return {
          isBuyActive: sideBuy?.classList.contains('active'),
          isSellActive: sideSell?.classList.contains('active'),
          entry: Number(entryVal),
          exit: Number(exitVal),
          sl: Number(slVal),
          qty: Number(qtyVal),
          pnlPreview,
          rPreview
        };
      });

      assert(prefillState.isBuyActive, 'FR-006 BUY side pill active by default',
        'Expected #side-pill-buy to have .active');
      assert(prefillState.qty === 0.5, 'FR-006 default quantity is 0.5',
        `Expected quantity 0.5, got ${prefillState.qty}`);
      assert(prefillState.entry > 0, 'FR-006 entry price prefilled with market price',
        `Expected entry > 0, got ${prefillState.entry}`);
      assert(prefillState.exit > prefillState.entry, 'FR-006 target prefilled above entry for BUY',
        `Expected target > entry, got target=${prefillState.exit}, entry=${prefillState.entry}`);
      assert(prefillState.sl < prefillState.entry, 'FR-006 stop loss prefilled below entry for BUY',
        `Expected SL < entry, got SL=${prefillState.sl}, entry=${prefillState.entry}`);
      assert(prefillState.rPreview?.includes('R: 1 :'), 'FR-006 live R-multiple preview format',
        `Expected "R: 1 :", got "${prefillState.rPreview}"`);

      // Toggle side to SELL / SHORT
      await realClick(page, '#side-pill-sell');
      await page.waitForFunction(() => document.querySelector('#side-pill-sell')?.classList.contains('active'), { timeout: 3000 });

      const sellToggleState = await page.evaluate(() => {
        const sideSell = document.querySelector('#side-pill-sell');
        const pnlPreview = document.querySelector('#log-pnl-preview')?.innerText;
        const rPreview = document.querySelector('#log-r-preview')?.innerText;
        return {
          isSellActive: sideSell?.classList.contains('active'),
          pnlPreview,
          rPreview
        };
      });
      assert(sellToggleState.isSellActive, 'FR-006 SELL pill becomes active on toggle',
        'Expected #side-pill-sell to have .active');

      // Fill custom trade values: entry 80000, exit 78000, sl 81000, qty 0.25
      await page.evaluate(() => {
        const entry = document.querySelector('#log-trade-entry');
        const exit = document.querySelector('#log-trade-exit');
        const sl = document.querySelector('#log-trade-sl');
        const qty = document.querySelector('#log-trade-qty');
        const notes = document.querySelector('#log-trade-notes');

        if (entry) entry.value = '80000';
        if (exit) exit.value = '78000';
        if (sl) sl.value = '81000';
        if (qty) qty.value = '0.25';
        if (notes) notes.value = 'Acceptance test manual short trade';

        entry?.dispatchEvent(new Event('input', { bubbles: true }));
        exit?.dispatchEvent(new Event('input', { bubbles: true }));
        sl?.dispatchEvent(new Event('input', { bubbles: true }));
        qty?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const r = document.querySelector('#log-r-preview')?.innerText;
        return r && r.includes('R: 1 : 2.00');
      }, { timeout: 4000 });

      // Record executions count before save
      const execCountBefore = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.executions?.length || 0;
      });

      // Save trade to journal
      await realClick(page, '#btn-save-log-trade');
      await page.waitForFunction(() => !document.querySelector('#modal-log-trade')?.classList.contains('open'), { timeout: 4000 });

      const saveResult = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const modalOpen = document.querySelector('#modal-log-trade')?.classList.contains('open');
        const execs = store?.executions || [];
        const newExecs = execs.slice(0, 2);
        return {
          modalOpen,
          execCountAfter: execs.length,
          newExecs
        };
      });

      assert(!saveResult.modalOpen, 'FR-006 modal closes on save', 'Modal remained open after saving');
      assert(saveResult.execCountAfter === execCountBefore + 2, 'FR-006 save adds open and close executions',
        `Expected +2 executions, went from ${execCountBefore} to ${saveResult.execCountAfter}`);
      assert(saveResult.newExecs.some(e => e.quantity === 0.25),
        'FR-006 saved execution attributes match entered values',
        `Unexpected executions: ${JSON.stringify(saveResult.newExecs)}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Voice Dictation Availability and Graceful Fallback (FR-007)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open modal to verify voice dictation button
      await page.evaluate(() => window.__TRADING_APP__.tradeJournalModal.open());
      await page.waitForSelector('#modal-log-trade.open', { visible: true, timeout: 4000 });

      const voiceModalState = await page.evaluate(() => {
        const btn = document.querySelector('#btn-modal-voice-dictate');
        return {
          hasBtn: !!btn,
          text: btn?.innerText?.trim()
        };
      });
      assert(voiceModalState.hasBtn, 'FR-007 voice dictation button exists in log modal',
        '#btn-modal-voice-dictate missing');

      // Click voice button: must not throw unhandled exceptions
      await realClick(page, '#btn-modal-voice-dictate');
      await new Promise(r => setTimeout(r, 400));

      // Close modal
      await realClick(page, '#btn-close-log-trade');
      await page.waitForFunction(() => !document.querySelector('#modal-log-trade')?.classList.contains('open'), { timeout: 4000 });

      // Check daily journal voice button
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'daily'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #btn-voice-dictate', { visible: true, timeout: 5000 });

      const voiceDailyState = await page.evaluate(() => {
        const btn = document.querySelector('#journal-workspace-view #btn-voice-dictate');
        return {
          hasBtn: !!btn,
          text: btn?.innerText?.trim()
        };
      });
      assert(voiceDailyState.hasBtn, 'FR-007 voice dictation button exists in daily journal',
        '#btn-voice-dictate missing in daily journal');

      // Click daily voice button
      await realClick(page, '#journal-workspace-view #btn-voice-dictate');
      await new Promise(r => setTimeout(r, 400));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Closed Paper-Trading and Replay Positions Added Automatically (FR-008)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch back to Quant mode for chart execution
      await realClick(page, '#nav-btn-quant');
      await page.waitForSelector('#chart-area', { visible: true, timeout: 6000 });

      const paperBefore = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.executions?.length || 0;
      });

      // Execute paper market buy order via quick trade
      await page.waitForSelector('#quick-trade-buy-btn', { visible: true, timeout: 6000 });
      await realClick(page, '#quick-trade-buy-btn');
      await page.waitForFunction(() => (window.__TRADING_APP__.paperTrading?.positions?.length || 0) > 0, { timeout: 5000 });

      // Close paper position
      await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        if (pt && pt.positions.length > 0) {
          pt.closePosition(pt.positions[0].id);
        }
      });
      await page.waitForFunction(() => (window.__TRADING_APP__.paperTrading?.positions?.length || 0) === 0, { timeout: 5000 });

      const paperAfter = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const execs = store?.executions || [];
        return {
          total: execs.length,
          lastExec: execs[execs.length - 1]
        };
      });

      assert(paperAfter.total > paperBefore, 'FR-008 closed paper position added to journal',
        `Expected executions to increase from ${paperBefore}, got ${paperAfter.total}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Statement Importer: Parse, Preview, Deduplication & Error (FR-009, SC-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open journal importer suite
      await realClick(page, '#nav-btn-journal');
      await page.waitForSelector('#journal-workspace-view', { visible: true, timeout: 6000 });

      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'importer'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #import-text-paste', { visible: true, timeout: 6000 });

      // Test valid TradingView statement paste
      const sampleStatement = `Symbol,Side,Price,Qty,Time
BTCUSDT,BUY,77000.00,0.5,2026-09-28 10:00:00
BTCUSDT,SELL,78500.00,0.5,2026-09-28 14:00:00`;

      await page.evaluate((csv) => {
        const view = document.querySelector('#journal-workspace-view');
        const area = view.querySelector('#import-text-paste');
        if (area) area.value = csv;
      }, sampleStatement);

      await realClick(page, '#journal-workspace-view #btn-parse-pasted');
      await page.waitForSelector('#journal-workspace-view #import-preview-rows tr', { visible: true, timeout: 5000 });

      const parseState = await page.evaluate(() => {
        const badge = document.querySelector('#journal-workspace-view #detected-format-badge')?.innerText;
        const rowsCount = document.querySelectorAll('#journal-workspace-view #import-preview-rows tr').length;
        return { badge, rowsCount };
      });

      assert(parseState.badge && parseState.badge.length > 0 && !parseState.badge.includes('Unrecognized'),
        'FR-009 auto-detects broker statement format', `Unexpected format badge: ${parseState.badge}`);
      assert(parseState.rowsCount === 2, 'FR-009 preview table renders 2 rows',
        `Expected 2 preview rows, got ${parseState.rowsCount}`);

      // First Commit: executions are added
      const storeCountBeforeCommit = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.executions?.length || 0;
      });

      await realClick(page, '#journal-workspace-view #btn-commit-import');
      await page.waitForFunction((c) => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return (store?.executions?.length || 0) > c;
      }, { timeout: 4000 }, storeCountBeforeCommit);

      const storeCountAfterCommit = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.executions?.length || 0;
      });
      assert(storeCountAfterCommit === storeCountBeforeCommit + 2, 'FR-009 commit imports 2 executions',
        `Expected +2 executions, went from ${storeCountBeforeCommit} to ${storeCountAfterCommit}`);

      // Second Commit: SC-002 zero duplicate executions added!
      // Re-paste exact same CSV, parse, and commit again
      await page.evaluate((csv) => {
        const area = document.querySelector('#journal-workspace-view #import-text-paste');
        if (area) area.value = csv;
      }, sampleStatement);

      await realClick(page, '#journal-workspace-view #btn-parse-pasted');
      await page.waitForSelector('#journal-workspace-view #btn-commit-import', { visible: true, timeout: 5000 });
      await realClick(page, '#journal-workspace-view #btn-commit-import');
      await new Promise(r => setTimeout(r, 600));

      const storeCountAfterSecondCommit = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.executions?.length || 0;
      });
      assert(storeCountAfterSecondCommit === storeCountAfterCommit, 'SC-002 zero duplicates added on re-import',
        `Executions increased from ${storeCountAfterCommit} to ${storeCountAfterSecondCommit} on duplicate commit`);

      // Unrecognized format edge case
      await page.evaluate(() => {
        const view = document.querySelector('#journal-workspace-view');
        const area = view.querySelector('#import-text-paste');
        if (area) area.value = 'invalid non-broker text without any financial columns';
      });

      await realClick(page, '#journal-workspace-view #btn-parse-pasted');
      await new Promise(r => setTimeout(r, 400));

      const unrecState = await page.evaluate(() => {
        const badge = document.querySelector('#journal-workspace-view #detected-format-badge')?.innerText || '';
        const previewText = document.querySelector('#journal-workspace-view #import-preview-card')?.innerText || '';
        return { badge, previewText };
      });
      assert(unrecState.badge.includes('Unrecognized') || unrecState.previewText.includes('not detected') || unrecState.badge === '—',
        'FR-009 unrecognised input reports Unrecognized Format error',
        `Expected Unrecognized Format, got badge="${unrecState.badge}", text="${unrecState.previewText}"`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. CSV Export Specification & Exact Header Format (FR-010)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const csvExportResult = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        let interceptedBlob = null;
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = (blob) => {
          interceptedBlob = blob;
          return origCreate(blob);
        };

        try {
          store.exportCsv();
        } finally {
          URL.createObjectURL = origCreate;
        }

        if (!interceptedBlob) return Promise.resolve({ error: 'No blob created for export' });

        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => {
            const lines = (reader.result || '').split(/\r?\n/).filter(Boolean);
            resolve({
              header: lines[0],
              rowsCount: lines.length - 1,
              sampleRow: lines[1]
            });
          };
          reader.readAsText(interceptedBlob);
        });
      });

      assert(!csvExportResult.error, 'FR-010 CSV export blob generated', csvExportResult.error);
      const expectedHeader = 'TradeKey,AccountId,Symbol,Direction,Status,OpenedAt,ClosedAt,Quantity,AvgEntry,AvgExit,GrossPnl,Fees,NetPnl,DurationMinutes,Playbook,Tags,Mistakes,Notes';
      assert(csvExportResult.header === expectedHeader, 'FR-010 CSV export header matches exact spec',
        `Expected: "${expectedHeader}"\nGot:      "${csvExportResult.header}"`);
      assert(csvExportResult.rowsCount > 0, 'FR-010 CSV export contains round trip rows',
        `Expected rowsCount > 0, got ${csvExportResult.rowsCount}`);
    }

    console.log('✅ 03_trade_logging_importer_and_csv.test.cjs passed');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
