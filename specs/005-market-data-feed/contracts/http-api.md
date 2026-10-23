# HTTP API Contract: Market Data Feed

Backend HTTP endpoints implemented in `server/index.js`, `server/dataFeed.js`, `server/depthFeed.js`, and `server/symbolCatalog.js` providing historical candles, ticker summaries, symbol search, pipeline telemetry, and order book depth.

---

## 1. GET /api/candles

Retrieves historical OHLCV candle bars for a symbol and timeframe, plan-gated to the user's allowed history depth.

- **Method**: `GET`
- **Path**: `/api/candles`
- **Authentication**: Optional. If authenticated via session cookie (`req.user`), plan cap is `PLANS[req.user.plan]?.histBars`. If anonymous or guest, defaults to `PLANS.basic.histBars` (10,000 bars).
- **Caching**: Micro-cached in server memory for 3,000 ms per unique parameter tuple.
- **Response Headers**:
  - `X-History-Limit`: `<number>` (Maximum candle limit permitted for caller's plan).

### Request Query Parameters

| Parameter | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `symbol` | string | No | `'BTCUSDT'` | Sanitized via `cleanSymbol()`. Strips prefix, trims, converts uppercase. | Target instrument symbol. |
| `timeframe` | string | No | `'60'` | Regex: `/^[0-9]{1,4}[smhdwSMHDW]?$\|^[DWM]$/` | Interval string (`'1'`, `'5'`, `'15'`, `'60'`, `'D'`, etc.). |
| `limit` | integer | No | `500` | Clamped `1..histCap` | Requested number of bars. Clamped to user plan's `histBars`. |
| `from_time` | integer | No | `null` | Positive integer Unix timestamp in milliseconds | Filter candles `>= from_time`. |
| `to_time` | integer | No | `null` | Positive integer Unix timestamp in milliseconds | Filter candles `<= to_time`. |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "60",
  "count": 500,
  "candles": [
    {
      "time": 1729684800000,
      "open": 68250.0,
      "high": 68500.5,
      "low": 68100.0,
      "close": 68420.5,
      "volume": 245.82,
      "closeTime": 1729688399999
    }
  ]
}
```

### Error Responses

- **400 Bad Request — Invalid Symbol**:
  ```json
  {
    "ok": false,
    "error": "invalid_symbol"
  }
  ```
- **400 Bad Request — Invalid Timeframe**:
  ```json
  {
    "ok": false,
    "error": "invalid_timeframe"
  }
  ```
- **400 Bad Request — Invalid Time Bound**:
  ```json
  {
    "ok": false,
    "error": "invalid_time"
  }
  ```
- **404 Not Found — No Market Data**:
  ```json
  {
    "symbol": "UNKNOWN",
    "timeframe": "60",
    "count": 0,
    "candles": [],
    "error": "no_market_data"
  }
  ```
- **500 Internal Server Error**:
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```

---

## 2. GET /api/tickers

Retrieves 24-hour rolling statistics (last price, high, low, volume, price change) for up to 40 requested symbols.

- **Method**: `GET`
- **Path**: `/api/tickers`
- **Authentication**: None (public route)
- **Rate Limit**: Standard IP rate limiter.

### Request Query Parameters

| Parameter | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `symbols` | string | No | `'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD'` | Comma-separated list, max 40 unique symbols | Tickers to query. Extra symbols beyond 40 are truncated. |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
[
  {
    "symbol": "BTCUSDT",
    "lastPrice": 68420.5,
    "priceChange": 1420.5,
    "priceChangePercent": 2.12,
    "highPrice": 69100.0,
    "lowPrice": 67000.0,
    "volume": 24500.12,
    "quoteVolume": 1676300000.0,
    "exchange": "Binance",
    "category": "crypto",
    "currency": "USDT"
  },
  {
    "symbol": "GOLD_ABSHODEH",
    "lastPrice": 52400000,
    "priceChange": 350000,
    "priceChangePercent": 0.67,
    "highPrice": 53028800,
    "lowPrice": 51771200,
    "volume": 12500,
    "quoteVolume": 655000000000,
    "exchange": "Tehran Bazaar",
    "category": "iran_gold",
    "currency": "TMN"
  }
]
```

### Error Responses

- **400 Bad Request — Invalid Symbol**:
  ```json
  {
    "ok": false,
    "error": "invalid_symbol"
  }
  ```
- **500 Internal Server Error**:
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```

