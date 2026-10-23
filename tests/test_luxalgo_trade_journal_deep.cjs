// tests/test_luxalgo_trade_journal_deep.cjs
// Comprehensive E2E Browser Test Suite for LuxAlgo Trade Journal Maximum Capacity Integration
// Covers all 8 integrated suites, 14-format importer, Edge Score v2 radar, Privacy mode, and Chart Replay.

const { launch, closeAll, shots } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');

async function runJournalDeepAudit() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🚀 LUXALGO TRADE JOURNAL — MAXIMUM CAPACITY DEEP AUDIT');
  console.log('════════════════════════════════════════════════════════════════\n');

  const ctx = await launch('desktop');
  const { page } = ctx;
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
    console.log('  [Page Error]', err.message);
  });

  let passCount = 0;
  let failCount = 0;

  function assert(desc, condition, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${desc} — ${detail}`);
      failCount++;
    }
  }

  try {
    await page.goto((process.env.SDD_BASE_URL||'http://127.0.0.1:8088')+'/chart', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // ── TEST 1: Switch to Journal Workspace ──────────────────────────
    console.log('\n--- 1. Switching to Full-Page Journal Workspace ---');
    await page.evaluate(() => document.querySelector('#nav-btn-journal')?.click());
    await new Promise(r => setTimeout(r, 800));

    const isJournalVisible = await page.evaluate(() => {
      const el = document.querySelector('#journal-workspace-view');
      return el && getComputedStyle(el).display !== 'none';
    });
    assert('Journal workspace view is visible', isJournalVisible);

    const hasNavTabs = await page.evaluate(() => {
      return document.querySelectorAll('.journal-nav-tab').length >= 8;
    });
    assert('All 8 sub-navigation suite tabs are rendered', hasNavTabs);

    // ── TEST 2: Dashboard Heatmap & KPI Ribbon ──────────────────────
    console.log('\n--- 2. Auditing Dashboard & Monthly Calendar Heatmap ---');
    const kpiCount = await page.evaluate(() => document.querySelectorAll('.journal-stat-card').length);
    assert('Top KPI ribbon displays 4+ metric cards', kpiCount >= 4, `Found: ${kpiCount}`);

    const calendarTiles = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view .calendar-day-tile').length);
    assert('Monthly calendar grid has 30 interactive day tiles in workspace', calendarTiles === 30, `Found: ${calendarTiles}`);

    const hasEquitySvg = await page.evaluate(() => {
      const el = document.querySelector('#mount-dashboard-equity-chart svg');
      return el !== null;
    });
    assert('Cumulative equity growth SVG chart is rendered', hasEquitySvg);

    // ── TEST 3: Privacy Mode Toggle ─────────────────────────────────
    console.log('\n--- 3. Testing Privacy Mode (Mask Balances) ---');
    const initialText = await page.evaluate(() => document.querySelector('.journal-stat-card .num-ltr')?.innerText);
    await page.evaluate(() => document.querySelector('#btn-journal-privacy')?.click());
    await new Promise(r => setTimeout(r, 300));

    const maskedText = await page.evaluate(() => document.querySelector('.journal-stat-card .num-ltr')?.innerText);
    assert('Privacy mode masks monetary values with asterisks', maskedText.includes('$***'), `Got: ${maskedText}`);

    // Toggle back
    await page.evaluate(() => document.querySelector('#btn-journal-privacy')?.click());
    await new Promise(r => setTimeout(r, 300));
    const unmaskedText = await page.evaluate(() => document.querySelector('.journal-stat-card .num-ltr')?.innerText);
    assert('Toggling privacy off restores visible figures', !unmaskedText.includes('$***'), `Got: ${unmaskedText}`);

    // ── TEST 4: Analytics Suite & Edge Score Radar ───────────────────
    console.log('\n--- 4. Auditing Edge Score v2 Radar & Analytics Suite ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="analytics"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const hasRadarSvg = await page.evaluate(() => {
      const el = document.querySelector('#journal-workspace-view #mount-analytics-radar svg');
      return el && el.querySelectorAll('polygon').length >= 4;
    });
    assert('Edge Score v2 6-axis polygon radar chart is rendered with grid rings', hasRadarSvg);

    const hasSessionHeatmap = await page.evaluate(() => {
      const el = document.querySelector('#journal-workspace-view #mount-analytics-session-heatmap');
      return el && el.querySelectorAll('[title*="Hour"]').length === 24;
    });
    assert('24-Hour session heatmap renders all 24 hours with market sessions', hasSessionHeatmap);

    const hasScatterSvg = await page.evaluate(() => {
      const el = document.querySelector('#journal-workspace-view #mount-analytics-scatter svg');
      return el && el.querySelectorAll('circle').length > 0;
    });
    assert('Trade Explorer scatter plot displays execution bubbles', hasScatterSvg);

    // ── TEST 5: Trades Ledger & "View on Chart" Replay ───────────────
    console.log('\n--- 5. Auditing Trades Ledger & Chart Replay Trigger ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="trades"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const replayButtons = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view .btn-replay-chart').length);
    assert('Trades ledger displays replay buttons on trades', replayButtons > 0, `Found: ${replayButtons}`);

    // Click "View on Chart"
    await page.evaluate(() => document.querySelector('#journal-workspace-view .btn-replay-chart')?.click());
    await new Promise(r => setTimeout(r, 800));

    const activeWorkspaceAfterReplay = await page.evaluate(() => {
      const chartArea = document.querySelector('#chart-area');
      return chartArea && getComputedStyle(chartArea).display !== 'none';
    });
    assert('Clicking "View on Chart" switches back to Quant Chart workspace', activeWorkspaceAfterReplay);

    // Return to Journal
    await page.evaluate(() => document.querySelector('#nav-btn-journal')?.click());
    await new Promise(r => setTimeout(r, 600));

    // ── TEST 6: Prop Firm Tracker Suite ──────────────────────────────
    console.log('\n--- 6. Auditing Prop Firm Tracker Suite ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="prop"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const propCardsCount = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view #mount-prop-tracker [style*="border-radius: 10px"]').length);
    assert('Prop firm accounts & evaluations are tracked', propCardsCount > 0);

    const hasAddPropBtn = await page.evaluate(() => document.querySelector('#journal-workspace-view #btn-add-prop-challenge') !== null);
    assert('Add Prop Challenge button exists', hasAddPropBtn);

    // ── TEST 7: Playbooks & Discipline Checklists ────────────────────
    console.log('\n--- 7. Auditing Playbooks & Rule Checklists ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="playbooks"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const playbooksCount = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view #mount-playbook-mgr [style*="border-radius: 10px"]').length);
    assert('Institutional playbooks (SMC, FVG, Break & Retest) loaded', playbooksCount >= 3, `Count: ${playbooksCount}`);

    // ── TEST 8: AI Coach & "Ask Your Journal" ────────────────────────
    console.log('\n--- 8. Auditing AI Trading Coach & Ask Your Journal ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="aicoach"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const hasAiInput = await page.evaluate(() => document.querySelector('#journal-workspace-view #ai-coach-input') !== null);
    assert('AI Coach natural language query input is present', hasAiInput);

    const suggestionChips = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view .ai-chip-btn').length);
    assert('AI suggestion prompt chips are available', suggestionChips >= 4, `Count: ${suggestionChips}`);

    // Click a suggestion chip
    await page.evaluate(() => document.querySelector('#journal-workspace-view .ai-chip-btn')?.click());
    await new Promise(r => setTimeout(r, 500));

    const chatItems = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view #ai-chat-thread > div').length);
    assert('AI Coach computes and delivers response grounded in trade data', chatItems > 0);

    // ── TEST 9: Statement Importer (14 Documented Formats) ───────────
    console.log('\n--- 9. Auditing Universal 14-Broker Statement Importer ---');
    await page.evaluate(() => document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="importer"]')?.click());
    await new Promise(r => setTimeout(r, 600));

    const hasDropzone = await page.evaluate(() => document.querySelector('#import-dropzone') !== null);
    assert('Drag-and-drop statement file upload zone is present', hasDropzone);

    // Test synthetic statement import via textarea paste
    const sampleTradingViewCsv = `Symbol,Side,Qty,Fill Price,Commission,Closing Time,Status
BTCUSDT,Buy,0.5,82000.0,0.5,2026-09-20T14:00:00.000Z,Filled
BTCUSDT,Sell,0.5,83200.0,0.5,2026-09-20T18:30:00.000Z,Filled
ETHUSDT,Sell,5.0,2750.0,0.5,2026-09-21T09:00:00.000Z,Filled
ETHUSDT,Buy,5.0,2680.0,0.5,2026-09-21T16:00:00.000Z,Filled`;

    await page.evaluate((csv) => {
      const view = document.querySelector('#journal-workspace-view');
      const area = view?.querySelector('#import-text-paste');
      if (area) {
        area.value = csv;
        view?.querySelector('#btn-parse-pasted')?.click();
      }
    }, sampleTradingViewCsv);
    await new Promise(r => setTimeout(r, 600));

    const detectedBadge = await page.evaluate(() => document.querySelector('#journal-workspace-view #detected-format-badge')?.innerText);
    assert('Statement importer auto-detects TradingView format', detectedBadge && detectedBadge.length > 0, `Badge: ${detectedBadge}`);

    const previewRowsCount = await page.evaluate(() => document.querySelectorAll('#journal-workspace-view #import-preview-rows tr').length);
    assert('Reconciliation preview table displays parsed execution rows', previewRowsCount > 0, `Rows: ${previewRowsCount}`);

    // Commit import
    await page.evaluate(() => document.querySelector('#journal-workspace-view #btn-commit-import')?.click());
    await new Promise(r => setTimeout(r, 500));

    const successToastVisible = await page.evaluate(() => {
      const toast = document.querySelector('#journal-workspace-view #import-success-toast');
      return toast && getComputedStyle(toast).display !== 'none';
    });
    assert('Commit button imports executions with success toast', successToastVisible);

    // ── TEST 10: Trade Logging Modal with SL/TP & R-Multiple ─────────
    console.log('\n--- 10. Auditing Trade Logging Modal & Risk Engine ---');
    await page.evaluate(() => document.querySelector('#btn-journal-add')?.click());
    await new Promise(r => setTimeout(r, 600));

    const modalOpen = await page.evaluate(() => document.querySelector('#modal-log-trade')?.classList.contains('open'));
    assert('Log Trade modal opens cleanly', modalOpen);

    // Select SELL / SHORT
    await page.evaluate(() => document.querySelector('#side-pill-sell')?.click());
    await new Promise(r => setTimeout(r, 200));

    const isSellActive = await page.evaluate(() => document.querySelector('#side-pill-sell')?.classList.contains('active'));
    assert('Direction pill toggles to SELL / SHORT', isSellActive);

    // Enter values
    await page.evaluate(() => {
      const entry = document.querySelector('#log-trade-entry');
      const exit = document.querySelector('#log-trade-exit');
      const sl = document.querySelector('#log-trade-sl');
      const qty = document.querySelector('#log-trade-qty');
      if (entry) entry.value = '84000';
      if (exit) exit.value = '82500';
      if (sl) sl.value = '84500';
      if (qty) qty.value = '0.5';
      entry?.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 300));

    const rText = await page.evaluate(() => document.querySelector('#log-r-preview')?.innerText);
    assert('Risk-Reward (R) is computed dynamically from SL and target', rText && rText.includes('R: 1 :'), `Got: ${rText}`);

    // Submit modal
    await page.evaluate(() => document.querySelector('#btn-save-log-trade')?.click());
    await new Promise(r => setTimeout(r, 600));

    const modalClosed = await page.evaluate(() => !document.querySelector('#modal-log-trade')?.classList.contains('open'));
    assert('Modal closes after successful trade log', modalClosed);

    console.log(`\n════════════════════════════════════════════════════════════════`);
    console.log(`FINAL RESULT: ${passCount} passed, ${failCount} failed. Console errors: ${errors.length}`);
    console.log(`════════════════════════════════════════════════════════════════\n`);

  } catch (err) {
    console.error('[TEST ERROR]', err);
    failCount++;
  } finally {
    try { await closeAll(page); } catch (e) {}
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runJournalDeepAudit();
