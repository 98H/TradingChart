# Module API Contract: Market Data Feed

Client-side ES module contracts and server WebSocket transport interfaces governing market data streams, order book ladders, pipeline inspection, and synthetic series generation.

---

## 1. WebSocket Live Stream: `/ws/live`

Real-time bid/ask and tick broadcast channel implemented in `server/index.js:216-284`.

- **Endpoint**: `ws://<host>:<port>/ws/live` (or `wss://` over TLS).
- **Authentication**: None (anonymous).
- **Client Cap**: Capped by `TC_MAX_WS` (default 2,000). Excess connections closed with code `1013` and reason `'busy'`.
- **Frame Limit**: Maximum inbound JSON frame size is 4,096 bytes.
- **Subscription Cap**: Maximum 50 symbols per connected client socket. Extra subscriptions are silently dropped.
- **Initial Subscription**: Server automatically subscribes each new socket connection to `'BTCUSDT'`.

### Client -> Server Messages

#### Subscribe to Symbol
```json
{
  "action": "subscribe",
  "symbol": "ETHUSDT"
}
```
- `action`: Literal string `'subscribe'`.
- `symbol`: Instrument symbol string (sanitized via `cleanSymbol`).

#### Unsubscribe from Symbol
```json
{
  "action": "unsubscribe",
  "symbol": "ETHUSDT"
}
```
- `action`: Literal string `'unsubscribe'`.
- `symbol`: Instrument symbol string.

### Server -> Client Messages

#### Real-time Ticker Tick
Broadcast every 1,200 ms to all clients subscribed to the active symbol.
```json
{
  "type": "tick",
  "symbol": "BTCUSDT",
  "price": 68420.5,
  "change": 1420.5,
  "changePct": 2.12,
  "high": 69100.0,
  "low": 67000.0,
  "volume": 24500.12,
  "time": 1729684800000
}
```

---

## 2. `client/src/universalProvider.js`

Custom Vela `DataProvider` connecting the chart canvas to Chartivia's multi-tier backend proxy.

### `class UniversalMarketProvider`

- **`constructor(providerName = 'universal', displayName = 'Chartivia Multi-Asset')`**:
  Initializes caches (`symbolsCache`, `lastBarsCache`, `seriesCache`, `subscribers`) and calls `initWebSocket()`.
- **`initWebSocket(): void`**:
  Establishes WebSocket connection to `/ws/live`. Automatically re-subscribes active symbols on open; schedules `setTimeout(..., 3000)` reconnection on close.
- **`info(): ProviderInfo`**:
  Returns provider capability descriptor:
  ```json
  {
    "name": "universal",
    "displayName": "Chartivia Multi-Asset",
    "requiresApiKey": false,
    "supportedTimeframes": ["1s", "1S", "1", "3", "5", "15", "30", "45", "60", "120", "180", "240", "D", "W", "M"],
    "capabilities": { "enumerate": true, "stream": true, "symbolInfo": true }
  }
  ```
- **`getBars(ticker: string, timeframe: string, range?: { limit?: number, from?: number, to?: number }): Promise<Bar[]>`**:
  Fetches candles from `/api/candles`. Applies client-side synthetic transformations (`toRenko`, `toKagi`, etc.) if `localStorage.tradingchart_price_style` is active. Caches successful bars in `seriesCache`. If fetch fails or returns empty, returns cached series or synthesizes a neutral seed bar (`{ time, open: 100, high: 100, low: 100, close: 100, volume: 0, openTime }`).
- **`getSymbolInfo(ticker: string): Promise<SymbolInfo>`**:
  Queries `/api/symbol-info?symbol=${ticker}` and returns normalized instrument specs (`pricescale`, `mintick`, `timezone`, `currency`, `basecurrency`).
- **`listSymbols(): Promise<Array<{ ticker: string, description: string, type: string }>>`**:
  Queries `/api/symbols` and caches results in `symbolsCache`.
- **`resolveSymbolIcon(symbol: string): string | null`**:
  Returns inline data URI SVG icons for major crypto, gold, TSE, forex, and commodity tickers.
- **`subscribe(ticker: string, timeframe: string, onBar: (bar: Bar) => void): () => void`**:
  Registers a bar update subscriber. Sends `{ action: 'subscribe' }` on WebSocket. Coalesces incoming ticks to at most one `onBar` invocation every 250 ms. Returns an unsubscribe teardown function.

---

## 3. `client/src/depthOfMarket.js`

Level 2 Depth of Market ladder, real-time spread calculator, and paper trading trigger.

### `class DepthOfMarketView`

- **`constructor(options: { container: HTMLElement, app: TradingChartApp })`**:
  Mounts DOM wrapper into `container`, renders template, triggers `fetchDepth()`, and starts 1,500 ms visibility-gated polling.
- **`setSymbol(symbol: string): void`**:
  Updates active symbol (`cleanSymbol`), re-fetches depth, and re-renders ladder.
- **`startPolling(): void`**:
  Sets up `setInterval(() => this.fetchDepth(true), 1500)`.
- **`isVisible(): boolean`**:
  Returns `true` only if `!document.hidden`, `this.container` exists, has non-zero client rects, and `offsetParent !== null`.
