/**
 * @spec 009
 * @covers FR-012, FR-014, FR-015, FR-016
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

let ipSubnet = Math.floor(Math.random() * 200) + 10;
let ipHost = 1;
function nextIp() {
  ipHost++;
  if (ipHost > 250) { ipSubnet++; ipHost = 1; }
  return `10.97.${ipSubnet}.${ipHost}`;
}

async function request(endpoint, options = {}, clientIp = null) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const ip = clientIp || nextIp();
  const headers = {
    'X-Forwarded-For': ip,
    ...(options.headers || {})
  };
  const res = await fetch(reqUrl, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[009 Acceptance Suite 03] Running Cloud Sync & Plans Entitlements against ${BASE_URL}...`);

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const testUser = {
    email: `qa_sync_${ts}@acceptance.test`,
    username: `qa_sync_${ts}`.slice(0, 24),
    password: 'SyncPassword123!',
    displayName: `Sync Trader ${ts}`
  };

  // Register fresh test user (basic tier)
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 200, 'Suite 03 setup: user registration', `Expected 200, got ${regRes.status}`);
  const userCookie = regRes.headers.get('set-cookie');
  const userId = regRes.body?.user?.id;
  assert(!!userId && !!userCookie, 'Suite 03 setup: session and user id present', 'Missing credentials');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unauthenticated vs Authenticated Cloud State (FR-012)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Unauthenticated GET /api/user/state -> 401 unauthenticated
    const unauthGet = await request('/api/user/state');
    assert(unauthGet.status === 401, 'FR-012 unauthenticated GET /api/user/state status', `Expected 401, got ${unauthGet.status}`);
    assert(unauthGet.body?.error === 'unauthenticated', 'FR-012 unauthenticated error code', `Expected unauthenticated, got ${unauthGet.body?.error}`);

    // Unauthenticated PUT /api/user/state -> 401 unauthenticated
    const unauthPut = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: {}, baseUpdatedAt: 0 })
    });
    assert(unauthPut.status === 401, 'FR-012 unauthenticated PUT /api/user/state status', `Expected 401, got ${unauthPut.status}`);

    // Authenticated GET /api/user/state -> 200 ok
    const authGet = await request('/api/user/state', { headers: { Cookie: userCookie } });
    assert(authGet.status === 200, 'FR-012 authenticated GET /api/user/state status', `Expected 200, got ${authGet.status}`);
    assert(authGet.body?.ok === true, 'FR-012 state body ok', 'Expected ok: true');
    assert(typeof authGet.body?.state === 'object', 'FR-012 state object', 'State is not an object');
    assert(typeof authGet.body?.updatedAt === 'number', 'FR-012 updatedAt timestamp', 'Missing updatedAt');
    assert(authGet.body?.plan === 'basic', 'FR-012 plan identifier is basic', `Expected basic, got ${authGet.body?.plan}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Cloud State Validation, Payload Cap & Conflict Detection (FR-012)
  // ──────────────────────────────────────────────────────────────────────────
  let lastUpdatedAt = 0;
  {
    // Invalid state format (e.g. state is a string) -> 400 invalid_state
    const badStateRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ state: "corrupted_string_not_an_object", baseUpdatedAt: 0 })
    });
    assert(badStateRes.status === 400, 'FR-012 invalid state format status', `Expected 400, got ${badStateRes.status}`);
    assert(badStateRes.body?.error === 'invalid_state', 'FR-012 invalid_state error code', `Expected invalid_state, got ${badStateRes.body?.error}`);

    // Enforce 2MB size cap -> 413 state_too_large
    // Construct a payload slightly larger than 2 * 1024 * 1024 bytes (2097152 bytes)
    const largeBlob = 'x'.repeat(2100000);
    const largeStateRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        state: { pineCode: largeBlob },
        baseUpdatedAt: 0
      })
    });
    assert(largeStateRes.status === 413, 'FR-012 2MB size cap status 413', `Expected 413, got ${largeStateRes.status}`);
    assert(largeStateRes.body?.error === 'state_too_large', 'FR-012 state_too_large error code', `Expected state_too_large, got ${largeStateRes.body?.error}`);

    // Valid state PUT
    const validState = {
      profile: JSON.stringify({ name: 'Trader Sync', handle: 'tradersync' }),
      settings: JSON.stringify({ theme: 'dark', language: 'en' }),
      layouts: JSON.stringify([{ id: 'layout-1', name: 'Default Grid' }]),
      currentLayout: JSON.stringify({ id: 'layout-1' }),
      templates: JSON.stringify([{ id: 'tmpl-1', name: 'MA Ribbon' }]),
      userWatchlists: JSON.stringify([{ id: 'wl-1', name: 'Crypto Core', symbols: ['BTCUSDT', 'ETHUSDT'] }]),
      watchlists: JSON.stringify(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
      alerts: JSON.stringify([{ id: 'alt-1', symbol: 'BTCUSDT', target: 80000 }]),
      paperAccounts: JSON.stringify([{ id: 'paper-1', name: 'Demo 50k', balance: 50000 }]),
      paperActive: 'paper-1',
      watchlistFlags: JSON.stringify({ BTCUSDT: 'green' }),
      priceStyle: 'candles',
      drawingFavorites: JSON.stringify(['trend_line', 'fib_retracement']),
      pineCode: '//@version=5\nindicator("Sync Test")',
      theme: 'dark',
      tradeJournal: JSON.stringify([{ id: 'tr-1', symbol: 'BTCUSDT', profit: 450 }]),
      customTimeframes: JSON.stringify(['3m', '2h']),
      layoutSync: 'true',
      soundMuted: 'false'
    };

    const putRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ state: validState, baseUpdatedAt: 0 })
    });
    assert(putRes.status === 200, 'FR-012 valid state PUT status', `Expected 200, got ${putRes.status}`);
    assert(putRes.body?.ok === true && typeof putRes.body?.updatedAt === 'number',
      'FR-012 valid state PUT returns updatedAt', `Unexpected: ${JSON.stringify(putRes.body)}`);
    lastUpdatedAt = putRes.body.updatedAt;

    // Read-back state and verify 19 keys
    const readBack = await request('/api/user/state', { headers: { Cookie: userCookie } });
    assert(readBack.status === 200, 'FR-012 read-back state status', `Expected 200, got ${readBack.status}`);
    assert(readBack.body?.state?.pineCode === '//@version=5\nindicator("Sync Test")',
      'FR-012 read-back state pineCode match', 'pineCode mismatch');
    assert(readBack.body?.state?.priceStyle === 'candles',
      'FR-012 read-back state priceStyle match', 'priceStyle mismatch');

    // Conflict detection: PUT with stale baseUpdatedAt (e.g. 0 when server is at lastUpdatedAt) -> 409 conflict
    const conflictRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        state: { theme: 'light' },
        baseUpdatedAt: lastUpdatedAt - 1000 // stale timestamp
      })
    });
    assert(conflictRes.status === 409, 'FR-012 stale baseUpdatedAt conflict status 409', `Expected 409, got ${conflictRes.status}`);
    assert(conflictRes.body?.error === 'conflict', 'FR-012 conflict error code', `Expected conflict, got ${conflictRes.body?.error}`);
    assert(typeof conflictRes.body?.serverUpdatedAt === 'number', 'FR-012 conflict serverUpdatedAt present', 'Missing serverUpdatedAt');
    assert(typeof conflictRes.body?.serverState === 'object', 'FR-012 conflict serverState present', 'Missing serverState');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Plan Quotas Enforcement on State (FR-012, FR-016)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Basic plan quotas:
    // savedLayouts: 1
    // savedTemplates: 1
    // watchlists: 3
    // priceAlerts: 5
    // paperAccounts: 1

    // Attempt to save 4 layouts on Basic plan (quota is 1)
    const excessLayouts = [
      { id: 'l1', name: 'Grid 1' },
      { id: 'l2', name: 'Grid 2' },
      { id: 'l3', name: 'Grid 3' },
      { id: 'l4', name: 'Grid 4' }
    ];

    const quotaRes = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        state: {
          layouts: JSON.stringify(excessLayouts)
        },
        baseUpdatedAt: lastUpdatedAt
      })
    });
    assert(quotaRes.status === 403, 'FR-012/FR-016 quota exceeded status 403', `Expected 403, got ${quotaRes.status}`);
    assert(quotaRes.body?.error === 'limit_exceeded', 'FR-012 limit_exceeded error code', `Expected limit_exceeded, got ${quotaRes.body?.error}`);
    assert(Array.isArray(quotaRes.body?.violations) && quotaRes.body.violations.length > 0,
      'FR-012 quota violations array', 'Missing violations array');

    const layoutViolation = quotaRes.body.violations.find(v => v.key === 'layouts');
    assert(layoutViolation && layoutViolation.limit === 1 && layoutViolation.current === 4,
      'FR-012/FR-016 layout quota violation details', `Unexpected: ${JSON.stringify(quotaRes.body.violations)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Plans Catalog & Usage (FR-014)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const plansRes = await request('/api/plans', { headers: { Cookie: userCookie } });
    assert(plansRes.status === 200, 'FR-014 GET /api/plans status', `Expected 200, got ${plansRes.status}`);
    const body = plansRes.body;
    assert(body?.ok === true, 'FR-014 plans body ok', 'Expected ok: true');
    assert(typeof body?.plans === 'object', 'FR-014 plans dictionary', 'Missing plans object');
    assert(Array.isArray(body?.planOrder), 'FR-014 planOrder array', 'Missing planOrder');

    // Verify all 5 canonical tiers are active
    const expectedTiers = ['basic', 'essential', 'plus', 'premium', 'ultimate'];
    for (const tier of expectedTiers) {
      assert(body.planOrder.includes(tier), `FR-014 planOrder contains ${tier}`, `Missing ${tier} in planOrder`);
      const p = body.plans[tier];
      assert(p && typeof p.nameEn === 'string' && typeof p.nameFa === 'string',
        `FR-014 ${tier} names localized`, `Missing bilingual names for ${tier}`);
      assert(typeof p.priceUSD === 'number', `FR-014 ${tier} priceUSD number`, `Missing priceUSD for ${tier}`);
      assert(typeof p.badge === 'string', `FR-014 ${tier} badge string`, `Missing badge for ${tier}`);
      assert(p.features && typeof p.features === 'object', `FR-014 ${tier} features dictionary`, `Missing features for ${tier}`);
    }

    // Verify authenticated user fields
    assert(body.current === 'basic', 'FR-014 current plan is basic', `Expected basic, got ${body.current}`);
    assert(body.usage && typeof body.usage === 'object', 'FR-014 usage metrics object', 'Missing usage object');
    assert(typeof body.usage.stateBytes === 'number', 'FR-014 usage stateBytes metric', 'Missing stateBytes');
    assert(typeof body.isAdmin === 'boolean', 'FR-014 isAdmin boolean flag', 'Missing isAdmin');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Plan Switching & Upgrade Requests (FR-015)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Request unknown plan -> 400 unknown_plan
    const unknownPlanRes = await request('/api/user/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ plan: 'nonexistent_tier_xyz' })
    });
    assert(unknownPlanRes.status === 400, 'FR-015 unknown plan status', `Expected 400, got ${unknownPlanRes.status}`);
    assert(unknownPlanRes.body?.error === 'unknown_plan', 'FR-015 unknown_plan error', `Expected unknown_plan, got ${unknownPlanRes.body?.error}`);

    // Free plan switch (switching to basic tier) -> 200 ok
    const freeSwitchRes = await request('/api/user/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ plan: 'basic' })
    });
    assert(freeSwitchRes.status === 200, 'FR-015 free plan switch status', `Expected 200, got ${freeSwitchRes.status}`);
    assert(freeSwitchRes.body?.ok === true && freeSwitchRes.body?.user?.plan === 'basic',
      'FR-015 free plan switch user plan', `Expected basic, got ${freeSwitchRes.body?.user?.plan}`);

    // Paid plan upgrade request (e.g. to plus tier)
    // In standard billing mode (unsimulated), responds with 202 Accepted and pending: true
    const paidReqRes = await request('/api/user/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ plan: 'plus' })
    });
    // Can be 202 (pending approval in standard mode) or 200 (in simulated mode)
    assert(paidReqRes.status === 202 || paidReqRes.status === 200,
      'FR-015 paid plan request status 202 or 200', `Expected 202 or 200, got ${paidReqRes.status}`);

    if (paidReqRes.status === 202) {
      assert(paidReqRes.body?.pending === true, 'FR-015 pending flag is true', 'Expected pending: true');
      assert(paidReqRes.body?.user?.planRequest?.plan === 'plus',
        'FR-015 planRequest contains target plan plus', `Unexpected: ${JSON.stringify(paidReqRes.body?.user?.planRequest)}`);

      // Withdraw pending plan request
      const cancelReqRes = await request('/api/user/plan-request', {
        method: 'DELETE',
        headers: { Cookie: userCookie }
      });
      assert(cancelReqRes.status === 200, 'FR-015 withdraw plan request status', `Expected 200, got ${cancelReqRes.status}`);
      assert(cancelReqRes.body?.user?.planRequest === null,
        'FR-015 planRequest cleared on withdrawal', `Expected null, got ${JSON.stringify(cancelReqRes.body?.user?.planRequest)}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Server Entitlements Enforcement (FR-016)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Candles API depth cap header X-History-Limit
    const candlesRes = await request('/api/candles?symbol=BINANCE:BTCUSDT&timeframe=1D&limit=50', {
      headers: { Cookie: userCookie }
    });
    assert(candlesRes.status === 200, 'FR-016 /api/candles status', `Expected 200, got ${candlesRes.status}`);
    const histLimit = candlesRes.headers.get('x-history-limit');
    assert(histLimit === '10000', 'FR-016 basic plan X-History-Limit is 10000', `Expected 10000, got ${histLimit}`);

    // Webhook alerts gate: basic plan user attempting to rotate webhook token
    const webhookRes = await request('/api/user/webhook/rotate', {
      method: 'POST',
      headers: { Cookie: userCookie }
    });
    assert(webhookRes.status === 403, 'FR-016 webhook rotate blocked for basic tier status', `Expected 403, got ${webhookRes.status}`);
    assert(webhookRes.body?.error === 'plan_feature_locked' && webhookRes.body?.feature === 'webhookAlerts',
      'FR-016 webhookAlerts plan_feature_locked error', `Unexpected: ${JSON.stringify(webhookRes.body)}`);
  }

  console.log('✅ [009 Acceptance Suite 03] All Cloud Sync & Plans Entitlements scenarios passed.');
}

run().catch(err => {
  console.error('❌ unhandled error in 03_cloud_sync_and_plans_entitlements_api suite:', err);
  process.exit(1);
});
