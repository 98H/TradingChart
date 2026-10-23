# HTTP & WebSocket API Contract: Chart Workspace Shell

Server endpoints supporting data feeding, instrument discovery, health reporting, platform announcements, and live price streaming.

---

## 1. `GET /api/candles`

Fetches historical and live candlestick data for a given market symbol and timeframe.

- **Authentication**: Anonymous or Session (`req.user`).
- **Method**: `GET`
- **Path**: `/api/candles`
- **Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `symbol` | string | Yes | — | Instrument symbol (e.g. `BTCUSDT`, `GOLD_18K`, `EURUSD`). Cleaned via regex. |
| `timeframe` | string | No | `'60'` | Interval specification. Regex: `/^[0-9]{1,4}[smhdwSMHDW]?$|^[DWM]$/`. |
| `from_time` | number | No | — | Start timestamp in seconds or milliseconds. |
| `to_time` | number | No | — | End timestamp in seconds or milliseconds. |
| `limit` | integer| No | `500` | Requested bar count. Clamped between `1` and the plan's `histBars` limit. |

- **Response Headers**:
  - `X-History-Limit`: Number string reflecting the maximum candle depth permitted by the user's plan tier (e.g. `10000`, `20000`, `40000`).

- **Success Response (200 OK)**:
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "60",
  "count": 500,
  "candles": [
    {
      "time": 1729700000000,
      "open": 67450.2,
      "high": 67800.0,
      "low": 67320.5,
      "close": 67680.1,
      "volume": 412.35
    }
  ]
}
```

- **Error Responses**:
  - **400 Bad Request**: Invalid input parameters.
    - `{ "ok": false, "error": "invalid_symbol" }`
    - `{ "ok": false, "error": "invalid_timeframe" }`
    - `{ "ok": false, "error": "invalid_time" }`
  - **404 Not Found**: Symbol has no active feed or history.
    - `{ "symbol": "UNKNOWN", "timeframe": "60", "count": 0, "candles": [], "error": "no_market_data" }`
  - **500 Internal Server Error**:
    - `{ "ok": false, "error": "server_error" }`

---

## 2. `GET /api/tickers`

Retrieves 24-hour summary price, volume, and percentage shift data for a list of markets.

- **Authentication**: Anonymous / Session.
- **Method**: `GET`
- **Path**: `/api/tickers`
- **Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `symbols` | string | No | `'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XAUUSD,EURUSD'` | Comma-separated list of symbols (max 40 distinct symbols). |

- **Success Response (200 OK)**:
```json
[
  {
    "symbol": "BTCUSDT",
    "lastPrice": 67680.1,
    "priceChange": 1250.4,
    "priceChangePercent": 1.88,
    "highPrice": 68100.0,
    "lowPrice": 66200.0,
    "volume": 28410.5,
    "quoteVolume": 1918234500.0
  }
]
```

- **Error Responses**:
  - **400 Bad Request**:
    - `{ "ok": false, "error": "invalid_symbol" }`
  - **500 Internal Server Error**:
    - `{ "ok": false, "error": "server_error" }`

---

## 3. `GET /api/symbols`

Search and filtering endpoint for the universal instrument catalogue.

- **Authentication**: Anonymous / Session.
- **Method**: `GET`
- **Path**: `/api/symbols`
- **Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | `''` | Search query matching symbol, English name, Persian name, or base asset (max 64 chars). |
| `category` | string | No | `'all'` | Category filter (`crypto`, `metals`, `commodities`, `forex`, `indices`, `stocks`, `iran_gold`, `iran_tse`). |
| `exchange` | string | No | `'all'` | Sourcing venue filter (e.g. `binance`, `oanda`, `tsetmc`, `global`). |

- **Success Response (200 OK)**:
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
    "symbol": "GOLD_18K",
    "name": "18k Gram Gold 750",
    "nameFa": "طلای ۱۸ عیار (۷۵۰ گرمی)",
    "tickerFa": "طلا ۱۸",
    "category": "iran_gold",
    "base": "GOLD18K",
    "quote": "TMN",
    "precision": 0,
    "minTick": 1000,
    "lotSize": 1,
    "exchange": "Tehran Bazaar",
    "market": "iran_gold",
    "currency": "TMN"
  }
]
```

---

## 4. `GET /api/symbol-info`

Provides instrument metadata and trading parameters for a single instrument.

- **Authentication**: Anonymous / Session.
- **Method**: `GET`
- **Path**: `/api/symbol-info`
- **Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `symbol` | string | Yes | `'BTCUSDT'` | Instrument symbol. |

- **Success Response (200 OK)**:
```json
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
}
```

- **Error Responses**:
  - **400 Bad Request**:
    - `{ "ok": false, "error": "invalid_symbol" }`

---

## 5. `GET /api/platform`

Public configuration and announcement status for client banner mounting and registration state.

- **Authentication**: Anonymous / Session.
- **Method**: `GET`
- **Path**: `/api/platform`
- **Response Headers**:
  - `Cache-Control: no-store`

- **Success Response (200 OK)**:
```json
{
  "ok": true,
  "registrationOpen": true,
  "maintenanceMode": false,
  "announcement": {
    "level": "info",
    "fa": "بهبودهای جدید در موتور چارت اعمال شد.",
    "en": "New chart engine enhancements are live.",
    "updatedAt": 1729701234567
  },
  "emailDelivery": true
}
```
*(When no announcement is active or enabled by admin, `"announcement": null` is returned).*

---

## 6. `GET /api/health`

Public service liveness and platform identifier endpoint.

- **Authentication**: Anonymous.
- **Method**: `GET`
- **Path**: `/api/health`

- **Success Response (200 OK)**:
```json
{
  "status": "online",
  "product": "Chartivia",
  "timestamp": "2026-10-23T19:40:00.000Z"
}
```

---

## 7. `WS /ws/live`

Real-time streaming ticker channel for price updates and latency telemetry.

- **Protocol**: WebSocket (RFC 6455).
- **Endpoint**: `ws://${HOST}:${PORT}/ws/live`
- **Subscription Capacity**: Up to 50 symbols per client connection.
- **Client Messages**:
  - **Subscribe**:
    ```json
    { "action": "subscribe", "symbol": "ETHUSDT" }
    ```
  - **Unsubscribe**:
    ```json
    { "action": "unsubscribe", "symbol": "ETHUSDT" }
    ```
- **Server Broadcast Payload (type: `tick`)**:
  - Cadence: Evaluated and emitted every 1200 ms for active subscriptions.
```json
{
  "type": "tick",
  "symbol": "BTCUSDT",
  "price": 67680.1,
  "change": 1250.4,
  "changePct": 1.88,
  "high": 68100.0,
  "low": 66200.0,
  "volume": 28410.5,
  "time": 1729701235000
}
```