- **`fetchDepth(silent = false): Promise<void>`**:
  Guarded by `_inflight`. If `silent && !this.isVisible()`, exits immediately. Fetches `/api/depth?symbol=${this.symbol}&levels=12`. Calls `updateLadder()` and `updateSourceBadge()`.
- **`updateLadder(): void`**:
  Re-renders asks (reverse order), bids, mark price, spread, and binds click events on `.btn-dom-limit-buy` and `.btn-dom-limit-sell`.
- **`updateSourceBadge(): void`**:
  Updates `#dom-source-badge`:
  - Simulated: text `"Simulated"` / `"شبیه‌سازی‌شده"`, color gold (`#f59e0b`).
  - Binance: text `"Live · Binance"` / `"زنده · بایننس"`, color green (`#0ecb81`).
- **`bindEvents(): void`**:
  Binds quantity decrement (`#dom-qty-dec`, step -0.05, min 0.01), increment (`#dom-qty-inc`, step +0.05), quantity input (`#dom-order-qty`), and market execution buttons (`#dom-btn-market-buy`, `#dom-btn-market-sell`) delegating to `app.paperTrading.executeOrder()`.
- **`destroy(): void`**:
  Clears background polling timer (`clearInterval(this.pollTimer)`).

---

## 4. `client/src/marketSourcesModal.js`

Waterfall telemetry and route inspector modal dialog.

### `class MarketSourcesModal`

- **`constructor(options: { app: TradingChartApp })`**:
  Finds `#modal-market-sources` in DOM and binds close and refresh listeners.
- **`init(): void`**:
  Binds click events to close button (`#modal-close-sources`), modal backdrop, and ping test button (`#btn-sources-refresh-ping`).
- **`open(): void`**:
  Adds `.open` CSS class to modal and calls `fetchSources()`.
- **`close(): void`**:
  Removes `.open` CSS class.
- **`fetchSources(): Promise<void>`**:
  Queries `GET /api/market-sources`, stores payload in `this.data`, and calls `renderContent()`.
- **`renderContent(): void`**:
  Populates `#market-sources-content` with live telemetry banner, average latency display in ms, ping test button, and 5 route cards (Tier 1..5) with status badges and Persian descriptions.

---

## 5. `client/src/syntheticChartTypes.js`

Client-side non-time-based synthetic series generators.

- **`defaultBoxSize(bars: Bar[]): number`**:
  Calculates ATR over the last 200 bars and snaps it to psychologically round increments on a `1/2/5 × 10^k` grid.
- **`toRenko(bars: Bar[], boxSize?: number): Bar[]`**:
  Transforms OHLCV bars into classic wickless Renko bricks anchored to an absolute grid.
- **`toKagi(bars: Bar[], reversalAmount?: number): Bar[]`**:
  Generates swing-based Kagi lines flipping direction on reversals `>= reversalAmount`, encoding `_yang` thickness metadata.
- **`toLineBreak(bars: Bar[], lines = 3): Bar[]`**:
  Computes 3-Line Break series emitting new bars only when the closing price exceeds the extreme of the prior `N` lines.
- **`toRangeBars(bars: Bar[], rangeSize?: number): Bar[]`**:
  Transforms bars into fixed-range price boxes.
- **`toPnF(bars: Bar[], boxSize?: number, reversal = 3): Bar[]`**:
  Computes classic Point & Figure step bars.
- **`toHollow(bars: Bar[]): Bar[]`**:
  Enriches bars with `_hollow` (`close > prevClose`) and `_upBar` (`close >= open`) metadata flags.
- **`toVolumeCandles(bars: Bar[]): Bar[]`**:
  Enriches bars with `_volWidth` (`volume / maxVolume`) metadata flags.
- **`SYNTHETIC_TYPES: Record<string, { fn: Function, name: string, fa: string }>`**:
  Registry map exporting `renko`, `kagi`, `linebreak`, `range`, `pnf`, `hollow`, and `volumecandles`.

---

## 6. Server Core Modules

### `server/dataFeed.js`
- **`fetchBinanceKlines(symbol, interval, limit, startTime, endTime): Promise<Candle[]>`**:
  Fetches crypto candles across Binance mirrors with multi-page backfill.
- **`getCandles(symbol, timeframe, limit, fromTime, toTime): Promise<Candle[]>`**:
  Universal candle resolution with 3,000 ms micro-caching.
- **`get24hTicker(symbol): Promise<Ticker>`**:
  Retrieves 24-hour statistics for crypto, Tehran gold/currencies, TSE, or global macro continuous models.
- **`getMarketSourceStatus(): Promise<MarketSourcesTelemetry>`**:
  Generates system telemetry with live Binance ping probe.
- **`probeBinance(): Promise<{ at: number, ok: boolean, ms: number | null }>`**:
  Pings `BINANCE_VISION_BASE/ping` (cached for 30 seconds).

### `server/depthFeed.js`
- **`getOrderBookDepth(symbol, levels = 15): Promise<DepthSnapshot>`**:
  Returns 12..50 level order book ladder with 1,500 ms caching.

### `server/symbolCatalog.js`
- **`searchSymbols(query, category, exchange): Instrument[]`**:
  Filters catalogue by query, category, and exchange.
- **`getSymbolMeta(symbol): Instrument`**:
  Returns metadata for a given symbol.
