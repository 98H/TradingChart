# Quickstart: Market Data Feed

Step-by-step instructions for running the platform, manually verifying each of the 5 user stories on the running application, and executing existing automated Puppeteer test suites.

---

## 1. Environment & Setup

Ensure Node.js v20+ is installed and dependencies are installed in the project root.

```bash
# Set base test URL (default port 8088)
export SDD_BASE_URL="${SDD_BASE_URL:-http://127.0.0.1:8088}"

# Start the application server
npm run start
# Or launch dev mode with Vite live reload:
npm run dev
```

Open a modern evergreen browser (Chromium, Firefox, Safari) and navigate to:
`${SDD_BASE_URL}/chart`

---

## 2. Manual Verification by User Story

### User Story 1 — Candles for any catalogue market (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Inspect network requests using DevTools (`F12` -> Network tab, filter `/api/candles`).
3. Verify default crypto candles:
   - On initial boot, the chart loads `BTCUSDT` at timeframe `60`.
   - Request `GET /api/candles?symbol=BTCUSDT&timeframe=60&limit=2000` returns `200 OK` with JSON `{ symbol: "BTCUSDT", timeframe: "60", count: 2000, candles: [...] }`.
   - Inspect response headers: verify `X-History-Limit: 10000` is present for guest/basic callers.
   - Verify each candle object contains `time`, `open`, `high`, `low`, `close`, `volume`, and `closeTime`.
4. Switch to non-crypto markets:
   - Open symbol search (press `/` or click `#btn-topbar-symbol`).
   - Select `XAUUSD` (Gold): Verify candles load smoothly without errors.
   - Select `FOOLAD` (Tehran Stock Exchange): Verify candles load with Rial pricing.
   - Select `GOLD_ABSHODEH` (Tehran Gold Bazaar): Verify candles load with Toman pricing.
5. Error handling checks:
   - Run in browser console or curl:
     ```bash
     curl -s "${SDD_BASE_URL}/api/candles?symbol=INVALID_SYM!&timeframe=60"
     # Returns: {"ok":false,"error":"invalid_symbol"}
     curl -s "${SDD_BASE_URL}/api/candles?symbol=BTCUSDT&timeframe=invalid_tf"
     # Returns: {"ok":false,"error":"invalid_timeframe"}
     ```

---

### User Story 2 — Live updates (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Open DevTools Network tab, filter by `WS`.
3. Locate the connection to `/ws/live`.
4. **Verification**:
   - WebSocket status is `101 Switching Protocols`.
   - On connect, inspect messages: server broadcasts `{ type: "tick", symbol: "...", price: ..., time: ... }` approximately every 1,200 ms.
   - Observe the active chart candle on the canvas: the latest candle updates smoothly in real time as ticks arrive.
   - Rapid incoming ticks are throttled so that canvas re-renders occur at most once every 250 ms.
5. Reconnect resilience:
   - Simulate a network drop: disconnect network or close the socket from DevTools.
   - **Verification**: In the console or network tab, verify `UniversalMarketProvider` automatically reconnects after 3,000 ms (`onclose` handler) and re-subscribes to the active symbol.

---

### User Story 3 — Honest source labelling (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Observe the topbar route badge button `#btn-topbar-market-source`:
   - With `BTCUSDT` selected:
     - Badge `#topbar-source-label` displays `"BINANCE"` in green (`#00F2B0`).
     - Route `#topbar-source-route` displays `"LIVE"` (or `"زنده"` in Persian).
     - Badge title is `"Live market data from Binance"`.
     - Container does NOT have the `.is-demo-feed` class.
3. Switch symbol to non-crypto:
   - Switch to `FOOLAD`:
     - Badge displays `"TEHRAN BOURSE"` (or `"بورس تهران"`).
     - Route displays `"DEMO"` (or `"نمایشی"`).
     - Label color is `#34d399`.
     - Container gains `.is-demo-feed` class and title `"Demo data — for learning and testing, not real prices"`.
   - Switch to `GOLD_ABSHODEH`:
     - Badge displays `"TEHRAN GOLD"` (or `"طلای تهران"`) with `"DEMO"`.
   - Switch to `EURUSD`:
     - Badge displays `"FOREX"` with `"DEMO"`.