---

## 3. GET /api/symbols

Searches and filters the universal instrument catalogue across 8 asset classes.

- **Method**: `GET`
- **Path**: `/api/symbols`
- **Authentication**: None (public route)

### Request Query Parameters

| Parameter | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `q` | string | No | `''` | Max 64 chars | Case-insensitive search query matching symbol, English name, Persian name, base asset, or `tickerFa`. |
| `category` | string | No | `'all'` | Max 32 chars | Filter category: `'all'`, `'crypto'`, `'metals'`, `'commodities'`, `'forex'`, `'indices'`, `'stocks'`, `'iran_gold'`, `'iran_tse'`. |
| `exchange` | string | No | `'all'` | Max 32 chars | Case-insensitive exchange filter (e.g. `'binance'`, `'tsetmc'`). |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
[
  {
    "symbol": "BTCUSDT",
    "name": "Bitcoin",
    "nameFa": "بیت‌کوین",
    "category": "crypto",
    "base": "BTC",
    "quote": "USDT",
    "precision": 2,
    "minTick": 0.01,
    "lotSize": 0.0001,
    "exchange": "Binance",
    "market": "crypto",
    "currency": "USDT"
  },
  {
    "symbol": "FOOLAD",
    "name": "Mobarakeh Steel Co.",
    "nameFa": "فولاد مبارکه اصفهان",
    "category": "iran_tse",
    "base": "فولاد",
    "quote": "IRR",
    "precision": 0,
    "minTick": 10,
    "lotSize": 100,
    "exchange": "TSETMC",
    "market": "iran_tse",
    "currency": "IRR",
    "tickerFa": "فولاد",
    "insco": "46348559193224090"
  }
]
```

---

## 4. GET /api/symbol-info

Retrieves complete trading specification metadata for a single instrument.

- **Method**: `GET`
- **Path**: `/api/symbol-info`
- **Authentication**: None (public route)

### Request Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `symbol` | string | No | `'BTCUSDT'` | Target instrument symbol. |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
{
  "symbol": "XAUUSD",
  "name": "Gold / US Dollar Spot",
  "nameFa": "انس طلای جهانی",
  "category": "metals",
  "base": "XAU",
  "quote": "USD",
  "precision": 2,
  "minTick": 0.05,
  "lotSize": 1,
  "exchange": "OANDA",
  "market": "metals",
  "currency": "USD"
}
```

### Error Responses

- **400 Bad Request — Invalid Symbol**:
  ```json
  {
    "ok": false,
    "error": "invalid_symbol"
  }
  ```

---

## 5. GET /api/market-sources

Returns operational health, live latency, and protocol metadata for all 5 waterfall data sources.

