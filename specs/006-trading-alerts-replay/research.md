# Research: Paper Trading, Alerts and Bar Replay

History: `git log --format='%h %ad %s' --date=short -- client/src/paperTrading.js client/src/alertsManager.js client/src/chartAlertsOverlay.js client/src/barReplay.js client/src/canvasContextMenu.js server/tradeRelayApi.js server/tradeRelay.js server/accounts.js server/featuresCatalog.js`
— `ecdb389` (2026-09-17, Initial release of TradingChart with paper trading & alerts foundations), `8f408cb` (2026-09-18, TradingView replacement: DOM level-2 ladder, canvas alerts overlay, replay trading), `c724bb4` (2026-09-18, Chart styles, context menu, sound engine), `21651f4` (2026-09-18, Non-blocking toasts, mathematical trade direction), `3c9c194` (2026-09-19, Browser dogfooding, balance quick-trade, harmonize icons), `b210695` (2026-09-19, Alert delegation, sound click synthesizer), `06f1ff4` (2026-09-21, Resolve paper trading confirm dialog, live profile metrics, mobile responsive layout cards), `3d03128` (2026-09-21, Sync restore on load, paper leverage profile sync, XSS sanitization), `95eade6` (2026-09-22, 44px mobile touch targets, DOM L2 badge localization, language-reactive default paper account name), `c22ef30` (2026-09-27, Topbar responsive overflow, 100% green multi-cycle QA), `7544e50` (2026-10-12, Real-browser zero-defect cycle: honest data, replay isolation, layout/app sync, resource-aware polling), `fb0ff94` (2026-10-15, Platform admin console), `a94a611` (2026-10-22, Chartivia: production hardening, rebrand, TradingView-style routing).

---

## R1. Dual-surface paper trading execution (quick trade widget and dock terminal)

- **Decision**: Provide two complementary interfaces for simulated paper execution:
  1. A floating 1-click quick-trade overlay widget (`#chart-quick-trade`) anchored on the chart canvas offering instant BUY and SELL at market with a ±0.05 BTC stepper (minimum 0.01), auto-minimizing on viewports ≤ 768px into a floating `#qt-collapsed-trigger` pill.
  2. A dedicated side-dock paper trading terminal (`PaperTrading` in `client/src/paperTrading.js`) offering full portfolio management, multi-account switching, order tickets (Market, Limit, Stop), and a Level 2 DOM order book ladder.
- **Rationale**: Day traders and scalpers require instant 1-click order entry directly from the charting surface without obscuring the price action or opening side drawers. Conversely, swing traders and quantitative practitioners require deep order ticketing, risk management (leverage, limit/stop prices), and portfolio metrics. Providing both satisfies both user personas while maintaining institutional TradingView feature parity.
- **Alternatives considered**:
  - Only providing the side dock terminal (rejected: forces excessive clicks and obscures chart view during rapid trading decisions).
  - Only providing floating quick-trade buttons (rejected: lacks support for limit/stop orders, portfolio switching, and equity overviews).
- **Evidence**: `client/src/main.js:1010-1065`, `client/src/paperTrading.js:322-445`, `client/chart/index.html:168-200`.

## R2. Half-spread simulated quote model matching displayed prices

- **Decision**: In `PaperTrading.quote(side)` and `PaperTrading.spreadFor(px)`, calculate simulated execution prices using a tiered half-spread formula:
  - If price > 1,000 (e.g. BTCUSDT): spread = $5.00 (half-spread = $2.50).
  - If price > 10 (e.g. SOLUSDT): spread = $0.05 (half-spread = $0.025).
  - If price <= 10: spread = $0.0005 (half-spread = $0.00025).
  - Long/Buy fills at `currentPrice + halfSpread` (lifting the ask); Short/Sell fills at `currentPrice - halfSpread` (hitting the bid).
