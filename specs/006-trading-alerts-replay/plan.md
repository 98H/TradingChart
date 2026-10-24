# Implementation Plan: Paper Trading, Alerts and Bar Replay

**Branch**: `006-trading-alerts-replay` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-trading-alerts-replay/spec.md`

## Summary

The Trading Alerts & Replay feature delivers a risk-free paper execution suite for Chartivia:
1. **One-Click Quick Trade**: Floating chart overlay widget (`#chart-quick-trade`) with 0.05 BTC step sizing (minimum 0.01), half-spread market quotes, and responsive auto-minimization to a floating "Trade" pill (`#qt-collapsed-trigger`) on mobile screens (≤ 768px).
2. **Institutional Paper Trading Terminal**: Side-dock portfolio manager (`PaperTrading`) providing multi-account isolation, equity/free balance/unrealized P&L tracking, order tickets supporting Market, Limit, and Stop orders, Level 2 Depth of Market (DOM) ladder order placement, and automatic trade logging into the persistent Trade Journal.
3. **Price Alerting & Canvas Overlay**: Comprehensive 11-condition alert evaluator (`AlertsManager`), supporting channel bounds and percentage moves, paired with pixel-exact canvas price lines and directional off-scale pinned badges (`ChartAlertsOverlay`) projected directly via Vela's coordinate engine.
4. **Personal Trade-Relay Webhook**: Dedicated inbound webhook engine (`/api/webhook/:token`) authenticating external automation (e.g. TradingView alerts) via SHA-256 token hashes, enforcing per-IP rate limits and automated execution safety rails (rate limiting, $50k notional cap, 5% daily drawdown circuit breaker).
5. **Historical Bar Replay**: Interactive historical market rewind engine (`BarReplay`) slicing candlestick history back to 70% depth (clamped by plan `barReplayMinuteDays`), supporting manual stepping, auto-playback at 0.5×–10× speeds, simulated in-replay buy/sell execution, and trade journaling stamped with simulated historical timestamps.

All user entities persist in browser `localStorage` with tombstone-based deletion tracking and synchronize seamlessly to per-user cloud state files (`server/data/accounts/states/state_u_<userId>.json`) subject to account plan tier quotas.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ ESM in browser; Node.js v20+ ESM in backend).

**Primary Dependencies**:
- `express`: `^4.21.2` (HTTP routing, parameter extraction, and security middleware).
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine hosting coordinate projections and candle series orchestrator).
- `crypto`: Node.js built-in standard library (SHA-256 hashing for webhook tokens, secure random bytes generation).
- `puppeteer-core`: `^24.3.1` (Headless browser automation for acceptance tests).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography and numerals formatting).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Monospace figures for tabular financial data).

**Storage**:
- Client `localStorage`:
  - `tradingchart_alerts`: JSON array of active and triggered price alert definitions.
  - `tradingchart_alerts_deleted`: JSON map of deletion tombstones (`alertId -> timestampMs`).
  - `tradingchart_paper_accounts`: JSON array of serialized paper accounts (pre-seeded with `pap_main`).
  - `tradingchart_paper_deleted`: JSON map of account deletion tombstones.
  - `tradingchart_paper_active`: String ID of the currently selected paper account.
- Server filesystem:
  - `server/data/accounts/users.json`: User credential records containing `webhookTokenHash` and `webhookTokenHint`.
  - `server/data/accounts/plans.json`: Entitlement definitions and tier quotas.
  - `server/data/accounts/states/state_u_<userId>.json`: Per-user synchronized cloud state.
- Server in-memory state:
  - `relays` (`server/tradeRelayApi.js`): `Map<userId, TradeRelay>`, LRU-capped at 2000 instances; volatile across process restarts.

**Testing**:
- Puppeteer browser test suites:
  - `tests/qa_cycle_alerts.cjs`: Tests 11 alert conditions in create form, channel-low visibility, condition engine evaluation, and UI alert creation.
  - `tests/test_replay_and_scales.cjs`: End-to-end test of bar replay toggle, buy order execution, 3-bar stepping, position P&L tracking, close, exit.
  - `tests/test-replay-interaction.js`: Headless test of Vela chart orchestrator series slicing, stepping forward with `applyBar`, and restore.
  - `tests/qa_cycleB.cjs`: Exercises paper trading order flow execution (`B01`), alerts addition (`B02`), and mobile quick-trade restore & buy execution (`Bm03`).
  - `tests/qa_prod_cycle1.cjs`: Integration tests for webhook gating on Basic plan, webhook rotation, and `/api/webhook` execution.
  - `tests/rigorous_full_dogfood_cycle13.cjs`: Tests quick-trade stepper buttons, 1-click execution, minimized toggle, and replay bar visibility.

