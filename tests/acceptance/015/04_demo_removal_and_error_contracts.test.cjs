/**
 * @spec 015
 * @covers FR-007, FR-008
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
  console.log(`[015 Acceptance Suite 04] Running TSE Gating & Demo Removal Contracts against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TSE / IFB Gating (FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const hasTseKey = !!process.env.TC_BRSAPI_KEY;
    const hasTseProxy = !!process.env.TC_TSETMC_PROXY;

    if (!hasTseKey && !hasTseProxy) {
      // In default unconfigured environment, TSE MUST be completely absent
      const resTseCatalog = await request('/api/symbols?category=iran_tse');
      assert(resTseCatalog.status === 200, 'FR-007 /api/symbols?category=iran_tse returns 200', `Got ${resTseCatalog.status}`);
      const tseList = Array.isArray(resTseCatalog.body) ? resTseCatalog.body : [];
      assert(tseList.length === 0, 'FR-007 iran_tse category is empty when unconfigured',
        `Expected 0 symbols, got ${tseList.length}`);

      // General catalog check: no symbol with category iran_tse
      const resAll = await request('/api/symbols?limit=100');
      const allSyms = Array.isArray(resAll.body) ? resAll.body : [];
      const leakedTse = allSyms.filter(s => s.category === 'iran_tse' || s.exchange === 'TSE');
      assert(leakedTse.length === 0, 'FR-007 no TSE symbols in general catalogue when unconfigured',
        `Found ${leakedTse.length} leaked TSE symbols`);

      // /api/tse-tape MUST return 404 { ok: false, error: "tse_unavailable" }
      const resTape = await request('/api/tse-tape');
      assert(resTape.status === 404, 'FR-007 /api/tse-tape returns 404 when unconfigured', `Got ${resTape.status}`);
      assert(resTape.body?.ok === false && resTape.body?.error === 'tse_unavailable',
        'FR-007 /api/tse-tape error payload tse_unavailable',
        `Expected {ok:false, error:"tse_unavailable"}, got ${JSON.stringify(resTape.body)}`);

      // Candles for TSE symbol return 404 unknown_symbol
      const resTseCandles = await request('/api/candles?symbol=TSE:FOOLAD&timeframe=D');
      assert(resTseCandles.status === 404, 'FR-007 TSE:FOOLAD candles return 404', `Got ${resTseCandles.status}`);
      assert(resTseCandles.body?.error === 'unknown_symbol',
        'FR-007 TSE:FOOLAD unknown_symbol error', `Got ${resTseCandles.body?.error}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Demo Removal & Unknown Symbol Contract (FR-008, SC-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Former demo symbol FOOLAD (without TSE source) MUST return 404 unknown_symbol
    const resFoolad = await request('/api/candles?symbol=FOOLAD&timeframe=60&limit=5');
    assert(resFoolad.status === 404, 'FR-008 former demo symbol FOOLAD returns 404',
      `Expected 404, got ${resFoolad.status}`);
    assert(resFoolad.body?.ok === false && resFoolad.body?.error === 'unknown_symbol',
      'FR-008 FOOLAD returns {ok:false, error:"unknown_symbol"}',
      `Got ${JSON.stringify(resFoolad.body)}`);

    // Non-existent symbol also returns 404 unknown_symbol
    const resNonExistent = await request('/api/candles?symbol=NONEXISTENT_XYZ_TEST&timeframe=60');
    assert(resNonExistent.status === 404, 'FR-008 non-existent symbol returns 404', `Got ${resNonExistent.status}`);
    assert(resNonExistent.body?.error === 'unknown_symbol',
      'FR-008 non-existent error unknown_symbol', `Got ${resNonExistent.body?.error}`);

    // Tickers with unknown symbols: omitted from array and listed in unknown[]
    const resTickers = await request('/api/tickers?symbols=FOOLAD,UNKNOWN_ABC_XYZ');
    assert(resTickers.status === 200, 'FR-008 tickers with unknown symbols returns 200', `Got ${resTickers.status}`);
    const tickersArr = Array.isArray(resTickers.body) ? resTickers.body : (resTickers.body?.tickers || []);
    assert(tickersArr.length === 0, 'FR-008 no tickers returned for unknown symbols',
      `Expected 0 tickers, got ${tickersArr.length}`);
    const unknownKeys = resTickers.body?.unknown || [];
    assert(unknownKeys.includes('FOOLAD') && unknownKeys.includes('UNKNOWN_ABC_XYZ'),
      'FR-008 unknown list contains FOOLAD and UNKNOWN_ABC_XYZ',
      `Expected unknown list to contain requested unknown symbols, got ${JSON.stringify(unknownKeys)}`);

    // WebSocket subscribe to former demo symbol yields error
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out waiting for unknown_symbol error'));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe', symbol: 'FOOLAD' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'error' && msg.error === 'unknown_symbol' && msg.symbol === 'FOOLAD') {
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
      assert(false, 'FR-008 WS subscribe to removed symbol returns error', err.message);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Depth of Market: Binance Spot Only, Others 404 depth_unavailable (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Binance symbol: returns 200 with real orderbook
    const resBtcDepth = await request('/api/depth?symbol=BINANCE:BTCUSDT');
    // Note: if aliased, BTCUSDT also works
    const resBtcBare = await request('/api/depth?symbol=BTCUSDT');
    const validBtcDepth = (resBtcDepth.status === 200 ? resBtcDepth : resBtcBare);
    assert(validBtcDepth.status === 200, 'FR-008 Binance BTCUSDT depth returns 200',
      `Expected 200, got ${validBtcDepth.status}`);
    assert(validBtcDepth.body?.source !== 'simulated' && !validBtcDepth.body?.simulated,
      'FR-008 Binance depth is never simulated', 'Depth was marked simulated');
    assert(Array.isArray(validBtcDepth.body?.bids) && Array.isArray(validBtcDepth.body?.asks),
      'FR-008 Binance depth has bids and asks arrays', 'Missing bids/asks arrays');

    // Non-Binance symbols MUST return 404 { ok: false, error: "depth_unavailable" }
    const nonBinanceSymbols = ['OANDA:EURUSD', 'NASDAQ:AAPL', 'IR:COIN_EMAMI'];
    for (const sym of nonBinanceSymbols) {
      const resNonBinance = await request(`/api/depth?symbol=${encodeURIComponent(sym)}`);
      assert(resNonBinance.status === 404,
        `FR-008 non-Binance symbol ${sym} depth returns 404`,
        `Expected 404, got ${resNonBinance.status}`);
      assert(resNonBinance.body?.ok === false && resNonBinance.body?.error === 'depth_unavailable',
        `FR-008 depth_unavailable error payload for ${sym}`,
        `Expected {ok:false, error:"depth_unavailable"}, got ${JSON.stringify(resNonBinance.body)}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Gold Snapshot: Real Inputs Only (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resGold = await request('/api/gold-snapshot');
    // Returns 200 when real feeds are available or 503 when downstream is down
    if (resGold.status === 200) {
      assert(typeof resGold.body?.ounceUsd?.value === 'number' && resGold.body?.ounceUsd?.value > 1000,
        'FR-008 gold snapshot ounceUsd value realistic', `Invalid ounce value: ${resGold.body?.ounceUsd?.value}`);
      assert(resGold.body?.ounceUsd?.source === 'tradingview',
        'FR-008 gold snapshot ounce source is tradingview', `Got "${resGold.body?.ounceUsd?.source}"`);

      assert(typeof resGold.body?.usdFree?.value === 'number' && resGold.body?.usdFree?.value > 20000,
        'FR-008 gold snapshot usdFree value realistic', `Invalid usdFree value: ${resGold.body?.usdFree?.value}`);
      assert(resGold.body?.usdFree?.source === 'tgju',
        'FR-008 gold snapshot usdFree source is tgju', `Got "${resGold.body?.usdFree?.source}"`);

      assert(resGold.body?.coins?.emami, 'FR-008 gold snapshot contains emami coin', 'Missing emami coin data');
      assert(resGold.body?.coins?.emami?.source === 'tgju',
        'FR-008 emami coin source is tgju', `Got "${resGold.body?.coins?.emami?.source}"`);
    } else {
      assert(resGold.status === 503, 'FR-008 gold snapshot status 200 or 503',
        `Expected 200 or 503, got ${resGold.status}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Market Sources: Real Feeds Only, Zero Demo (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resSources = await request('/api/market-sources');
    assert(resSources.status === 200, 'FR-008 /api/market-sources returns 200', `Got ${resSources.status}`);

    const sources = Array.isArray(resSources.body?.sources) ? resSources.body.sources : (resSources.body || []);
    const sourceNames = sources.map(s => typeof s === 'string' ? s : s.name || s.id);

    assert(!sourceNames.includes('demo'), 'FR-008 demo source removed from market-sources',
      `"demo" found in market sources: ${JSON.stringify(sourceNames)}`);

    assert(sourceNames.includes('binance'), 'FR-008 binance in market-sources', 'Missing binance source');
    assert(sourceNames.includes('tradingview'), 'FR-008 tradingview in market-sources', 'Missing tradingview source');
    assert(sourceNames.includes('tgju'), 'FR-008 tgju in market-sources', 'Missing tgju source');
  }

  console.log('✅ [015 Acceptance Suite 04] Passed all TSE Gating & Demo Removal checks.');
}

run().catch(err => {
  console.error(`❌ Suite run error: ${err.message}`);
  process.exit(1);
});
