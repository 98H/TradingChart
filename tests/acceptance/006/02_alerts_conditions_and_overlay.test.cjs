/**
 * @spec 006
 * @covers FR-008, FR-009, FR-010, FR-011, FR-012, FR-019
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
    // 1. Alert Condition Evaluation Engine: All 11 Conditions (FR-008, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const evalResults = await page.evaluate(() => {
        const am = window.__TRADING_APP__.alertsManager;
        am.currentSymbol = 'TEST_SYM';
        am.alerts = [];

        // Helper to spawn test alert
        const createTestAlert = (dir, target, extra = {}) => {
          const id = 'test_' + dir;
          am.alerts.push({
            id,
            symbol: 'TEST_SYM',
            direction: dir,
            condition: dir,
            targetPrice: target,
            referencePrice: 100,
            active: true,
            triggered: false,
            channel: 'Sound & Popup',
            ...extra
          });
          return id;
        };

        // Arm all 11 conditions
        createTestAlert('greater_than', 105);
        createTestAlert('less_than', 95);
        createTestAlert('crossing_up', 105);
        createTestAlert('crossing_down', 95);
        createTestAlert('crossing', 105);
        createTestAlert('enter_channel', 110, { channelLow: 90, referencePrice: 85 });
        createTestAlert('exit_channel', 110, { channelLow: 90, referencePrice: 100 });
        createTestAlert('inside_channel', 110, { channelLow: 90 });
        createTestAlert('outside_channel', 110, { channelLow: 90 });
        createTestAlert('move_up_pct', 10);   // 10% above 100 = 110
        createTestAlert('move_down_pct', 10); // 10% below 100 = 90

        const testTick = (price) => {
          am.alerts.forEach(a => a.triggered = false);
          am.checkPrice('TEST_SYM', price);
          return am.alerts.filter(a => a.triggered).map(a => a.direction);
        };

        return {
          totalArmCount: am.alerts.length,
          at106: testTick(106),
          at94: testTick(94),
          at80: testTick(80),
          at100: testTick(100),
          at115: testTick(115)
        };
      });

      assert(evalResults.totalArmCount === 11, 'FR-008 11 alert conditions armed',
        `Expected 11 conditions, got ${evalResults.totalArmCount}`);
      assert(evalResults.at106.includes('greater_than'), 'FR-008 greater_than trigger at 106', 'Expected greater_than');
      assert(evalResults.at106.includes('crossing_up'), 'FR-008 crossing_up trigger at 106', 'Expected crossing_up');
      assert(evalResults.at106.includes('crossing'), 'FR-008 crossing trigger at 106', 'Expected crossing');
      assert(evalResults.at106.includes('inside_channel'), 'FR-008 inside_channel trigger at 106', 'Expected inside_channel');

      assert(evalResults.at94.includes('less_than'), 'FR-008 less_than trigger at 94', 'Expected less_than');
      assert(evalResults.at94.includes('crossing_down'), 'FR-008 crossing_down trigger at 94', 'Expected crossing_down');

      assert(evalResults.at80.includes('outside_channel'), 'FR-008 outside_channel trigger at 80', 'Expected outside_channel');
      assert(evalResults.at80.includes('exit_channel'), 'FR-008 exit_channel trigger at 80', 'Expected exit_channel');
      assert(evalResults.at80.includes('move_down_pct'), 'FR-008 move_down_pct trigger at 80', 'Expected move_down_pct');

      assert(evalResults.at115.includes('move_up_pct'), 'FR-008 move_up_pct trigger at 115', 'Expected move_up_pct');
      assert(evalResults.at100.includes('enter_channel'), 'FR-008 enter_channel trigger at 100', 'Expected enter_channel');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Alert Creation Form UI & Dynamic Field Labels (FR-008)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open alerts panel
      await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel?.('alerts', true));
      await page.waitForSelector('#btn-create-alert-toggle', { visible: true, timeout: 5000 });

      // Click "+ New Alert" button to display form
      await realClick(page, '#btn-create-alert-toggle');
      await page.waitForSelector('#new-alert-cond', { visible: true, timeout: 5000 });

      const conditionOptionsCount = await page.$$eval('#new-alert-cond option', els => els.length);
      assert(conditionOptionsCount === 11, 'FR-008 condition dropdown options count',
        `Expected 11 condition options, found ${conditionOptionsCount}`);

      // When channel condition is chosen -> channel-low appears and target labelled "Channel High"
      await page.select('#new-alert-cond', 'enter_channel');
      await page.waitForFunction(() => {
        const lowRow = document.querySelector('#alert-channel-low-row');
        return lowRow && window.getComputedStyle(lowRow).display !== 'none';
      }, { timeout: 4000 });

      const isChannelLowVisible = await page.$eval('#alert-channel-low-row', el => window.getComputedStyle(el).display !== 'none');
      assert(isChannelLowVisible, 'FR-008 channel-low row visibility', 'Expected channel-low row to be displayed');

      const highLabelText = await page.$eval('#alert-price-label', el => el.innerText.trim());
      assert(highLabelText.includes('Channel High') || highLabelText.includes('سقف'),
        'FR-008 channel target label', `Expected Channel High label, got "${highLabelText}"`);

      // When % condition is chosen -> channel-low hides and target labelled "Move %"
      await page.select('#new-alert-cond', 'move_up_pct');
      await page.waitForFunction(() => {
        const lowRow = document.querySelector('#alert-channel-low-row');
        return lowRow && window.getComputedStyle(lowRow).display === 'none';
      }, { timeout: 4000 });

      const pctLabelText = await page.$eval('#alert-price-label', el => el.innerText.trim());
      assert(pctLabelText.includes('Move %') || pctLabelText.includes('درصد'),
        'FR-008 move pct target label', `Expected Move % label, got "${pctLabelText}"`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Alert Lifecycle: Create, Pause, Resume, Delete, Tombstones (FR-009)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Reset alerts array to ensure headroom under plan quota
      await page.evaluate(() => {
        window.__TRADING_APP__.alertsManager.alerts = [];
      });

      // Create an alert via form
      await page.select('#new-alert-cond', 'greater_than');
      await page.evaluate(() => {
        const input = document.querySelector('#new-alert-price');
        input.value = '98500';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await realClick(page, '#btn-new-alert-save');
      await page.waitForFunction(() => {
        const alerts = window.__TRADING_APP__.alertsManager?.alerts || [];
        return alerts.some(a => Number(a.targetPrice) === 98500);
      }, { timeout: 5000 });

      const createdAlert = await page.evaluate(() => {
        return window.__TRADING_APP__.alertsManager.alerts.find(a => Number(a.targetPrice) === 98500);
      });
      assert(!!createdAlert, 'FR-009 alert created via UI form', 'Created alert not found in alertsManager');
      assert(createdAlert.active === true, 'FR-009 initial active true', 'Expected alert to be active');

      // Toggle pause
      await page.evaluate((id) => {
        const btn = Array.from(document.querySelectorAll('.toggle-alert-btn')).find(b => b.closest(`[data-id="${id}"]`));
        if (btn) btn.click();
      }, createdAlert.id);

      await page.waitForFunction((id) => {
        const a = window.__TRADING_APP__.alertsManager.alerts.find(x => x.id === id);
        return a && a.active === false;
      }, { timeout: 4000 }, createdAlert.id);

      const isPaused = await page.evaluate((id) => {
        return window.__TRADING_APP__.alertsManager.alerts.find(x => x.id === id)?.active === false;
      }, createdAlert.id);
      assert(isPaused, 'FR-009 pause alert', 'Alert active should be false after pause toggle');

      // Delete alert and verify tombstone in localStorage
      await page.evaluate(() => localStorage.removeItem('tradingchart_alerts_deleted'));
      await page.evaluate((id) => {
        window.__TRADING_APP__.alertsManager.deleteAlert(id);
      }, createdAlert.id);

      const hasDeletedTombstone = await page.evaluate((id) => {
        const deletedMap = JSON.parse(localStorage.getItem('tradingchart_alerts_deleted') || '{}');
        const inAlerts = window.__TRADING_APP__.alertsManager.alerts.some(a => a.id === id);
        return !inAlerts && !!deletedMap[id];
      }, createdAlert.id);
      assert(hasDeletedTombstone, 'FR-009 alert deletion tombstone recorded',
        'Expected alert deletion to record millisecond tombstone in localStorage');

      // Context menu quick-alert creation
      const ctxAlertAdded = await page.evaluate(() => {
        const before = window.__TRADING_APP__.alertsManager.alerts.length;
        window.__TRADING_APP__.alertsManager.addAlert(75432, 'greater_than');
        const after = window.__TRADING_APP__.alertsManager.alerts.length;
        return after > before;
      });
      assert(ctxAlertAdded, 'FR-009 context menu quick alert creation', 'Expected addAlert to append alert');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Plan Limit Gating (FR-010, SC-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Basic plan quota for priceAlerts is 3
      const quotaEnforcement = await page.evaluate(() => {
        const am = window.__TRADING_APP__.alertsManager;
        am.alerts = [
          { id: 'q1', symbol: 'BTCUSDT', targetPrice: 100, active: true },
          { id: 'q2', symbol: 'BTCUSDT', targetPrice: 200, active: true },
          { id: 'q3', symbol: 'BTCUSDT', targetPrice: 300, active: true }
        ];
        // Attempting to add 4th alert on Basic plan
        const res = am.addAlert(400, 'greater_than');
        const alertCount = am.alerts.length;
        const toast = document.querySelector('#toast-container')?.innerText || '';
        return { res, alertCount, toast };
      });

      assert(quotaEnforcement.res === null, 'FR-010 client addAlert returns null on quota exceed',
        `Expected null return from addAlert on exceeded quota, got ${quotaEnforcement.res}`);
      assert(quotaEnforcement.alertCount === 3, 'FR-010 alerts array not mutated beyond quota',
        `Expected 3 alerts to remain, got ${quotaEnforcement.alertCount}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Canvas Price Lines and Off-Scale Pinned Indicators (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const overlayState = await page.evaluate(async () => {
        const am = window.__TRADING_APP__.alertsManager;
        const overlay = window.__TRADING_APP__.chartAlertsOverlay;
        const curPrice = window.__TRADING_APP__.currentPrice || 80000;
        am.alerts = [];

        // 1. Within visible pane
        am.addAlert(curPrice, 'greater_than');
        // 2. Far above visible scale -> should pin to top with ▲
        am.addAlert(9999999, 'greater_than');
        // 3. Far below visible scale -> should pin to bottom with ▼
        am.addAlert(0.01, 'less_than');

        overlay.reproject();
        await new Promise(r => setTimeout(r, 400));

        const lineCount = document.querySelectorAll('.canvas-alert-line').length;
        const badgeCount = document.querySelectorAll('.canvas-alert-badge').length;
        const pinnedTop = document.querySelectorAll('.canvas-alert-pinned-top').length;
        const pinnedBottom = document.querySelectorAll('.canvas-alert-pinned-bottom').length;
        const deletePills = document.querySelectorAll('.btn-delete-alert-pill').length;

        // Click delete pill on pinned top indicator
        const topPillDel = document.querySelector('.canvas-alert-pinned-top .btn-delete-alert-pill');
        if (topPillDel) topPillDel.click();

        return {
          lineCount,
          badgeCount,
          pinnedTop,
          pinnedBottom,
          deletePills,
          alertsAfterDelete: am.alerts.length
        };
      });

      assert(overlayState.lineCount >= 1, 'FR-011 canvas alert line rendered', 'Expected at least 1 .canvas-alert-line');
      assert(overlayState.badgeCount >= 1, 'FR-011 canvas alert badge rendered', 'Expected at least 1 .canvas-alert-badge');
      assert(overlayState.pinnedTop === 1, 'FR-011 pinned top badge with ▲ rendered', 'Expected 1 pinned top badge');
      assert(overlayState.pinnedBottom === 1, 'FR-011 pinned bottom badge with ▼ rendered', 'Expected 1 pinned bottom badge');
      assert(overlayState.deletePills >= 3, 'FR-011 delete pill controls on badges', 'Missing delete pill controls');
      assert(overlayState.alertsAfterDelete === 2, 'FR-011 delete pill removes alert', 'Expected alert count to decrease by 1');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Trigger Dispatch & Notification (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const triggerResult = await page.evaluate(() => {
        const am = window.__TRADING_APP__.alertsManager;
        am.currentSymbol = 'BTCUSDT';
        am.alerts = [];

        am.alerts.push({
          id: 'trig_test_1',
          symbol: 'BTCUSDT',
          targetPrice: 80000,
          direction: 'greater_than',
          condition: 'greater_than',
          referencePrice: 75000,
          active: true,
          triggered: false,
          channel: 'Sound & Popup'
        });

        // Price at 79000 -> not triggered
        am.checkPrice('BTCUSDT', 79000);
        const trigBefore = am.alerts[0].triggered;

        // Price crosses to 81000 -> triggered
        am.checkPrice('BTCUSDT', 81000);
        const trigAfter = am.alerts[0].triggered;

        return { trigBefore, trigAfter };
      });

      assert(triggerResult.trigBefore === false, 'FR-012 alert untriggered below threshold', 'Alert should not trigger early');
      assert(triggerResult.trigAfter === true, 'FR-012 alert triggered above threshold', 'Alert should trigger at 81000');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Persian / English Bilingual Parity (FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch language to Persian
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const faLabels = await page.evaluate(() => {
        const am = window.__TRADING_APP__.alertsManager;
        am.openCreateAlert();
        const options = Array.from(document.querySelectorAll('#new-alert-cond option')).map(o => o.innerText);
        const hasPersianOptions = options.some(t => /[\u0600-\u06FF]/.test(t));
        const saveBtnText = document.querySelector('#btn-new-alert-save')?.innerText || '';
        return { hasPersianOptions, saveBtnText };
      });

      assert(faLabels.hasPersianOptions, 'FR-019 Persian condition translations', 'Condition options missing Persian text');
      assert(/[\u0600-\u06FF]/.test(faLabels.saveBtnText), 'FR-019 Persian save button label',
        `Expected Persian characters in save button, got "${faLabels.saveBtnText}"`);

      // Switch back to English
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });
    }

    console.log('PASS: 006 [Alert Conditions, Canvas Overlay & Quotas]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}\n${err.stack}`);
  process.exit(1);
});
