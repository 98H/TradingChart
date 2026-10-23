# Feature Specification: Paper Trading, Alerts and Bar Replay

**Feature Branch**: `006-trading-alerts-replay` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Let traders practise without risk: one-click and ticket-based paper trading with several accounts, price alerts with TradingView-style conditions and personal webhooks, and a bar-replay mode to trade history candle by candle — every trade flowing into the journal, every limit enforced by plan."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-click paper trading (Priority: P1)

A trader buys or sells the current symbol at market from the quick-trade widget on the chart, adjusting quantity with a stepper; on mobile the widget starts minimised as a "Trade" pill.

**Why this priority**: The fastest path to practising a trade idea.

**Independent Test**: Set quantity 0.10, click BUY, confirm a toast and an open long position of 0.10 in the paper panel.

**Acceptance Scenarios**:

1. **Given** quantity 0.05, **When** the user clicks "+" twice, **Then** quantity is 0.15; "−" never goes below 0.01.
2. **Given** the widget, **When** the user clicks BUY or SELL, **Then** a market order fills at the half-spread quote, a position opens and a toast "✓ Executed BUY/SELL … @ market" (Persian equivalent in FA) confirms it.
3. **Given** a viewport ≤ 768 px, **Then** the widget starts minimised and the "Trade" pill restores it.

---

### User Story 2 - Paper trading panel (Priority: P1)

A trader opens the paper panel to see equity, free balance and unrealised P&L, switches between paper accounts or creates one within the plan limit, places market, limit and stop orders from the ticket or limit orders from the DOM ladder, closes positions, cancels pending orders, and resets an account.

**Independent Test**: Place a limit buy below market (pending), cancel it; place a market buy, close it; confirm both executions appear in the trade journal.

**Acceptance Scenarios**:

1. **Given** the order ticket, **When** the user selects Limit or Stop, **Then** a price field appears labelled "Limit price" or "Stop trigger price".
2. **Given** a market order with sufficient margin, **Then** it fills immediately, margin is deducted and a position card appears; **given** a non-marketable limit/stop, **Then** it is listed as pending with a count badge.
3. **Given** an open position, **When** the user clicks Close, **Then** margin plus unrealised P&L returns to the balance, the trade moves to history and its open and close executions are written to the trade journal.
4. **Given** a plan's `paperAccounts` limit reached, **When** the user clicks "+", **Then** creation is refused and the plans dialog opens; **given** `holdingsPerAccount` reached, **Then** a new position is refused the same way.
5. **Given** Reset, **When** the user confirms the danger dialog, **Then** the account balance returns to $100,000 and open positions are closed.

---

### User Story 3 - Price alerts (Priority: P1)

A trader creates price alerts with one of 11 conditions (crossing, crossing up/down, greater/less than, enter/exit/inside/outside channel, move up/down %), from the alerts panel, Alt+A or the chart context menu, sees them as lines on the chart, pauses or deletes them, and is notified when they trigger.

**Independent Test**: Create a "greater than" alert below the current price; confirm it triggers and notifies; create, pause and delete another.

**Acceptance Scenarios**:

1. **Given** the create form, **When** a channel condition is chosen, **Then** a channel-low field appears and the target is labelled "Channel High"; a % condition relabels it "Move %".
2. **Given** a right-click on the chart at price X, **When** the user picks "Add Alert at X", **Then** an alert at X is created, a toast confirms it and a line appears on the chart.
3. **Given** the plan's `priceAlerts` limit reached, **When** the user creates an alert, **Then** it is refused and the plans dialog opens; a signed-in user's synced state above the limit is rejected by the server with `403 limit_exceeded`.
4. **Given** an alert off the visible price range, **Then** a pinned badge with ▲/▼ shows at the top or bottom of the chart; its ✕ deletes the alert.
5. **Given** an alert is deleted on one device, **Then** it stays deleted after cloud sync (tombstone).

---

### User Story 4 - Personal webhook (Trade-Relay) (Priority: P2)

