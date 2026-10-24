# Quickstart & Verification: Market Intelligence

Guide for launching the Chartivia application, running automated regression suites, and manually verifying each user story on the running application.

---

## 1. Prerequisites and Server Startup

Ensure Node.js v20+ is active and start the Chartivia application server on port 8088:

```bash
cd /root/TradingChart
export SDD_BASE_URL="http://127.0.0.1:8088"
export PORT=8088

# Check if the service is already running
curl -s -o /dev/null -w "%{http_code}\n" "$SDD_BASE_URL/chart"
# Expected output: 200
```

If the service is not currently running, launch it:

```bash
bash scripts/build_and_restart.sh
```

---

## 2. Automated Test Suites

Three automated test suites in the `tests/` directory verify the components of Market Intelligence:

### 2.1 Tehran Gold, TSE Tape & Market Sources Deep Audit
Runs end-to-end Puppeteer verification covering Market Sources modal open/close, latency metrics, Gold & Coin Bubble studio, TSE tape microstructure, symbol switching to FAMELI, Persian RTL localization, polling interval cleanup on tab change, and mobile 390px viewport fit:

```bash
node tests/qa_iran_and_sources_deep.cjs
```
*Expected output*:
```text
═══════════════════════════════════════════════════════════════════
   TRADINGCHART QA: GOLD, TSE TAPE & MARKET DATA PIPELINE SUITE   
═══════════════════════════════════════════════════════════════════
  ✓ [PASS] Market Sources Modal Open — Mounted with 5 data routes and live latency
  ✓ [PASS] Market Sources Modal Close — Dismissed cleanly on close button click
  ✓ [PASS] Gold & Bubble Studio Mount — Rendered live metrics with 5 table rows and 4 summary cards
  ✓ [PASS] TSE Market Tape Mount — Mounted with 8 quick symbol chips and live buyer power
  ✓ [PASS] TSE Symbol Switch — Successfully switched tape view to FAMELI
  ✓ [PASS] Persian RTL Localization — Tabs translated (Gold: "حباب طلای تهران", TSE: "تابلوخوانی بورس")
  ✓ [PASS] Resource Protection & Polling Cleanup — Both Gold and TSE polling intervals cleanly dismantled on tab change
  ✓ [PASS] Mobile Drawer Items — Gold, TSE Tape, and Market Pipeline cards present in mobile panels drawer
  ✓ [PASS] Mobile Market Sources Fit — Modal width 370px cleanly fits within 390px viewport
  ✓ [PASS] Mobile Touch Ergonomics — All touch elements meet touch target ergonomics standards
TOTAL PASSES: 10
TOTAL DEFECTS: 0
```

### 2.2 Diagnostic Suite: Modules & Render Verification
Validates that `economicCalendar`, `marketNews`, and `marketTrackers` instances are initialized on `window.__TRADING_APP__` and expose valid `render` functions:

```bash
node tests/qa_diag.cjs
```
*Expected output*: Confirms `{ n: "economicCalendar", has: true, render: true }`, `{ n: "marketNews", has: true, render: true }`, and `{ n: "marketTrackers", has: true, render: true }`.

### 2.3 Modal Lifecycle Suite
Verifies that the topbar source button `#btn-topbar-market-source` correctly triggers and renders `#modal-market-sources`:

```bash
node tests/qa_crusade_omni.cjs
```
*Expected output*: `ZERO DEFECTS ✅` for the Market Sources modal flow.

---

## 3. Manual Verification Steps by User Story

Open the application in a modern browser at:
`http://127.0.0.1:8088/chart`

---

### User Story 1 — Disclosure Trackers (Priority: P2)

1. **Open Trackers Tab**:
   - In the bottom panel tabs bar, click **Trackers** (`پایش بازار (SEC)`).
   - *Verification*: The bottom panel expands (`#bottom-panel` drops `.collapsed`), `#view-trackers` becomes active, and four subtabs are visible:
     - "Congressional Stock Trades" / "معاملات نمایندگان کنگره آمریکا"
     - "SEC Form 4 Insider Trades" / "معاملات مدیران ارشد (Form 4)"
     - "Hedge Fund 13F Portfolios" / "پرتفوی صندوق‌های تامینی (13F)"
     - "FINRA Short Sale Volume" / "حجم معاملات شورت FINRA"
   - A yellow demo disclaimer note is rendered at the top:
     *"Sample data to demonstrate the feature; consult the official filings before trading decisions."* / *"داده نمونه برای نمایش قابلیت‌ها؛ برای تصمیم معاملاتی به اسناد رسمی مراجعه کنید."*
2. **Switch Subtabs**:
   - Click **SEC Form 4 Insider Trades**. The subtab turns cyan (`var(--accent-cyan)`), and an 8-column table displays insider transactions for NVIDIA, Tesla, and Apple.
   - Click **Hedge Fund 13F Portfolios**. Berkshire Hathaway and Citadel portfolio holding cards are rendered.
   - Click **FINRA Short Sale Volume**. A 5-column table shows daily short volume ratios.
