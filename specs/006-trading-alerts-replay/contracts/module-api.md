# Module API Contract: Paper Trading, Alerts and Bar Replay

Normative interface definitions, public methods, and event bindings for client-side execution, alert monitoring, canvas overlays, and historical rewind.

---

## 1. `PaperTrading` Class

Located at `client/src/paperTrading.js`. Manages multi-account paper trading portfolios, order tickets, pending order matching, Level 2 DOM rendering, and Trade Journal synchronization.

### Constructor

```javascript
new PaperTrading(options = {})
```
- `options.container` (`HTMLElement`, required): DOM node mounting the paper trading side-dock panel.
- `options.app` (`object`, optional): Reference to the root application context (`window.__TRADING_APP__`).

### Public Methods

#### `loadAccounts(): PaperAccount[]`
Reads and deserializes `tradingchart_paper_accounts` from `localStorage`. Returns an array of account objects or an empty array on error.

#### `saveAccounts(): void`
Performs a union merge of in-memory accounts with `localStorage` records, filtering out IDs present in `tradingchart_paper_deleted`, and writes the serialized JSON back to `tradingchart_paper_accounts`.

#### `reloadFromStorage(): void`
Invoked when cloud synchronization completes. Refreshes in-memory accounts with newly arrived cloud accounts without overwriting un-synced local accounts or resurrecting tombstoned records.

#### `createAccount(name?: string): PaperAccount | null`
Validates `auth.enforce('paperAccounts')` against current account count. Creates a new account with ID `'pap_' + timestamp36`, default starting capital ($100,000), switches to it, and triggers a re-render. Returns `null` if the plan quota is exceeded.

#### `renameAccount(accountId: string, name: string): void`
Updates `account.name` (clamped to 40 characters), sets `isSystem = false`, and saves accounts.

#### `deleteAccount(accountId: string): boolean`
Refuses deletion and returns `false` if `accounts.length <= 1`. Otherwise, deletes the account, writes a millisecond timestamp to `tradingchart_paper_deleted`, switches active selection to `accounts[0].id`, and persists.

#### `switchAccount(accountId: string): void`
Persists the current active account state, sets `activeAccountId = accountId`, re-hydrates balance/positions/orders, and re-renders the panel.

#### `setMarket(symbol: string, price: number): void`
Updates `currentSymbol` and `currentPrice`. Recalculates mark prices, unrealized P&Ls, and return percentages for all open positions of the symbol. Evaluates resting limit/stop orders via `checkPendingOrders()` and updates DOM ladder rows if active.

#### `quote(side: 'long' | 'short'): number`
Calculates half-spread simulated market price based on `currentPrice`. Buy/Long returns `currentPrice + halfSpread`; Sell/Short returns `currentPrice - halfSpread`.

#### `placeOrder(opts = {}): string | null`
Single entry point for order placement.
- `opts.side` (`'buy' | 'sell' | 'long' | 'short'`): Desired position direction.
- `opts.type` (`'market' | 'limit' | 'stop'`, default `'market'`): Order type.
- `opts.price` (`number | null`): Required for limit and stop orders.
- `opts.qty` (`number`, default `0.1`): Order volume.
- `opts.leverage` (`number | null`): Order leverage factor.
- Returns `'filled'` if immediately executed as market order, order ID string if placed as resting pending order, or `null` if rejected (e.g. invalid quantity, invalid price, or insufficient margin).

#### `cancelOrder(id: string): void`
Removes a resting order from the pending queue, updates the `#ord-count-badge`, and displays the localized toast `"Order cancelled."` / `"سفارش لغو شد."`.

#### `openPosition(side: 'long' | 'short', qty: number, leverage: number, customPrice?: number, opts?: object): boolean`
Validates that required margin does not exceed available balance and that `holdingsPerAccount` plan quota is not exceeded. Deducts margin from cash balance, creates an active `PaperPosition`, updates view, and plays order fill audio.