- **Rationale**: Paper trading must realistically simulate the cost of liquidity and bid/ask spreads. Fulfilling market orders at the exact mid-price gives traders an unrealistic edge. By sharing the exact same `spreadFor()` function between the quick-trade widget display (`#quick-trade-spread`) and the execution engine, the price shown to the user on the BUY/SELL button is mathematically identical to the resulting fill price.
- **Alternatives considered**:
  - Zero-spread fills at exact mid-market price (rejected: creates false trading expectations and violates professional trading simulation standards).
  - Random spread simulation (rejected: non-deterministic fills confuse users and break automated assertion tests).
- **Evidence**: `client/src/paperTrading.js:232-240,265-267`, `client/src/main.js:1052-1064`.

## R3. Multi-account paper portfolio layer with tombstone deletion tracking

- **Decision**: Support multiple distinct paper trading accounts (`tradingchart_paper_accounts` in `localStorage`), initialized with a default system account (`pap_main`). Account deletions write an explicit tombstone timestamp into `tradingchart_paper_deleted`. On save and cloud synchronization, accounts are merged via an ID-keyed union that filters out tombstoned IDs. The system default account name is language-reactive (`displayNameFor(a, isFa)`), rendering as "حساب اصلی دمو" in Persian and "Main Paper" in English without modifying the stored record.
- **Rationale**: Traders need isolated sub-accounts to test distinct strategies (e.g. scalping vs trend-following). Without tombstones, cross-tab or cross-device cloud sync would interpret a deleted account on device A as "missing" and resurrect it from device B. Making the default account name reactive ensures that switching the interface language dynamically updates the UI without leaving stale English chips in Persian mode.
- **Alternatives considered**:
  - Single static paper account (rejected: fails TradingView "Portfolios" parity).
  - Hard deletion without tombstones (rejected: leads to phantom resurrection during cloud-state synchronization).
- **Evidence**: `client/src/paperTrading.js:25-83,151-169`.

## R4. Client-side order matching engine with marketable detection

- **Decision**: Implement a client-side pending order matching engine in `PaperTrading.placeOrder` and `PaperTrading.checkPendingOrders`. Market orders fill immediately. For Limit and Stop orders:
  - Marketable orders (Buy Limit ≥ ask, Sell Limit ≤ bid, or triggered stops) fill immediately at the current market price upon placement.
  - Non-marketable orders are placed into an in-memory resting order queue (`this.orders`), displayed in the pending orders table (`#orders-table-wrap`) with a pending toast.
  - On every price tick (`setMarket`), `checkPendingOrders()` iterates resting orders: buy limits fill at `min(limitPrice, currentPrice)`, sell limits fill at `max(limitPrice, currentPrice)`, and stops fill at `currentPrice`.
- **Rationale**: Resting orders must simulate canonical exchange behavior. Filling a limit order at a worse price than requested violates limit semantics, while allowing a limit order to fill when market price has not reached the limit price creates fictitious profits. Up-front margin validation ensures orders are rejected immediately if account equity is insufficient.
- **Alternatives considered**:
  - Server-side order matching engine via WebSockets (rejected: introduces heavy server state and database dependencies for single-user paper trading, violating Constitution Principle IX).
  - Market orders only (rejected: limits the educational and practice value of the platform).
- **Evidence**: `client/src/paperTrading.js:192-228,253-298`.

## R5. Automatic bidirectional execution logging into Trade Journal

- **Decision**: Whenever a paper position is closed in `PaperTrading.closePosition` or a bar replay position is closed in `BarReplay.closePosition`, the system automatically constructs two immutable execution records (entry and exit) and unshifts them directly into the persistent Trade Journal (`tradeJournal.sampleExecutions` or `tradeJournal.store.addExecutions`). Replay trades explicitly tag `source: 'replay'` and use the historical candle timestamp (`barTime()`) rather than the wall-clock time.
- **Rationale**: In accordance with the founder intent ("every trade flowing into the journal"), manual post-trade logging is friction-heavy. Automatic journal integration provides instant quantitative feedback, win-rate analysis, and P&L attribution across both live-paper and historical-replay trading sessions.
- **Alternatives considered**:
  - Requiring the user to click an "Export to Journal" button (rejected: high drop-off rate and lost trade data).
  - Separate logs for paper trading and journal (rejected: fragments user trade history).
