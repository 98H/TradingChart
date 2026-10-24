# Quickstart & Verification: Paper Trading, Alerts and Bar Replay

Step-by-step guide to running the local Chartivia application, executing automated test suites, and manually verifying each user story on a live chart session.

---

## 1. Prerequisites and Server Startup

Ensure the local Node.js environment is configured and the Chartivia server is running on port 8088:

```bash
# Check service status or start the dev server
cd /root/TradingChart
export SDD_BASE_URL="http://127.0.0.1:8088"
export PORT=8088

# Check if the service is active
curl -s -o /dev/null -w "%{http_code}\n" "$SDD_BASE_URL/chart"
# Expected output: 200
```

If the service is not currently running, start it:

```bash
bash scripts/build_and_restart.sh
```

---

## 2. Automated Test Suites

Run the existing regression and integration test suites that cover the 006 feature area:

### 2.1 Alert Conditions & Engine Evaluation
Exercises all 11 condition types, channel bounds visibility, and UI creation:
```bash
node tests/qa_cycle_alerts.cjs
```
*Expected result*: `PASS: 11 alert conditions`, `PASS: channel-low field appears`, `PASS: up conditions fire`, `PASS: down conditions fire`, `PASS: outside_channel fires`, `PASS: UI creates alert`, and `ZERO DEFECTS ✅`.

### 2.2 Bar Replay & Trade Simulation
End-to-end test of replay activation, simulated Buy execution, 3-bar stepping, position P&L tracking, close, and exit:
```bash
node tests/test_replay_and_scales.cjs
```
*Expected result*: `Scale Controls Dock visible: true`, `Simulated Trade State in Replay` verified, and screenshot artifacts saved to `dogfood_cycle6/`.

### 2.3 Chart Orchestrator Bar Slicing & Stepping
Validates series rewind, stepping with `applyBar`, and non-destructive series restoration:
```bash
node tests/test-replay-interaction.js
```
*Expected result*: Console logs `{ initialCount: N, afterSliceCount: 100, afterStepCount: 101, restoredCount: N }`.

### 2.4 Paper Trading Order Flow & Mobile Quick Trade
Exercises paper order flow execution (`B01`), alert addition (`B02`), and mobile quick trade (`Bm03`):
```bash
node tests/qa_cycleB.cjs
```
*Expected result*: Zero defects across desktop and mobile suites.

### 2.5 Webhook Plan Gating & Rotation
Verifies that webhook rotation and execution endpoints return HTTP 403 on the Basic plan:
```bash
node tests/qa_prod_cycle1.cjs
```
*Expected result*: `PASS: webhook locked on basic`, `PASS: rotate refused on basic`, `PASS: webhook execution gated by plan`.

### 2.6 Quick Trade Controls & Steppers
Tests quantity steppers, buy/sell 1-click execution, and widget minimization:
```bash
node tests/rigorous_full_dogfood_cycle13.cjs
```
*Expected result*: Stepper increment/decrement and order execution verified.

---

## 3. Manual User Story Verification Procedures

Open `$SDD_BASE_URL/chart` in a desktop browser (Chromium or Safari).

### User Story 1 — One-Click Paper Trading (Priority: P1)

1. **Verify Default Mount**: Observe `#chart-quick-trade` floating near the top-left of the chart canvas displaying `SELL` (red), `BUY` (green), quantity `0.10`, and the bid/ask spread (`$5.00` on BTCUSDT).
2. **Test Stepper**:
   - Click `+` (`#qt-qty-inc`) twice: quantity increments from `0.10` to `0.20`.
   - Click `−` (`#qt-qty-dec`) repeatedly: quantity decrements by `0.05` down to `0.01` and never goes below `0.01`.
