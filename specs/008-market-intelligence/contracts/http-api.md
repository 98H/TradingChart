# HTTP API Contract: Market Intelligence

Normative REST HTTP endpoint specifications for alternative data trackers, economic calendar releases, breaking market news, Tehran gold & coin bubbles, TSETMC market tape, and data pipeline telemetry.

All routes are mounted under the `/api` prefix on the Express server (`server/index.js`).

---

## 1. `GET /api/market-trackers`

Retrieves institutional transparency and alternative market disclosures covering US Congressional trades, corporate insider Form 4 filings, hedge fund quarterly 13F portfolios, and FINRA short sale volume.

- **Method**: `GET`
- **Path**: `/api/market-trackers`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Validation / Values |
  |-----------|------|----------|---------|---------------------|
  | `kind` | `string` | No | `'all'` | One of `'all'`, `'congress'`, `'insider'`, `'13f'`, `'short_vol'`. Unrecognized values return empty arrays for all categories. |
- **Success Response (200 OK)**:
  ```json
  {
    "congressionalTrades": [
      {
        "id": "ct-101",
        "member": "Nancy Pelosi (D-CA)",
        "chamber": "House",
        "asset": "NVDA",
        "assetDescription": "NVIDIA Corporation - Common Stock",
        "txType": "Purchase",
        "txDate": "2026-08-14",
        "disclosureDate": "2026-09-02",
        "amount": "$1,000,001 - $5,000,000",
        "priceEstimate": 124.50,
        "sourceUrl": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20023411.pdf"
      }
    ],
    "insiderTrades": [
      {
        "id": "in-201",
        "company": "NVIDIA Corporation (NVDA)",
        "insider": "Huang Jen Hsun (CEO)",
        "relationship": "Officer / Director",
        "form": "Form 4",
        "filingDate": "2026-09-08",
        "txType": "Sale (Rule 10b5-1)",
        "shares": 120000,
        "price": 128.40,
        "value": 15408000,
        "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000045/wf-form4_1725829102.xml"
      }
    ],
    "hedgeFund13F": [
      {
        "fund": "Berkshire Hathaway Inc.",
        "manager": "Warren Buffett",
        "period": "Q2 2026",
        "topHoldings": [
          {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "pctPortfolio": 32.5,
            "shares": 385000000,
            "valueB": 87.9
          }
        ]
      }
    ],
    "finraShortVolume": [
      {
        "symbol": "NVDA",
        "date": "2026-09-15",
        "shortVolume": 42180000,
        "totalVolume": 89450000,
        "shortRatioPct": 47.15
      }
    ]
  }
  ```
  *Note*: If `kind` is set to a specific category (e.g. `kind=congress`), only that key contains items; other keys return empty arrays `[]`.
- **Error Responses**:
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 2. `GET /api/economic-calendar`

Retrieves scheduled global macroeconomic events and central bank rate decisions with impact levels and deviation attribution.

- **Method**: `GET`
- **Path**: `/api/economic-calendar`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Validation / Values |
  |-----------|------|----------|---------|---------------------|
  | `impact` | `string` | No | `'all'` | Case-insensitive filter (e.g. `'high'`, `'med'`, `'low'`, `'all'`). Clamped to $\le 32$ chars. |
  | `country` | `string` | No | `'all'` | Case-insensitive country code (e.g. `'US'`, `'GB'`, `'JP'`, `'EU'`, `'all'`). Clamped to $\le 32$ chars. |
  | `category` | `string` | No | `'all'` | Case-insensitive category name (e.g. `'inflation'`, `'central bank'`, `'employment'`, `'all'`). Clamped to $\le 32$ chars. |
- **Success Response (200 OK)**:
  ```json
  {
    "total": 10,
    "events": [
      {
        "id": "eco-1",
        "date": "2026-09-18 12:30",
        "timestamp": 1789734600000,
        "country": "US",
        "flag": "🇺🇸",
        "currency": "USD",
        "event": "Core CPI (MoM)",
        "eventFa": "شاخص تورم هسته مصرف‌کننده (ماهانه)",
        "impact": "HIGH",
        "actual": null,
        "forecast": "0.2%",
        "previous": "0.3%",
        "unit": "%",
        "category": "Inflation",
        "categoryFa": "تورم"
      }
    ]
  }
  ```
  - `total` (`number`): Total number of events matching the filter criteria.
  - `events` (`EconomicEvent[]`): Array of matching events sorted chronologically by `timestamp` ascending.
- **Error Responses**:
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 3. `GET /api/news`

Retrieves real-time breaking market headlines and macro catalysts tagged by sentiment, impact, and associated asset symbol.

