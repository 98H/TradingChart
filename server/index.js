// server/index.js
// Production Express & WebSocket Server for TradingChart (Port 8088)

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCandles, get24hTicker, getGoldMarketSnapshot, getTseMarketTape, getMarketSourceStatus } from './dataFeed.js';
import { searchSymbols, getSymbolMeta } from './symbolCatalog.js';
import { CONGRESSIONAL_TRADES, INSIDER_TRADES, HEDGE_FUND_13F, FINRA_SHORT_VOLUME } from './marketTrackers.js';
import { ECONOMIC_EVENTS, getEconomicEvents } from './economicCalendar.js';
import { getScreenerData } from './technicalScreener.js';
import { getOrderBookDepth } from './depthFeed.js';
import { getMarketNews } from './newsFeed.js';
import { mountAccountSystem, PLANS } from './accounts.js';
import { securityHeaders, sameOriginWrites, apiRateLimit, cleanSymbol, clampInt, optTimestamp, serverError } from './security.js';

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
    const timeframe = String(req.query.timeframe || '60');
    if (!/^[0-9]{1,4}[smhdwSMHDW]?$|^[DWM]$/.test(timeframe)) return bad(res, 'invalid_timeframe');
    const fromTime = optTimestamp(req.query.from_time);
    const toTime = optTimestamp(req.query.to_time);
    if (fromTime === undefined || toTime === undefined) return bad(res, 'invalid_time');

    const histCap = req.user
      ? (PLANS[req.user.plan]?.histBars ?? PLANS.basic.histBars)
      : PLANS.basic.histBars;
    const limit = clampInt(req.query.limit, 500, 1, histCap);
    res.setHeader('X-History-Limit', String(histCap));

    const candles = await getCandles(symbol, timeframe, limit, fromTime, toTime);
    if (candles.length === 0) {
      return res.status(404).json({ symbol, timeframe, count: 0, candles: [], error: 'no_market_data' });
    }
    res.json({ symbol, timeframe, count: candles.length, candles });
  } catch (error) { serverError(res, '/api/candles', error); }
});

// 3. 24hr Ticker Overview (max 40 symbols per call)
app.get('/api/tickers', async (req, res) => {
  try {
    const raw = String(req.query.symbols || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD');
    const symbols = [...new Set(raw.split(',').map(s => cleanSymbol(s.trim())).filter(Boolean))].slice(0, 40);
    if (!symbols.length) return bad(res, 'invalid_symbol');
    const tickers = await Promise.all(symbols.map(s => get24hTicker(s)));
    res.json(tickers);
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
    res.json(await getOrderBookDepth(symbol, clampInt(req.query.levels, 15, 1, 50)));
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

  ws.on('message', (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);
      if (msg.action === 'subscribe' && msg.symbol) {
        const sym = cleanSymbol(msg.symbol);
        if (!sym) return;
        const subs = activeSubscriptions.get(ws) || new Set();
        if (subs.size >= 50 && !subs.has(sym)) return;
        subs.add(sym);
        activeSubscriptions.set(ws, subs);
      } else if (msg.action === 'unsubscribe' && msg.symbol) {
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
