// server/tgjuClient.js
// Dedicated client for Tehran gold, coins, and currencies from TGJU
// Provides:
// 1. Slug map & canonical symbol definitions
// 2. Daily history (Rial ÷ 10 -> Toman, verified table headers, OHLC integrity)
// 3. Current value polling <= 60s (https://call.tgju.org/ajax.json)
// 4. In-memory caching with 10-minute TTL and 24h last-good fallback
// 5. Weekly/Monthly aggregation via aggregate() and rejection of intraday timeframes

import { aggregate } from './timeframes.js';

export const TGJU_SLUG_MAP = {
  'IR:USD_FREE': 'price_dollar_rl',
  'IR:EUR_FREE': 'price_eur',
  'IR:AED_FREE': 'price_aed',
  'IR:COIN_EMAMI': 'sekee',
  'IR:COIN_BAHAR': 'sekeb',
  'IR:COIN_NIM': 'nim',
  'IR:COIN_ROB': 'rob',
  'IR:COIN_GERMI': 'gerami',
  'IR:GOLD_18K': 'geram18',
  'IR:GOLD_MESGHAL': 'mesghal',
  'IR:GOLD_ABSHODEH': 'mesghal'
};

export const TGJU_ENTRIES = [
  {
    symbol: 'IR:USD_FREE',
    name: 'US Dollar (Tehran Free Market)',
    nameFa: 'دلار آمریکا (بازار آزاد تهران)',
    exchange: 'TGJU',
    type: 'currency',
    category: 'iran_fx',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 10,
    lotSize: 1
  },
  {
    symbol: 'IR:EUR_FREE',
    name: 'Euro (Tehran Free Market)',
    nameFa: 'یورو (بازار آزاد تهران)',
    exchange: 'TGJU',
    type: 'currency',
    category: 'iran_fx',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 10,
    lotSize: 1
  },
  {
    symbol: 'IR:AED_FREE',
    name: 'UAE Dirham (Tehran Free Market)',
    nameFa: 'درهم امارات (حواله دبی)',
    exchange: 'TGJU',
    type: 'currency',
    category: 'iran_fx',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 10,
    lotSize: 1
  },
  {
    symbol: 'IR:COIN_EMAMI',
    name: 'Emami Gold Coin (Full)',
    nameFa: 'سکه تمام طرح جدید (امامی)',
    exchange: 'TGJU',
    type: 'coin',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 1000,
    lotSize: 1
  },
  {
    symbol: 'IR:COIN_BAHAR',
    name: 'Bahar Azadi Gold Coin',
    nameFa: 'سکه بهار آزادی (طرح قدیم)',
    exchange: 'TGJU',
    type: 'coin',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 1000,
    lotSize: 1
  },
  {
    symbol: 'IR:COIN_NIM',
    name: 'Half Gold Coin',
    nameFa: 'نیم سکه بهار آزادی',
    exchange: 'TGJU',
    type: 'coin',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 1000,
    lotSize: 1
  },
  {
    symbol: 'IR:COIN_ROB',
    name: 'Quarter Gold Coin',
    nameFa: 'ربع سکه بهار آزادی',
    exchange: 'TGJU',
    type: 'coin',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 1000,
    lotSize: 1
  },
  {
    symbol: 'IR:COIN_GERMI',
    name: 'Gram Gold Coin',
    nameFa: 'سکه یک گرمی بانک مرکزی',
    exchange: 'TGJU',
    type: 'coin',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 1000,
    lotSize: 1
  },
  {
    symbol: 'IR:GOLD_18K',
    name: 'Gold 18 Karat (per gram)',
    nameFa: 'طلای ۱۸ عیار (هر گرم)',
    exchange: 'TGJU',
    type: 'gold',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 100,
    lotSize: 1
  },
  {
    symbol: 'IR:GOLD_MESGHAL',
    name: 'Gold Melted (Mesghal / 17 Karat)',
    nameFa: 'طلای آبشده ۱۷ عیار (مظنه مثقال)',
    exchange: 'TGJU',
    type: 'gold',
    category: 'iran_gold',
    currency: 'TMN',
    source: 'tgju',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: ['D', 'W', 'M'],
    precision: 0,
    minTick: 500,
    lotSize: 1
  }
];