- **Method**: `GET`
- **Path**: `/api/news`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Validation / Values |
  |-----------|------|----------|---------|---------------------|
  | `category` | `string` | No | `'all'` | One of `'all'`, `'crypto'`, `'metals'`, `'forex'`, `'equities'`, `'commodities'`. Clamped to $\le 32$ chars. |
  | `symbol` | `string` | No | `null` | Asset ticker filter (e.g. `'BTCUSDT'`). Sanitized via `cleanSymbol`. |
  | `limit` | `number` | No | `20` | Integer clamped between 1 and 100 via `clampInt(req.query.limit, 20, 1, 100)`. |
- **Success Response (200 OK)**:
  ```json
  {
    "total": 10,
    "news": [
      {
        "id": "news_1",
        "symbol": "BTCUSDT",
        "category": "crypto",
        "titleEn": "Bitcoin Surges Past Key Resistance as Spot ETF Inflows Reach Record Highs",
        "titleFa": "جهش بیت‌کوین به بالای مقاومت کلیدی همزمان با ثبت رکورد جریان ورودی ETFهای اسپات",
        "source": "Bloomberg Markets",
        "timeAgo": "5m ago",
        "timestamp": 1789700000000,
        "sentiment": "bullish",
        "impact": "high",
        "summaryEn": "Institutional buying accelerates across global liquidity desks with net inflows exceeding $850M in 24 hours.",
        "summaryFa": "شتاب خرید نهادی در میزهای معاملات نقدینگی جهان با ورود خالص بیش از ۸۵۰ میلیون دلار در ۲۴ ساعت گذشته."
      }
    ]
  }
  ```
  - `total` (`number`): Total count of returned news articles.
  - `news` (`NewsItem[]`): Array of news objects matching category and symbol criteria, limited to `limit` items.
- **Error Responses**:
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 4. `GET /api/gold-snapshot`

Calculates and delivers live Tehran gold bazaar quotes (17k Abshodeh, 18k Gram), global ounce, currency exchange rates, and coin bubble valuations.

