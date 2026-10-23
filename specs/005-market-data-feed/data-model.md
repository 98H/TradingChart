# Data Model: Market Data Feed

Entities defined by `specs/005-market-data-feed/spec.md` (Key Entities) and their realization in the codebase. All entities reside in server memory, client memory, transient network payloads, or browser `localStorage`. No entities in this feature persist to persistent database tables.

---

## 1. Candle (`Candle`)

A single historical or real-time OHLCV price bar representing market activity across a fixed interval.

- **Storage**:
  - Server in-memory micro-cache (`candleCache` in `server/dataFeed.js`, TTL 3,000 ms).
  - Client in-memory series cache (`UniversalMarketProvider.seriesCache` and `lastBarsCache`).
  - Active chart canvas memory in `@luxalgo/vela` scene graph.
- **Fields**:
  - `time` (`number`, required): Unix timestamp in milliseconds representing the opening time of the bar bucket (e.g. `1729684800000`).
  - `open` (`number`, required): Opening traded price of the bar.
  - `high` (`number`, required): Highest traded price reached during the bar interval.
  - `low` (`number`, required): Lowest traded price reached during the bar interval.
  - `close` (`number`, required): Closing or current traded price of the bar.
  - `volume` (`number`, required): Trading volume accumulated during the bar interval (base asset volume).
  - `closeTime` (`number`, optional): Unix timestamp in milliseconds for the closing time of the bar (present on Binance Vision bars).
  - `openTime` (`number`, client internal): Redundant timestamp alias matching `time` to prevent runtime crashes in downstream PineTS indicator engines.
  - `_hollow` (`boolean`, optional): Client metadata flag for Hollow candle styling (`close > prevClose`).
  - `_upBar` (`boolean`, optional): Client metadata flag for Hollow candle direction (`close >= open`).
  - `_volWidth` (`number`, optional): Client metadata fraction (`0..1`) for Volume Candles body width scaling.
  - `_yang` (`number`, optional): Client metadata flag (`0 | 1`) for Kagi line thickness flips.
- **Validation**:
  - `time` and `close` must be finite numbers (`Number.isFinite(b.time) && Number.isFinite(b.close)`).
  - `high` must be `>= Math.max(open, close)` and `low` must be `<= Math.min(open, close)`.
  - Non-crypto demo bars are generated deterministically based on random walk seeds anchored to canonical base prices.
- **Limits**:
  - Requested bar count clamped by user plan `histBars`: Basic/Guest (10,000), Essential (10,000), Plus (10,000), Premium (20,000), Ultimate (40,000).
- **Lifecycle**:
  - Fetched via `GET /api/candles`.
  - Cached on server for 3 seconds per `(symbol, timeframe, limit, from, to)` tuple.
  - On the client, the latest bar is updated in-place from WebSocket ticks and emitted to subscribers every 250 ms.
  - Persisted in client memory for the duration of the chart session; discarded when changing symbols or timeframes.

---

## 2. Ticker (`Ticker`)

24-hour rolling price statistics, volume, and classification metadata for an instrument.

- **Storage**:
  - Transient response payload of `GET /api/tickers`.
  - In-memory computation in `server/dataFeed.js:get24hTicker()`.
- **Fields**:
  - `symbol` (`string`, required): Normalized instrument ticker (e.g. `'BTCUSDT'`, `'FOOLAD'`, `'XAUUSD'`).
  - `lastPrice` (`number`, required): Latest executed or modelled trade price.
  - `priceChange` (`number`, required): Absolute price change over the preceding 24 hours (`lastPrice - open24h`).
  - `priceChangePercent` (`number`, required): Percentage price change over 24 hours (`(priceChange / open24h) * 100`).
  - `highPrice` (`number`, required): Highest price recorded over the last 24 hours.
  - `lowPrice` (`number`, required): Lowest price recorded over the last 24 hours.
  - `volume` (`number`, required): 24-hour total base asset volume.
  - `quoteVolume` (`number`, required): 24-hour total quote asset trading volume (`volume * lastPrice`).
  - `exchange` (`string`, required): Name of primary liquidity exchange (e.g. `'Binance'`, `'TSETMC'`, `'Tehran Bazaar'`, `'OANDA'`, `'NASDAQ'`).
  - `category` (`string`, required): Asset class category (`'crypto'`, `'metals'`, `'commodities'`, `'forex'`, `'indices'`, `'stocks'`, `'iran_gold'`, `'iran_tse'`).
  - `currency` (`string`, required): Quote currency denomination (`'USDT'`, `'USD'`, `'TMN'`, `'IRR'`).
- **Validation**:
  - Numbers are parsed via `parseFloat()` or rounded to instrument precision.
  - Crypto tickers query Binance Vision; non-crypto tickers evaluate snapshot engines (`getGoldMarketSnapshot`, `getTseMarketTape`, or continuous model).
- **Limits**:
  - `GET /api/tickers` processes a maximum of 40 comma-separated symbols per call.
- **Lifecycle**:
  - Computed on-demand upon API request or periodically during the 1,200 ms WebSocket broadcast loop.

---

## 3. Instrument (`Instrument`)

