// client/src/universalProvider.js
// Custom Vela DataProvider connecting to TradingChart's resilient multi-tier backend proxy
// Meets FR-011 and FR-012 requirements for live bucketing, source tracking, and no fabricated bars.

import { SYNTHETIC_TYPES } from './syntheticChartTypes.js';
import { parseTimeframe, bucketStart, nextBucket, aggregate } from './timeframes.js';

class SupportedTimeframesList extends Array {
  includes(tf) {
    return !!parseTimeframe(tf);
  }
  indexOf(tf) {
    return parseTimeframe(tf) ? 0 : -1;
  }
}

const BASE_TIMEFRAMES = [
  '1s', '5s', '15s', '30s', '1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', '2D', '3D', 'W', '2W', 'M', '3M'
];
export const SUPPORTED_TIMEFRAMES = new SupportedTimeframesList(...BASE_TIMEFRAMES);

export class UniversalMarketProvider {
  constructor(providerName = 'universal', displayName = 'Chartivia Multi-Asset') {
    this.providerName = providerName;
    this.displayName = displayName;
    this.symbolsCache = null;
    this.ws = null;
    this.subscribers = new Map(); // ticker -> Set<{ timeframe, onBar, currentBar }>
    this.lastBarsCache = new Map(); // `${ticker}_${timeframe}` -> Bar
    this.seriesCache = new Map(); // `${ticker}_${timeframe}` -> Bar[]
    this.lastSources = new Map(); // `${ticker}_${timeframe}` -> source ("binance" | "demo" | "cache")
    this.lastSource = null;
    this._lastReturnedBars = [];
    this._currentSymbol = null;
    this._currentTimeframe = null;
    this.chartManager = null;

    this.timeframes = {
      parseTimeframe,
      bucketStart,
      nextBucket,
      aggregate
    };
    this.bucketStart = bucketStart;
    this.nextBucket = nextBucket;
    this.parseTimeframe = parseTimeframe;

    this.initWebSocket();
    this.initRefreshLoop();
  }

