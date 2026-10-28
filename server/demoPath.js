// server/demoPath.js
// Deterministic hierarchical price path engine for demo markets (FR-007, FR-008).
// Daily layer -> minute Brownian bridge -> second Brownian bridge.
// Guarantees:
// 1. Fully deterministic and stable across calls (seeded per symbol & timestamp).
// 2. Exact aggregation across all timeframes (sub-minute -> minute -> hourly -> daily -> weekly/monthly).
// 3. Follows session calendars per market category (no weekend forex bars, proper TSE/Gold windows).
// 4. One unified price for candles, tickers, live ticks and orderbook depth (FR-009).

import { getSymbolMeta } from './symbolCatalog.js';
import { parseTimeframe, bucketStart, nextBucket, aggregate } from './timeframes.js';
import { isSessionDay, sessionWindows, isSessionTime } from './marketSessions.js';
import { candleLru } from './lru.js';

// Epoch ms for 2000-01-03 00:00:00 UTC (Monday)
export const START_DAY_MS = 946857600000;
const DAY_MS = 86400000;

export const SYMBOL_BASE_CONFIG = {
  // 1. Forex
  'EURUSD': { base: 1.08450, precision: 5, minTick: 0.00001, dailyVol: 0.0035, baseVol: 85000 },
  'GBPUSD': { base: 1.29800, precision: 5, minTick: 0.00001, dailyVol: 0.0040, baseVol: 72000 },
  'USDJPY': { base: 152.400, precision: 3, minTick: 0.001, dailyVol: 0.0045, baseVol: 90000 },
  'AUDUSD': { base: 0.65800, precision: 5, minTick: 0.00001, dailyVol: 0.0045, baseVol: 65000 },
  'USDCAD': { base: 1.38500, precision: 5, minTick: 0.00001, dailyVol: 0.0038, baseVol: 58000 },
  'USDCHF': { base: 0.86500, precision: 5, minTick: 0.00001, dailyVol: 0.0035, baseVol: 54000 },
  'EURGBP': { base: 0.83500, precision: 5, minTick: 0.00001, dailyVol: 0.0030, baseVol: 48000 },
  'EURJPY': { base: 165.200, precision: 3, minTick: 0.001, dailyVol: 0.0045, baseVol: 62000 },
  'GBPJPY': { base: 197.800, precision: 3, minTick: 0.001, dailyVol: 0.0050, baseVol: 68000 },

  // 2. Metals & Commodities
  'XAUUSD': { base: 2718.40, precision: 2, minTick: 0.05, dailyVol: 0.006, baseVol: 120000 },
  'XAGUSD': { base: 31.850, precision: 3, minTick: 0.005, dailyVol: 0.009, baseVol: 95000 },
  'USOIL': { base: 71.20, precision: 2, minTick: 0.01, dailyVol: 0.012, baseVol: 110000 },
  'UKOIL': { base: 75.10, precision: 2, minTick: 0.01, dailyVol: 0.012, baseVol: 105000 },
  'NATGAS': { base: 2.850, precision: 3, minTick: 0.001, dailyVol: 0.018, baseVol: 80000 },

  // 3. Indices & Stocks
  'SPX': { base: 5880.00, precision: 2, minTick: 0.1, dailyVol: 0.005, baseVol: 250000 },
  'NDX': { base: 20650.00, precision: 2, minTick: 0.25, dailyVol: 0.008, baseVol: 320000 },
  'DJI': { base: 42800.0, precision: 1, minTick: 1.0, dailyVol: 0.0045, baseVol: 180000 },
  'AAPL': { base: 232.50, precision: 2, minTick: 0.01, dailyVol: 0.009, baseVol: 450000 },
  'NVDA': { base: 138.80, precision: 2, minTick: 0.01, dailyVol: 0.015, baseVol: 650000 },
  'TSLA': { base: 245.20, precision: 2, minTick: 0.01, dailyVol: 0.018, baseVol: 550000 },
  'MSFT': { base: 428.50, precision: 2, minTick: 0.01, dailyVol: 0.008, baseVol: 350000 },
  'AMZN': { base: 188.00, precision: 2, minTick: 0.01, dailyVol: 0.010, baseVol: 400000 },
  'GOOGL': { base: 166.50, precision: 2, minTick: 0.01, dailyVol: 0.010, baseVol: 380000 },
  'META': { base: 585.00, precision: 2, minTick: 0.01, dailyVol: 0.012, baseVol: 420000 },

  // 4. Tehran Gold & FX
  'GOLD_ABSHODEH': { base: 18450000, precision: 0, minTick: 1000, dailyVol: 0.007, baseVol: 15000 },
  'GOLD_18K': { base: 4250000, precision: 0, minTick: 1000, dailyVol: 0.007, baseVol: 22000 },
  'COIN_EMAMI': { base: 52400000, precision: 0, minTick: 10000, dailyVol: 0.009, baseVol: 8500 },
  'COIN_BAHAR': { base: 47200000, precision: 0, minTick: 10000, dailyVol: 0.009, baseVol: 7200 },
  'COIN_NIM': { base: 28100000, precision: 0, minTick: 10000, dailyVol: 0.010, baseVol: 9800 },
  'COIN_ROB': { base: 18200000, precision: 0, minTick: 10000, dailyVol: 0.012, baseVol: 12000 },
  'COIN_GERMI': { base: 8700000, precision: 0, minTick: 10000, dailyVol: 0.010, baseVol: 6500 },
  'USD_TEHRAN': { base: 62800, precision: 0, minTick: 50, dailyVol: 0.004, baseVol: 35000 },
  'USDT_TOMAN': { base: 63100, precision: 0, minTick: 50, dailyVol: 0.004, baseVol: 45000 },
  'AED_DIRHAM': { base: 17150, precision: 0, minTick: 20, dailyVol: 0.004, baseVol: 28000 },

  // 5. TSE
  'FOOLAD': { base: 4850, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 25000000 },
  'FAMELI': { base: 6320, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 22000000 },
  'KHODRO': { base: 2980, precision: 0, minTick: 10, dailyVol: 0.014, baseVol: 45000000 },
  'SAIPA': { base: 2420, precision: 0, minTick: 10, dailyVol: 0.014, baseVol: 40000000 },
  'SHASTA': { base: 1320, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 35000000 },
  'AHRAM': { base: 22450, precision: 0, minTick: 10, dailyVol: 0.016, baseVol: 18000000 },
  'AGAS': { base: 41200, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 12000000 },
  'TALA': { base: 31500, precision: 0, minTick: 10, dailyVol: 0.009, baseVol: 15000000 },
  'AYAR': { base: 28900, precision: 0, minTick: 10, dailyVol: 0.009, baseVol: 14000000 },
  'TAVAN': { base: 19800, precision: 0, minTick: 10, dailyVol: 0.016, baseVol: 16000000 },
  'SHPNA': { base: 3850, precision: 0, minTick: 10, dailyVol: 0.013, baseVol: 28000000 },
  'SHETRAN': { base: 2750, precision: 0, minTick: 10, dailyVol: 0.013, baseVol: 24000000 },
  'DARAYEKOM': { base: 14200, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 10000000 },
  'PALAYESH': { base: 11800, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 11000000 },
  'VABANKE': { base: 8900, precision: 0, minTick: 10, dailyVol: 0.011, baseVol: 15000000 },
  'FARABOURSE': { base: 4150, precision: 0, minTick: 10, dailyVol: 0.013, baseVol: 13000000 }
};

