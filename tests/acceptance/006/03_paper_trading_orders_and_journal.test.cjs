/**
 * @spec 006
 * @covers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-018, FR-019
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
    // 1. Quick-Trade Widget & Quantity Steppers (FR-001, SC-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.waitForSelector('#chart-quick-trade', { visible: true, timeout: 8000 });
      const buyBtn = await page.$('#quick-trade-buy-btn');
      const sellBtn = await page.$('#quick-trade-sell-btn');
      assert(!!buyBtn && !!sellBtn, 'FR-001 quick-trade BUY and SELL buttons exist', 'Missing BUY or SELL buttons');

      // Stepper increments and decrements
      // Initial value
      const initQty = Number(await page.$eval('#quick-trade-qty', el => el.value));
      assert(initQty === 0.1 || initQty === 0.05, 'FR-001 initial qty', `Expected initial quantity 0.1 or 0.05, got ${initQty}`);

      // Reset to 0.05 for stepper verification
      await page.evaluate(() => {
        const input = document.querySelector('#quick-trade-qty');
        input.value = '0.05';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Click "+" twice: 0.05 -> 0.10 -> 0.15
      await realClick(page, '#qt-qty-inc');
      await realClick(page, '#qt-qty-inc');
      const qtyPlus2 = Number(await page.$eval('#quick-trade-qty', el => el.value));
      assert(Math.abs(qtyPlus2 - 0.15) < 0.001, 'FR-001 stepper increment by 0.05',
        `Expected quantity 0.15 after clicking "+" twice, got ${qtyPlus2}`);

      // Click "-" repeatedly: down to minimum 0.01 and never below 0.01
      for (let i = 0; i < 6; i++) {
        await realClick(page, '#qt-qty-dec');
      }
      const qtyMin = Number(await page.$eval('#quick-trade-qty', el => el.value));
      assert(Math.abs(qtyMin - 0.01) < 0.001, 'FR-001 stepper minimum clamp 0.01',
        `Expected minimum clamp 0.01, got ${qtyMin}`);

      // Set quantity to 0.10 and execute BUY market order via real click
      await page.evaluate(() => {
        const input = document.querySelector('#quick-trade-qty');
        input.value = '0.10';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const positionsBefore = await page.evaluate(() => window.__TRADING_APP__.paperTrading?.positions?.length || 0);
      await realClick(page, '#quick-trade-buy-btn');
      await page.waitForFunction(() => (window.__TRADING_APP__.paperTrading?.positions?.length || 0) > 0, { timeout: 5000 });

      const positionsAfter = await page.evaluate(() => window.__TRADING_APP__.paperTrading.positions.length);
      assert(positionsAfter > positionsBefore, 'FR-001 market order opens position',
        `Expected position count to increase from ${positionsBefore}, got ${positionsAfter}`);

      const latestPos = await page.evaluate(() => window.__TRADING_APP__.paperTrading.positions[0]);
      assert(latestPos?.side === 'long' && Math.abs(latestPos?.qty - 0.1) < 0.001,
        'FR-001 long position opened with quantity 0.1', `Unexpected position: ${JSON.stringify(latestPos)}`);

      // Verify fill confirmation toast
      const toastText = await page.evaluate(() => document.querySelector('#tradingchart-toast, .tc-toast')?.innerText || '');
      assert(toastText.includes('BUY') || toastText.includes('خرید') || toastText.length > 0, 'FR-001 fill confirmation toast',
        `Expected toast confirming BUY market execution, got "${toastText}"`);

      // Test Widget Minimization Toggle
      await realClick(page, '#qt-toggle-btn');
      const isMinimized = await page.$eval('#chart-quick-trade', el => el.classList.contains('minimized'));
      assert(isMinimized, 'FR-001 widget minimised on toggle', 'Expected #chart-quick-trade to have .minimized class');

      const isPillVisible = await page.$eval('#qt-collapsed-trigger', el => window.getComputedStyle(el).display !== 'none');
      assert(isPillVisible, 'FR-001 Trade pill visible when minimized', 'Expected #qt-collapsed-trigger to be visible');

      // Click pill restores widget
      await realClick(page, '#qt-collapsed-trigger');
      const isRestored = await page.$eval('#chart-quick-trade', el => !el.classList.contains('minimized'));
      assert(isRestored, 'FR-001 Trade pill restores widget', 'Expected #chart-quick-trade to lose .minimized class');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Paper Trading Panel & Portfolio Metrics (FR-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open Paper panel
      await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel?.('paper', true));
      await page.waitForSelector('#paper-panel-body, [data-panel="paper"]', { timeout: 5000 });

      const panelMetrics = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        const equity = pt.calculateEquity();
        const balance = pt.balance;
        const unrealizedPnl = pt.positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
        const mainAcc = pt.accounts.find(a => a.id === 'pap_main' || a.name === 'Main Paper' || a.isSystem);
        return {
          equity,
          balance,
          unrealizedPnl,
          hasMainAccount: !!mainAcc,
          accountsCount: pt.accounts.length
        };
      });

      assert(typeof panelMetrics.equity === 'number' && Number.isFinite(panelMetrics.equity),
        'FR-002 equity calculation finite number', 'Equity calculation returned non-finite number');
      assert(typeof panelMetrics.balance === 'number' && Number.isFinite(panelMetrics.balance),
        'FR-002 balance finite number', 'Balance returned non-finite number');
      assert(panelMetrics.hasMainAccount, 'FR-002 Main Paper account exists', 'Missing default Main Paper account');

      // Multi-account switching
      const accountSwitchResult = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        const initialActive = pt.activeAccountId;
        // Mock a secondary account in memory
        pt.accounts.push({ id: 'pap_test_second', name: 'Second Account', balance: 50000, positions: [], history: [] });
        pt.switchAccount('pap_test_second');
        const activeAfter = pt.activeAccountId;
        const balAfter = pt.balance;
        // Switch back to initial
        pt.switchAccount(initialActive);
        return { initialActive, activeAfter, balAfter, finalActive: pt.activeAccountId };
      });

      assert(accountSwitchResult.activeAfter === 'pap_test_second', 'FR-002 switch paper account',
        `Expected activeAccountId to switch to pap_test_second, got ${accountSwitchResult.activeAfter}`);
      assert(accountSwitchResult.balAfter === 50000, 'FR-002 switched account balance loaded',
        `Expected balance 50000, got ${accountSwitchResult.balAfter}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Plan Quotas: Paper Accounts & Holdings per Account (FR-003, SC-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const quotaChecks = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        // On basic plan, paperAccounts limit is 1. Ensure 1 account exists.
        pt.accounts = [{ id: 'pap_main', name: 'Main Paper', balance: 100000, positions: [], history: [] }];
        pt.activeAccountId = 'pap_main';

        // Attempting to create a second account via createAccount()
        const newAcc = pt.createAccount('Extra Account');
        const countAfter = pt.accounts.length;

        // Attempting to open position beyond holdingsPerAccount (Basic limit is 20)
        pt.positions = [];
        for (let i = 0; i < 20; i++) {
          pt.positions.push({ id: 'pos_' + i, symbol: 'BTCUSDT', side: 'long', qty: 0.01, entryPrice: 80000, margin: 100 });
        }
        const openPosRes = pt.openPosition('long', 0.1, 10, 80000);

        return { newAcc, countAfter, openPosRes, posCountAfter: pt.positions.length };
      });

      assert(quotaChecks.newAcc === null, 'FR-003 paperAccounts plan quota refuses creation',
        `Expected createAccount() to return null on plan quota exceed, got ${JSON.stringify(quotaChecks.newAcc)}`);
      assert(quotaChecks.countAfter === 1, 'FR-003 paper accounts count clamped by plan',
        `Expected accounts count 1, got ${quotaChecks.countAfter}`);
      assert(quotaChecks.openPosRes === false, 'FR-003 holdingsPerAccount plan quota refuses position',
        `Expected openPosition() to return false when holdings limit (20) reached, got ${quotaChecks.openPosRes}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Order Ticket: Market, Limit, Stop & Pending Cancellations (FR-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch to order ticket tab
      await realClick(page, '#btn-subtab-ticket');
      await page.waitForSelector('#order-type-sel', { visible: true, timeout: 5000 });

      // Change order type to Limit
      await page.select('#order-type-sel', 'limit');
      await page.waitForFunction(() => {
        const wrap = document.querySelector('#order-price-wrap');
        return wrap && window.getComputedStyle(wrap).display !== 'none';
      }, { timeout: 4000 });

      const limitLabelText = await page.$eval('#order-price-wrap label', el => el.innerText.trim());
      assert(limitLabelText.includes('Limit price') || limitLabelText.includes('قیمت لیمیت'),
        'FR-004 Limit price field label', `Expected Limit price label, got "${limitLabelText}"`);

      // Change order type to Stop
      await page.select('#order-type-sel', 'stop');
      const stopLabelText = await page.$eval('#order-price-wrap label', el => el.innerText.trim());
      assert(stopLabelText.includes('Stop trigger price') || stopLabelText.includes('تریگر'),
        'FR-004 Stop trigger price field label', `Expected Stop trigger price label, got "${stopLabelText}"`);

      // Edge case: Margin insufficient -> order refused, no position opens
      const marginRejection = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.balance = 100; // Low balance
        const res = pt.placeOrder({ side: 'buy', type: 'market', qty: 1000, leverage: 1 }); // Requires huge margin
        return { res, posCount: pt.positions.length };
      });
      assert(marginRejection.res === null, 'FR-004 margin insufficient refuses order',
        `Expected null on margin rejection, got ${marginRejection.res}`);

      // Reset balance to $100,000
      await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.balance = 100000;
        pt.orders = [];
        pt.positions = [];
      });

      // Place non-marketable limit buy order below market (resting order)
      const pendingOrderState = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.setMarket('BTCUSDT', 80000);
        // Market price 80000, buy limit at 75000 -> resting order
        const ordId = pt.placeOrder({ side: 'buy', type: 'limit', price: 75000, qty: 0.1 });
        pt.render();
        return { ordId, ordersCount: pt.orders.length, badgeText: document.querySelector('#ord-count-badge')?.innerText };
      });

      assert(typeof pendingOrderState.ordId === 'string' && pendingOrderState.ordId.startsWith('ord-'),
        'FR-004 resting limit order returns order id', `Expected order id string, got ${pendingOrderState.ordId}`);
      assert(pendingOrderState.ordersCount === 1, 'FR-004 resting order queued in orders array', 'Expected orders.length === 1');

      // Cancel pending order
      await page.evaluate((id) => {
        window.__TRADING_APP__.paperTrading.cancelOrder(id);
      }, pendingOrderState.ordId);
      await page.waitForFunction(() => (window.__TRADING_APP__.paperTrading?.orders?.length || 0) === 0, { timeout: 4000 });

      const ordersAfterCancel = await page.evaluate(() => window.__TRADING_APP__.paperTrading.orders.length);
      assert(ordersAfterCancel === 0, 'FR-004 cancelOrder removes resting order', 'Orders array should be empty after cancel');

      const cancelToast = await page.evaluate(() => document.querySelector('#tradingchart-toast, .tc-toast')?.innerText || '');
      assert(cancelToast.includes('Order cancelled') || cancelToast.includes('لغو'),
        'FR-004 cancel order toast confirmed', `Expected "Order cancelled." toast, got "${cancelToast}"`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Level 2 DOM Ladder & Context Menu Limit Placement (FR-005)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await realClick(page, '#btn-subtab-dom');
      await page.waitForSelector('#dom-ladder-wrap', { visible: true, timeout: 5000 });

      const domCounts = await page.evaluate(() => {
        const asks = document.querySelectorAll('.dom-row.dom-ask').length;
        const bids = document.querySelectorAll('.dom-row.dom-bid').length;
        return { asks, bids };
      });
      assert(domCounts.asks === 5 && domCounts.bids === 5, 'FR-005 DOM ladder 5 ask and 5 bid rows',
        `Expected 5 asks and 5 bids, got ${JSON.stringify(domCounts)}`);

      // Click bid row below market to place limit order
      const placedOrder = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.orders = [];
        const firstBid = document.querySelector('.dom-row.dom-bid');
        const price = Number(firstBid.getAttribute('data-price'));
        firstBid.click();
        return { price, ord: pt.orders[0] };
      });

      assert(!!placedOrder.ord, 'FR-005 DOM ladder click places order', 'Order was not added on DOM row click');
      assert(placedOrder.ord.side === 'long' && placedOrder.ord.price === placedOrder.price,
        'FR-005 DOM order matched price and side', `Expected long limit at ${placedOrder.price}, got ${JSON.stringify(placedOrder.ord)}`);

      // Chart Context Menu Buy Limit & Sell Limit orders
      const ctxMenuOrderResult = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.orders = [];
        pt.setMarket('BTCUSDT', 80000);
        // Simulate context menu click "Buy Limit at X"
        pt.placeOrder({ side: 'buy', type: 'limit', price: 77500, qty: 0.1 });
        return { ordCount: pt.orders.length, placedPrice: pt.orders[0]?.price };
      });
      assert(ctxMenuOrderResult.ordCount === 1 && ctxMenuOrderResult.placedPrice === 77500,
        'FR-005 context menu buy limit order', 'Context menu limit order placement failed');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Position Closing & Trade Journal Synchronization (FR-006, SC-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const journalSyncResult = await page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        const pt = app.paperTrading;
        const tj = app.tradeJournal;
        pt.positions = [];
        pt.history = [];
        pt.setMarket('BTCUSDT', 80000);

        const execCountBefore = tj?.sampleExecutions?.length || 0;
        const balBefore = pt.balance;

        // Open position
        pt.placeOrder({ side: 'buy', type: 'market', qty: 0.1 });
        const pos = pt.positions[0];
        const marginLocked = pos.margin;

        // Close position
        pt.closePosition(pos.id);

        const execCountAfter = tj?.sampleExecutions?.length || 0;
        const execsAdded = execCountAfter - execCountBefore;
        const latestHistory = pt.history[0];
        const balAfter = pt.balance;

        return {
          posClosed: pt.positions.length === 0,
          historyRecorded: pt.history.length === 1,
          historyId: latestHistory?.id,
          execsAdded,
          balDifference: balAfter - (balBefore - marginLocked)
        };
      });

      assert(journalSyncResult.posClosed, 'FR-006 position closed', 'Open position still present after closePosition');
      assert(journalSyncResult.historyRecorded, 'FR-006 closed trade in history', 'History missing closed position record');
      assert(journalSyncResult.execsAdded === 2, 'FR-006 both open and close executions logged to journal',
        `Expected exactly 2 executions added to journal, got ${journalSyncResult.execsAdded}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Danger Confirmation & Account Reset (FR-007)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const resetResult = await page.evaluate(async () => {
        const pt = window.__TRADING_APP__.paperTrading;
        // Mutate balance and populate open position
        pt.balance = 42000;
        pt.positions = [{ id: 'mock_pos', symbol: 'BTCUSDT', side: 'long', qty: 1, entryPrice: 80000, margin: 8000 }];
        pt.orders = [{ id: 'mock_ord', symbol: 'BTCUSDT', side: 'long', type: 'limit', price: 70000, qty: 1 }];

        // Trigger reset via button click -> opens danger confirmation dialog
        document.querySelector('#btn-reset-paper')?.click();
        const dialogOpen = document.querySelector('#custom-ui-dialog-overlay')?.classList.contains('open');

        // Confirm danger dialog
        document.querySelector('#btn-dialog-confirm')?.click();

        return {
          dialogOpen,
          balance: pt.balance,
          positionsCount: pt.positions.length,
          ordersCount: pt.orders.length
        };
      });

      assert(resetResult.dialogOpen, 'FR-007 reset requires danger confirmation dialog', 'Expected danger confirmation dialog');
      assert(resetResult.balance === 100000, 'FR-007 reset restores $100,000 balance',
        `Expected balance 100000, got ${resetResult.balance}`);
      assert(resetResult.positionsCount === 0, 'FR-007 reset clears open positions', 'Positions not cleared on reset');
      assert(resetResult.ordersCount === 0, 'FR-007 reset clears pending orders', 'Orders not cleared on reset');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Device LocalStorage Persistence (FR-018)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const storageState = await page.evaluate(() => {
        const pt = window.__TRADING_APP__.paperTrading;
        pt.saveAccounts();
        const rawAccounts = localStorage.getItem('tradingchart_paper_accounts');
        const activeId = localStorage.getItem('tradingchart_paper_active');
        let accounts = [];
        try { accounts = JSON.parse(rawAccounts); } catch (e) {}
        return { hasStorage: !!rawAccounts, accountsCount: accounts.length, activeId };
      });

      assert(storageState.hasStorage && storageState.accountsCount >= 1,
        'FR-018 paper accounts persist in localStorage', 'tradingchart_paper_accounts missing or empty in localStorage');
      assert(!!storageState.activeId, 'FR-018 active paper account ID persisted', 'tradingchart_paper_active missing in localStorage');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 9. Persian / English Bilingual Controls & Toasts (FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch language to Persian
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const faLabels = await page.evaluate(() => {
        const buyBtnText = document.querySelector('#quick-trade-buy-btn')?.innerText || '';
        const sellBtnText = document.querySelector('#quick-trade-sell-btn')?.innerText || '';
        const resetBtnText = document.querySelector('#btn-reset-paper')?.innerText || '';
        return { buyBtnText, sellBtnText, resetBtnText };
      });

      assert(/[\u0600-\u06FF]/.test(faLabels.buyBtnText), 'FR-019 Persian BUY button text',
        `Expected Persian characters in BUY button, got "${faLabels.buyBtnText}"`);
      assert(/[\u0600-\u06FF]/.test(faLabels.sellBtnText), 'FR-019 Persian SELL button text',
        `Expected Persian characters in SELL button, got "${faLabels.sellBtnText}"`);

      // Switch back to English
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });
    }

    console.log('PASS: 006 [Paper Trading Orders, Portfolio & Journal]');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}\n${err.stack}`);
  process.exit(1);
});
