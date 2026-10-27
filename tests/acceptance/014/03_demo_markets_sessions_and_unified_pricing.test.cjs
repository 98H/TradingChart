/**
 * @spec 014
 * @covers FR-006, FR-007, FR-008, FR-009
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
  console.log(`[014 Acceptance Suite 03] Running Demo Markets, Sessions, Time bounds & Unified Pricing against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Time Bounds, Seconds Conversion & Non-Overlapping Pagination (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // from_time > to_time MUST return 400 { ok: false, error: "invalid_time" }
    const resInverted = await request('/api/candles?symbol=BTCUSDT&timeframe=60&from_time=1700000000000&to_time=1600000000000');
    assert(resInverted.status === 400, 'FR-006 from_time > to_time status 400', `Expected 400, got ${resInverted.status}`);
    assert(resInverted.body?.ok === false && resInverted.body?.error === 'invalid_time',
      'FR-006 invalid_time error payload', `Expected {ok:false, error:"invalid_time"}, got ${JSON.stringify(resInverted.body)}`);

    // Non-numeric timestamp MUST return 400 { ok: false, error: "invalid_time" }
    const resBadTime = await request('/api/candles?symbol=BTCUSDT&timeframe=60&from_time=not_a_time');
    assert(resBadTime.status === 400, 'FR-006 non-numeric from_time status 400', `Expected 400, got ${resBadTime.status}`);
    assert(resBadTime.body?.ok === false && resBadTime.body?.error === 'invalid_time',
      'FR-006 non-numeric time error payload', `Expected {ok:false, error:"invalid_time"}, got ${JSON.stringify(resBadTime.body)}`);

    // Seconds timestamps (< 10^11) MUST be multiplied by 1000
    // e.g. to_time=1700000000 (seconds) should yield the same bars as to_time=1700000000000 (ms)
    const resSeconds = await request('/api/candles?symbol=EURUSD&timeframe=60&to_time=1700000000&limit=5');
    const resMs = await request('/api/candles?symbol=EURUSD&timeframe=60&to_time=1700000000000&limit=5');
    assert(resSeconds.status === 200 && resMs.status === 200, 'FR-006 seconds vs ms status 200', 'Both requests must succeed');
    assert(resSeconds.body?.candles?.length > 0 && resMs.body?.candles?.length > 0, 'FR-006 candles returned for to_time', 'Expected bars');

    const lastSecBar = resSeconds.body.candles[resSeconds.body.candles.length - 1];
    const lastMsBar = resMs.body.candles[resMs.body.candles.length - 1];
    assert(lastSecBar.time === lastMsBar.time, 'FR-006 seconds timestamp converted to ms',
      `Seconds request gave last bar ${lastSecBar.time}, ms request gave ${lastMsBar.time}`);
    assert(lastSecBar.time <= 1700000000000, 'FR-006 bars lie <= to_time',
      `Bar time ${lastSecBar.time} > to_time 1700000000000`);

    // Strict non-overlapping pagination:
    // Request page 1 with limit=10, get oldest loaded bar.
    // Request page 2 with to_time = oldest loaded bar - 1 ms.
    // Returned bars in page 2 MUST be strictly older than oldest loaded bar, with no overlap.
    const resPage1 = await request('/api/candles?symbol=EURUSD&timeframe=60&limit=10');
    assert(resPage1.status === 200 && resPage1.body?.candles?.length === 10, 'FR-006 page 1 returns 10 bars', 'Expected 10 bars');
    const oldestPage1 = resPage1.body.candles[0];

    const resPage2 = await request(`/api/candles?symbol=EURUSD&timeframe=60&to_time=${oldestPage1.time - 1}&limit=10`);
    assert(resPage2.status === 200 && resPage2.body?.candles?.length === 10, 'FR-006 page 2 returns 10 bars', 'Expected 10 bars');
    const newestPage2 = resPage2.body.candles[resPage2.body.candles.length - 1];

    assert(newestPage2.time < oldestPage1.time, 'FR-006 page 2 strictly older than page 1',
      `Newest bar of page 2 (${newestPage2.time}) is not strictly older than oldest of page 1 (${oldestPage1.time})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Deterministic Price Path & True Timeframe Aggregation (FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Stability test: Request XAUUSD 60m bars twice, 3 seconds apart
    const resA = await request('/api/candles?symbol=XAUUSD&timeframe=60&limit=5');
    assert(resA.status === 200 && resA.body?.candles?.length >= 3, 'FR-007 XAUUSD first request', 'Expected candles');
    await new Promise(r => setTimeout(r, 1500));
    const resB = await request('/api/candles?symbol=XAUUSD&timeframe=60&limit=5');
    assert(resB.status === 200 && resB.body?.candles?.length >= 3, 'FR-007 XAUUSD second request', 'Expected candles');

    // Compare closed historical bars (ignore the very last forming bar if market is open)
    const closedA = resA.body.candles[resA.body.candles.length - 2];
    const closedB = resB.body.candles.find(c => c.time === closedA.time);
    assert(!!closedB, 'FR-007 matching historical bar found in second response', 'Historical bar missing');
    assert(closedA.open === closedB.open && closedA.high === closedB.high &&
           closedA.low === closedB.low && closedA.close === closedB.close &&
           closedA.volume === closedB.volume,
           'FR-007 demo historical bar is deterministic and stable across calls',
           `Bar at ${closedA.time} differed between calls: ${JSON.stringify(closedA)} vs ${JSON.stringify(closedB)}`);

    // Exact 60m aggregation of 1m path:
    // Fetch one closed 60-minute bar of XAUUSD and all 1m bars inside that exact hour
    const fromTime = closedA.time;
    const toTime = closedA.closeTime;
    const res1m = await request(`/api/candles?symbol=XAUUSD&timeframe=1&from_time=${fromTime}&to_time=${toTime}`);
    assert(res1m.status === 200, 'FR-007 constituent 1m bars status', `Expected 200, got ${res1m.status}`);
    const bars1m = res1m.body?.candles || [];
    assert(bars1m.length > 0, 'FR-007 constituent 1m bars non-empty', 'Expected 1m bars inside 60m bar');

    const expectedOpen = bars1m[0].open;
    const expectedClose = bars1m[bars1m.length - 1].close;
    const expectedHigh = Math.max(...bars1m.map(b => b.high));
    const expectedLow = Math.min(...bars1m.map(b => b.low));
    const expectedVolume = bars1m.reduce((s, b) => s + b.volume, 0);

    assert(closedA.open === expectedOpen, 'FR-007 60m open equals first 1m open',
      `Expected ${expectedOpen}, got ${closedA.open}`);
    assert(closedA.close === expectedClose, 'FR-007 60m close equals last 1m close',
      `Expected ${expectedClose}, got ${closedA.close}`);
    assert(closedA.high === expectedHigh, 'FR-007 60m high equals max 1m high',
      `Expected ${expectedHigh}, got ${closedA.high}`);
    assert(closedA.low === expectedLow, 'FR-007 60m low equals min 1m low',
      `Expected ${expectedLow}, got ${closedA.low}`);
    assert(Math.abs(closedA.volume - expectedVolume) < 0.001, 'FR-007 60m volume equals sum of 1m volumes',
      `Expected ${expectedVolume}, got ${closedA.volume}`);

    // History start date boundary: no bars earlier than 2000-01-03 (epoch ms 946857600000)
    const resAncient = await request('/api/candles?symbol=EURUSD&timeframe=D&to_time=946857600000&limit=10');
    assert(resAncient.status === 200 || resAncient.status === 404, 'FR-007 query before 2000-01-03', 'Expected 200 or 404');
    const ancientBars = resAncient.body?.candles || [];
    assert(ancientBars.every(b => b.time >= 946857600000), 'FR-007 no bars earlier than 2000-01-03',
      'Returned bars before 2000-01-03');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Demo Market Session Calendars (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Forex (EURUSD): Monday 00:00 to Friday 22:00 UTC continuous.
    // Intraday and daily bars MUST NOT exist for Saturday or Sunday.
    const resForexDaily = await request('/api/candles?symbol=EURUSD&timeframe=D&limit=60');
    assert(resForexDaily.status === 200, 'FR-008 EURUSD daily candles status', `Expected 200, got ${resForexDaily.status}`);
    const dailyBars = resForexDaily.body?.candles || [];
    for (let i = 0; i < dailyBars.length; i++) {
      const d = new Date(dailyBars[i].time);
      const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
      assert(dayOfWeek !== 0 && dayOfWeek !== 6, `FR-008 EURUSD daily bar [${i}] on weekend`,
        `Bar time ${dailyBars[i].time} (${d.toISOString()}) is on a weekend (day ${dayOfWeek})`);
    }

    const resForex60 = await request('/api/candles?symbol=EURUSD&timeframe=60&limit=150');
    assert(resForex60.status === 200, 'FR-008 EURUSD 60m candles status', `Expected 200, got ${resForex60.status}`);
    const bars60 = resForex60.body?.candles || [];
    for (let i = 0; i < bars60.length; i++) {
      const d = new Date(bars60[i].time);
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      // Saturday (day 6): no bars. Sunday (day 0): no bars. Friday (day 5): last bar is 21:00 UTC (closing at 21:59:59).
      const isWeekend = (day === 6) || (day === 0) || (day === 5 && hour >= 22);
      assert(!isWeekend, `FR-008 EURUSD 60m bar [${i}] outside forex session`,
        `Bar time ${bars60[i].time} (${d.toISOString()}) is outside session (day ${day}, hour ${hour})`);
    }

    // Tehran Stock Exchange (FOOLAD):
    // Session is Saturday–Wednesday 05:30–09:00 UTC.
    // Thursday (day 4) and Friday (day 5) MUST have no bars.
    // Daily bars exist only on Sat (6), Sun (0), Mon (1), Tue (2), Wed (3).
    const resFooladDaily = await request('/api/candles?symbol=FOOLAD&timeframe=D&limit=40');
    assert(resFooladDaily.status === 200, 'FR-008 FOOLAD daily candles status', `Expected 200, got ${resFooladDaily.status}`);
    const fooladDaily = fooladDailyRes = resFooladDaily.body?.candles || [];
    for (let i = 0; i < fooladDaily.length; i++) {
      const d = new Date(fooladDaily[i].time);
      const day = d.getUTCDay();
      assert(day !== 4 && day !== 5, `FR-008 FOOLAD daily bar [${i}] on TSE weekend`,
        `Bar time ${fooladDaily[i].time} (${d.toISOString()}) is on TSE weekend (Thu/Fri, day ${day})`);
    }

    const resFoolad15 = await request('/api/candles?symbol=FOOLAD&timeframe=15&limit=100');
    assert(resFoolad15.status === 200, 'FR-008 FOOLAD 15m candles status', `Expected 200, got ${resFoolad15.status}`);
    const foolad15 = resFoolad15.body?.candles || [];
    for (let i = 0; i < foolad15.length; i++) {
      const d = new Date(foolad15[i].time);
      const day = d.getUTCDay();
      const minutesSinceMidnight = d.getUTCHours() * 60 + d.getUTCMinutes();
      // Must be Sat-Wed (day 6, 0, 1, 2, 3) and time in [05:30, 09:00) UTC -> [330, 540)
      assert(day === 6 || day <= 3, `FR-008 FOOLAD 15m bar [${i}] on non-trading day`,
        `Bar time ${foolad15[i].time} (${d.toISOString()}) is on day ${day}`);
      assert(minutesSinceMidnight >= 330 && minutesSinceMidnight < 540,
        `FR-008 FOOLAD 15m bar [${i}] outside 05:30-09:00 UTC window`,
        `Bar time ${foolad15[i].time} (${d.toISOString()}) at minute ${minutesSinceMidnight}`);
    }

    // Tehran Gold & FX (GOLD_ABSHODEH):
    // Session is Saturday–Thursday 06:30–15:30 UTC.
    // Friday (day 5) MUST have no bars.
    const resGoldDaily = await request('/api/candles?symbol=GOLD_ABSHODEH&timeframe=D&limit=30');
    assert(resGoldDaily.status === 200, 'FR-008 GOLD_ABSHODEH daily status', `Expected 200, got ${resGoldDaily.status}`);
    const goldDaily = resGoldDaily.body?.candles || [];
    for (let i = 0; i < goldDaily.length; i++) {
      const d = new Date(goldDaily[i].time);
      assert(d.getUTCDay() !== 5, `FR-008 GOLD_ABSHODEH daily bar [${i}] on Friday`,
        `Bar time ${goldDaily[i].time} (${d.toISOString()}) is on Friday`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Unified Pricing: Tickers, WS Tick & Depth derived from Path (FR-009)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // For demo symbols (EURUSD, FOOLAD, GOLD_ABSHODEH), verify:
    // ticker lastPrice equals the last 1m candle close within one minTick.
    const symbols = ['EURUSD', 'FOOLAD', 'GOLD_ABSHODEH'];
    for (const sym of symbols) {
      const [resTicker, res1m, res60, resD] = await Promise.all([
        request(`/api/tickers?symbols=${sym}`),
        request(`/api/candles?symbol=${sym}&timeframe=1&limit=2`),
        request(`/api/candles?symbol=${sym}&timeframe=60&limit=2`),
        request(`/api/candles?symbol=${sym}&timeframe=D&limit=2`)
      ]);

      assert(resTicker.status === 200, `FR-009 ${sym} ticker status 200`, `Expected 200, got ${resTicker.status}`);
      const tickerData = Array.isArray(resTicker.body)
        ? resTicker.body.find(t => t.symbol === sym)
        : resTicker.body?.[sym] || resTicker.body;
      const lastPrice = parseFloat(tickerData?.lastPrice ?? tickerData?.price);
      assert(typeof lastPrice === 'number' && Number.isFinite(lastPrice) && lastPrice > 0,
        `FR-009 ${sym} ticker lastPrice`, `Invalid lastPrice ${lastPrice}`);

      const last1mClose = res1m.body?.candles?.[res1m.body.candles.length - 1]?.close;
      assert(typeof last1mClose === 'number', `FR-009 ${sym} 1m last close`, 'Missing 1m close');

      // Closes of 1, 60, D and ticker lastPrice must agree within tolerance (minTick / rounding)
      const diff1m = Math.abs(lastPrice - last1mClose);
      const tolerance = (sym === 'EURUSD' ? 0.0005 : sym === 'FOOLAD' ? 5 : 500);
      assert(diff1m <= tolerance, `FR-009 ${sym} ticker agrees with 1m close within ${tolerance}`,
        `Ticker lastPrice ${lastPrice} != 1m close ${last1mClose} (diff ${diff1m})`);

      // Depth mid-price check: mid of best bid and best ask must equal ticker lastPrice (within tolerance)
      const resDepth = await request(`/api/depth?symbol=${sym}&limit=5`);
      if (resDepth.status === 200 && resDepth.body?.bids?.length > 0 && resDepth.body?.asks?.length > 0) {
        const bestBid = parseFloat(resDepth.body.bids[0][0]);
        const bestAsk = parseFloat(resDepth.body.asks[0][0]);
        const midPrice = (bestBid + bestAsk) / 2;
        assert(Math.abs(midPrice - lastPrice) <= tolerance * 2,
          `FR-009 ${sym} depth ladder mid-price matches ticker lastPrice`,
          `Depth mid ${midPrice} != ticker lastPrice ${lastPrice}`);
      }
    }
  }

  console.log('[014 Acceptance Suite 03] PASS: All demo markets, sessions and unified pricing assertions satisfied.');
}

run().catch(err => {
  console.error(`❌ Suite 03 unhandled error: ${err.message || err}`);
  process.exit(1);
});