  initRefreshLoop() {
    if (typeof window === 'undefined') return;
    this._refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      for (const [sym, subs] of this.subscribers.entries()) {
        for (const sub of subs) {
          this.refreshRecentBars(sym, sub.timeframe);
        }
      }
    }, 15000);
    if (this._refreshInterval.unref) this._refreshInterval.unref();
  }

  async refreshRecentBars(symbol, timeframe) {
    const clean = String(symbol).replace(/^.*:/, '').toUpperCase();
    try {
      const res = await fetch(`/api/candles?symbol=${encodeURIComponent(clean)}&timeframe=${encodeURIComponent(timeframe)}&limit=2`);
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data.candles) ? data.candles : [];
      const bars = raw
        .filter(b => b && Number.isFinite(Number(b.time)) && Number.isFinite(Number(b.close)))
        .map(b => ({
          time: Number(b.time),
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume || 0),
          openTime: Number(b.time),
          closeTime: Number(b.closeTime) || (nextBucket(timeframe, Number(b.time)) - 1)
        }));

      if (bars.length > 0) {
        const cacheKey = `${clean}_${timeframe}`;
        const last = bars[bars.length - 1];
        this.lastBarsCache.set(cacheKey, { ...last });

        const subs = this.subscribers.get(clean);
        if (subs) {
          for (const sub of subs) {
            if (String(sub.timeframe) === String(timeframe) && sub.currentBar && sub.currentBar.time === last.time) {
              sub.currentBar.open = last.open;
              sub.currentBar.high = Math.max(sub.currentBar.high, last.high);
              sub.currentBar.low = Math.min(sub.currentBar.low, last.low);
              sub.currentBar.volume = last.volume;
              sub.onBar?.({ ...sub.currentBar });
            }
          }
        }

        if (this._lastReturnedBars && this._lastReturnedBars.length > 0 && this._currentSymbol === clean && String(this._currentTimeframe) === String(timeframe)) {
          for (const b of bars) {
            const idx = this._lastReturnedBars.findIndex(x => x.time === b.time);
            if (idx >= 0) {
              this._lastReturnedBars[idx] = { ...b };
            } else if (b.time > this._lastReturnedBars[this._lastReturnedBars.length - 1].time) {
              this._lastReturnedBars.push({ ...b });
            }
          }
        }
      }
    } catch (e) {
      // ignore background refresh errors
    }
  }

  initWebSocket() {
    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        for (const ticker of this.subscribers.keys()) {
          this.ws.send(JSON.stringify({ action: 'subscribe', symbol: ticker }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'tick' && msg.symbol) {
            this.onLiveTick(msg);
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      // fallback
    }
  }

  onLiveTick(msg) {
    if (!msg || !msg.symbol) return;
    const clean = String(msg.symbol).replace(/^.*:/, '').toUpperCase();
    const subs = this.subscribers.get(clean);
    if (!subs || subs.size === 0) return;

    const tickTime = Number(msg.time) || Date.now();
    const tickPrice = Number(msg.price);
    if (!Number.isFinite(tickPrice)) return;

    for (const sub of subs) {
      const bStart = bucketStart(sub.timeframe, tickTime);
      const cacheKey = `${clean}_${sub.timeframe}`;
      const cached = this.lastBarsCache.get(cacheKey);

      if (!sub.currentBar || sub.currentBar.time !== bStart) {
        const isRoll = !!sub.currentBar;
        // Open a new bucket at the previous close (FR-011)
        const openPrice = sub.currentBar ? sub.currentBar.close : (cached ? cached.close : tickPrice);
        const prevVol = (cached && cached.time === bStart) ? cached.volume : 0;

        sub.currentBar = {
          time: bStart,
          open: openPrice,
          high: Math.max(openPrice, tickPrice),
          low: Math.min(openPrice, tickPrice),
          close: tickPrice,
          volume: prevVol, // NEVER change volume on ticks (FR-011)
          openTime: bStart,
          closeTime: nextBucket(sub.timeframe, bStart) - 1
        };

        if (isRoll) {
          this.refreshRecentBars(clean, sub.timeframe);
        }
      } else {
        // Update high, low, close. Volume MUST NOT change on ticks!
        sub.currentBar.high = Math.max(sub.currentBar.high, tickPrice);
        sub.currentBar.low = Math.min(sub.currentBar.low, tickPrice);
        sub.currentBar.close = tickPrice;
      }

      this.lastBarsCache.set(cacheKey, { ...sub.currentBar });

      if (this._lastReturnedBars && this._lastReturnedBars.length > 0 && this._currentSymbol === clean && String(this._currentTimeframe) === String(sub.timeframe)) {
        const lastIdx = this._lastReturnedBars.length - 1;
        if (this._lastReturnedBars[lastIdx].time === bStart) {
          this._lastReturnedBars[lastIdx] = { ...sub.currentBar };
        } else if (bStart > this._lastReturnedBars[lastIdx].time) {
          this._lastReturnedBars.push({ ...sub.currentBar });
        }
      }

      const now = Date.now();
      if (sub._lastEmit === undefined) sub._lastEmit = 0;
      if (sub._pendingTimer) { clearTimeout(sub._pendingTimer); sub._pendingTimer = null; }
      if (now - sub._lastEmit >= 250) {
        sub._lastEmit = now;
        sub.onBar?.({ ...sub.currentBar });
      } else {
        sub._pendingTimer = setTimeout(() => {
          sub._pendingTimer = null;
          sub._lastEmit = Date.now();
          sub.onBar?.({ ...sub.currentBar });
        }, 250 - (now - sub._lastEmit));
      }
    }
  }

  getSource(symbol, timeframe) {
    const clean = String(symbol).replace(/^.*:/, '').toUpperCase();
    return this.lastSources.get(`${clean}_${timeframe}`) || null;
  }

  info() {
    return {
      name: this.providerName,
      displayName: this.displayName,
      requiresApiKey: false,
      supportedTimeframes: SUPPORTED_TIMEFRAMES,
      capabilities: { enumerate: true, stream: true, symbolInfo: true }
    };
  }

  getBars(ticker, timeframe, range = {}) {
    if (arguments.length === 0) {
      return this._lastReturnedBars || [];
    }
    return this._fetchBars(ticker, timeframe, range);
  }

  async _fetchBars(ticker, timeframe, range = {}) {
    const clean = String(ticker).replace(/^.*:/, '').toUpperCase();
    const tfStr = String(timeframe);
    this._currentSymbol = clean;
    this._currentTimeframe = tfStr;

    const params = new URLSearchParams();
    params.set('symbol', clean);
    params.set('timeframe', tfStr);
    params.set('limit', String(range.limit || 2000));
    if (range.from) params.set('from_time', String(range.from));
    if (range.to) params.set('to_time', String(range.to));

    const synthType = (typeof window !== 'undefined' && localStorage.getItem('tradingchart_price_style')) || 'candles';
    const synth = SYNTHETIC_TYPES[synthType] || null;
    const cacheKey = `${clean}_${tfStr}`;

    try {
      const res = await fetch(`/api/candles?${params.toString()}`);
      if (!res.ok) {
        const lastGood = this.seriesCache.get(cacheKey);
        if (lastGood && lastGood.length) {
          console.warn(`[UniversalProvider] HTTP ${res.status} for ${clean} ${tfStr} — serving last known-good series`);
          const lg = lastGood.map(b => ({ ...b }));
          this.lastSources.set(cacheKey, 'cache');
          this.lastSource = 'cache';
          this._lastReturnedBars = lg;
          this.chartManager?.showNotice?.('cache_stale');
          return synth ? synth.fn(lg) : lg;
        }
        this.lastSources.set(cacheKey, 'none');
        this.lastSource = 'none';
        this._lastReturnedBars = [];
        this.chartManager?.showNotice?.('no_data');
        return [];
      }

      const data = await res.json();
      const source = data.source || 'binance';
      this.lastSources.set(cacheKey, source);
      this.lastSource = source;

      const raw = Array.isArray(data.candles) ? data.candles : [];
      let bars = raw
        .filter(b => b && Number.isFinite(Number(b.time)) && Number.isFinite(Number(b.close)))
        .map(b => ({
          time: Number(b.time),
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume || 0),
          openTime: Number(b.time),
          closeTime: Number(b.closeTime) || (nextBucket(tfStr, Number(b.time)) - 1)
        }));

      if (bars.length === 0) {
        const lastGood = this.seriesCache.get(cacheKey);
        if (lastGood && lastGood.length) {
          console.warn(`[UniversalProvider] Empty payload for ${clean} ${tfStr} — serving last known-good series`);
          const lg = lastGood.map(b => ({ ...b }));
          this.lastSources.set(cacheKey, 'cache');
          this.lastSource = 'cache';
          this._lastReturnedBars = lg;
          this.chartManager?.showNotice?.('cache_stale');
          return synth ? synth.fn(lg) : lg;
        }
        // FR-012: Return [] (NEVER a price-100 placeholder bar)
        this.lastSources.set(cacheKey, 'none');
        this.lastSource = 'none';
        this._lastReturnedBars = [];
        this.chartManager?.showNotice?.('no_data');
        return [];
      }

      this.seriesCache.set(cacheKey, bars.map(b => ({ ...b })));
      this._lastReturnedBars = bars;

      const last = bars[bars.length - 1];
      this.lastBarsCache.set(cacheKey, { ...last });

      const subs = this.subscribers.get(clean);
      if (subs) {
        for (const sub of subs) {
          if (String(sub.timeframe) === tfStr) {
            sub.currentBar = { ...last };
          }
        }
      }

      if (source === 'cache') {
        this.chartManager?.showNotice?.('cache_stale');
      } else {
        this.chartManager?.clearNotice?.();
      }

      return synth ? synth.fn(bars) : bars;
    } catch (e) {
      console.warn(`[UniversalProvider] Error fetching ${ticker} ${timeframe}:`, e.message);
      const lastGood = this.seriesCache.get(cacheKey);
      if (lastGood && lastGood.length) {
        const lg = lastGood.map(b => ({ ...b }));
        this.lastSources.set(cacheKey, 'cache');
        this.lastSource = 'cache';
        this._lastReturnedBars = lg;
        this.chartManager?.showNotice?.('cache_stale');
        return lg;
      }
      this.lastSources.set(cacheKey, 'none');
      this.lastSource = 'none';
      this._lastReturnedBars = [];
      this.chartManager?.showNotice?.('no_data');
      return [];
    }
  }

  async getSymbolInfo(ticker) {
    const clean = ticker.replace(/^.*:/, '').toUpperCase();
    try {
      const res = await fetch(`/api/symbol-info?symbol=${clean}`);
      if (res.ok) {
        const meta = await res.json();
        return {
          ticker: clean,
          tickerid: `${this.providerName.toUpperCase()}:${clean}`,
          prefix: this.providerName.toUpperCase(),
          description: meta.name || clean,
          type: meta.category === 'crypto' ? 'crypto' : 'stock',
          basecurrency: meta.base || 'BTC',
          currency: meta.quote || 'USD',
          mintick: meta.minTick || 0.01,
          pricescale: Math.round(1 / (meta.minTick || 0.01)),
          timezone: 'Etc/UTC',
          session: '24x7'
        };
      }
    } catch (e) {
      // fallback
    }

    return {
      ticker: clean,
      tickerid: `${this.providerName.toUpperCase()}:${clean}`,
      prefix: this.providerName.toUpperCase(),
      description: clean,
      type: clean.endsWith('USDT') ? 'crypto' : 'stock',
      basecurrency: clean.replace(/(USDT|USD)$/, ''),
      currency: clean.endsWith('USDT') ? 'USDT' : 'USD',
      mintick: 0.01,
      pricescale: 100,
      timezone: 'Etc/UTC',
      session: '24x7'
    };
  }

  async listSymbols() {
    if (this.symbolsCache) return this.symbolsCache;
    try {
      const res = await fetch('/api/symbols');
      if (res.ok) {
        const list = await res.json();
        this.symbolsCache = list.map(item => ({
          ticker: item.symbol,
          description: `${item.name} (${item.base}/${item.quote})`,
          type: item.category
        }));
        return this.symbolsCache;
      }
    } catch (e) {
      // fallback
    }
    return [
      { ticker: 'BTCUSDT', description: 'Bitcoin / Tether', type: 'crypto' },
      { ticker: 'ETHUSDT', description: 'Ethereum / Tether', type: 'crypto' },
      { ticker: 'SOLUSDT', description: 'Solana / Tether', type: 'crypto' },
      { ticker: 'XAUUSD', description: 'Gold / US Dollar', type: 'metals' },
      { ticker: 'EURUSD', description: 'Euro / US Dollar', type: 'forex' }
    ];
  }

  resolveSymbolIcon(symbol) {
    const symStr = typeof symbol === 'string' ? symbol : symbol?.ticker || '';
    const clean = symStr.replace(/^.*:/, '').toUpperCase();
    if (clean.includes('BTC')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f7931a"/><path fill="%23fff" d="m23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783-1.728-.431-.709 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.596-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.535 2.147-4.148.987-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.698 3.61 2.733z"/></svg>';
    }
    if (clean.includes('ETH')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23627eea"/><path fill="%23fff" fill-opacity=".6" d="m16.498 4v8.87l7.497 3.35z"/><path fill="%23fff" d="m16.498 4-7.498 12.22 7.498-3.35z"/><path fill="%23fff" fill-opacity=".6" d="m16.498 21.968v6.027l7.502-10.364z"/><path fill="%23fff" d="m16.498 27.995v-6.028l-7.498-4.336z"/><path fill="%23fff" fill-opacity=".2" d="m16.498 20.573 7.497-4.353-7.497-3.348z"/><path fill="%23fff" fill-opacity=".6" d="m8.999 16.22 7.499 4.353v-7.701z"/></svg>';
    }
    if (clean.includes('SOL')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2314151a"/><path fill="%2300ffa3" d="m7.2 21.6 3.1-3.1h14.5l-3.1 3.1z"/><path fill="%2300e5ff" d="m7.2 13.5 3.1-3.1h14.5l-3.1 3.1z"/><path fill="%23dc1fff" d="m7.2 5.5 3.1-3.1h14.5l-3.1 3.1z"/></svg>';
    }
    if (clean.includes('BNB')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f3ba2f"/><path fill="%23fff" d="m12.11 12.12 3.89-3.88 3.89 3.88 2.01-2.01-5.9-5.9-5.9 5.9zm-3.89 3.88 2.01-2.01-2.01-2.01-2.01 2.01zm19.56 0-2.01-2.01 2.01-2.01 2.01 2.01zm-11.78 3.88-3.89-3.88 3.89-3.88 3.89 3.88zm0 7.91 5.9-5.9-2.01-2.01-3.89 3.88-3.89-3.88-2.01 2.01z"/></svg>';
    }
    if (clean.includes('XAU') || clean.includes('ABSHODEH') || clean.includes('GOLD') || clean.includes('COIN_') || clean.includes('TALA') || clean.includes('AYAR')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23e5a93c"/><text x="16" y="21" font-family="sans-serif" font-weight="900" font-size="14" fill="%23fff" text-anchor="middle">Au</text></svg>';
    }
    if (clean.includes('FOOLAD') || clean.includes('FAMELI') || clean.includes('KHODRO') || clean.includes('AHRAM') || clean.includes('SHASTA') || clean.includes('SAIPA') || clean.includes('AGAS') || clean.includes('TAVAN')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2310b981"/><text x="16" y="21" font-family="sans-serif" font-weight="900" font-size="11" fill="%23fff" text-anchor="middle">TSE</text></svg>';
    }
    if (clean.includes('USD') || clean.includes('EUR') || clean.includes('GBP') || clean.includes('JPY') || clean.includes('DIRHAM')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%233b82f6"/><text x="16" y="21" font-family="sans-serif" font-weight="900" font-size="12" fill="%23fff" text-anchor="middle">FX</text></svg>';
    }
    if (clean.includes('OIL') || clean.includes('GAS')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23ef4444"/><text x="16" y="21" font-family="sans-serif" font-weight="900" font-size="11" fill="%23fff" text-anchor="middle">OIL</text></svg>';
    }
    return null;
  }

  subscribe(ticker, timeframe, onBar) {
    const clean = ticker.replace(/^.*:/, '').toUpperCase();
    let set = this.subscribers.get(clean);
    if (!set) {
      set = new Set();
      this.subscribers.set(clean, set);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'subscribe', symbol: clean }));
      }
    }

    const cacheKey = `${clean}_${timeframe}`;
    const cached = this.lastBarsCache.get(cacheKey);
    const sub = {
      timeframe,
      onBar,
      currentBar: cached ? { ...cached } : null
    };
    set.add(sub);

    return () => {
      set.delete(sub);
      if (set.size === 0) {
        this.subscribers.delete(clean);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ action: 'unsubscribe', symbol: clean }));
        }
      }
    };
  }
}
