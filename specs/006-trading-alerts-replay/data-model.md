# Data Model: Paper Trading, Alerts and Bar Replay

Entities defined by `specs/006-trading-alerts-replay/spec.md` (Key Entities) and their realization in the codebase. Entities reside across client `localStorage`, server atomic JSON files, server in-memory LRU maps, and transient runtime memory.

---

## 1. Paper Account (`PaperAccount`)

An isolated simulated trading portfolio holding cash balances, open margin positions, trade history, and resting orders.

- **Storage**:
  - Client `localStorage`: `tradingchart_paper_accounts` (JSON array of accounts).
  - Deletion tombstones: `tradingchart_paper_deleted` (JSON map `{ [accountId: string]: number }`).
  - Active selection pointer: `tradingchart_paper_active` (string account ID).
  - Server filesystem: `server/data/accounts/states/state_u_<userId>.json` under key `paperAccounts`.
- **Fields**:
  - `id` (`string`, required): Unique identifier (e.g. `'pap_main'` for default system account, or `'pap_' + timestamp36`).
  - `name` (`string`, required): Account display name (max 40 chars; e.g. `'Main Paper'`, `'حساب اصلی دمو'`, `'Scalp Account'`).
  - `isSystem` (`boolean`, optional): `true` for initial default account (`pap_main`), enabling language-reactive display naming.
  - `balance` (`number`, required): Available cash balance excluding locked margin (default `$100,000.00`).
  - `positions` (`PaperPosition[]`, required): Array of currently active open margin positions.
  - `history` (`ClosedPosition[]`, required): Chronological array of closed positions with realized P&L.
  - `orders` (`PaperOrder[]`, optional): Array of pending resting limit and stop orders.
  - `createdAt` (`number`, required): Unix epoch timestamp in milliseconds when account was created.
- **Validation**:
  - `name` is sanitized and capped to 40 characters: `String(name).slice(0, 40)`.
  - `balance` must be a non-negative finite number.
  - At least one account must always exist; `deleteAccount` aborts and returns `false` if `accounts.length <= 1`.
  - System default account (`pap_main`) cannot be renamed to an empty string.
- **Limits**:
  - Account count restricted by user plan `paperAccounts`: Basic (1), Essential (3), Plus (4), Premium (5), Institutional (7).
  - Client enforces limit in `PaperTrading.createAccount` via `auth.enforce('paperAccounts')`.
  - Server enforces limit in `server/accounts.js:514,530-539` returning HTTP 403 `limit_exceeded` during `PUT /api/user/state`.
- **Lifecycle**:
  - Seeded automatically on first load with `pap_main` ($100k starting equity).
  - Mutated by order fills, position closes, and balance resets.
  - Reset restores balance to starting capital ($100k) and clears `positions` and `orders`.
  - Deletions record a millisecond timestamp in `tradingchart_paper_deleted` to prevent resurrection during union merges and cloud synchronization.

---

## 2. Position, Order and Execution

### 2.1 Paper Position (`PaperPosition`)

An open leveraged trading contract currently held within a paper account.

- **Storage**:
  - Nested in `PaperAccount.positions` in `localStorage` and cloud state.
- **Fields**:
  - `id` (`string`, required): Unique position identifier (e.g. `'pos-' + timestamp36 + random`).
  - `symbol` (`string`, required): Normalized instrument ticker (e.g. `'BTCUSDT'`).
  - `side` (`'long' | 'short'`, required): Directional market bias.
  - `qty` (`number`, required): Position size in base asset units (must be `> 0`).
  - `entryPrice` (`number`, required): Executed fill price including simulated half-spread.
  - `markPrice` (`number`, required): Current market quote price updated on every tick.
  - `leverage` (`number`, required): Leverage factor (e.g. `1`, `10`, `50`).
  - `margin` (`number`, required): Locked margin collateral `(entryPrice * qty) / leverage`.
  - `unrealizedPnl` (`number`, required): Current unrealized profit/loss in quote currency (`diff * qty`).
  - `unrealizedPnlPct` (`number`, required): Return on margin percentage `(unrealizedPnl / margin) * 100`.
  - `openedAt` (`string`, required): ISO 8601 creation timestamp.
