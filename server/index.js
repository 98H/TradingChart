// server/index.js
// Production Express & WebSocket Server for TradingChart (Port 8088)

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCandles, get24hTicker, getGoldMarketSnapshot, getTseMarketTape, getMarketSourceStatus, isKnownSymbol, resolveSymbolId } from './dataFeed.js';
import { parseTimeframe } from './timeframes.js';
import { searchSymbols, getSymbolMeta } from './symbolCatalog.js';
import { CONGRESSIONAL_TRADES, INSIDER_TRADES, HEDGE_FUND_13F, FINRA_SHORT_VOLUME } from './marketTrackers.js';
import { ECONOMIC_EVENTS, getEconomicEvents } from './economicCalendar.js';
import { getScreenerData } from './technicalScreener.js';
import { getOrderBookDepth } from './depthFeed.js';
import { getMarketNews } from './newsFeed.js';
import { mountAccountSystem, PLANS, effectivePlanId } from './accounts.js';
import { securityHeaders, sameOriginWrites, apiRateLimit, clampInt, optTimestamp, serverError } from './security.js';
import { tvClient } from './tradingviewClient.js';

// Preserve EXCHANGE:SYMBOL in cleanSymbol (FR-002, FR-003)
const SYMBOL_RE = /^[A-Z0-9_]{1,16}:[A-Z0-9._\-]{1,32}$|^[A-Z0-9._\-]{1,32}$/;
export function cleanSymbol(raw, fallback = null) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const s = String(raw).trim().toUpperCase();
  return SYMBOL_RE.test(s) ? s : fallback;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8088;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/live', maxPayload: 4096 });

// Behind a reverse proxy (Caddy/Cloudflare) on loopback: trust only the local
// hop so req.ip / req.secure reflect the real client, never a spoofed header.
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
// Canonical host: www.chartivia.com, chartivia.ir, www.chartivia.ir → chartivia.com (301, path preserved).
app.use((req, res, next) => {
  const h = String(req.headers.host || '').toLowerCase();
  if (h === 'www.chartivia.com' || h === 'chartivia.ir' || h === 'www.chartivia.ir' || h.endsWith('.chartivia.ir')) {
    return res.redirect(301, `https://chartivia.com${req.originalUrl}`);
  }
  next();
});
app.use(securityHeaders);
// Same-origin app: CORS is only opened for read-only public market data.
const PUBLIC_CORS = /^\/api\/(candles|tickers|symbols|symbol-info|news|economic-calendar|screener|depth)$/;
app.use((req, res, next) => (PUBLIC_CORS.test(req.path) && req.method === 'GET') ? cors({ credentials: false })(req, res, next) : next());
app.use(apiRateLimit);
app.use(sameOriginWrites);
app.use(express.json({ limit: '2.5mb' }));

// Account system: auth, plan tiers, per-user cloud state (must mount before static/SPA)
mountAccountSystem(app);

// Serve static frontend files from client / dist
const distPath = path.resolve(__dirname, '../dist');

// Back-office console: separate page + hardened headers (no framing, no
// indexing, no referrer leakage). Its API lives under /api/admin/*.
app.get(/^\/admin(\/.*)?$/, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.resolve(distPath, 'admin', 'index.html'));
});
// TradingView-style layout: / = landing page, /chart = the charting app
// (also /chart/<anything> for future layout ids), /admin = back office.
const sendHtml = file => (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.resolve(distPath, file)); };
app.get(['/chart', /^\/chart\/.*$/], sendHtml('chart/index.html'));
app.get(['/', '/index.html'], sendHtml('index.html'));
// Immutable long-cache for content-hashed assets; revalidate HTML each load.
app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '30d' }));
app.use(express.static(distPath, { setHeaders(res, filePath) { if (filePath.endsWith('.html') || filePath === distPath) res.setHeader('Cache-Control', 'no-cache'); } }));

// ── REST API Endpoints ───────────────────────────────────────────────

// 1. Health Check (public: liveness only — no process internals)
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', product: 'Chartivia', timestamp: new Date().toISOString() });
});

const bad = (res, error) => res.status(400).json({ ok: false, error });

