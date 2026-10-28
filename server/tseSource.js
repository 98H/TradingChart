// server/tseSource.js
// Tehran Stock Exchange (TSETMC / IFB) gated source adapter
// Supports:
// 1. BrsApi.ir via env TC_BRSAPI_KEY (AllSymbols snapshot + on-demand 24h history, fair use)
// 2. Iran-IP relay via env TC_TSETMC_PROXY
// Strict gating: unless a source is configured and healthy,
// iran_tse symbols, category, tape view, and routes remain completely disabled (FR-007).
// Prefix: TSETMC: (TSE: is reserved for Tokyo Stock Exchange on TradingView) (FR-013).

import { CostLruCache } from './lru.js';
import { parseTimeframe, aggregate } from './timeframes.js';

class FairUseLimiter {
  constructor({ minSpacingMs = 300, maxRequests = 300, windowMs = 5 * 60 * 1000 } = {}) {
    this.minSpacingMs = minSpacingMs;
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.lastRequestTime = 0;
    this.requestTimestamps = [];
    this.queue = [];
    this.processing = false;
  }

  schedule(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(t => now - t < this.windowMs);

      if (this.requestTimestamps.length >= this.maxRequests) {
        const oldest = this.requestTimestamps[0];
        const waitMs = this.windowMs - (now - oldest) + 50;
        await new Promise(r => setTimeout(r, Math.max(50, waitMs)));
        continue;
      }

      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minSpacingMs) {
        await new Promise(r => setTimeout(r, this.minSpacingMs - elapsed));
      }

      const item = this.queue.shift();
      if (!item) break;

      this.lastRequestTime = Date.now();
      this.requestTimestamps.push(this.lastRequestTime);

      try {
        const res = await item.fn();
        item.resolve(res);
      } catch (err) {
        item.reject(err);
      }
    }

    this.processing = false;
  }
}

function detectTseType(ticker, title) {
  const s = String(ticker || '').trim();
  const t = String(title || '').trim();
  if (s.endsWith('ح') || t.includes('حق تقدم')) return 'rights';
  if (t.includes('صندوق') || t.includes('ETF') || t.includes('سرمایه گذاری')) return 'fund';
  if (t.includes('اوراق') || t.includes('صکوک') || t.includes('اسناد') || t.includes('اخزا') || t.includes('سلف') || t.includes('مرابحه') || t.includes('گام')) return 'bond';
  if (t.includes('اختیار') || s.startsWith('ض') || s.startsWith('ط')) return 'option';
  return 'stock';
}

class TseSource {
  constructor() {
    this.healthy = false;
    this.mode = null; // 'brsapi' | 'tsetmc_proxy' | null
    this.lastProbeTime = 0;
    this.lastProbeError = null;
    this.symbolsCache = [];
    this.tickersMap = new Map();
    this.cacheTimestamp = 0;
    this.limiter = new FairUseLimiter({ minSpacingMs: 300, maxRequests: 300, windowMs: 5 * 60 * 1000 });
    this.historyCache = new CostLruCache(1000); // 24h history cache

    // Periodic health probe
    this.probeTimer = setInterval(() => {
      this.probeHealth().catch(() => {});
    }, 60000);
    if (this.probeTimer?.unref) this.probeTimer.unref();

    // 1-minute snapshot timer for live prices when enabled via BrsApi
    this.snapshotTimer = setInterval(() => {
      if (this.isTseEnabled() && this.mode === 'brsapi') {
        this.fetchBrsApiAllSymbols().catch(() => {});
      }
    }, 60000);
    if (this.snapshotTimer?.unref) this.snapshotTimer.unref();

    // Trigger initial probe
    this.probeHealth().catch(() => {});
  }

  isTseEnabled() {
    return this.healthy && this.mode !== null;
  }

  getTseStatus() {
    return {
      enabled: this.isTseEnabled(),
      healthy: this.healthy,
      mode: this.mode,
      lastProbe: this.lastProbeTime,
      error: this.lastProbeError
    };
  }

  isKnownSymbol(ticker) {
    if (!ticker) return false;
    const clean = String(ticker).trim().toUpperCase().replace(/^TSETMC:/, '').replace(/^TSE:/, '');
    return this.symbolsCache.some(s => {
      const symClean = s.symbol.replace(/^TSETMC:/, '').toUpperCase();
      return symClean === clean || (s.name && s.name.toUpperCase() === clean) || (s.nameFa && s.nameFa.toUpperCase() === clean);
    });
  }

