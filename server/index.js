// server/index.js
// Production Express & WebSocket Server for TradingChart (Port 8088)

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCandles, get24hTicker } from './dataFeed.js';
import { searchSymbols, getSymbolMeta } from './symbolCatalog.js';
import { CONGRESSIONAL_TRADES, INSIDER_TRADES, HEDGE_FUND_13F, FINRA_SHORT_VOLUME } from './marketTrackers.js';
import { ECONOMIC_EVENTS, getEconomicEvents } from './economicCalendar.js';
import { globalRelay } from './tradeRelay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8088;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/live' });

app.use(cors());
app.use(express.json());

// Serve static frontend files from client / dist
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// ── REST API Endpoints ───────────────────────────────────────────────

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    product: 'TradingChart',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memory: process.memoryUsage(),
    engine: 'LuxAlgo Vela WebGL2 + PineTS Runtime'
  });
});

// 2. Historical & Live Candles (Waterfall with Infinite Backfill)
app.get('/api/candles', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const timeframe = req.query.timeframe || '60';
    const limit = parseInt(req.query.limit, 10) || 500;
    const fromTime = req.query.from_time ? Number(req.query.from_time) : null;
    const toTime = req.query.to_time ? Number(req.query.to_time) : null;

    const candles = await getCandles(symbol, timeframe, limit, fromTime, toTime);
    res.json({
      symbol,
      timeframe,
      count: candles.length,
      candles
    });
  } catch (error) {
    console.error('[API /api/candles] Error:', error.message);
    res.status(500).json({ error: error.message, candles: [] });
  }
});

// 3. 24hr Ticker Overview
app.get('/api/tickers', async (req, res) => {
  try {
    const symbolsParam = req.query.symbols || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD';
    const symbols = symbolsParam.split(',').map(s => s.trim());
    const tickers = await Promise.all(symbols.map(s => get24hTicker(s)));
    res.json(tickers);
  } catch (error) {
    console.error('[API /api/tickers] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. Symbol Search & Catalog
app.get('/api/symbols', (req, res) => {
  const query = req.query.q || '';
  const category = req.query.category || 'all';
  const results = searchSymbols(query, category);
  res.json(results);
});

// 5. Symbol Metadata
app.get('/api/symbol-info', (req, res) => {
  const symbol = req.query.symbol || 'BTCUSDT';
  const meta = getSymbolMeta(symbol);
  res.json(meta);
});

// 6. Market Trackers (SEC EDGAR & US Government Alternative Data)
app.get('/api/market-trackers', (req, res) => {
  const kind = req.query.kind || 'all';
  res.json({
    congressionalTrades: kind === 'all' || kind === 'congress' ? CONGRESSIONAL_TRADES : [],
    insiderTrades: kind === 'all' || kind === 'insider' ? INSIDER_TRADES : [],
    hedgeFund13F: kind === 'all' || kind === '13f' ? HEDGE_FUND_13F : [],
    finraShortVolume: kind === 'all' || kind === 'short_vol' ? FINRA_SHORT_VOLUME : []
  });
});

// 6b. Institutional Economic Calendar (FOMC, CPI, NFP, GDP, Central Banks)
app.get('/api/economic-calendar', (req, res) => {
  const impact = req.query.impact || 'all';
  const country = req.query.country || 'all';
  const category = req.query.category || 'all';
  const events = getEconomicEvents({ impact, country, category });
  res.json({
    total: events.length,
    events
  });
});

// 7. Trade Relay Webhook & Account Management
app.post('/api/webhook', (req, res) => {
  try {
    const result = globalRelay.processSignal(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/trade-relay/account', (req, res) => {
  res.json(globalRelay.getAccountState());
});

// Fallback to client SPA for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// ── Live WebSocket Broadcaster ────────────────────────────────────────
const activeSubscriptions = new Map(); // wsClient -> Set<symbol>

wss.on('connection', (ws) => {
  activeSubscriptions.set(ws, new Set(['BTCUSDT']));

  ws.on('message', (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);
      if (msg.action === 'subscribe' && msg.symbol) {
        const subs = activeSubscriptions.get(ws) || new Set();
        subs.add(msg.symbol.toUpperCase());
        activeSubscriptions.set(ws, subs);
      } else if (msg.action === 'unsubscribe' && msg.symbol) {
        const subs = activeSubscriptions.get(ws);
        if (subs) subs.delete(msg.symbol.toUpperCase());
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

  // Gather unique subscribed symbols
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[TradingChart Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[TradingChart Server] WebSocket live stream on ws://0.0.0.0:${PORT}/ws/live`);
});
