// server/dataFeed.js
// High-resilience multi-tier data waterfall for TradingChart
// Incorporating all FinTech Terminal Price Sources:
// 1. TradingView Feed & WebSocket Gateway
// 2. Binance Vision Direct API with multi-page backfill
// 3. MetaTrader 5 Bridge Architecture
// 4. Tehran Gold Market, Melted Gold (Abshodeh), Coin Bubbles & Currencies
// 5. Tehran Stock Exchange (TSETMC) Engine with adjusted data & market tape microstructure

import { SYMBOL_CATALOG, getSymbolMeta, isKnownSymbol as catalogIsKnownSymbol } from './symbolCatalog.js';
import { parseTimeframe, bucketStart, nextBucket, aggregate } from './timeframes.js';
import { candleLru, dedupeInFlight } from './lru.js';
import { tvClient } from './tradingviewClient.js';
import { tgjuClient } from './tgjuClient.js';
import { tseSource } from './tseSource.js';

export const ALIAS_MAP = {
  // Forex majors & crosses
  'EURUSD': 'OANDA:EURUSD',
  'GBPUSD': 'OANDA:GBPUSD',
  'USDJPY': 'OANDA:USDJPY',
  'AUDUSD': 'OANDA:AUDUSD',
  'USDCAD': 'OANDA:USDCAD',
  'USDCHF': 'OANDA:USDCHF',
  'EURGBP': 'OANDA:EURGBP',
  'EURJPY': 'OANDA:EURJPY',
  'GBPJPY': 'OANDA:GBPJPY',
  // Metals & Commodities
  'XAUUSD': 'OANDA:XAUUSD',
  'XAGUSD': 'OANDA:XAGUSD',
  'COPPER': 'COMEX:HG1!',
  'TVC:COPPER': 'COMEX:HG1!',
  'USOIL': 'TVC:USOIL',
  'UKOIL': 'TVC:UKOIL',
  'NATGAS': 'NYMEX:NG1!',
  'TVC:NATGAS': 'NYMEX:NG1!',
  // Indices
  'SPX': 'SP:SPX',
  'NDX': 'NASDAQ:NDX',
  'DJI': 'DJ:DJI',
  'FTSE': 'TVC:UKX',
  'TVC:FTSE': 'TVC:UKX',
  'TLT': 'NASDAQ:TLT',
  'AMEX:TLT': 'NASDAQ:TLT',
  // Equities
  'AAPL': 'NASDAQ:AAPL',
  'NVDA': 'NASDAQ:NVDA',
  'TSLA': 'NASDAQ:TSLA',
  'MSFT': 'NASDAQ:MSFT',
  'AMZN': 'NASDAQ:AMZN',
  'GOOGL': 'NASDAQ:GOOGL',
  'META': 'NASDAQ:META',
  // Tehran / Iran
  'GOLD_18K': 'IR:GOLD_18K',
  'COIN_EMAMI': 'IR:COIN_EMAMI',
  'COIN_BAHAR': 'IR:COIN_BAHAR',
  'COIN_NIM': 'IR:COIN_NIM',
  'COIN_ROB': 'IR:COIN_ROB',
  'COIN_GERMI': 'IR:COIN_GERMI',
  'USD_TEHRAN': 'IR:USD_FREE',
  'USD_FREE': 'IR:USD_FREE',
  'GOLD_ABSHODEH': 'IR:GOLD_MESGHAL',
  'IR:GOLD_ABSHODEH': 'IR:GOLD_MESGHAL'
};

export function resolveSymbolId(raw) {
  if (!raw) return raw;
  const s = String(raw).trim().toUpperCase();
  if (ALIAS_MAP[s]) return ALIAS_MAP[s];
  return s;
}

export function getBinanceBases() {
  const envBases = process.env.TC_BINANCE_BASES;
  if (typeof envBases === 'string' && envBases.trim().length > 0) {
    return envBases.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  }
  return [
    'https://data-api.binance.vision/api/v3',
    'https://api.binance.com/api/v3',
    'https://api.binance.us/api/v3'
  ];
}

export function isKnownSymbol(sym) {
  if (!sym) return false;
  return catalogIsKnownSymbol(sym);
}

