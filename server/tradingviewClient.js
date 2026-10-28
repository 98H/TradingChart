// server/tradingviewClient.js
// Shared server-side TradingView WebSocket client and connection pool.
// Handles socket framing, heartbeat echoes, pooled sessions, backoff reconnects,
// symbol resolution, rate-limited bar paging, quotes and live tick streaming.

import WebSocket from 'ws';
import { CostLruCache } from './lru.js';
import { parseTimeframe, aggregate } from './timeframes.js';

const TV_WS_URL = 'wss://data.tradingview.com/socket.io/websocket?type=chart';
const AUTH_TOKEN = 'unauthorized_user_token';
const MAX_SERIES_PER_SOCKET = Number(process.env.TC_TV_MAX_SERIES_PER_SOCKET || 50);
const MAX_RATE_PER_SEC = Number(process.env.TC_TV_RATE || 10);
const RATE_INTERVAL_MS = Math.max(50, Math.ceil(1000 / MAX_RATE_PER_SEC));

export function getMinTickDecimals(minTick, fallbackPrecision = 2) {
  if (typeof minTick === 'number' && Number.isFinite(minTick)) {
    const s = String(minTick);
    if (s.includes('e-')) {
      const parts = s.split('e-');
      return parseInt(parts[1], 10);
    }
    if (s.includes('.')) {
      return s.split('.')[1].length;
    }
    return 0;
  }
  return typeof fallbackPrecision === 'number' ? fallbackPrecision : 2;
}

export function roundToTick(val, decimals) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return val;
  return Number(val.toFixed(decimals));
}

// Standard TradingView chart resolutions supported natively on free tier
const NATIVE_TV_RESOLUTIONS = new Set([
  '1', '3', '5', '15', '30', '45', '60', '120', '180', '240',
  'D', '1D', 'W', '1W', 'M', '1M'
]);

function formatMessage(m, p) {
  const jsonStr = JSON.stringify({ m, p });
  return `~m~${jsonStr.length}~m~${jsonStr}`;
}

function parseFramedBuffer(buffer) {
  const msgs = [];
  let remaining = buffer;

  while (remaining.length > 0) {
    if (remaining.startsWith('~h~')) {
      const match = remaining.match(/^~h~\d+/);
      if (match) {
        const raw = `~m~${match[0].length}~m~${match[0]}`;
        msgs.push({ type: 'heartbeat', raw });
        remaining = remaining.slice(match[0].length);
        continue;
      }
      break;
    }

    const match = remaining.match(/^~m~(\d+)~m~/);
    if (!match) break;

    const len = parseInt(match[1], 10);
    const headLen = match[0].length;
    if (remaining.length < headLen + len) break;

    const bodyStr = remaining.slice(headLen, headLen + len);
    remaining = remaining.slice(headLen + len);

    if (bodyStr.startsWith('~h~')) {
      const raw = `~m~${bodyStr.length}~m~${bodyStr}`;
      msgs.push({ type: 'heartbeat', raw });
      continue;
    }

    try {
      const json = JSON.parse(bodyStr);
      msgs.push({ type: 'data', json });
    } catch (e) {
      // Ignore malformed JSON chunks
    }
  }

  return { msgs, remaining };
}


class TVSocket {
  constructor(pool, id) {
    this.pool = pool;
    this.id = id;
    this.ws = null;
    this.connected = false;
    this.isConnecting = false;
    this.buffer = '';
    this.activeSeriesCount = 0;
    this.backoffMs = 1000;
    this.reconnectTimer = null;
    this.qsId = `qs_${this.id}`;
    this.subscribedQuotes = new Set();
    this.pendingHandlers = new Map(); // csId -> handler
    this.outgoingQueue = [];
  }

