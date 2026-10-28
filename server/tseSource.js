// server/tseSource.js
// Tehran Stock Exchange (TSETMC / IFB) gated source adapter
// Supports:
// 1. BrsApi.ir via env TC_BRSAPI_KEY
// 2. Iran-IP relay via env TC_TSETMC_PROXY
// Health probing with strict gating: unless a source is configured and healthy,
// iran_tse symbols, category, tape view, and routes remain completely disabled (FR-007).

class TseSource {
  constructor() {
    this.healthy = false;
    this.mode = null; // 'brsapi' | 'tsetmc_proxy' | null
    this.lastProbeTime = 0;
    this.lastProbeError = null;
    this.symbolsCache = [];
    this.cacheTimestamp = 0;

    // Periodic health probe
    this.probeTimer = setInterval(() => {
      this.probeHealth().catch(() => {});
    }, 60000);
    if (this.probeTimer?.unref) this.probeTimer.unref();

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
        const res = await fetch(`https://api.brsapi.ir/v2/tsetmc/stock/all?apiKey=${encodeURIComponent(key)}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          this.healthy = true;
          this.mode = 'brsapi';
          this.lastProbeError = null;
          return true;
        } else {
          this.lastProbeError = `brsapi_error_${res.status}`;
        }
      } catch (err) {
        this.lastProbeError = `brsapi_probe_failed: ${err.message}`;
      }
    }

    this.healthy = false;
    this.mode = null;
    return false;
  }

  async getTseSymbols() {
    if (!this.isTseEnabled()) return [];

    if (this.symbolsCache.length > 0 && Date.now() - this.cacheTimestamp < 3600000) {
      return this.symbolsCache;
    }

    // When healthy source exists, fetch and map TSE symbols
    try {
      if (this.mode === 'tsetmc_proxy') {
        const proxyUrl = String(process.env.TC_TSETMC_PROXY).trim().replace(/\/+$/, '');
        const res = await fetch(`${proxyUrl}/tsetmc/symbols`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            this.symbolsCache = list.map(item => ({
              symbol: `TSE:${item.symbol}`,
              name: item.name || item.symbol,
              nameFa: item.nameFa || item.name || item.symbol,
              exchange: 'TSE',
              type: 'stock',
              category: 'iran_tse',
              currency: 'IRR',
              source: 'tsetmc_proxy',
              dataStatus: 'live',
              delaySec: 0,
              timeframes: ['1', '5', '15', '60', 'D', 'W', 'M'],
              precision: 0,
              minTick: 10,
              lotSize: 1
            }));
            this.cacheTimestamp = Date.now();
            return this.symbolsCache;
          }
        }
      } else if (this.mode === 'brsapi') {
        const key = String(process.env.TC_BRSAPI_KEY).trim();
        const res = await fetch(`https://api.brsapi.ir/v2/tsetmc/stock/all?apiKey=${encodeURIComponent(key)}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            this.symbolsCache = list.map(item => ({
              symbol: `TSE:${item.l18 || item.symbol}`,
              name: item.title || item.l18 || item.symbol,
              nameFa: item.name || item.title || item.symbol,
              exchange: 'TSE',
              type: 'stock',
              category: 'iran_tse',
              currency: 'IRR',
              source: 'brsapi',
              dataStatus: 'delayed',
              delaySec: 900,
              timeframes: ['D', 'W', 'M'],
              precision: 0,
              minTick: 10,
              lotSize: 1
            }));
            this.cacheTimestamp = Date.now();
            return this.symbolsCache;
          }
        }
      }
    } catch (e) {
      // return cached or empty
    }

    return this.symbolsCache;
  }

  async getCandles(symbol, tfParsed, limit = 500, fromTime = null, toTime = null) {
    if (!this.isTseEnabled()) {
      const err = new Error('tse_unavailable');
      err.code = 'TSE_UNAVAILABLE';
      throw err;
    }
    // Implement downstream fetching when provider is configured
    const err = new Error('tse_unavailable');
    err.code = 'TSE_UNAVAILABLE';
    throw err;
  }

  async getTicker(symbol) {
    if (!this.isTseEnabled()) {
      return { unknown: true, symbol };
    }
    return { unknown: true, symbol };
  }

  async getTape(symbol) {
    if (!this.isTseEnabled()) {
      const err = new Error('tse_unavailable');
      err.code = 'TSE_UNAVAILABLE';
      throw err;
    }
    // Return real tape when enabled
    return {
      symbol,
      trades: [],
      timestamp: Date.now()
    };
  }
}

export const tseSource = new TseSource();
