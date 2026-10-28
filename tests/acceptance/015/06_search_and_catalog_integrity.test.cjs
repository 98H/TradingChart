/**
 * @spec 015
 * @covers FR-012
 * Architect converge test (post-merge production audit 2026-10-28). Every search result and every catalogue entry
 * must chart ITSELF from its declared source with correct status and precision; the accuracy tool must fail closed.
 */
const http = require('http');
const { execFileSync } = require('child_process');
const path = require('path');
const BASE = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';
const ROOT = path.resolve(__dirname, '../../..');
let failed = 0;
const fail = (s, r) => { failed++; console.error(`❌ ${s}: ${r}`); };
const get = (p) => new Promise((resolve) => {
  const req = http.get(BASE + p, { timeout: 60000 }, (res) => {
    let b = ''; res.on('data', c => { b += c; });
    res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} resolve({ status: res.statusCode, body: j, headers: res.headers }); });
  });
  req.on('error', e => resolve({ status: -1, error: e.message }));
  req.on('timeout', () => { req.destroy(); resolve({ status: -1, error: 'timeout' }); });
});
const decimals = (n) => { const s = String(n); return s.includes('.') ? s.split('.')[1].length : 0; };

(async () => {
  // 1. Search results: id must be a TradingView-resolvable ticker (prefix), chart itself, from its declared source
  const queries = ['EURUSD', 'AAPL', 'XAUUSD', 'SPX', 'DXY', 'US10Y', 'GBPJPY', 'TSLA', 'OIL', 'BTC'];
  for (const q of queries) {
    const r = await get(`/api/symbols?q=${encodeURIComponent(q)}`);
    if (r.status !== 200 || !Array.isArray(r.body)) { fail(`FR-012 search ${q}`, `status ${r.status}`); continue; }
    for (const e of r.body.slice(0, 10)) {
      if (/\s/.test(e.symbol) || /[a-z]/.test(e.symbol.split(':')[0])) fail('FR-012 search id is a canonical uppercase prefix without spaces', `${q}: ${e.symbol}`);
      const c = await get(`/api/candles?symbol=${encodeURIComponent(e.symbol)}&timeframe=D&limit=5`);
      if (c.status !== 200) { fail('FR-012 every search result is chartable', `${e.symbol} -> ${c.status} ${c.body && c.body.error}`); continue; }
      if (c.body.symbol !== e.symbol) fail('FR-012 candles answer for the requested symbol', `${e.symbol} -> ${c.body.symbol}`);
      if (c.body.source !== e.source && c.body.source !== 'cache') fail('FR-012 candle source equals catalogue source', `${e.symbol}: ${e.source} vs ${c.body.source}`);
      if ((c.body.delaySec || 0) > 0 && e.dataStatus === 'live') fail('FR-012 delayed symbol never labelled live in search', `${e.symbol} delay ${c.body.delaySec}`);
      if (e.type === 'forex' && /JPY/.test(e.symbol) === false && e.precision < 4) fail('FR-012 forex precision from provider pricescale', `${e.symbol} precision ${e.precision}`);
    }
  }
  // 2. Unknown exchange prefix never falls back to another instrument
  for (const bogus of ['FOOBAR:DXY', 'NOPE:EURUSD']) {
    const c = await get(`/api/candles?symbol=${encodeURIComponent(bogus)}&timeframe=D&limit=5`);
    if (c.status === 200) fail('FR-012 unresolvable symbol never served from another source', `${bogus} -> ${c.body && c.body.symbol} (${c.body && c.body.source})`);
  }
  // 3. Every curated catalogue entry (non-crypto) is chartable on D and its status matches the provider delay
  const all = await get('/api/symbols?category=all&limit=5000');
  const curated = (all.body || []).filter(e => e.source !== 'binance');
  for (const e of curated) {
    const c = await get(`/api/candles?symbol=${encodeURIComponent(e.symbol)}&timeframe=D&limit=5`);
    if (c.status !== 200) { fail('FR-012 every curated catalogue entry is chartable', `${e.symbol} -> ${c.status} ${c.body && (c.body.error)}`); continue; }
    if ((c.body.delaySec || 0) > 0 && e.dataStatus !== 'delayed') fail('FR-012 catalogue dataStatus matches provider delay', `${e.symbol}: ${e.dataStatus} vs delay ${c.body.delaySec}`);
    const last = c.body.candles[c.body.candles.length - 1];
    if (e.minTick && decimals(last.close) > Math.max(decimals(e.minTick), 0) + 0) { /* close may have fewer decimals; more is a precision bug */
      fail('FR-012 price decimals do not exceed catalogue minTick', `${e.symbol}: close ${last.close} minTick ${e.minTick}`);
    }
  }
  // 4. Accuracy tool must fail closed when the server is unreachable
  try {
    execFileSync(process.execPath, ['tools/accuracy_audit.mjs'], { cwd: ROOT, env: { ...process.env, SDD_BASE_URL: 'http://127.0.0.1:9' }, stdio: 'pipe', timeout: 120000 });
    fail('FR-012 accuracy audit fails closed', 'exit 0 against an unreachable server');
  } catch (e) { if (e.status !== 1) fail('FR-012 accuracy audit fails closed with exit 1', `exit ${e.status}`); }

  if (failed) process.exit(1);
  console.log('[015 Acceptance Suite 06] PASS: search/catalogue integrity, no cross-source fallback, fail-closed audit.');
})();