  connect() {
    if (this.connected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(TV_WS_URL, {
        headers: {
          Origin: 'https://www.tradingview.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.connected = true;
      this.isConnecting = false;
      this.backoffMs = 1000;

      // 1. Authenticate with unauthorized_user_token
      this.ws.send(formatMessage('set_auth_token', [AUTH_TOKEN]));

      // 2. Initialize persistent quote session
      this.ws.send(formatMessage('quote_create_session', [this.qsId]));
      this.ws.send(formatMessage('quote_set_fields', [
        this.qsId,
        'lp', 'ch', 'chp', 'high_price', 'low_price', 'volume', 'lp_time', 'update_mode', 'short_name'
      ]));

      // Re-subscribe existing quotes on reconnect
      if (this.subscribedQuotes.size > 0) {
        this.ws.send(formatMessage('quote_add_symbols', [this.qsId, ...this.subscribedQuotes]));
      }

      // Flush queued messages
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift();
        this.ws.send(formatMessage(item.m, item.p));
      }
    });

    this.ws.on('message', (data) => {
      this.handleIncoming(data.toString());
    });

    this.ws.on('error', () => {
      // Error handled via close
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.isConnecting = false;
      this.outgoingQueue = [];
      const err = new Error('socket_closed');
      for (const [csId, handler] of this.pendingHandlers.entries()) {
        try {
          handler.onCriticalError?.(err);
        } catch (e) {}
      }
      this.pendingHandlers.clear();
      this.activeSeriesCount = 0;
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoffMs = Math.min(60000, this.backoffMs * 2);
      this.connect();
    }, this.backoffMs);
  }

  sendRaw(m, p) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.outgoingQueue.push({ m, p });
      if (!this.isConnecting && !this.connected) {
        this.connect();
      }
      return false;
    }
    this.ws.send(formatMessage(m, p));
    return true;
  }

  handleIncoming(text) {
    this.buffer += text;
    const { msgs, remaining } = parseFramedBuffer(this.buffer);
    this.buffer = remaining;

    for (const msg of msgs) {
      if (msg.type === 'heartbeat') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(msg.raw);
        }
        continue;
      }

      if (msg.type === 'data' && msg.json) {
        this.dispatchData(msg.json);
      }
    }
  }

  dispatchData(json) {
    const { m, p } = json;
    if (!m || !Array.isArray(p)) return;

    // Handle Quote Session updates (qsd)
    if (m === 'qsd') {
      const payload = p[1];
      if (payload && payload.n) {
        this.pool.onQuoteUpdate(payload.n, payload);
      }
      return;
    }

    // Chart Session messages
    const csId = p[0];
    const handler = this.pendingHandlers.get(csId);
    if (!handler) return;

    if (m === 'symbol_resolved') {
      handler.onSymbolResolved?.(p[2]);
    } else if (m === 'symbol_error') {
      handler.onSymbolError?.(p[2]);
    } else if (m === 'timescale_update') {
      handler.onTimescaleUpdate?.(p[1]);
    } else if (m === 'du') {
      handler.onDu?.(p[1]);
    } else if (m === 'series_completed') {
      handler.onSeriesCompleted?.(p);
    } else if (m === 'series_error') {
      handler.onSeriesError?.(p);
    } else if (m === 'critical_error') {
      handler.onCriticalError?.(p);
    }
  }

  ensureQuote(symbol) {
    if (!this.subscribedQuotes.has(symbol)) {
      this.subscribedQuotes.add(symbol);
      if (this.connected) {
        this.sendRaw('quote_add_symbols', [this.qsId, symbol]);
      }
    }
  }
}

export class TradingViewClient {
  constructor() {
    this.sockets = [];
    this.seq = 0;
    // LRU caches
    this.metaCache = new CostLruCache(5000);
    this.quotes = new CostLruCache(5000);
    this.barsCache = new CostLruCache(150000);
    this.lastGoodCache = new CostLruCache(150000);

    this.quoteListeners = new Map();
    this.liveTickListeners = new Set();
    this.rateQueue = [];
    this.rateTimer = null;
    this.inFlightResolves = new Map();

    // Initial socket
    this.getOrAllocSocket();
    this.startRateLimiter();
  }

  getOrAllocSocket() {
    for (const s of this.sockets) {
      if (s.activeSeriesCount < MAX_SERIES_PER_SOCKET) {
        if (!s.connected && !s.isConnecting) s.connect();
        return s;
      }
    }
    const newSocket = new TVSocket(this, `s_${this.sockets.length + 1}`);
    this.sockets.push(newSocket);
    newSocket.connect();
    return newSocket;
  }

