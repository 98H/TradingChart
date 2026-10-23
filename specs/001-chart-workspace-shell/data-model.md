# Data Model: Chart Workspace Shell

Entities supporting the Chart Workspace Shell span client-side localStorage stores, active in-memory browser states, and server-side atomic JSON files.

---

## 1. Instrument (Symbol Catalogue Entry)

Instrument metadata representing tradable markets across Crypto, Forex, Commodities, Metals, Indices, Stocks, and Iranian Domestic Markets.

- **Storage**: Server-side bundled catalogue (`server/symbolCatalog.js`), served via `GET /api/symbols` and `GET /api/symbol-info`. Cached client-side during session.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `symbol` | string | Unique ticker identifier (e.g. `BTCUSDT`, `GOLD_18K`, `EURUSD`). Uppercase alphanumeric + underscores, 2–24 chars. |
| `name` | string | English canonical display name (e.g. `Bitcoin`, `Apple Inc.`). |
| `nameFa` | string | Formal Persian display name (e.g. `بیت‌کوین`, `طلای ۱۸ عیار`). |
| `tickerFa` | string? | Persian short ticker glyph for Iranian instruments (e.g. `طلا ۱۸`, `سکه امامی`, `فولاد`). |
| `category` | enum string | One of: `crypto`, `metals`, `commodities`, `forex`, `indices`, `stocks`, `iran_gold`, `iran_tse`. |
| `base` | string | Base asset code (e.g. `BTC`, `XAU`, `EUR`, `GOLD18K`). |
| `quote` | string | Quote currency code (e.g. `USDT`, `USD`, `TMN`, `IRR`). |
| `precision` | number | Price display decimals (integer 0–8). |
| `minTick` | number | Minimum price movement step (e.g. `0.01`, `0.00001`, `1000`). |
| `lotSize` | number | Minimum order transaction size. |
| `exchange` | string | Sourcing venue (e.g. `Binance`, `OANDA`, `CBOE`, `NASDAQ`, `Tehran Bazaar`, `TSETMC`). |
| `market` | string | Market segment identifier (`crypto`, `metals`, `forex`, `indices`, `stocks`, `iran_gold`). |
| `currency` | string | Denomination currency (`USDT`, `USD`, `TMN`). |
| `displayOrder`| number? | Optional sorting priority weight. |

- **Limits**: Symbol query string length capped at 64 characters (`server/index.js:120`).
- **Lifecycle**: Read-only static registry initialized at server boot; consumed dynamically by `main.js:populateSymbolSearch` and `commandPalette.js`.

---

## 2. Candle (OHLCV Bar)

Historical and real-time candlestick bars rendered on the chart canvas and consumed by technical indicators.

- **Storage**: Served via `GET /api/candles`, stored in browser memory as `TradingChartApp.activeBars` array, and cached in `TradingChartApp.seriesCache` Map.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `time` | number | Bar open timestamp in Unix milliseconds (or seconds converted to ms > `1e11`). Must be finite. |
| `open` | number | Opening price. Finite positive float. |
| `high` | number | Highest price during interval (`high >= max(open, close)`). |
| `low` | number | Lowest price during interval (`low <= min(open, close)`). |
| `close` | number | Closing price (or current live tick price). Finite positive float. |
| `volume` | number | Traded base or contract volume. Non-negative float (defaults to 0 if omitted). |
| `_hollow` | boolean? | Internal flag for Hollow candle style (`close > prior close`). |
| `_upBar` | boolean? | Internal flag for Hollow candle style (`close >= open`). |
| `_volWidth` | number? | Normalized volume ratio (0.0–1.0) for Volume candle styling. |

- **Limits**: The maximum number of bars returned in a single request is capped by the user plan's `histBars` quota (`10,000` for Basic/Essential/Plus, `20,000` for Premium, `40,000` for Institutional). Clamped server-side via `clampInt(limit, 500, 1, histCap)`.
- **Lifecycle**: Fetched on market/interval switch via `fetchCandlesFor`; updated in-place on incoming live WebSocket tick (`app.activeBars[last]`); persisted to local disk on manual export via `dataExport.js`.

---