#### `closePosition(posId: string): void`
Removes the position from `positions`, credits locked margin plus unrealized P&L back to cash balance, unshifts the closed position to `history`, and syncs entry and exit executions directly into `TradeJournal.sampleExecutions`.

#### `calculateEquity(): number`
Returns total account equity: `this.balance + sum(unrealizedPnl)`.

#### `renderDOMView(): void`
Renders 5 ask levels and 5 bid levels centered on `currentPrice` with proportional depth bars. Clicking any ask row places a short limit order at the clicked price; clicking any bid row places a long limit order at the clicked price.

---

## 2. `AlertsManager` Class

Located at `client/src/alertsManager.js`. Evaluates price conditions, manages active alerts, handles webhook tokens, and dispatches automated signals.

### Constructor

```javascript
new AlertsManager(options = {})
```
- `options.container` (`HTMLElement`, required): DOM node mounting the alerts dock panel.
- `options.app` (`object`, optional): Reference to the root application context.

### Public Methods

#### `loadAlerts(): PriceAlert[]`
Loads alerts from `localStorage: tradingchart_alerts` filtering out IDs in `tradingchart_alerts_deleted`.

#### `saveAlerts(): void`
Serializes in-memory alerts to `localStorage: tradingchart_alerts`.

#### `setMarket(symbol: string, price: number): void`
Updates `currentSymbol` and `currentPrice`, calling `checkPrice(symbol, price)`.

#### `openCreateAlert(price?: number): void`
Sets `isCreating = true`, updates `currentPrice` if provided, and renders the inline creation form.

#### `addAlert(targetPrice: number, condition?: string, extra?: object): string | null`
Validates target price and checks plan quota via `auth.enforce('priceAlerts')`. Resolves reference price and direction. Constructs a new `PriceAlert`, removes any stale tombstone, prepends to `alerts`, persists to `localStorage`, and updates `ChartAlertsOverlay`. Returns new alert ID string or `null` if quota is exceeded.

#### `deleteAlert(id: string): boolean`
Removes alert from `alerts`, records millisecond timestamp in `tradingchart_alerts_deleted`, updates `ChartAlertsOverlay`, and persists. Returns `true` on success.

#### `checkPrice(symbol: string, price: number): void`
Iterates all active, un-triggered alerts matching `symbol`. Evaluates the condition formula. If triggered:
1. Sets `alert.triggered = true`.
2. Plays synthesizer audio beep (`playBeep()`).
3. Emits alert toast notification.
4. If `channel` includes `'Webhook'`, posts simulated order payload to `POST /api/webhook`.

#### `webhookState(): object`
Queries `GET /api/user/webhook` to check whether webhook is enabled and whether a token exists. Returns state object `{ loaded, loading, enabled, hasToken, hint, freshToken }`.

---

## 3. `ChartAlertsOverlay` Class

Located at `client/src/chartAlertsOverlay.js`. Projects alert levels onto the canvas and renders pinned off-scale indicators.

### Constructor

```javascript
new ChartAlertsOverlay(app)
```
- `app` (`object`, required): Global app instance with access to `chartManager.workspace.active`.

### Public Methods

#### `mount(): void`
Creates `#chart-alerts-overlay` in `#chart-area`, binds chart viewport interaction listeners (`wheel`, `pointermove`, `touchmove`, `resize`) coalescing to `scheduleReproject()`, and initiates a 1000ms autoscale polling interval.

#### `projection(): object | null`
Queries the active Vela renderer's internal scene graph:
```javascript
{
  y: (price) => number,     // Maps price to absolute viewport Y pixel
  paneTop: number,          // Top pixel boundary of price canvas
  paneBottom: number,       // Bottom pixel boundary of price canvas
  left: number,             // Left pixel offset
  plotRight: number,        // Right boundary of plotting pane (excluding price scale)
  rightInset: number,       // Right inset for price axis badges
  min: number,              // Minimum price currently visible on scale
  max: number,              // Maximum price currently visible on scale
  invert: boolean           // Inverted scale flag
}
```

