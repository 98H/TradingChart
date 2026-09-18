// client/src/universalProvider.js
// Custom Vela DataProvider connecting to TradingChart's resilient multi-tier backend proxy

const SUPPORTED_TIMEFRAMES = [
  '1s', '1S', '1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', 'W', 'M'
];

function getIntervalMs(timeframe) {
  const tf = String(timeframe).toUpperCase();
  if (tf === '1S') return 1000;
  if (tf === '1' || tf === '1M') return 60 * 1000;
  if (tf === '3' || tf === '3M') return 3 * 60 * 1000;
  if (tf === '5' || tf === '5M') return 5 * 60 * 1000;
  if (tf === '15' || tf === '15M') return 15 * 60 * 1000;
  if (tf === '30' || tf === '30M') return 30 * 60 * 1000;
  if (tf === '45' || tf === '45M') return 45 * 60 * 1000;
  if (tf === '60' || tf === '1H') return 60 * 60 * 1000;
  if (tf === '120' || tf === '2H') return 2 * 60 * 60 * 1000;
  if (tf === '180' || tf === '3H') return 3 * 60 * 60 * 1000;
  if (tf === '240' || tf === '4H') return 4 * 60 * 60 * 1000;
  if (tf === 'D' || tf === '1D') return 24 * 60 * 60 * 1000;
  if (tf === 'W' || tf === '1W') return 7 * 24 * 60 * 60 * 1000;
  if (tf === 'M' || tf === '1MO') return 30 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

export class UniversalMarketProvider {
  constructor(providerName = 'universal', displayName = 'TradingChart Multi-Asset') {
    this.providerName = providerName;
    this.displayName = displayName;
    this.symbolsCache = null;
    this.ws = null;
    this.subscribers = new Map(); // ticker -> Set<{ timeframe, onBar, currentBar }>
    this.lastBarsCache = new Map(); // `${ticker}_${timeframe}` -> Bar
    this.initWebSocket();
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
            const subs = this.subscribers.get(msg.symbol);
            if (subs && subs.size > 0) {
              for (const sub of subs) {
                const intervalMs = getIntervalMs(sub.timeframe);
                const bucketTime = Math.floor(msg.time / intervalMs) * intervalMs;
                const cacheKey = `${msg.symbol}_${sub.timeframe}`;
                const cached = this.lastBarsCache.get(cacheKey);

                if (!sub.currentBar || sub.currentBar.time !== bucketTime) {
                  if (cached && (cached.time === bucketTime || Math.abs(cached.time - bucketTime) < intervalMs)) {
                    sub.currentBar = {
                      time: bucketTime,
                      open: cached.open,
                      high: Math.max(cached.high, msg.price),
                      low: Math.min(cached.low, msg.price),
                      close: msg.price,
                      volume: (cached.volume || 1) + 1
                    };
                  } else {
                    sub.currentBar = {
                      time: bucketTime,
                      open: cached ? cached.close : msg.price,
                      high: Math.max(cached ? cached.close : msg.price, msg.price),
                      low: Math.min(cached ? cached.close : msg.price, msg.price),
                      close: msg.price,
                      volume: 1
                    };
                  }
                } else {
                  sub.currentBar.high = Math.max(sub.currentBar.high, msg.price);
                  sub.currentBar.low = Math.min(sub.currentBar.low, msg.price);
                  sub.currentBar.close = msg.price;
                  sub.currentBar.volume += 1;
                }

                this.lastBarsCache.set(cacheKey, { ...sub.currentBar });
                sub.onBar({ ...sub.currentBar });
              }
            }
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

  info() {
    return {
      name: this.providerName,
      displayName: this.displayName,
      requiresApiKey: false,
      supportedTimeframes: SUPPORTED_TIMEFRAMES,
      capabilities: { enumerate: true, stream: true, symbolInfo: true }
    };
  }

  async getBars(ticker, timeframe, range = {}) {
    const clean = ticker.replace(/^.*:/, '').toUpperCase();
    const params = new URLSearchParams();
    params.set('symbol', clean);
    params.set('timeframe', String(timeframe));
    if (range.limit) params.set('limit', String(range.limit));
    if (range.from) params.set('from_time', String(range.from));
    if (range.to) params.set('to_time', String(range.to));

    try {
      const res = await fetch(`/api/candles?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const bars = (data.candles || []).map(b => ({
        time: Number(b.time),
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume || 0)
      }));

      if (bars.length > 0) {
        const last = bars[bars.length - 1];
        const cacheKey = `${clean}_${timeframe}`;
        this.lastBarsCache.set(cacheKey, { ...last });

        const subs = this.subscribers.get(clean);
        if (subs) {
          for (const sub of subs) {
            if (String(sub.timeframe) === String(timeframe)) {
              sub.currentBar = { ...last };
            }
          }
        }
      }

      return bars;
    } catch (e) {
      console.warn(`[UniversalProvider] Error fetching ${ticker} ${timeframe}:`, e.message);
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
    if (clean.includes('XAU')) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23e5a93c"/><text x="16" y="21" font-family="sans-serif" font-weight="900" font-size="14" fill="%23fff" text-anchor="middle">Au</text></svg>';
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