// 2. Historical & Live Candles (plan-gated depth)
app.get('/api/candles', async (req, res) => {
  try {
    const symbol = cleanSymbol(req.query.symbol, 'BTCUSDT');
    if (!symbol) return bad(res, 'invalid_symbol');

    const tfParsed = parseTimeframe(req.query.timeframe || '60');
    if (!tfParsed) return bad(res, 'invalid_timeframe');
    const timeframe = tfParsed.canonical;

    let fromTime = optTimestamp(req.query.from_time);
    let toTime = optTimestamp(req.query.to_time);
    if (fromTime === undefined || toTime === undefined) return bad(res, 'invalid_time');
    if (fromTime !== null && fromTime < 1e11) fromTime *= 1000;
    if (toTime !== null && toTime < 1e11) toTime *= 1000;
    if (fromTime !== null && toTime !== null && fromTime > toTime) return bad(res, 'invalid_time');

    const histCap = req.user
      ? (PLANS[effectivePlanId(req.user)]?.histBars ?? PLANS.basic.histBars)
      : PLANS.basic.histBars;
    const limit = clampInt(req.query.limit, 500, 1, histCap);
    res.setHeader('X-History-Limit', String(histCap));

    const result = await getCandles(symbol, tfParsed, limit, fromTime, toTime);
    const candles = Array.isArray(result) ? result : (result?.candles || []);
    const source = result?.source || 'binance';
    const exchange = result?.exchange || (getSymbolMeta(symbol)?.exchange || 'Binance');
    const delaySec = typeof result?.delaySec === 'number' ? result.delaySec : 0;

    if (candles.length === 0 && !isKnownSymbol(symbol)) {
      return res.status(404).json({ symbol, timeframe, count: 0, candles: [], error: 'no_market_data' });
    }

    res.setHeader('X-Data-Source', source);
    res.json({
      symbol,
      timeframe,
      intervalMs: tfParsed.intervalMs,
      source,
      exchange,
      delaySec,
      count: candles.length,
      candles
    });
  } catch (error) {
    if (error?.code === 'UPSTREAM_UNAVAILABLE' || error?.message === 'upstream_unavailable') {
      return res.status(503).json({ ok: false, error: 'upstream_unavailable' });
    }
    serverError(res, '/api/candles', error);
  }
});

