/**
 * @spec 006
 * @covers FR-003, FR-010, FR-013, FR-014, FR-015, FR-018
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
  console.log(`[006 API Test] Running against ${BASE_URL}...`);

  // Locate master key for admin upgrade operations
  const candidateKeys = [
    path.resolve(__dirname, '../../../server/data/admin_master.key'),
    '/root/TradingChart/server/data/admin_master.key'
  ];
  const keyPath = candidateKeys.find(p => fs.existsSync(p));
  assert(!!keyPath, 'Admin master key present', 'Could not locate admin_master.key');
  const masterKey = fs.readFileSync(keyPath, 'utf8').trim();

  // Admin login helper
  const adminAuthRes = await request('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterKey })
  });
  assert(adminAuthRes.status === 200, 'Admin login', `Expected 200, got ${adminAuthRes.status}`);
  const adminCookie = adminAuthRes.headers.get('set-cookie');

  // Register fresh temporary test user on Basic plan
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = `qa_wh_${ts}`;
  const email = `${username}@acceptance.test`;
  const password = 'QaPassword123!';

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password, displayName: 'Webhook Test User' })
  });
  assert(regRes.status === 200, 'User registration', `Expected 200, got ${regRes.status}`);
  const userCookie = regRes.headers.get('set-cookie');
  const userId = regRes.body?.user?.id;
  assert(!!userId, 'User ID defined', 'Registration response missing user.id');

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Webhook Status & Rotation Entitlement Gating (FR-013, FR-014)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Unauthenticated request to /api/user/webhook -> 401
      const resUnauth = await request('/api/user/webhook');
      assert(resUnauth.status === 401, 'FR-013 unauthenticated webhook status', `Expected 401, got ${resUnauth.status}`);
      assert(resUnauth.body?.ok === false && resUnauth.body?.error === 'unauthenticated',
        'FR-013 unauthenticated error body', `Expected unauthenticated, got ${JSON.stringify(resUnauth.body)}`);

      // Basic user request to /api/user/webhook -> enabled: false, hasToken: false, hint: null
      const resBasic = await request('/api/user/webhook', { headers: { 'Cookie': userCookie } });
      assert(resBasic.status === 200, 'FR-013 basic webhook GET status', `Expected 200, got ${resBasic.status}`);
      assert(resBasic.body?.ok === true && resBasic.body?.enabled === false && resBasic.body?.hasToken === false,
        'FR-013 basic plan webhook status fields', `Expected enabled: false, hasToken: false, got ${JSON.stringify(resBasic.body)}`);
      assert(resBasic.body?.hint === null, 'FR-013 basic plan hint null', `Expected null hint, got ${resBasic.body?.hint}`);

      // Basic user rotate request -> 403 plan_feature_locked
      const resBasicRotate = await request('/api/user/webhook/rotate', {
        method: 'POST',
        headers: { 'Cookie': userCookie }
      });
      assert(resBasicRotate.status === 403, 'FR-013 basic webhook rotate status 403', `Expected 403, got ${resBasicRotate.status}`);
      assert(resBasicRotate.body?.ok === false && resBasicRotate.body?.error === 'plan_feature_locked' && resBasicRotate.body?.feature === 'webhookAlerts',
        'FR-013 basic webhook rotate error payload', `Expected plan_feature_locked for webhookAlerts, got ${JSON.stringify(resBasicRotate.body)}`);

      // Basic user session webhook call -> 403 plan_feature_locked
      const resBasicExec = await request('/api/webhook', {
        method: 'POST',
        headers: { 'Cookie': userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.1 })
      });
      assert(resBasicExec.status === 403, 'FR-014 basic session webhook exec status 403', `Expected 403, got ${resBasicExec.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Token Generation, Rotation, and Masked Hint (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    let activeToken = null;
    let tokenHint = null;
    {
      // Upgrade user to plus plan to unlock webhookAlerts
      const upgradeRes = await request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ plan: 'plus' })
      });
      assert(upgradeRes.status === 200, 'FR-013 upgrade to plus status', `Expected 200, got ${upgradeRes.status}`);

      // Enabled should now be true
      const resPlus = await request('/api/user/webhook', { headers: { 'Cookie': userCookie } });
      assert(resPlus.status === 200, 'FR-013 plus webhook GET status', `Expected 200, got ${resPlus.status}`);
      assert(resPlus.body?.enabled === true, 'FR-013 plus plan enabled true', 'Expected enabled: true');
      assert(resPlus.body?.hasToken === false, 'FR-013 initial hasToken false', 'Expected hasToken: false');

      // Rotate token
      const rotateRes = await request('/api/user/webhook/rotate', {
        method: 'POST',
        headers: { 'Cookie': userCookie }
      });
      assert(rotateRes.status === 200, 'FR-013 rotate webhook token status 200', `Expected 200, got ${rotateRes.status}`);
      assert(rotateRes.body?.ok === true && typeof rotateRes.body?.token === 'string',
        'FR-013 rotate token returned string', `Expected string token, got ${JSON.stringify(rotateRes.body)}`);
      activeToken = rotateRes.body.token;
      tokenHint = rotateRes.body.hint;

      // Token format check: base64url length >= 24 chars, matches ^[A-Za-z0-9_-]{20,64}$
      assert(/^[A-Za-z0-9_-]{20,64}$/.test(activeToken), 'FR-013 token format regex', `Invalid token format: ${activeToken}`);
      assert(typeof tokenHint === 'string' && tokenHint.length === 4, 'FR-013 hint length 4', `Expected 4-char hint, got ${tokenHint}`);
      assert(activeToken.endsWith(tokenHint), 'FR-013 hint matches token suffix', `Hint ${tokenHint} does not match token suffix`);

      // Verify subsequent GET /api/user/webhook returns masked hint without raw token
      const resCheck = await request('/api/user/webhook', { headers: { 'Cookie': userCookie } });
      assert(resCheck.status === 200, 'FR-013 check webhook status after rotate', `Expected 200, got ${resCheck.status}`);
      assert(resCheck.body?.hasToken === true, 'FR-013 hasToken true after rotate', 'Expected hasToken: true');
      assert(resCheck.body?.hint === tokenHint, 'FR-013 hint match', `Expected ${tokenHint}, got ${resCheck.body?.hint}`);
      assert(!resCheck.body?.token, 'FR-013 raw token never leaked on GET', 'Token was exposed in GET response');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Webhook Order Execution & Input Validations (FR-014)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // 3.1 Token authentication failures
      // Malformed token format (violates ^[A-Za-z0-9_-]{20,64}$) -> 404
      const resBadFormat = await request('/api/webhook/bad*token!with$symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.1 })
      });
      assert(resBadFormat.status === 404, 'FR-014 malformed token status 404', `Expected 404, got ${resBadFormat.status}`);
      assert(resBadFormat.body?.error === 'not_found', 'FR-014 malformed token error code', 'Expected not_found');

      // Valid format but nonexistent token hash -> 404
      const resUnknownToken = await request('/api/webhook/NonExistentTokenValidFormat1234567890', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.1 })
      });
      assert(resUnknownToken.status === 404, 'FR-014 unknown token status 404', `Expected 404, got ${resUnknownToken.status}`);
      assert(resUnknownToken.body?.error === 'not_found', 'FR-014 unknown token error code', 'Expected not_found');

      // 3.2 Payload Validations via valid token (each returns 400 with specific code)
      // Invalid action
      const resBadAction = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INVALID_ACTION', symbol: 'BTCUSDT', quantity: 0.1 })
      });
      assert(resBadAction.status === 400, 'FR-014 invalid action status 400', `Expected 400, got ${resBadAction.status}`);
      assert(resBadAction.body?.error === 'invalid_action', 'FR-014 invalid_action error code', `Expected invalid_action, got ${resBadAction.body?.error}`);

      // Invalid symbol
      const resBadSymbol = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: '', quantity: 0.1 })
      });
      assert(resBadSymbol.status === 400, 'FR-014 invalid symbol status 400', `Expected 400, got ${resBadSymbol.status}`);
      assert(resBadSymbol.body?.error === 'invalid_symbol', 'FR-014 invalid_symbol error code', `Expected invalid_symbol, got ${resBadSymbol.body?.error}`);

      // Invalid quantity (negative or zero)
      const resBadQty = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: -1 })
      });
      assert(resBadQty.status === 400, 'FR-014 invalid quantity status 400', `Expected 400, got ${resBadQty.status}`);
      assert(resBadQty.body?.error === 'invalid_quantity', 'FR-014 invalid_quantity error code', `Expected invalid_quantity, got ${resBadQty.body?.error}`);

      // Invalid price (negative)
      const resBadPrice = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.1, price: -500 })
      });
      assert(resBadPrice.status === 400, 'FR-014 invalid price status 400', `Expected 400, got ${resBadPrice.status}`);
      assert(resBadPrice.body?.error === 'invalid_price', 'FR-014 invalid_price error code', `Expected invalid_price, got ${resBadPrice.body?.error}`);

      // Invalid SL/TP (NaN or invalid format)
      const resBadSlTp = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.1, sl: 'not_a_number' })
      });
      assert(resBadSlTp.status === 400, 'FR-014 invalid SL/TP status 400', `Expected 400, got ${resBadSlTp.status}`);
      assert(resBadSlTp.body?.error === 'invalid_sl_tp', 'FR-014 invalid_sl_tp error code', `Expected invalid_sl_tp, got ${resBadSlTp.body?.error}`);

      // 3.3 Valid Simulated Fill via Token
      const resValidFill = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BUY',
          symbol: 'BTCUSDT',
          quantity: 0.1,
          orderType: 'market',
          sl: 75000,
          tp: 85000
        })
      });
      assert(resValidFill.status === 200, 'FR-014 valid fill status 200', `Expected 200, got ${resValidFill.status}`);
      assert(resValidFill.body?.ok === true && resValidFill.body?.success === true,
        'FR-014 valid fill success flag', `Expected success true, got ${JSON.stringify(resValidFill.body)}`);
      assert(resValidFill.body?.log?.status === 'filled', 'FR-014 log filled status', `Expected filled, got ${resValidFill.body?.log?.status}`);
      assert(resValidFill.body?.log?.filledQuantity === 0.1, 'FR-014 filled quantity', `Expected 0.1, got ${resValidFill.body?.log?.filledQuantity}`);
      assert(Array.isArray(resValidFill.body?.account?.openPositions) && resValidFill.body.account.openPositions.length >= 1,
        'FR-014 account positions populated', 'Expected openPositions in account');

      // 3.4 Valid Simulated Fill via In-App Session endpoint POST /api/webhook
      // Wait for safety rail minimum order interval (1,000 ms)
      await new Promise(r => setTimeout(r, 1100));
      const resSessionFill = await request('/api/webhook', {
        method: 'POST',
        headers: { 'Cookie': userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'ETHUSDT', quantity: 0.5 })
      });
      assert(resSessionFill.status === 200, 'FR-014 session webhook exec status 200', `Expected 200, got ${resSessionFill.status}`);
      assert(resSessionFill.body?.ok === true && resSessionFill.body?.success === true,
        'FR-014 session webhook success flag', 'Expected success true on session execution');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Trade-Relay Safety Rails & Account Query (FR-015)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Wait for safety rail minimum order interval (1,000 ms)
      await new Promise(r => setTimeout(r, 1100));

      // 4.1 Single Order Notional Safety Cap ($50,000 ceiling)
      // 10 units at $60,000 = $600,000 notional > $50,000 cap
      const resCap = await request(`/api/webhook/${activeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 10, price: 60000 })
      });
      assert(resCap.status === 400, 'FR-015 notional safety cap status 400', `Expected 400, got ${resCap.status}`);
      assert(typeof resCap.body?.error === 'string' && resCap.body.error.includes('exceeds safety cap of $50000'),
        'FR-015 notional cap error message', `Expected exceeds safety cap of $50000, got ${resCap.body?.error}`);
      assert(resCap.body?.log?.status === 'rejected', 'FR-015 notional cap rejected log', `Expected rejected status, got ${resCap.body?.log?.status}`);

      // 4.2 Minimum Order Interval Rate Limit (< 1,000 ms spacing)
      // Rapidly dispatch two consecutive orders without awaiting interval
      const [resRapid1, resRapid2] = await Promise.all([
        request(`/api/webhook/${activeToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.05 })
        }),
        request(`/api/webhook/${activeToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'BUY', symbol: 'BTCUSDT', quantity: 0.05 })
        })
      ]);
      const hasRateLimitHit = [resRapid1, resRapid2].some(r => r.status === 400 && typeof r.body?.error === 'string' && r.body.error.includes('Rate limit exceeded'));
      assert(hasRateLimitHit, 'FR-015 order interval rate limiter', 'Expected rate limit rejection on rapid consecutive orders');

      // 4.3 Inspect Trade-Relay Account Endpoint
      const resRelayAcc = await request('/api/trade-relay/account', { headers: { 'Cookie': userCookie } });
      assert(resRelayAcc.status === 200, 'FR-015 trade-relay account GET status', `Expected 200, got ${resRelayAcc.status}`);
      assert(typeof resRelayAcc.body?.balance === 'number' && resRelayAcc.body?.initialBalance === 100000,
        'FR-015 trade-relay balance and initialBalance', `Expected 100000 initial balance, got ${resRelayAcc.body?.initialBalance}`);
      assert(Array.isArray(resRelayAcc.body?.positions), 'FR-015 trade-relay positions array', 'Missing positions array');
      assert(Array.isArray(resRelayAcc.body?.recentLogs) && resRelayAcc.body.recentLogs.length > 0,
        'FR-015 trade-relay recentLogs populated', 'Expected recentLogs to contain executed and rejected logs');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Cloud State Persistence & Quota Enforcement (FR-003, FR-010, FR-018)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // 5.1 Valid Cloud State PUT and GET Round-Trip (FR-018)
      const validPaperAccounts = [
        { id: 'pap_main', name: 'Main Paper', balance: 100000, positions: [], history: [] }
      ];
      const validAlerts = [
        { id: 'alt-demo-1', symbol: 'BTCUSDT', targetPrice: 79000, direction: 'above', active: true },
        { id: 'alt-demo-2', symbol: 'ETHUSDT', targetPrice: 2800, direction: 'below', active: true }
      ];

      const savePayload = {
        state: {
          alerts: JSON.stringify(validAlerts),
          paperAccounts: JSON.stringify(validPaperAccounts),
          paperActive: 'pap_main'
        }
      };

      const putRes = await request('/api/user/state', {
        method: 'PUT',
        headers: { 'Cookie': userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload)
      });
      assert(putRes.status === 200, 'FR-018 save cloud state status 200', `Expected 200, got ${putRes.status}`);
      assert(putRes.body?.ok === true && typeof putRes.body?.updatedAt === 'number',
        'FR-018 save cloud state response envelope', `Expected {ok: true, updatedAt}, got ${JSON.stringify(putRes.body)}`);

      const getRes = await request('/api/user/state', { headers: { 'Cookie': userCookie } });
      assert(getRes.status === 200, 'FR-018 get cloud state status 200', `Expected 200, got ${getRes.status}`);
      assert(getRes.body?.ok === true && getRes.body?.state?.paperActive === 'pap_main',
        'FR-018 retrieved paperActive match', `Expected paperActive pap_main, got ${getRes.body?.state?.paperActive}`);

      const retrievedAlerts = JSON.parse(getRes.body.state.alerts);
      assert(Array.isArray(retrievedAlerts) && retrievedAlerts.length === 2,
        'FR-018 retrieved alerts length', `Expected 2 alerts, got ${retrievedAlerts.length}`);

      // 5.2 Quota Enforcement on Basic Plan (Downgrade user back to basic)
      const downgradeRes = await request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ plan: 'basic' })
      });
      assert(downgradeRes.status === 200, 'Downgrade to basic plan', `Expected 200, got ${downgradeRes.status}`);

      // Basic priceAlerts limit is 3. Attempt to save 4 alerts -> 403 limit_exceeded
      const overQuotaAlerts = [
        { id: 'a1', symbol: 'BTCUSDT', targetPrice: 100, direction: 'above', active: true },
        { id: 'a2', symbol: 'BTCUSDT', targetPrice: 200, direction: 'above', active: true },
        { id: 'a3', symbol: 'BTCUSDT', targetPrice: 300, direction: 'above', active: true },
        { id: 'a4', symbol: 'BTCUSDT', targetPrice: 400, direction: 'above', active: true }
      ];
      const resOverAlerts = await request('/api/user/state', {
        method: 'PUT',
        headers: { 'Cookie': userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: { alerts: JSON.stringify(overQuotaAlerts) } })
      });
      assert(resOverAlerts.status === 403, 'FR-010 over-quota alerts status 403', `Expected 403, got ${resOverAlerts.status}`);
      assert(resOverAlerts.body?.error === 'limit_exceeded', 'FR-010 over-quota alerts error code', 'Expected limit_exceeded');
      assert(Array.isArray(resOverAlerts.body?.violations) && resOverAlerts.body.violations.some(v => v.key === 'alerts' && v.limit === 3),
        'FR-010 alerts violation entry', `Expected violation on alerts key, got ${JSON.stringify(resOverAlerts.body)}`);

      // Basic paperAccounts limit is 1. Attempt to save 2 accounts -> 403 limit_exceeded
      const overQuotaPaper = [
        { id: 'p1', name: 'Main Paper', balance: 100000, positions: [], history: [] },
        { id: 'p2', name: 'Second Account', balance: 100000, positions: [], history: [] }
      ];
      const resOverPaper = await request('/api/user/state', {
        method: 'PUT',
        headers: { 'Cookie': userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: { paperAccounts: JSON.stringify(overQuotaPaper) } })
      });
      assert(resOverPaper.status === 403, 'FR-003 over-quota paperAccounts status 403', `Expected 403, got ${resOverPaper.status}`);
      assert(resOverPaper.body?.error === 'limit_exceeded', 'FR-003 over-quota paperAccounts error code', 'Expected limit_exceeded');
      assert(Array.isArray(resOverPaper.body?.violations) && resOverPaper.body.violations.some(v => v.key === 'paperAccounts' && v.limit === 1),
        'FR-003 paperAccounts violation entry', `Expected violation on paperAccounts key, got ${JSON.stringify(resOverPaper.body)}`);
    }

    console.log('PASS: 006 [Webhook, Trade-Relay & Cloud State API]');
  } finally {
    // Clean up temporary user and admin session
    if (adminCookie && userId) {
      await request(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ confirm: username })
      });
      await request('/api/admin/logout', { method: 'POST', headers: { 'Cookie': adminCookie } });
    }
  }
}

run().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