4. Open the Market Data Pipeline Inspector dialog:
   - Click `#btn-topbar-market-source` in the topbar.
   - **Verification**:
     - Modal `#modal-market-sources` opens with `.open` class.
     - Live telemetry banner displays connection status and average latency (e.g. `45 ms`).
     - Exactly 5 source cards are rendered: Tier 1 (Binance Direct - LIVE), Tier 2 (Forex/Metals - DEMO), Tier 3 (US Equities - DEMO), Tier 4 (Tehran Gold - DEMO), Tier 5 (Tehran Stock Exchange - DEMO).
   - Click `#btn-sources-refresh-ping` ("Ping Test" / "تست پینگ"):
     - Verifies latency re-calculates and updates live.
   - Click `#modal-close-sources` or click the dark backdrop:
     - Modal closes cleanly.

---

### User Story 4 — Depth of market (Priority: P2)

1. Open `${SDD_BASE_URL}/chart`.
2. Open the Depth of Market panel:
   - On the right side dock, click the `DOM` panel icon (`[data-panel="dom"]`).
3. **Verification**:
   - The DOM panel mounts `.dom-wrapper`.
   - Active symbol displays `#dom-symbol` (e.g. `BTCUSDT`).
   - Source badge `#dom-source-badge` displays `"Live · Binance"` / `"زنده · بایننس"` in green for `BTCUSDT`.
   - Mark price `#dom-last-price` and spread `#dom-spread` are displayed.
   - 12 ask rows (red) and 12 bid rows (green) are rendered with depth fill bars proportional to cumulative total.
   - Mid-market spread strip `#dom-mid-spread` separates bids and asks.
4. Non-crypto simulated ladder:
   - Switch active chart symbol to `FOOLAD` or `GOLD_ABSHODEH`.
   - **Verification**: Source badge updates to `"Simulated"` / `"شبیه‌سازی‌شده"` in gold (`#f59e0b`).
5. Order execution from DOM:
   - Adjust quantity: Click `#dom-qty-inc` ("+") or `#dom-qty-dec` ("−") to change order size.
   - Market execution: Click `#dom-btn-market-buy` ("MARKET BUY"):
     - Verifies an execution toast appears confirming the paper buy order.
   - Limit execution: Click `+ Buy` (`.btn-dom-limit-buy`) on any bid row:
     - Verifies a limit buy order is placed at that exact row's price.
6. Visibility-gated polling:
   - Minimize or switch browser tabs: DevTools Network tab shows `/api/depth` polling halts.
   - Return to tab: Polling resumes every 1,500 ms.

---

### User Story 5 — Symbol catalogue (Priority: P2)

1. Open `${SDD_BASE_URL}/chart`.
2. Open Symbol Search modal:
   - Click topbar symbol button `#btn-topbar-symbol` or press shortcut key `/`.
   - **Verification**: Modal `#modal-symbol-search` opens and `#symbol-search-input` is focused.
3. Search filtering:
   - Type `"SOL"`:
     - Results list `#symbol-results-list` filters to Solana instruments.
     - Count badge `#sym-count-badge` updates to match filtered count.
   - Category filtering:
     - Click category tab `Crypto`: only crypto coins are listed.
     - Click category tab `Iran Gold & Currencies`: Melted gold, coins, and Tehran FX are listed.
     - Click category tab `Tehran Bourse`: Mobarakeh Steel, Iran Khodro, etc. are listed.
4. Selection and navigation:
   - Use `ArrowDown` and `ArrowUp` keys to highlight rows.
   - Press `Enter`: Active chart switches to the highlighted symbol and modal closes.

---

## 3. Automated Test Suites

Run the existing automated acceptance test suites via Node.js in the terminal:

```bash
# 1. Market Data Pipeline modal, route cards, live latency, and close button
node tests/qa_iran_and_sources_deep.cjs

# 2. Symbol search modal filtering, input debounce, and count badge
node tests/qa_symsearch.cjs

# 3. Candle history depth (>=1500 bars) on boot and timeframe switch to Daily ('D')
node tests/qa_cycle_ctx_depth.cjs

# 4. DOM Level 2 orderbook ladder rendering (C03) and candle schema integrity (C05)
node tests/qa_cycleC.cjs

# 5. History depth plan cap (X-History-Limit 10000 guest vs 20000 premium)
node tests/qa_accounts_cycle7.cjs

# 6. Chart orchestrator candle update methods probe
node tests/test-update-candles.js

# 7. Chart orchestrator setBarSeries and applyBar probe
node tests/test-set-bar-series.js
```