#### `updateAlerts(alerts: PriceAlert[], activeSymbol: string, currentPrice: number): void`
Filters alerts matching `activeSymbol` that are active and un-triggered, caches them in `_last`, and triggers `reproject()`.

#### `reproject(): void`
Evaluates Y coordinates for all alerts:
- If `paneTop <= y <= paneBottom`: Renders `.canvas-alert-line` across the chart canvas and `.canvas-alert-badge` on the price axis.
- If `price > max`: Renders `.canvas-alert-pinned-top` with arrow `▲`.
- If `price < min`: Renders `.canvas-alert-pinned-bottom` with arrow `▼`.
- Binds click listeners on `.btn-delete-alert-pill` to call `alertsManager.deleteAlert(id)`.

---

## 4. `BarReplay` Class

Located at `client/src/barReplay.js`. Historical candle rewind controller and simulated trade execution engine.

### Constructor

```javascript
new BarReplay(options = {})
```
- `options.container` (`HTMLElement`, required): Floating bar element (`#replay-bar`).
- `options.app` (`object`, optional): Application context.
- `options.onBarStep` (`function(index: number)`, required): Callback executed when replay cursor advances.
- `options.onStart` (`function()`, optional): Callback executed when replay starts.
- `options.onExit` (`function()`, optional): Callback executed when replay ends.

### Public Methods

#### `startReplay(totalBars: number, startIndex: number, barSpacingMs?: number): void`
Initializes replay session. Clamps `startIndex` to plan `barReplayMinuteDays` limit. Adds `.visible` class to container and invokes `onStart()` and `onBarStep(currentIndex)`.

#### `stopReplay(): void`
Pauses playback, closes open simulated replay position, hides container, and invokes `onExit()`.

#### `play(): void`
Sets `isPlaying = true`, updates UI to show "Pause", and initiates the playback tick loop.

#### `pause(): void`
Clears active playback timeout and sets `isPlaying = false`.

#### `step(): void`
Advances `currentIndex` by 1. If cursor reaches `totalBars - 1`, pauses playback and displays toast `"Replay reached the latest bar."` / `"بازپخش به آخرین کندل رسید."`.

#### `executeReplayTrade(side: 'long' | 'short'): void`
Opens a 0.1 simulated position at the current historical bar close price, recording `entryAt` with the historical bar's timestamp. If an opposite trade is already open, closes the existing position.

#### `closePosition(): void`
Terminates the open replay position, creates entry and exit executions tagged with `source: 'replay'` and historical timestamps, adds them to Trade Journal store, and displays the P&L toast.

#### `setPrice(price: number): void`
Updates `currentPrice` and recalculates floating P&L on the open replay position.

---

## 5. Global Event Bindings and Shortcuts

- **`Alt+A` Keyboard Shortcut**: Intercepted in `client/src/main.js:1261-1263`. Calls `openAlertsModal()`, which docks the alerts panel and focuses the alert create form.
- **Context Menu `#ctx-add-alert`**: Bound in `client/src/canvasContextMenu.js:370-381`. Calls `alertsManager.addAlert(this.activePrice)` and confirms with a toast.
- **Context Menu `#ctx-buy-limit` / `#ctx-sell-limit`**: Bound in `client/src/canvasContextMenu.js:384-397`. Calls `paperTrading.placeOrder({ side, type: 'limit', price: activePrice, qty })`.
- **Top Bar `#btn-topbar-replay`**: Bound in `client/src/main.js:962-976`. Toggles `#replay-bar` visibility and starts or stops the `BarReplay` engine.
- **`tc:languagechange` Window Event**: Dispatched on language switch; observed by `PaperTrading`, `AlertsManager`, and `BarReplay` to re-localize labels in place without page reload.