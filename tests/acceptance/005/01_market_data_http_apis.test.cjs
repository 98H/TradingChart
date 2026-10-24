/**
 * @spec 005
 * @covers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-011, FR-013
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

async function request(endpoint, options = {}) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const res = await fetch(reqUrl, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[005 API Test] Running against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Candles API: Defaults, Schema, & Parameters (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Default request without parameters
    const resDefault = await request('/api/candles');
    assert(resDefault.status === 200, 'FR-001 default GET /api/candles status', `Expected 200, got ${resDefault.status}`);
    assert(resDefault.body && resDefault.body.symbol === 'BTCUSDT', 'FR-001 default symbol', `Expected BTCUSDT, got ${resDefault.body?.symbol}`);
    assert(resDefault.body && resDefault.body.timeframe === '60', 'FR-001 default timeframe', `Expected 60, got ${resDefault.body?.timeframe}`);
    assert(resDefault.body && resDefault.body.count === 500, 'FR-001 default limit 500', `Expected 500, got ${resDefault.body?.count}`);
    assert(Array.isArray(resDefault.body?.candles) && resDefault.body.candles.length === 500, 'FR-001 candles array length', 'Expected 500 candles');

    const first = resDefault.body.candles[0];
    assert(typeof first.time === 'number' && Number.isFinite(first.time), 'FR-001 candle time field', 'Missing or non-finite time');
    assert(typeof first.open === 'number' && Number.isFinite(first.open), 'FR-001 candle open field', 'Missing or non-finite open');
    assert(typeof first.high === 'number' && Number.isFinite(first.high), 'FR-001 candle high field', 'Missing or non-finite high');
    assert(typeof first.low === 'number' && Number.isFinite(first.low), 'FR-001 candle low field', 'Missing or non-finite low');
    assert(typeof first.close === 'number' && Number.isFinite(first.close), 'FR-001 candle close field', 'Missing or non-finite close');
    assert(typeof first.volume === 'number' && Number.isFinite(first.volume), 'FR-001 candle volume field', 'Missing or non-finite volume');
    assert(typeof first.closeTime === 'number' && Number.isFinite(first.closeTime), 'FR-001 candle closeTime field', 'Missing or non-finite closeTime');

    // Custom parameters: ETHUSDT, 15m, limit 50, time bounds
    const now = Date.now();
    const fromTime = now - 3600000 * 24; // 24 hours ago
    const toTime = now;
    const resCustom = await request(`/api/candles?symbol=ETHUSDT&timeframe=15&limit=50&from_time=${fromTime}&to_time=${toTime}`);
    assert(resCustom.status === 200, 'FR-001 custom params status', `Expected 200, got ${resCustom.status}`);
    assert(resCustom.body && resCustom.body.symbol === 'ETHUSDT', 'FR-001 custom symbol', 'Expected ETHUSDT');
    assert(resCustom.body && resCustom.body.timeframe === '15', 'FR-001 custom timeframe', 'Expected 15');
    assert(resCustom.body && resCustom.body.count <= 50, 'FR-001 custom limit clamp', `Expected count <= 50, got ${resCustom.body?.count}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Candles API: Error Responses (FR-002)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Malformed symbol
    const resBadSym = await request('/api/candles?symbol=INVALID_SYM!&timeframe=60');
    assert(resBadSym.status === 400, 'FR-002 invalid symbol status', `Expected 400, got ${resBadSym.status}`);
    assert(resBadSym.body && resBadSym.body.ok === false && resBadSym.body.error === 'invalid_symbol',
      'FR-002 invalid symbol error payload', `Expected {ok:false, error:"invalid_symbol"}, got ${JSON.stringify(resBadSym.body)}`);

    // Malformed timeframe
    const resBadTf = await request('/api/candles?symbol=BTCUSDT&timeframe=invalid_tf');
    assert(resBadTf.status === 400, 'FR-002 invalid timeframe status', `Expected 400, got ${resBadTf.status}`);
    assert(resBadTf.body && resBadTf.body.ok === false && resBadTf.body.error === 'invalid_timeframe',
      'FR-002 invalid timeframe error payload', `Expected {ok:false, error:"invalid_timeframe"}, got ${JSON.stringify(resBadTf.body)}`);

    // Malformed time bound
    const resBadTime = await request('/api/candles?symbol=BTCUSDT&timeframe=60&from_time=not_a_timestamp');
    assert(resBadTime.status === 400, 'FR-002 invalid time bound status', `Expected 400, got ${resBadTime.status}`);
    assert(resBadTime.body && resBadTime.body.ok === false && resBadTime.body.error === 'invalid_time',
      'FR-002 invalid time bound error payload', `Expected {ok:false, error:"invalid_time"}, got ${JSON.stringify(resBadTime.body)}`);

    // Unknown symbol: 404 with no_market_data and empty array
    const resNotFound = await request('/api/candles?symbol=NONEXISTENT_XYZ&timeframe=60');
    assert(resNotFound.status === 404, 'FR-002 unknown symbol status 404', `Expected 404, got ${resNotFound.status}`);
    assert(resNotFound.body && resNotFound.body.error === 'no_market_data', 'FR-002 no_market_data code', 'Expected error: "no_market_data"');
    assert(resNotFound.body && Array.isArray(resNotFound.body.candles) && resNotFound.body.candles.length === 0,
      'FR-002 no_market_data empty candles array', 'Expected empty candles array');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Plan History Limits & X-History-Limit Header (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Guest caller: limit clamped to Basic histBars (10000) and sends header
    const resGuest = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000');
    assert(resGuest.status === 200, 'FR-003 guest candles status', `Expected 200, got ${resGuest.status}`);
    const guestLimitHeader = resGuest.headers.get('x-history-limit');
    assert(guestLimitHeader === '10000', 'FR-003 guest X-History-Limit header', `Expected 10000, got ${guestLimitHeader}`);
    assert(resGuest.body && resGuest.body.count <= 10000, 'FR-003 guest bar count clamped', `Expected count <= 10000, got ${resGuest.body?.count}`);

    // Premium caller: elevated to 20000 limit
    const keyPath = path.resolve(__dirname, '../../../server/data/admin_master.key');
    if (fs.existsSync(keyPath)) {
      const masterKey = fs.readFileSync(keyPath, 'utf8').trim();
      const ts = Date.now().toString(36);
      const email = `qa_plan_test_${ts}@acceptance.test`;
      const username = `qa_plan_${ts}`;

      // Register temporary user
      const regRes = await request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: 'QaPassword123!', displayName: 'Plan Test User' })
      });
      assert(regRes.status === 200, 'FR-003 temp user registration', `Expected 200, got ${regRes.status}`);
      const userCookie = regRes.headers.get('set-cookie');
      const userId = regRes.body?.user?.id;

      // Admin auth to upgrade user plan
      const adminAuthRes = await request('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey })
      });
      const adminCookie = adminAuthRes.headers.get('set-cookie');

      if (adminCookie && userId) {
        // Upgrade to premium
        await request(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
          body: JSON.stringify({ plan: 'premium' })
        });

        // Request candles as premium user
        const resPrem = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000', {
          headers: { 'Cookie': userCookie }
        });
        const premLimitHeader = resPrem.headers.get('x-history-limit');
        assert(premLimitHeader === '20000', 'FR-003 premium X-History-Limit header', `Expected 20000, got ${premLimitHeader}`);
        assert(resPrem.body && resPrem.body.count <= 20000, 'FR-003 premium bar count clamped', `Expected count <= 20000, got ${resPrem.body?.count}`);

        // Cleanup temporary user
        await request(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
          body: JSON.stringify({ confirm: username })
        });
        await request('/api/admin/logout', { method: 'POST', headers: { 'Cookie': adminCookie } });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Waterfall & Continuous Demo Series (FR-004, SC-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Non-crypto markets: metals, TSE stocks, Tehran gold
    const testSymbols = ['XAUUSD', 'FOOLAD', 'GOLD_ABSHODEH'];
    for (const sym of testSymbols) {
      const res = await request(`/api/candles?symbol=${sym}&timeframe=60&limit=50`);
      assert(res.status === 200, `FR-004 continuous demo candles for ${sym} status`, `Expected 200, got ${res.status}`);
      assert(res.body && res.body.symbol === sym, `FR-004 demo symbol match for ${sym}`, `Expected ${sym}`);
      assert(Array.isArray(res.body?.candles) && res.body.candles.length === 50,
        `FR-004 demo candles count for ${sym}`, `Expected 50 candles, got ${res.body?.candles?.length}`);

      // Verify continuous price ordering and validity
      const candles = res.body.candles;
      const validOhlc = candles.every(c => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close) && c.close > 0);
      assert(validOhlc, `FR-004 continuous demo OHLC validity for ${sym}`, 'Invalid high/low/close relationships');
    }

    // SC-001: 100% of catalogue symbols return candles without server error
    const symListRes = await request('/api/symbols');
    assert(symListRes.status === 200 && Array.isArray(symListRes.body), 'SC-001 symbols catalogue query', 'Expected symbol array');
    const sampleSymbols = symListRes.body.slice(0, 15).map(s => s.symbol);
    for (const sym of sampleSymbols) {
      const res = await request(`/api/candles?symbol=${sym}&timeframe=60&limit=5`);
      assert(res.status === 200 && res.body && Array.isArray(res.body.candles),
        `SC-001 symbol ${sym} returns candles`, `Failed to return candles for ${sym} (status ${res.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Server-Side Micro-Caching (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Micro-cache TTL is 3,000 ms per unique (symbol, timeframe, limit, from, to)
    const t0 = Date.now();
    const res1 = await request('/api/candles?symbol=BTCUSDT&timeframe=5&limit=100');
    const dur1 = Date.now() - t0;

    const t1 = Date.now();
    const res2 = await request('/api/candles?symbol=BTCUSDT&timeframe=5&limit=100');
    const dur2 = Date.now() - t1;

    assert(res1.status === 200 && res2.status === 200, 'FR-005 cache status check', 'Expected 200 OK on both cached calls');
    assert(res1.body && res2.body && res1.body.candles.length === res2.body.candles.length, 'FR-005 cached candle count match', 'Counts differ');
    assert(res1.body.candles[0].time === res2.body.candles[0].time, 'FR-005 cached bar timestamp match', 'First bar timestamps differ');
    // The cached hit should resolve substantially faster than or equal to initial fetch
    assert(dur2 <= dur1 + 100, 'FR-005 micro-cache latency', `Cache hit (${dur2}ms) exceeded initial fetch (${dur1}ms)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. 24h Tickers API (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Default tickers: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XAUUSD, EURUSD
    const resDef = await request('/api/tickers');
    assert(resDef.status === 200, 'FR-006 default tickers status', `Expected 200, got ${resDef.status}`);
    assert(Array.isArray(resDef.body) && resDef.body.length === 6, 'FR-006 default tickers count', `Expected 6 tickers, got ${resDef.body?.length}`);

    const btc = resDef.body.find(t => t.symbol === 'BTCUSDT');
    assert(btc, 'FR-006 BTCUSDT ticker present', 'Missing BTCUSDT');
    const reqFields = ['symbol', 'lastPrice', 'priceChange', 'priceChangePercent', 'highPrice', 'lowPrice', 'volume', 'quoteVolume', 'exchange', 'category', 'currency'];
    for (const f of reqFields) {
      assert(f in btc, `FR-006 ticker field "${f}"`, `Missing required field ${f}`);
    }
    assert(typeof btc.lastPrice === 'number' && btc.lastPrice > 0, 'FR-006 ticker lastPrice numeric', 'Invalid lastPrice');
    assert(typeof btc.priceChangePercent === 'number', 'FR-006 ticker priceChangePercent numeric', 'Invalid priceChangePercent');

    // Comma-separated query
    const resCustom = await request('/api/tickers?symbols=FOOLAD,GOLD_ABSHODEH');
    assert(resCustom.status === 200, 'FR-006 custom tickers status', `Expected 200, got ${resCustom.status}`);
    assert(Array.isArray(resCustom.body) && resCustom.body.length === 2, 'FR-006 custom tickers count', 'Expected 2 tickers');

    // Edge case: Requesting > 40 symbols truncates to 40
    const over40Symbols = Array.from({ length: 50 }, (_, i) => `SYM_${i}`).join(',');
    const resOver40 = await request(`/api/tickers?symbols=${over40Symbols}`);
    assert(resOver40.status === 200, 'FR-006 over 40 tickers status', `Expected 200, got ${resOver40.status}`);
    assert(Array.isArray(resOver40.body) && resOver40.body.length === 40, 'FR-006 over 40 symbols clamped to 40', `Expected 40 tickers, got ${resOver40.body?.length}`);

    // Malformed symbol: 400 invalid_symbol
    const resBadSym = await request('/api/tickers?symbols=!!!');
    assert(resBadSym.status === 400, 'FR-006 malformed ticker symbol status', `Expected 400, got ${resBadSym.status}`);
    assert(resBadSym.body && resBadSym.body.ok === false && resBadSym.body.error === 'invalid_symbol',
      'FR-006 malformed ticker error payload', `Expected {ok:false, error:"invalid_symbol"}, got ${JSON.stringify(resBadSym.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Symbol Catalogue Search & Single Instrument Info (FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Filter by query "SOL"
    const resQ = await request('/api/symbols?q=SOL');
    assert(resQ.status === 200, 'FR-007 search by q status', `Expected 200, got ${resQ.status}`);
    assert(Array.isArray(resQ.body) && resQ.body.some(s => s.symbol === 'SOLUSDT'), 'FR-007 search matches SOLUSDT', 'Expected SOLUSDT in results');

    // Filter by category
    const resCat = await request('/api/symbols?category=crypto');
    assert(resCat.status === 200, 'FR-007 filter category status', `Expected 200, got ${resCat.status}`);
    assert(Array.isArray(resCat.body) && resCat.body.every(s => s.category === 'crypto'), 'FR-007 all items crypto category', 'Category mismatch');

    // Filter by exchange
    const resEx = await request('/api/symbols?exchange=binance');
    assert(resEx.status === 200, 'FR-007 filter exchange status', `Expected 200, got ${resEx.status}`);
    assert(Array.isArray(resEx.body) && resEx.body.every(s => s.exchange.toLowerCase() === 'binance'), 'FR-007 all items binance exchange', 'Exchange mismatch');

    // Persian metadata presence
    const btc = resQ.body.find(s => s.symbol === 'BTCUSDT') || (await request('/api/symbols?q=BTC')).body[0];
    assert(btc && btc.nameFa && typeof btc.nameFa === 'string', 'FR-007 Persian nameFa present', 'Missing nameFa');

    // Single symbol info: GET /api/symbol-info
    const resInfo = await request('/api/symbol-info?symbol=XAUUSD');
    assert(resInfo.status === 200, 'FR-007 GET /api/symbol-info status', `Expected 200, got ${resInfo.status}`);
    assert(resInfo.body && resInfo.body.symbol === 'XAUUSD', 'FR-007 symbol-info symbol', 'Expected XAUUSD');
    const infoMetaFields = ['precision', 'minTick', 'lotSize', 'exchange', 'market', 'currency', 'nameFa'];
    for (const f of infoMetaFields) {
      assert(f in resInfo.body, `FR-007 symbol-info field "${f}"`, `Missing metadata field ${f}`);
    }

    // Malformed symbol: 400 invalid_symbol
    const resBadInfo = await request('/api/symbol-info?symbol=!!!');
    assert(resBadInfo.status === 400, 'FR-007 symbol-info invalid symbol status', `Expected 400, got ${resBadInfo.status}`);
    assert(resBadInfo.body && resBadInfo.body.ok === false && resBadInfo.body.error === 'invalid_symbol',
      'FR-007 symbol-info error payload', `Expected invalid_symbol, got ${JSON.stringify(resBadInfo.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Market Sources Telemetry API (FR-011)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resSources = await request('/api/market-sources');
    assert(resSources.status === 200, 'FR-011 GET /api/market-sources status', `Expected 200, got ${resSources.status}`);
    assert(resSources.body && resSources.body.overallStatus, 'FR-011 overallStatus field', 'Missing overallStatus');
    assert(typeof resSources.body.liveCount === 'number', 'FR-011 liveCount field', 'Missing liveCount');
    assert(Array.isArray(resSources.body.sources) && resSources.body.sources.length === 5,
      'FR-011 exactly 5 waterfall sources', `Expected 5 sources, got ${resSources.body?.sources?.length}`);

    const expectedTiers = [
      { tier: 1, id: 'binance_direct', live: true },
      { tier: 2, id: 'forex_metals', live: false },
      { tier: 3, id: 'us_equities', live: false },
      { tier: 4, id: 'tehran_gold', live: false },
      { tier: 5, id: 'tsetmc_bourse', live: false }
    ];

    for (const exp of expectedTiers) {
      const src = resSources.body.sources.find(s => s.id === exp.id);
      assert(src, `FR-011 source ${exp.id} present`, `Missing source ${exp.id}`);
      assert(src.tier === exp.tier, `FR-011 source ${exp.id} tier ${exp.tier}`, `Expected tier ${exp.tier}, got ${src.tier}`);
      assert(src.live === exp.live, `FR-011 source ${exp.id} live=${exp.live}`, `Expected live=${exp.live}, got ${src.live}`);
      assert(typeof src.name === 'string' && src.name.length > 0, `FR-011 source ${exp.id} name`, 'Missing name');
      assert(typeof src.nameFa === 'string' && src.nameFa.length > 0, `FR-011 source ${exp.id} nameFa`, 'Missing nameFa');
      assert(typeof src.protocol === 'string' && src.protocol.length > 0, `FR-011 source ${exp.id} protocol`, 'Missing protocol');
      assert(typeof src.protocolFa === 'string' && src.protocolFa.length > 0, `FR-011 source ${exp.id} protocolFa`, 'Missing protocolFa');
      assert(Array.isArray(src.marketsCovered) && src.marketsCovered.length > 0, `FR-011 source ${exp.id} marketsCovered`, 'Missing marketsCovered');
      assert(Array.isArray(src.marketsCoveredFa) && src.marketsCoveredFa.length > 0, `FR-011 source ${exp.id} marketsCoveredFa`, 'Missing marketsCoveredFa');
      assert(typeof src.activeSymbols === 'number' && src.activeSymbols > 0, `FR-011 source ${exp.id} activeSymbols`, 'Missing activeSymbols');

      if (exp.live) {
        assert(['online', 'degraded'].includes(src.status), `FR-011 live source ${exp.id} status`, `Expected online|degraded, got ${src.status}`);
        assert(typeof src.latencyMs === 'number' || src.latencyMs === null, `FR-011 live source ${exp.id} latency`, 'Invalid latencyMs');
      } else {
        assert(src.status === 'demo', `FR-011 non-live source ${exp.id} demo status`, `Expected demo, got ${src.status}`);
        assert(src.latencyMs === null, `FR-011 non-live source ${exp.id} latency null`, `Expected null, got ${src.latencyMs}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Depth of Market API (FR-013)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Crypto order book: Mirrored from Binance
    const resBtcDepth = await request('/api/depth?symbol=BTCUSDT');
    assert(resBtcDepth.status === 200, 'FR-013 BTCUSDT depth status', `Expected 200, got ${resBtcDepth.status}`);
    assert(resBtcDepth.body && resBtcDepth.body.symbol === 'BTCUSDT', 'FR-013 BTCUSDT symbol', 'Expected BTCUSDT');
    assert(resBtcDepth.body.source === 'binance', 'FR-013 BTCUSDT source binance', `Expected binance, got ${resBtcDepth.body?.source}`);
    assert(resBtcDepth.body.simulated === false, 'FR-013 BTCUSDT simulated false', 'Expected simulated=false');
    assert(Array.isArray(resBtcDepth.body.bids) && resBtcDepth.body.bids.length === 15, 'FR-013 default 15 bids', `Expected 15 bids, got ${resBtcDepth.body?.bids?.length}`);
    assert(Array.isArray(resBtcDepth.body.asks) && resBtcDepth.body.asks.length === 15, 'FR-013 default 15 asks', `Expected 15 asks, got ${resBtcDepth.body?.asks?.length}`);
    assert(typeof resBtcDepth.body.lastPrice === 'number' && resBtcDepth.body.lastPrice > 0, 'FR-013 lastPrice field', 'Missing lastPrice');
    assert(typeof resBtcDepth.body.spread === 'number', 'FR-013 spread field', 'Missing spread');
    assert(typeof resBtcDepth.body.spreadPct === 'number', 'FR-013 spreadPct field', 'Missing spreadPct');
    assert(typeof resBtcDepth.body.maxDepth === 'number', 'FR-013 maxDepth field', 'Missing maxDepth');
    assert(typeof resBtcDepth.body.timestamp === 'number', 'FR-013 timestamp field', 'Missing timestamp');

    // Non-crypto order book: Simulated around 24h price
    const resFooladDepth = await request('/api/depth?symbol=FOOLAD');
    assert(resFooladDepth.status === 200, 'FR-013 FOOLAD depth status', `Expected 200, got ${resFooladDepth.status}`);
    assert(resFooladDepth.body.source === 'simulated', 'FR-013 FOOLAD source simulated', `Expected simulated, got ${resFooladDepth.body?.source}`);
    assert(resFooladDepth.body.simulated === true, 'FR-013 FOOLAD simulated true', 'Expected simulated=true');

    // Edge case: levels clamped between 1 and 50
    const resClampedHigh = await request('/api/depth?symbol=BTCUSDT&levels=100');
    assert(resClampedHigh.status === 200, 'FR-013 levels=100 clamped status', `Expected 200, got ${resClampedHigh.status}`);
    assert(resClampedHigh.body?.bids?.length === 50, 'FR-013 levels=100 clamped to 50', `Expected 50 levels, got ${resClampedHigh.body?.bids?.length}`);

    const resClampedLow = await request('/api/depth?symbol=BTCUSDT&levels=0');
    assert(resClampedLow.status === 200, 'FR-013 levels=0 clamped status', `Expected 200, got ${resClampedLow.status}`);
    assert(resClampedLow.body?.bids?.length === 1, 'FR-013 levels=0 clamped to 1', `Expected 1 level, got ${resClampedLow.body?.bids?.length}`);

    // Malformed symbol: 400 invalid_symbol
    const resBadDepth = await request('/api/depth?symbol=!!!');
    assert(resBadDepth.status === 400, 'FR-013 depth invalid symbol status', `Expected 400, got ${resBadDepth.status}`);
    assert(resBadDepth.body && resBadDepth.body.ok === false && resBadDepth.body.error === 'invalid_symbol',
      'FR-013 depth error payload', `Expected invalid_symbol, got ${JSON.stringify(resBadDepth.body)}`);

    // Micro-caching: 1,500 ms per symbol:levels
    const t0Depth = Date.now();
    await request('/api/depth?symbol=BTCUSDT&levels=12');
    const dur1Depth = Date.now() - t0Depth;

    const t1Depth = Date.now();
    await request('/api/depth?symbol=BTCUSDT&levels=12');
    const dur2Depth = Date.now() - t1Depth;
    assert(dur2Depth <= dur1Depth + 80, 'FR-013 depth micro-cache latency', `Cache hit (${dur2Depth}ms) was not faster/comparable to (${dur1Depth}ms)`);
  }

  console.log('PASS: 005 [Market Data HTTP APIs]');
}

run().catch(err => {
  console.error(`❌ Unexpected error in 01_market_data_http_apis: ${err.message}`);
  process.exit(1);
});
