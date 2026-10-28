/**
 * @spec 015
 * @covers FR-004, FR-005, FR-011
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
  console.log(`[015 Acceptance Suite 02] Running Real Catalogue & Binance Spot Expansion against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Real Catalogue Schema & Zero Demo Entries (FR-004, SC-001, SC-002)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resCatalog = await request('/api/symbols?limit=2500');
    assert(resCatalog.status === 200, 'FR-004 /api/symbols status 200', `Expected 200, got ${resCatalog.status}`);

    const symbols = Array.isArray(resCatalog.body) ? resCatalog.body : (resCatalog.body?.symbols || []);
    assert(symbols.length >= 1300, 'SC-002 catalogue size >= 1300',
      `Expected >= 1300 catalogue entries, got ${symbols.length}`);

    const validSources = new Set(['binance', 'tradingview', 'tgju', 'brsapi', 'tsetmc_proxy']);
    const validDataStatuses = new Set(['live', 'delayed', 'eod']);

    for (let i = 0; i < symbols.length; i++) {
      const entry = symbols[i];
      assert(typeof entry.symbol === 'string' && entry.symbol.length > 0,
        `FR-004 entry [${i}] valid symbol`, `Invalid symbol: ${JSON.stringify(entry.symbol)}`);
      assert(typeof entry.name === 'string' && entry.name.length > 0,
        `FR-004 entry [${i}] valid name`, `Invalid name for ${entry.symbol}`);
      assert(typeof entry.nameFa === 'string' && entry.nameFa.length > 0,
        `FR-004 entry [${i}] valid nameFa`, `Invalid nameFa for ${entry.symbol}`);
      assert(typeof entry.exchange === 'string' && entry.exchange.length > 0,
        `FR-004 entry [${i}] valid exchange`, `Invalid exchange for ${entry.symbol}`);
      assert(typeof entry.type === 'string' && entry.type.length > 0,
        `FR-004 entry [${i}] valid type`, `Invalid type for ${entry.symbol}`);
      assert(typeof entry.category === 'string' && entry.category.length > 0,
        `FR-004 entry [${i}] valid category`, `Invalid category for ${entry.symbol}`);
      assert(typeof entry.currency === 'string' && entry.currency.length > 0,
        `FR-004 entry [${i}] valid currency`, `Invalid currency for ${entry.symbol}`);

      // Honest data: MUST be a real source, NEVER demo or synthetic
      assert(validSources.has(entry.source),
        `FR-004 entry [${i}] real source`,
        `Symbol ${entry.symbol} has invalid source "${entry.source}". Must be one of: ${[...validSources].join(', ')}`);
      assert(entry.source !== 'demo' && entry.source !== 'synthetic',
        `SC-001 zero demo sources in catalogue`, `Symbol ${entry.symbol} has forbidden demo/synthetic source`);

      assert(validDataStatuses.has(entry.dataStatus),
        `FR-004 entry [${i}] valid dataStatus`,
        `Symbol ${entry.symbol} has invalid dataStatus "${entry.dataStatus}"`);
      assert(typeof entry.delaySec === 'number' && entry.delaySec >= 0,
        `FR-004 entry [${i}] valid delaySec`, `Symbol ${entry.symbol} invalid delaySec: ${entry.delaySec}`);
      assert(Array.isArray(entry.timeframes) && entry.timeframes.length > 0,
        `FR-004 entry [${i}] valid timeframes array`, `Symbol ${entry.symbol} missing timeframes array`);
    }

    // Curated TradingView defaults must be present
    const expectedCurated = [
      'OANDA:EURUSD', 'OANDA:XAUUSD', 'NASDAQ:AAPL', 'TVC:USOIL', 'SP:SPX', 'BINANCE:BTCUSDT'
    ];
    for (const sym of expectedCurated) {
      const found = symbols.find(s => s.symbol === sym);
      assert(!!found, `FR-004 curated symbol ${sym} present in catalogue`, `Catalogue missing ${sym}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TradingView Search Proxy (/api/symbols?q=) (FR-004)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Search EURUSD: returns OANDA:EURUSD with exchange, type, description
    const resSearchEur = await request('/api/symbols?q=EURUSD');
    assert(resSearchEur.status === 200, 'FR-004 search EURUSD status 200', `Expected 200, got ${resSearchEur.status}`);
    const resultsEur = Array.isArray(resSearchEur.body) ? resSearchEur.body : [];
    assert(resultsEur.length > 0 && resultsEur.length <= 50,
      'FR-004 search EURUSD returns bounded results (<= 50)', `Count was ${resultsEur.length}`);
    const eurItem = resultsEur.find(r => r.symbol === 'OANDA:EURUSD' || r.symbol.includes('EURUSD'));
    assert(!!eurItem, 'FR-004 search EURUSD contains OANDA:EURUSD', 'Search missing OANDA:EURUSD');
    assert(eurItem.source === 'tradingview', 'FR-004 search item source is tradingview',
      `Expected "tradingview", got "${eurItem.source}"`);

    // Search AAPL: returns NASDAQ:AAPL
    const resSearchAapl = await request('/api/symbols?q=AAPL');
    assert(resSearchAapl.status === 200, 'FR-004 search AAPL status 200', `Expected 200, got ${resSearchAapl.status}`);
    const resultsAapl = Array.isArray(resSearchAapl.body) ? resSearchAapl.body : [];
    const aaplItem = resultsAapl.find(r => r.symbol === 'NASDAQ:AAPL');
    assert(!!aaplItem, 'FR-004 search AAPL contains NASDAQ:AAPL', 'Search missing NASDAQ:AAPL');
    assert(aaplItem.exchange === 'NASDAQ', 'FR-004 AAPL exchange is NASDAQ', `Got "${aaplItem.exchange}"`);

    // /api/symbol-info resolution & alias test
    const resInfo = await request('/api/symbol-info?symbol=OANDA:EURUSD');
    assert(resInfo.status === 200, 'FR-004 /api/symbol-info OANDA:EURUSD status 200', `Expected 200, got ${resInfo.status}`);
    assert(resInfo.body?.symbol === 'OANDA:EURUSD', 'FR-004 symbol-info returns canonical id',
      `Expected "OANDA:EURUSD", got "${resInfo.body?.symbol}"`);

    // Alias resolution: bare EURUSD resolves to canonical OANDA:EURUSD
    const resInfoAlias = await request('/api/symbol-info?symbol=EURUSD');
    assert(resInfoAlias.status === 200, 'FR-004 symbol-info resolves bare EURUSD alias', `Expected 200, got ${resInfoAlias.status}`);
    assert(resInfoAlias.body?.symbol === 'OANDA:EURUSD', 'FR-004 bare EURUSD alias canonical',
      `Expected "OANDA:EURUSD", got "${resInfoAlias.body?.symbol}"`);

    // Non-existent symbol returns 404 { ok: false, error: "unknown_symbol" }
    const resInfoUnknown = await request('/api/symbol-info?symbol=NONEXISTENT_XYZ_015');
    assert(resInfoUnknown.status === 404, 'FR-004 unknown symbol info returns 404', `Expected 404, got ${resInfoUnknown.status}`);
    assert(resInfoUnknown.body?.ok === false && resInfoUnknown.body?.error === 'unknown_symbol',
      'FR-004 unknown symbol payload', `Expected {ok:false, error:"unknown_symbol"}, got ${JSON.stringify(resInfoUnknown.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Binance Complete Spot Universe (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resCrypto = await request('/api/symbols?category=crypto&limit=2500');
    assert(resCrypto.status === 200, 'FR-005 /api/symbols crypto status 200', `Expected 200, got ${resCrypto.status}`);
    const cryptoSymbols = Array.isArray(resCrypto.body) ? resCrypto.body : [];

    // Filter USDT quoted pairs
    const usdtPairs = cryptoSymbols.filter(s => s.currency === 'USDT' || s.symbol.endsWith('USDT'));
    assert(usdtPairs.length >= 500, 'FR-005 Binance USDT spot pairs count >= 500',
      `Expected >= 500 USDT spot pairs, got ${usdtPairs.length}`);

    // Check exchange-qualified naming: BINANCE:<PAIR>
    const btcEntry = cryptoSymbols.find(s => s.symbol === 'BINANCE:BTCUSDT');
    assert(!!btcEntry, 'FR-005 BINANCE:BTCUSDT present', 'Missing BINANCE:BTCUSDT');
    assert(typeof btcEntry.precision === 'number', 'FR-005 BTCUSDT precision numeric', 'Missing precision');
    assert(typeof btcEntry.minTick === 'number' && btcEntry.minTick > 0,
      'FR-005 BTCUSDT minTick positive number', 'Invalid minTick');

    // Check other quotes are supported: BTC, ETH, USDC, EUR
    const btcQuoted = cryptoSymbols.some(s => s.currency === 'BTC' || s.symbol.endsWith('BTC'));
    const usdcQuoted = cryptoSymbols.some(s => s.currency === 'USDC' || s.symbol.endsWith('USDC'));
    assert(btcQuoted, 'FR-005 BTC quoted pairs present', 'Missing BTC quoted crypto pairs');
    assert(usdcQuoted, 'FR-005 USDC quoted pairs present', 'Missing USDC quoted crypto pairs');

    // Alias check: bare BTCUSDT resolves to BINANCE:BTCUSDT
    const resBtcAlias = await request('/api/symbol-info?symbol=BTCUSDT');
    assert(resBtcAlias.status === 200, 'FR-005 bare BTCUSDT alias resolves to 200', `Expected 200, got ${resBtcAlias.status}`);
    assert(resBtcAlias.body?.symbol === 'BINANCE:BTCUSDT', 'FR-005 BTCUSDT resolves to BINANCE:BTCUSDT',
      `Expected "BINANCE:BTCUSDT", got "${resBtcAlias.body?.symbol}"`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Default Watchlist & Screener Real Universe (FR-011)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Technical Screener endpoint /api/screener
    const resScreener = await request('/api/screener');
    if (resScreener.status === 200) {
      const screenerRows = Array.isArray(resScreener.body) ? resScreener.body : (resScreener.body?.data || []);
      for (const row of screenerRows) {
        assert(row.source !== 'demo' && row.source !== 'synthetic',
          'FR-011 screener universe contains no demo symbols',
          `Screener contains demo symbol: ${row.symbol}`);
      }
    }

    // Default real symbols check
    const realDefaults = [
      'BINANCE:BTCUSDT', 'OANDA:XAUUSD', 'OANDA:EURUSD', 'TVC:USOIL', 'SP:SPX', 'NASDAQ:AAPL'
    ];
    for (const sym of realDefaults) {
      const resSym = await request(`/api/symbol-info?symbol=${encodeURIComponent(sym)}`);
      assert(resSym.status === 200, `FR-011 default universe symbol ${sym} valid`,
        `Default symbol ${sym} not valid or missing from catalogue`);
    }
  }

  console.log('✅ [015 Acceptance Suite 02] Passed all Real Catalogue & Binance Spot checks.');
}

run().catch(err => {
  console.error(`❌ Suite run error: ${err.message}`);
  process.exit(1);
});