**Target Platform**: Modern desktop and mobile evergreen web browsers (Chromium, Firefox, Safari/WebKit) with bilingual LTR/RTL support.

**Project Type**: Responsive single-page web charting application (`/chart`) backed by an Express REST API.

**Performance Goals**:
- Quick-trade 1-click order execution latency under 16 ms (synchronous DOM update within one animation frame).
- Canvas alerts overlay re-projection coalesced via `requestAnimationFrame` to maintain 60 FPS during pan/zoom.
- Trade-Relay webhook processing latency under 20 ms.
- Bar replay step forward execution under 50 ms.

**Constraints**:
- Trade-Relay state is in-memory only by design; server restarts reset balances and positions.
- Inbound webhooks must be protected against brute-force attacks via SHA-256 token hashing and rate gates.
- Offline and multi-tab synchronization must resolve concurrently modified accounts and alerts without resurrecting deleted records.

**Scale/Scope**:
- Support up to 1,000 active price alerts per user (institutional tier).
- Up to 7 paper trading portfolio accounts per user with 150 open holdings each.
- Inbound webhook processing up to 60 requests/minute per IP.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | All paper trading and trade relay operations are explicitly and visibly isolated as simulated/paper execution (`isSystem: true`, 'Paper execution (no real money)', `source: 'replay'`, 'Main Paper'). No simulated fills claim to be real exchange executions. |
| II | Spec Before Code | VIOLATION | The paper trading terminal, alert condition engine, and bar replay were written between September and October 2026 before adopting Hybrid SDD. Retrofit establishes the full specification and verification kit. |
| III | Real-Browser Zero-Defect Verification | VIOLATION | Automated test suites (`qa_cycle_alerts.cjs`, `test_replay_and_scales.cjs`, `qa_cycleB.cjs`, `qa_prod_cycle1.cjs`, `rigorous_full_dogfood_cycle13.cjs`) cover specific desktop and mobile viewports, but complete matrix execution (`desktop\|mobile` × `fa\|en`) across all permutations has gaps; some tests use programmatic clicks (`btn.click()`) rather than coordinate-derived pointer clicks. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Extensive Persian localization exists for quick trade, order ticket, DOM ladder, and alert conditions. However, minor gaps remain: alert triggered toast is hardcoded in English (`client/src/alertsManager.js:201`), pending order table row formatting lacks Persian digits (`client/src/paperTrading.js:762`), replay speed options lack Persian labels (`client/src/barReplay.js:160-165`), and quick trade widget HTML title tooltips are in English (`client/chart/index.html:168-189`). |
| V | Mobile Fit and Interaction Safety | VIOLATION | Quick trade automatically minimizes on viewports <= 768px (`#qt-collapsed-trigger` pill) and toasts are single-line, but the pinned alert delete buttons on the canvas overlay are hidden on mobile rather than touch-optimized, and quick-trade stepper buttons have small hit areas on mobile. |
| VI | Security and Privacy by Default | PASS | Webhook tokens are generated as 24-byte cryptographically random base64url strings; only SHA-256 hashes and 4-character hints are stored in `server/data/accounts/users.json`. Webhook endpoints enforce rate limiting (60 req/min for execution, 5 req/min for rotation) via `rateGate`. Trade-Relay applies safety rails (1s rate limit, $50k max order notional, 5% daily drawdown circuit breaker). State writes are checked against user authentication. |
| VII | Single Source of Truth for Entitlements | VIOLATION | Plan quotas for `priceAlerts`, `webhookAlerts`, and `paperAccounts` are defined in `server/featuresCatalog.js` and enforced server-side during `PUT /api/user/state` and `/api/user/webhook/rotate`. However, `holdingsPerAccount` and `barReplayMinuteDays` are enforced client-only in `client/src/paperTrading.js:641` and `client/src/barReplay.js:30-35`, with no server-side validation. |
| VIII | Performance Budget | PASS | Alerts canvas overlay coalesces re-projections via `requestAnimationFrame` on user interaction and throttles autoscale re-projection to a 1000ms timer that skips when `document.hidden`. Replay engine ticks run via a variable setTimeout. Quick trade price updates reuse spread calculation without perpetual high-frequency loops. (Minor gap: overlay interval is not cleared on unmount). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Relies on standard Node.js crypto and built-ins; client modules use native DOM and Canvas/Vela public projection APIs; no external libraries added and no files in `node_modules` modified. |
| X | Hybrid SDD | VIOLATION | Feature was implemented prior to SDD adoption. Retrofit generates formal Spec Kit artifacts to govern all future iterations without modifying working product code. |