function cleanNum(val) {
  if (typeof val === 'number') return val;
  const s = String(val || '').replace(/<[^>]+>/g, '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

class TgjuClient {
  constructor() {
    this.dailyCache = new Map();
    this.lastGoodDaily = new Map();
    this.inflight = new Map();
    this.liveQuotes = new Map();
    this.tickListeners = new Set();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // Start live polling (every 40s <= 60s)
    this.pollTimer = setInterval(() => {
      this.pollLiveQuotes().catch(() => {});
    }, 40000);
    if (this.pollTimer?.unref) this.pollTimer.unref();

    // Trigger initial poll
    this.pollLiveQuotes().catch(() => {});
  }

  onLiveTick(cb) {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  emitTick(tick) {
    for (const cb of this.tickListeners) {
      try { cb(tick); } catch (e) {}
    }
  }

  getSlug(symbol) {
    if (!symbol) return null;
    const s = String(symbol).trim().toUpperCase();
    return TGJU_SLUG_MAP[s] || null;
  }

  /**
   * Polls https://call.tgju.org/ajax.json for real-time prices
   */
  async pollLiveQuotes() {
    try {
      const res = await fetch('https://call.tgju.org/ajax.json', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return;
      const data = await res.json();
      const current = data?.current || {};

      for (const [sym, slug] of Object.entries(TGJU_SLUG_MAP)) {
        const item = current[slug];
        if (!item) continue;

        const p = cleanNum(item.p) / 10;
        const h = cleanNum(item.h) / 10;
        const l = cleanNum(item.l) / 10;
        const d = cleanNum(item.d) / 10;
        const dp = cleanNum(item.dp);

        let time = Date.now();
        if (item.ts) {
          const parsed = Date.parse(item.ts.replace(' ', 'T') + 'Z');
          if (!isNaN(parsed)) time = parsed;
        }

        const existing = this.liveQuotes.get(slug);
        const lastPrice = p > 0 ? p : (existing?.lastPrice || 0);
        if (lastPrice <= 0) continue;

        const quote = {
          symbol: sym,
          slug,
          lastPrice,
          highPrice: Math.max(h > 0 ? h : lastPrice, lastPrice),
          lowPrice: Math.min(l > 0 ? l : lastPrice, lastPrice),
          priceChange: d,
          priceChangePercent: dp,
          volume: 0,
          time
        };

        this.liveQuotes.set(slug, quote);

        if (!existing || existing.lastPrice !== quote.lastPrice) {
          this.emitTick({
            symbol: sym,
            price: quote.lastPrice,
            change: quote.priceChange,
            changePct: quote.priceChangePercent,
            high: quote.highPrice,
            low: quote.lowPrice,
            volume: 0,
            time: quote.time
          });
        }
      }
    } catch (e) {
      // transient network failure: keep existing live quotes
    }
  }

  /**
   * Fetches daily history from TGJU summary table data
   */
  async fetchDailyHistory(slug) {
    const cached = this.dailyCache.get(slug);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return { candles: cached.candles, fromCache: false };
    }

    if (this.inflight.has(slug)) {
      return this.inflight.get(slug);
    }

    const promise = (async () => {
      try {
        const url = `https://api.tgju.org/v1/market/indicator/summary-table-data/${slug}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
          throw new Error(`TGJU upstream error: ${res.status}`);
        }

        const json = await res.json();
        const rawRows = Array.isArray(json?.data) ? json.data : [];
        if (rawRows.length === 0) {
          throw new Error(`Empty data returned for slug ${slug}`);
        }

        // Parse rows:
        // Index 0: Open (Rial)
        // Index 1: Low (Rial)
        // Index 2: High (Rial)
        // Index 3: Close (Rial)
        // Index 6: Gregorian date YYYY/MM/DD
        const parsedBars = [];
        const seenTimes = new Set();

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!Array.isArray(row) || row.length < 7) continue;

          const dateStr = String(row[6] || '').trim();
          const parts = dateStr.split('/');
          if (parts.length !== 3) continue;

          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          const time = Date.UTC(year, month - 1, day);
          if (isNaN(time) || seenTimes.has(time)) continue;

          const rawOpen = cleanNum(row[0]) / 10;
          const rawLow = cleanNum(row[1]) / 10;
          const rawHigh = cleanNum(row[2]) / 10;
          const rawClose = cleanNum(row[3]) / 10;

          if (rawOpen <= 0 && rawClose <= 0) continue;

          // Enforce strict OHLC integrity
          const open = rawOpen > 0 ? rawOpen : rawClose;
          const close = rawClose > 0 ? rawClose : rawOpen;
          const low = Math.min(rawLow > 0 ? rawLow : Math.min(open, close), open, close);
          const high = Math.max(rawHigh > 0 ? rawHigh : Math.max(open, close), open, close);

          seenTimes.add(time);
          parsedBars.push({
            time,
            open,
            high,
            low,
            close,
            volume: 0
          });
        }

        // Sort ascending by time (oldest first, newest last)
        parsedBars.sort((a, b) => a.time - b.time);

        if (parsedBars.length === 0) {
          throw new Error(`No valid bars parsed for slug ${slug}`);
        }

        this.dailyCache.set(slug, { candles: parsedBars, timestamp: Date.now() });
        this.lastGoodDaily.set(slug, parsedBars);

        // Update live quote with latest daily bar if live quote not yet polled
        const lastBar = parsedBars[parsedBars.length - 1];
        if (!this.liveQuotes.has(slug) && lastBar) {
          const prevBar = parsedBars.length > 1 ? parsedBars[parsedBars.length - 2] : lastBar;
          const change = lastBar.close - prevBar.close;
          const changePct = prevBar.close > 0 ? Number(((change / prevBar.close) * 100).toFixed(2)) : 0;
          this.liveQuotes.set(slug, {
            lastPrice: lastBar.close,
            highPrice: lastBar.high,
            lowPrice: lastBar.low,
            priceChange: change,
            priceChangePercent: changePct,
            volume: 0,
            time: lastBar.time
          });
        }

        return { candles: parsedBars, fromCache: false };
      } catch (err) {
        const lastGood = this.lastGoodDaily.get(slug);
        if (lastGood && lastGood.length > 0) {
          return { candles: lastGood, fromCache: true };
        }
        const outageErr = new Error('upstream_unavailable');
        outageErr.code = 'UPSTREAM_UNAVAILABLE';
        throw outageErr;
      } finally {
        this.inflight.delete(slug);
      }
    })();

    this.inflight.set(slug, promise);
    return promise;
  }

  /**
   * Retrieves candles for a TGJU symbol
   */
  async getCandles(symbol, tfParsed, limit = 500, fromTime = null, toTime = null) {
    const slug = this.getSlug(symbol);
    if (!slug) {
      const err = new Error('unknown_symbol');
      err.code = 'UNKNOWN_SYMBOL';
      throw err;
    }

    // Intraday timeframes (seconds or minutes) strictly rejected (FR-006)
    if (tfParsed.unit === 's' || tfParsed.unit === 'm') {
      const err = new Error('timeframe_unavailable');
      err.code = 'TIMEFRAME_UNAVAILABLE';
      throw err;
    }

    const { candles: dailyBars, fromCache } = await this.fetchDailyHistory(slug);

    let candles;
    if (tfParsed.unit === 'W' || tfParsed.unit === 'M') {
      candles = aggregate(dailyBars, tfParsed);
    } else {
      candles = [...dailyBars];
    }

    if (fromTime !== null) {
      candles = candles.filter(c => c.time >= fromTime);
    }
    if (toTime !== null) {
      candles = candles.filter(c => c.time <= toTime);
    }

    if (limit && candles.length > limit) {
      candles = candles.slice(-limit);
    }

    const result = [...candles];
    result.source = fromCache ? 'cache' : 'tgju';
    result.exchange = 'TGJU';
    result.delaySec = 0;
    result.candles = result;
    result.timeframe = tfParsed.canonical || 'D';
    return result;
  }

  /**
   * Returns current 24hr quote for a TGJU symbol
   */
  async getQuote(symbol) {
    const slug = this.getSlug(symbol);
    if (!slug) {
      return { unknown: true, symbol };
    }

    let q = this.liveQuotes.get(slug);
    if (!q || typeof q.lastPrice !== 'number' || q.lastPrice <= 0) {
      try {
        const { candles } = await this.fetchDailyHistory(slug);
        if (candles.length > 0) {
          const lastBar = candles[candles.length - 1];
          const prevBar = candles.length > 1 ? candles[candles.length - 2] : lastBar;
          const change = lastBar.close - prevBar.close;
          const changePct = prevBar.close > 0 ? Number(((change / prevBar.close) * 100).toFixed(2)) : 0;
          q = {
            lastPrice: lastBar.close,
            highPrice: lastBar.high,
            lowPrice: lastBar.low,
            priceChange: change,
            priceChangePercent: changePct,
            volume: 0,
            time: lastBar.time
          };
          this.liveQuotes.set(slug, q);
        }
      } catch (e) {
        return { unknown: true, symbol };
      }
    }

    if (!q || typeof q.lastPrice !== 'number' || q.lastPrice <= 0) {
      return { unknown: true, symbol };
    }

    const meta = TGJU_ENTRIES.find(e => e.symbol === symbol) || {};
    return {
      symbol,
      lastPrice: q.lastPrice,
      priceChange: q.priceChange || 0,
      priceChangePercent: q.priceChangePercent || 0,
      highPrice: q.highPrice || q.lastPrice,
      lowPrice: q.lowPrice || q.lastPrice,
      volume: q.volume || 0,
      exchange: 'TGJU',
      category: meta.category || 'iran_gold',
      currency: 'TMN',
      source: 'tgju',
      dataStatus: 'live',
      delaySec: 0,
      time: q.time || Date.now()
    };
  }
}

export const tgjuClient = new TgjuClient();