- **Method**: `GET`
- **Path**: `/api/gold-snapshot`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "timestamp": "2026-10-24T12:00:00.000Z",
    "status": "online",
    "ounceUsd": 2718.40,
    "usdFree": 62800,
    "usdtNobitex": 63100,
    "dirhamRate": 17150,
    "abshodeh": {
      "symbol": "GOLD_ABSHODEH",
      "name": "طلای آبشده ۱۷ عیار بنکداری تهران",
      "price": 18450000,
      "change": 85000,
      "changePercent": 0.46,
      "unit": "تومان / مثقال"
    },
    "gram18": {
      "symbol": "GOLD_18K",
      "name": "طلای ۱۸ عیار (۷۵۰)",
      "price": 4250000,
      "change": 19500,
      "changePercent": 0.46,
      "unit": "تومان / گرم"
    },
    "coins": {
      "emami": {
        "coinKey": "emami",
        "name": "سکه تمام بهار آزادی طرح جدید (امامی)",
        "nameEn": "Emami Full Gold Coin",
        "marketPrice": 52400000,
        "intrinsicValue": 41200000,
        "bubbleAmount": 11200000,
        "bubblePercent": 21.4,
        "weightGrams": 8.133,
        "purity": 0.9
      },
      "bahar": {
        "coinKey": "bahar",
        "name": "سکه تمام بهار آزادی طرح قدیم",
        "nameEn": "Bahar Azadi Full Gold Coin",
        "marketPrice": 47200000,
        "intrinsicValue": 41150000,
        "bubbleAmount": 6050000,
        "bubblePercent": 12.8,
        "weightGrams": 8.133,
        "purity": 0.9
      },
      "nim": {
        "coinKey": "nim",
        "name": "نیم سکه بهار آزادی",
        "nameEn": "Half Gold Coin",
        "marketPrice": 28100000,
        "intrinsicValue": 20620000,
        "bubbleAmount": 7480000,
        "bubblePercent": 26.6,
        "weightGrams": 4.0665,
        "purity": 0.9
      },
      "rob": {
        "coinKey": "rob",
        "name": "ربع سکه بهار آزادی",
        "nameEn": "Quarter Gold Coin",
        "marketPrice": 18200000,
        "intrinsicValue": 10360000,
        "bubbleAmount": 7840000,
        "bubblePercent": 43.1,
        "weightGrams": 2.03325,
        "purity": 0.9
      },
      "gerami": {
        "coinKey": "gerami",
        "name": "سکه یک گرمی بانک مرکزی",
        "nameEn": "1-Gram Bank Gold Coin",
        "marketPrice": 8700000,
        "intrinsicValue": 5160000,
        "bubbleAmount": 3540000,
        "bubblePercent": 40.7,
        "weightGrams": 1.01,
        "purity": 0.9
      }
    }
  }
  ```
- **Error Responses**:
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 5. `GET /api/tse-tape`

Retrieves microstructure tape telemetry, retail vs institutional orderflow distribution, buyer power ratio, and smart money signals for a Tehran Stock Exchange equity.

- **Method**: `GET`
- **Path**: `/api/tse-tape`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Validation / Values |
  |-----------|------|----------|---------|---------------------|
  | `symbol` | `string` | No | `'FOOLAD'` | TSETMC ticker symbol. Validated via `cleanSymbol(req.query.symbol, 'FOOLAD')`. Must match `/^[A-Z0-9][A-Z0-9_.\-]{0,23}$/`. |
- **Success Response (200 OK)**:
  ```json
  {
    "symbol": "FOOLAD",
    "nameFa": "فولاد مبارکه اصفهان",
    "timestamp": "2026-10-24T12:00:00.000Z",
    "lastPrice": 4890,
    "closePrice": 4870,
    "yesterdayPrice": 4850,
    "highPrice": 4980,
    "lowPrice": 4790,
    "volume": 31250000,
    "value": 152812500000,
    "tradesCount": 4280,
    "change": 40,
    "changePercent": 0.82,
    "individualBuyVolume": 21875000,
    "individualSellVolume": 19375000,
    "individualBuyCount": 1620,
    "individualSellCount": 2150,
    "institutionalBuyVolume": 9375000,
    "institutionalSellVolume": 11875000,
    "buyPerCapitaToman": 66014,
    "sellPerCapitaToman": 44002,
    "buyerPowerRatio": 1.50,
    "smartMoneyInflow": true,
    "suspiciousVolumeRatio": 1.74,
    "queueStatus": "متعادل (Balanced)"
  }
  ```
- **Error Responses**:
  - **400 Bad Request**:
    ```json
    {
      "ok": false,
      "error": "invalid_symbol"
    }
    ```
    Triggered when `req.query.symbol` fails regex sanitation (e.g. contains special characters, spaces, or exceeds 24 characters).
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 6. `GET /api/market-sources`

Queries the operational health, ping latency, and protocol coverage across the 5 market data waterfall tiers, running a live reachability probe against Binance Vision.

- **Method**: `GET`
- **Path**: `/api/market-sources`
- **Authentication**: Anonymous / Public.
- **Headers**:
  - `Accept: application/json`
- **Query Parameters**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "timestamp": "2026-10-24T12:00:00.000Z",
    "overallStatus": "live_crypto_demo_others",
    "liveCount": 1,
    "sources": [
      {
        "id": "binance_direct",
        "name": "Binance Market Data API",
        "nameFa": "داده بازار بایننس",
        "status": "online",
        "latencyMs": 48,
        "live": true,
        "protocol": "REST v3 (data-api.binance.vision)",
        "protocolFa": "REST نسخه ۳ (data-api.binance.vision)",
        "marketsCovered": [
          "Crypto Spot"
        ],
        "marketsCoveredFa": [
          "اسپات کریپتو"
        ],
        "tier": 1,
        "activeSymbols": 15
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
        "marketsCovered": [
          "Forex Majors",
          "Metals",
          "Energy"
        ],
        "marketsCoveredFa": [
          "فارکس ماژور",
          "فلزات گرانبها",
          "انرژی"
        ],
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
        "marketsCovered": [
          "US Indices",
          "Equities"
        ],
        "marketsCoveredFa": [
          "شاخص‌های آمریکا",
          "سهام"
        ],
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
        "marketsCovered": [
          "Melted Gold",
          "18k Gram",
          "Coins",
          "Free USD",
          "USDT"
        ],
        "marketsCoveredFa": [
          "آبشده",
          "طلای ۱۸ عیار",
          "سکه",
          "دلار آزاد",
          "تتر"
        ],
        "tier": 4,
        "activeSymbols": 10
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
        "marketsCovered": [
          "Iranian Equities",
          "ETFs"
        ],
        "marketsCoveredFa": [
          "سهام بورس و فرابورس",
          "صندوق‌ها"
        ],
        "tier": 5,
        "activeSymbols": 16
      }
    ]
  }
  ```
  - `overallStatus`: `'live_crypto_demo_others'` when Binance Vision probe succeeds; `'degraded'` if probe times out or fails.
  - `liveCount`: Count of operational live upstream data sources (`1` when Binance is reachable).
- **Error Responses**:
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```