- **Evidence**: `client/src/paperTrading.js:702-739`, `client/src/barReplay.js:110-120`.

## R6. 11-condition price alert evaluator with dynamic form layouts

- **Decision**: Implement an in-browser price alert evaluation engine (`AlertsManager.checkPrice`) supporting 11 distinct TradingView-parity conditions:
  1. `crossing`: Fired when price crosses target in either direction relative to reference price.
  2. `crossing_up`: Fired when reference < target and price >= target.
  3. `crossing_down`: Fired when reference > target and price <= target.
  4. `greater_than`: Fired when price > target.
  5. `less_than`: Fired when price < target.
  6. `enter_channel`: Fired when price enters `[channelLow, target]`.
  7. `exit_channel`: Fired when price leaves `[channelLow, target]`.
  8. `inside_channel`: Fired when price is inside `[channelLow, target]`.
  9. `outside_channel`: Fired when price is outside `[channelLow, target]`.
  10. `move_up_pct`: Fired when price rises by target percentage over reference.
  11. `move_down_pct`: Fired when price falls by target percentage over reference.
  The creation form dynamically shows/hides `#alert-channel-low-row` for channel conditions and relabels inputs for percentage moves.
- **Rationale**: Standard retail trading platforms only support basic "greater than / less than" thresholds. Institutional traders rely on channel breakouts, channel bounce confirmations, and percentage volatility triggers. Dynamic UI forms prevent clutter by displaying channel-low inputs only when relevant.
- **Alternatives considered**:
  - Restricting alerts to simple threshold crossing (rejected: fails TradingView functional parity).
  - Complex custom scripting for alert conditions (rejected: high cognitive load for standard price levels).
- **Evidence**: `client/src/alertsManager.js:173-197,361-401,458-518`.

## R7. Direct Vela coordinate projection for canvas alert lines and off-scale pinned badges

- **Decision**: In `ChartAlertsOverlay`, project alert price lines directly onto the chart canvas using the active Vela chart renderer's internal coordinate system (`R.coords.priceToY(price, pane.scale, pane.bounds)`). If an alert price lies within visible bounds, render a full-width dashed line (`.canvas-alert-line`) with a right-aligned price badge (`.canvas-alert-badge`). If an alert lies outside the visible scale, dock a pinned badge (`.canvas-alert-pinned-top` or `.canvas-alert-pinned-bottom`) with directional arrows (`▲`/`▼`) stacked along the right price-axis column. Both badge types include a direct `✕` button to delete the alert.
- **Rationale**: Approximating alert line positions using DOM percentages causes severe misalignment during chart dragging, zooming, and logarithmic scaling. Querying Vela's native renderer bounds guarantees 100% pixel accuracy. Pinned off-scale badges ensure that traders remain aware of pending alert levels even when zoomed in closely on price action.
- **Alternatives considered**:
  - Native Vela drawing tools for alerts (rejected: Vela drawing tools lack HTML button interactivity and persistent tombstone lifecycle management).
  - Pure DOM overlays without renderer projection (rejected: breaks during logarithmic or inverted axis scaling).
- **Evidence**: `client/src/chartAlertsOverlay.js:54-78,103-141`.

## R8. Dedicated per-user Trade-Relay with secret base64url webhook token, SHA-256 hash storage, and token hint

- **Decision**: Replace former shared unauthenticated trade relay with a per-user isolated architecture (`server/tradeRelayApi.js`). Authenticated users on Plus or higher plans generate a secret 24-byte base64url token via `POST /api/user/webhook/rotate`. The server stores only the SHA-256 hash (`webhookTokenHash`) and last 4 characters (`webhookTokenHint`) in `server/data/accounts/users.json`. Inbound webhooks are sent to `POST /api/webhook/:token`. The raw token is displayed to the user only once upon generation; subsequent loads display a masked string (`••••••••<hint>`).
- **Rationale**: Adheres to Constitution Principle VI (Security by Default). If the server database were compromised, raw webhook tokens cannot be recovered. Masked token displays prevent "shoulder surfing". Rotating the token immediately invalidates the previous hash, giving users full control if an endpoint URL is leaked.
- **Alternatives considered**:
  - Storing plaintext tokens in user records (rejected: security vulnerability).
  - Global shared webhook endpoint without per-user isolation (rejected: dangerous cross-account order contamination).