Catalogue metadata defining an instrument's trading specifications, decimal precision, and bilingual naming.

- **Storage**:
  - Static array `SYMBOL_CATALOG` in `server/symbolCatalog.js`.
  - Client cache `UniversalMarketProvider.symbolsCache`.
- **Fields**:
  - `symbol` (`string`, required): Unique symbol identifier (e.g. `'BTCUSDT'`, `'GOLD_ABSHODEH'`, `'FOOLAD'`). Primary key.
  - `name` (`string`, required): Full English display name (e.g. `'Mobarakeh Steel Co.'`).
  - `nameFa` (`string`, required): Full Persian display name with strict ZWNJ (e.g. `'فولاد مبارکه اصفهان'`).
  - `category` (`string`, required): Asset class category enum: `'crypto' | 'metals' | 'commodities' | 'forex' | 'indices' | 'stocks' | 'iran_gold' | 'iran_tse'`.
  - `base` (`string`, required): Base currency or asset symbol (e.g. `'BTC'`, `'فولاد'`, `'ABSHODEH'`).
  - `quote` (`string`, required): Quote currency symbol (e.g. `'USDT'`, `'IRR'`, `'TMN'`, `'USD'`).
  - `precision` (`number`, required): Decimal places displayed on price scale (e.g. `2`, `4`, `0`).
  - `minTick` (`number`, required): Minimum price increment (e.g. `0.01`, `0.0001`, `10`, `1000`).
  - `lotSize` (`number`, required): Standard order quantity increment (e.g. `0.0001`, `1`, `100`).
  - `exchange` (`string`, required): Primary market venue (e.g. `'Binance'`, `'TSETMC'`, `'Tehran FX'`).
  - `market` (`string`, required): Market classification string matching category.
  - `currency` (`string`, required): Denomination currency code.
  - `tickerFa` (`string`, optional): Abbreviated Persian ticker symbol (e.g. `'فولاد'`, `'آبشده'`, `'طلا'`).
  - `insco` (`string`, optional): TSETMC 17-digit institutional instrument code for Tehran stocks.
- **Validation**:
  - Verified static catalogue of 52 entries across 8 asset classes.
  - Unrecognized symbols ending in `'USDT'`, `'BTC'`, or `'ETH'` dynamically generate synthetic metadata with category `'crypto'`.
- **Limits**:
  - Fixed built-in catalogue of 52 instruments.
- **Lifecycle**:
  - Loaded into server memory on process boot; immutable during runtime.
  - Queried via `searchSymbols()` and `getSymbolMeta()`.

---

## 4. Data Source (`DataSource`)

Telemetry and health metadata representing one of the 5 market data routes in the system waterfall.

- **Storage**:
  - Transient payload returned by `GET /api/market-sources`.
  - Server probe state `binanceProbe` (`server/dataFeed.js`, TTL 30,000 ms).
- **Fields**:
  - `id` (`string`, required): Unique route identifier (`'binance_direct'`, `'forex_metals'`, `'us_equities'`, `'tehran_gold'`, `'tsetmc_bourse'`).
  - `name` (`string`, required): English route display title.
  - `nameFa` (`string`, required): Persian route display title.
  - `status` (`string`, required): Operational health status enum: `'online' | 'degraded' | 'demo'`.
  - `latencyMs` (`number | null`, required): Measured round-trip ping latency in milliseconds; `null` for demo series.
  - `live` (`boolean`, required): `true` for live exchange connections (Binance); `false` for demo series.
  - `protocol` (`string`, required): Technical transport description (e.g. `'REST v3 (data-api.binance.vision)'`, `'Modelled demo series'`).
  - `protocolFa` (`string`, required): Persian technical transport description.
  - `marketsCovered` (`string[]`, required): Array of English market descriptions covered by this source.
  - `marketsCoveredFa` (`string[]`, required): Array of Persian market descriptions.
  - `tier` (`number`, required): Waterfall priority tier index (`1` to `5`).
  - `activeSymbols` (`number`, required): Count of catalogue instruments routed through this source.
- **Validation**:
  - Only `binance_direct` can report `status: 'online'` or `live: true`. All other 4 sources are strictly immutable demo feeds (`live: false`, `status: 'demo'`, `latencyMs: null`).
  - Binance status switches to `'degraded'` if ping timeout exceeds 4,000 ms or fails.
- **Limits**:
  - Exactly 5 sources enumerated in the waterfall.
- **Lifecycle**:
  - Assembled dynamically in `getMarketSourceStatus()` on each `GET /api/market-sources` invocation.

---

## 5. Depth Snapshot (`DepthSnapshot`)

Level 2 Depth of Market order book snapshot containing bid/ask price levels, sizes, and spread metrics.

- **Storage**:
  - Server in-memory cache `cache` in `server/depthFeed.js` (TTL 1,500 ms, max 200 entries).
  - Client in-memory state in `DepthOfMarketView.data`.