## Project Structure

### Documentation (this feature)

```text
specs/006-trading-alerts-replay/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-019, SC-001..SC-005)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R11, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/webhook, /api/user/webhook, /api/trade-relay/account, etc.)
│   └── module-api.md           # Client module interfaces, methods, and event bindings
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Mounts for #replay-bar, #chart-quick-trade, #qt-collapsed-trigger, and tool rail buttons
├── src/
│   ├── paperTrading.js         # PaperTrading terminal, multi-account manager, order ticket, L2 DOM
│   ├── alertsManager.js        # AlertsManager: 11 condition evaluator, Trade-Relay webhook UI card
│   ├── chartAlertsOverlay.js   # ChartAlertsOverlay: Canvas overlay for alert lines and pinned off-scale badges
│   ├── barReplay.js            # BarReplay: Historical candlestick rewind, playback controller, simulated replay trading
│   ├── canvasContextMenu.js    # CanvasContextMenu: Right-click context menu "Add Alert at X", Buy/Sell limit triggers
│   ├── main.js                 # App coordinator, quick-trade bindings, Alt+A shortcut, replay topbar toggle, toasts
│   └── i18n.js                 # Localization utilities and Persian digit conversions
├── styles/
│   └── main.css                # Styles for .quick-trade-widget, #replay-bar, .canvas-alert-line, .canvas-alert-badge
server/
├── tradeRelayApi.js            # Authenticated Trade-Relay HTTP endpoints, token rotation, rate limiting
├── tradeRelay.js               # TradeRelay simulation engine with safety rails (drawdown breaker, size cap, rate gate)
├── accounts.js                 # Cloud state persistence (/api/user/state) & quota validator (priceAlerts, paperAccounts)
├── featuresCatalog.js          # Plan tier quotas (priceAlerts, webhookAlerts, paperAccounts, holdingsPerAccount, barReplay)
└── data/
    └── accounts/
        ├── plans.json          # Static plan catalog
        ├── users.json          # User accounts store (webhookTokenHash, webhookTokenHint)
        └── states/             # Per-user cloud state JSON mirrors
tests/
├── qa_cycle_alerts.cjs         # 11 alert conditions test, channel UI, and alert creation
├── test_replay_and_scales.cjs  # Bar replay toggle, buy order execution, stepping, close, exit
├── test-replay-interaction.js  # Vela orchestrator bar slicing, stepping forward with applyBar, and series restore
├── qa_cycleB.cjs               # Paper trading order flow (B01), alerts create (B02), mobile quick-trade (Bm03)
├── qa_prod_cycle1.cjs          # Webhook gating on Basic plan, webhook rotation, and execution
└── rigorous_full_dogfood_cycle13.cjs # Quick-trade steppers, 1-click execution, minimized toggle, replay bar
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle II / X (Retrofit) | Feature was developed and iterated before adopting Hybrid SDD. | Halting production or deleting tested code to write specs first would cause regression; retrofit preserves working software while establishing full governance. |
| Principle III (Matrix Coverage) | Existing automated tests focus on high-risk functional flows and specific viewports. | Manual full matrix testing is time-intensive; complete Puppeteer matrix suites are scheduled for the Converge phase. |
| Principle IV (Bilingual Micro-Gaps) | Minor untranslated strings (alert toast, pending order row numbers, replay speed labels, quick trade titles) do not block core trading actions. | Immediate code changes violate the "no product code edits" retrofit rule; gaps are formally catalogued for Converge resolution. |
| Principle V (Mobile Overlay Pinned Badges) | Canvas alert lines and pinned badges require screen real estate and touch accuracy difficult to fit on 390px screens. | Displaying overlapping canvas badges on mobile obstructs the candlestick chart; overlay is hidden via CSS on mobile while list management remains accessible in the alerts dock. |
| Principle VII (Client-Only Quota Enforcement) | `holdingsPerAccount` and `barReplayMinuteDays` were implemented as client-side UI constraints without corresponding server validation logic. | Changing `server/accounts.js` or `/api/candles` alters the backend contract; gaps are documented in `research.md` for backend hardening. |