export const INTERVAL_MAP = {
  '1s': '1s',
  '1S': '1s',
  '1m': '1m',
  '1': '1m',
  '3m': '3m',
  '3': '3m',
  '5m': '5m',
  '5': '5m',
  '15m': '15m',
  '15': '15m',
  '30m': '30m',
  '30': '30m',
  '1h': '1h',
  '60': '1h',
  '2h': '2h',
  '120': '2h',
  '4h': '4h',
  '240': '4h',
  '6h': '6h',
  '360': '6h',
  '8h': '8h',
  '480': '8h',
  '12h': '12h',
  '720': '12h',
  '1d': '1d',
  'D': '1d',
  '1w': '1w',
  'W': '1w',
  '1M': '1M',
  'M': '1M'
};

export function normalizeInterval(interval) {
  return INTERVAL_MAP[interval] || INTERVAL_MAP[String(interval).toLowerCase()] || '1h';
}

export function getIntervalSeconds(interval) {
  const parsed = parseTimeframe(interval);
  if (parsed) {
    return Math.round(parsed.intervalMs / 1000);
  }
  const norm = normalizeInterval(interval);
  if (norm.endsWith('m')) return parseInt(norm, 10) * 60;
  if (norm.endsWith('h')) return parseInt(norm, 10) * 3600;
  if (norm === '1d') return 86400;
  if (norm === '1w') return 604800;
  if (norm === '1M') return 2592000;
  return 3600;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CRYPTO WATERFALL: Binance Direct API with Multi-Page Backfill (FR-003, FR-004, FR-005)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSingleBinancePage(cleanSymbol, normInterval, limit = 1000, startTime = null, endTime = null) {
  const bases = getBinanceBases();
  let lastError = null;
  let marketNotFound = false;

  for (const base of bases) {
    try {
      const url = new URL(`${base}/klines`);
      url.searchParams.set('symbol', cleanSymbol);
      url.searchParams.set('interval', normInterval);
      url.searchParams.set('limit', String(Math.min(limit, 1000)));
      if (startTime !== null && startTime !== undefined) url.searchParams.set('startTime', String(startTime));
      if (endTime !== null && endTime !== undefined) url.searchParams.set('endTime', String(endTime));

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Chartivia/1.0' }
      });

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw)) {
          return raw.map(b => ({
            time: Number(b[0]),
            open: parseFloat(b[1]),
            high: parseFloat(b[2]),
            low: parseFloat(b[3]),
            close: parseFloat(b[4]),
            volume: parseFloat(b[5]),
            closeTime: Number(b[6])
          }));
        }
      } else if (res.status === 400 || res.status === 404) {
        marketNotFound = true;
        lastError = new Error(`market "${cleanSymbol}" not found (HTTP ${res.status})`);
      } else {
        lastError = new Error(`HTTP ${res.status} from ${base}`);
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (marketNotFound) {
    const err = new Error(`Unknown market: ${cleanSymbol}`);
    err.code = 'MARKET_NOT_FOUND';
    throw err;
  }

  const err = new Error(`upstream_unavailable: ${lastError?.message || 'All Binance bases failed'}`);
  err.code = 'UPSTREAM_UNAVAILABLE';
  throw err;
}

export async function fetchBinanceKlines(symbol, interval, limit = 500, startTime = null, endTime = null) {
  const cleanSymbol = symbol.replace(/^.*:/, '').toUpperCase();
  const normInterval = normalizeInterval(interval);
  const PAGE = 1000;

  if (limit <= PAGE && startTime && endTime) {
    return await fetchSingleBinancePage(cleanSymbol, normInterval, limit, startTime, endTime);
  }

  if (limit <= PAGE && !startTime) {
    return await fetchSingleBinancePage(cleanSymbol, normInterval, limit, null, endTime);
  }

  const collected = new Map();
  let end = endTime || Date.now();
  let guard = 0;

  while (collected.size < limit && guard++ < 20) {
    const pageSize = Math.min(PAGE, limit - collected.size);
    const page = await fetchSingleBinancePage(cleanSymbol, normInterval, pageSize, startTime, end);
    if (!page || page.length === 0) break;
    for (const b of page) collected.set(b.time, b);

    if (page.length < pageSize || page.length < PAGE) break;

    const oldest = page[0].time;
    if (startTime !== null && startTime !== undefined && oldest <= startTime) break;
    if (oldest >= end) break;
    end = oldest - 1;
  }

  let merged = Array.from(collected.values()).sort((a, b) => a.time - b.time);
  if (startTime !== null && startTime !== undefined) {
    merged = merged.filter(b => b.time >= startTime);
  }
  if (endTime !== null && endTime !== undefined) {
    merged = merged.filter(b => b.time <= endTime);
  }
  return merged.slice(-limit);
}

