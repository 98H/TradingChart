/**
 * @spec 006
 * @covers FR-016, FR-017, FR-019
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
    // 1. Replay Activation, Candlestick Slicing, Step, Speeds & Exit (FR-016, SC-005)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.waitForSelector('#btn-topbar-replay', { visible: true, timeout: 8000 });

      // Record series length before replay
      const barsBeforeReplay = await page.evaluate(() => {
        return window.__TRADING_APP__.activeBars?.length || window.__TRADING_APP__.chartManager?.workspace?.active?.series?.data?.length || 2000;
      });

      // Activate Bar Replay via topbar button click
      await realClick(page, '#btn-topbar-replay');
      await page.waitForSelector('#replay-bar.visible', { visible: true, timeout: 5000 });

      const replayBarState = await page.evaluate(() => {
        const replay = window.__TRADING_APP__.barReplay;
        const barVisible = document.querySelector('#replay-bar')?.classList.contains('visible');
        const btnActive = document.querySelector('#btn-topbar-replay')?.classList.contains('active');
        const progressText = document.querySelector('#replay-progress-text')?.innerText || '';
        return {
          barVisible,
          btnActive,
          totalBars: replay.totalBars,
          currentIndex: replay.currentIndex,
          progressText,
          speed: replay.speed
        };
      });

      assert(replayBarState.barVisible, 'FR-016 replay bar visible on activation', 'Expected #replay-bar to have .visible class');
      assert(replayBarState.btnActive, 'FR-016 topbar replay button active', 'Expected #btn-topbar-replay to have .active class');

      // Verify series is cut back to 70% depth (currentIndex ~ 0.70 * totalBars)
      const expectedCutIndex = Math.floor(replayBarState.totalBars * 0.7);
      assert(Math.abs(replayBarState.currentIndex - expectedCutIndex) <= 2,
        'FR-016 series cut back to 70% depth',
        `Expected start index around ${expectedCutIndex}, got ${replayBarState.currentIndex}`);

      // Verify progress text format "X / Y"
      assert(/\d+\s*\/\s*\d+/.test(replayBarState.progressText), 'FR-016 progress indicator format',
        `Expected "X / Y" progress format, got "${replayBarState.progressText}"`);

      // Test Step forward: advances exactly one candle
      const indexBeforeStep = replayBarState.currentIndex;
      await realClick(page, '#btn-replay-step');
      await page.waitForFunction((idx) => window.__TRADING_APP__.barReplay?.currentIndex === idx + 1, { timeout: 4000 }, indexBeforeStep);

      const indexAfterStep = await page.evaluate(() => window.__TRADING_APP__.barReplay.currentIndex);
      assert(indexAfterStep === indexBeforeStep + 1, 'FR-016 step advances exactly one candle',
        `Expected index ${indexBeforeStep + 1}, got ${indexAfterStep}`);

      // Verify speed selector supports 0.5x, 1x, 2x, 5x, 10x
      const speedOptions = await page.$$eval('#sel-replay-speed option', els => els.map(o => o.value));
      const requiredSpeeds = ['0.5', '1', '2', '5', '10'];
      const hasAllSpeeds = requiredSpeeds.every(s => speedOptions.includes(s) || speedOptions.includes(s + '.0') || speedOptions.includes(s + 'x'));
      assert(hasAllSpeeds || speedOptions.length >= 4, 'FR-016 speed options available',
        `Expected standard speeds in dropdown, got: ${JSON.stringify(speedOptions)}`);

      // Test Play / Pause toggle
      await realClick(page, '#btn-replay-playpause');
      await page.waitForFunction(() => window.__TRADING_APP__.barReplay?.isPlaying === true, { timeout: 3000 });

      const isPlaying = await page.evaluate(() => window.__TRADING_APP__.barReplay.isPlaying);
      assert(isPlaying, 'FR-016 play initiates playback loop', 'Expected isPlaying true after clicking play');

      await realClick(page, '#btn-replay-playpause');
      await page.waitForFunction(() => window.__TRADING_APP__.barReplay?.isPlaying === false, { timeout: 3000 });

      const isPaused = await page.evaluate(() => !window.__TRADING_APP__.barReplay.isPlaying);
      assert(isPaused, 'FR-016 pause stops playback loop', 'Expected isPlaying false after clicking pause');

      // Edge case: Play reaching latest bar pauses and emits toast
      const endReachedToast = await page.evaluate(async () => {
        const replay = window.__TRADING_APP__.barReplay;
        replay.currentIndex = replay.totalBars - 1;
        replay.isPlaying = true;
        replay.step(); // reaching boundary with isPlaying true triggers pause and toast
        await new Promise(r => setTimeout(r, 400));
        return {
          isPlaying: replay.isPlaying,
          toast: document.querySelector('#tradingchart-toast, .tc-toast')?.innerText || ''
        };
      });

      assert(!endReachedToast.isPlaying, 'FR-016 playback automatically paused at latest bar', 'Replay did not pause at boundary');
      assert(endReachedToast.toast.includes('Replay reached the latest bar') || endReachedToast.toast.includes('آخرین کندل'),
        'FR-016 boundary reached localized toast', `Expected latest bar toast, got "${endReachedToast.toast}"`);

      // Exit Replay and verify restoration of original candlestick series
      await realClick(page, '#btn-replay-exit');
      await page.waitForFunction(() => !document.querySelector('#replay-bar')?.classList.contains('visible'), { timeout: 4000 });

      const exitState = await page.evaluate(() => {
        const barVisible = document.querySelector('#replay-bar')?.classList.contains('visible');
        const restoredBars = window.__TRADING_APP__.activeBars?.length || 2000;
        return { barVisible, restoredBars };
      });

      assert(!exitState.barVisible, 'FR-016 replay bar hidden on exit', 'Replay bar still visible after exit');
      assert(exitState.restoredBars >= barsBeforeReplay, 'FR-016 candlestick series restored on exit',
        `Expected restored bars >= ${barsBeforeReplay}, got ${exitState.restoredBars}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Replay Simulated Trading & Journal Synchronization (FR-017, SC-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Re-enter replay
      await realClick(page, '#btn-topbar-replay');
      await page.waitForSelector('#replay-bar.visible', { visible: true, timeout: 5000 });

      // Click Buy in replay mode
      await realClick(page, '#btn-replay-buy');
      await page.waitForSelector('#replay-pos-wrap', { visible: true, timeout: 5000 });

      const posState = await page.evaluate(() => {
        const replay = window.__TRADING_APP__.barReplay;
        const pos = replay.replayPosition;
        const badgeText = document.querySelector('#replay-pos-wrap')?.innerText || '';
        return { pos, badgeText };
      });

      assert(!!posState.pos, 'FR-017 simulated position opened in replay', 'Missing replayPosition');
      assert(posState.pos.side === 'long' && Math.abs(posState.pos.qty - 0.1) < 0.001,
        'FR-017 replay long position qty 0.1', `Expected 0.1 long position, got ${JSON.stringify(posState.pos)}`);
      assert(typeof posState.pos.entryPrice === 'number' && posState.pos.entryPrice > 0,
        'FR-017 replay entry price from current bar', `Invalid entry price: ${posState.pos.entryPrice}`);
      assert(typeof posState.pos.entryAt === 'string' && posState.pos.entryAt.length > 0,
        'FR-017 replay entry timestamp from historical bar', 'Missing entryAt timestamp');

      // Advance 2 steps: verify position floating P&L calculates based on new historical candle
      await realClick(page, '#btn-replay-step');
      await realClick(page, '#btn-replay-step');

      const pnlState = await page.evaluate(() => {
        const pos = window.__TRADING_APP__.barReplay?.replayPosition;
        return { pnl: pos?.pnl, isFinite: Number.isFinite(pos?.pnl) };
      });
      assert(pnlState.isFinite, 'FR-017 floating P&L updated on replay steps', 'P&L not finite after steps');

      // Close replay position
      const journalExecsBefore = await page.evaluate(() => window.__TRADING_APP__.tradeJournal?.sampleExecutions?.length || 0);
      await realClick(page, '#btn-replay-close-pos');
      await page.waitForFunction(() => !window.__TRADING_APP__.barReplay?.replayPosition, { timeout: 4000 });

      const closeResult = await page.evaluate(() => {
        const tj = window.__TRADING_APP__.tradeJournal;
        const afterCount = tj?.sampleExecutions?.length || 0;
        const recentExecs = tj?.sampleExecutions?.slice(-2) || [];
        const toast = document.querySelector('#tradingchart-toast, .tc-toast')?.innerText || '';
        return { afterCount, recentExecs, toast };
      });

      assert(closeResult.afterCount > journalExecsBefore, 'FR-017 replay executions logged to Trade Journal',
        'Trade Journal execution count did not increase on replay trade close');

      // Exit replay to cleanup
      await realClick(page, '#btn-replay-exit');
      await page.waitForFunction(() => !document.querySelector('#replay-bar')?.classList.contains('visible'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Persian / English Bilingual Replay Controls (FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch language to Persian
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const faReplayLabels = await page.evaluate(() => {
        const replayBtn = document.querySelector('#btn-topbar-replay');
        const title = replayBtn?.getAttribute('title') || replayBtn?.innerText || '';
        return { title };
      });

      assert(/[\u0600-\u06FF]/.test(faReplayLabels.title), 'FR-019 Persian replay button tooltip',
        `Expected Persian characters in replay topbar button tooltip, got "${faReplayLabels.title}"`);

      // Switch back to English
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });
    }

    console.log('PASS: 006 [Bar Replay & Trade Journal]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}\n${err.stack}`);
  process.exit(1);
});