- **Fields**:
  - `symbol` (`string`, required): Normalized instrument symbol.
  - `lastPrice` (`number`, required): Mid-market price or last traded ticker price.
  - `spread` (`number`, required): Absolute difference between best ask and best bid (`bestAsk - bestBid`).
  - `spreadPct` (`number`, required): Spread expressed as a percentage of mid-market price (`(spread / lastPrice) * 100`).
  - `bids` (`Array<OrderBookLevel>`, required): Ordered array of bid ladder levels (highest price down to lowest).
  - `asks` (`Array<OrderBookLevel>`, required): Ordered array of ask ladder levels (lowest price up to highest).
  - `maxDepth` (`number`, required): Maximum cumulative volume across bids or asks (used for percentage depth bar width).
  - `source` (`string`, required): Data provenance identifier: `'binance' | 'simulated'`.
  - `simulated` (`boolean`, required): `false` for real exchange books; `true` for synthetic simulated ladders.
  - `timestamp` (`number`, required): Unix timestamp in milliseconds when snapshot was generated.
- **Sub-Entity: OrderBookLevel**:
  - `level` (`number`, required): Ladder position index (1-based, 1 to `levels`).
  - `price` (`number`, required): Order price level.
  - `size` (`number`, required): Available volume at this specific price level.
  - `total` (`number`, required): Cumulative volume from top of book down to this level.
- **Validation**:
  - Requested levels clamped between `1` and `50` (default: `15`, DOM panel requests `12`).
  - Crypto uses real Binance order books; non-crypto constructs deterministic trigonometric ladder.
- **Limits**:
  - Up to 50 levels per side. Cached for 1,500 ms.
- **Lifecycle**:
  - Created when `GET /api/depth` is requested.
  - Polled every 1,500 ms by `DepthOfMarketView` while panel is visible.

---

## 6. Tick (`Tick`)

Real-time streaming trade tick broadcast over WebSocket to update charts and ticker ribbons.

- **Storage**:
  - In-memory WebSocket message buffer.
  - Updated into `UniversalMarketProvider.lastBarsCache` on the client.
- **Fields**:
  - `type` (`string`, required): Message type literal `'tick'`.
  - `symbol` (`string`, required): Instrument symbol (e.g. `'BTCUSDT'`).
  - `price` (`number`, required): Executed trade price.
  - `change` (`number`, required): 24-hour absolute price change.
  - `changePct` (`number`, required): 24-hour percentage price change.
  - `high` (`number`, required): 24-hour high price.
  - `low` (`number`, required): 24-hour low price.
  - `volume` (`number`, required): 24-hour rolling volume.
  - `time` (`number`, required): Unix timestamp in milliseconds when tick was broadcast.
- **Validation**:
  - Dispatched only to clients with an active subscription for the given symbol.
- **Limits**:
  - Broadcast every 1,200 ms by the server loop.
  - Throttled to at most one client canvas update every 250 ms per subscriber.
- **Lifecycle**:
  - Created in `server/index.js:setInterval`, serialized to JSON, broadcast over `/ws/live`, consumed by `UniversalMarketProvider`, and discarded.

---

## 7. Price Style State (`PriceStyleState`)

Traders' selected non-time-based synthetic chart display style.

- **Storage**:
  - Browser `localStorage` key `'tradingchart_price_style'`.
- **Fields**:
  - Value (`string`): Style identifier enum:
    - `'candles'`: Standard time-based OHLCV candles (default).
    - `'renko'`: Traditional ATR-anchored brick series.
    - `'kagi'`: Trend reversal swing line series.
    - `'linebreak'`: 3-line break bar series.
    - `'range'`: Fixed price range box series.
    - `'pnf'`: Point and Figure step series.
    - `'hollow'`: Hollow candle visual styling.
    - `'volumecandles'`: Volume-weighted candle body scaling.
- **Validation**:
  - Validated against `SYNTHETIC_TYPES` keys in `client/src/syntheticChartTypes.js`.
  - Selecting a synthetic style requires the `synthChartTypes` plan entitlement (Plus tier or higher).
- **Limits**: Single string scalar per browser profile.
- **Lifecycle**:
  - Read on chart initialization in `UniversalMarketProvider.getBars()`.
  - Written when user selects a style in `#menu-chart-styles`.
  - Persisted indefinitely across sessions until cleared by user.

---

## 8. Active WebSocket Subscription (`ActiveWebSocketSubscription`)

Server-side registry tracking live symbol subscriptions per connected WebSocket client.

- **Storage**:
  - In-memory `Map<WebSocket, Set<string>>` (`activeSubscriptions` in `server/index.js`).
- **Fields**:
  - Key: `WebSocket` client connection instance.
  - Value: `Set<string>` containing subscribed symbol strings (e.g. `Set(['BTCUSDT', 'ETHUSDT'])`).
- **Validation**:
  - Maximum 50 symbols per client connection (`subs.size >= 50`).
  - Incoming frame payload size capped at 4,096 bytes.
- **Limits**:
  - Capped globally by `TC_MAX_WS` (default: 2,000 concurrent client sockets).
- **Lifecycle**:
  - Initialized with `Set(['BTCUSDT'])` on connection.
  - Mutated via `{ action: 'subscribe' }` and `{ action: 'unsubscribe' }` messages.
  - Deleted automatically from the map on socket `'close'`.
