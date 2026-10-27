/**
 * @spec 014
 * @covers FR-004, FR-005, FR-010
 */
const { spawn } = require('child_process');
const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function request(endpoint, options = {}, base = BASE_URL) {
  const reqUrl = `${base}${endpoint}`;
  const res = await fetch(reqUrl, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[014 Acceptance Suite 02] Running Crypto Deep History, Outage Resilience & Memory Safety against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Honest Deep History: Real Upstream Bars Only (FR-004)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // BTCUSDT Daily with deep limit 10000:
    // Binance started BTCUSDT trading on 2017-08-17 (approx epoch ms 1502928000000).
    // The server MUST NOT pad history with generated bars at price ≈100 back to 1999 or 2013.
    const resBtcDeep = await request('/api/candles?symbol=BTCUSDT&timeframe=D&limit=10000');
    assert(resBtcDeep.status === 200, 'FR-004 BTCUSDT D limit 10000 status 200', `Expected 200, got ${resBtcDeep.status}`);
    const btcCandles = resBtcDeep.body?.candles || [];
    assert(btcCandles.length > 0, 'FR-004 BTCUSDT D candles non-empty', 'Expected candles');

    const firstBtcBar = btcCandles[0];
    const binanceBtcListingMs = 1502928000000; // 2017-08-17 00:00:00 UTC
    assert(firstBtcBar.time >= binanceBtcListingMs, 'FR-004 BTCUSDT first bar not earlier than listing date',
      `First bar time is ${firstBtcBar.time} (${new Date(firstBtcBar.time).toISOString()}), earlier than listing ${binanceBtcListingMs} (2017-08-17)`);

    // Verify first bar is not a fabricated bar at price ≈100
    assert(firstBtcBar.open > 1000, 'FR-004 BTCUSDT first bar price is real (> 1000)',
      `First bar open is ${firstBtcBar.open}, looks like fabricated price-100 placeholder`);

    // Verify count reflects real bars (< 10000 since 2017 to 2026 is ~3400 days)
    assert(resBtcDeep.body.count === btcCandles.length, 'FR-004 count matches real bars length',
      `count ${resBtcDeep.body.count} != candles.length ${btcCandles.length}`);
    assert(resBtcDeep.body.count < 10000, 'FR-004 count not padded to requested limit',
      `Expected real count < 10000, got ${resBtcDeep.body.count}`);

    // TONUSDT Daily with deep limit 5000:
    // Paging before listing date must return 200 with real bars since listing, NOT 404 no_market_data.
    const resTonDeep = await request('/api/candles?symbol=TONUSDT&timeframe=D&limit=5000');
    assert(resTonDeep.status === 200, 'FR-004 TONUSDT D limit 5000 returns 200 (not 404)',
      `Expected 200, got ${resTonDeep.status}: ${JSON.stringify(resTonDeep.body)}`);
    const tonCandles = resTonDeep.body?.candles || [];
    assert(tonCandles.length > 0, 'FR-004 TONUSDT candles returned', 'Expected real TON bars');
    assert(resTonDeep.body.count === tonCandles.length, 'FR-004 TONUSDT count matches bars',
      `count ${resTonDeep.body.count} != candles.length ${tonCandles.length}`);

    // TAOUSDT Daily with limit 5000:
    const resTaoDeep = await request('/api/candles?symbol=TAOUSDT&timeframe=D&limit=5000');
    assert(resTaoDeep.status === 200, 'FR-004 TAOUSDT D limit 5000 returns 200',
      `Expected 200, got ${resTaoDeep.status}: ${JSON.stringify(resTaoDeep.body)}`);
    const taoCandles = resTaoDeep.body?.candles || [];
    assert(taoCandles.length > 0, 'FR-004 TAOUSDT candles returned', 'Expected real TAO bars');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Data Source Transparency & Upstream Outage Handling (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Normal 200 request must have source:"binance" and header X-Data-Source: binance
    const resNormal = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=10');
    assert(resNormal.status === 200, 'FR-005 normal BTCUSDT status 200', `Expected 200, got ${resNormal.status}`);
    assert(resNormal.body?.source === 'binance' || resNormal.body?.source === 'cache', 'FR-005 body source binance/cache',
      `Expected "binance"|"cache", got "${resNormal.body?.source}"`);
    assert(resNormal.headers.get('x-data-source') === resNormal.body?.source, 'FR-005 X-Data-Source header matches body source',
      `Expected header "${resNormal.body?.source}", got "${resNormal.headers.get('x-data-source')}"`);

    // Verify outage behavior using an isolated temporary server pointing TC_BINANCE_BASES to an unreachable address
    const testPort = 18195;
    const testBaseUrl = `http://127.0.0.1:${testPort}`;
    console.log(`[014 Acceptance Suite 02] Testing TC_BINANCE_BASES outage handling on ephemeral port ${testPort}...`);

    let outageServer = null;
    try {
      outageServer = spawn('node', ['server/index.js'], {
        env: {
          ...process.env,
          PORT: String(testPort),
          TC_BINANCE_BASES: 'http://127.0.0.1:9' // unreachable port 9 (discard protocol)
        },
        stdio: 'pipe'
      });

      // Wait for server to listen on testPort
      let ready = false;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        try {
          const probe = await fetch(`${testBaseUrl}/`);
          if (probe.status < 500) { ready = true; break; }
        } catch (e) {}
        if (outageServer.exitCode !== null) break;
      }
      assert(ready, 'FR-005 outage server spawned successfully', 'Failed to boot temporary server with bad TC_BINANCE_BASES');

      // Query a symbol that was never cached on this fresh instance:
      // Must return 503 { ok: false, error: "upstream_unavailable" }
      // It MUST NOT generate fake bars at price ≈100 or fall back to demo generator for crypto!
      const resOutage = await request('/api/candles?symbol=SOLUSDT&timeframe=15&limit=10', {}, testBaseUrl);
      assert(resOutage.status === 503, 'FR-005 crypto outage status 503',
        `Expected 503 upstream_unavailable, got ${resOutage.status}: ${JSON.stringify(resOutage.body)}`);
      assert(resOutage.body?.ok === false && resOutage.body?.error === 'upstream_unavailable',
        'FR-005 crypto outage error payload',
        `Expected {ok:false, error:"upstream_unavailable"}, got ${JSON.stringify(resOutage.body)}`);
    } finally {
      if (outageServer && outageServer.exitCode === null) {
        try { outageServer.kill('SIGTERM'); } catch (e) {}
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Candle Cache Bound & In-Flight Deduplication (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // In-flight deduplication: identical concurrent requests share one in-flight fetch
    const concurrentCount = 5;
    const reqPromises = [];
    for (let i = 0; i < concurrentCount; i++) {
      reqPromises.push(request('/api/candles?symbol=ETHUSDT&timeframe=15&limit=100'));
    }
    const results = await Promise.all(reqPromises);
    for (let i = 0; i < results.length; i++) {
      assert(results[i].status === 200, `FR-010 concurrent request [${i}] status 200`,
        `Expected 200, got ${results[i].status}`);
      assert(results[i].body?.candles?.length === results[0].body?.candles?.length,
        `FR-010 concurrent request [${i}] count matches`,
        `Expected ${results[0].body?.candles?.length}, got ${results[i].body?.candles?.length}`);
    }

    // Memory safety: sweep of 8 concurrent requests across multiple symbols & timeframes at limit 1500
    const sweepRequests = [
      { symbol: 'BTCUSDT', tf: '1' },
      { symbol: 'BTCUSDT', tf: '15' },
      { symbol: 'BTCUSDT', tf: '60' },
      { symbol: 'BTCUSDT', tf: 'D' },
      { symbol: 'ETHUSDT', tf: '5' },
      { symbol: 'ETHUSDT', tf: '30' },
      { symbol: 'ETHUSDT', tf: '240' },
      { symbol: 'ETHUSDT', tf: 'W' }
    ];

    const sweepPromises = sweepRequests.map(item =>
      request(`/api/candles?symbol=${item.symbol}&timeframe=${item.tf}&limit=1500`)
    );
    const sweepResults = await Promise.all(sweepPromises);
    for (let i = 0; i < sweepResults.length; i++) {
      assert(sweepResults[i].status === 200,
        `FR-010 sweep request ${sweepRequests[i].symbol} ${sweepRequests[i].tf} status 200`,
        `Expected 200, got ${sweepResults[i].status}`);
      assert(Array.isArray(sweepResults[i].body?.candles) && sweepResults[i].body.candles.length > 0,
        `FR-010 sweep request ${sweepRequests[i].symbol} ${sweepRequests[i].tf} has candles`,
        'Expected non-empty candles array');
    }
  }

  console.log('[014 Acceptance Suite 02] PASS: All crypto deep history, outage resilience and memory safety assertions satisfied.');
}

run().catch(err => {
  console.error(`❌ Suite 02 unhandled error: ${err.message || err}`);
  process.exit(1);
});
