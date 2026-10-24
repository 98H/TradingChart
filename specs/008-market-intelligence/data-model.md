# Data Model: Market Intelligence

This document defines the data entities, field schemas, storage targets, validation constraints, and lifecycles for the Market Intelligence feature in Chartivia.

---

## 1. Congressional Trade

Represents a public stock transaction reported by a member of the United States House of Representatives or Senate pursuant to the Stop Trading on Congressional Knowledge (STOCK) Act.

- **Storage**: Server in-memory catalog `CONGRESSIONAL_TRADES` in `server/marketTrackers.js`; served via `GET /api/market-trackers?kind=congress|all`.
- **Client Cache**: Stored in `this.data.congressionalTrades` on `MarketTrackersView` instance (`client/src/marketTrackersView.js:20`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `id` | `string` | Unique identifier formatted as `ct-<number>` | `'ct-101'` |
  | `member` | `string` | Full name, party affiliation, and state abbreviation | `'Nancy Pelosi (D-CA)'` |
  | `chamber` | `'House' \| 'Senate'` | Legislative chamber | `'House'` |
  | `asset` | `string` | Traded ticker symbol | `'NVDA'` |
  | `assetDescription` | `string` | Corporate name and share class description | `'NVIDIA Corporation - Common Stock'` |
  | `txType` | `'Purchase' \| 'Sale'` | Direction of the trade | `'Purchase'` |
  | `txDate` | `string` | ISO date of execution (`YYYY-MM-DD`) | `'2026-08-14'` |
  | `disclosureDate` | `string` | ISO date of public filing (`YYYY-MM-DD`) | `'2026-09-02'` |
  | `amount` | `string` | Disclosed dollar bracket under STOCK Act rules | `'$1,000,001 - $5,000,000'` |
  | `priceEstimate` | `number` | Estimated price per share at transaction date | `124.50` |
  | `sourceUrl` | `string` | Absolute URL to the official House or Senate PDF disclosure | `'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20023411.pdf'` |
- **Validation**:
  - `txDate` and `disclosureDate` must match `/^\d{4}-\d{2}-\d{2}$/`.
  - `sourceUrl` must start with `https://disclosures-clerk.house.gov/` or `https://efdsearch.senate.gov/`.
- **Limits**: Curated static array of 5 entries.
- **Lifecycle**: Static server catalog; immutable at runtime; fetched once on `MarketTrackersView` initialization.

---

## 2. Insider Trade

Represents a direct acquisition, disposition, or option grant executed by a corporate insider (officer, director, or 10%+ beneficial owner) and filed on SEC Form 4 via the EDGAR system.

- **Storage**: Server in-memory catalog `INSIDER_TRADES` in `server/marketTrackers.js`; served via `GET /api/market-trackers?kind=insider|all`.
- **Client Cache**: Stored in `this.data.insiderTrades` on `MarketTrackersView` instance (`client/src/marketTrackersView.js:20`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `id` | `string` | Unique identifier formatted as `in-<number>` | `'in-201'` |
  | `company` | `string` | Corporate issuer name with ticker in parentheses | `'NVIDIA Corporation (NVDA)'` |
  | `insider` | `string` | Full name and corporate role | `'Huang Jen Hsun (CEO)'` |
  | `relationship` | `string` | Corporate capacity under SEC Section 16 | `'Officer / Director'` |
  | `form` | `'Form 4'` | SEC regulatory filing identifier | `'Form 4'` |
  | `filingDate` | `string` | ISO date of filing (`YYYY-MM-DD`) | `'2026-09-08'` |
  | `txType` | `string` | Nature of transaction and Rule 10b5-1 status | `'Sale (Rule 10b5-1)'` |
  | `shares` | `number` | Number of equity shares traded | `120000` |
  | `price` | `number` | Weighted average execution price in USD | `128.40` |
  | `value` | `number` | Total transaction value in USD (`shares * price`) | `15408000` |
  | `sourceUrl` | `string` | Direct URL to official SEC EDGAR XML/HTML filing | `'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000045/wf-form4_1725829102.xml'` |
- **Validation**:
  - `shares` > 0, `price` > 0, `value` = `shares * price`.
  - `sourceUrl` must point to `https://www.sec.gov/Archives/edgar/data/...`.
- **Limits**: Curated static array of 3 entries.
- **Lifecycle**: Static server catalog; immutable at runtime; fetched once on `MarketTrackersView` initialization.

---

## 3. 13F Hedge Fund Portfolio

Represents quarterly institutional equity holdings filed with the SEC on Form 13F by institutional investment managers exercising investment discretion over $100M+ in Section 13(f) securities.

- **Storage**: Server in-memory catalog `HEDGE_FUND_13F` in `server/marketTrackers.js`; served via `GET /api/market-trackers?kind=13f|all`.
- **Client Cache**: Stored in `this.data.hedgeFund13F` on `MarketTrackersView` instance (`client/src/marketTrackersView.js:20`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `fund` | `string` | Institutional asset manager or entity name | `'Berkshire Hathaway Inc.'` |
  | `manager` | `string` | Lead portfolio manager or Chief Investment Officer | `'Warren Buffett'` |
  | `period` | `string` | Reporting calendar quarter | `'Q2 2026'` |
  | `topHoldings` | `HoldingItem[]` | Array of top equity positions | See below |
- **Top Holdings Item (`HoldingItem`) Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `ticker` | `string` | US equity ticker symbol | `'AAPL'` |
  | `name` | `string` | Company corporate name | `'Apple Inc.'` |
  | `pctPortfolio` | `number` | Percentage allocation of 13F reported assets | `32.5` |
  | `shares` | `number` | Aggregate share count held | `385000000` |
  | `valueB` | `number` | Aggregate position value in billions of USD | `87.9` |
- **Limits**: Curated static array of 2 institutional funds, each holding 4-5 top positions.
- **Lifecycle**: Static server catalog; immutable at runtime; fetched once on `MarketTrackersView` initialization.

---

## 4. FINRA Short Sale Volume

Represents aggregate daily consolidated short-sale transaction volume reported by the Financial Industry Regulatory Authority (FINRA) for US equity symbols.

- **Storage**: Server in-memory catalog `FINRA_SHORT_VOLUME` in `server/marketTrackers.js`; served via `GET /api/market-trackers?kind=short_vol|all`.
- **Client Cache**: Stored in `this.data.finraShortVolume` on `MarketTrackersView` instance (`client/src/marketTrackersView.js:20`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `symbol` | `string` | Traded equity ticker symbol | `'NVDA'` |
  | `date` | `string` | ISO reporting date (`YYYY-MM-DD`) | `'2026-09-15'` |
  | `shortVolume` | `number` | Number of executed shares classified as short sales | `42180000` |
  | `totalVolume` | `number` | Total executed volume across the consolidated tape | `89450000` |
  | `shortRatioPct` | `number` | Short volume percentage: `(shortVolume / totalVolume) * 100` | `47.15` |
- **Validation**:
  - `0 <= shortRatioPct <= 100`.
  - `shortVolume <= totalVolume`.
- **Limits**: Curated static array of 5 equity symbols (NVDA, AAPL, TSLA, SPY, AMD).
- **Lifecycle**: Static server catalog; immutable at runtime; fetched once on `MarketTrackersView` initialization.

---

## 5. Economic Event

Represents a scheduled macroeconomic data release or central bank monetary policy event.

- **Storage**: Server in-memory catalog `ECONOMIC_EVENTS` in `server/economicCalendar.js`; served via `GET /api/economic-calendar`.
- **Client Cache**: Stored in `this.events` on `EconomicCalendarView` instance (`client/src/economicCalendar.js:10`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `id` | `string` | Unique identifier formatted as `eco-<number>` | `'eco-1'` |
  | `date` | `string` | Human-readable date and time (`YYYY-MM-DD HH:mm`) | `'2026-09-18 12:30'` |
  | `timestamp` | `number` | Millisecond Unix epoch timestamp for chronological sorting | `1789734600000` |
  | `country` | `string` | 2-letter ISO country code | `'US'` |
  | `flag` | `string` | Unicode flag emoji | `'🇺🇸'` |
  | `currency` | `string` | 3-letter ISO currency code | `'USD'` |
  | `event` | `string` | Official release name in English | `'Core CPI (MoM)'` |
  | `eventFa` | `string` | Localized release name in Persian | `'شاخص تورم هسته مصرف‌کننده (ماهانه)'` |
  | `impact` | `'HIGH' \| 'MED' \| 'LOW'` | Market volatility impact level | `'HIGH'` |
  | `actual` | `string \| null` | Released actual figure (null if upcoming) | `null` or `'0.1%'` |
  | `forecast` | `string` | Consensus market expectation | `'0.2%'` |
  | `previous` | `string` | Prior period revised/reported figure | `'0.3%'` |
  | `unit` | `string` | Metric unit (`%`, `pts`, `K`, etc.) | `'%'` |
  | `category` | `string` | Thematic category in English | `'Inflation'` |
  | `categoryFa` | `string` | Thematic category in Persian | `'تورم'` |
- **Filtering**:
  - Server accepts `impact` (max 32 chars), `country` (max 32 chars), `category` (max 32 chars).
  - Client provides fast in-memory filters for: `impact: 'high'`, `country: 'US'`, `category: 'central bank'`, `category: 'inflation'`, and free-text search across `event`, `eventFa`, and `currency`.
- **Limits**: Curated static array of 10 events.
- **Lifecycle**: Static server catalog; served sorted chronologically by `timestamp`; fetched on mount and on refresh button click.

---

## 6. News Item

Represents a real-time breaking market headline, macro catalyst, or sentiment event tied to a specific financial asset.

- **Storage**: Server in-memory catalog `BREAKING_NEWS_CATALOG` in `server/newsFeed.js`; served via `GET /api/news`.
- **Client Cache**: Stored in `this.newsItems` on `MarketNewsView` instance (`client/src/marketNewsView.js:13`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `id` | `string` | Unique identifier formatted as `news_<number>` | `'news_1'` |
  | `symbol` | `string` | Primary asset ticker symbol | `'BTCUSDT'` |
  | `category` | `'crypto' \| 'metals' \| 'forex' \| 'equities' \| 'commodities'` | Asset category | `'crypto'` |
  | `titleEn` | `string` | Headline text in English | `'Bitcoin Surges Past Key Resistance as Spot ETF Inflows Reach Record Highs'` |
  | `titleFa` | `string` | Headline text in Persian | `'جهش بیت‌کوین به بالای مقاومت کلیدی همزمان با ثبت رکورد جریان ورودی ETFهای اسپات'` |
  | `source` | `string` | News wire or publication name | `'Bloomberg Markets'` |
  | `timeAgo` | `string` | Static relative time descriptor in English | `'5m ago'` |
  | `timestamp` | `number` | Millisecond Unix timestamp of the news release | `Date.now() - 300000` |
  | `sentiment` | `'bullish' \| 'bearish' \| 'neutral'` | Algorithmic sentiment polarity | `'bullish'` |
  | `impact` | `'high' \| 'medium'` | Market moving potential | `'high'` |
  | `summaryEn` | `string` | Contextual narrative summary in English | `'Institutional buying accelerates across global liquidity desks...'` |
  | `summaryFa` | `string` | Contextual narrative summary in Persian | `'شتاب خرید نهادی در میزهای معاملات نقدینگی جهان...'` |
- **Filtering & Search**:
  - Server accepts `category` (default `'all'`, max 32 chars), `symbol` (optional, sanitized), and `limit` (clamped 1-100, default 20).
  - Client filters in-memory by active category button and text query over title, summary, and symbol.
- **Limits**: Curated static array of 10 news items.
- **Lifecycle**: Polled by `MarketNewsView` every 15 seconds while `!document.hidden`.

---

## 7. Tehran Gold Snapshot & Coin Bubble

Represents live Tehran bullion market quotations (Melted Gold 17k Abshodeh, 18k Gram Gold, Ounce Spot, Free USD, Tether, Dirham) alongside an intrinsic valuation and bubble assessment for official Central Bank minted coins.

- **Storage**: Computed dynamically on each request by `server/dataFeed.js:getGoldMarketSnapshot`; served via `GET /api/gold-snapshot`.
- **Client Cache**: Stored in `this.data` on `GoldBubbleView` instance (`client/src/goldBubbleView.js:11`).
- **Snapshot Schema (`GoldSnapshot`)**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `timestamp` | `string` | ISO timestamp of calculation | `'2026-10-24T12:00:00.000Z'` |
  | `status` | `'online'` | Pipeline status | `'online'` |
  | `ounceUsd` | `number` | Global spot gold price per Troy ounce in USD | `2718.40` |
  | `usdFree` | `number` | Free Tehran market USD cash exchange rate in Tomans | `62800` |
  | `usdtNobitex` | `number` | Nobitex exchange USDT/Toman rate | `63100` |
  | `dirhamRate` | `number` | Dubai remittance AED rate in Tomans | `17150` |
  | `abshodeh` | `GoldQuote` | Tehran 17k Melted Gold quote (per Mesghal) | See below |
  | `gram18` | `GoldQuote` | Tehran 18k (750) Gram Gold quote | See below |
  | `coins` | `Record<string, CoinBubble>` | Dictionary of official Iranian coin valuations | See below |
- **Quote Schema (`GoldQuote`)**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `symbol` | `string` | Internal Chartivia symbol key | `'GOLD_ABSHODEH'` or `'GOLD_18K'` |
  | `name` | `string` | Display name in Persian | `'طلای آبشده ۱۷ عیار بنکداری تهران'` |
  | `price` | `number` | Current quotation in Tomans | `18450000` |
  | `change` | `number` | Daily price change in Tomans | `85000` |
  | `changePercent` | `number` | Daily percentage change | `0.46` |
  | `unit` | `string` | Physical trading unit | `'تومان / مثقال'` or `'تومان / گرم'` |
- **Coin Bubble Item Schema (`CoinBubble`)**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `coinKey` | `string` | Key identifier (`emami`, `bahar`, `nim`, `rob`, `gerami`) | `'emami'` |
  | `name` | `string` | Persian coin display name | `'سکه تمام بهار آزادی طرح جدید (امامی)'` |
  | `nameEn` | `string` | English coin display name | `'Emami Full Gold Coin'` |
  | `marketPrice` | `number` | Prevailing Tehran market price in Tomans | `52400000` |
  | `intrinsicValue` | `number` | Intrinsic melt value based on gold content in Tomans | `41200000` |
  | `bubbleAmount` | `number` | Monetary bubble in Tomans (`marketPrice - intrinsicValue`) | `11200000` |
  | `bubblePercent` | `number` | Percentage premium: `(bubbleAmount / marketPrice) * 100` | `21.4` |
  | `weightGrams` | `number` | Official coin weight in grams | `8.133` |
  | `purity` | `number` | Gold fineness ratio (900/1000 = 0.900) | `0.9` |
- **Coins Matrix**:
  - `emami`: 8.133g, 900‰ (21.6k), Mint wage: 200,000 Toman.
  - `bahar`: 8.133g, 900‰ (21.6k), Mint wage: 150,000 Toman.
  - `nim`: 4.0665g, 900‰ (21.6k), Mint wage: 120,000 Toman.
  - `rob`: 2.03325g, 900‰ (21.6k), Mint wage: 100,000 Toman.
  - `gerami`: 1.01g, 900‰ (21.6k), Mint wage: 80,000 Toman.
- **Lifecycle**: Computed statelessly on request; polled by `GoldBubbleView` every 4 seconds while mounted and visible.

---

## 8. TSETMC Tape (Tehran Stock Exchange Microstructure)

Represents real-time orderflow, volume distribution, and smart money telemetry for one Tehran equity instrument.

- **Storage**: Computed dynamically by `server/dataFeed.js:getTseMarketTape`; served via `GET /api/tse-tape?symbol=...`.
- **Client Cache**: Stored in `this.data` on `TseTapeView` instance (`client/src/tseTapeView.js:12`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `symbol` | `string` | Stock ticker symbol | `'FOOLAD'` |
  | `nameFa` | `string` | Persian corporate name | `'فولاد مبارکه اصفهان'` |
  | `timestamp` | `string` | ISO calculation timestamp | `'2026-10-24T12:00:00.000Z'` |
  | `lastPrice` | `number` | Last executed trade price in Rials | `4890` |
  | `closePrice` | `number` | Weighted closing price in Rials | `4870` |
  | `yesterdayPrice` | `number` | Prior session settlement price in Rials | `4850` |
  | `highPrice` | `number` | Session high price in Rials | `4980` |
  | `lowPrice` | `number` | Session low price in Rials | `4790` |
  | `volume` | `number` | Total shares traded in the session | `31250000` |
  | `value` | `number` | Total transaction turnover in Rials (`volume * lastPrice`) | `152812500000` |
  | `tradesCount` | `number` | Number of executed trade tickets | `4280` |
  | `change` | `number` | Absolute price change in Rials (`lastPrice - yesterdayPrice`) | `40` |
  | `changePercent` | `number` | Percentage change against yesterday | `0.82` |
  | `individualBuyVolume` | `number` | Shares bought by retail individuals (Haghighi) | `21875000` |
  | `individualSellVolume` | `number` | Shares sold by retail individuals | `19375000` |
  | `individualBuyCount` | `number` | Number of individual buyers | `1620` |
  | `individualSellCount` | `number` | Number of individual sellers | `2150` |
  | `institutionalBuyVolume` | `number` | Shares bought by legal/corporate entities (Hoghughi) | `9375000` |
  | `institutionalSellVolume` | `number` | Shares sold by legal/corporate entities | `11875000` |
  | `buyPerCapitaToman` | `number` | Retail buy volume per buyer in Tomans | `66014` |
  | `sellPerCapitaToman` | `number` | Retail sell volume per seller in Tomans | `44002` |
  | `buyerPowerRatio` | `number` | Ratio of buyer per-capita to seller per-capita | `1.50` |
  | `smartMoneyInflow` | `boolean` | Flagged true when `buyerPowerRatio >= 1.25` | `true` |
  | `suspiciousVolumeRatio` | `number` | Ratio of today's volume to 30-day average volume (18M) | `1.74` |
  | `queueStatus` | `string` | Iranian orderbook queue status | `'صف خرید (Buy Queue)'`, `'صف فروش (Sell Queue)'`, `'متعادل (Balanced)'` |
- **Supported Pre-configured Symbols**: `FOOLAD`, `FAMELI`, `KHODRO`, `SAIPA`, `SHASTA`, `AHRAM`, `AGAS`, `TALA`, `AYAR`, `TAVAN`, `SHPNA`, `SHETRAN`, `DARAYEKOM`, `PALAYESH`, `VABANKE`, `FARABOURSE`.
- **Lifecycle**: Computed statelessly on request; polled by `TseTapeView` every 3 seconds while mounted and visible.

---

## 9. Market Source Telemetry

Represents operational routing status, connectivity metrics, and protocol coverage across the platform's 5 data waterfall tiers.

- **Storage**: Generated in `server/dataFeed.js:getMarketSourceStatus`; served via `GET /api/market-sources`.
- **Client Cache**: Stored in `this.data` on `MarketSourcesModal` instance (`client/src/marketSourcesModal.js:10`).
- **Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `timestamp` | `string` | ISO timestamp of probe | `'2026-10-24T12:00:00.000Z'` |
  | `overallStatus` | `'live_crypto_demo_others' \| 'degraded'` | Aggregate platform data status | `'live_crypto_demo_others'` |
  | `liveCount` | `number` | Number of verified live upstream feeds | `1` |
  | `sources` | `SourceCard[]` | Array of 5 data tier descriptors | See below |
- **Source Card (`SourceCard`) Fields**:
  | Field | Type | Description | Example |
  |-------|------|-------------|---------|
  | `id` | `string` | Unique source identifier | `'binance_direct'`, `'forex_metals'`, etc. |
  | `name` | `string` | Source name in English | `'Binance Market Data API'` |
  | `nameFa` | `string` | Source name in Persian | `'داده بازار بایننس'` |
  | `status` | `'online' \| 'demo' \| 'degraded'` | Node operational status | `'online'` |
  | `latencyMs` | `number \| null` | Probed network ping in ms (null for demo feeds) | `48` |
  | `live` | `boolean` | True for live external exchange; false for demo series | `true` |
  | `protocol` | `string` | Technical communication protocol in English | `'REST v3 (data-api.binance.vision)'` |
  | `protocolFa` | `string` | Technical communication protocol in Persian | `'REST نسخه ۳ (data-api.binance.vision)'` |
  | `marketsCovered` | `string[]` | Asset coverage in English | `['Crypto Spot']` |
  | `marketsCoveredFa` | `string[]` | Asset coverage in Persian | `['اسپات کریپتو']` |
  | `tier` | `number` | Failover waterfall priority tier (1 to 5) | `1` |
  | `activeSymbols` | `number` | Count of active catalog symbols served by this tier | `15` |
- **Lifecycle**: Probe cached for 30s on server; queried on demand when opening `#modal-market-sources` or clicking "Ping Test" (`#btn-sources-refresh-ping`).