  startRateLimiter() {
    if (this.rateTimer) return;
    this.rateTimer = setInterval(() => {
      if (this.rateQueue.length > 0) {
        const task = this.rateQueue.shift();
        try { task(); } catch (e) {}
      }
    }, RATE_INTERVAL_MS);
    if (this.rateTimer.unref) this.rateTimer.unref();
  }

  scheduleSeriesTask(taskFn) {
    return new Promise((resolve, reject) => {
      this.rateQueue.push(() => {
        try {
          taskFn().then(resolve).catch(reject);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  onQuoteUpdate(symbol, payload) {
    const status = payload.s;
    if (status === 'ok' && payload.v) {
      const prev = this.quotes.get(symbol) || {};
      const updated = {
        ...prev,
        ...payload.v,
        symbol,
        lastPrice: payload.v.lp !== undefined ? Number(payload.v.lp) : prev.lastPrice,
        priceChange: payload.v.ch !== undefined ? Number(payload.v.ch) : prev.priceChange,
        priceChangePercent: payload.v.chp !== undefined ? Number(payload.v.chp) : prev.priceChangePercent,
        highPrice: payload.v.high_price !== undefined ? Number(payload.v.high_price) : prev.highPrice,
        lowPrice: payload.v.low_price !== undefined ? Number(payload.v.low_price) : prev.lowPrice,
        volume: payload.v.volume !== undefined ? Number(payload.v.volume) : prev.volume,
        time: payload.v.lp_time ? payload.v.lp_time * 1000 : (prev.time || Date.now())
      };
      this.quotes.set(symbol, updated);

      // Notify quote callbacks
      const listeners = this.quoteListeners.get(symbol);
      if (listeners) {
        for (const cb of listeners) cb(updated);
      }

      // Notify live tick subscribers
      if (updated.lastPrice !== undefined) {
        const tick = {
          symbol,
          price: updated.lastPrice,
          change: updated.priceChange || 0,
          changePct: updated.priceChangePercent || 0,
          high: updated.highPrice || updated.lastPrice,
          low: updated.lowPrice || updated.lastPrice,
          volume: updated.volume || 0,
          time: updated.time || Date.now()
        };
        for (const cb of this.liveTickListeners) cb(tick);
      }
    } else if (status === 'error') {
      const errObj = { symbol, error: payload.errmsg || 'unknown_symbol' };
      this.quotes.set(symbol, errObj);
      const listeners = this.quoteListeners.get(symbol);
      if (listeners) {
        for (const cb of listeners) cb(errObj);
      }
    }
  }

  onLiveTick(cb) {
    this.liveTickListeners.add(cb);
    return () => this.liveTickListeners.delete(cb);
  }

  /**
   * Resolves symbol metadata via TradingView public socket (cached 24h)
   */
  async resolve(symbol) {
    const cleanSym = String(symbol || '').trim();
    if (!cleanSym) throw new Error('invalid_symbol');

    if (this.metaCache.has(cleanSym)) {
      return this.metaCache.get(cleanSym);
    }

    if (this.inFlightResolves.has(cleanSym)) {
      return this.inFlightResolves.get(cleanSym);
    }

    const socket = this.getOrAllocSocket();
    const csId = `cs_res_${++this.seq}`;
    const symId = `sym_res_${this.seq}`;

    const resolvePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.pendingHandlers.delete(csId);
        socket.sendRaw('chart_delete_session', [csId]);
        const timeoutErr = new Error(`Timeout resolving symbol ${cleanSym}`);
        timeoutErr.code = 'RESOLVE_TIMEOUT';
        reject(timeoutErr);
      }, 6000);

      socket.pendingHandlers.set(csId, {
        onSymbolResolved: (info) => {
          clearTimeout(timer);
          socket.pendingHandlers.delete(csId);
          socket.sendRaw('chart_delete_session', [csId]);

          const delaySec = typeof info.delay === 'number' ? info.delay : 0;
          const prefix = cleanSym.includes(':') ? cleanSym.split(':')[0] : '';
          const exchange = prefix || info.listed_exchange || info.exchange || (info.source2 && info.source2.id) || '';
          const pricescale = info.pricescale || 100;
          const minmov = info.minmov || 1;
          const minTick = minmov / pricescale;
          const minTickStr = String(minTick);
          let precision = 2;
          if (minTickStr.includes('.')) {
            precision = minTickStr.split('.')[1].length;
          } else if (Number.isFinite(pricescale) && pricescale > 0) {
            precision = Math.max(0, Math.round(Math.log10(pricescale)));
          }
          const isEod = Array.isArray(info.params) && info.params.includes('eod');
          const dataStatus = isEod ? 'eod' : (delaySec > 0 ? 'delayed' : 'live');

          const meta = {
            symbol: cleanSym,
            name: info.name || cleanSym.replace(/^.*:/, ''),
            exchange,
            listed_exchange: info.listed_exchange || exchange,
            type: info.type || 'forex',
            delaySec,
            dataStatus,
            pricescale,
            minmov,
            minTick,
            precision
          };
          this.metaCache.set(cleanSym, meta, 1, 24 * 60 * 60 * 1000);
          resolve(meta);
        },
        onSymbolError: (err) => {
          clearTimeout(timer);
          socket.pendingHandlers.delete(csId);
          socket.sendRaw('chart_delete_session', [csId]);
          const error = new Error('unknown_symbol');
          error.code = 'UNKNOWN_SYMBOL';
          error.details = err;
          reject(error);
        },
        onCriticalError: (err) => {
          clearTimeout(timer);
          socket.pendingHandlers.delete(csId);
          socket.sendRaw('chart_delete_session', [csId]);
          reject(err);
        }
      });

      if (!socket.connected && !socket.isConnecting) {
        socket.connect();
      }
      socket.sendRaw('chart_create_session', [csId, '']);
      socket.sendRaw('resolve_symbol', [
        csId,
        symId,
        '=' + JSON.stringify({ symbol: cleanSym, adjustment: 'splits', session: 'regular' })
      ]);
    }).finally(() => {
      this.inFlightResolves.delete(cleanSym);
    });

    this.inFlightResolves.set(cleanSym, resolvePromise);
    return resolvePromise;
  }

  /**
   * Ensure quote streaming is active for a symbol on the underlying socket
   */
  ensureQuote(symbol) {
    const cleanSym = String(symbol || '').trim();
    if (!cleanSym) return;
    const socket = this.getOrAllocSocket();
    socket.ensureQuote(cleanSym);
  }

  /**
   * Subscribe to live quote updates for a symbol
   */
  subscribe(symbol, callback = null) {
    const cleanSym = String(symbol || '').trim();
    if (callback) {
      let listeners = this.quoteListeners.get(cleanSym);
      if (!listeners) {
        listeners = new Set();
        this.quoteListeners.set(cleanSym, listeners);
      }
      listeners.add(callback);
    }

    const socket = this.getOrAllocSocket();
    socket.ensureQuote(cleanSym);

    // If we already have a cached quote, emit immediately
    if (callback) {
      const cached = this.quotes.get(cleanSym);
      if (cached && !cached.error && cached.lastPrice !== undefined) {
        callback(cached);
      }
    }

    return () => {
      if (callback) {
        const list = this.quoteListeners.get(cleanSym);
        if (list) list.delete(callback);
      }
    };
  }

  /**
   * Fetch current 24hr quote for a symbol
   */
  async getQuote(symbol, timeoutMs = 4000) {
    const cleanSym = String(symbol || '').trim();
    if (!cleanSym) throw new Error('invalid_symbol');

    const cached = this.quotes.get(cleanSym);
    if (cached && !cached.error && typeof cached.lastPrice === 'number') {
      const meta = this.metaCache.get(cleanSym) || await this.resolve(cleanSym).catch(() => ({}));
      return {
        symbol: cleanSym,
        lastPrice: cached.lastPrice,
        priceChange: cached.priceChange || 0,
        priceChangePercent: cached.priceChangePercent || 0,
        highPrice: cached.highPrice || cached.lastPrice,
        lowPrice: cached.lowPrice || cached.lastPrice,
        volume: cached.volume || 0,
        exchange: meta.exchange || cleanSym.split(':')[0] || 'TradingView',
        category: meta.type || 'forex',
        currency: 'USD',
        source: 'tradingview',
        dataStatus: (meta.delaySec || 0) > 0 ? 'delayed' : 'live',
        delaySec: meta.delaySec || 0,
        time: cached.time || Date.now()
      };
    }

    const socket = this.getOrAllocSocket();
    socket.ensureQuote(cleanSym);

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          unsub();
          const q = this.quotes.get(cleanSym);
          if (q && !q.error && typeof q.lastPrice === 'number') {
            resolveQuote(q);
          } else {
            reject(new Error(`Timeout getting quote for ${cleanSym}`));
          }
        }
      }, timeoutMs);