3. **Execute Market Order**:
   - Set quantity to `0.10` and click `BUY` (`#quick-trade-buy-btn`).
   - Confirm a toast appears: `"✓ Executed BUY 0.1 BTCUSDT @ market"` (or `"✓ سفارش خرید ۰.۱ BTCUSDT به قیمت بازار اجرا شد"` in Persian).
   - Click the desktop rail button `[data-panel="paper"]` to open the Paper Trading dock: verify an open Long position of 0.10 BTCUSDT appears.
4. **Test Mobile Viewport**:
   - Resize browser window to `390px` width (or inspect with mobile device emulation).
   - Verify `#chart-quick-trade` starts minimized and `#qt-collapsed-trigger` pill labeled `"Trade"` is visible.
   - Click `#qt-collapsed-trigger`: widget opens. Click `#qt-toggle-btn`: widget collapses back into the pill.

---

### User Story 2 — Paper Trading Panel (Priority: P1)

1. **Inspect Metrics**:
   - Open the paper panel (`.rail-btn[data-panel="paper"]`).
   - Verify `Paper Account Equity`, `Free Balance`, and `Unrealized P&L` are displayed and accurately reflect open positions.
2. **Order Ticket (Limit & Stop)**:
   - On the Order Ticket tab, change `#order-type-sel` from `Market` to `Limit`.
   - Verify `#order-price-wrap` appears with the label `"Limit price"`.
   - Enter a price $1,000 below market and click `Buy / Long`.
   - Verify a toast confirms the order was placed as pending: `"Buy limit 0.1 BTCUSDT @ ... placed (pending)"`.
   - Inspect `#orders-table-wrap`: verify the order is listed and `#ord-count-badge` displays `1`.
   - Click `Cancel` (`.cancel-ord-btn`): verify toast `"Order cancelled."` and order disappears.
3. **Level 2 DOM Ladder**:
   - Click `#btn-subtab-dom` ("Depth of Market (DOM)").
   - Verify 5 red ask rows and 5 green bid rows appear around the current price with a spread badge.
   - Click a bid row below market: verify a resting long limit order is placed at that exact row's price.
4. **Close Position & Journal Verification**:
   - Switch back to `#btn-subtab-ticket`.
   - Click `Close` (`.close-pos-btn`) on the open position card.
   - Verify the position closes, margin plus P&L returns to Free Balance, and the trade moves to History.
   - Open the Trade Journal panel: verify two execution records (`exec-open-...` and `exec-close-...`) are recorded.
5. **Multi-Account Switching & Reset**:
   - Click `+` (`#btn-paper-new-account`): prompt requests an account name. Enter `"Scalp"`: a new account chip appears and becomes active.
   - Click `Reset` (`#btn-reset-paper`): danger confirmation dialog appears. Click confirm: balance resets to `$100,000.00` and open positions are cleared.

---

### User Story 3 — Price Alerts (Priority: P1)

1. **Context Menu Quick Alert**:
   - Right-click anywhere on the chart canvas.
   - Click `"Add Alert at $..."` (`#ctx-add-alert`) or press `Alt+A`.
   - Confirm toast `"Price alert created at ..."` appears, and a red dashed line with badge (`.canvas-alert-line`) appears at that exact pixel height on the canvas.
2. **Channel Conditions Form**:
   - Open the alerts dock panel (`.rail-btn[data-panel="alerts"]`).
   - Click `+ New Alert` (`#btn-create-alert-toggle`).
   - Select condition `"Enter Channel"` (`#new-alert-cond`): verify `#alert-channel-low-row` appears and price label changes to `"Channel High ($)"`.
   - Select condition `"Move Up %"`: verify channel-low hides and price label changes to `"Move %"`.
3. **Trigger Evaluation**:
   - Create a `"Greater Than"` alert with target price below current market price.
   - On the next price tick, verify the alert fires: sound synthesizer plays a beep, toast `"🚨 Alert: ..."` appears, and the alert list badge marks the alert as `"TRIGGERED"` / `"اجرا شد"`.