// 3. 24hr Ticker Overview (max 40 symbols per call)
app.get('/api/tickers', async (req, res) => {
  try {
    const raw = String(req.query.symbols || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD');
    const rawSymbols = raw.split(',').map(s => s.trim()).filter(Boolean);
    const symbols = [...new Set(rawSymbols.map(s => cleanSymbol(s)).filter(Boolean))].slice(0, 40);
    if (!symbols.length) return bad(res, 'invalid_symbol');

    const results = await Promise.all(symbols.map(s => get24hTicker(s)));
    const tickers = [];
    const unknown = [];

    for (let i = 0; i < symbols.length; i++) {
      const t = results[i];
      if (t && !t.unknown && typeof t.lastPrice === 'number' && Number.isFinite(t.lastPrice)) {
        tickers.push(t);
      } else {
        unknown.push(symbols[i]);
      }
    }

    if (unknown.length > 0) {
      res.json({ tickers, unknown });
    } else {
      res.json(tickers);
    }
  } catch (error) { serverError(res, '/api/tickers', error); }
});

// 4. Symbol Search & Catalog
app.get('/api/symbols', (req, res) => {
  const query = String(req.query.q || '').slice(0, 64);
  const category = String(req.query.category || 'all').slice(0, 32);
  const exchange = String(req.query.exchange || 'all').slice(0, 32);
  res.json(searchSymbols(query, category, exchange));
});

// 5. Symbol Metadata
app.get('/api/symbol-info', (req, res) => {
  const symbol = cleanSymbol(req.query.symbol, 'BTCUSDT');
  if (!symbol) return bad(res, 'invalid_symbol');
  res.json(getSymbolMeta(symbol));
});

// 5b. Market data sources status
app.get('/api/market-sources', async (req, res) => {
  try { res.json(await getMarketSourceStatus()); } catch (error) { serverError(res, '/api/market-sources', error); }
});

// 5c. Tehran Gold Market & Coin Bubbles
app.get('/api/gold-snapshot', (req, res) => {
  try { res.json(getGoldMarketSnapshot()); } catch (error) { serverError(res, '/api/gold-snapshot', error); }
});

// 5d. Tehran Stock Exchange tape
app.get('/api/tse-tape', (req, res) => {
  try {
    const symbol = cleanSymbol(req.query.symbol, 'FOOLAD');
    if (!symbol) return bad(res, 'invalid_symbol');
    res.json(getTseMarketTape(symbol));
  } catch (error) { serverError(res, '/api/tse-tape', error); }
});

// 6. Market Trackers
app.get('/api/market-trackers', (req, res) => {
  const kind = String(req.query.kind || 'all');
  res.json({
    congressionalTrades: kind === 'all' || kind === 'congress' ? CONGRESSIONAL_TRADES : [],
    insiderTrades: kind === 'all' || kind === 'insider' ? INSIDER_TRADES : [],
    hedgeFund13F: kind === 'all' || kind === '13f' ? HEDGE_FUND_13F : [],
    finraShortVolume: kind === 'all' || kind === 'short_vol' ? FINRA_SHORT_VOLUME : []
  });
});

// 6b. Economic Calendar
app.get('/api/economic-calendar', (req, res) => {
  const s = v => String(v || 'all').slice(0, 32);
  const events = getEconomicEvents({ impact: s(req.query.impact), country: s(req.query.country), category: s(req.query.category) });
  res.json({ total: events.length, events });
});

// 6c. Technical Screener
app.get('/api/screener', async (req, res) => {
  try {
    const s = v => String(v || 'all').slice(0, 32);
    const items = await getScreenerData({ category: s(req.query.category), rating: s(req.query.rating), search: String(req.query.search || '').slice(0, 32) });
    res.json({ total: items.length, items });
  } catch (error) { serverError(res, '/api/screener', error); }
});

// 6d. Depth of Market
app.get('/api/depth', async (req, res) => {
  try {
    const symbol = cleanSymbol(req.query.symbol, 'BTCUSDT');
    if (!symbol) return bad(res, 'invalid_symbol');
    res.json(await getOrderBookDepth(symbol, clampInt(req.query.levels || req.query.limit, 15, 1, 50)));
  } catch (error) { serverError(res, '/api/depth', error); }
});

// 6e. Market News
app.get('/api/news', (req, res) => {
  try {
    const category = String(req.query.category || 'all').slice(0, 32);
    const symbol = req.query.symbol ? cleanSymbol(req.query.symbol) : null;
    const news = getMarketNews({ category, symbol, limit: clampInt(req.query.limit, 20, 1, 100) });
    res.json({ total: news.length, news });
  } catch (error) { serverError(res, '/api/news', error); }
});

// 7. Trade Relay (per-user, authenticated) lives in tradeRelayApi.js.

// Unknown API routes are JSON 404s (never the SPA shell).
app.all('/api/*', (req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// Malformed JSON / oversized bodies → clean JSON errors (no stack traces).
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) return res.status(413).json({ ok: false, error: 'payload_too_large' });
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) return res.status(400).json({ ok: false, error: 'invalid_json' });
  serverError(res, req.path, err);
});