  async probeHealth() {
    this.lastProbeTime = Date.now();
    const proxyUrl = process.env.TC_TSETMC_PROXY;
    const brsApiKey = process.env.TC_BRSAPI_KEY;

    if (!proxyUrl && !brsApiKey) {
      this.healthy = false;
      this.mode = null;
      this.lastProbeError = 'unconfigured';
      return false;
    }

    // 1. Check TC_TSETMC_PROXY first if present
    if (proxyUrl) {
      try {
        const cleanBase = String(proxyUrl).trim().replace(/\/+$/, '');
        const res = await fetch(`${cleanBase}/health`, {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          this.healthy = true;
          this.mode = 'tsetmc_proxy';
          this.lastProbeError = null;
          this.loadSymbols().catch(() => {});
          return true;
        }
      } catch (err) {
        this.lastProbeError = `proxy_probe_failed: ${err.message}`;
      }
    }

    // 2. Check TC_BRSAPI_KEY
    if (brsApiKey) {
      try {
        const key = String(brsApiKey).trim();
        const res = await this.limiter.schedule(async () => {
          return fetch(`https://Api.BrsApi.ir/Tsetmc/AllSymbols.php?key=${encodeURIComponent(key)}`, {
            signal: AbortSignal.timeout(6000)
          });
        });

        if (res.ok) {
          const json = await res.json();
          if (json && (Array.isArray(json) || Array.isArray(json.data))) {
            this.healthy = true;
            this.mode = 'brsapi';
            this.lastProbeError = null;
            this.parseBrsApiSymbols(json);
            return true;
          }
        }
        this.lastProbeError = `brsapi_error_${res.status}`;
      } catch (err) {
        this.lastProbeError = `brsapi_probe_failed: ${err.message}`;
      }
    }

    this.healthy = false;
    this.mode = null;
    return false;
  }

  parseBrsApiSymbols(raw) {
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
    if (!list.length) return;

    const mapped = [];
    this.tickersMap.clear();

    for (const item of list) {
      const ticker = String(item.l18 || item.symbol || item.ticker || '').trim();
      if (!ticker) continue;

      const title = item.title || item.l30 || item.name || ticker;
      const type = detectTseType(ticker, title);
      const symbol = `TSETMC:${ticker}`;

      const entry = {
        symbol,
        name: title,
        nameFa: title,
        tickerFa: ticker,
        exchange: 'TSETMC',
        type,
        category: 'iran_tse',
        currency: 'IRR',
        source: 'brsapi',
        dataStatus: 'delayed',
        delaySec: 900,
        timeframes: ['D', 'W', 'M'],
        precision: 0,
        minTick: 10,
        lotSize: 1
      };
      mapped.push(entry);

      const lastPrice = Number(item.pl || item.last_price || item.pc || item.close_price) || 0;
      const closePrice = Number(item.pc || item.close_price || item.pl) || lastPrice;
      const prevClose = Number(item.py || item.yesterday_price) || closePrice;
      const priceChange = closePrice - prevClose;
      const priceChangePercent = prevClose > 0 ? Number(((priceChange / prevClose) * 100).toFixed(2)) : 0;

      this.tickersMap.set(symbol, {
        symbol,
        lastPrice,
        priceChange,
        priceChangePercent,
        highPrice: Number(item.pmax || item.high) || lastPrice,
        lowPrice: Number(item.pmin || item.low) || lastPrice,
        volume: Number(item.tvol || item.volume) || 0,
        exchange: 'TSETMC',
        category: 'iran_tse',
        currency: 'IRR',
        source: 'brsapi',
        dataStatus: 'delayed',
        delaySec: 900,
        time: Date.now()
      });
    }

    this.symbolsCache = mapped;
    this.cacheTimestamp = Date.now();
  }

  async fetchBrsApiAllSymbols() {
    const key = process.env.TC_BRSAPI_KEY;
    if (!key) return;

    try {
      const res = await this.limiter.schedule(async () => {
        return fetch(`https://Api.BrsApi.ir/Tsetmc/AllSymbols.php?key=${encodeURIComponent(key.trim())}`, {
          signal: AbortSignal.timeout(8000)
        });
      });
      if (res.ok) {
        const json = await res.json();
        this.parseBrsApiSymbols(json);
      }
    } catch (e) {
      // Keep previous snapshot on transient error
    }
  }

  async loadSymbols() {
    if (!this.isTseEnabled()) return [];
    if (this.symbolsCache.length > 0 && Date.now() - this.cacheTimestamp < 3600000) {
      return this.symbolsCache;
    }

    if (this.mode === 'tsetmc_proxy') {
      try {
        const proxyUrl = String(process.env.TC_TSETMC_PROXY).trim().replace(/\/+$/, '');
        const res = await fetch(`${proxyUrl}/tsetmc/symbols`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            this.symbolsCache = list.map(item => {
              const ticker = String(item.symbol || item.l18 || '').trim();
              const title = item.nameFa || item.name || ticker;
              const type = detectTseType(ticker, title);
              return {
                symbol: `TSETMC:${ticker}`,
                name: item.name || ticker,
                nameFa: title,
                tickerFa: ticker,
                exchange: 'TSETMC',
                type,
                category: 'iran_tse',
                currency: 'IRR',
                source: 'tsetmc_proxy',
                dataStatus: 'live',
                delaySec: 0,
                timeframes: ['1', '5', '15', '60', 'D', 'W', 'M'],
                precision: 0,
                minTick: 10,
                lotSize: 1
              };
            });
            this.cacheTimestamp = Date.now();
            return this.symbolsCache;
          }
        }
      } catch (e) {}
    } else if (this.mode === 'brsapi') {
      await this.fetchBrsApiAllSymbols();
      return this.symbolsCache;
    }

    return this.symbolsCache;
  }