3. **Filter Disclosures**:
   - Return to **Congressional Stock Trades** and type `Pelosi` into `#tracker-filter-input`.
   - *Verification*: Only the Nancy Pelosi (NVDA) transaction row remains visible. Clear the search box.
4. **Verify Outbound Filing Links**:
   - Click the link **View Disclosure PDF ↗** on any row.
   - *Verification*: A new browser tab opens pointing to the official House or Senate disclosure PDF (`disclosures-clerk.house.gov` or `efdsearch.senate.gov`).

---

### User Story 2 — Economic Calendar (Priority: P2)

1. **Open Economic Calendar Tab**:
   - In the bottom panel tabs bar, click **Economic Calendar** (`تقویم اقتصادی`).
   - *Verification*: `#view-calendar` activates. If any releases are scheduled for the future, a red highlight banner displays the next upcoming release (e.g. Core CPI) with country flag, forecast, and impact badge.
2. **Apply Impact & Category Filters**:
   - Click **High Impact 🔥** (`اثر شدید 🔥`).
   - *Verification*: The button turns red. The event list updates immediately to display only high-impact events (CPI, FOMC, BoE, BoJ, Retail Sales, NFP).
   - Click **High Impact 🔥** a second time.
   - *Verification*: The filter toggles off and reverts to "All Events" (`همه رویدادها`).
   - Click **🏛️ Central Banks** (`بانک‌های مرکزی`). Only central bank releases remain.
3. **Search Releases**:
   - In `#calendar-search-input`, type `CPI`.
   - *Verification*: Only the Core CPI event card is displayed.
4. **Refresh Releases**:
   - Click `#btn-refresh-calendar`.
   - *Verification*: Network tab shows a fresh `GET /api/economic-calendar` request and the list re-renders.

---

### User Story 3 — Market News (Priority: P2)

1. **Open Market News Tab**:
   - In the bottom panel tabs bar, click **Market News** (`اخبار بازار`).
   - *Verification*: `#view-news` activates. News cards render with category filter pills at the top, a search input, sentiment badges (🟢 Bullish, 🔴 Bearish, ⚪ Neutral), and relative time badges (`5m ago`, `18m ago`).
2. **Filter by Asset Category**:
   - Click the **Crypto** (`ارز دیجیتال`) category pill.
   - *Verification*: Only cryptocurrency headlines (Bitcoin, Ethereum, Solana, BNB) are shown.
   - Click **Commodities** (`کالاها`). Only crude oil / energy headlines appear.
3. **Search News & Empty State**:
   - In `#news-search-input`, type `UnmatchedTokenQuery123`.
   - *Verification*: The list displays the empty-state banner:
     *"No headlines matched active filter."* / *"خبری مطابق با فیلتر جاری یافت نشد."*
   - Clear the search input. All headlines return.
4. **1-Click Chart Symbol Switching**:
   - Locate the headline mentioning `BTCUSDT` or `NVDA`.
   - Click the symbol pill `.news-sym-pill[data-symbol="BTCUSDT"]`.
   - *Verification*: The primary candlestick chart switches immediately to `BTCUSDT`, the topbar displays `BTCUSDT`, and an execution toast `SYMBOL 1 BTCUSDT` is displayed.
5. **Background Polling Verification**:
   - Keep the tab open for 15 seconds. Observe the network inspector: a background `GET /api/news?category=...&limit=30` request fires every 15 seconds while the document is visible.

---

### User Story 4 — Tehran Gold and Coin Bubbles (Priority: P2)

1. **Open Gold & Bubbles Tab**:
   - In the bottom panel tabs bar, click **Gold & Bubbles** (`حباب طلای تهران`).
   - *Verification*: `#view-gold` activates. The studio header displays the institutional formulation formula:
     $$\text{ارزش ذاتی = [(انس جهانی × نرخ دلار / ۳۱.۱۰۳۵) × وزن × عیار] + حق ضرب بانک مرکزی}$$
2. **Verify 4 Market Pillar Cards**:
   - Check the 4 cards at the top of the studio:
     - **Card 1**: Melted Gold 17k Mesghal (`مظنه مثقال آبشده ۱۷ عیار`) in Tomans with daily change.
     - **Card 2**: 18k Gram Gold (`یک گرم طلای ۱۸ عیار`).
     - **Card 3**: Global Spot Ounce (`انس طلای جهانی Spot`) in USD.
     - **Card 4**: Free USD Cash / Nobitex USDT (`دلار آزاد / تتر نوبیتکس`) with Dubai Dirham remittance rate.
