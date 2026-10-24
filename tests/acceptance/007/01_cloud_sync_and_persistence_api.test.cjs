/**
 * @spec 007
 * @covers FR-005, FR-021
 */
const { launch, boot } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

const TEST_IP = `10.${(process.pid >> 8) & 255}.${process.pid & 255}.${Math.floor(Math.random() * 200) + 1}`;

async function request(endpoint, options = {}) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const headers = { 'X-Forwarded-For': TEST_IP, ...(options.headers || {}) };
  const res = await fetch(reqUrl, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[007 API & Cloud Sync Test] Running against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unauthenticated Request Gating (FR-021)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resUnauth = await request('/api/user/state');
    assert(resUnauth.status === 401, 'FR-021 unauthenticated cloud state GET', `Expected 401, got ${resUnauth.status}`);
    assert(resUnauth.body?.ok === false && resUnauth.body?.error === 'unauthenticated',
      'FR-021 unauthenticated response body', `Expected ok:false, error:unauthenticated, got ${JSON.stringify(resUnauth.body)}`);

    const resUnauthPut = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { tradeJournal: '[]' } })
    });
    assert(resUnauthPut.status === 401, 'FR-021 unauthenticated cloud state PUT', `Expected 401, got ${resUnauthPut.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Register Test User & Authenticated State GET (FR-021)
  // ──────────────────────────────────────────────────────────────────────────
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = `qa_jrn_${ts}`;
  const email = `${username}@acceptance.test`;
  const password = 'QaPassword123!';

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password, displayName: 'Journal Cloud User' })
  });
  assert(regRes.status === 200, 'FR-021 test user registration', `Expected 200, got ${regRes.status}`);
  const userCookie = regRes.headers.get('set-cookie');
  const userId = regRes.body?.user?.id;
  assert(!!userId && !!userCookie, 'FR-021 session cookie and user id', 'Registration did not return session or user id');

  const initialGet = await request('/api/user/state', {
    headers: { Cookie: userCookie }
  });
  assert(initialGet.status === 200, 'FR-021 authenticated state GET status', `Expected 200, got ${initialGet.status}`);
  assert(initialGet.body?.ok === true, 'FR-021 authenticated state GET body ok', 'Expected ok: true');
  let baseUpdatedAt = initialGet.body?.updatedAt ?? 0;

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Persist Trade Journal Executions via PUT /api/user/state (FR-021)
  // ──────────────────────────────────────────────────────────────────────────
  const sampleExecutions = [
    {
      id: `exec-open-${ts}`,
      accountId: 'tradingchart-paper-1',
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 0.5,
      price: 76200,
      fee: 1.5,
      executedAt: '2026-09-01T10:00:00Z',
      source: 'manual',
      assetClass: 'crypto'
    },
    {
      id: `exec-close-${ts}`,
      accountId: 'tradingchart-paper-1',
      symbol: 'BTCUSDT',
      side: 'sell',
      quantity: 0.5,
      price: 77450,
      fee: 1.5,
      executedAt: '2026-09-01T15:30:00Z',
      source: 'manual',
      assetClass: 'crypto'
    }
  ];

  const putRes = await request('/api/user/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      state: {
        tradeJournal: JSON.stringify(sampleExecutions)
      },
      baseUpdatedAt
    })
  });
  assert(putRes.status === 200, 'FR-021 persist tradeJournal via PUT status', `Expected 200, got ${putRes.status}`);
  assert(putRes.body?.ok === true && typeof putRes.body?.updatedAt === 'number',
    'FR-021 PUT response contains updatedAt timestamp', `Unexpected body: ${JSON.stringify(putRes.body)}`);
  baseUpdatedAt = putRes.body.updatedAt;

  // Verify state read-back
  const readBackRes = await request('/api/user/state', {
    headers: { Cookie: userCookie }
  });
  assert(readBackRes.status === 200, 'FR-021 read-back persisted state status', `Expected 200, got ${readBackRes.status}`);
  const persistedJournalStr = readBackRes.body?.state?.tradeJournal;
  assert(!!persistedJournalStr, 'FR-021 tradeJournal slice present in state', 'Missing tradeJournal in server state');

  let parsedExecutions = [];
  try { parsedExecutions = JSON.parse(persistedJournalStr); } catch (e) {}
  assert(parsedExecutions.length === 2, 'FR-021 tradeJournal execution count',
    `Expected 2 executions, got ${parsedExecutions.length}`);
  assert(parsedExecutions[0].id === sampleExecutions[0].id && parsedExecutions[0].symbol === 'BTCUSDT',
    'FR-021 tradeJournal data integrity', `Execution data mismatch: ${JSON.stringify(parsedExecutions[0])}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Concurrency Conflict Handling (409 Conflict) (FR-021)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const stalePutRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        state: { tradeJournal: JSON.stringify(sampleExecutions) },
        baseUpdatedAt: baseUpdatedAt - 1000 // outdated timestamp
      })
    });
    assert(stalePutRes.status === 409, 'FR-021 optimistic concurrency conflict status 409',
      `Expected 409, got ${stalePutRes.status}`);
    assert(stalePutRes.body?.ok === false && stalePutRes.body?.error === 'conflict',
      'FR-021 conflict error response body', `Expected ok:false, error:conflict, got ${JSON.stringify(stalePutRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. State Payload Cap (2 MB / STATE_MAX_BYTES) (FR-021 Edge Case)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const hugePayload = 'A'.repeat(2.5 * 1024 * 1024); // 2.5 MB > 2 MB cap
    const largePutRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        state: { tradeJournal: hugePayload },
        baseUpdatedAt
      })
    });
    assert(largePutRes.status === 413, 'FR-021 payload above 2 MB rejected with 413',
      `Expected 413, got ${largePutRes.status}`);
    assert(largePutRes.body?.ok === false && (largePutRes.body?.error === 'state_too_large' || largePutRes.status === 413),
      'FR-021 413 state_too_large error body', `Expected state_too_large error, got ${JSON.stringify(largePutRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FIFO Accounting Verification for Paired Round Trips (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const ctx = await launch('desktop');
    try {
      await boot(ctx);
      const fifoResult = await ctx.page.evaluate(() => {
        const store = window.__TRADING_APP__?.tradeJournal?.store;
        if (!store) return { error: 'JournalStore not available' };

        // Clear existing executions to test pure FIFO pairing
        store.clearExecutions('all');

        // Add 2 BUY fills at different times and prices:
        // Fill 1: BUY 0.5 @ 80,000 at T1
        store.addExecution({
          id: 'fifo-buy-1',
          accountId: 'tradingchart-paper-1',
          symbol: 'ETHUSDT',
          side: 'buy',
          quantity: 0.5,
          price: 80000,
          fee: 2.0,
          executedAt: '2026-09-10T10:00:00Z',
          source: 'manual'
        });

        // Fill 2: BUY 0.5 @ 82,000 at T2
        store.addExecution({
          id: 'fifo-buy-2',
          accountId: 'tradingchart-paper-1',
          symbol: 'ETHUSDT',
          side: 'buy',
          quantity: 0.5,
          price: 82000,
          fee: 2.0,
          executedAt: '2026-09-10T11:00:00Z',
          source: 'manual'
        });

        // Fill 3: SELL 0.5 @ 85,000 at T3
        store.addExecution({
          id: 'fifo-sell-1',
          accountId: 'tradingchart-paper-1',
          symbol: 'ETHUSDT',
          side: 'sell',
          quantity: 0.5,
          price: 85000,
          fee: 2.0,
          executedAt: '2026-09-10T12:00:00Z',
          source: 'manual'
        });

        const roundTripsT3 = store.getRoundTrips();

        // Fill 4: SELL 0.5 @ 86,000 at T4
        store.addExecution({
          id: 'fifo-sell-2',
          accountId: 'tradingchart-paper-1',
          symbol: 'ETHUSDT',
          side: 'sell',
          quantity: 0.5,
          price: 86000,
          fee: 2.0,
          executedAt: '2026-09-10T13:00:00Z',
          source: 'manual'
        });

        const roundTripsT4 = store.getRoundTrips();

        return {
          t3Count: roundTripsT3.length,
          t3First: roundTripsT3[0],
          t4Count: roundTripsT4.length,
          t4Rts: roundTripsT4
        };
      });

      assert(!fifoResult.error, 'FR-005 JournalStore loaded in app context', fifoResult.error);
      assert(fifoResult.t3Count >= 1, 'FR-005 round trips generated after partial close',
        `Expected at least 1 round trip, got ${fifoResult.t3Count}`);

      // First round trip matches T1 BUY (80000) with T3 SELL (85000)
      const firstRt = fifoResult.t3First;
      assert(firstRt.symbol === 'ETHUSDT', 'FR-005 round trip symbol matches', `Expected ETHUSDT, got ${firstRt.symbol}`);
      assert(firstRt.grossPnl === 2500, 'FR-005 FIFO gross P&L matched to earliest buy',
        `Expected 2500 (0.5 * (85000 - 80000)), got ${firstRt.grossPnl}`);
      assert(firstRt.openedAt === '2026-09-10T10:00:00Z', 'FR-005 earliest fill timestamp matches FIFO',
        `Expected 2026-09-10T10:00:00Z, got ${firstRt.openedAt}`);

      // After Fill 4, second round trip closes remaining buy
      assert(fifoResult.t4Count >= 1, 'FR-005 round trips present after final close',
        `Expected round trips, got ${fifoResult.t4Count}`);
      const closedCount = fifoResult.t4Rts.filter(r => r.status === 'closed' || r.status === 'win' || r.status === 'loss').length;
      assert(closedCount >= 1, 'FR-005 executions closed via FIFO matching',
        `Expected closed round trips, got ${closedCount}`);
    } finally {
      await ctx.browser.close();
    }
  }

  console.log('✅ 01_cloud_sync_and_persistence_api.test.cjs passed');
}

run().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
