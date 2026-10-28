// server/technicalScreener.js
// High-Throughput Institutional Technical Screener Engine for TradingChart
// Real universe only (Binance spot + Curated TradingView global markets)

import { get24hTicker, getCandles } from './dataFeed.js';

export const DEFAULT_SCREENER_SYMBOLS = [
  // ── 1. Crypto Spot (17 Top Binance Pairs) ──────────────────────────
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', nameFa: 'بیت‌کوین', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', nameFa: 'اتریوم', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:SOLUSDT', name: 'Solana', nameFa: 'سولانا', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:BNBUSDT', name: 'BNB', nameFa: 'بایننس کوین', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:XRPUSDT', name: 'Ripple', nameFa: 'ریپل', category: 'crypto', exchange: 'Binance', precision: 4, source: 'binance' },
  { symbol: 'BINANCE:TONUSDT', name: 'Toncoin', nameFa: 'تون کوین', category: 'crypto', exchange: 'Binance', precision: 4, source: 'binance' },
  { symbol: 'BINANCE:DOGEUSDT', name: 'Dogecoin', nameFa: 'دوج کوین', category: 'crypto', exchange: 'Binance', precision: 5, source: 'binance' },
  { symbol: 'BINANCE:ADAUSDT', name: 'Cardano', nameFa: 'کاردانو', category: 'crypto', exchange: 'Binance', precision: 4, source: 'binance' },
  { symbol: 'BINANCE:AVAXUSDT', name: 'Avalanche', nameFa: 'آوالانچ', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:LINKUSDT', name: 'Chainlink', nameFa: 'چین‌لینک', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:SUIUSDT', name: 'Sui Network', nameFa: 'سویی', category: 'crypto', exchange: 'Binance', precision: 4, source: 'binance' },
  { symbol: 'BINANCE:NEARUSDT', name: 'NEAR Protocol', nameFa: 'نیر پروتکل', category: 'crypto', exchange: 'Binance', precision: 3, source: 'binance' },
  { symbol: 'BINANCE:APTUSDT', name: 'Aptos', nameFa: 'آپتوس', category: 'crypto', exchange: 'Binance', precision: 2, source: 'binance' },
  { symbol: 'BINANCE:PEPEUSDT', name: 'Pepe', nameFa: 'پپه', category: 'crypto', exchange: 'Binance', precision: 8, source: 'binance' },
  { symbol: 'BINANCE:SHIBUSDT', name: 'Shiba Inu', nameFa: 'شیبا اینو', category: 'crypto', exchange: 'Binance', precision: 8, source: 'binance' },
  { symbol: 'BINANCE:TAOUSDT', name: 'Bittensor', nameFa: 'بیت‌تنسور', category: 'crypto', exchange: 'Binance', precision: 1, source: 'binance' },
  { symbol: 'BINANCE:RENDERUSDT', name: 'Render', nameFa: 'رندر', category: 'crypto', exchange: 'Binance', precision: 3, source: 'binance' },

  // ── 2. Metals (OANDA) ──────────────────────────────────────────────
  { symbol: 'OANDA:XAUUSD', name: 'Gold / US Dollar Spot', nameFa: 'انس طلای جهانی', category: 'metals', exchange: 'OANDA', precision: 2, source: 'tradingview' },
  { symbol: 'OANDA:XAGUSD', name: 'Silver / US Dollar Spot', nameFa: 'انس نقره جهانی', category: 'metals', exchange: 'OANDA', precision: 3, source: 'tradingview' },

  // ── 3. Commodities & Energy (TVC) ──────────────────────────────────
  { symbol: 'TVC:USOIL', name: 'WTI Crude Oil', nameFa: 'نفت خام وست تگزاس', category: 'commodities', exchange: 'TVC', precision: 2, source: 'tradingview' },
  { symbol: 'TVC:UKOIL', name: 'Brent Crude Oil', nameFa: 'نفت خام برنت دریای شمال', category: 'commodities', exchange: 'TVC', precision: 2, source: 'tradingview' },
  { symbol: 'TVC:NATGAS', name: 'Natural Gas', nameFa: 'گاز طبیعی هنری هاب', category: 'commodities', exchange: 'TVC', precision: 3, source: 'tradingview' },

  // ── 4. Forex Majors (OANDA) ────────────────────────────────────────
  { symbol: 'OANDA:EURUSD', name: 'Euro / US Dollar', nameFa: 'یورو / دلار آمریکا', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:GBPUSD', name: 'British Pound / US Dollar', nameFa: 'پوند انگلیس / دلار آمریکا', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:USDJPY', name: 'US Dollar / Japanese Yen', nameFa: 'دلار آمریکا / ین ژاپن', category: 'forex', exchange: 'OANDA', precision: 3, source: 'tradingview' },
  { symbol: 'OANDA:AUDUSD', name: 'Australian Dollar / US Dollar', nameFa: 'دلار استرالیا / دلار آمریکا', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:USDCAD', name: 'US Dollar / Canadian Dollar', nameFa: 'دلار آمریکا / دلار کانادا', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:USDCHF', name: 'US Dollar / Swiss Franc', nameFa: 'دلار آمریکا / فرانک سوئیس', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:EURGBP', name: 'Euro / British Pound', nameFa: 'یورو / پوند بریتانیا', category: 'forex', exchange: 'OANDA', precision: 5, source: 'tradingview' },
  { symbol: 'OANDA:EURJPY', name: 'Euro / Japanese Yen', nameFa: 'یورو / ین ژاپن', category: 'forex', exchange: 'OANDA', precision: 3, source: 'tradingview' },
  { symbol: 'OANDA:GBPJPY', name: 'British Pound / Japanese Yen', nameFa: 'پوند بریتانیا / ین ژاپن', category: 'forex', exchange: 'OANDA', precision: 3, source: 'tradingview' },

  // ── 5. Indices (SP, NASDAQ, DJ) ────────────────────────────────────
  { symbol: 'SP:SPX', name: 'S&P 500 Index', nameFa: 'شاخص اس‌اندپی ۵۰۰', category: 'indices', exchange: 'SP', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:NDX', name: 'Nasdaq 100 Index', nameFa: 'شاخص نزدک ۱۰۰', category: 'indices', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'DJ:DJI', name: 'Dow Jones Industrial Average', nameFa: 'شاخص داو جونز', category: 'indices', exchange: 'DJ', precision: 2, source: 'tradingview' },

  // ── 6. Top Equities (NASDAQ) ───────────────────────────────────────
  { symbol: 'NASDAQ:AAPL', name: 'Apple Inc.', nameFa: 'سهام شرکت اپل', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:NVDA', name: 'NVIDIA Corporation', nameFa: 'سهام شرکت انویدیا', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:TSLA', name: 'Tesla Inc.', nameFa: 'سهام شرکت تسلا', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:MSFT', name: 'Microsoft Corporation', nameFa: 'سهام مایکروسافت', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:AMZN', name: 'Amazon.com Inc.', nameFa: 'سهام آمازون', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:GOOGL', name: 'Alphabet Inc.', nameFa: 'سهام آلفابت (گوگل)', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' },
  { symbol: 'NASDAQ:META', name: 'Meta Platforms Inc.', nameFa: 'سهام متا (فیسبوک)', category: 'stocks', exchange: 'NASDAQ', precision: 2, source: 'tradingview' }
];

function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50.0;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return Number((100 - (100 / (1 + rs))).toFixed(1));
}

function computeSMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

let screenerCache = [];

async function computeSingleSymbol(sym) {
  const source = sym.source || (sym.symbol.startsWith('BINANCE:') ? 'binance' : 'tradingview');
  try {
    const ticker = await get24hTicker(sym.symbol);
    const candles = await getCandles(sym.symbol, '60', 60);
    const rawList = Array.isArray(candles) ? candles : (candles?.candles || []);
    const closes = rawList.map(c => c.close);

    const rsi14 = computeRSI(closes, 14);
    const sma20 = computeSMA(closes, 20);
    const sma50 = computeSMA(closes, 50);

    const isBullishTrend = sma20 >= sma50;
    const chg = ticker?.priceChangePercent || 0;

    // Technical Confluence Rating
    let technicalRating = 'Neutral';
    let technicalScore = 0; // -2 to +2

    if (rsi14 >= 62 && isBullishTrend && chg > 1.0) {
      technicalRating = 'Strong Buy';
      technicalScore = 2;
    } else if (rsi14 >= 52 && isBullishTrend) {
      technicalRating = 'Buy';
      technicalScore = 1;
    } else if (rsi14 <= 38 && !isBullishTrend && chg < -1.0) {
      technicalRating = 'Strong Sell';
      technicalScore = -2;
    } else if (rsi14 <= 48 && !isBullishTrend) {
      technicalRating = 'Sell';
      technicalScore = -1;
    }

    return {
      symbol: sym.symbol,
      tickerFa: sym.tickerFa || sym.nameFa || sym.symbol,
      name: sym.name,
      nameFa: sym.nameFa || sym.name,
      category: sym.category,
      exchange: sym.exchange,
      source,
      price: ticker?.lastPrice ?? null,
      priceChange: ticker?.priceChange ?? null,
      priceChangePercent: ticker?.priceChangePercent ?? null,
      highPrice: ticker?.highPrice ?? null,
      lowPrice: ticker?.lowPrice ?? null,
      volume: ticker?.volume ?? null,
      rsi14,
      sma20: Number(sma20.toFixed(sym.precision || 2)),
      sma50: Number(sma50.toFixed(sym.precision || 2)),
      trend: isBullishTrend ? 'Bullish' : 'Bearish',
      technicalRating,
      technicalScore,
      precision: sym.precision || 2,
      updatedAt: Date.now()
    };
  } catch (e) {
    const prev = screenerCache.find(x => x.symbol === sym.symbol && !x.unavailable);
    if (prev) return { ...prev, stale: true, source };
    return {
      symbol: sym.symbol,
      name: sym.name,
      nameFa: sym.nameFa || sym.name,
      category: sym.category,
      exchange: sym.exchange,
      source,
      unavailable: true,
      price: null, priceChange: null, priceChangePercent: null,
      highPrice: null, lowPrice: null, volume: null,
      rsi14: null, sma20: null, sma50: null,
      trend: 'Neutral',
      technicalRating: 'Neutral',
      technicalScore: 0,
      precision: sym.precision || 2,
      updatedAt: Date.now()
    };
  }
}

// Concurrent callers share ONE in-flight refresh
let inflight = null;
export function refreshScreenerCache() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const results = await Promise.all(DEFAULT_SCREENER_SYMBOLS.map(sym => computeSingleSymbol(sym)));
      screenerCache = results;
    } catch (e) {
      console.error('[Screener] Refresh error:', e.message);
    } finally {
      inflight = null;
    }
    return screenerCache;
  })();
  return inflight;
}