- **Evidence**: `server/tradeRelayApi.js:62-70,77-96`, `client/src/alertsManager.js:251-287`.

## R9. Institutional safety rails on Trade-Relay simulated execution engine

- **Decision**: In `TradeRelay.processSignal` (`server/tradeRelay.js`), pass all inbound signals through three sequential safety rails before execution:
  1. **Rate Limiting**: Minimum 1,000 ms spacing between consecutive orders (`rateLimitMs = 1000`). Violations reject with `'Rate limit exceeded: too many orders per second'`.
  2. **Max Order Notional Cap**: Maximum notional order value capped at $50,000 (`maxOrderSize = 50000`). Violations reject with `'Order notional $... exceeds safety cap of $50000'`.
  3. **Daily Drawdown Circuit Breaker**: Maximum daily account drawdown capped at 5% of initial balance (`maxDailyDrawdownPct = 5.0`). Violations reject with `'Circuit Breaker: Daily drawdown ...% breached limit 5%'`.
  All order events (fills and rejections) are logged into a FIFO flight recorder (`orderLogs`, max 500 entries).
- **Rationale**: Modeled after institutional prop firm risk engines and LuxAlgo Trade-Relay standards. Prevents runaway algorithmic loops (e.g. malfunctioning TradingView alerts) from spamming orders, exhausting simulated equity, or degrading server CPU performance.
- **Alternatives considered**:
  - Unchecked instant execution of all incoming payloads (rejected: vulnerable to infinite webhook loops and rapid equity wipeouts).
  - Hard server error 500 on rail triggers (rejected: returns structured 400 rejection payloads with flight recorder logs for user diagnostics).
- **Evidence**: `server/tradeRelay.js:28-63`.

## R10. Historical candlestick rewind (bar replay) with non-destructive orchestrator series slicing

- **Decision**: In `BarReplay` (`client/src/barReplay.js`), bar replay rewinds the active chart series by slicing the orchestrator's candle array (`setBarSeries(bars.slice(0, startIndex))`), initializing the replay cursor at 70% depth (clamped by plan `barReplayMinuteDays`). Stepping forward calls `orchestrator.applyBar(nextBar)`, advancing the chart one candle at a time without network re-fetching. Exiting replay restores the full original candle series (`setBarSeries(fullBars)`). Simulated Buy and Sell orders can be executed during replay at the historical bar's close price, tracking live P&L and syncing to the Trade Journal.
- **Rationale**: Replay trading is essential for backtesting manual strategies under realistic market conditions without future-bar lookahead bias. Slicing client memory bars avoids redundant server queries and eliminates network lag during fast 10× playback. Restoring the original series on exit ensures the live workspace remains completely intact.
- **Alternatives considered**:
  - Requesting sliced bar ranges from the server on every step (rejected: slow, latency-ridden, and imposes heavy load on `/api/candles`).
  - Read-only historical replay without trading capability (rejected: fails user intent to practice trading historical setups).
- **Evidence**: `client/src/barReplay.js:24-49,66-82,93-127`, `tests/test-replay-interaction.js:15-39`.

## R11. Multi-tier plan gating with dual-layer enforcement

- **Decision**: Gating for features in this specification is implemented across two distinct layers:
  1. **Client-side UX Gating**: UI controls check user plan tier via `auth.enforce()` or `auth.feature()`. Exceeding limits triggers an informative toast warning and opens the Plans upgrade modal (`#tc-plans-modal`). Quotas:
     - `priceAlerts`: Basic: 3, Essential: 20, Plus: 100, Premium: 400, Institutional: 1000.
     - `webhookAlerts`: Basic: false, Essential: false, Plus: true, Premium: true, Institutional: true.
     - `paperAccounts`: Basic: 1, Essential: 3, Plus: 4, Premium: 5, Institutional: 7.
     - `holdingsPerAccount`: Basic: 20, Essential: 50, Plus: 75, Premium: 100, Institutional: 150.
     - `barReplayMinuteDays`: Basic: 180 days, Essential: 365 days, Plus/Premium/Institutional: -1 (unlimited).
  2. **Server-side Security Gating**:
     - `PUT /api/user/state` enforces quotas for `alerts` (`priceAlerts`) and `paperAccounts` (`paperAccounts`), returning HTTP 403 `limit_exceeded` if exceeded.
     - `POST /api/user/webhook/rotate`, `POST /api/webhook`, and `POST /api/webhook/:token` enforce `webhookAlerts`, returning HTTP 403 `plan_feature_locked`.