- **Validation**:
  - Required margin `(execPrice * qty) / leverage` must not exceed `account.balance`.
  - Quantity `qty` must be greater than zero.
- **Limits**:
  - Maximum concurrent positions per account restricted by plan `holdingsPerAccount`: Basic (20), Essential (50), Plus (75), Premium (100), Institutional (150). Enforced client-side in `PaperTrading.openPosition`.
- **Lifecycle**:
  - Created when a market order fills or a resting order triggers.
  - Marked to market on each price tick in `PaperTrading.setMarket`.
  - Terminated via `PaperTrading.closePosition`, returning locked margin plus unrealized P&L to account balance, moving the record into `history` with `closedAt` and `finalPnl`, and syncing executions to Trade Journal.

### 2.2 Paper Order (`PaperOrder`)

A resting non-marketable limit or stop order waiting for price to trade through its trigger.

- **Storage**:
  - Nested in `PaperAccount.orders` in `localStorage` and memory.
- **Fields**:
  - `id` (`string`, required): Unique order identifier (e.g. `'ord-' + timestamp36 + random`).
  - `symbol` (`string`, required): Normalized instrument ticker.
  - `side` (`'long' | 'short'`, required): Intended order direction.
  - `type` (`'limit' | 'stop'`, required): Order execution condition.
  - `price` (`number`, required): Target trigger price level.
  - `qty` (`number`, required): Intended execution quantity.
  - `leverage` (`number`, required): Designated order leverage.
  - `createdAt` (`string`, required): ISO 8601 placement timestamp.
- **Validation**:
  - Up-front margin validation: `(price * qty) / leverage <= account.balance` checked on placement.
  - Marketable check: If Buy Limit ≥ ask or Sell Limit ≤ bid, order fills immediately as a market order rather than resting.
- **Lifecycle**:
  - Placed via order ticket or Level 2 DOM ladder click.
  - Evaluated on every price tick in `checkPendingOrders()`.
  - Upon market fill, order is removed from `orders` and instantiated as an active `PaperPosition`.
  - Cancelled manually by user via `cancelOrder(id)`.

### 2.3 Journal Execution (`JournalExecution`)

An immutable execution log record synchronized directly into the Trade Journal.

- **Storage**:
  - `localStorage`: `tradingchart_executions` (via `tradeJournal.sampleExecutions` and `tradeJournal.store`).
- **Fields**:
  - `id` (`string`, required): Execution identifier (`exec-open-<posId>` or `exec-close-<posId>`).
  - `accountId` (`string`, required): Paper account ID (`pap_main`) or `'replay'`.
  - `symbol` (`string`, required): Traded asset ticker.
  - `side` (`'buy' | 'sell'`, required): Transaction side (`buy` for long entry / short exit; `sell` for short entry / long exit).
  - `quantity` (`number`, required): Executed trade volume.
  - `price` (`number`, required): Execution unit price.
  - `executedAt` (`string`, required): ISO 8601 timestamp (wall-clock for paper trades; historical simulated `barTime()` for replay trades).
  - `fee` (`number`, required): Trade commission (`0` for paper/replay trades).
  - `source` (`string`, optional): Set to `'replay'` for bar replay trades; omitted or `'paper'` for live paper trading.
  - `assetClass` (`string`, optional): Asset category (e.g. `'crypto'`).
- **Lifecycle**:
  - Created in pairs (open execution and close execution) upon closing a paper position or replay position.
  - Persisted permanently in the Trade Journal store.

---

## 3. Price Alert (`PriceAlert`)

A conditional price trigger monitoring market price action across 11 mathematical condition types.

- **Storage**:
  - Client `localStorage`: `tradingchart_alerts` (JSON array of alerts).
  - Deletion tombstones: `tradingchart_alerts_deleted` (JSON map `{ [alertId: string]: number }`).
  - Server filesystem: `server/data/accounts/states/state_u_<userId>.json` under key `alerts`.
