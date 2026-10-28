/**
 * @spec 015
 * @covers FR-001, FR-002, FR-003
 */
const WebSocket = require('ws');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');
const parsedBase = new URL(BASE_URL);
const WS_URL = `${parsedBase.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsedBase.host}/ws/live`;

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
  console.log(`[015 Acceptance Suite 01] Running TradingView Shared Client, Candles & WebSocket against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TradingView Candles & Resolution Mapping (FR-001, FR-002)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // OANDA:EURUSD on 60m: Must return TradingView bars with source, exchange, delaySec
    const resEur = await request('/api/candles?symbol=OANDA:EURUSD&timeframe=60&limit=10');
    assert(resEur.status === 200, 'FR-002 OANDA:EURUSD 60m status 200', `Expected 200, got ${resEur.status}`);
    assert(resEur.body?.source === 'tradingview' || resEur.body?.source === 'cache',
      'FR-002 TradingView candles source', `Expected source "tradingview" or "cache", got "${resEur.body?.source}"`);
    assert(resEur.body?.exchange === 'OANDA',
      'FR-002 TradingView candles exchange', `Expected exchange "OANDA", got "${resEur.body?.exchange}"`);
    assert(typeof resEur.body?.delaySec === 'number' && resEur.body?.delaySec === 0,
      'FR-002 OANDA:EURUSD delaySec is 0 (real-time)', `Expected delaySec 0, got ${resEur.body?.delaySec}`);
    assert(Array.isArray(resEur.body?.candles) && resEur.body?.candles.length > 0,
      'FR-002 OANDA:EURUSD candles non-empty', 'Expected candles array');

    const firstEur = resEur.body.candles[0];
    assert(typeof firstEur.time === 'number' && firstEur.time > 0,
      'FR-002 candle time is positive number', `Invalid candle time: ${firstEur.time}`);
    assert(firstEur.low <= Math.min(firstEur.open, firstEur.close),
      'FR-002 candle low <= min(open, close)', `Low ${firstEur.low} > min(${firstEur.open}, ${firstEur.close})`);
    assert(Math.max(firstEur.open, firstEur.close) <= firstEur.high,
      'FR-002 candle high >= max(open, close)', `High ${firstEur.high} < max(${firstEur.open}, ${firstEur.close})`);

    // NASDAQ:AAPL on D: Daily session bars
    const resAapl = await request('/api/candles?symbol=NASDAQ:AAPL&timeframe=D&limit=5');
    assert(resAapl.status === 200, 'FR-002 NASDAQ:AAPL D status 200', `Expected 200, got ${resAapl.status}`);
    assert(resAapl.body?.source === 'tradingview' || resAapl.body?.source === 'cache',
      'FR-002 NASDAQ:AAPL source', `Expected "tradingview" or "cache", got "${resAapl.body?.source}"`);
    assert(resAapl.body?.exchange === 'NASDAQ',
      'FR-002 NASDAQ:AAPL exchange', `Expected "NASDAQ", got "${resAapl.body?.exchange}"`);

    // Delayed instrument: SP:SPX delaySec must be >= 600 (10 min delay)
    const resSpx = await request('/api/candles?symbol=SP:SPX&timeframe=D&limit=5');
    assert(resSpx.status === 200, 'FR-002 SP:SPX D status 200', `Expected 200, got ${resSpx.status}`);
    assert(resSpx.body?.source === 'tradingview' || resSpx.body?.source === 'cache',
      'FR-002 SP:SPX source', `Expected "tradingview" or "cache", got "${resSpx.body?.source}"`);
    assert(typeof resSpx.body?.delaySec === 'number' && resSpx.body?.delaySec >= 600,
      'FR-002 SP:SPX delaySec >= 600', `Expected delaySec >= 600, got ${resSpx.body?.delaySec}`);

    // Resolution mapping checks: 1s, 60, D, 3D, W, M
    const resolutionChecks = [
      { tf: '1s', canonical: '1s' },
      { tf: '60', canonical: '60' },
      { tf: 'D', canonical: 'D' },
      { tf: '3D', canonical: '3D' },
      { tf: 'W', canonical: 'W' },
      { tf: 'M', canonical: 'M' }
    ];
    for (const r of resolutionChecks) {
      const resTf = await request(`/api/candles?symbol=OANDA:EURUSD&timeframe=${r.tf}&limit=5`);
      assert(resTf.status === 200, `FR-002 resolution status for ${r.tf}`, `Expected 200, got ${resTf.status}`);
      assert(resTf.body?.timeframe === r.canonical, `FR-002 canonical timeframe for ${r.tf}`,
        `Expected canonical "${r.canonical}", got "${resTf.body?.timeframe}"`);
    }

    // Paging via limit and to_time: strict non-overlapping order
    const page1 = await request('/api/candles?symbol=OANDA:EURUSD&timeframe=60&limit=5');
    assert(page1.status === 200 && page1.body?.candles?.length === 5,
      'FR-002 page 1 returns requested limit', `Expected 5 bars, got ${page1.body?.candles?.length}`);
    const oldestBarPage1 = page1.body.candles[0];

    const page2 = await request(`/api/candles?symbol=OANDA:EURUSD&timeframe=60&to_time=${oldestBarPage1.time - 1}&limit=5`);
    assert(page2.status === 200 && page2.body?.candles?.length === 5,
      'FR-002 page 2 returns 5 bars', `Expected 5 bars, got ${page2.body?.candles?.length}`);
    const newestBarPage2 = page2.body.candles[page2.body.candles.length - 1];
    assert(newestBarPage2.time < oldestBarPage1.time,
      'FR-002 page 2 strictly older than page 1',
      `Newest bar time ${newestBarPage2.time} >= oldest bar page 1 ${oldestBarPage1.time}`);

    // Legacy bare symbol alias resolution: EURUSD resolves to OANDA:EURUSD
    const resLegacy = await request('/api/candles?symbol=EURUSD&timeframe=60&limit=5');
    assert(resLegacy.status === 200, 'FR-002 legacy bare EURUSD resolves status 200', `Expected 200, got ${resLegacy.status}`);
    assert(resLegacy.body?.symbol === 'OANDA:EURUSD' || resLegacy.body?.symbol === 'EURUSD',
      'FR-002 legacy bare EURUSD symbol identifier', `Unexpected symbol: "${resLegacy.body?.symbol}"`);
    assert(resLegacy.body?.source === 'tradingview' || resLegacy.body?.source === 'cache',
      'FR-002 legacy bare EURUSD resolved source', `Expected source "tradingview", got "${resLegacy.body?.source}"`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. WebSocket Live Stream: Subscriptions & Unknown Symbol Error (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out waiting for tick or error response'));
      }, 8000);

      let receivedTick = false;
      let receivedError = false;

      ws.on('open', () => {
        // Subscribe to real TradingView instrument
        ws.send(JSON.stringify({ type: 'subscribe', symbol: 'OANDA:EURUSD' }));
        // Subscribe to unknown symbol
        ws.send(JSON.stringify({ type: 'subscribe', symbol: 'UNKNOWN_TEST_SYM_015' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tick' && (msg.symbol === 'OANDA:EURUSD' || msg.symbol === 'EURUSD')) {
            assert(typeof msg.price === 'number' && msg.price > 0,
              'FR-003 WS tick price numeric', `Invalid price: ${msg.price}`);
            assert(typeof msg.time === 'number' && msg.time > 0,
              'FR-003 WS tick time numeric', `Invalid time: ${msg.time}`);
            receivedTick = true;
          }
          if (msg.type === 'error' && msg.error === 'unknown_symbol' && msg.symbol === 'UNKNOWN_TEST_SYM_015') {
            receivedError = true;
          }

          if (receivedTick && receivedError) {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch (err) {
          clearTimeout(timer);
          ws.terminate();
          reject(err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).catch(err => {
      assert(false, 'FR-003 WebSocket subscription and error handling', err.message);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Tickers Endpoint: Multi-symbol Quote Session & Unknown Handling (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resTickers = await request('/api/tickers?symbols=OANDA:EURUSD,NASDAQ:AAPL,UNKNOWN_TEST_SYM_015');
    assert(resTickers.status === 200, 'FR-003 /api/tickers status 200', `Expected 200, got ${resTickers.status}`);

    const tickersList = Array.isArray(resTickers.body) ? resTickers.body : (resTickers.body?.tickers || []);
    assert(tickersList.length >= 2, 'FR-003 tickers returned known symbols',
      `Expected at least 2 tickers, got ${tickersList.length}`);

    const eurTicker = tickersList.find(t => t.symbol === 'OANDA:EURUSD' || t.symbol === 'EURUSD');
    assert(!!eurTicker, 'FR-003 OANDA:EURUSD present in tickers response', 'Missing EURUSD ticker');
    assert(typeof eurTicker.lastPrice === 'number' && eurTicker.lastPrice > 0,
      'FR-003 OANDA:EURUSD ticker lastPrice', `Expected positive numeric lastPrice, got ${eurTicker.lastPrice}`);
    assert(typeof eurTicker.priceChange === 'number',
      'FR-003 OANDA:EURUSD ticker priceChange', `Expected numeric priceChange, got ${eurTicker.priceChange}`);
    assert(eurTicker.source === 'tradingview',
      'FR-003 OANDA:EURUSD ticker source', `Expected source "tradingview", got "${eurTicker.source}"`);
    assert(eurTicker.exchange === 'OANDA',
      'FR-003 OANDA:EURUSD ticker exchange', `Expected exchange "OANDA", got "${eurTicker.exchange}"`);

    // Unknown symbol MUST be omitted from array and listed in unknown[]
    const unknownList = resTickers.body?.unknown || [];
    assert(unknownList.includes('UNKNOWN_TEST_SYM_015'),
      'FR-003 unknown symbol omitted and listed in unknown[]',
      `Expected unknown list to include "UNKNOWN_TEST_SYM_015", got ${JSON.stringify(unknownList)}`);
  }

  console.log('✅ [015 Acceptance Suite 01] Passed all TradingView shared client, candles & live checks.');
}

run().catch(err => {
  console.error(`❌ Suite run error: ${err.message}`);
  process.exit(1);
});
