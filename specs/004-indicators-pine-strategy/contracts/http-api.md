# HTTP API Contract: Technical Screener & Market Tickers

Backend HTTP endpoints in `server/index.js` and `server/technicalScreener.js` that provide technical analysis indicators, institutional ratings, and real-time price statistics consumed by `TechnicalRatingCard` and `TechnicalScreenerView`.

---

## 1. GET /api/screener

Fetches multi-asset technical screening indicators, RSI-14 values, moving average trends, and algorithmic consensus ratings.

- **Method**: `GET`
- **Path**: `/api/screener`
- **Authentication**: None (public route)
- **Rate Limit**: Governed by general API rate limiting (100 req/min per IP).
- **Caching**: Demand-driven in-memory cache refreshed every 8 seconds when active requests occur.

### Request Query Parameters

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `category` | string | No | max 32 chars, default: `'all'` | Asset category filter: `'all'`, `'crypto'`, `'metals'`, `'commodities'`, `'forex'`, `'indices'`, `'stocks'`, `'iran_gold'`, `'iran_tse'`. |
| `rating` | string | No | max 32 chars, default: `'all'` | Technical consensus filter: `'all'`, `'strong_buy'`, `'buy'`, `'sell'`, `'strong_sell'`, `'overbought'`, `'oversold'`. |
| `search` | string | No | max 32 chars, default: `''` | Case-insensitive substring search matching `symbol`, `name`, `nameFa`, or `tickerFa`. |

### Response (200 OK)

Content-Type: `application/json; charset=utf-8`

```json
{
  "total": 1,
  "items": [
    {
      "symbol": "BTCUSDT",
      "tickerFa": "بیت‌کوین",
      "name": "Bitcoin",
      "nameFa": "بیت‌کوین / تتر",
      "category": "crypto",
      "exchange": "Binance",
      "price": 68420.5,
      "priceChange": 1420.5,
      "priceChangePercent": 2.12,
      "highPrice": 69100.0,
      "lowPrice": 67000.0,
      "volume": 24500.12,
      "rsi14": 62.4,
      "sma20": 67800.0,
      "sma50": 65400.0,
      "trend": "Bullish",
      "technicalRating": "Buy",
      "technicalScore": 1.25,
      "precision": 2,
      "updatedAt": 1729684800000,
      "stale": false,
      "unavailable": false
    }
  ]
}
```

### Error Responses

- **500 Internal Server Error**: Unexpected exception during screener cache refresh or data computation.
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```

---

## 2. GET /api/tickers

Retrieves 24-hour ticker statistics (last price, high, low, volume, price change) for up to 40 requested symbols.

- **Method**: `GET`
- **Path**: `/api/tickers`
- **Authentication**: None (public route)
- **Rate Limit**: Governed by general API rate limiting.

### Request Query Parameters

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `symbols` | string | No | max 40 symbols, comma-separated | Default: `'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD'`. Cleaned and deduplicated. |

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
    "quoteVolume": 1676298240.0,
    "openPrice": 67000.0
  }
]
```

### Error Responses

- **400 Bad Request**: When all provided symbols are invalid or empty.
  ```json
  {
    "ok": false,
    "error": "invalid_symbol"
  }
  ```

- **500 Internal Server Error**: Unexpected server failure during data feed retrieval.
  ```json
  {
    "ok": false,
    "error": "internal_error"
  }
  ```