- **Fields**:
  - `id` (`string`, required): Unique alert identifier (e.g. `'alt-' + timestamp36 + '-' + random`).
  - `symbol` (`string`, required): Instrument ticker symbol (e.g. `'BTCUSDT'`).
  - `condition` (`string`, required): English descriptive condition label (e.g. `'Crossing Above $78,500'`).
  - `conditionFa` (`string`, required): Formal Persian condition label (e.g. `'تقاطع به بالای $78,500'`).
  - `targetPrice` (`number`, required): Target price threshold or percentage change value.
  - `channelLow` (`number`, optional): Lower boundary price for channel conditions (`enter_channel`, `exit_channel`, `inside_channel`, `outside_channel`).
  - `referencePrice` (`number`, optional): Base price at creation used to evaluate crossing direction or percentage move.
  - `direction` (`string`, required): Condition evaluator key:
    `'above' | 'below' | 'crossing' | 'crossing_up' | 'crossing_down' | 'greater_than' | 'less_than' | 'enter_channel' | 'exit_channel' | 'inside_channel' | 'outside_channel' | 'move_up_pct' | 'move_down_pct'`.
  - `channel` (`string`, required): Notification dispatch mode: `'Sound & Popup' | 'Webhook Relay (Auto-Order)' | 'Sound & Webhook Relay'`.
  - `channelFa` (`string`, required): Persian notification dispatch label.
  - `active` (`boolean`, required): Boolean evaluation flag (`true` = armed, `false` = paused).
  - `triggered` (`boolean`, required): Execution state flag (`true` once condition has fired).
  - `createdAt` (`string`, required): Formatted timestamp string of creation.
- **Validation**:
  - `targetPrice` must be a positive finite number.
  - For channel conditions (`channelLow` present), `channelLow` must be strictly less than `targetPrice`.
  - For percentage conditions (`move_up_pct`, `move_down_pct`), `targetPrice` must be between `0` and `1000`.
- **Limits**:
  - Active alert count restricted by user plan `priceAlerts`: Basic (3), Essential (20), Plus (100), Premium (400), Institutional (1000).
  - Enforced client-side in `AlertsManager.addAlert` via `auth.enforce('priceAlerts')`.
  - Enforced server-side in `server/accounts.js:514,530-539` returning HTTP 403 `limit_exceeded` on `PUT /api/user/state`.
- **Lifecycle**:
  - Created via alerts dock form, chart context menu ("Add Alert at X"), or `Alt+A` shortcut.
  - Evaluated on every price tick in `AlertsManager.checkPrice`.
  - On trigger: sets `triggered = true`, emits audio beep, displays UI toast, and optionally fires `/api/webhook`.
  - Toggled between active/paused via `.toggle-alert-btn`.
  - Deleted via `.delete-alert-btn` or canvas overlay badge `✕` button, recording tombstone in `tradingchart_alerts_deleted`.

---

## 4. Webhook Token (`WebhookToken`)

Cryptographic token granting external automation access to a user's isolated Trade-Relay execution engine.

- **Storage**:
  - Server filesystem: `server/data/accounts/users.json` (stored within individual user objects).
- **Fields**:
  - `webhookTokenHash` (`string | null`, optional): 64-character hexadecimal SHA-256 hash of the 24-byte random token.
  - `webhookTokenHint` (`string | null`, optional): Last 4 characters of the raw unhashed token (e.g. `'a8F1'`).
- **Validation**:
  - Raw tokens are 24 cryptographically secure random bytes encoded as `base64url` (`crypto.randomBytes(24).toString('base64url')`).
  - Inbound route parameters must match format regex `/^[A-Za-z0-9_-]{20,64}$/`.
- **Limits**:
  - Available only to accounts with plan entitlement `webhookAlerts` (Plus, Premium, Institutional).
  - Generation/rotation rate limited to 5 requests per minute per IP.
- **Lifecycle**:
  - Generated via `POST /api/user/webhook/rotate`.
  - The raw unhashed token is returned to the client exactly once upon generation.
  - Subsequent requests to `GET /api/user/webhook` return only `{ enabled, hasToken, hint }`.
  - Rotation immediately overwrites `webhookTokenHash`, instantly revoking the prior URL.

---

## 5. Trade-Relay Account (`TradeRelayAccount`)

An in-memory simulated broker account executing programmatic webhook orders with automated safety rails.

- **Storage**:
  - Server in-memory state: `relays` Map in `server/tradeRelayApi.js` (LRU-capped at 2000 instances; volatile across process restarts).
