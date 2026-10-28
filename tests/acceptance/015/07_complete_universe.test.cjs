/**
 * @spec 015
 * @covers FR-013
 * Architect test (founder 2026-10-28: the catalogue must be complete — full TradingView universe, all Iranian symbols).
 */
const http = require('http');
const BASE = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';
let failed = 0;
const fail = (s, r) => { failed++; console.error(`❌ ${s}: ${r}`); };
const get = (p) => new Promise((resolve) => {
  const req = http.get(BASE + p, { timeout: 90000 }, (res) => {
    let b = ''; res.on('data', c => { b += c; });
    res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} resolve({ status: res.statusCode, body: j }); });
  });
  req.on('error', e => resolve({ status: -1, error: e.message }));
  req.on('timeout', () => { req.destroy(); resolve({ status: -1, error: 'timeout' }); });
});

(async () => {
  // 1. Markets with live totals
  const m = await get('/api/symbols/markets');
  if (m.status !== 200 || !Array.isArray(m.body)) { fail('FR-013 markets endpoint', `status ${m.status}`); }
  const markets = Array.isArray(m.body) ? m.body : [];
  const byId = Object.fromEntries(markets.map(x => [x.market, x]));
  const minTotals = { global: 300000, crypto: 30000, futures: 20000, america: 10000, forex: 3000, bonds: 500 };
  for (const [k, min] of Object.entries(minTotals)) {
    if (!byId[k]) fail('FR-013 market listed', k);
    else if (!(byId[k].total >= min)) fail('FR-013 market total is the real universe size', `${k}: ${byId[k].total} < ${min}`);
    else if (!byId[k].labelFa || !byId[k].labelEn) fail('FR-013 market labels FA/EN', k);
  }
  const sum = markets.filter(x => ['global', 'crypto', 'futures', 'forex', 'bonds', 'economics2', 'cfd'].includes(x.market)).reduce((a, x) => a + (x.total || 0), 0);
  if (sum < 500000) fail('SC-006 universe ≥ 500 000 instruments', `sum ${sum}`);

  // 2. Browse paging + sample charting across markets
  const sample = [];
  for (const mk of ['america', 'forex', 'crypto', 'futures', 'bonds', 'global']) {
    for (const off of [0, 500]) {
      const b = await get(`/api/symbols/browse?market=${mk}&offset=${off}&limit=50`);
      if (b.status !== 200 || !b.body || !Array.isArray(b.body.items)) { fail('FR-013 browse page', `${mk}@${off}: ${b.status}`); continue; }
      if (!(b.body.total > 0)) fail('FR-013 browse total', `${mk}: ${b.body.total}`);
      if (b.body.items.length !== 50) fail('FR-013 browse limit honoured', `${mk}@${off}: ${b.body.items.length}`);
      for (const e of b.body.items) {
        if (!/^[A-Z0-9_.]+:[^\s]+$/.test(e.symbol)) fail('FR-013 browse ids are EXCHANGE:SYMBOL', e.symbol);
        if (!['live', 'delayed', 'eod'].includes(e.dataStatus)) fail('FR-013 browse dataStatus', `${e.symbol}: ${e.dataStatus}`);
      }
      // only instruments with a price feed (exclude economic series) for the charting sample
      sample.push(...b.body.items.filter(e => e.type !== 'economic').slice(0, 5));
    }
  }
  const p1 = await get('/api/symbols/browse?market=america&offset=0&limit=20');
  const p2 = await get('/api/symbols/browse?market=america&offset=20&limit=20');
  if (p1.body && p2.body && p1.body.items && p2.body.items) {
    const overlap = p1.body.items.filter(a => p2.body.items.some(b => b.symbol === a.symbol));
    if (overlap.length) fail('FR-013 browse pages do not overlap', overlap.map(x => x.symbol).join(','));
  }
  const filt = await get('/api/symbols/browse?market=forex&exchange=OANDA&offset=0&limit=50');
  if (!filt.body || !filt.body.items || !filt.body.items.every(e => e.symbol.startsWith('OANDA:'))) fail('FR-013 browse exchange filter', JSON.stringify((filt.body && filt.body.items || []).slice(0, 3).map(x => x.symbol)));
  let charted = 0;
  for (const e of sample.slice(0, 60)) {
    const c = await get(`/api/candles?symbol=${encodeURIComponent(e.symbol)}&timeframe=D&limit=5`);
    if (c.status === 200 && c.body.symbol === e.symbol && c.body.count > 0) charted++;
    else if (c.status === 200 && c.body.symbol !== e.symbol) fail('FR-013 browsed id charts itself', `${e.symbol} -> ${c.body.symbol}`);
  }
  if (charted < Math.floor(Math.min(60, sample.length) * 0.9)) fail('SC-006 ≥ 90% of browsed sample charts on D', `${charted}/${Math.min(60, sample.length)}`);

  // 3. Prefix collision: TSE = Tokyo on TradingView
  const toyota = await get('/api/candles?symbol=TSE:7203&timeframe=D&limit=5');
  if (toyota.status !== 200 || toyota.body.source !== 'tradingview' || toyota.body.symbol !== 'TSE:7203') fail('FR-013 TSE:7203 is Toyota from TradingView', `${toyota.status} ${toyota.body && toyota.body.source}`);
  // Tehran prefix is TSETMC: — absent without a key, never served as TSE:
  const teh = await get('/api/symbols?category=iran_tse');
  if (teh.status === 200 && Array.isArray(teh.body) && teh.body.some(e => !e.symbol.startsWith('TSETMC:'))) fail('FR-013 Tehran ids use TSETMC:', teh.body.slice(0, 3).map(e => e.symbol).join(','));

  // 4. Search reaches non-US exchanges
  for (const [q, want] of [['RELIANCE', 'NSE:RELIANCE'], ['THYAO', 'BIST:THYAO'], ['VOD', 'LSE:VOD']]) {
    const r = await get(`/api/symbols?q=${q}`);
    if (!r.body || !r.body.some(e => e.symbol === want)) fail('FR-013 search reaches every exchange', `${q} missing ${want}`);
  }

  if (failed) process.exit(1);
  console.log('[015 Acceptance Suite 07] PASS: complete TradingView universe browsable and chartable; TSE/TSETMC prefixes correct.');
})();
