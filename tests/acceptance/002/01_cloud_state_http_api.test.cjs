/**
 * @spec 002
 * @covers FR-024, FR-025
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function request(path, options = {}) {
  const reqUrl = `${BASE_URL}${path}`;
  const res = await fetch(reqUrl, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log('Testing Spec 002: Cloud State HTTP API (FR-024, FR-025)...');

  // 1. Guest / unauthenticated checks (FR-024)
  {
    const resGet = await request('/api/user/state');
    assert(resGet.status === 401, 'FR-024 guest GET /api/user/state', `Expected 401, got ${resGet.status}`);
    assert(resGet.body && resGet.body.error === 'unauthenticated', 'FR-024 guest unauthenticated error', `Expected "unauthenticated", got ${resGet.body?.error}`);

    const resPut = await request('/api/user/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { test: 1 } })
    });
    assert(resPut.status === 401, 'FR-024 guest PUT /api/user/state', `Expected 401, got ${resPut.status}`);
  }

  // 2. Register fresh authenticated user (default basic plan)
  const ts = Date.now().toString(36);
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `u_${ts}@acceptance.test`,
      username: `u_${ts}`,
      password: 'AcceptancePass123!',
      displayName: 'Acceptance User'
    })
  });
  assert(regRes.status === 200 && regRes.body?.ok, 'FR-024 user registration', `Registration failed: ${regRes.rawText}`);
  const userId = regRes.body.user.id;
  const setCookie = regRes.headers.get('set-cookie');
  assert(setCookie && setCookie.includes('tc_session='), 'FR-024 session cookie set', 'Missing tc_session cookie');
  const sessionCookie = setCookie.split(';')[0];
  const authHeaders = { 'Content-Type': 'application/json', 'Cookie': sessionCookie };

  // 3. Authenticated GET /api/user/state structure
  let currentUpdatedAt = 0;
  {
    const res = await request('/api/user/state', { headers: authHeaders });
    assert(res.status === 200, 'FR-024 authenticated GET /api/user/state status', `Expected 200, got ${res.status}`);
    assert(res.body && res.body.ok === true, 'FR-024 ok flag', 'Expected ok: true');
    assert(res.body && typeof res.body.state === 'object', 'FR-024 state object', 'Expected state object');
    assert(res.body.plan === 'basic', 'FR-024 user plan field', `Expected plan "basic", got ${res.body.plan}`);
    currentUpdatedAt = res.body.updatedAt || 0;
  }

  // 4. Successful PUT /api/user/state with valid layouts, currentLayout snapshot and sync (FR-024)
  {
    const sampleLayouts = [
      {
        id: 'usr_sample_1',
        name: 'Macro SMC Setup',
        nameFa: 'طرح تحلیلی کلان',
        layoutId: '2h',
        badge: '2 Charts',
        badgeFa: '۲ چارت',
        sync: { symbol: false, timeframe: true, crosshair: true, viewport: true, drawings: false, style: false },
        state: {
          version: 2,
          layoutId: '2h',
          name: 'Macro SMC Setup',
          activeCellId: 'c1',
          cells: [
            { id: 'c1', symbol: 'universal:BTCUSDT', timeframe: '60', priceStyle: 'candles', watermark: true, indicators: [] },
            { id: 'c2', symbol: 'universal:ETHUSDT', timeframe: '60', priceStyle: 'candles', watermark: true, indicators: [] }
          ]
        },
        date: '2026-10-23'
      }
    ];

    const sampleCurrentLayout = {
      layoutId: '2h',
      name: '2x1 Dual Horizontal',
      savedLayoutId: 'usr_sample_1',
      sync: { symbol: false, timeframe: true, crosshair: true, viewport: true, drawings: false, style: false },
      state: {
        version: 2,
        layoutId: '2h',
        name: '2x1 Dual Horizontal',
        activeCellId: 'c1',
        cells: [
          { id: 'c1', symbol: 'universal:BTCUSDT', timeframe: '60', priceStyle: 'candles', watermark: true, indicators: [] },
          { id: 'c2', symbol: 'universal:ETHUSDT', timeframe: '60', priceStyle: 'candles', watermark: true, indicators: [] }
        ],
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    const sampleLayoutSync = {
      symbol: false,
      timeframe: true,
      crosshair: true,
      viewport: true,
      drawings: false,
      style: false
    };

    const res = await request('/api/user/state', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        state: {
          layouts: JSON.stringify(sampleLayouts),
          currentLayout: JSON.stringify(sampleCurrentLayout),
          layoutSync: JSON.stringify(sampleLayoutSync)
        },
        baseUpdatedAt: currentUpdatedAt
      })
    });

    assert(res.status === 200, 'FR-024 PUT /api/user/state valid layout state', `Expected 200, got ${res.status}: ${res.rawText}`);
    assert(res.body && res.body.ok === true, 'FR-024 PUT ok flag', 'Expected ok: true');
    assert(typeof res.body.updatedAt === 'number' && res.body.updatedAt > currentUpdatedAt, 'FR-024 updatedAt incremented', 'Invalid updatedAt');
    currentUpdatedAt = res.body.updatedAt;

    // Verify GET reflects the stored state
    const verifyGet = await request('/api/user/state', { headers: authHeaders });
    assert(verifyGet.status === 200, 'FR-024 GET persisted state status', `Expected 200, got ${verifyGet.status}`);
    const parsedLayouts = JSON.parse(verifyGet.body.state.layouts);
    assert(Array.isArray(parsedLayouts) && parsedLayouts.length === 1 && parsedLayouts[0].id === 'usr_sample_1', 'FR-024 layout persistence round-trip', 'Persisted layout mismatch');
  }

  // 5. FR-025: Plan quota enforcement for saved layouts (Basic plan limit is 1)
  {
    // Basic plan allows 1 custom saved layout; submitting 3 custom layouts must be rejected with 403 limit_exceeded
    const overLimitLayouts = [
      { id: 'usr_1', name: 'Layout 1', layoutId: '1' },
      { id: 'usr_2', name: 'Layout 2', layoutId: '2h' },
      { id: 'usr_3', name: 'Layout 3', layoutId: '4' }
    ];

    const resOver = await request('/api/user/state', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        state: {
          layouts: JSON.stringify(overLimitLayouts)
        },
        baseUpdatedAt: currentUpdatedAt
      })
    });

    assert(resOver.status === 403, 'FR-025 over-quota saved layouts rejected with 403', `Expected 403, got ${resOver.status}: ${resOver.rawText}`);
    assert(resOver.body && resOver.body.error === 'limit_exceeded', 'FR-025 limit_exceeded error code', `Expected "limit_exceeded", got ${resOver.body?.error}`);
    assert(Array.isArray(resOver.body.violations) && resOver.body.violations.some(v => v.key === 'layouts'), 'FR-025 layouts violation reported', 'Missing layouts in violations');

    // Upgrade plan to "plus" via admin API (which allows up to 10 saved layouts)
    const keyPath = path.resolve(__dirname, '../../../server/data/admin_master.key');
    if (fs.existsSync(keyPath)) {
      const masterKey = fs.readFileSync(keyPath, 'utf8').trim();
      const adminAuth = await request('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey })
      });
      if (adminAuth.status === 200 && adminAuth.headers.get('set-cookie')) {
        const adminCookie = adminAuth.headers.get('set-cookie').split(';')[0];
        const patchUser = await request(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
          body: JSON.stringify({ plan: 'plus' })
        });
        assert(patchUser.status === 200, 'FR-025 admin upgrade plan to plus', `Expected 200, got ${patchUser.status}`);

        // Now submitting 3 layouts on plus plan succeeds
        const resPlus = await request('/api/user/state', {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            state: {
              layouts: JSON.stringify(overLimitLayouts)
            },
            baseUpdatedAt: currentUpdatedAt
          })
        });
        assert(resPlus.status === 200, 'FR-025 plus plan allows 3 layouts', `Expected 200 on upgraded plan, got ${resPlus.status}: ${resPlus.rawText}`);
        currentUpdatedAt = resPlus.body.updatedAt;
      }
    }
  }

  // 6. Optimistic concurrency control (409 Conflict)
  {
    const resConflict = await request('/api/user/state', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        state: { test: 'conflict-probe' },
        baseUpdatedAt: currentUpdatedAt - 1000 // stale timestamp
      })
    });

    assert(resConflict.status === 409, 'FR-024 optimistic concurrency conflict status', `Expected 409, got ${resConflict.status}`);
    assert(resConflict.body && resConflict.body.error === 'conflict', 'FR-024 conflict error code', `Expected "conflict", got ${resConflict.body?.error}`);
    assert(typeof resConflict.body.serverUpdatedAt === 'number', 'FR-024 serverUpdatedAt returned', 'Missing serverUpdatedAt in conflict response');
  }

  // 7. Payload validation: 400 Bad Request on invalid state shape
  {
    const resBad = await request('/api/user/state', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ state: 'invalid-non-object', baseUpdatedAt: currentUpdatedAt })
    });
    assert(resBad.status === 400, 'FR-024 invalid state shape returns 400', `Expected 400, got ${resBad.status}`);
    assert(resBad.body && resBad.body.error === 'invalid_state', 'FR-024 invalid_state error code', `Expected "invalid_state", got ${resBad.body?.error}`);
  }

  // 8. Payload size guard: 413 Payload Too Large on oversized state (> 2MB)
  {
    const bigBlob = 'a'.repeat(2 * 1024 * 1024 + 1024);
    const resOversize = await request('/api/user/state', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ state: { oversize: bigBlob }, baseUpdatedAt: currentUpdatedAt })
    });
    assert(resOversize.status === 413, 'FR-024 oversize state returns 413', `Expected 413, got ${resOversize.status}`);
    assert(resOversize.body && resOversize.body.error === 'state_too_large', 'FR-024 state_too_large error code', `Expected "state_too_large", got ${resOversize.body?.error}`);
  }

  // Cleanup: logout
  await request('/api/auth/logout', { method: 'POST', headers: authHeaders });
  console.log('✔ Spec 002 Cloud State HTTP API Acceptance Tests Passed.');
}

run().catch(err => {
  console.error('❌ Cloud State HTTP API fatal error:', err.message);
  process.exit(1);
});