## 3. Ticker (24h Market Summary & Live Tick)

Rolling 24-hour price statistics and real-time tick streaming updates.

- **Storage**: Cached in server memory (`server/dataFeed.js`), served via `GET /api/tickers?symbols=...` and broadcast via WebSocket `WS /ws/live`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `symbol` | string | Uppercase instrument ticker. |
| `lastPrice` | number | Most recent execution price. |
| `priceChange` | number | Absolute net price difference over 24h window. |
| `priceChangePercent` | number | Percentage price shift over 24h window. |
| `highPrice` | number | 24-hour high price. |
| `lowPrice` | number | 24-hour low price. |
| `volume` | number | 24-hour base volume. |
| `quoteVolume`| number | 24-hour quote currency turnover. |
| `time` | number? | Timestamp of tick generation (present in WebSocket frames). |

- **Limits**: Maximum 40 symbols queried per HTTP request (`server/index.js:111`). WebSocket subscription throttled to 1 tick packet per symbol every 1200 ms.
- **Lifecycle**: Polled periodically by `watchlistManager.js` and streamed over WebSocket to update header price badges and watchlist rows in real time.

---

## 4. User Settings

Terminal visual preferences, scale behaviors, chart styling, and interface flags.

- **Storage**: Client `localStorage` under key `tradingchart_user_settings`. Synchronized to cloud backup via `state_u_<userId>.json` on authenticated sessions.
- **Fields**:

| Field | Type | Default | Rules & Description |
|-------|------|---------|---------------------|
| `theme` | `'dark' \| 'light'` | `'dark'` | Workspace visual theme. |
| `bullColor` | string (hex) | `'#00F2B0'` | Up-candle and bullish indicator color hex. |
| `bearColor` | string (hex) | `'#FF4D5B'` | Down-candle and bearish indicator color hex. |
| `watermark` | boolean | `true` | Show background instrument symbol watermark on canvas. |
| `watermarkOpacity` | number | `15` | Watermark visual opacity percentage (clamped 5–50). |
| `gridLines` | `'both' \| 'vert' \| 'horz' \| 'none'` | `'both'` | Canvas background grid layout mode. |
| `gridColor` | string (hex) | `'#161922'` | Background grid line color hex. |
| `scaleMode` | `'auto' \| 'log' \| 'percent'` | `'auto'` | Default price axis coordinate mode. |
| `timezone` | string | `'Etc/UTC'` | Chart time axis timezone identifier. |
| `language` | `'fa' \| 'en'` | `'en'` | Active user interface language. |
| `soundEffects` | boolean | `true` | Audio synthesizer feedback enabled. |
| `orderConfirm` | boolean | `false` | Display confirmation dialog before paper order entry. |
| `countdownEnabled`| boolean | `true` | Render bar-close countdown timer on price axis. |

- **Lifecycle**: Loaded in `SettingsModal` constructor; modified via modal tabs (Appearance, Scales & Grid, Trading & Audio, System & Language); saved to `localStorage` on clicking "Save Changes" (`#btn-save-settings`).

---

## 5. Watchlist Set & Flags

Personalized symbol watchlists, active selection, and multi-color category tags.

- **Storage**:
  - `localStorage.getItem('tradingchart_user_watchlists')`: Serialized `{ activeId: string, lists: Watchlist[] }`.
  - `localStorage.getItem('tradingchart_custom_watchlist')`: Active list symbol array `string[]`.
  - `localStorage.getItem('tradingchart_watchlist_flags')`: Record mapping `Record<string, FlagColor>`.
  - `localStorage.getItem('tradingchart_watchlist_deleted')`: Deletion tombstones `Record<string, number>`.
- **Fields**:

### Watchlist Object
| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique identifier (e.g. `wl_` + Base36 timestamp). |
| `name` | string | Watchlist label, trimmed, 1–40 characters. |
| `symbols` | string[] | Array of valid uppercase symbol tickers. |

### Watchlist Flag Value
- Enum: `'none' | 'red' | 'green' | 'blue' | 'yellow' | 'purple'`