3. **Verify Coin Bubble Table**:
   - Check the table below the cards. 5 coin rows are listed (Emami, Bahar, Nim, Rob, Gerami) with:
     - Market Price (`قیمت بازار`)
     - Intrinsic Value (`ارزش ذاتی طلا`)
     - Bubble Amount (`مبلغ حباب`)
     - Bubble % (`درصد حباب` colored green, amber, or red depending on threshold)
     - Physical specifications (weight in grams and purity)
4. **Switch Chart to Gold Instruments**:
   - In the studio header, click **Melted Gold Chart** (`چارت طلای آبشده`).
   - *Verification*: Primary chart switches to `GOLD_ABSHODEH`, and topbar source badge indicates `TEHRAN GOLD DEMO` (`طلای تهران نمایشی`).
   - Return to the Gold tab and click **Chart** (`مشاهده چارت`) on the **Emami** row.
   - *Verification*: Primary chart switches to `COIN_EMAMI`.
5. **Polling Telemetry**:
   - Look at the table header badge `#gold-last-updated`: shows *"Online (4s live telemetry)"* / *"برخط (پایش زنده هر ۴ ثانیه)"*.

---

### User Story 5 — TSE Tape & Smart Money (Priority: P2)

1. **Open TSE Tape Tab**:
   - In the bottom panel tabs bar, click **TSE Tape** (`تابلوخوانی بورس`).
   - *Verification*: `#view-tse` activates. The title displays the default active symbol `FOOLAD` (`فولاد مبارکه اصفهان`).
2. **Inspect Scoreboard Cards**:
   - **Last Price Card**: Displays last traded price in Rials, price change percentage, and close/yesterday prices.
   - **Buyer Power Ratio Card**: Displays buyer-to-seller ratio (e.g. `1.50x`), power status badge (🟢 Strong Buyer / 🔴 Seller Dominated / 🟡 Balanced), and smart money inflow signal (`⚡ Smart Money Inflow Verified` / `⚡ سیگنال ورود پول هوشمند تایید شد`).
   - **Per-Capita Volume Card**: Displays retail buy and sell per-capita in Tomans.
   - **Suspicious Volume & Queue Card**: Displays volume multiple relative to 30-day average and queue status (Buy Queue / Sell Queue / Balanced).
3. **Inspect Volume Distribution Bar**:
   - The two-tone progress bar displays retail (Haghighi) volume percentage in green vs institutional (Hoghughi) volume percentage in blue.
4. **Switch TSE Symbols via Quick Chips**:
   - Click the **FAMELI** (`ملی مس`) chip.
   - *Verification*: The chip highlights cyan, `#tse-active-sym-title` updates to `FAMELI`, and all tape metrics refresh immediately with FAMELI base parameters.
5. **Open Symbol Chart**:
   - Click **Open Symbol Chart** (`مشاهده چارت نماد`).
   - *Verification*: Primary chart loads `FAMELI` OHLCV bars.

---

### User Story 6 — Multi-Surface Panels & Mobile Ergonomics (Priority: P3)

1. **Desktop Right-Dock Panels**:
   - On desktop, locate the right-hand vertical tool rail (`.rail-btn`).
   - Click the **Economic Calendar** icon (`[data-panel="calendar"]`).
   - *Verification*: The Vela right dock slides out (width 420px), mounting `EconomicCalendarView`.
   - Click the **Market News** icon (`[data-panel="news"]`).
   - *Verification*: The right dock displays `MarketNewsView`.
   - If the user account plan does not include `marketTrackers` or `economicCalendar`, a feature-locked upgrade card is rendered with an upgrade CTA button.
2. **Market Sources Inspector Modal**:
   - In the top header bar, click the market data source button `#btn-topbar-market-source` (`BINANCE LIVE` or `DEMO`).
   - *Verification*: `#modal-market-sources` opens showing:
     - Live crypto connectivity status and average latency in ms.
     - "Ping Test" button `#btn-sources-refresh-ping`.
     - 5 waterfall cards (Tier 1 Binance Spot, Tier 2 Forex & Metals, Tier 3 US Stocks, Tier 4 Tehran Gold, Tier 5 TSE Bourse).
   - Click **Ping Test**. Latency metric updates.
   - Click `#modal-close-sources` or the backdrop. The modal dismisses cleanly.
3. **Mobile Drawer Navigation ($\le 768\text{px}$)**:
   - Resize browser window to 390px width or open Chrome DevTools device mode (iPhone 12/13/14).
   - Click the **+Panels** topbar pill (`#nav-btn-panels`).
   - *Verification*: The mobile drawer `#modal-panels-menu` slides up, containing menu items for **Tehran Gold & Bubbles**, **Iran Bourse & Tape**, and **Market Data Pipeline**.
   - Tap **Tehran Gold & Bubbles**.
   - *Verification*: Bottom panel opens with the Gold studio view active.
   - Reopen **+Panels** and tap **Market Data Pipeline**.
   - *Verification*: `#modal-market-sources` opens, sizing cleanly within 390px without horizontal scrolling.
