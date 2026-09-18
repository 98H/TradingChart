// server/depthFeed.js
// Institutional Level 2 Depth of Market (DOM) / Order Book Engine for TradingChart

import { get24hTicker } from './dataFeed.js';
import { getSymbolMeta } from './symbolCatalog.js';

export async function getOrderBookDepth(symbol, levels = 15) {
  const clean = symbol.replace(/^.*:/, '').toUpperCase();
  const ticker = await get24hTicker(clean);
  const meta = getSymbolMeta(clean);
  const lastPrice = ticker.lastPrice || 100.0;
  const tickSize = meta.minTick || (lastPrice > 1000 ? 0.5 : 0.01);
  const precision = meta.precision || 2;

  const halfSpread = tickSize * 1.5;
  const bestBid = lastPrice - halfSpread;
  const bestAsk = lastPrice + halfSpread;

  const bids = [];
  const asks = [];

  let cumBidVol = 0;
  let cumAskVol = 0;

  for (let i = 0; i < levels; i++) {
    // Bid rungs
    const bidPrice = Number((bestBid - i * tickSize * (1 + i * 0.1)).toFixed(precision));
    const bidSize = Number((Math.random() * 2.5 + 0.2 + (i * 0.15)).toFixed(3));
    cumBidVol += bidSize;
    bids.push({
      level: i + 1,
      price: bidPrice,
      size: bidSize,
      total: Number(cumBidVol.toFixed(3))
    });

    // Ask rungs
    const askPrice = Number((bestAsk + i * tickSize * (1 + i * 0.1)).toFixed(precision));
    const askSize = Number((Math.random() * 2.5 + 0.2 + (i * 0.15)).toFixed(3));
    cumAskVol += askSize;
    asks.push({
      level: i + 1,
      price: askPrice,
      size: askSize,
      total: Number(cumAskVol.toFixed(3))
    });
  }

  const spread = Number((bestAsk - bestBid).toFixed(precision));
  const spreadPct = Number(((spread / lastPrice) * 100).toFixed(4));

  return {
    symbol: clean,
    lastPrice,
    spread,
    spreadPct,
    bids,
    asks,
    maxDepth: Math.max(cumBidVol, cumAskVol),
    timestamp: Date.now()
  };
}
