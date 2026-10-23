# Feature Specification: Indicators Library, Pine Editor and Strategy Tester

**Feature Branch**: `004-indicators-pine-strategy` (retrofit; originally delivered in commits ecdb389, 267f359, b1565ab, c724bb4, 707d863, 7544e50, c22ef30)

**Created**: 2026-09-17

**Status**: Implemented (retrofit spec, 2026-10-22)

**Input**: Founder intent (reconstructed): "Give traders a TradingView-style indicator library, a Pine Script editor that runs their own scripts in the browser, and a strategy tester whose numbers come from really running their strategy on the chart's bars — never invented."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and add a library indicator (Priority: P1)

A trader opens the indicators dialog from the top bar or the mobile bottom menu, searches or filters by
category, and adds an indicator to the active chart with one click. The dialog shows each indicator's
name, category badge and description in the active language.

**Why this priority**: Indicators are the most-used analysis tool; without them the chart is a price viewer.

**Independent Test**: Open the dialog, confirm all 114 entries are listed, filter to each category, search
"ADX" and "Order Blocks", add both, and confirm each row reports "Added" only when the chart accepted it.

**Acceptance Scenarios**:

1. **Given** the chart is loaded, **When** the user opens the indicators dialog, **Then** it lists all 114 library entries with a count label "Showing 114 of 114 indicators" and the search box is focused and empty.
2. **Given** the dialog is open, **When** the user selects a category (Smart Money, Trend, Oscillators, Volatility, Volume), **Then** only entries of that category are listed and the count label updates.
3. **Given** the dialog is open, **When** the user types a query, **Then** entries match by English name, English description, identifier, category, or (in Persian) Persian name/description, and a clear button appears.
4. **Given** no entry matches, **When** the list is rendered, **Then** a "No matching indicators found" message is shown.
5. **Given** the user is under the plan's indicators-per-chart quota, **When** they click a row or "+ Add", **Then** the indicator is plotted, a success toast appears, the button shows "✓ Added" for 1.5 s and the layout is scheduled for persistence.
6. **Given** the active chart already holds the plan's maximum number of indicators, **When** the user adds another, **Then** nothing is plotted, an upgrade toast names the next plan with that capacity, and the button shows "✕ Not added".
7. **Given** the interface is Persian, **When** the dialog renders, **Then** it is right-to-left, uses Persian names, descriptions, category badges and Persian digits (e.g. "۱۱۴").

---

### User Story 2 - Write, validate and plot a Pine script (Priority: P1)

A trader opens the Pine editor (bottom dock on desktop, side panel elsewhere), starts from a template
or a blank script, edits it with line numbers, and adds it to the chart. Syntax errors are shown in a
diagnostics console instead of breaking the chart. The script can be saved locally.

**Why this priority**: Custom scripting is the differentiator over plain chart viewers and the input to Story 3.

**Independent Test**: Load the "Supertrend Multi-ATR" template, click "Add to Chart", confirm the diagnostics
show "Script validated" with type and input count and the indicator appears; then introduce a syntax error
and confirm a "Compilation error" message with the escaped engine message.

**Acceptance Scenarios**:

1. **Given** the editor opens for the first time, **When** no script was saved, **Then** it shows the "Nexus SMC Pro" template; **When** a script was saved, **Then** the saved script is shown instead.
2. **Given** the editor, **When** the user picks one of the 5 templates, **Then** the editor content is replaced and the line gutter updates.
3. **Given** the editor, **When** the user clicks "New", **Then** a minimal SMA indicator skeleton is inserted.
4. **Given** a valid script, **When** the user clicks "Add to Chart", **Then** the diagnostics show "Script validated", the declaration type (indicator/strategy), the number of inputs, and the script is added to the active chart.
5. **Given** a script with a syntax error, **When** the user clicks "Add to Chart", **Then** nothing is added and the diagnostics show the compile error with HTML-escaped text.
6. **Given** any script, **When** the user clicks "Save", **Then** it is stored on the device (and included in the account's cloud state snapshot) and the diagnostics confirm the save.
7. **Given** the user's plan disables the Pine studio, **When** the side panel is opened, **Then** a locked placeholder with "View Plans & Upgrade" is shown instead of the editor.

---

### User Story 3 - Backtest a strategy with the real engine (Priority: P1)

A trader with a `strategy()` script clicks "Backtest Strategy". The exact script is executed by the Pine
engine on the chart's current bars and the Strategy Tester shows metrics, an equity curve and recent
closed trades computed only from the engine's closed trades. Results can be exported as CSV (plan-gated)
or forwarded to the prop-firm simulator.

**Why this priority**: Constitution Principle I — a backtest must run the real engine on real bars; this is the trust core of the product.

**Independent Test**: Select the "Shannon Rebalance Strategy" template, click "Backtest Strategy", and confirm
the tester shows Net Profit, Profit Factor, Win Rate, Max Drawdown, Sharpe/Expectancy and a trades table whose
rows equal the engine's closed trades; change symbol and confirm the report is recomputed.

**Acceptance Scenarios**:

1. **Given** no backtest has run, **When** the tester is shown, **Then** it displays an empty state explaining that results come from running the user's `strategy()` code; no sample report is shown.
2. **Given** an indicator script (no `strategy(` declaration), **When** the user clicks "Backtest Strategy", **Then** the editor warns "This script is an indicator, not a strategy" and no backtest runs.
3. **Given** fewer than 30 bars are loaded, **When** a backtest is requested, **Then** the tester says at least 30 historical bars are needed.
4. **Given** a valid strategy and ≥30 bars, **When** the backtest runs, **Then** a "Running strategy on N bars…" message shows, then the report uses the script's own initial capital (default 100,000 when the script sets none) and the engine's closed trades in exit-time order.
5. **Given** the engine throws, **When** the backtest runs, **Then** "Strategy runtime error" with the escaped message is shown and no metrics are displayed.
6. **Given** the strategy produced zero closed trades, **When** the report renders, **Then** it states the bar count, the number of open trades (if any) and that no closed trades were produced — no zero-filled metric cards.
7. **Given** a metric is undefined (no losses for Profit Factor, <2 trades for Sharpe), **When** it is shown, **Then** it displays "—" (or "∞" for a profit factor with gains and no losses), never a placeholder number.
8. **Given** a report exists, **When** new bars arrive (symbol/timeframe change), **Then** the last backtested script is re-run silently on the new bars; **Given** no script was ever backtested, **Then** nothing is auto-run.
9. **Given** a report and a plan with trades CSV export, **When** the user clicks "Download CSV Ledger", **Then** a CSV with every closed trade (ID, side, ISO entry/exit times, prices, size, P&L $, P&L %) downloads; **Given** a plan without it, **Then** an upgrade toast is shown and no file is produced.
10. **Given** a report, **When** the user clicks "Export to Prop-Sim", **Then** the prop-firm simulator opens with win rate, average win/loss ratio and trades per day from this backtest.
11. **Given** the language is switched, **When** a report is visible, **Then** it is re-rendered in the new language without re-running the engine.

---

### User Story 4 - Tune or remove an applied indicator (Priority: P2)

From an indicator's gear control on the chart, the trader opens a settings dialog, switches between applied
indicators, edits inputs (numbers, price source, colors, booleans) and style (colors, line width), applies,
or removes the indicator.

**Why this priority**: Defaults rarely fit; tuning is expected but the library is usable without it.

**Independent Test**: Add RSI, open its settings, change the length, apply, and confirm the toast and the
recomputed plot; then remove it and confirm it disappears and the layout persists.

**Acceptance Scenarios**:

1. **Given** no indicator is on the chart, **When** settings are requested, **Then** a "No active indicators on chart" toast is shown and no dialog opens.
2. **Given** indicators are applied, **When** the dialog opens, **Then** the requested indicator (or the first custom one) is selected and a dropdown lists all applied indicators.
3. **Given** the indicator exposes live inputs, **When** the Inputs tab renders, **Then** each input gets a control matching its type: number, price-source select, color picker, checkbox or text.
4. **Given** the indicator exposes no inputs, **When** the Inputs tab renders, **Then** generic Length, Multiplier and Price Source controls are shown, pre-filled from the script where detectable.
5. **Given** edits, **When** the user clicks "Apply & Save", **Then** inputs and style are applied, the layout is scheduled for persistence and a confirmation toast is shown.
6. **Given** the dialog, **When** the user clicks "Remove from Chart", **Then** the indicator is removed, the layout is persisted and a "Indicator removed" toast is shown.

---

### User Story 5 - Glance at a symbol's technical rating (Priority: P3)

Below the watchlist, a card shows the selected symbol's last price, 24 h change, day range position and a
Buy/Sell gauge with a summary, oscillator and moving-average breakdown.

**Why this priority**: Convenience summary; all decision data is available elsewhere.

**Independent Test**: Select a symbol in the watchlist and confirm the card's price and change match the
ticker feed and the badge matches the screener's rating for that symbol.

**Acceptance Scenarios**:

1. **Given** a watchlist symbol is selected, **When** the card loads, **Then** it fetches the symbol's 24 h ticker and screener row and shows price, change, day range and the rating badge (Strong Buy / Buy / Neutral / Sell / Strong Sell, localized in Persian).
2. **Given** the user selects another symbol, **When** the card updates, **Then** it refetches for the new symbol.

---

### Edge Cases

- Double-clicking "+ Add" within 1.5 s adds the indicator only once (busy guard).
- A library entry marked as a native engine indicator falls back to its Pine script if the native add fails.
- `color.cyan` (unsupported by the engine) is rewritten to an RGB value before validation, plotting and backtesting.
- A backtest requested while one is running for new candles is not re-triggered (running flag).
- Closed trades without a finite exit price or with zero size are excluded from the report.
- Trades table shows the 8 most recent trades; the CSV always contains all of them.
- Equity curve is anchored at initial capital with a dashed baseline and min/max labels; it is drawn left-to-right even in Persian.
- Engine error text and compile errors are HTML-escaped before display.
- Technical rating card with missing ticker/screener data falls back to constants — see FR-024 and the open gap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST ship a library of 114 indicators, each with a unique id, English name, category (smc, trend, oscillators, volatility, volume), description and a Pine v5 script that the engine validates without error.
- **FR-002**: Every library indicator MUST have a Persian name and description; Persian mode MUST display them.
- **FR-003**: The indicators dialog MUST support free-text search (name, description, id, category, Persian text) combined with a category filter, and MUST show a live "showing X of Y" count.
- **FR-004**: Adding an indicator MUST be blocked, with an upgrade message, when the active chart already holds the plan's indicators-per-chart quota.
- **FR-005**: The add control MUST report success only when the chart actually accepted the indicator, and failure otherwise.
- **FR-006**: Entries flagged as native engine indicators MUST be added through the native path first and fall back to their Pine script on failure.
- **FR-007**: The Pine editor MUST offer 5 templates (4 indicators, 1 strategy), a "New" skeleton, line numbers synchronized with scrolling, and left-to-right code editing in both languages.
- **FR-008**: The Pine editor MUST validate a script before adding it and MUST show the declaration type and input count on success or the escaped compiler message on failure.
- **FR-009**: The Pine editor MUST persist the script on the device on "Save" and restore it on next open.
- **FR-010**: Backtesting MUST execute the exact user script with the Pine engine on the chart's currently loaded bars; the system MUST NOT generate or display any backtest result that did not come from that execution.
- **FR-011**: Backtesting MUST refuse scripts without a `strategy(` declaration and MUST require at least 30 bars.
- **FR-012**: The report MUST derive net profit, net %, gross profit/loss, profit factor, win rate, max drawdown ($ and %), per-trade Sharpe and Sortino, expectancy, average win/loss ratio and trades per day solely from the engine's closed trades and the script's initial capital.
- **FR-013**: Undefined metrics MUST be shown as "—" (profit factor with no losses and positive gross profit as "∞"); placeholder values MUST NOT be shown.
- **FR-014**: When new bars are applied, the tester MUST silently re-run only the last strategy the user backtested, and MUST NOT auto-run any strategy otherwise.
- **FR-015**: Runtime errors, missing strategy state, and zero-closed-trade runs MUST each produce a distinct explanatory message instead of a report.
- **FR-016**: The trades CSV export MUST include every closed trade and MUST be gated by the trades-CSV-export entitlement.
- **FR-017**: The report MUST offer forwarding win rate, average win/loss ratio and trades per day to the prop-firm simulator.
- **FR-018**: The Pine studio and Strategy Tester side panels MUST show a locked upgrade placeholder when the plan disables them.
- **FR-019**: Switching language MUST re-render the indicators dialog, the Pine editor and the strategy report in place without reload or re-execution.
- **FR-020**: The indicator settings dialog MUST list all applied indicators of the active chart, render typed input controls from live inputs (with generic fallbacks), apply style (two colors, line width 1–4 px) and support removal.
- **FR-021**: Applying settings or removing an indicator MUST schedule layout persistence.
- **FR-022**: The side dock MUST register the Pine editor, Indicator Templates and Strategy Tester panels (among the app's other panels) with stable ids `pine`, `templates`, `strategy`.
- **FR-023**: The content security policy MUST allow runtime script compilation (required by the engine) while still forbidding inline scripts.
- **FR-024**: The technical rating card MUST show the selected symbol's price, change, day range and rating from the ticker and screener feeds. [NEEDS CLARIFICATION: the card currently invents a 52-week range (day high ×1.35 / low ×0.65), fixed oscillator/MA vote counts, a "BINANCE · Perpetual" label for every symbol, and fallback price/RSI/rating constants — should these be removed, labelled as estimates, or replaced with real 52-week and per-indicator data?]

### Key Entities

- **Library Indicator**: catalogue entry — id, name, category, description, Pine script, optional native engine name.
- **Persian Indicator Text**: per-id Persian name and description.
- **Pine Template**: named starter script (key, name, description, code).
- **Saved Pine Script**: the user's last saved editor content on this device.
- **Applied Indicator**: an indicator instance on the active chart with title, source, live inputs and style props.
- **Backtest Result**: computed metrics plus the list of closed trades (id, side, entry/exit time and price, quantity, profit $, profit %, running equity, bars held).
- **Prop-Sim Profile**: win rate (0–1), average win/loss ratio, trades per day.
- **Technical Rating**: per-symbol rating, RSI-14, trend from the screener feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 114 library scripts validate with the Pine engine (currently 114/114).
- **SC-002**: 100% of library ids have Persian text (currently 114/114, no orphans).
- **SC-003**: For a given script and bar set, every figure in the strategy report is reproducible from the engine's closed-trade list; zero figures come from constants.
- **SC-004**: A user can go from opening the indicators dialog to a plotted indicator in 2 interactions (open, click row).
- **SC-005**: A user can go from a strategy template to a full backtest report in 2 interactions (pick template, Backtest Strategy).
- **SC-006**: Every indicator, editor and tester surface renders in both EN and FA, desktop and mobile, with no untranslated user-facing labels (see open gaps for current exceptions).

## Assumptions

- The Pine engine runs entirely in the user's browser; no script or result is sent to the server.
- Backtests use only bars already loaded for the chart (up to 2,000 per load); deeper history ("deep backtest") is out of scope for this feature.
- Fills, sizing and commission semantics are those of the Pine engine; the product does not re-simulate fills.
- Plan entitlements (indicators per chart, Pine studio, Strategy Tester, trades CSV export) come from the shared plan catalogue (feature 00x accounts/plans).
- Sharpe and Sortino are per-trade, not annualised, and are labelled as such.