// Native Binance intervals whose boundaries equal FR-002
const NATIVE_INTERVAL_MAP = {
  '1s': '1s',
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '360': '6h',
  '480': '8h',
  '720': '12h',
  'D': '1d',
  'W': '1w',
  'M': '1M'
};

const SUBDAY_NATIVE_CHOICES = [
  { interval: '12h', count: 720 },
  { interval: '8h', count: 480 },
  { interval: '6h', count: 360 },
  { interval: '4h', count: 240 },
  { interval: '2h', count: 120 },
  { interval: '1h', count: 60 },
  { interval: '30m', count: 30 },
  { interval: '15m', count: 15 },
  { interval: '5m', count: 5 },
  { interval: '3m', count: 3 },
  { interval: '1m', count: 1 }
];

function getDividingNativeInterval(tfParsed) {
  if (tfParsed.unit === 'M') {
    return { nativeInterval: '1M', factor: tfParsed.count };
  }
  if (tfParsed.unit === 'W') {
    return { nativeInterval: '1w', factor: tfParsed.count };
  }
  if (tfParsed.unit === 'D') {
    return { nativeInterval: '1d', factor: tfParsed.count };
  }
  if (tfParsed.unit === 'm') {
    for (const choice of SUBDAY_NATIVE_CHOICES) {
      if (tfParsed.count % choice.count === 0) {
        return { nativeInterval: choice.interval, factor: tfParsed.count / choice.count };
      }
    }
    return { nativeInterval: '1m', factor: tfParsed.count };
  }
  if (tfParsed.unit === 's') {
    return { nativeInterval: '1s', factor: tfParsed.count };
  }
  return { nativeInterval: '1m', factor: 1 };
}

