// server/depthFeed.js
// Level 2 Depth of Market (DOM) / Order Book for TradingChart.
//
// Binance-listed symbols get the REAL order book (public market-data mirror,
// reachable from restricted regions). Instruments without a public book
// (Tehran bazaar, TSE, OTC FX) get a clearly-flagged SIMULATED ladder — the
// payload carries `source` + `simulated` so the UI can label it honestly.

import { get24hTicker } from './dataFeed.js';
import { getSymbolMeta } from './symbolCatalog.js';

const BOOK_BASES = [
  'https://data-api.binance.vision/api/v3',
  'https://api.binance.com/api/v3'
];
const CACHE_MS = 1500;
const cache = new Map(); // symbol -> { at, data }

async function fetchJson(url, ms = 3500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function ladder(rows, levels) {
  let cum = 0;
  return rows.slice(0, levels).map(([p, q], i) => {
    const size = Number(q);
    cum += size;
    return { level: i + 1, price: Number(p), size: Number(size.toFixed(6)), total: Number(cum.toFixed(6)) };
  });
}

async function realBook(clean, levels) {
  const limit = levels <= 5 ? 5 : levels <= 10 ? 10 : levels <= 20 ? 20 : 50;
  for (const base of BOOK_BASES) {
    try {
      const j = await fetchJson(`${base}/depth?symbol=${encodeURIComponent(clean)}&limit=${limit}`);
      if (Array.isArray(j?.bids) && Array.isArray(j?.asks) && j.bids.length && j.asks.length) return j;
    } catch (e) { /* try next mirror */ }
  }
  return null;
}

export async function getOrderBookDepth(symbol, levels = 15) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const n = Math.max(1, Math.min(50, Number(levels) || 15));
  const key = clean + ':' + n;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const meta = getSymbolMeta(clean) || {};
  let data = null;

  if (meta.exchange === 'Binance' || meta.market === 'crypto') {
    const j = await realBook(clean, n);
    if (j) {
      const bids = ladder(j.bids, n);
      const asks = ladder(j.asks, n);
      const bestBid = bids[0].price, bestAsk = asks[0].price;
      const mid = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      data = {
        symbol: clean,
        lastPrice: mid,
        spread: Number(spread.toFixed(8)),
        spreadPct: Number(((spread / mid) * 100).toFixed(5)),
        bids,
        asks,
        maxDepth: Math.max(bids.at(-1).total, asks.at(-1).total),
        source: 'binance',
        simulated: false,
        timestamp: Date.now()
      };
    }
  }

  if (!data) {
    // Simulated ladder around the real last price (deterministic sizes per
    // level so the book does not flicker randomly on every poll).
    const ticker = await get24hTicker(clean);
    const lastPrice = Number(ticker?.lastPrice) || 0;
    const tickSize = meta.minTick || (lastPrice > 1000 ? 0.5 : 0.01);
    const precision = meta.precision ?? 2;
    const halfSpread = tickSize * 1.5;
    const bestBid = lastPrice - halfSpread;
    const bestAsk = lastPrice + halfSpread;
    const bids = [], asks = [];
    let cb = 0, ca = 0;
    for (let i = 0; i < n; i++) {
      const bp = Number((bestBid - i * tickSize * (1 + i * 0.1)).toFixed(precision));
      const ap = Number((bestAsk + i * tickSize * (1 + i * 0.1)).toFixed(precision));
      const bs = Number((Math.abs(Math.sin((i + 1) * 1.7)) * 2.4 + 0.2 + i * 0.15).toFixed(3));
      const as = Number((Math.abs(Math.cos((i + 1) * 1.3)) * 2.4 + 0.2 + i * 0.15).toFixed(3));
      cb += bs; ca += as;
      bids.push({ level: i + 1, price: bp, size: bs, total: Number(cb.toFixed(3)) });
      asks.push({ level: i + 1, price: ap, size: as, total: Number(ca.toFixed(3)) });
    }
    const spread = Number((bestAsk - bestBid).toFixed(precision));
    data = {
      symbol: clean,
      lastPrice,
      spread,
      spreadPct: lastPrice ? Number(((spread / lastPrice) * 100).toFixed(4)) : 0,
      bids,
      asks,
      maxDepth: Math.max(cb, ca),
      source: 'simulated',
      simulated: true,
      timestamp: Date.now()
    };
  }

  cache.set(key, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return data;
}
