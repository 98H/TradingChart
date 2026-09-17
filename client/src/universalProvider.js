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

                if (!sub.currentBar || sub.currentBar.time !== bucketTime) {
                  sub.currentBar = {
                    time: bucketTime,
                    open: msg.price,
                    high: msg.price,
                    low: msg.price,
                    close: msg.price,
                    volume: 1
                  };
                } else {
                  sub.currentBar.high = Math.max(sub.currentBar.high, msg.price);
                  sub.currentBar.low = Math.min(sub.currentBar.low, msg.price);
                  sub.currentBar.close = msg.price;
                  sub.currentBar.volume += 1;
                }

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
      return (data.candles || []).map(b => ({
        time: Number(b.time),
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume || 0)
      }));
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
    const clean = symbol.replace(/^.*:/, '').toUpperCase();
    if (clean.includes('BTC')) return 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
    if (clean.includes('ETH')) return 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
    if (clean.includes('SOL')) return 'https://assets.coingecko.com/coins/images/4128/small/solana.png';
    if (clean.includes('XAU')) return 'https://cdn-icons-png.flaticon.com/512/2534/2534204.png';
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

    const sub = { timeframe, onBar, currentBar: null };
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