      const resolveQuote = async (q) => {
        const meta = this.metaCache.get(cleanSym) || await this.resolve(cleanSym).catch(() => ({}));
        resolve({
          symbol: cleanSym,
          lastPrice: q.lastPrice,
          priceChange: q.priceChange || 0,
          priceChangePercent: q.priceChangePercent || 0,
          highPrice: q.highPrice || q.lastPrice,
          lowPrice: q.lowPrice || q.lastPrice,
          volume: q.volume || 0,
          exchange: meta.exchange || cleanSym.split(':')[0] || 'TradingView',
          category: meta.type || 'forex',
          currency: 'USD',
          source: 'tradingview',
          dataStatus: (meta.delaySec || 0) > 0 ? 'delayed' : 'live',
          delaySec: meta.delaySec || 0,
          time: q.time || Date.now()
        });
      };

      const unsub = this.subscribe(cleanSym, (data) => {
        if (!settled) {
          if (data.error) {
            settled = true;
            clearTimeout(timer);
            unsub();
            reject(new Error(data.error));
          } else if (typeof data.lastPrice === 'number') {
            settled = true;
            clearTimeout(timer);
            unsub();
            resolveQuote(data);
          }
        }
      });
    });
  }

  /**
   * Fetch historical candles for a symbol and resolution with paging and LRU caching
   */
  async getBars(symbol, resolution, { limit = 500, from = null, to = null } = {}, attempt = 1) {
    try {
      return await this._getBarsInternal(symbol, resolution, { limit, from, to });
    } catch (err) {
      if (attempt < 2 && err.code !== 'UNKNOWN_SYMBOL' && !String(err.message).toLowerCase().includes('unknown_symbol') && !String(err.message).toLowerCase().includes('invalid')) {
        return this.getBars(symbol, resolution, { limit, from, to }, attempt + 1);
      }
      throw err;
    }
  }

  async _getBarsInternal(symbol, resolution, { limit = 500, from = null, to = null } = {}) {
    const cleanSym = String(symbol || '').trim();
    if (!cleanSym) throw new Error('invalid_symbol');

    const tfParsed = typeof resolution === 'object' && resolution !== null && resolution.canonical
      ? resolution
      : parseTimeframe(resolution);
    if (!tfParsed) throw new Error('invalid_timeframe');

    const canonical = tfParsed.canonical;
    const reqLimit = Math.max(1, Math.min(limit, 5000));

    // 1. Seconds timeframes (e.g. 1s): TradingView unauthorized token does not entitle seconds.
    // Return empty candles without inventing synthetic prices (Constitution Principle I).
    if (tfParsed.unit === 's') {
      const meta = this.metaCache.get(cleanSym) || await this.resolve(cleanSym).catch(() => ({}));
      return {
        symbol: cleanSym,
        timeframe: canonical,
        exchange: meta?.exchange || cleanSym.split(':')[0] || 'TradingView',
        delaySec: meta?.delaySec || 0,
        source: 'tradingview',
        candles: []
      };
    }

    // 2. Custom multi-unit timeframes (e.g. 3D, 2W) not native on TradingView
    // Fetch base resolution and aggregate
    if (!NATIVE_TV_RESOLUTIONS.has(canonical)) {
      let baseResolution = '1';
      let factor = 1;
      if (tfParsed.unit === 'D') {
        baseResolution = 'D';
        factor = tfParsed.count;
      } else if (tfParsed.unit === 'W') {
        baseResolution = 'W';
        factor = tfParsed.count;
      } else if (tfParsed.unit === 'M') {
        baseResolution = 'M';
        factor = tfParsed.count;
      } else if (tfParsed.unit === 'm') {
        baseResolution = '1';
        factor = tfParsed.count;
      }

      const baseLimit = Math.min(5000, Math.ceil((reqLimit + 5) * factor));
      const baseResult = await this.getBars(cleanSym, baseResolution, {
        limit: baseLimit,
        from: from !== null ? from - (tfParsed.intervalMs * 2) : null,
        to
      });

      const aggregated = aggregate(baseResult.candles, tfParsed, { dropPartialOldest: true });
      let filtered = aggregated;
      if (from !== null) filtered = filtered.filter(b => b.time >= from);
      if (to !== null) filtered = filtered.filter(b => b.time <= to);
      const dec = getMinTickDecimals(baseResult.minTick, baseResult.precision);
      const sliced = filtered.slice(-reqLimit).map(b => ({
        time: b.time,
        open: roundToTick(b.open, dec),
        high: roundToTick(b.high, dec),
        low: roundToTick(b.low, dec),
        close: roundToTick(b.close, dec),
        volume: b.volume
      }));

      return {
        symbol: cleanSym,
        timeframe: canonical,
        exchange: baseResult.exchange,
        delaySec: baseResult.delaySec,
        source: baseResult.source,
        minTick: baseResult.minTick,
        precision: baseResult.precision,
        candles: sliced
      };
    }

    // 3. Native resolution: rate-limit and fetch via socket
    return this.scheduleSeriesTask(async () => {
      const cacheKey = `tv_bars:${cleanSym}:${canonical}:${reqLimit}:${from || 0}:${to || 0}`;
      const lastGoodKey = `tv_last_good:${cleanSym}:${canonical}`;

      const cached = this.barsCache.get(cacheKey);
      if (cached && Array.isArray(cached.candles) && cached.candles.length >= reqLimit) {
        return cached;
      }

      const socket = this.getOrAllocSocket();
      socket.activeSeriesCount++;

      const csId = `cs_bars_${++this.seq}`;
      const symId = `sym_bars_${this.seq}`;
      const seriesId = `sds_${this.seq}`;

      let tvResolution = canonical;
      if (canonical === '60') tvResolution = '60';
      else if (canonical === '1d' || canonical === 'D') tvResolution = 'D';
      else if (canonical === '1w' || canonical === 'W') tvResolution = 'W';
      else if (canonical === '1M' || canonical === 'M') tvResolution = 'M';

      return new Promise((resolve, reject) => {
        let meta = null;
        const rawBars = new Map();
        let pagesPaging = 0;
        const maxPages = 15;

        const cleanup = () => {
          socket.activeSeriesCount = Math.max(0, socket.activeSeriesCount - 1);
          socket.pendingHandlers.delete(csId);
          socket.sendRaw('chart_delete_session', [csId]);
        };

        const timer = setTimeout(() => {
          cleanup();
          const lastGood = this.lastGoodCache.get(lastGoodKey);
          if (lastGood && lastGood.candles?.length > 0) {
            let filtered = lastGood.candles;
            if (from !== null) filtered = filtered.filter(b => b.time >= from);
            if (to !== null) filtered = filtered.filter(b => b.time <= to);
            return resolve({
              symbol: cleanSym,
              timeframe: canonical,
              exchange: lastGood.exchange,
              delaySec: lastGood.delaySec,
              source: 'cache',
              candles: filtered.slice(-reqLimit)
            });
          }
          reject(new Error(`Timeout fetching bars for ${cleanSym} (${canonical})`));
        }, 12000);

        socket.pendingHandlers.set(csId, {
          onSymbolResolved: (info) => {
            const delaySec = typeof info.delay === 'number' ? info.delay : 0;
            const prefix = cleanSym.includes(':') ? cleanSym.split(':')[0] : '';
            const exchange = prefix || info.listed_exchange || info.exchange || (info.source2 && info.source2.id) || '';
            const pricescale = info.pricescale || 100;
            const minmov = info.minmov || 1;
            const minTick = minmov / pricescale;
            const minTickStr = String(minTick);
            let precision = 2;
            if (minTickStr.includes('.')) {
              precision = minTickStr.split('.')[1].length;
            } else if (Number.isFinite(pricescale) && pricescale > 0) {
              precision = Math.max(0, Math.round(Math.log10(pricescale)));
            }
            const isEod = Array.isArray(info.params) && info.params.includes('eod');
            const dataStatus = isEod ? 'eod' : (delaySec > 0 ? 'delayed' : 'live');
            meta = {
              symbol: cleanSym,
              name: info.name,
              exchange,
              delaySec,
              dataStatus,
              pricescale,
              minmov,
              minTick,
              precision
            };
            this.metaCache.set(cleanSym, meta, 1, 24 * 60 * 60 * 1000);

            const initialCount = Math.max(reqLimit, 50);
            socket.sendRaw('create_series', [csId, seriesId, 's1', symId, tvResolution, initialCount, '']);
          },

          onSymbolError: (err) => {
            clearTimeout(timer);
            cleanup();
            const error = new Error('unknown_symbol');
            error.code = 'UNKNOWN_SYMBOL';
            error.details = err;
            reject(error);
          },

          onTimescaleUpdate: (data) => {
            const seriesData = data?.[seriesId]?.s;
            if (Array.isArray(seriesData)) {
              for (const bar of seriesData) {
                const tSec = bar.v[0];
                rawBars.set(tSec, {
                  time: tSec * 1000,
                  open: Number(bar.v[1]),
                  high: Number(bar.v[2]),
                  low: Number(bar.v[3]),
                  close: Number(bar.v[4]),
                  volume: Number(bar.v[5] || 0)
                });
              }
            }
          },

          onDu: (data) => {
            // Live series update
            const seriesData = data?.[seriesId]?.s;
            if (Array.isArray(seriesData)) {
              for (const bar of seriesData) {
                const tSec = bar.v[0];
                rawBars.set(tSec, {
                  time: tSec * 1000,
                  open: Number(bar.v[1]),
                  high: Number(bar.v[2]),
                  low: Number(bar.v[3]),
                  close: Number(bar.v[4]),
                  volume: Number(bar.v[5] || 0)
                });
              }
            }
          },

          onSeriesCompleted: () => {
            pagesPaging++;
            const sorted = Array.from(rawBars.values()).sort((a, b) => a.time - b.time);

            // If to_time specified and oldest bar is still newer than to_time, request more older data
            if (to !== null && sorted.length > 0 && sorted[0].time > to && pagesPaging < maxPages) {
              socket.sendRaw('request_more_data', [csId, seriesId, Math.max(reqLimit, 50)]);
              return;
            }

            clearTimeout(timer);
            cleanup();

            let filtered = sorted;
            if (from !== null) filtered = filtered.filter(b => b.time >= from);
            if (to !== null) filtered = filtered.filter(b => b.time <= to);

            const dec = getMinTickDecimals(meta?.minTick, meta?.precision);
            const sliced = filtered.slice(-reqLimit).map(b => ({
              time: b.time,
              open: roundToTick(b.open, dec),
              high: roundToTick(b.high, dec),
              low: roundToTick(b.low, dec),
              close: roundToTick(b.close, dec),
              volume: b.volume
            }));
            const result = {
              symbol: cleanSym,
              timeframe: canonical,
              exchange: meta?.exchange || cleanSym.split(':')[0] || 'TradingView',
              delaySec: meta?.delaySec || 0,
              source: 'tradingview',
              minTick: meta?.minTick,
              precision: meta?.precision,
              candles: sliced
            };

            this.barsCache.set(cacheKey, result, sliced.length, 3000);
            this.lastGoodCache.set(lastGoodKey, {
              ...result,
              candles: sorted
            }, sorted.length, 24 * 60 * 60 * 1000);

            resolve(result);
          },

          onSeriesError: (err) => {
            clearTimeout(timer);
            cleanup();
            reject(new Error(`Series error for ${cleanSym}: ${JSON.stringify(err)}`));
          },

          onCriticalError: (err) => {
            clearTimeout(timer);
            cleanup();
            reject(new Error(`Critical error for ${cleanSym}: ${JSON.stringify(err)}`));
          }
        });

        if (!socket.connected) {
          socket.connect();
        }
        socket.sendRaw('chart_create_session', [csId, '']);
        socket.sendRaw('resolve_symbol', [
          csId,
          symId,
          '=' + JSON.stringify({ symbol: cleanSym, adjustment: 'splits', session: 'regular' })
        ]);
      });
    });
  }
}

export const tvClient = new TradingViewClient();
export default tvClient;