  async getTseSymbols() {
    return this.loadSymbols();
  }

  async getCandles(symbol, tfParsed, limit = 500, fromTime = null, toTime = null) {
    if (!this.isTseEnabled()) {
      const err = new Error('tse_unavailable');
      err.code = 'TSE_UNAVAILABLE';
      throw err;
    }

    const clean = String(symbol).trim().toUpperCase().replace(/^TSETMC:/, '').replace(/^TSE:/, '');
    const canonicalSym = `TSETMC:${clean}`;
    const parsed = typeof tfParsed === 'object' && tfParsed?.canonical ? tfParsed : parseTimeframe(tfParsed);

    if (!parsed || (parsed.unit !== 'D' && parsed.unit !== 'W' && parsed.unit !== 'M')) {
      const err = new Error('timeframe_unavailable');
      err.code = 'TIMEFRAME_UNAVAILABLE';
      throw err;
    }

    const cacheKey = `history:${canonicalSym}`;
    let dailyBars = this.historyCache.get(cacheKey);

    if (!dailyBars) {
      if (this.mode === 'brsapi') {
        const key = process.env.TC_BRSAPI_KEY;
        const res = await this.limiter.schedule(async () => {
          return fetch(`https://Api.BrsApi.ir/Tsetmc/History.php?key=${encodeURIComponent(key)}&l18=${encodeURIComponent(clean)}`, {
            signal: AbortSignal.timeout(8000)
          });
        });
        if (!res.ok) {
          const err = new Error('tse_unavailable');
          err.code = 'TSE_UNAVAILABLE';
          throw err;
        }
        const json = await res.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        dailyBars = list.map(row => {
          const tSec = typeof row.time === 'number' ? row.time : Math.floor(new Date(row.date || row.d).getTime() / 1000);
          return {
            time: tSec * 1000,
            open: Number(row.open || row.pf || row.first || 0),
            high: Number(row.high || row.pmax || 0),
            low: Number(row.low || row.pmin || 0),
            close: Number(row.close || row.pc || row.pl || 0),
            volume: Number(row.volume || row.tvol || 0)
          };
        }).filter(b => b.time > 0 && b.close > 0).sort((a, b) => a.time - b.time);

        this.historyCache.set(cacheKey, dailyBars, dailyBars.length, 24 * 60 * 60 * 1000);
      } else if (this.mode === 'tsetmc_proxy') {
        const proxyUrl = String(process.env.TC_TSETMC_PROXY).trim().replace(/\/+$/, '');
        const res = await fetch(`${proxyUrl}/tsetmc/history?symbol=${encodeURIComponent(clean)}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) {
          const err = new Error('tse_unavailable');
          err.code = 'TSE_UNAVAILABLE';
          throw err;
        }
        const json = await res.json();
        const list = Array.isArray(json) ? json : [];
        dailyBars = list.map(b => ({
          time: typeof b.time === 'number' ? b.time : new Date(b.date).getTime(),
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume || 0)
        })).sort((a, b) => a.time - b.time);

        this.historyCache.set(cacheKey, dailyBars, dailyBars.length, 24 * 60 * 60 * 1000);
      } else {
        const err = new Error('tse_unavailable');
        err.code = 'TSE_UNAVAILABLE';
        throw err;
      }
    }

    let aggregated = dailyBars;
    if (parsed.unit === 'W' || parsed.unit === 'M') {
      aggregated = aggregate(dailyBars, parsed);
    }

    let filtered = aggregated;
    if (fromTime !== null) filtered = filtered.filter(b => b.time >= fromTime);
    if (toTime !== null) filtered = filtered.filter(b => b.time <= toTime);

    const candles = filtered.slice(-Math.min(limit, 5000));
    return {
      symbol: canonicalSym,
      timeframe: parsed.canonical,
      exchange: 'TSETMC',
      delaySec: this.mode === 'brsapi' ? 900 : 0,
      source: this.mode || 'brsapi',
      count: candles.length,
      candles
    };
  }

  async getTicker(symbol) {
    if (!this.isTseEnabled()) {
      return { unknown: true, symbol };
    }
    const clean = String(symbol).trim().toUpperCase().replace(/^TSETMC:/, '').replace(/^TSE:/, '');
    const canonicalSym = `TSETMC:${clean}`;
    const t = this.tickersMap.get(canonicalSym);
    if (t) return t;
    return { unknown: true, symbol };
  }

  async getTape(symbol) {
    if (!this.isTseEnabled()) {
      const err = new Error('tse_unavailable');
      err.code = 'TSE_UNAVAILABLE';
      throw err;
    }
    const clean = String(symbol).trim().toUpperCase().replace(/^TSETMC:/, '').replace(/^TSE:/, '');
    return {
      symbol: `TSETMC:${clean}`,
      trades: [],
      timestamp: Date.now()
    };
  }
}

export const tseSource = new TseSource();
