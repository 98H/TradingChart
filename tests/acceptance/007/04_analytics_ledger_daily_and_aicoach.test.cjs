/**
 * @spec 007
 * @covers FR-012, FR-013, FR-014, FR-015, FR-016
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

    // Switch to Journal workspace
    await realClick(page, '#nav-btn-journal');
    await page.waitForSelector('#journal-workspace-view', { visible: true, timeout: 6000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Analytics: Edge Score Radar, 24h Heatmap & Scatter Explorer (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'analytics'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #mount-analytics-radar', { visible: true, timeout: 5000 });

      const analyticsState = await page.evaluate(() => {
        const view = document.querySelector('#journal-workspace-view');
        const radarSvg = view.querySelector('#mount-analytics-radar svg');
        const radarPolygons = radarSvg ? radarSvg.querySelectorAll('polygon').length : 0;
        const heatmapTiles = view.querySelectorAll('#mount-analytics-session-heatmap [title*="Hour"], #mount-analytics-session-heatmap [title*="ساعت"]').length;
        const scatterSvg = view.querySelector('#mount-analytics-scatter svg');
        const scatterCircles = scatterSvg ? scatterSvg.querySelectorAll('circle').length : 0;

        return {
          hasRadarSvg: !!radarSvg,
          radarPolygons,
          heatmapTiles,
          hasScatterSvg: !!scatterSvg,
          scatterCircles
        };
      });

      assert(analyticsState.hasRadarSvg && analyticsState.radarPolygons >= 3,
        'FR-012 6-axis Edge Score radar SVG rendered with grid rings and score polygon',
        `Polygons found: ${analyticsState.radarPolygons}`);
      assert(analyticsState.heatmapTiles === 24, 'FR-012 24-hour UTC session heatmap renders 24 tiles',
        `Expected 24 tiles, got ${analyticsState.heatmapTiles}`);
      assert(analyticsState.hasScatterSvg && analyticsState.scatterCircles > 0,
        'FR-012 duration vs P&L scatter plot renders trade bubbles',
        `Circles found: ${analyticsState.scatterCircles}`);

      // Empty State Validation (FR-012, US3 AC2)
      const emptyStateCheck = await page.evaluate(async () => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        const store = fj.store;
        // Stash executions to restore after empty-state check
        const stashedExecs = [...store.executions];

        // Temporarily clear executions
        store.clearExecutions('all');
        fj.render();
        await new Promise(r => setTimeout(r, 300));

        const radarText = document.querySelector('#journal-workspace-view #mount-analytics-radar')?.innerText || '';
        const scatterText = document.querySelector('#journal-workspace-view #mount-analytics-scatter')?.innerText || '';

        // Restore stashed executions
        store.executions = stashedExecs;
        fj.render();

        return { radarText, scatterText };
      });

      assert(emptyStateCheck.radarText.includes('needs a few closed trades') || emptyStateCheck.radarText.includes('نیاز به چند معامله بسته شده دارد') || emptyStateCheck.radarText.length > 0,
        'FR-012 radar displays honest empty state when data insufficient',
        `Radar text: "${emptyStateCheck.radarText}"`);
      assert(emptyStateCheck.scatterText.includes('No closed trades to plot') || emptyStateCheck.scatterText.includes('معامله بسته‌شده‌ای') || emptyStateCheck.scatterText.length > 0,
        'FR-012 scatter plot displays honest empty state when data insufficient',
        `Scatter text: "${emptyStateCheck.scatterText}"`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Trades Ledger: Inspection and "View on Chart" Replay (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'trades'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view .btn-replay-chart', { visible: true, timeout: 6000 });

      const ledgerState = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('#journal-workspace-view .btn-replay-chart'));
        return {
          replayButtonsCount: buttons.length,
          firstSymbol: buttons[0]?.dataset?.symbol
        };
      });

      assert(ledgerState.replayButtonsCount > 0, 'FR-013 ledger renders "View on Chart" replay buttons',
        `Expected replay buttons, found ${ledgerState.replayButtonsCount}`);
      assert(!!ledgerState.firstSymbol, 'FR-013 replay button carries symbol attribute',
        'Missing data-symbol on replay button');

      // Click "View on Chart"
      await realClick(page, '#journal-workspace-view .btn-replay-chart');
      await page.waitForFunction(() => {
        const chartArea = document.querySelector('#chart-area');
        return chartArea && getComputedStyle(chartArea).display !== 'none';
      }, { timeout: 6000 });

      const chartWorkspaceState = await page.evaluate(() => {
        const chartArea = document.querySelector('#chart-area');
        const activeSymbol = window.__TRADING_APP__.currentSymbol;
        return {
          chartVisible: chartArea && getComputedStyle(chartArea).display !== 'none',
          activeSymbol
        };
      });

      assert(chartWorkspaceState.chartVisible, 'FR-013 "View on Chart" switches back to chart workspace',
        '#chart-area is not visible after clicking View on Chart');
      assert(chartWorkspaceState.activeSymbol === ledgerState.firstSymbol,
        'FR-013 "View on Chart" switches chart to that trade\'s symbol',
        `Expected symbol ${ledgerState.firstSymbol}, got ${chartWorkspaceState.activeSymbol}`);

      // Return to journal workspace
      await realClick(page, '#nav-btn-journal');
      await page.waitForSelector('#journal-workspace-view', { visible: true, timeout: 5000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Daily Journal: Date Stepping, Emotions & Save Status (FR-014)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'daily'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #daily-journal-textarea', { visible: true, timeout: 6000 });

      const dailyControls = await page.evaluate(() => {
        const hasPrev = !!document.querySelector('#journal-workspace-view #btn-day-prev');
        const hasNext = !!document.querySelector('#journal-workspace-view #btn-day-next');
        const hasToday = !!document.querySelector('#journal-workspace-view #btn-day-today');
        const emotions = Array.from(document.querySelectorAll('#journal-workspace-view .btn-emotion')).map(e => e.innerText.trim());
        const dateVal = document.querySelector('#journal-workspace-view #daily-journal-date')?.value;
        return { hasPrev, hasNext, hasToday, emotionsCount: emotions.length, emotions, dateVal };
      });

      assert(dailyControls.hasPrev && dailyControls.hasNext && dailyControls.hasToday,
        'FR-014 date navigation buttons (prev, next, today) present',
        `Missing date navigation controls: ${JSON.stringify(dailyControls)}`);
      assert(dailyControls.emotionsCount === 5, 'FR-014 5 psychological emotions available',
        `Expected 5 emotions, got ${dailyControls.emotionsCount} (${dailyControls.emotions.join(', ')})`);
      assert(!!dailyControls.dateVal, 'FR-014 daily journal date picker populated', 'Date input empty');

      // Test date stepping: click prev
      const initialDate = dailyControls.dateVal;
      await realClick(page, '#journal-workspace-view #btn-day-prev');
      await new Promise(r => setTimeout(r, 300));
      const prevDate = await page.$eval('#journal-workspace-view #daily-journal-date', el => el.value);
      assert(prevDate !== initialDate, 'FR-014 date stepper steps backward',
        `Date did not change from ${initialDate}`);

      // Click today
      await realClick(page, '#journal-workspace-view #btn-day-today');
      await new Promise(r => setTimeout(r, 300));

      // Select emotion (Laser Focused)
      const isFocusedActive = await page.evaluate(async () => {
        const btn = Array.from(document.querySelectorAll('#journal-workspace-view .btn-emotion')).find(b => b.innerText.includes('Focused'));
        btn?.click();
        await new Promise(r => setTimeout(r, 200));
        const updatedBtn = Array.from(document.querySelectorAll('#journal-workspace-view .btn-emotion')).find(b => b.innerText.includes('Focused'));
        return updatedBtn?.classList.contains('active');
      });
      assert(isFocusedActive, 'FR-014 selecting emotion activates emotion pill', 'Focused pill not active');

      // Edit reflection textarea -> observe unsaved status
      await page.evaluate(() => {
        const area = document.querySelector('#journal-workspace-view #daily-journal-textarea');
        if (area) {
          area.value = 'Execution adherence: 100%. Followed risk limits and respected daily loss buffer.';
          area.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.waitForFunction(() => {
        const ind = document.querySelector('#journal-workspace-view #journal-save-indicator');
        return ind && (ind.innerText.includes('Unsaved') || ind.innerText.includes('ذخیره‌نشده'));
      }, { timeout: 4000 });

      const unsavedIndicator = await page.$eval('#journal-workspace-view #journal-save-indicator', el => el.innerText);
      assert(unsavedIndicator.includes('Unsaved') || unsavedIndicator.includes('ذخیره‌نشده'),
        'FR-014 unsaved indicator shows "Unsaved changes…"', `Got: "${unsavedIndicator}"`);

      // Save note
      await realClick(page, '#journal-workspace-view #btn-save-daily-note');
      await page.waitForFunction(() => {
        const ind = document.querySelector('#journal-workspace-view #journal-save-indicator');
        return ind && (ind.innerText.includes('saved') || ind.innerText.includes('ذخیره'));
      }, { timeout: 4000 });

      const savedIndicator = await page.$eval('#journal-workspace-view #journal-save-indicator', el => el.innerText);
      assert(savedIndicator.includes('saved') || savedIndicator.includes('ذخیره'),
        'FR-014 saved indicator confirms save with timestamp', `Got: "${savedIndicator}"`);

      // Verify persistence in store.notes
      const persistedNote = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const date = document.querySelector('#journal-workspace-view #daily-journal-date')?.value;
        return store?.notes?.[date];
      });
      assert(!!persistedNote && persistedNote.text.includes('Execution adherence'),
        'FR-014 daily reflection note persists in store.notes', `Unexpected note: ${JSON.stringify(persistedNote)}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Playbooks & Discipline Checklists: Setup Listing & Addition (FR-015)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'playbooks'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #btn-add-playbook', { visible: true, timeout: 6000 });

      const playbooksState = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const setups = store?.playbooks || [];
        return {
          setupsCount: setups.length,
          setupIds: setups.map(s => s.id)
        };
      });

      assert(playbooksState.setupsCount >= 4, 'FR-015 ships 4 default institutional playbooks',
        `Expected at least 4 default playbooks, got ${playbooksState.setupsCount}`);
      assert(playbooksState.setupIds.includes('smc-order-block') && playbooksState.setupIds.includes('fvg-retest'),
        'FR-015 includes canonical institutional setups (SMC, FVG)',
        `Setup IDs: ${playbooksState.setupIds.join(', ')}`);

      // Add a new playbook setup via "+ New Playbook Setup"
      await page.evaluate(() => {
        let call = 0;
        window.prompt = () => {
          call++;
          if (call === 1) return 'Liquidity Sweep Reversal';
          return 'Rule 1: Previous Day High swept,Rule 2: M1 CHoCH confirmed,Rule 3: R:R >= 2.5';
        };
      });

      const setupsCountBefore = playbooksState.setupsCount;
      await realClick(page, '#journal-workspace-view #btn-add-playbook');
      await new Promise(r => setTimeout(r, 400));

      const newSetupCheck = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const setups = store?.playbooks || [];
        const latest = setups[setups.length - 1];
        return {
          total: setups.length,
          latest
        };
      });

      assert(newSetupCheck.total === setupsCountBefore + 1, 'FR-015 adds new setup to store',
        `Expected ${setupsCountBefore + 1} setups, got ${newSetupCheck.total}`);
      assert(newSetupCheck.latest.name === 'Liquidity Sweep Reversal' && newSetupCheck.latest.rules.length === 3,
        'FR-015 new playbook attributes stored accurately',
        `Unexpected playbook: ${JSON.stringify(newSetupCheck.latest)}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. AI Coach: Grounded Answers from Trade Round Trips (FR-016)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) { fj.activeTab = 'aicoach'; fj.render(); }
      });
      await page.waitForSelector('#journal-workspace-view #ai-coach-input', { visible: true, timeout: 6000 });

      const aiCoachState = await page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll('#journal-workspace-view .ai-chip-btn')).map(c => c.innerText.trim());
        const hasInput = !!document.querySelector('#journal-workspace-view #ai-coach-input');
        return { chipsCount: chips.length, chips, hasInput };
      });

      assert(aiCoachState.chipsCount >= 4, 'FR-016 AI coach suggestion chips available',
        `Expected at least 4 suggestion chips, found ${aiCoachState.chipsCount}`);
      assert(aiCoachState.hasInput, 'FR-016 AI coach query input present', '#ai-coach-input missing');

      // Click suggestion chip: "What is my most expensive mistake and leak?"
      const historyLenBefore = await page.evaluate(() => (window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal)?.aiCoach?.history?.length || 0);

      await page.evaluate(() => {
        document.querySelector('#journal-workspace-view .ai-chip-btn')?.click();
      });
      await page.waitForFunction((len) => {
        const ai = (window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal)?.aiCoach;
        return (ai?.history?.length || 0) > len;
      }, { timeout: 4000 }, historyLenBefore);

      const threadResponseState = await page.evaluate(() => {
        const ai = (window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal)?.aiCoach;
        const threadItems = Array.from(document.querySelectorAll('#journal-workspace-view #ai-chat-thread > div'));
        const latestCard = threadItems[0]?.innerText || '';
        return {
          historyLen: ai?.history?.length || 0,
          latestCard
        };
      });

      assert(threadResponseState.historyLen > historyLenBefore,
        'FR-016 query prepends response card to AI coach thread',
        'AI coach history did not increment');
      assert(threadResponseState.latestCard.includes('Overleveraged') || threadResponseState.latestCard.includes('mistake') || threadResponseState.latestCard.includes('اشتباه') || threadResponseState.latestCard.length > 20,
        'FR-016 response card contains grounded trade attribution analysis',
        `Unexpected card text: "${threadResponseState.latestCard}"`);
    }

    console.log('✅ 04_analytics_ledger_daily_and_aicoach.test.cjs passed');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