- **Fields**:
  - `accountBalance` (`number`, required): Current simulated cash balance (starts at `$100,000.00`).
  - `initialBalance` (`number`, required): Benchmark equity balance ($100,000) for drawdown calculations.
  - `activePositions` (`Map<string, RelayPosition>`, required): Symbol-keyed active positions:
    - `qty` (`number`): Position quantity.
    - `avgPrice` (`number`): Weighted average fill price.
    - `side` (`'long' | 'short'`): Position direction.
    - `sl` (`number | undefined`): Optional stop loss price.
    - `tp` (`number | undefined`): Optional take profit price.
  - `orderLogs` (`RelayLogEntry[]`, required): FIFO execution log recorder (capped at 500 entries):
    - `id` (`string`): Order log ID (`'ord-' + random`).
    - `receivedAt` (`string`): ISO 8601 receipt timestamp.
    - `payload` (`object`): Inbound request payload.
    - `status` (`'pending' | 'filled' | 'rejected'`): Execution outcome.
    - `rejectionReason` (`string | null`): Safety rail or validation failure explanation.
    - `executionPrice` (`number | null`): Simulated fill price.
    - `filledQuantity` (`number | null`): Executed quantity.
    - `pnl` (`number`): Realized P&L on closing transactions.
  - `lastOrderTs` (`number`, required): Epoch timestamp in ms of last processed order.
  - `maxOrderSize` (`number`, constant): Safety cap on single order notional value (`$50,000`).
  - `maxDailyDrawdownPct` (`number`, constant): Daily drawdown circuit breaker threshold (`5.0%`).
  - `rateLimitMs` (`number`, constant): Minimum interval between orders (`1,000 ms`).
- **Validation**:
  - Mandatory fields: `action` (`'BUY'` or `'SELL'`), `symbol` (non-empty string), `quantity` (`> 0` and `<= 1e9`).
  - Safety rails: Spacing `>= 1,000 ms`, notional `<= $50,000`, cumulative drawdown `< 5.0%`.
- **Limits**:
  - Inbound request rate limit: 60 requests per minute per IP.
  - Order log retention: FIFO ring buffer capped at 500 entries.
- **Lifecycle**:
  - Instantiated lazily upon first webhook signal or account state query for a user ID.
  - Maintained in LRU cache (max 2000 users).
  - Resets to $100k balance and empty positions upon Node.js process restart.

---

## 6. Replay Session (`ReplaySession`)

An ephemeral client-side historical rewind state controlling candle playback and simulated trade execution.

- **Storage**:
  - Client in-memory state: Managed by `BarReplay` class (`client/src/barReplay.js`).
- **Fields**:
  - `totalBars` (`number`, required): Total bar count of the full active candlestick series.
  - `currentIndex` (`number`, required): Zero-based pointer to the latest visible bar in replay mode.
  - `isPlaying` (`boolean`, required): Playback loop status flag (`true` when playing, `false` when paused).
  - `speed` (`number`, required): Playback speed multiplier (`0.5 | 1.0 | 2.0 | 5.0 | 10.0`).
  - `timer` (`number | null`, internal): Active timer ID driving `tick()` intervals (`Math.round(1000 / speed)` ms).
  - `currentPrice` (`number`, required): Closing price of the bar at `currentIndex`.
  - `replayPosition` (`ReplayPosition | null`, optional): Open simulated replay trade:
    - `side` (`'long' | 'short'`): Trade direction.
    - `qty` (`number`): Fixed at `0.1`.
    - `entryPrice` (`number`): Bar close price upon entry.
    - `pnl` (`number`): Live floating profit or loss.
    - `entryAt` (`string`): ISO 8601 string of historical candle timestamp (`barTime()`).
- **Validation**:
  - `currentIndex` clamped to `totalBars - 1`; pauses playback and alerts user when reaching latest bar.
  - Starting index clamped by user plan `barReplayMinuteDays`: Basic (180 days), Essential (365 days), Plus/Premium/Institutional (unlimited).
- **Limits**:
  - Exactly one active replay position (0.1 qty) permitted at a time.
- **Lifecycle**:
  - Activated by clicking `#btn-topbar-replay`; slices chart orchestrator series to 70% depth.
  - Advanced manually by Step button or automatically by Play timer.
  - Closed by clicking Exit button or toggling replay button, which stops playback, closes open replay positions to Trade Journal, and restores full original candle series.