- **Method**: `GET`
- **Path**: `/api/market-sources`
- **Authentication**: None (public route)

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
{
  "timestamp": "2026-10-23T20:00:00.000Z",
  "overallStatus": "live_crypto_demo_others",
  "liveCount": 1,
  "sources": [
    {
      "id": "binance_direct",
      "name": "Binance Market Data API",
      "nameFa": "داده بازار بایننس",
      "status": "online",
      "latencyMs": 42,
      "live": true,
      "protocol": "REST v3 (data-api.binance.vision)",
      "protocolFa": "REST نسخه ۳ (data-api.binance.vision)",
      "marketsCovered": ["Crypto Spot"],
      "marketsCoveredFa": ["اسپات کریپتو"],
      "tier": 1,
      "activeSymbols": 17
    },
    {
      "id": "forex_metals",
      "name": "Forex, Metals & Commodities",
      "nameFa": "فارکس، فلزات و کالاها",
      "status": "demo",
      "latencyMs": null,
      "live": false,
      "protocol": "Modelled demo series",
      "protocolFa": "سری نمایشی مدل‌سازی‌شده",
      "marketsCovered": ["Forex Majors", "Metals", "Energy"],
      "marketsCoveredFa": ["فارکس ماژور", "فلزات گرانبها", "انرژی"],
      "tier": 2,
      "activeSymbols": 14
    },
    {
      "id": "us_equities",
      "name": "US Indices & Equities",
      "nameFa": "شاخص‌ها و سهام آمریکا",
      "status": "demo",
      "latencyMs": null,
      "live": false,
      "protocol": "Modelled demo series",
      "protocolFa": "سری نمایشی مدل‌سازی‌شده",
      "marketsCovered": ["US Indices", "Equities"],
      "marketsCoveredFa": ["شاخص‌های آمریکا", "سهام"],
      "tier": 3,
      "activeSymbols": 10
    },
    {
      "id": "tehran_gold",
      "name": "Tehran Gold & Currencies",
      "nameFa": "طلا، سکه و ارز تهران",
      "status": "demo",
      "latencyMs": null,
      "live": false,
      "protocol": "Modelled demo series",
      "protocolFa": "سری نمایشی مدل‌سازی‌شده",
      "marketsCovered": ["Melted Gold", "18k Gram", "Coins", "Free USD", "USDT"],
      "marketsCoveredFa": ["آبشده", "طلای ۱۸ عیار", "سکه", "دلار آزاد", "تتر"],
      "tier": 4,
      "activeSymbols": 9
    },
    {
      "id": "tsetmc_bourse",
      "name": "Tehran Stock Exchange",
      "nameFa": "بورس و فرابورس تهران",
      "status": "demo",
      "latencyMs": null,
      "live": false,
      "protocol": "Modelled demo series",
      "protocolFa": "سری نمایشی مدل‌سازی‌شده",
      "marketsCovered": ["Iranian Equities", "ETFs"],
      "marketsCoveredFa": ["سهام بورس و فرابورس", "صندوق‌ها"],
      "tier": 5,
      "activeSymbols": 16
    }
  ]
}
```

### Error Responses

- **500 Internal Server Error**:
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```

---

## 6. GET /api/depth

Retrieves Level 2 Depth of Market order book ladder (mirrored from Binance for crypto, simulated for others).

- **Method**: `GET`
- **Path**: `/api/depth`
- **Authentication**: None (public route)
- **Caching**: Micro-cached in server memory for 1,500 ms per `symbol:levels` key.

### Request Query Parameters

| Parameter | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `symbol` | string | No | `'BTCUSDT'` | Sanitized via `cleanSymbol()` | Target instrument symbol. |
| `levels` | integer | No | `15` | Clamped `1..50` | Requested number of bid/ask ladder rungs. |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
{
  "symbol": "BTCUSDT",
  "lastPrice": 68420.5,
  "spread": 0.5,
  "spreadPct": 0.00073,
  "bids": [
    { "level": 1, "price": 68420.0, "size": 1.25, "total": 1.25 },
    { "level": 2, "price": 68419.5, "size": 2.1, "total": 3.35 }
  ],
  "asks": [
    { "level": 1, "price": 68420.5, "size": 0.85, "total": 0.85 },
    { "level": 2, "price": 68421.0, "size": 3.4, "total": 4.25 }
  ],
  "maxDepth": 45.2,
  "source": "binance",
  "simulated": false,
  "timestamp": 1729684800000
}
```

### Error Responses

- **400 Bad Request — Invalid Symbol**:
  ```json
  {
    "ok": false,
    "error": "invalid_symbol"
  }
  ```
- **500 Internal Server Error**:
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```