- **Limits**:
  - Number of watchlists: Gated by plan `watchlists` (Basic: 1, Essential: 5, Plus: 10, Premium: 20, Institutional: 30).
  - Symbols per list: Gated by plan `watchlistSymbols` (Basic: 30, Essential+: 1,000).
  - Permitted flag colors: Gated by plan `flagColors` (Basic: 1 [Red only], Essential+: 7 colors).
- **Lifecycle**: Instantiated in `WatchlistManager`; modified on list creation, renaming, symbol addition/removal, or flag toggle; synced to cloud state.

---

## 6. Custom Timeframe

User-created non-standard interval definitions (e.g. 7m, 45m, 2h, 3D).

- **Storage**: Client `localStorage` under key `tradingchart_custom_timeframes`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Normalized timeframe identifier (`'7'`, `'120'`, `'3D'`). |
| `label` | string | Short UI label (`'7m'`, `'2h'`, `'3D'`). |
| `name` | string | English display name (e.g. `'7 m'`, `'2 h'`). |
| `nameFa` | string | Persian display name (e.g. `'7 m'`, `'2 h'`). |

- **Limits**: Creation requires `customIntervals` plan entitlement (Basic: false, Essential+: true). Value clamped between 1 and 1,000.
- **Lifecycle**: Constructed in `TimeframeManager`; stored as JSON array; individual entries deletable via `✕` button (`.btn-delete-custom-tf`).

---

## 7. Platform Announcement

Administrative operational notices and maintenance alerts displayed globally.

- **Storage**:
  - Server: `server/data/accounts/platform_settings.json` (atomic file).
  - Client dismissal: `localStorage.getItem('tc_announcement_dismissed')` storing `updatedAt` string.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `level` | `'info' \| 'warning' \| 'success'` | Visual alert severity style. |
| `en` | string | English notice copy (max 280 chars, trimmed). |
| `fa` | string | Persian notice copy (max 280 chars, trimmed). |
| `updatedAt` | number | Unix timestamp (ms) of the latest revision. |

- **Lifecycle**: Admin configures in back-office console; served publicly by `GET /api/platform`; rendered by `PlatformBanner.render()` in `#app-container`; hidden when user clicks dismiss until `updatedAt` changes.

---

## 8. Plan Entitlements

Feature quotas and tier entitlements governing terminal capabilities.

- **Storage**: Canonical matrix defined in `server/featuresCatalog.js` and persisted in `server/data/accounts/plans.json`. Read by `server/index.js` and served via `GET /api/plans`.
- **Keys relevant to this feature**:

| Entitlement Key | Value Type | Basic | Essential | Plus | Premium | Institutional |
|-----------------|------------|-------|-----------|------|---------|---------------|
| `histBars` | number | 10,000 | 10,000 | 10,000 | 20,000 | 40,000 |
| `secondIntervals` | boolean | `false` | `true` | `true` | `true` | `true` |
| `customIntervals` | boolean | `false` | `true` | `true` | `true` | `true` |
| `synthChartTypes` | boolean | `false` | `false` | `true` | `true` | `true` |
| `dataExport` | boolean | `false` | `true` | `true` | `true` | `true` |
| `compareSymbol` | boolean | `true` | `true` | `true` | `true` | `true` |
| `watchlists` | number | 1 | 5 | 10 | 20 | 30 |
| `watchlistSymbols` | number | 30 | 1,000 | 1,000 | 1,000 | 1,000 |
| `flagColors` | number | 1 | 7 | 7 | 7 | 7 |

---

## 9. User Profile (Shell Defaults)

Basic trader identity and initial chart startup parameters.

- **Storage**: Client `localStorage` under key `tradingchart_user_profile`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `defaultAsset` | string | Ticker of default market loaded on boot (e.g. `'BINANCE:BTCUSDT'`). |
| `defaultTimeframe` | string | Interval loaded on boot (e.g. `'60'`, `'D'`). |
| `name` | string | Trader display name. |
| `avatar` | string | Monogram initials or avatar asset identifier. |

- **Lifecycle**: Read synchronously during `TradingChartApp` constructor to seed `currentSymbol` and `currentTimeframe`; can be overridden by URL deep links (`?symbol=...&interval=...`).
