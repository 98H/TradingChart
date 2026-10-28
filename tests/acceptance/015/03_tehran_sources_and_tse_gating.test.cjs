/**
 * @spec 015
 * @covers FR-006
 */
const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

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
  console.log(`[015 Acceptance Suite 03] Running Tehran TGJU Sources & Intraday Restriction against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TGJU Daily History & Rial -> Toman Conversion (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // IR:COIN_EMAMI on Daily: must return real TGJU history in Toman
    const resCoin = await request('/api/candles?symbol=IR:COIN_EMAMI&timeframe=D&limit=50');
    assert(resCoin.status === 200, 'FR-006 IR:COIN_EMAMI D status 200', `Expected 200, got ${resCoin.status}`);
    assert(resCoin.body?.source === 'tgju' || resCoin.body?.source === 'cache',
      'FR-006 TGJU daily candles source', `Expected source "tgju" or "cache", got "${resCoin.body?.source}"`);
    assert(Array.isArray(resCoin.body?.candles) && resCoin.body?.candles.length > 0,
      'FR-006 TGJU candles non-empty', 'Expected candles array');

    const candles = resCoin.body.candles;
    for (let i = 0; i < candles.length; i++) {
      const bar = candles[i];
      assert(typeof bar.time === 'number' && bar.time > 0,
        `FR-006 bar [${i}] valid time`, `Invalid time: ${bar.time}`);

      // Daily bar time anchor: must be 00:00:00 UTC
      const d = new Date(bar.time);
      assert(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0,
        `FR-006 bar [${i}] UTC 00:00 anchor`,
        `Bar time ${bar.time} (${d.toISOString()}) is not aligned to 00:00:00 UTC`);

      // Price verification: In Toman, Emami coin is > 10,000,000 (10M TMN).
      // If it was in rial, it would be > 100,000,000.
      // If it was fake demo, it would be ~40,000.
      assert(bar.close > 5000000,
        `FR-006 bar [${i}] Toman scale (> 5M TMN)`,
        `Bar close ${bar.close} is too low for Emami coin in Toman`);

      // Column order & OHLC integrity
      assert(bar.low <= Math.min(bar.open, bar.close),
        `FR-006 bar [${i}] low <= min(open, close)`, `Low ${bar.low} > min(${bar.open}, ${bar.close})`);
      assert(bar.high >= Math.max(bar.open, bar.close),
        `FR-006 bar [${i}] high >= max(open, close)`, `High ${bar.high} < max(${bar.open}, ${bar.close})`);
    }

    // IR:USD_FREE on Daily
    const resUsd = await request('/api/candles?symbol=IR:USD_FREE&timeframe=D&limit=20');
    assert(resUsd.status === 200, 'FR-006 IR:USD_FREE D status 200', `Expected 200, got ${resUsd.status}`);
    assert(resUsd.body?.source === 'tgju' || resUsd.body?.source === 'cache',
      'FR-006 IR:USD_FREE source is tgju', `Expected "tgju", got "${resUsd.body?.source}"`);
    const lastUsd = resUsd.body?.candles?.[resUsd.body.candles.length - 1];
    // USD in Toman is > 20,000 and < 300,000
    assert(lastUsd && lastUsd.close > 20000 && lastUsd.close < 300000,
      'FR-006 USD free market price in realistic Toman range', `Price was ${lastUsd?.close}`);

    // Higher timeframes allowed: W (Weekly) and M (Monthly)
    const resWeekly = await request('/api/candles?symbol=IR:COIN_EMAMI&timeframe=W&limit=5');
    assert(resWeekly.status === 200, 'FR-006 IR:COIN_EMAMI W status 200', `Expected 200, got ${resWeekly.status}`);
    assert(resWeekly.body?.timeframe === 'W', 'FR-006 weekly timeframe canonical W', `Got "${resWeekly.body?.timeframe}"`);

    const resMonthly = await request('/api/candles?symbol=IR:COIN_EMAMI&timeframe=M&limit=5');
    assert(resMonthly.status === 200, 'FR-006 IR:COIN_EMAMI M status 200', `Expected 200, got ${resMonthly.status}`);
    assert(resMonthly.body?.timeframe === 'M', 'FR-006 monthly timeframe canonical M', `Got "${resMonthly.body?.timeframe}"`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Intraday Restriction on TGJU Symbols (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Intraday timeframes (1s, 1m, 5m, 15m, 60m, 240m) MUST return 400 { ok: false, error: "timeframe_unavailable" }
    const forbiddenTfs = ['1s', '1', '5', '15', '60', '240'];
    for (const badTf of forbiddenTfs) {
      const resBad = await request(`/api/candles?symbol=IR:COIN_EMAMI&timeframe=${badTf}`);
      assert(resBad.status === 400,
        `FR-006 intraday timeframe ${badTf} rejected with 400`,
        `Expected 400, got ${resBad.status}`);
      assert(resBad.body?.ok === false && resBad.body?.error === 'timeframe_unavailable',
        `FR-006 intraday error payload for ${badTf}`,
        `Expected {ok:false, error:"timeframe_unavailable"}, got ${JSON.stringify(resBad.body)}`);
    }

    const resBadUsd = await request('/api/candles?symbol=IR:USD_FREE&timeframe=60');
    assert(resBadUsd.status === 400, 'FR-006 IR:USD_FREE 60m rejected with 400', `Got ${resBadUsd.status}`);
    assert(resBadUsd.body?.error === 'timeframe_unavailable',
      'FR-006 timeframe_unavailable error for IR:USD_FREE', `Got ${resBadUsd.body?.error}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. TGJU Direct Upstream Slug Verification (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slugMap = [
      { id: 'IR:USD_FREE', slug: 'price_dollar_rl' },
      { id: 'IR:COIN_EMAMI', slug: 'sekee' },
      { id: 'IR:GOLD_18K', slug: 'geram18' },
      { id: 'IR:GOLD_MESGHAL', slug: 'mesghal' }
    ];

    for (const item of slugMap) {
      const tgjuUrl = `https://api.tgju.org/v1/market/indicator/summary-table-data/${item.slug}`;
      try {
        const tgjuRes = await fetch(tgjuUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
        if (tgjuRes.ok) {
          const json = await tgjuRes.json();
          const rows = json.data || [];
          assert(rows.length >= 1000,
            `FR-006 TGJU upstream slug ${item.slug} returns >= 1000 rows`,
            `Slug ${item.slug} only returned ${rows.length} rows`);
        } else {
          console.warn(`[015 Suite 03] Warning: Upstream TGJU returned ${tgjuRes.status} for ${item.slug} (host network check)`);
        }
      } catch (netErr) {
        // If upstream network is unreachable from test sandbox, local server tests above verify cached feed
        console.warn(`[015 Suite 03] Upstream TGJU fetch probe skipped: ${netErr.message}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TGJU Tickers (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resTgjuTickers = await request('/api/tickers?symbols=IR:COIN_EMAMI,IR:USD_FREE');
    assert(resTgjuTickers.status === 200, 'FR-006 TGJU tickers status 200', `Expected 200, got ${resTgjuTickers.status}`);
    const tickers = Array.isArray(resTgjuTickers.body) ? resTgjuTickers.body : (resTgjuTickers.body?.tickers || []);

    const coinTicker = tickers.find(t => t.symbol === 'IR:COIN_EMAMI');
    assert(!!coinTicker, 'FR-006 IR:COIN_EMAMI present in tickers', 'Missing IR:COIN_EMAMI ticker');
    assert(coinTicker.source === 'tgju', 'FR-006 IR:COIN_EMAMI source is tgju', `Got "${coinTicker.source}"`);
    assert(coinTicker.currency === 'TMN', 'FR-006 IR:COIN_EMAMI currency is TMN', `Got "${coinTicker.currency}"`);
    assert(typeof coinTicker.lastPrice === 'number' && coinTicker.lastPrice > 5000000,
      'FR-006 IR:COIN_EMAMI lastPrice in Toman', `Got ${coinTicker.lastPrice}`);
  }

  console.log('✅ [015 Acceptance Suite 03] Passed all Tehran TGJU Sources & Intraday Restriction checks.');
}

run().catch(err => {
  console.error(`❌ Suite run error: ${err.message}`);
  process.exit(1);
});