// Demand-driven refresh: recompute every 8s only while someone has asked for screener data
let lastDemandAt = 0;
const screenerTimer = setInterval(() => {
  if (Date.now() - lastDemandAt > 120000) return;
  refreshScreenerCache().catch(() => {});
}, 8000);
if (screenerTimer.unref) screenerTimer.unref();

// Immediate boot refresh
refreshScreenerCache().catch(() => {});

export async function getScreenerData({ category = 'all', rating = 'all', search = '' } = {}) {
  const idleFor = Date.now() - lastDemandAt;
  lastDemandAt = Date.now();
  if (screenerCache.length === 0 || idleFor > 120000) {
    await refreshScreenerCache();
  }
  return filterScreener(screenerCache, { category, rating, search });
}

function filterScreener(items, { category, rating, search }) {
  const q = (search || '').trim().toUpperCase();
  return items.filter(item => {
    if (category && category !== 'all' && item.category !== category) return false;
    if (rating && rating !== 'all') {
      if (rating === 'strong_buy' && item.technicalRating !== 'Strong Buy') return false;
      if (rating === 'buy' && !['Buy', 'Strong Buy'].includes(item.technicalRating)) return false;
      if (rating === 'sell' && !['Sell', 'Strong Sell'].includes(item.technicalRating)) return false;
      if (rating === 'strong_sell' && item.technicalRating !== 'Strong Sell') return false;
      if (rating === 'overbought' && item.rsi14 < 70) return false;
      if (rating === 'oversold' && item.rsi14 > 30) return false;
    }
    if (q) {
      const bareSym = item.symbol.replace(/^.*:/, '');
      return item.symbol.includes(q) || bareSym.includes(q) || item.name.toUpperCase().includes(q) || (item.nameFa && item.nameFa.includes(q));
    }
    return true;
  });
}