4. **Canvas Off-Scale Badges**:
   - Zoom in heavily on the chart until the alert price moves above the visible scale.
   - Verify a pinned badge (`.canvas-alert-pinned-top`) docks in the price axis with a `▲` arrow.
   - Click `✕` on the badge: verify the alert is removed from both canvas and alerts list.
5. **Deletion Tombstones**:
   - Check `localStorage.getItem('tradingchart_alerts_deleted')`: verify the deleted alert ID is stored as a tombstone.

---

### User Story 4 — Personal Webhook (Trade-Relay) (Priority: P2)

1. **Gating Check on Basic Plan**:
   - In an incognito tab or as a Basic plan user, open the alerts dock panel.
   - Inspect the Trade-Relay Webhook card: verify message `"Webhook alerts are available on Plus and higher plans."` / `"هشدار وب‌هوک در پلن‌های Plus و بالاتر در دسترس است."` is shown.
2. **Generate Token on Plus Plan**:
   - Sign in with an account having Plus, Premium, or Institutional tier.
   - Click `Generate` (`#btn-rotate-webhook`): confirm dialog prompts.
   - Upon confirmation, verify `#webhook-endpoint-input` displays the full secret URL containing the 24-byte base64url token and `#btn-copy-webhook` appears.
   - Click `Copy`: verify clipboard receives the complete URL.
   - Reload page: verify token is masked (`••••••••<hint>`).
3. **Test Webhook Execution via curl**:
   ```bash
   # Substitute <TOKEN> with your generated token
   curl -X POST http://127.0.0.1:8088/api/webhook/<TOKEN> \
     -H "Content-Type: application/json" \
     -d '{"action":"BUY","symbol":"BTCUSDT","quantity":0.1}'
   ```
   *Expected response*: HTTP 200 with `{ "ok": true, "success": true, "log": { ... }, "account": { "balance": ..., "openPositions": [...] } }`.
4. **Test Safety Rails**:
   - Test order notional cap ($50k):
     ```bash
     curl -X POST http://127.0.0.1:8088/api/webhook/<TOKEN> \
       -H "Content-Type: application/json" \
       -d '{"action":"BUY","symbol":"BTCUSDT","quantity":10,"price":60000}'
     ```
     *Expected response*: HTTP 400 with `"Order notional $600000.00 exceeds safety cap of $50000"`.
   - Test rate limiter (< 1s): send two requests simultaneously; the second returns HTTP 400 with `"Rate limit exceeded: too many orders per second"`.

---

### User Story 5 — Bar Replay (Priority: P2)

1. **Activate Replay**:
   - Click the replay button in the topbar (`#btn-topbar-replay`).
   - Verify `#replay-bar` floats into view above the chart and the topbar button gains the `.active` class.
   - Verify the candlestick series on the chart is cut back to 70% depth.
2. **Step Forward**:
   - Click `Step →` (`#btn-replay-step`): verify exactly one new candle appears on the chart and progress text `#replay-progress-text` increments from `X / Y` to `X+1 / Y`.
3. **Playback Controller**:
   - Select speed `2.0x` in `#sel-replay-speed`.
   - Click `Play` (`#btn-replay-playpause`): verify candles advance automatically every 500 ms.
   - Click `Pause`: playback stops.
4. **Replay Trading Execution**:
   - While paused, click `Buy` (`#btn-replay-buy`).
   - Verify `#replay-pos-wrap` appears showing `LONG 0.1` and floating P&L in monospace digits.
   - Click `Step →` 3 times: verify P&L updates based on each new candle's closing price.
   - Click `✕` (`#btn-replay-close-pos`): position closes, toast confirms P&L and journal logging: `"Replay position closed: ... — logged to journal (source: replay)"`.
5. **Exit Replay**:
   - Click `✕ Exit` (`#btn-replay-exit`).
   - Verify `#replay-bar` hides, `.active` is removed from `#btn-topbar-replay`, and the chart immediately restores its full original candlestick series.