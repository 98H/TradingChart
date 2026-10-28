// server/depthFeed.js
// Level 2 Depth of Market (DOM) / Order Book for TradingChart.
// Binance-listed symbols get the REAL order book (public market-data mirror).
// Instruments without a real order book answer 404 depth_unavailable (FR-008).

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
    return {
      0: Number(p),
      1: size,
      level: i + 1,
      price: Number(p),
      size: Number(size.toFixed(6)),
      total: Number(cum.toFixed(6))
    };
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

  const meta = getSymbolMeta(clean) || getSymbolMeta(symbol) || {};
  const isBinance = meta.exchange === 'Binance' || meta.source === 'binance' || meta.market === 'crypto' || String(symbol || '').startsWith('BINANCE:');
  if (!isBinance) {
    const err = new Error('depth_unavailable');
    err.code = 'DEPTH_UNAVAILABLE';
    throw err;
  }

  const j = await realBook(clean, n);
  if (!j) {
    const err = new Error('depth_unavailable');
    err.code = 'DEPTH_UNAVAILABLE';
    throw err;
  }

  const bids = ladder(j.bids, n);
  const asks = ladder(j.asks, n);
  const bestBid = bids[0].price, bestAsk = asks[0].price;
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const data = {
    symbol: clean,
    lastPrice: mid,
    spread: Number(spread.toFixed(8)),
    spreadPct: Number(((spread / mid) * 100).toFixed(5)),
    bids,
    asks,
    maxDepth: Math.max(bids.at(-1)?.total || 0, asks.at(-1)?.total || 0),
    source: 'binance',
    simulated: false,
    timestamp: Date.now()
  };

  cache.set(key, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return data;
}