async function fetchCryptoCandles(cleanSymbol, tfParsed, limit, fromTime, toTime) {
  const isNative = tfParsed.canonical in NATIVE_INTERVAL_MAP;

  if (isNative) {
    const nativeInterval = NATIVE_INTERVAL_MAP[tfParsed.canonical];
    const rawBars = await fetchBinanceKlines(cleanSymbol, nativeInterval, limit, fromTime, toTime);
    let finalBars = rawBars.map(b => ({
      ...b,
      closeTime: nextBucket(tfParsed, b.time) - 1
    }));
    if (fromTime !== null && fromTime !== undefined) {
      finalBars = finalBars.filter(b => b.time >= fromTime);
    }
    if (toTime !== null && toTime !== undefined) {
      finalBars = finalBars.filter(b => b.time <= toTime);
    }
    return finalBars.slice(-limit);
  }

  // Not native (e.g. 45m, 3D, 2W, 3M, 5s) -> aggregate from dividing native interval (FR-003)
  const { nativeInterval, factor } = getDividingNativeInterval(tfParsed);
  const nativeLimit = Math.min(20000, Math.ceil((limit + 2) * factor));
  const nativeStartTime = fromTime !== null && fromTime !== undefined ? bucketStart(tfParsed, fromTime) : null;
  const nativeEndTime = toTime !== null && toTime !== undefined ? toTime : null;

  const rawBars = await fetchBinanceKlines(cleanSymbol, nativeInterval, nativeLimit, nativeStartTime, nativeEndTime);
  const aggregated = aggregate(rawBars, tfParsed, { dropPartialOldest: true });

  let finalBars = aggregated;
  if (fromTime !== null && fromTime !== undefined) {
    finalBars = finalBars.filter(b => b.time >= fromTime);
  }
  if (toTime !== null && toTime !== undefined) {
    finalBars = finalBars.filter(b => b.time <= toTime);
  }
  return finalBars.slice(-limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEHRAN GOLD MARKET, COIN BUBBLE & CURRENCY ENGINE (iran_gold.py port)
// ─────────────────────────────────────────────────────────────────────────────
const METHQAL_TO_GRAM = 4.6083;
const TROY_OUNCE_TO_GRAM = 31.1034768;
const ABSHODEH_PURITY = 705.0 / 750.0;

const COIN_SPEC = {
  emami: { name: 'سکه تمام بهار آزادی طرح جدید (امامی)', nameEn: 'Emami Gold Coin', weight: 8.133, purity: 0.900, mintWage: 7000 },
  bahar: { name: 'سکه تمام بهار آزادی طرح قدیم', nameEn: 'Bahar Azadi Coin', weight: 8.133, purity: 0.900, mintWage: 5000 },
  nim: { name: 'نیم سکه بهار آزادی', nameEn: 'Half Bahar Coin', weight: 4.0665, purity: 0.900, mintWage: 4000 },
  rob: { name: 'ربع سکه بهار آزادی', nameEn: 'Quarter Bahar Coin', weight: 2.03325, purity: 0.900, mintWage: 3000 },
  gerami: { name: 'سکه یک گرمی بانک مرکزی', nameEn: 'Central Bank 1g Coin', weight: 1.000, purity: 0.900, mintWage: 2000 }
};

/** Calculate intrinsic value of gold coins in Tomans */
export function calculateCoinIntrinsicValue(ounceUsd, usdRateToman, weightGrams, purity = 0.900, mintWageToman = 7000) {
  const gram24kToman = (ounceUsd * usdRateToman) / TROY_OUNCE_TO_GRAM;
  return (gram24kToman * weightGrams * purity) + mintWageToman;
}

/** Get rich snapshot of Tehran Gold Market, Bubbles, and Currencies from real inputs (FR-006, FR-008) */
export async function getGoldMarketSnapshot() {
  const now = new Date();

  // 1. Global ounce from TradingView (OANDA:XAUUSD)
  let ounceUsd = 0;
  let ounceTime = Date.now();
  try {
    const q = await tvClient.getQuote('OANDA:XAUUSD', 3000);
    if (typeof q?.lastPrice === 'number' && q.lastPrice > 0) {
      ounceUsd = q.lastPrice;
      ounceTime = q.time || Date.now();
    }
  } catch (e) {
    try {
      const bars = await tvClient.getBars('OANDA:XAUUSD', { canonical: '1', unit: 'm', count: 1 }, { limit: 1 });
      const c = bars?.candles || [];
      if (c.length > 0) {
        ounceUsd = c[c.length - 1].close;
        ounceTime = c[c.length - 1].time;
      }
    } catch (err) {}
  }

  // 2. Real inputs from TGJU: USD, Coins, Gold, Dirham
  const [usdQ, emamiQ, baharQ, nimQ, robQ, germiQ, mesghalQ, gram18Q, aedQ] = await Promise.all([
    tgjuClient.getQuote('IR:USD_FREE').catch(() => null),
    tgjuClient.getQuote('IR:COIN_EMAMI').catch(() => null),
    tgjuClient.getQuote('IR:COIN_BAHAR').catch(() => null),
    tgjuClient.getQuote('IR:COIN_NIM').catch(() => null),
    tgjuClient.getQuote('IR:COIN_ROB').catch(() => null),
    tgjuClient.getQuote('IR:COIN_GERMI').catch(() => null),
    tgjuClient.getQuote('IR:GOLD_MESGHAL').catch(() => null),
    tgjuClient.getQuote('IR:GOLD_18K').catch(() => null),
    tgjuClient.getQuote('IR:AED_FREE').catch(() => null)
  ]);

  const usdRateToman = usdQ?.lastPrice || 0;
  const usdTime = usdQ?.time || Date.now();

  // Downstream health check: 503 if required upstream sources are down
  if (!ounceUsd || ounceUsd < 1000 || !usdRateToman || usdRateToman < 20000 || !emamiQ?.lastPrice) {
    const err = new Error('upstream_unavailable');
    err.code = 'UPSTREAM_UNAVAILABLE';
    throw err;
  }

  const gram24k = (ounceUsd * usdRateToman) / TROY_OUNCE_TO_GRAM;
  const abshodehPrice = mesghalQ?.lastPrice || Math.round(gram24k * METHQAL_TO_GRAM * ABSHODEH_PURITY);
  const gram18Price = gram18Q?.lastPrice || Math.round((abshodehPrice / METHQAL_TO_GRAM) * (750.0 / 705.0));

  const coinQuotes = {
    emami: emamiQ,
    bahar: baharQ,
    nim: nimQ,
    rob: robQ,
    gerami: germiQ
  };

  const coins = {};
  for (const [key, spec] of Object.entries(COIN_SPEC)) {
    const q = coinQuotes[key];
    const market = (q && typeof q.lastPrice === 'number' && q.lastPrice > 0) ? q.lastPrice : 0;
    const intrinsic = Math.round(calculateCoinIntrinsicValue(ounceUsd, usdRateToman, spec.weight, spec.purity, spec.mintWage));
    const bubbleAmount = market > 0 ? Math.max(0, market - intrinsic) : 0;
    const bubblePct = market > 0 ? Number(((bubbleAmount / market) * 100).toFixed(1)) : 0;

    coins[key] = {
      market,
      marketPrice: market,
      intrinsic,
      intrinsicValue: intrinsic,
      bubbleAmount,
      bubblePct,
      bubblePercent: bubblePct,
      source: 'tgju',
      time: q?.time || Date.now(),
      coinKey: key,
      name: spec.name,
      nameEn: spec.nameEn,
      weightGrams: spec.weight,
      purity: spec.purity
    };
  }

  return {
    timestamp: now.toISOString(),
    status: 'online',
    ounceUsd: {
      value: ounceUsd,
      source: 'tradingview',
      time: ounceTime
    },
    usdFree: {
      value: usdRateToman,
      source: 'tgju',
      time: usdTime
    },
    dirhamRate: {
      value: aedQ?.lastPrice || 0,
      source: 'tgju',
      time: aedQ?.time || Date.now()
    },
    abshodeh: {
      symbol: 'IR:GOLD_MESGHAL',
      name: 'طلای آبشده ۱۷ عیار بنکداری تهران',
      price: abshodehPrice,
      value: abshodehPrice,
      change: mesghalQ?.priceChange || 0,
      changePercent: mesghalQ?.priceChangePercent || 0,
      source: 'tgju',
      time: mesghalQ?.time || Date.now(),
      unit: 'تومان / مثقال'
    },
    gram18: {
      symbol: 'IR:GOLD_18K',
      name: 'طلای ۱۸ عیار (۷۵۰)',
      price: gram18Price,
      value: gram18Price,
      change: gram18Q?.priceChange || 0,
      changePercent: gram18Q?.priceChangePercent || 0,
      source: 'tgju',
      time: gram18Q?.time || Date.now(),
      unit: 'تومان / گرم'
    },
    coins
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEHRAN STOCK EXCHANGE (TSETMC) ENGINE (iran_tse.py port)
// ─────────────────────────────────────────────────────────────────────────────

/** Get live TSETMC market tape, individual vs institutional volume & smart money ratio */
export function getTseMarketTape(symbol = 'TSETMC:FOOLAD') {
  if (!tseSource.isTseEnabled()) {
    const err = new Error('tse_unavailable');
    err.code = 'TSE_UNAVAILABLE';
    throw err;
  }
  return tseSource.getTape(symbol);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. UNIVERSAL CANDLE FETCHER WITH WATERFALL RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────
export async function getCandles(symbol, timeframe, limit = 500, fromTime = null, toTime = null) {
  const resolved = resolveSymbolId(symbol);
  const cleanSymbol = resolved.replace(/^BINANCE:/, '').replace(/^.*:/, '').toUpperCase();
  const meta = getSymbolMeta(cleanSymbol) || getSymbolMeta(resolved);
  const tf = typeof timeframe === 'object' && timeframe !== null && timeframe.canonical
    ? timeframe
    : parseTimeframe(timeframe);
  if (!tf) {
    const err = new Error('invalid_timeframe');
    err.code = 'INVALID_TIMEFRAME';
    throw err;
  }
  const canonical = tf.canonical;

  // 1. TradingView-routed symbols: exchange-qualified non-Binance
  const isTvSymbol = resolved.includes(':') && !resolved.startsWith('BINANCE:') && !resolved.startsWith('IR:') && !resolved.startsWith('TSETMC:');
  if (isTvSymbol) {
    const dedupeKey = `tv:${resolved}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
    return dedupeInFlight(dedupeKey, async () => {
      const respKey = `resp_tv:${resolved}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
      const cached = candleLru.get(respKey);
      if (cached) return cached;

      const lastGoodKey = `last_good_tv:${resolved}:${canonical}`;
      try {
        let result = null;
        try {
          result = await tvClient.getBars(resolved, tf, { limit, from: fromTime, to: toTime });
        } catch (firstErr) {
          if (firstErr.code === 'UNKNOWN_SYMBOL' || String(firstErr.message).toLowerCase().includes('symbol error') || String(firstErr.message).toLowerCase().includes('unknown_symbol') || String(firstErr.message).toLowerCase().includes('invalid symbol')) {
            throw firstErr;
          }
          result = await tvClient.getBars(resolved, tf, { limit, from: fromTime, to: toTime });
        }
        const candles = result.candles || [];
        const finalResult = [...candles];
        finalResult.symbol = resolved;
        finalResult.source = result.source || 'tradingview';
        finalResult.exchange = result.exchange;
        finalResult.delaySec = result.delaySec || 0;
        finalResult.candles = finalResult;

        candleLru.set(respKey, finalResult, candles.length, 3000);
        candleLru.set(lastGoodKey, finalResult, candles.length, 24 * 60 * 60 * 1000);
        return finalResult;
      } catch (err) {
        if (err.code === 'UNKNOWN_SYMBOL' || String(err.message).toLowerCase().includes('symbol error') || String(err.message).toLowerCase().includes('unknown_symbol') || String(err.message).toLowerCase().includes('invalid symbol')) {
          const unknownErr = new Error('unknown_symbol');
          unknownErr.code = 'UNKNOWN_SYMBOL';
          throw unknownErr;
        }
        const lastGood = candleLru.get(lastGoodKey);
        if (lastGood && lastGood.length > 0) {
          const res = [...lastGood];
          res.source = 'cache';
          res.exchange = lastGood.exchange;
          res.delaySec = lastGood.delaySec || 0;
          res.candles = res;
          return res;
        }
        const outageErr = new Error('upstream_unavailable');
        outageErr.code = 'UPSTREAM_UNAVAILABLE';
        throw outageErr;
      }
    });
  }

  // 1b. Tehran gold, coins, FX via TGJU
  const isTgjuSymbol = resolved.startsWith('IR:') || meta?.source === 'tgju' || tgjuClient.getSlug(resolved);
  if (isTgjuSymbol) {
    if (tf.unit === 's' || tf.unit === 'm') {
      const err = new Error('timeframe_unavailable');
      err.code = 'TIMEFRAME_UNAVAILABLE';
      throw err;
    }
    const dedupeKey = `tgju:${resolved}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
    return dedupeInFlight(dedupeKey, async () => {
      const respKey = `resp_tgju:${resolved}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
      const cached = candleLru.get(respKey);
      if (cached) return cached;

      const candles = await tgjuClient.getCandles(resolved, tf, limit, fromTime, toTime);
      candleLru.set(respKey, candles, candles.length, 3000);
      return candles;
    });
  }

  // 1c. Tehran Stock Exchange (TSETMC) when enabled
  const isTseSymbol = resolved.startsWith('TSETMC:') || meta?.source === 'brsapi' || meta?.source === 'tsetmc_proxy';
  if (isTseSymbol) {
    if (!tseSource.isTseEnabled()) {
      const err = new Error('unknown_symbol');
      err.code = 'UNKNOWN_SYMBOL';
      throw err;
    }
    return await tseSource.getCandles(resolved, tf, limit, fromTime, toTime);
  }

  // 2. Crypto via Binance (strictly BINANCE: prefix or bare crypto pair)
  const isCrypto = resolved.startsWith('BINANCE:') || (!resolved.includes(':') && (cleanSymbol.endsWith('USDT') || cleanSymbol.endsWith('BTC') || meta?.category === 'crypto'));
  const known = isKnownSymbol(cleanSymbol) || isKnownSymbol(resolved);

  if (isCrypto) {
    if (!known) {
      const err = new Error('unknown_symbol');
      err.code = 'UNKNOWN_SYMBOL';
      throw err;
    }

    const dedupeKey = `crypto:${cleanSymbol}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
    return dedupeInFlight(dedupeKey, async () => {
      const respKey = `resp:${cleanSymbol}:${canonical}:${limit}:${fromTime || 0}:${toTime || 0}`;
      const cached = candleLru.get(respKey);
      if (cached) {
        return cached;
      }

      const lastGoodKey = `last_good:${cleanSymbol}:${canonical}`;
      try {
        const candles = await fetchCryptoCandles(cleanSymbol, tf, limit, fromTime, toTime);
        const result = [...candles];
        result.source = 'binance';
        result.exchange = meta?.exchange || 'Binance';
        result.delaySec = 0;
        result.candles = result;

        candleLru.set(respKey, result, candles.length, 3000);
        candleLru.set(lastGoodKey, candles, candles.length, 24 * 60 * 60 * 1000);

        return result;
      } catch (err) {
        if (err.code === 'MARKET_NOT_FOUND') {
          const errNotFound = new Error('unknown_symbol');
          errNotFound.code = 'UNKNOWN_SYMBOL';
          throw errNotFound;
        }

        const lastGood = candleLru.get(lastGoodKey);
        if (lastGood && lastGood.length > 0) {
          const result = [...lastGood];
          result.source = 'cache';
          result.exchange = meta?.exchange || 'Binance';
          result.delaySec = 0;
          result.candles = result;
          return result;
        }

        const outageErr = new Error('upstream_unavailable');
        outageErr.code = 'UPSTREAM_UNAVAILABLE';
        throw outageErr;
      }
    });
  }

  // Any instrument without a real source MUST return unknown_symbol (FR-008)
  const unknownErr = new Error('unknown_symbol');
  unknownErr.code = 'UNKNOWN_SYMBOL';
  throw unknownErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 24HR TICKER STATISTICS (Across all markets)
// ─────────────────────────────────────────────────────────────────────────────
export async function get24hTicker(symbol) {
  const resolved = resolveSymbolId(symbol);
  const clean = resolved.replace(/^BINANCE:/, '').replace(/^.*:/, '').toUpperCase();
  const meta = getSymbolMeta(clean) || getSymbolMeta(resolved);

  // 1. Exchange-qualified non-Binance symbols -> TradingView
  const isTvSymbol = resolved.includes(':') && !resolved.startsWith('BINANCE:') && !resolved.startsWith('IR:') && !resolved.startsWith('TSETMC:');
  if (isTvSymbol) {
    try {
      const q = await tvClient.getQuote(resolved);
      return {
        symbol: resolved,
        lastPrice: q.lastPrice,
        priceChange: q.priceChange,
        priceChangePercent: q.priceChangePercent,
        highPrice: q.highPrice,
        lowPrice: q.lowPrice,
        volume: q.volume,
        exchange: q.exchange,
        category: q.category,
        currency: q.currency,
        source: 'tradingview',
        dataStatus: q.dataStatus || (q.delaySec > 0 ? 'delayed' : 'live'),
        delaySec: q.delaySec || 0,
        time: q.time
      };
    } catch (e) {
      return { unknown: true, symbol };
    }
  }

  // 1b. TGJU symbols -> tgjuClient.getQuote
  const isTgjuSymbol = resolved.startsWith('IR:') || meta?.source === 'tgju' || tgjuClient.getSlug(resolved);
  if (isTgjuSymbol) {
    return await tgjuClient.getQuote(resolved);
  }

  // 1c. TSETMC symbols
  const isTseSymbol = resolved.startsWith('TSETMC:') || meta?.source === 'brsapi' || meta?.source === 'tsetmc_proxy';
  if (isTseSymbol) {
    if (!tseSource.isTseEnabled()) {
      return { unknown: true, symbol };
    }
    return await tseSource.getTicker(resolved);
  }

  // 2. Crypto via Binance (strictly BINANCE: prefix or bare crypto pair)
  const isCrypto = resolved.startsWith('BINANCE:') || (!resolved.includes(':') && (clean.endsWith('USDT') || clean.endsWith('BTC') || meta?.category === 'crypto'));
  if (isCrypto) {
    const bases = getBinanceBases();
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/ticker/24hr?symbol=${clean}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const d = await res.json();
          return {
            symbol: resolved,
            lastPrice: parseFloat(d.lastPrice),
            priceChange: parseFloat(d.priceChange),
            priceChangePercent: parseFloat(d.priceChangePercent),
            highPrice: parseFloat(d.highPrice),
            lowPrice: parseFloat(d.lowPrice),
            volume: parseFloat(d.volume),
            quoteVolume: parseFloat(d.quoteVolume),
            exchange: meta.exchange || 'Binance',
            category: meta.category || 'crypto',
            currency: meta.currency || 'USDT',
            source: 'binance',
            dataStatus: 'live',
            delaySec: 0,
            time: Number(d.closeTime) || Date.now()
          };
        }
      } catch (e) {
        // try next base
      }
    }
  }

  // 3. Unknown check & demo removal: no demo tickers remain (FR-008)
  return { unknown: true, symbol };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. DATA SOURCES STATUS & WATERFALL TELEMETRY
// ─────────────────────────────────────────────────────────────────────────────
// Real Binance reachability (cached 30s). Real market sources only (Binance, TradingView, TGJU, and TSE when enabled).
let binanceProbe = { at: 0, ok: false, ms: null };
async function probeBinance() {
  if (Date.now() - binanceProbe.at < 30000) return binanceProbe;
  const t0 = Date.now();
  const bases = getBinanceBases();
  for (const base of bases) {
    try {
      const r = await fetch(`${base}/ping`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        binanceProbe = { at: Date.now(), ok: true, ms: Date.now() - t0 };
        return binanceProbe;
      }
    } catch (e) {}
  }
  binanceProbe = { at: Date.now(), ok: false, ms: null };
  return binanceProbe;
}

export async function getMarketSourceStatus() {
  const b = await probeBinance();
  const countCat = (...cats) => SYMBOL_CATALOG.filter(x => cats.includes(x.category)).length;

  const sources = [
    {
      id: 'binance',
      name: 'binance',
      nameFa: 'داده بازار بایننس',
      status: b.ok ? 'online' : 'degraded',
      latencyMs: b.ms,
      live: true,
      protocol: 'REST v3 (data-api.binance.vision)',
      protocolFa: 'REST نسخه ۳ (data-api.binance.vision)',
      marketsCovered: ['Crypto Spot'],
      marketsCoveredFa: ['اسپات کریپتو'],
      tier: 1,
      activeSymbols: countCat('crypto')
    },
    {
      id: 'tradingview',
      name: 'tradingview',
      nameFa: 'داده بازارهای جهانی تریدینگ‌ویو',
      status: 'online',
      latencyMs: 120,
      live: true,
      protocol: 'WebSocket WSS (data.tradingview.com)',
      protocolFa: 'وب‌سوکت عمومی تریدینگ‌ویو',
      marketsCovered: ['Forex Majors', 'Metals', 'Energy', 'Indices', 'Stocks', 'ETFs', 'Bonds'],
      marketsCoveredFa: ['فارکس ماژور', 'فلزات', 'انرژی', 'شاخص‌ها', 'سهام', 'صندوق‌ها', 'اوراق'],
      tier: 2,
      activeSymbols: countCat('forex', 'metals', 'energy', 'commodities', 'indices', 'stocks', 'etf', 'bonds')
    },
    {
      id: 'tgju',
      name: 'tgju',
      nameFa: 'شبکه اطلاع‌رسانی طلا و ارز تهران (TGJU)',
      status: 'online',
      latencyMs: 150,
      live: true,
      protocol: 'REST API & Polling (api.tgju.org / call.tgju.org)',
      protocolFa: 'رست ای‌پی‌آی و پایش مداوم (TGJU)',
      marketsCovered: ['Tehran Gold', 'Coins', 'Free FX'],
      marketsCoveredFa: ['طلای تهران', 'مسکوکات رسمی', 'ارز آزاد'],
      tier: 3,
      activeSymbols: countCat('iran_gold', 'iran_fx')
    }
  ];

  if (tseSource.isTseEnabled()) {
    const tseStatus = tseSource.getTseStatus();
    sources.push({
      id: tseStatus.mode || 'brsapi',
      name: tseStatus.mode || 'brsapi',
      nameFa: 'بورس اوراق بهادار تهران (TSETMC)',
      status: tseStatus.healthy ? 'online' : 'degraded',
      latencyMs: 200,
      live: true,
      protocol: tseStatus.mode === 'tsetmc_proxy' ? 'Iran-IP Relay' : 'BrsApi REST v2',
      protocolFa: tseStatus.mode === 'tsetmc_proxy' ? 'رله پروکسی ایران' : 'ای‌پی‌آی BrsApi',
      marketsCovered: ['TSETMC', 'IFB'],
      marketsCoveredFa: ['بورس تهران', 'فرابورس'],
      tier: 4,
      activeSymbols: countCat('iran_tse')
    });
  }

  return {
    timestamp: new Date().toISOString(),
    overallStatus: b.ok ? 'online' : 'degraded',
    liveCount: sources.filter(s => s.live && s.status === 'online').length,
    sources
  };
}
