# Feature Specification: Trade Journal and Prop-Firm Tools

**Feature Branch**: `007-journal-propfirm` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Give traders an institutional trade journal that fills itself from paper, replay and broker statements, shows honest performance analytics, keeps daily reflections and playbooks, and a prop-firm toolkit to track challenges and simulate pass odds from their real statistics."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Journal workspace and dashboard (Priority: P1)

A trader switches from the chart to the full-page journal, filters by account and time window, and sees KPIs, a P&L calendar and an equity curve; privacy mode masks money values.

**Why this priority**: The journal is where practice turns into measurable improvement.

**Independent Test**: Click Journal, change the account filter, toggle privacy, and confirm KPIs re-compute and money values are masked.

**Acceptance Scenarios**:

1. **Given** the chart, **When** the user clicks Journal, **Then** the chart area hides and the journal shows the filter ribbon, 8 suite tabs (dashboard, analytics, trades, daily, prop, playbooks, AI coach, importer) and the dashboard; Quant returns to the chart.
2. **Given** the dashboard, **When** the user changes the account or time filter, **Then** KPIs, calendar, equity curve and ledger reflect only matching trades.
3. **Given** privacy mode on, **Then** every money value in KPIs, calendar, curve, ledger and tooltips is masked; off unmasks them.
4. **Given** a calendar day, **When** the user clicks it, **Then** the trades ledger opens.

---

### User Story 2 - Log and import trades (Priority: P1)

A trader logs a trade manually with live P&L and R-multiple preview and optional voice-dictated notes, or imports a broker statement (file drop, file pick or pasted text) whose format is auto-detected, previews it and commits it to an account. Paper and replay trades arrive automatically.

**Independent Test**: Log a long trade and see it in the ledger; paste a TradingView CSV, preview, commit, and see the success count.

**Acceptance Scenarios**:

1. **Given** "+ Log Trade", **Then** a dialog opens prefilled with the current symbol and price, BUY side, quantity 0.5, stop 1% below and target 1.5% above entry, with P&L and "R: 1 : X.XX" previews that update on every input.
2. **Given** the dialog, **When** the user saves, **Then** an open and a close execution are added with playbook, mistakes, notes and stop annotations, a toast confirms and the views refresh.
3. **Given** a supported statement, **When** it is dropped, picked or pasted and parsed, **Then** the detected format, the execution count and a preview of up to 15 rows are shown; **When** committed, **Then** only non-duplicate executions are added to the chosen account and a success banner shows the count.
4. **Given** an unrecognised file, **Then** "Unrecognized Format" and an error message are shown and nothing is added.
5. **Given** voice dictation on a browser without speech recognition, **Then** the user is told it is unsupported.

---

### User Story 3 - Analytics (Priority: P2)

A trader reviews an Edge Score radar, a 24-hour session heatmap and a duration-vs-P&L scatter computed from their closed trades, with honest empty states when there is not enough data.

**Acceptance Scenarios**:

1. **Given** enough closed trades, **Then** a 6-axis Edge Score radar (win rate, profit factor, avg win/loss, drawdown, recovery, consistency) with a 0-100 composite is drawn.
2. **Given** too few closed trades, **Then** the radar shows the empty-state message asking to log or import trades, and the scatter shows "No closed trades to plot in scatter explorer.".
3. **Given** closed trades, **Then** the hourly heatmap colours each UTC hour by net P&L with Tokyo, London and New York session bands.

---

### User Story 4 - Ledger, daily journal, playbooks and AI coach (Priority: P2)

A trader opens a trade from the ledger on the chart, writes a daily reflection with an emotion and dictation, defines playbook setups with rule checklists, and asks the AI coach questions answered from their own trades.

**Acceptance Scenarios**:

1. **Given** a ledger trade, **When** the user clicks "View on Chart", **Then** the chart workspace opens on that symbol.
2. **Given** the daily journal, **When** the user steps dates, picks one of 5 emotions and saves, **Then** the note and emotion persist for that date and "Saved ✓" shows; unsaved edits show "Unsaved changes…".
3. **Given** "+ New Playbook Setup", **Then** a setup with name and rules is added and listed with adherence metrics.
4. **Given** a question chip or typed query, **Then** an answer card is prepended to the coach thread.

---

### User Story 5 - Prop-firm tracker and simulator (Priority: P2)

A trader tracks prop challenges (balance, profit progress, drawdown buffer) and runs a 500-path Monte Carlo simulation of a challenge preset with their win rate, R:R, risk and trades per day — or with statistics exported from the Strategy Tester.

**Acceptance Scenarios**:

1. **Given** "+ Add Prop Challenge", **When** firm and size are given, **Then** a Phase 1 challenge (10% target, 10% max loss, 5% daily loss) is added with progress and drawdown buffer.
2. **Given** the simulator, **When** the user changes the preset (FTMO 100k, FTMO 200k, Topstep 50k) or clicks Run, **Then** 500 paths are simulated and pass probability, risk of ruin, EV and median days to funded update with 35 sample paths drawn.
3. **Given** a backtest report, **When** the user clicks "Export to Prop-Sim", **Then** the simulator opens with that strategy's win rate, average win R and trades per day and re-runs.
4. **Given** a plan without `propFirmSim` or `tradeJournal`, **Then** the side-dock panel shows the locked placeholder with an upgrade button.

---

### Edge Cases

- No executions stored on first use → a set of seed trades is generated so the journal is not empty (see Assumptions).
- CSV export → `tradingchart_journal_export_YYYY-MM-DD.csv` with the documented header, one row per round trip.
- Cloud state above 2 MB → the server rejects the sync with `413 state_too_large`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Journal navigation MUST switch between the chart area and a full-page journal workspace; the journal MUST also be available as a bottom-panel tab and a side-dock panel.
- **FR-002**: The journal MUST provide 8 suites: dashboard, analytics, trades, daily, prop, playbooks, AI coach and importer, switchable by tabs.
- **FR-003**: Account (`all` and stored accounts) and time-window (all, this month, 30 d, 7 d) filters MUST restrict every KPI, chart and ledger to matching executions.
- **FR-004**: Privacy mode MUST mask all money values in KPIs, calendar, equity curve, ledger and tooltips, and persist in journal settings.
- **FR-005**: Executions MUST be matched into round trips with FIFO accounting.
- **FR-006**: The log-trade dialog MUST prefill symbol, current price, BUY side, quantity 0.5, stop 1% below and target 1.5% above entry, show live P&L and R-multiple previews, and on save add an open and a close execution with annotations (playbook, tags, mistakes, notes, stop) and confirm with a toast.
- **FR-007**: Voice dictation in the log dialog and daily journal MUST use the browser's speech recognition in `fa-IR` or `en-US` per language, append text to the notes, and tell the user when unsupported.
- **FR-008**: Closed paper-trading positions and bar-replay positions MUST be added to the journal automatically (source paper / replay).
- **FR-009**: The importer MUST accept dropped, picked (`.csv`, `.txt`, `.html`, `.htm`) and pasted statements, auto-detect the broker format, preview up to 15 rows with format and count badges, report unrecognised input, and commit only non-duplicate executions to the selected account with a success count.
- **FR-010**: CSV export MUST download `tradingchart_journal_export_YYYY-MM-DD.csv` with header `TradeKey,AccountId,Symbol,Direction,Status,OpenedAt,ClosedAt,Quantity,AvgEntry,AvgExit,GrossPnl,Fees,NetPnl,DurationMinutes,Playbook,Tags,Mistakes,Notes`.
- **FR-011**: The dashboard MUST show KPI cards, a monthly P&L calendar (day click opens the ledger) and the equity curve of the filtered trades.
- **FR-012**: Analytics MUST render the 6-axis Edge Score radar with a 0-100 composite, the 24-hour UTC P&L heatmap with session bands and the duration-vs-P&L scatter, each with an honest empty state when data is insufficient.
- **FR-013**: Ledger trades MUST offer "View on Chart", switching to the chart workspace on that symbol.
- **FR-014**: The daily journal MUST support date navigation (prev, next, today, picker), day statistics (trades, net P&L, win rate), one of 5 emotions, and saving the note per date with saved/unsaved indicators.
- **FR-015**: Playbooks MUST list setups with rule checklists and adherence, ship 4 default setups, and allow adding a setup.
- **FR-016**: The AI coach MUST answer chip and typed queries from the user's own round-trip data and prepend the answer to the thread.
- **FR-017**: The prop tracker MUST add challenges (default Phase 1, 10% target, 10% max loss, 5% daily loss) and show balance, profit progress and drawdown buffer per challenge, with a link to the simulator.
- **FR-018**: The prop-firm simulator MUST run 500 Monte Carlo paths for the FTMO 100k, FTMO 200k and Topstep 50k presets from win rate, R:R, risk % and trades/day, showing pass probability, risk of ruin, EV, median days to funded and 35 sample paths; changing the preset MUST re-run it.
- **FR-019**: "Export to Prop-Sim" in the Strategy Tester MUST set the simulator's win rate, average win R and trades/day from the backtest and re-run.
- **FR-020**: The side-dock journal and simulator panels MUST show the locked placeholder with an upgrade button when the plan lacks `tradeJournal` / `propFirmSim`; opening the log dialog MUST be refused with a toast without `tradeJournal`.
- **FR-021**: Journal executions MUST persist on the device and be part of the signed-in user's cloud state (`tradeJournal`), within the 2 MB state limit.
- **FR-022**: All journal and simulator labels MUST be available in English and Persian; on viewports ≤ 768 px the journal MUST be reachable from the panels menu.