- **Rationale**: Client-side gates provide instantaneous, friction-free feedback and upgrade prompts. Server-side validation guarantees that malicious or tampered client requests cannot bypass account tier boundaries or commit excessive state to the database.
- **Alternatives considered**:
  - Client-only gating (rejected: vulnerable to browser console tampering and unauthorized resource usage).
  - Server-only gating without UI cues (rejected: poor UX; users discover limits only after failed API calls).
- **Evidence**: `client/src/alertsManager.js:97-99,274-276`, `client/src/paperTrading.js:129,641-643`, `server/accounts.js:512-539`, `server/tradeRelayApi.js:47-50,93`.

---

## Spec/code mismatches

- **FR-003**: `holdingsPerAccount` plan quota is enforced client-only in `client/src/paperTrading.js:641`; `server/accounts.js:512-515` does not enforce it during `PUT /api/user/state`.
- **FR-004**: Inconsistent default leverage fallback between `client/src/paperTrading.js:315` (defaults to 1) and `client/src/paperTrading.js:326` (defaults to 10) when profile default leverage is absent.
- **FR-011**: `client/src/chartAlertsOverlay.js:41-43` sets recurring 1000ms `setInterval` with no cleanup or teardown mechanism on unmount.
- **FR-012**: In-browser price trigger initiates `POST /api/webhook` without server-side validation that market price actually reached target in `client/src/alertsManager.js:205-215`.
- **FR-013**: Network errors in `client/src/alertsManager.js:258-261` are silently swallowed with empty catch block during webhook state loading.
- **FR-014**: Fallback prices `(price || 1)` for notional calculation and `price || 100` for market execution are used when price is omitted on simulated market orders in `server/tradeRelay.js:45,67`.
- **FR-015**: Unused `export const globalRelay = new TradeRelay();` is exported in `server/tradeRelay.js:123` while `server/tradeRelayApi.js` creates and manages its own per-user `relays` Map.
- **FR-016**: `barReplayMinuteDays` plan restriction is enforced client-only by clamping `startIndex` in `client/src/barReplay.js:30-35`; server `/api/candles` endpoint does not enforce replay depth.
- **FR-017**: Silent catch swallows Trade Journal synchronization errors in `client/src/barReplay.js:118`.
- **FR-018**: Silent catches swallow `localStorage.setItem` quota exceptions in `client/src/paperTrading.js:48,162` and `client/src/alertsManager.js:33,74`.
- **FR-019**: Pending order row quantity and price `${o.qty} @ $${this.fmtPx(o.price)}` has no Persian localization or Persian digits in `client/src/paperTrading.js:762`.
- **FR-019**: Triggered alert notification toast is hardcoded in English `🚨 Alert: ${a.symbol} @ $${price.toLocaleString()} (${a.condition})` with no Persian translation in `client/src/alertsManager.js:201`.
- **FR-019**: Speed selector options (`0.5x`, `1.0x`, `2.0x`, `5.0x`, `10.0x`) have no localized Persian labels in `client/src/barReplay.js:160-165`.
- **FR-019**: Quick trade widget HTML attributes `title="1-Click Instant Market Execution"`, `title="Minimize Quick Trade"`, `title="Sell / Short at Market"`, `title="Order Quantity (BTC)"`, `title="Current Bid/Ask Spread"`, `title="Buy / Long at Market"`, and `title="Open 1-Click Execution"` are hardcoded in English and not translated in Persian mode in `client/chart/index.html:168-189`.