A Plus-or-higher user generates a secret personal webhook URL so external automation (e.g. TradingView alerts) can place simulated orders on their Trade-Relay account; rotating the URL invalidates the old one.

**Acceptance Scenarios**:

1. **Given** a signed-in Plus user, **When** they click Generate and confirm, **Then** a URL containing a new secret token is shown with a copy button; regenerating replaces it.
2. **Given** a Basic user, **Then** the card shows a locked notice and the rotate/execute APIs answer `403 plan_feature_locked`.
3. **Given** a valid token, **When** an external system posts `{action:"BUY", symbol, quantity}` to the URL, **Then** a simulated fill is returned with the account summary; an unknown or malformed token gets `404 not_found`; more than 60 requests/minute per IP get `429`.

---

### User Story 5 - Bar replay (Priority: P2)

A trader rewinds the chart, steps or plays candles forward at 0.5×–10× speed, opens and closes a simulated position on historical bars, and exits back to the live chart; replay trades are logged to the journal with the simulated bar time.

**Acceptance Scenarios**:

1. **Given** the chart, **When** the user clicks the replay button, **Then** the series is cut back (to 70% depth, never earlier than the plan's `barReplayMinuteDays`) and the replay bar appears.
2. **Given** replay, **When** the user clicks Step, **Then** exactly one candle is added and the progress "X / Y" increases by one; Play advances automatically at the selected speed and pauses with a toast at the latest bar.
3. **Given** replay and no position, **When** the user clicks Buy, **Then** a 0.1 simulated long opens at the current bar close with live P&L; clicking Sell (or ✕) closes it and logs both executions to the journal with source "replay".
4. **Given** replay, **When** the user clicks Exit, **Then** any replay position is closed, the bar hides and the full series is restored.

---

### Edge Cases

- Margin insufficient → the order is refused with a message; no position opens.
- Alert webhook firing while signed out or locked → no external call is made.
- Webhook payload with invalid action, symbol, quantity, price or SL/TP → `400` with `invalid_action` / `invalid_symbol` / `invalid_quantity` / `invalid_price` / `invalid_sl_tp`; safety-rail violations (drawdown breaker, max order size, rate) → `400` with the rail's error.
- Server restart → Trade-Relay balances and logs reset (in-memory by design; see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The quick-trade widget MUST offer BUY and SELL at market for the active symbol with a quantity stepper (step 0.05, minimum 0.01), confirm each fill with a localized toast, and minimise to a "Trade" pill (minimised by default on viewports ≤ 768 px).
- **FR-002**: The paper panel MUST show equity, free balance and unrealised P&L of the active paper account and let the user switch accounts; a "Main Paper" account MUST always exist.
- **FR-003**: Creating a paper account MUST respect `paperAccounts` (client) and the server MUST reject a synced state exceeding it with `403 limit_exceeded`; opening a position beyond `holdingsPerAccount` MUST be refused with the plans dialog.
- **FR-004**: The order ticket MUST support Market, Limit and Stop orders; market orders MUST fill at the half-spread quote after margin validation; non-marketable limit/stop orders MUST rest as pending orders that can be cancelled with the toast "Order cancelled.".
- **FR-005**: The ticket's DOM sub-tab MUST place limit orders at a clicked bid/ask price, and the chart context menu MUST place "Buy Limit at X" / "Sell Limit at X" orders with the quick-trade quantity, filling immediately when marketable.
- **FR-006**: Closing a position MUST return margin plus P&L to the balance, move it to history and write its open and close executions to the trade journal.
- **FR-007**: Reset MUST require a danger confirmation and restore the account to a $100,000 balance with no open positions.
- **FR-008**: Alerts MUST support the 11 conditions `crossing, crossing_up, crossing_down, greater_than, less_than, enter_channel, exit_channel, inside_channel, outside_channel, move_up_pct, move_down_pct`, with a channel-low field for channel conditions and a % field for move conditions.
- **FR-009**: Alerts MUST be creatable from the alerts panel (rail button or Alt+A) and from "Add Alert at X" in the chart context menu, and MUST be pausable and deletable; deletions MUST leave tombstones so they survive sync.
- **FR-010**: Alert creation MUST respect `priceAlerts` (client: plans dialog) and the server MUST reject a synced state exceeding it with `403 limit_exceeded`.
- **FR-011**: Active alerts of the current symbol MUST render as price lines with badges on desktop, pinned ▲/▼ badges when off-scale, each with a delete control.
- **FR-012**: A triggered alert MUST notify the user and, if the user has an active webhook entitlement, post the configured action to the user's Trade-Relay.
- **FR-013**: `GET /api/user/webhook` MUST return `{ok, enabled, hasToken, hint}` for the signed-in user; `POST /api/user/webhook/rotate` MUST require `webhookAlerts`, be limited to 5 requests/minute, store only a SHA-256 hash of a new 24-byte token and return `{ok, token, hint}` (last 4 characters).
- **FR-014**: `POST /api/webhook/:token` MUST authenticate by token hash (format `^[A-Za-z0-9_-]{20,64}$`), answer `404 not_found` for malformed/unknown tokens or suspended users, `403 plan_feature_locked` without `webhookAlerts`, `429` above 60 requests/minute per IP, validate the payload (`invalid_action`, `invalid_symbol`, `invalid_quantity`, `invalid_price`, `invalid_sl_tp`) and return the simulated fill and account summary; `POST /api/webhook` MUST do the same for the signed-in session.
- **FR-015**: The Trade-Relay MUST apply safety rails (drawdown circuit breaker, maximum order size, rate limit) and `GET /api/trade-relay/account` MUST return balance (initial 100 000), positions and recent logs.
- **FR-016**: Bar replay MUST cut the active series back to 70% depth (no earlier than `barReplayMinuteDays` allows), provide Step, Play/Pause at 0.5×, 1×, 2×, 5×, 10×, show progress "X / Y", pause with a localized toast at the latest bar, and restore the full series on Exit.
- **FR-017**: In replay, Buy/Sell MUST open a 0.1 simulated position at the current bar close (or close an opposite one) with live P&L, and closing MUST log entry and exit to the trade journal with source "replay" and the simulated bar time.
- **FR-018**: Alerts, paper accounts and the active paper account MUST persist on the device and be part of the signed-in user's cloud state.
- **FR-019**: All controls and toasts of this feature MUST be available in English and Persian.

### Key Entities

- **Paper Account**: id, name, balance, positions, history, pending orders, created time.
- **Position / Order / Execution**: symbol, side, quantity, price, type, status, timestamps.
- **Alert**: id, symbol, condition, target, channel low or reference price, notification channel, active/triggered flags, created time; deletion tombstones.
- **Webhook Token**: hash and 4-character hint stored per user.
- **Trade-Relay Account**: in-memory balance, positions and logs per user.
- **Replay Session**: start index, current index, speed, simulated position.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A market paper trade can be placed in 1 click from the chart; 100% of fills update balance and positions consistently.
- **SC-002**: 100% of closed paper and replay positions appear in the trade journal with both executions.
- **SC-003**: All 11 alert conditions evaluate correctly on synthetic price paths in the alert suite.
- **SC-004**: 100% of plan limits in this feature (alerts, paper accounts, holdings, webhook, replay depth) block the action and open the plans dialog when exceeded.
- **SC-005**: Replay Step adds exactly one candle per click in 100% of runs and Exit restores the original series length.

## Assumptions

- Paper trading and alerts are evaluated in the browser; the server enforces only the synced-state quotas and the webhook entitlement.
- The Trade-Relay is an in-memory simulator; persistence across restarts is out of scope today.
- Known gaps for Converge: `holdingsPerAccount` and `barReplayMinuteDays` client-only; `barReplaySecond`, `technicalAlerts`, `watchlistAlerts`, `alertDays` defined but unwired; webhook fired from the browser without server price validation; untranslated trigger toast, pending-order row, replay speed labels and quick-trade tooltips; inconsistent default leverage; overlay timer never cleared; silent catches on storage, journal sync and webhook errors; unused `globalRelay` export.