### Key Entities

- **Execution**: id, account, symbol, side, quantity, price, fee, time, source, asset class, import metadata.
- **Round Trip**: trade key, account, symbol, direction, status, open/close times, quantity, average entry/exit, gross/net P&L, fees, duration.
- **Journal Account**, **Prop Challenge**, **Playbook**, **Daily Note** (text, emotion, rules completed), **Annotation** (playbook, tags, mistakes, notes, stop, rating), **Journal Settings** (privacy, method, active account, time filter, time zone).
- **Simulation Profile**: win rate, R:R, risk %, trades/day, preset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A manually logged trade appears in the ledger and KPIs immediately after save in 100% of runs.
- **SC-002**: Importing the same statement twice adds zero duplicate executions.
- **SC-003**: With privacy on, zero unmasked money values are visible in the journal.
- **SC-004**: The simulator returns results for 500 paths in under 2 s on a desktop browser.
- **SC-005**: The journal suite reports zero defects on desktop and mobile in both languages.

## Assumptions

- All analytics, imports, simulation and dictation run in the browser; the server only stores the synced `tradeJournal` executions.
- Seed trades on first use exist today as onboarding data; whether they must be labelled as demo is a product decision for the Converge phase.
- **Known violations of the constitution's honest-data principle (Converge, highest priority)**: hard-coded KPI "Tuesday (+ $2,840)", hard-coded adherence P&L (+$4,280 / −$890), AI-coach fallback figures (88, 3.42, 84.2 and static Tuesday/London text), a synthetic equity curve when no data exists, and a fixed $1.5 fee and 1-hour duration for manual entries. Until fixed these are not requirements of the current behaviour.
- Other known gaps for Converge: bottom-panel and full-page journal/simulator not plan-gated, journal accounts/prop/playbooks/notes/annotations/settings not cloud-synced, paper trades bypassing duplicate detection, blocking `prompt()`/`alert()` dialogs, no journal size limit beyond 2 MB.
