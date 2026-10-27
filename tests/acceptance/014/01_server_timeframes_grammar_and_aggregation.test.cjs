/**
 * @spec 014
 * @covers FR-001, FR-002, FR-003
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
  console.log(`[014 Acceptance Suite 01] Running Timeframe Grammar, Alignment & Aggregation against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Timeframe Grammar Parsing, Canonical IDs & intervalMs (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Table of valid inputs and expected canonical id + nominal intervalMs
    const validTimeframes = [
      { input: '1s', canonical: '1s', intervalMs: 1000 },
      { input: '1S', canonical: '1s', intervalMs: 1000 },
      { input: '5s', canonical: '5s', intervalMs: 5000 },
      { input: '1', canonical: '1', intervalMs: 60000 },
      { input: '1m', canonical: '1', intervalMs: 60000 },
      { input: '45', canonical: '45', intervalMs: 2700000 },
      { input: '45m', canonical: '45', intervalMs: 2700000 },
      { input: '1h', canonical: '60', intervalMs: 3600000 },
      { input: '1H', canonical: '60', intervalMs: 3600000 },
      { input: '60', canonical: '60', intervalMs: 3600000 },
      { input: '4h', canonical: '240', intervalMs: 14400000 },
      { input: '24h', canonical: '1440', intervalMs: 86400000 },
      { input: 'D', canonical: 'D', intervalMs: 86400000 },
      { input: '1D', canonical: 'D', intervalMs: 86400000 },
      { input: '1d', canonical: 'D', intervalMs: 86400000 },
      { input: '3D', canonical: '3D', intervalMs: 259200000 },
      { input: 'W', canonical: 'W', intervalMs: 604800000 },
      { input: '1W', canonical: 'W', intervalMs: 604800000 },
      { input: '1w', canonical: 'W', intervalMs: 604800000 },
      { input: '2W', canonical: '2W', intervalMs: 1209600000 },
      { input: 'M', canonical: 'M', intervalMs: 2592000000 },
      { input: '1M', canonical: 'M', intervalMs: 2592000000 },
      { input: '3M', canonical: '3M', intervalMs: 7776000000 }
    ];

    for (const tf of validTimeframes) {
      const res = await request(`/api/candles?symbol=BTCUSDT&timeframe=${encodeURIComponent(tf.input)}&limit=10`);
      assert(res.status === 200, `FR-001 valid timeframe status ${tf.input}`, `Expected 200, got ${res.status}`);
      assert(res.body?.timeframe === tf.canonical, `FR-001 canonical timeframe for ${tf.input}`,
        `Expected canonical "${tf.canonical}", got "${res.body?.timeframe}"`);
      assert(res.body?.intervalMs === tf.intervalMs, `FR-001 intervalMs for ${tf.input}`,
        `Expected intervalMs ${tf.intervalMs}, got ${res.body?.intervalMs}`);
      assert(res.body?.source === 'binance' || res.body?.source === 'cache', `FR-001 source in response for ${tf.input}`,
        `Expected source "binance"|"cache", got "${res.body?.source}"`);
      assert(res.headers.get('x-data-source') === res.body?.source, `FR-001 X-Data-Source header matches body source for ${tf.input}`,
        `Expected header "${res.body?.source}", got "${res.headers.get('x-data-source')}"`);
    }

    // Invalid timeframes MUST return 400 { ok: false, error: "invalid_timeframe" }
    const invalidTimeframes = ['0', '1441', '60s', '0s', '25h', '0h', '0D', '366D', '0W', '53W', '0M', '13M', '7X', 'invalid_tf'];
    for (const badTf of invalidTimeframes) {
      const res = await request(`/api/candles?symbol=BTCUSDT&timeframe=${encodeURIComponent(badTf)}`);
      assert(res.status === 400, `FR-001 invalid timeframe status ${badTf}`, `Expected 400, got ${res.status}`);
      assert(res.body?.ok === false && res.body?.error === 'invalid_timeframe', `FR-001 invalid timeframe error payload ${badTf}`,
        `Expected {ok:false, error:"invalid_timeframe"}, got ${JSON.stringify(res.body)}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Bucket Alignment & Candle Data Integrity (FR-002)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Sub-day alignment: BTCUSDT on 45m
    const res45 = await request('/api/candles?symbol=BTCUSDT&timeframe=45&limit=20');
    assert(res45.status === 200, 'FR-002 45m candles status', `Expected 200, got ${res45.status}`);
    const candles45 = res45.body?.candles || [];
    assert(candles45.length > 0, 'FR-002 45m candles non-empty', 'Expected candles array');

    const expectedInterval45 = 45 * 60 * 1000;
    const now = Date.now();
    for (let i = 0; i < candles45.length; i++) {
      const c = candles45[i];
      assert(typeof c.time === 'number' && Number.isFinite(c.time), `FR-002 candle [${i}] finite time`, 'Time must be finite number');
      assert(c.time % expectedInterval45 === 0, `FR-002 candle [${i}] 45m alignment`,
        `Bar time ${c.time} is not a multiple of 45 minutes (${expectedInterval45} ms)`);
      assert(c.closeTime === c.time + expectedInterval45 - 1, `FR-002 candle [${i}] 45m closeTime`,
        `Expected closeTime ${c.time + expectedInterval45 - 1}, got ${c.closeTime}`);
      assert(c.low <= Math.min(c.open, c.close), `FR-002 candle [${i}] low <= min(open, close)`,
        `Low ${c.low} > min(${c.open}, ${c.close})`);
      assert(Math.max(c.open, c.close) <= c.high, `FR-002 candle [${i}] high >= max(open, close)`,
        `High ${c.high} < max(${c.open}, ${c.close})`);
      assert(c.low > 0, `FR-002 candle [${i}] positive low`, `Low must be > 0, got ${c.low}`);
      assert(c.volume >= 0, `FR-002 candle [${i}] non-negative volume`, `Volume must be >= 0, got ${c.volume}`);
      assert(c.time <= now, `FR-002 candle [${i}] not in future`, `Bar time ${c.time} is in future (> ${now})`);

      if (i > 0) {
        assert(c.time > candles45[i - 1].time, `FR-002 candle [${i}] strictly ascending time`,
          `Time ${c.time} <= previous ${candles45[i - 1].time}`);
        assert(c.time - candles45[i - 1].time === expectedInterval45, `FR-002 candle [${i}] consecutive 45m spacing`,
          `Spacing ${c.time - candles45[i - 1].time} != ${expectedInterval45}`);
      }
    }

    // Weekly alignment: every bar opens Monday 00:00 UTC
    const resW = await request('/api/candles?symbol=BTCUSDT&timeframe=W&limit=10');
    assert(resW.status === 200, 'FR-002 weekly candles status', `Expected 200, got ${resW.status}`);
    const candlesW = resW.body?.candles || [];
    assert(candlesW.length > 0, 'FR-002 weekly candles non-empty', 'Expected weekly candles');

    for (let i = 0; i < candlesW.length; i++) {
      const c = candlesW[i];
      const d = new Date(c.time);
      const isMonday = d.getUTCDay() === 1;
      const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
      assert(isMonday && isMidnight, `FR-002 weekly candle [${i}] Monday 00:00 UTC`,
        `Bar time ${c.time} (${d.toISOString()}) is not Monday 00:00 UTC`);
    }

    // Monthly alignment: every bar opens on 1st of month 00:00 UTC
    const resM = await request('/api/candles?symbol=BTCUSDT&timeframe=M&limit=10');
    assert(resM.status === 200, 'FR-002 monthly candles status', `Expected 200, got ${resM.status}`);
    const candlesM = resM.body?.candles || [];
    assert(candlesM.length > 0, 'FR-002 monthly candles non-empty', 'Expected monthly candles');

    for (let i = 0; i < candlesM.length; i++) {
      const c = candlesM[i];
      const d = new Date(c.time);
      const isFirst = d.getUTCDate() === 1;
      const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
      assert(isFirst && isMidnight, `FR-002 monthly candle [${i}] 1st of month 00:00 UTC`,
        `Bar time ${c.time} (${d.toISOString()}) is not 1st of month 00:00 UTC`);
    }

    // Multi-day alignment: 3D bars must have (epoch-day index % 3 == 0)
    const res3D = await request('/api/candles?symbol=BTCUSDT&timeframe=3D&limit=10');
    assert(res3D.status === 200, 'FR-002 3D candles status', `Expected 200, got ${res3D.status}`);
    const candles3D = res3D.body?.candles || [];
    assert(candles3D.length > 0, 'FR-002 3D candles non-empty', 'Expected 3D candles');

    for (let i = 0; i < candles3D.length; i++) {
      const c = candles3D[i];
      const epochDay = Math.floor(c.time / 86400000);
      assert(epochDay % 3 === 0, `FR-002 3D candle [${i}] epoch-day divisible by 3`,
        `Bar time ${c.time} has epochDay ${epochDay} (epochDay % 3 = ${epochDay % 3})`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Crypto Native Intervals vs Server-Side Aggregation (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Timeframe 45m is aggregated from 15m native bars (divides 45m by 3)
    // Fetch 1 completed 45m bar and the 3 constituent 15m bars
    const res45 = await request('/api/candles?symbol=BTCUSDT&timeframe=45&limit=5');
    assert(res45.status === 200 && res45.body?.candles?.length >= 2, 'FR-003 45m bars available', 'Need at least 2 bars');
    const closed45Bar = res45.body.candles[res45.body.candles.length - 2]; // use second to last (guaranteed closed)

    const fromTime = closed45Bar.time;
    const toTime = closed45Bar.closeTime;
    const res15 = await request(`/api/candles?symbol=BTCUSDT&timeframe=15&from_time=${fromTime}&to_time=${toTime}`);
    assert(res15.status === 200, 'FR-003 constituent 15m bars status', `Expected 200, got ${res15.status}`);
    const bars15 = res15.body?.candles || [];
    assert(bars15.length === 3, 'FR-003 3x 15m bars inside 45m window',
      `Expected exactly 3 15m bars for 45m window [${fromTime}, ${toTime}], got ${bars15.length}`);

    // Verify OHLCV aggregation rules
    const expectedOpen = bars15[0].open;
    const expectedClose = bars15[bars15.length - 1].close;
    const expectedHigh = Math.max(...bars15.map(b => b.high));
    const expectedLow = Math.min(...bars15.map(b => b.low));
    const expectedVolume = bars15.reduce((s, b) => s + b.volume, 0);

    assert(closed45Bar.open === expectedOpen, 'FR-003 45m aggregated open equals first 15m open',
      `Expected ${expectedOpen}, got ${closed45Bar.open}`);
    assert(closed45Bar.close === expectedClose, 'FR-003 45m aggregated close equals last 15m close',
      `Expected ${expectedClose}, got ${closed45Bar.close}`);
    assert(closed45Bar.high === expectedHigh, 'FR-003 45m aggregated high equals max 15m high',
      `Expected ${expectedHigh}, got ${closed45Bar.high}`);
    assert(closed45Bar.low === expectedLow, 'FR-003 45m aggregated low equals min 15m low',
      `Expected ${expectedLow}, got ${closed45Bar.low}`);
    assert(Math.abs(closed45Bar.volume - expectedVolume) < 0.001, 'FR-003 45m aggregated volume equals sum 15m volume',
      `Expected ${expectedVolume}, got ${closed45Bar.volume}`);
  }

  console.log('[014 Acceptance Suite 01] PASS: All timeframe grammar, alignment and aggregation assertions satisfied.');
}

run().catch(err => {
  console.error(`❌ Suite 01 unhandled error: ${err.message || err}`);
  process.exit(1);
});
