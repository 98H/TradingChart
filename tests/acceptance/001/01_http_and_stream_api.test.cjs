/**
 * @spec 001
 * @covers FR-002, FR-003, FR-004, FR-005, FR-021, FR-022
 */
const WebSocket = require('ws');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';
const url = new URL(BASE_URL);
const WS_URL = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/live`;

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
  // FR-022: Health endpoint
  {
    const res = await request('/api/health');
    assert(res.status === 200, 'FR-022 GET /api/health status', `Expected 200, got ${res.status}`);
    assert(res.body && res.body.status === 'online', 'FR-022 status field', `Expected status "online", got ${res.body?.status}`);
    assert(res.body && res.body.product === 'Chartivia', 'FR-022 product field', `Expected product "Chartivia", got ${res.body?.product}`);
    assert(res.body && res.body.timestamp, 'FR-022 timestamp field', 'Expected timestamp in response');
  }

  // FR-021: Platform endpoint
  {
    const res = await request('/api/platform');
    assert(res.status === 200, 'FR-021 GET /api/platform status', `Expected 200, got ${res.status}`);
    assert(res.body && res.body.ok === true, 'FR-021 ok field', 'Expected ok === true');
    assert(res.body && typeof res.body.registrationOpen === 'boolean', 'FR-021 registrationOpen field', 'Missing registrationOpen');
    assert(res.body && ('announcement' in res.body), 'FR-021 announcement field', 'Missing announcement in response');
    assert(res.body && typeof res.body.emailDelivery === 'boolean', 'FR-021 emailDelivery field', 'Missing emailDelivery');
  }

  // FR-002: Universal symbol catalogue search API
  {
    const resEn = await request('/api/symbols?q=BTC&category=all');
    assert(resEn.status === 200, 'FR-002 GET /api/symbols EN status', `Expected 200, got ${resEn.status}`);
    assert(Array.isArray(resEn.body), 'FR-002 symbols is array', 'Expected array of symbols');
    assert(resEn.body.length > 0, 'FR-002 symbols found for BTC', 'Expected at least 1 symbol for BTC');
    const btc = resEn.body.find(s => s.symbol === 'BTCUSDT');
    assert(btc && btc.name === 'Bitcoin' && btc.nameFa === 'بیت‌کوین', 'FR-002 instrument metadata', 'Invalid metadata for BTCUSDT');

    const resFa = await request(`/api/symbols?q=${encodeURIComponent('اتریوم')}&category=all`);
    assert(resFa.status === 200, 'FR-002 GET /api/symbols Persian status', `Expected 200, got ${resFa.status}`);
    assert(resFa.body.some(s => s.symbol === 'ETHUSDT'), 'FR-002 search by Persian name', 'Expected ETHUSDT matching Persian query');
  }

  // FR-003: Candlestick history and plan limits
  {
    const res = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50');
    assert(res.status === 200, 'FR-003 GET /api/candles status', `Expected 200, got ${res.status}`);
    assert(res.body && res.body.symbol === 'BTCUSDT', 'FR-003 symbol match', 'Expected BTCUSDT symbol');
    assert(res.body && Array.isArray(res.body.candles) && res.body.candles.length > 0, 'FR-003 candles array', 'Expected candles array');
    const candle = res.body.candles[0];
    assert(typeof candle.time === 'number' && typeof candle.open === 'number' && typeof candle.close === 'number', 'FR-003 candle OHLCV schema', 'Invalid candle schema');
    const histLimit = res.headers.get('x-history-limit');
    assert(histLimit && Number(histLimit) >= 10000, 'FR-003 X-History-Limit header', `Expected X-History-Limit >= 10000, got ${histLimit}`);

    // Edge case: Symbol with no market data
    const resEmpty = await request('/api/candles?symbol=NONEXISTENT_XYZ&timeframe=60');
    assert(resEmpty.status === 404, 'FR-003 empty symbol edge case 404', `Expected 404 for unknown symbol, got ${resEmpty.status}`);
    assert(resEmpty.body && resEmpty.body.error === 'no_market_data', 'FR-003 no_market_data error', `Expected error "no_market_data", got ${resEmpty.body?.error}`);
  }

  // FR-004: 24h Tickers API
  {
    const res = await request('/api/tickers?symbols=BTCUSDT,ETHUSDT');
    assert(res.status === 200, 'FR-004 GET /api/tickers status', `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body) && res.body.length >= 2, 'FR-004 tickers array', 'Expected >= 2 tickers');
    const btcTicker = res.body.find(t => t.symbol === 'BTCUSDT');
    assert(btcTicker && typeof btcTicker.lastPrice === 'number', 'FR-004 lastPrice field', 'Missing lastPrice');
    assert(btcTicker && typeof btcTicker.priceChangePercent === 'number', 'FR-004 priceChangePercent field', 'Missing priceChangePercent');
  }

  // FR-005: Live WebSocket streaming
  {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out waiting for tick'));
      }, 8000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 'subscribe', symbol: 'BTCUSDT' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tick' && msg.symbol === 'BTCUSDT') {
            assert(typeof msg.price === 'number', 'FR-005 tick price', 'Missing or non-number tick price');
            assert(typeof msg.time === 'number', 'FR-005 tick timestamp', 'Missing or non-number tick time');
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch (e) {
          clearTimeout(timer);
          ws.terminate();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).catch(err => {
      assert(false, 'FR-005 live WebSocket tick stream', err.message);
    });
  }

  console.log('PASS: 001 [API & Stream]');
}

run().catch(err => {
  console.error(`❌ Unexpected failure: ${err.message}`);
  process.exit(1);
});