export function getSymbolConfig(symbol) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  if (SYMBOL_BASE_CONFIG[clean]) return { ...SYMBOL_BASE_CONFIG[clean], symbol: clean };
  const meta = getSymbolMeta(clean) || {};
  return {
    symbol: clean,
    base: 100.0,
    precision: meta.precision ?? 2,
    minTick: meta.minTick ?? 0.01,
    dailyVol: 0.008,
    baseVol: 50000
  };
}

// 32-bit FNV-1a hash
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

// Fast Mulberry32 PRNG
function mulberry32(seed) {
  let s = seed >>> 0;
  return function() {
    var t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MEMOIZED DAILY LAYER (since 2000-01-03 on session days)
// ─────────────────────────────────────────────────────────────────────────────
const DAILY_LAYER_MAX = 80;
const dailyLayerCache = new Map(); // symbol -> array of closed session day bars

function getDailyLayer(clean) {
  if (!dailyLayerCache.has(clean)) return undefined;
  const bars = dailyLayerCache.get(clean);
  dailyLayerCache.delete(clean);
  dailyLayerCache.set(clean, bars);
  return bars;
}

function setDailyLayer(clean, bars) {
  if (dailyLayerCache.has(clean)) {
    dailyLayerCache.delete(clean);
  }
  dailyLayerCache.set(clean, bars);
  while (dailyLayerCache.size > DAILY_LAYER_MAX) {
    const oldestKey = dailyLayerCache.keys().next().value;
    dailyLayerCache.delete(oldestKey);
  }
}

export function dailyLayer(symbol) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const cached = getDailyLayer(clean);
  if (cached) return cached;

  const cfg = getSymbolConfig(clean);
  const prng = mulberry32(hashString(clean));
  const precision = cfg.precision;
  const dailyVol = cfg.dailyVol;
  const basePrice = cfg.base;
  const baseVol = cfg.baseVol;

  const todayStart = bucketStart('D', Date.now());
  const bars = [];

  let curPrice = basePrice * 0.95;

  let dayIndex = 0;
  for (let dayMs = START_DAY_MS; dayMs < todayStart; dayMs += DAY_MS) {
    if (!isSessionDay(clean, dayMs)) continue;

    dayIndex++;
    // Deterministic macro trend & mean reversion pull
    const macroCycle = Math.sin(dayIndex / 160) * 0.08 + Math.cos(dayIndex / 60) * 0.04;
    const target = basePrice * (0.90 + 0.10 * (dayIndex / 7000) + macroCycle);
    const noise = (prng() - 0.495) * 2;
    const drift = 0.04 * (target - curPrice) / curPrice;
    const returnPct = Math.max(-0.06, Math.min(0.06, drift + noise * dailyVol));

    const open = curPrice;
    const close = Number((curPrice * (1 + returnPct)).toFixed(precision));

    const wickHigh = Math.max(open, close) * (prng() * dailyVol * 0.8);
    const wickLow = Math.min(open, close) * (prng() * dailyVol * 0.8);

    let high = Number((Math.max(open, close) + wickHigh).toFixed(precision));
    let low = Number((Math.min(open, close) - wickLow).toFixed(precision));

    high = Math.max(high, open, close);
    low = Math.max(Math.min(low, open, close), Number((open * 0.1).toFixed(precision)));

    const volume = Math.round(baseVol * (0.6 + prng() * 0.8));

    bars.push({
      time: dayMs,
      open,
      high,
      low,
      close,
      volume,
      closeTime: dayMs + DAY_MS - 1
    });

    curPrice = close;
  }

  setDailyLayer(clean, bars);
  return bars;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MINUTE BROWNIAN-BRIDGE LAYER (aggregates exactly to daily bar)
// ─────────────────────────────────────────────────────────────────────────────
export function minuteBars(symbol, dayMs, options = {}) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const t = bucketStart('D', dayMs);
  const cacheKey = `demo:min:${clean}:${t}`;
  const hit = candleLru.get(cacheKey);
  if (hit) return hit;

  if (!isSessionDay(clean, t)) return [];

  const windows = sessionWindows(clean, t);
  if (windows.length === 0) return [];

  const cfg = getSymbolConfig(clean);
  const precision = cfg.precision;

  // Find parent daily bar
  let parentBar = null;
  const days = dailyLayer(clean);
  const found = days.find(b => b.time === t);
  if (found) {
    parentBar = found;
  } else {
    // If today is a session day, generate today's parent bar parameters deterministically
    const lastPast = days[days.length - 1];
    const prevClose = lastPast ? lastPast.close : cfg.base;
    const prngToday = mulberry32(hashString(`${clean}:today:${t}`));
    const returnPct = (prngToday() - 0.49) * cfg.dailyVol;
    const close = Number((prevClose * (1 + returnPct)).toFixed(precision));
    const high = Number((Math.max(prevClose, close) * (1 + prngToday() * cfg.dailyVol * 0.7)).toFixed(precision));
    const low = Number((Math.min(prevClose, close) * (1 - prngToday() * cfg.dailyVol * 0.7)).toFixed(precision));
    parentBar = {
      time: t,
      open: prevClose,
      high: Math.max(high, prevClose, close),
      low: Math.min(low, prevClose, close),
      close,
      volume: Math.round(cfg.baseVol * (0.7 + prngToday() * 0.6)),
      closeTime: t + DAY_MS - 1
    };
  }

  // Calculate total minutes across windows
  let totalMinutes = 0;
  for (const w of windows) {
    totalMinutes += Math.round((w.endMs - w.startMs) / 60000);
  }
  if (totalMinutes <= 0) return [];

  const prng = mulberry32(hashString(`${clean}:${t}:minutes`));
  const N = totalMinutes;

  // Pick peak high and low minute indices
  let iH = Math.max(1, Math.min(N - 2, Math.floor(0.15 * N + prng() * 0.70 * N)));
  let iL = Math.max(1, Math.min(N - 2, Math.floor(0.15 * N + prng() * 0.70 * N)));
  if (iH === iL) {
    if (iL < N - 2) iL++; else iL--;
  }

  const anchors = [
    { idx: 0, price: parentBar.open },
    iH < iL ? { idx: iH, price: parentBar.high } : { idx: iL, price: parentBar.low },
    iH < iL ? { idx: iL, price: parentBar.low } : { idx: iH, price: parentBar.high },
    { idx: N, price: parentBar.close }
  ];

  const p = new Array(N + 1);
  const spread = Math.max(10 ** (-precision), parentBar.high - parentBar.low);
  const sigma = Math.max(spread * 0.04, 10 ** (-precision));

  for (let s = 0; s < 3; s++) {
    const a1 = anchors[s];
    const a2 = anchors[s + 1];
    const L = a2.idx - a1.idx;
    const B = new Array(L + 1);
    B[0] = 0;
    for (let j = 1; j <= L; j++) {
      B[j] = B[j - 1] + (prng() - 0.5) * 2;
    }
    const BL = B[L];
    for (let j = 0; j <= L; j++) {
      if (j === 0) {
        p[a1.idx] = a1.price;
      } else if (j === L) {
        p[a2.idx] = a2.price;
      } else {
        const trend = a1.price + (j / L) * (a2.price - a1.price);
        const bridge = (B[j] - (j / L) * BL) * sigma;
        let val = trend + bridge;
        val = Math.max(parentBar.low, Math.min(parentBar.high, val));
        p[a1.idx + j] = Number(val.toFixed(precision));
      }
    }
  }

  // Volume distribution weights
  const weights = new Array(N);
  let totalW = 0;
  for (let k = 0; k < N; k++) {
    weights[k] = 0.5 + prng();
    totalW += weights[k];
  }

  const result = [];
  let volSum = 0;
  let minIdx = 0;
  const wick = spread * 0.02;

  for (const w of windows) {
    const winMinutes = Math.round((w.endMs - w.startMs) / 60000);
    for (let m = 0; m < winMinutes; m++) {
      const k = minIdx;
      const barTime = w.startMs + m * 60000;
      const open = p[k];
      const close = p[k + 1];

      let high = Math.max(open, close);
      let low = Math.min(open, close);

      if (k === iH || open >= parentBar.high || close >= parentBar.high) {
        high = parentBar.high;
      } else {
        high = Math.min(parentBar.high, Number((high + prng() * wick).toFixed(precision)));
      }

      if (k === iL || open <= parentBar.low || close <= parentBar.low) {
        low = parentBar.low;
      } else {
        low = Math.max(parentBar.low, Number((low - prng() * wick).toFixed(precision)));
      }

      high = Math.max(high, open, close);
      low = Math.min(low, open, close);

      const vol = (k === N - 1)
        ? Math.round((parentBar.volume - volSum) * 100) / 100
        : Math.round(((parentBar.volume * weights[k]) / totalW) * 100) / 100;
      volSum += vol;

      result.push({
        time: barTime,
        open,
        high,
        low,
        close,
        volume: vol,
        closeTime: barTime + 60000 - 1
      });

      minIdx++;
    }
  }

  const noCache = typeof options === 'boolean' ? options : !!options?.noCache;
  if (!noCache) {
    candleLru.set(cacheKey, result, result.length);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECOND BROWNIAN-BRIDGE LAYER (aggregates exactly to minute bar)
// ─────────────────────────────────────────────────────────────────────────────
export function secondBars(symbol, minuteMs) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const mTime = bucketStart('1', minuteMs);
  const cacheKey = `demo:sec:${clean}:${mTime}`;
  const hit = candleLru.get(cacheKey);
  if (hit) return hit;

  const dayMs = bucketStart('D', mTime);
  const dayMins = minuteBars(clean, dayMs);
  const parent = dayMins.find(b => b.time === mTime);
  if (!parent) return [];

  const cfg = getSymbolConfig(clean);
  const precision = cfg.precision;
  const N = 60;
  const prng = mulberry32(hashString(`${clean}:${mTime}:seconds`));

  let iH = Math.max(1, Math.min(N - 2, Math.floor(0.15 * N + prng() * 0.70 * N)));
  let iL = Math.max(1, Math.min(N - 2, Math.floor(0.15 * N + prng() * 0.70 * N)));
  if (iH === iL) {
    if (iL < N - 2) iL++; else iL--;
  }

  const anchors = [
    { idx: 0, price: parent.open },
    iH < iL ? { idx: iH, price: parent.high } : { idx: iL, price: parent.low },
    iH < iL ? { idx: iL, price: parent.low } : { idx: iH, price: parent.high },
    { idx: N, price: parent.close }
  ];

  const p = new Array(N + 1);
  const spread = Math.max(10 ** (-precision), parent.high - parent.low);
  const sigma = Math.max(spread * 0.04, 10 ** (-precision));

  for (let s = 0; s < 3; s++) {
    const a1 = anchors[s];
    const a2 = anchors[s + 1];
    const L = a2.idx - a1.idx;
    const B = new Array(L + 1);
    B[0] = 0;
    for (let j = 1; j <= L; j++) {
      B[j] = B[j - 1] + (prng() - 0.5) * 2;
    }
    const BL = B[L];
    for (let j = 0; j <= L; j++) {
      if (j === 0) {
        p[a1.idx] = a1.price;
      } else if (j === L) {
        p[a2.idx] = a2.price;
      } else {
        const trend = a1.price + (j / L) * (a2.price - a1.price);
        const bridge = (B[j] - (j / L) * BL) * sigma;
        let val = trend + bridge;
        val = Math.max(parent.low, Math.min(parent.high, val));
        p[a1.idx + j] = Number(val.toFixed(precision));
      }
    }
  }

  const weights = new Array(N);
  let totalW = 0;
  for (let k = 0; k < N; k++) {
    weights[k] = 0.5 + prng();
    totalW += weights[k];
  }

  const result = [];
  let volSum = 0;
  const wick = spread * 0.02;

  for (let k = 0; k < N; k++) {
    const barTime = mTime + k * 1000;
    const open = p[k];
    const close = p[k + 1];

    let high = Math.max(open, close);
    let low = Math.min(open, close);

    if (k === iH || open >= parent.high || close >= parent.high) {
      high = parent.high;
    } else {
      high = Math.min(parent.high, Number((high + prng() * wick).toFixed(precision)));
    }

    if (k === iL || open <= parent.low || close <= parent.low) {
      low = parent.low;
    } else {
      low = Math.max(parent.low, Number((low - prng() * wick).toFixed(precision)));
    }

    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    const vol = (k === N - 1)
      ? Math.round((parent.volume - volSum) * 100) / 100
      : Math.round(((parent.volume * weights[k]) / totalW) * 100) / 100;
    volSum += vol;

    result.push({
      time: barTime,
      open,
      high,
      low,
      close,
      volume: vol,
      closeTime: barTime + 999
    });
  }

  candleLru.set(cacheKey, result, result.length);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DEMO PRICE: Last price on path <= now (FR-009)
// ─────────────────────────────────────────────────────────────────────────────
export function demoPrice(symbol, now = Date.now()) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const t = Number(now);

  if (isSessionTime(clean, t)) {
    const todayMs = bucketStart('D', t);
    const mins = minuteBars(clean, todayMs);
    const curMin = bucketStart('1', t);
    const mBar = mins.find(b => b.time === curMin);
    if (mBar) {
      return mBar.close;
    }
    const pastMins = mins.filter(b => b.time <= t);
    if (pastMins.length > 0) {
      return pastMins[pastMins.length - 1].close;
    }
  }

  // Market is closed: find the last session day <= t
  let checkDay = bucketStart('D', t);
  for (let i = 0; i < 14; i++) {
    if (isSessionDay(clean, checkDay)) {
      const mins = minuteBars(clean, checkDay);
      const valid = (checkDay === bucketStart('D', t)) ? mins.filter(b => b.time <= t) : mins;
      if (valid.length > 0) {
        return valid[valid.length - 1].close;
      }
    }
    checkDay -= DAY_MS;
  }

  const cfg = getSymbolConfig(clean);
  return cfg.base;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DEMO BARS: Query engine across all timeframes (FR-007, FR-008)
// ─────────────────────────────────────────────────────────────────────────────
export function demoBars(symbol, tf, options = {}) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const parsed = typeof tf === 'object' && tf !== null && tf.canonical ? tf : parseTimeframe(tf);
  if (!parsed) throw new Error(`Invalid timeframe: ${tf}`);

  const limit = Math.max(1, Math.min(20000, Number(options.limit) || 500));
  let from = options.from !== null && options.from !== undefined ? Number(options.from) : null;
  let to = options.to !== null && options.to !== undefined ? Number(options.to) : null;

  if (from !== null && from < 1e11) from *= 1000;
  if (to !== null && to < 1e11) to *= 1000;

  const now = Date.now();
  const maxTo = (to !== null && to !== undefined) ? to : now;
  const effectiveTo = Math.min(maxTo, now);

  if (effectiveTo < START_DAY_MS) return [];
  if (from !== null && from > effectiveTo) return [];

  // Case A: Daily, Weekly, Monthly timeframes
  if (parsed.unit === 'D' || parsed.unit === 'W' || parsed.unit === 'M') {
    let days = dailyLayer(clean);

    // If today is a session day and effectiveTo >= todayStart, include today's forming bar
    const todayMs = bucketStart('D', now);
    if (isSessionDay(clean, todayMs) && effectiveTo >= todayMs) {
      const todayMins = minuteBars(clean, todayMs).filter(b => b.time <= effectiveTo);
      if (todayMins.length > 0) {
        const forming = {
          time: todayMs,
          open: todayMins[0].open,
          high: Math.max(...todayMins.map(b => b.high)),
          low: Math.min(...todayMins.map(b => b.low)),
          close: todayMins[todayMins.length - 1].close,
          volume: Math.round(todayMins.reduce((s, b) => s + b.volume, 0)),
          closeTime: nextBucket('D', todayMs) - 1
        };
        days = [...days, forming];
      }
    }

    if (parsed.canonical === 'D') {
      let filtered = days.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
      return filtered.slice(-limit);
    }

    // Multi-day (e.g. 3D), Weekly (W, 2W), Monthly (M, 3M)
    const aggregated = aggregate(days, parsed);
    let filtered = aggregated.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
    return filtered.slice(-limit);
  }

  // Case B: Minute & Hourly timeframes (unit 'm')
  if (parsed.unit === 'm') {
    if (parsed.count >= 60) {
      // Intraday buckets >= 60 minutes: stream aggregation per day (T019)
      const dayChunks = [];
      let totalAgg = 0;

      let scanDay = bucketStart('D', effectiveTo);
      while (scanDay >= START_DAY_MS && totalAgg < limit + 10) {
        if (from !== null && scanDay + DAY_MS < from) break;

        if (isSessionDay(clean, scanDay)) {
          // Do not retain per-minute arrays in cache for days that are only aggregated
          let mins = minuteBars(clean, scanDay, { noCache: true });
          mins = mins.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
          if (mins.length > 0) {
            const dayAgg = aggregate(mins, parsed);
            if (dayAgg.length > 0) {
              dayChunks.push(dayAgg);
              totalAgg += dayAgg.length;
            }
          }
        }
        scanDay -= DAY_MS;
      }

      if (dayChunks.length === 0) return [];

      dayChunks.reverse();
      const aggregated = dayChunks.flat();
      let filtered = aggregated.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
      return filtered.slice(-limit);
    }

    const needed = (limit + 10) * parsed.count;
    const dayChunks = [];
    let collectedCount = 0;

    let scanDay = bucketStart('D', effectiveTo);
    while (scanDay >= START_DAY_MS && collectedCount < needed) {
      if (from !== null && scanDay + DAY_MS < from) break;

      if (isSessionDay(clean, scanDay)) {
        let mins = minuteBars(clean, scanDay);
        mins = mins.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
        if (mins.length > 0) {
          dayChunks.push(mins);
          collectedCount += mins.length;
        }
      }
      scanDay -= DAY_MS;
    }

    if (dayChunks.length === 0) return [];

    dayChunks.reverse();
    const collectedMinutes = dayChunks.flat();

    if (parsed.canonical === '1') {
      return collectedMinutes.slice(-limit);
    }

    const aggregated = aggregate(collectedMinutes, parsed);
    let filtered = aggregated.filter(b => b.time <= effectiveTo && (from === null || b.time >= from));
    return filtered.slice(-limit);
  }

  // Case C: Sub-minute timeframes (unit 's')
  if (parsed.unit === 's') {
    // If market is closed right now and no to_time was explicitly requested,
    // anchor to the last session's end
    let anchorTime = effectiveTo;
    if (to === null && !isSessionTime(clean, effectiveTo)) {
      let checkDay = bucketStart('D', effectiveTo);
      for (let i = 0; i < 14; i++) {
        if (isSessionDay(clean, checkDay)) {
          const windows = sessionWindows(clean, checkDay);
          if (windows.length > 0) {
            const lastWin = windows[windows.length - 1];
            if (checkDay === bucketStart('D', effectiveTo)) {
              if (anchorTime > lastWin.endMs) anchorTime = lastWin.endMs - 1000;
            } else {
              anchorTime = lastWin.endMs - 1000;
            }
            break;
          }
        }
        checkDay -= DAY_MS;
      }
    }

    const neededSeconds = (limit + 10) * parsed.count;
    const chunkList = [];
    let collectedSecondsCount = 0;

    let scanMin = bucketStart('1', anchorTime);
    while (scanMin >= START_DAY_MS && collectedSecondsCount < neededSeconds) {
      if (from !== null && scanMin + 60000 < from) break;

      const scanDay = bucketStart('D', scanMin);
      if (isSessionDay(clean, scanDay)) {
        const secs = secondBars(clean, scanMin);
        const valid = secs.filter(b => b.time <= anchorTime && (from === null || b.time >= from));
        if (valid.length > 0) {
          chunkList.push(valid);
          collectedSecondsCount += valid.length;
        }
      }
      scanMin -= 60000;
    }

    if (chunkList.length === 0) return [];

    chunkList.reverse();
    const collectedSeconds = chunkList.flat();

    if (parsed.canonical === '1s') {
      return collectedSeconds.slice(-limit);
    }

    const aggregated = aggregate(collectedSeconds, parsed);
    let filtered = aggregated.filter(b => b.time <= anchorTime && (from === null || b.time >= from));
    return filtered.slice(-limit);
  }

  return [];
}