// Unknown pages: real 404 with a link home (no soft-404 SPA fallback).
app.get('*', (req, res) => {
  res.status(404).setHeader('Cache-Control', 'no-cache');
  res.type('html').send(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>صفحه پیدا نشد · Chartivia</title><link rel="icon" href="/favicon.svg"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090e;color:#e6e9f0;font-family:Tahoma,system-ui,sans-serif;text-align:center;padding:24px}a{display:inline-block;margin:8px;padding:12px 20px;border-radius:10px;background:#00F2B0;color:#04121e;font-weight:700;text-decoration:none}a.g{background:transparent;color:#e6e9f0;border:1px solid #1e2738}</style></head><body><main><h1>۴۰۴</h1><p>صفحه‌ای که دنبال آن هستید پیدا نشد. · Page not found.</p><a href="/">صفحه اصلی · Home</a><a class="g" href="/chart">نمودار · Chart</a></main></body></html>`);
});

// ── Live WebSocket Broadcaster ────────────────────────────────────────
const activeSubscriptions = new Map(); // wsClient -> Set<symbol>
const MAX_WS_CLIENTS = Number(process.env.TC_MAX_WS || 2000);

wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_WS_CLIENTS) { ws.close(1013, 'busy'); return; }
  ws.on('error', () => {});
  activeSubscriptions.set(ws, new Set(['BTCUSDT']));

  ws.on('message', async (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);
      const isSub = msg.action === 'subscribe' || msg.type === 'subscribe';
      const isUnsub = msg.action === 'unsubscribe' || msg.type === 'unsubscribe';

      if (isSub && msg.symbol) {
        const rawSym = String(msg.symbol || '').trim();
        const sym = cleanSymbol(rawSym);
        if (!sym || !isKnownSymbol(sym)) {
          ws.send(JSON.stringify({ type: 'error', error: 'unknown_symbol', symbol: msg.symbol }));
          return;
        }

        const subs = activeSubscriptions.get(ws) || new Set();
        if (subs.size >= 50 && !subs.has(sym)) return;
        subs.add(sym);
        activeSubscriptions.set(ws, subs);

        // Immediate tick push
        get24hTicker(sym).then(ticker => {
          if (ticker && !ticker.unknown && ws.readyState === WebSocket.OPEN && subs.has(sym)) {
            ws.send(JSON.stringify({
              type: 'tick',
              symbol: sym,
              price: ticker.lastPrice,
              change: ticker.priceChange || 0,
              changePct: ticker.priceChangePercent || 0,
              high: ticker.highPrice || ticker.lastPrice,
              low: ticker.lowPrice || ticker.lastPrice,
              volume: ticker.volume || 0,
              time: ticker.time || Date.now()
            }));
          }
        }).catch(() => {});

        // If TradingView symbol, ensure real-time quote updates are active (ticks broadcasted via tvClient.onLiveTick)
        const resolved = resolveSymbolId(sym);
        if (resolved.includes(':') && !resolved.startsWith('BINANCE:')) {
          tvClient.ensureQuote(resolved);
        }
      } else if (isUnsub && msg.symbol) {
        const subs = activeSubscriptions.get(ws);
        const sym = cleanSymbol(msg.symbol);
        if (subs && sym) subs.delete(sym);
      }
    } catch (e) {
      // ignore malformed
    }
  });

  ws.on('close', () => {
    activeSubscriptions.delete(ws);
  });
});

// Broadcast live ticks pushed from TradingView client
tvClient.onLiveTick((tick) => {
  if (wss.clients.size === 0) return;
  const payload = JSON.stringify({
    type: 'tick',
    symbol: tick.symbol,
    price: tick.price,
    change: tick.change,
    changePct: tick.changePct,
    high: tick.high,
    low: tick.low,
    volume: tick.volume,
    time: tick.time
  });

  for (const [client, subs] of activeSubscriptions.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      for (const s of subs) {
        if (s === tick.symbol || resolveSymbolId(s) === tick.symbol) {
          client.send(payload);
          break;
        }
      }
    }
  }
});

// Push ticker ticks every 1000ms
setInterval(async () => {
  if (wss.clients.size === 0) return;

  const allSymbols = new Set();
  for (const subs of activeSubscriptions.values()) {
    for (const s of subs) allSymbols.add(s);
  }
  if (allSymbols.size === 0) allSymbols.add('BTCUSDT');

  for (const sym of allSymbols) {
    try {
      const ticker = await get24hTicker(sym);
      if (ticker.unknown || typeof ticker.lastPrice !== 'number') continue;

      const payload = JSON.stringify({
        type: 'tick',
        symbol: sym,
        price: ticker.lastPrice,
        change: ticker.priceChange,
        changePct: ticker.priceChangePercent,
        high: ticker.highPrice,
        low: ticker.lowPrice,
        volume: ticker.volume,
        time: Date.now()
      });

      for (const [client, subs] of activeSubscriptions.entries()) {
        if (client.readyState === WebSocket.OPEN && subs.has(sym)) {
          client.send(payload);
        }
      }
    } catch (e) {
      // ignore tick error
    }
  }
}, 1200);

const HOST = process.env.HOST || '0.0.0.0'; // set HOST=127.0.0.1 once traffic arrives via the HTTPS tunnel
server.listen(PORT, HOST, () => {
  console.log(`[Chartivia Server] Running on http://${HOST}:${PORT}`);
  console.log(`[Chartivia Server] WebSocket live stream on ws://${HOST}:${PORT}/ws/live`);
  setTimeout(() => {
    getScreenerData().then(items => console.log(`[Screener Pre-Warmed] ${items.length} instruments ready`)).catch(() => {});
  }, 200);
});
