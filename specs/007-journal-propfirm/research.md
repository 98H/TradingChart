# Research: Trade Journal and Prop-Firm Tools

History: `git log --format='%h %ad %s' --date=short -- client/src/tradeJournal.js client/src/tradeJournalModal.js client/src/propFirmSimulator.js client/src/journal/journalStore.js client/src/journal/journalCharts.js client/src/journal/propFirmTracker.js client/src/journal/playbookManager.js client/src/journal/dailyJournal.js client/src/journal/aiCoach.js client/src/journal/statementImporter.js`
— `ecdb389` (2026-09-17, Initial release of TradingChart with paper trading & alerts foundations), `267f359` (2026-09-18, Zero-defect architectural elevation across desktop, mobile, and RTL surfaces), `e09b27a` (2026-09-18, TradingView-grade Multi-Chart Layout Studio, user profile modal, log trade modal), `707d863` (2026-09-18, Achieve 100% zero-defect parity across Strategy Tester, Prop Firm, Trade Journal), `8f1b98d` (2026-09-19, Sign-correct P&L formatting on trade submission and verified 45m custom timeframe), `fc349fa` (2026-09-19, Comprehensive zero-defect elevation - full persian i18n, mobile panels parity), `a79da66` (2026-09-19, Complete zero-defect fixes for DOM execution, journal fifo resilience), `14f85d6` (2026-09-20, Zero-defect elevation wave-2 — responsive header, FA i18n completion), `1e0c675` (2026-09-20, Final wave evidence — all suites green on frozen build), `c22ef30` (2026-09-27, Topbar responsive overflow, username blocklist regex, interval teardown), `7544e50` (2026-10-12, Real-browser zero-defect cycle: honest data, replay isolation, layout/app sync, resource-aware polling), `a94a611` (2026-10-22, Chartivia: production hardening + rebrand + TradingView-style routing).

---

## R1. Tri-surface journal workspace architecture (Full-Page, Bottom Panel, Side Dock)

- **Decision**: Deliver the Trade Journal across three distinct UI surfaces:
  1. A primary full-page workspace (`#journal-workspace-view`) accessible via topbar navigation pill `#nav-btn-journal`, hiding `#chart-area` completely and presenting the 8-suite tabs and filter ribbon.
  2. A secondary expandable bottom-panel tab (`#view-journal` via `.panel-tab[data-view="journal"]`).
  3. A side-dock drawer panel (`mountTradeJournal`) in the Vela right-rail dock, triggered via command palette (`Ctrl+K` -> "Open Trade Journal").
- **Rationale**: Professional traders require differing viewports based on workflow. During post-market deep review, traders want a distraction-free, full-page spreadsheet and analytics dashboard. During live charting and scalping, traders want an adjacent side dock or bottom drawer to quickly log executions without navigating away from the active chart. Supporting all three surfaces matches institutional workflow requirements.
- **Alternatives considered**:
  - Full-page workspace only (rejected: disrupts live charting workflow when traders just need a quick ledger glance).
  - Modal or side dock only (rejected: too cramped for multi-axis Edge radar, 24-hour heatmaps, and 14-broker reconciliation tables).
- **Evidence**: `client/src/main.js:311-316, 366-375, 480-487, 780-815`, `client/chart/index.html:150-160, 240-250`.

## R2. Reactive store architecture (`JournalStore`) with decoupled mathematical core

- **Decision**: Encapsulate all journal state, persistence, and event notifications inside a single reactive store (`JournalStore` in `client/src/journal/journalStore.js`), which delegates analytical mathematics (FIFO pairing, Edge Score v2 composite, drawdowns, time attribution, rule adherence) to `@luxalgo/journal-core`. UI components subscribe via `store.subscribe(listener)`.
- **Rationale**: Isolating mathematical computations from DOM rendering prevents UI lockups and ensures 100% calculation determinism. The reactive listener pattern ensures that when a trade is logged from the modal or imported via CSV, the dashboard KPIs, calendar heatmap, equity curve, and ledger update synchronously across all open surfaces.
- **Alternatives considered**:
  - Distributing calculations inside individual view classes (rejected: leads to duplicated, out-of-sync metrics across views).
  - Server-side calculation engine via REST endpoints (rejected: introduces network latency, violates offline-readiness, and adds unnecessary server overhead).
- **Evidence**: `client/src/journal/journalStore.js:80-120, 420-530`, `client/src/tradeJournal.js:30-40`.

## R3. FIFO execution matching and annotation persistence model

- **Decision**: Store atomic buy/sell executions (`tradingchart_trade_journal`) and dynamically reconstruct completed round trips using First-In-First-Out (`FIFO`) matching via `@luxalgo/journal-core/round-trips.ts`. Qualitative trader annotations (playbook setup, mistakes, tags, notes, ratings, checklist rules) are stored in a separate ID-keyed dictionary (`tradingchart_journal_annotations`) keyed by the unique trade signature (`${accountId}|${symbol}|${direction}|${openTime}`) and merged onto reconstructed round trips on demand.
- **Rationale**: Financial accounting standards mandate deterministic execution matching (FIFO). Coupling annotations directly to raw executions would corrupt ledger integrity when partial fills close across multiple orders. An independent annotation store preserves trader commentary across re-aggregations.
- **Alternatives considered**:
  - Storing only pre-matched round trips (rejected: prevents multi-fill partial closures, scale-ins, and scale-outs).
  - Storing annotations inside execution objects (rejected: duplicates text across open/close executions and corrupts FIFO matching).
- **Evidence**: `client/src/journal/journalStore.js:33-40, 375-395, 435-465`.

## R4. Universal multi-broker statement auto-detection and preview engine (14 formats)

- **Decision**: In `StatementImporter`, accept statements via drag-and-drop file upload, native file picker (`.csv`, `.txt`, `.html`, `.htm`), or raw pasted text. Auto-detect the broker format via `detectFormat(content)` across 14 supported platform profiles (TradingView, MT4 HTML, MT5 Deals CSV, NinjaTrader, ThinkorSwim, IBKR Flex & Activity, TopstepX, Tradovate, Webull, DAS Trader, TradeZella, Tradervue). Show a 15-row preview reconciliation table before committing, and filter duplicate executions using cryptographic-like 5-tuple signatures (`symbol|side|price|quantity|executedAt`).
- **Rationale**: Traders frequently migrate between brokers and prop firms. Manually configuring column mappings is the #1 friction point in trade journaling. Pre-flight preview ensures user trust before executions enter the ledger, and signature deduplication guarantees idempotent imports.
- **Alternatives considered**:
  - Manual column mapping wizard (rejected: high user friction, frequent user mapping errors).
  - Auto-commit without preview (rejected: user cannot verify detected broker or trade count before data enters store).
- **Evidence**: `client/src/journal/statementImporter.js:45-115, 195-260`, `client/src/journal/journalStore.js:305-345, 535-560`.

## R5. Parametric Monte Carlo challenge simulator (500 paths) with strategy tester export bridge

- **Decision**: In `PropFirmSimulator`, execute a 500-path parametric Monte Carlo simulation using `@luxalgo/prop-firm-sim-core` against documented prop-firm evaluation rules (FTMO $100k 2-phase, FTMO $200k 2-phase, Topstep $50k Futures combine). Render 35 sample equity trajectory polylines in SVG alongside key probability metrics (pass probability, risk of ruin, expected value, median days to funded). Provide a direct 1-click bridge ("Export to Prop-Sim →") from the Strategy Tester (`StrategyTester.onExportToPropSim`) that pre-fills win rate, average win R, and trades per day directly from backtest results.
- **Rationale**: Prop firm traders must evaluate whether a quantitative strategy has a statistical edge before paying evaluation fees. Simulating 500 stochastic paths in under 200 ms provides instant quantitative clarity on ruin risk and time-to-payout.
- **Alternatives considered**:
  - Static formulaic expectancy calculation (rejected: fails to capture path-dependent max drawdown and daily loss breach probabilities).
  - Heavy 10,000-path simulation in Web Worker (rejected: 500 paths provides 98%+ statistical confidence in under 200 ms without threading overhead).
- **Evidence**: `client/src/propFirmSimulator.js:10-48, 115-200`, `client/src/strategyTester.js:298-306`.

## R6. Client-side privacy mode masking monetary assets across all visual surfaces

- **Decision**: Implement a global privacy toggle (`#btn-journal-privacy`) that instantly masks all dollar values as `$***.**` or `***` across KPI cards, monthly calendar tiles, equity curve Y-axes, trade ledger rows, scatter plot tooltips, and prop challenge cards. Persist the toggle state in `localStorage.tradingchart_journal_settings`.
- **Rationale**: Modern traders frequently share screenshots, live-stream charts, or review trades in public environments (cafes, coworking spaces). Privacy mode allows sharing trade setups, execution quality, and win rates without exposing personal capital or account balances.
- **Alternatives considered**:
  - Blurring elements with CSS `filter: blur()` (rejected: easily bypassed in DOM inspector and causes GPU rendering blurriness).
  - Masking only top-level account balance (rejected: leaks financial size via individual trade P&Ls and axis scales).
- **Evidence**: `client/src/tradeJournal.js:75-85, 135-140, 508-512`, `client/src/journal/journalCharts.js:160-165, 275-280`.

## R7. Web Speech API voice dictation for trade logging and daily reflections

- **Decision**: Integrate native Web Speech API (`window.SpeechRecognition` or `window.webkitSpeechRecognition`) into both `TradeJournalModal` (`#btn-modal-voice-dictate`) and `DailyJournal` (`#btn-voice-dictate`). Automatically select `fa-IR` when interface is in Persian, or `en-US` when in English. Transcribe speech continuously and append recognized text directly into notes textareas. If unsupported by the browser, alert the user cleanly.
- **Rationale**: Typing long reflective notes immediately after an emotional trading session is tedious. Speaking aloud allows traders to capture psychology, discipline lapses, and nuanced market context in seconds.
- **Alternatives considered**:
  - Server-side Whisper API integration (rejected: requires server token consumption, network uploads of audio blobs, and violates zero-dependency client privacy).
  - Text-only input (rejected: creates cognitive friction for thorough daily journaling).
- **Evidence**: `client/src/tradeJournalModal.js:285-330`, `client/src/journal/dailyJournal.js:185-230`.

## R8. Grounded AI reflection coach with contextual query chips

- **Decision**: Provide an AI reflection coach (`AiCoach` in `client/src/journal/aiCoach.js`) with pre-configured suggestion chips and a free-text question input. Ground all answers strictly in the user's actual round-trip executions and `@luxalgo/journal-core` aggregates (mistake attribution, weekday P&L, long vs short performance, win rate, and realized R-multiples), prepending response cards to `#ai-chat-thread`.
- **Rationale**: Novice traders often do not know what questions to ask their trade data. Offering clickable prompts ("What is my most expensive mistake?", "Which weekday and market session give me highest expectancy?") extracts actionable takeaways from their trading history.
- **Alternatives considered**:
  - External LLM API calls with full journal export (rejected: exposes private financial trades to external APIs and fails when offline).
  - Static help text (rejected: lacks personalized attribution based on trader's real records).
- **Evidence**: `client/src/journal/aiCoach.js:20-50, 140-194`.

## R9. Dual execution manual logging with real-time risk-reward (R) calculations

- **Decision**: When the user logs a trade in `TradeJournalModal`, the dialog pre-fills the active chart symbol, current market price, BUY side, 0.5 quantity, stop-loss 1% below, and target 1.5% above. On every numeric input or direction toggle, compute live P&L and $R$-multiple (`rewardPerUnit / riskPerUnit`), shifting preview background green/red and coloring $R$ (green if $\ge 2.0$, cyan if $\ge 1.0$, yellow if $< 1.0$). On save, create two atomic executions: an open execution (`exec-open-<ts>`) and a close execution (`exec-close-<ts>`), attaching annotations to the round-trip key.
- **Rationale**: A closed trade is fundamentally two executions. Creating both allows the standard FIFO matching engine to pair them seamlessly while preserving fee and timestamp fidelity. Live $R$-multiple feedback reinforces sound risk management before the trade is committed.
- **Alternatives considered**:
  - Single "Trade" record entity (rejected: incompatible with FIFO engine and broker imports where orders enter as discrete executions).
  - Static form without live $R$-multiple calculation (rejected: fails to guide trader on risk/reward quality).
- **Evidence**: `client/src/tradeJournalModal.js:50-120, 240-280, 360-410`.

## R10. Prop-firm challenge lifecycle tracking with drawdown buffer warning threshold

- **Decision**: In `PropFirmTracker`, track challenge evaluations across their full lifecycle (firm name, account size, phase, status, evaluation fees, reset fees, payouts). Calculate the drawdown buffer (`currentBalance - (initialBalance - maxLossLimit)`) and apply an amber/red warning alert when remaining buffer falls below 25% of the max loss limit.
- **Rationale**: The primary reason traders fail prop challenges is unmonitored drawdown near the daily or maximum loss limit. Providing a visual buffer alert protects challenge capital before a rule breach occurs.
- **Alternatives considered**:
  - Simple balance tracking without drawdown buffer (rejected: forces traders to calculate breach proximity manually).
  - Hard breach enforcement that locks trading (rejected: the journal is an analytics tool, not an execution broker gate).
- **Evidence**: `client/src/journal/propFirmTracker.js:65-125`.

## R11. Cloud state synchronization and multi-tab memory unioning

- **Decision**: Synchronize the primary executions store (`tradingchart_trade_journal`) to the backend under `/api/user/state` (`state.tradeJournal`). In `AuthManager.applyCloudState` and `handleConflict`, perform an ID-keyed union between in-memory executions (`sampleExecutions`) and incoming cloud executions so offline additions are never overwritten by remote updates.
- **Rationale**: Traders operate across desktop and mobile devices. Without ID-keyed unioning, logging a trade on mobile while a desktop tab is open would result in the desktop overwriting the newly logged trade during the next cloud push.
- **Alternatives considered**:
  - Last-write-wins replacement (rejected: drops trades logged on other devices).
  - Dedicated multi-tenant SQL database (rejected: violates zero-dependency atomic JSON server architecture).
- **Evidence**: `client/src/authManager.js:51, 274, 345-351`, `server/accounts.js:460-500`.

---

## Spec/code mismatches

- **FR-011**: Hardcoded Tuesday best trading day KPI card `Tuesday (+ $2,840)` / `سه‌شنبه (+ $2,840)` displayed statically regardless of actual trade executions, in `client/src/tradeJournal.js:255`.
- **FR-011**: Hardcoded monthly calendar heatmap title `P&L Calendar Heatmap (September 2026)` / `تقویم حرارتی سود/زیان (سپتامبر ۲۰۲۶)` displayed statically regardless of current date, in `client/src/tradeJournal.js:264`.
- **FR-011**: Synthetic equity curve fallback points array `+$3,930` rendered when `curveData` is empty instead of an honest empty state, in `client/src/journal/journalCharts.js:121-128`.
- **FR-015**: Hardcoded adherence KPI header P&L values `+$4,280` (`P&L Following Rules`) and `-$890` (`Discipline Leaks`) displayed statically regardless of evaluated checklist data, in `client/src/journal/playbookManager.js:39,43`.
- **FR-016**: Hardcoded fallback constants in AI Coach answers (`score || 88`, `pf || '3.42'`, `wr || '84.2'`, and static text regarding Tuesday +$2,840 and London session) when metrics are undefined or sparse, in `client/src/journal/aiCoach.js:129,174,185`.
- **FR-006**: Hardcoded execution fee `$1.5` and hardcoded 1-hour trade duration (`new Date(now.getTime() - 3600000)`) for manual trade entries, in `client/src/tradeJournalModal.js:368,381`.
- **FR-020**: Inconsistent plan entitlement gating: `main.js:304,311,366` mounts bottom panel `#view-propsim`, bottom panel `#view-journal`, and full-page `#journal-workspace-view` without checking `auth.feature('propFirmSim')` or `auth.feature('tradeJournal')`; gating is only checked on side-dock mounts (`main.js:471,481`) and in the modal (`tradeJournalModal.js:30`).
- **FR-008**: Paper trading direct store mutation: `paperTrading.js:703,732-736` directly manipulates `tradeJournal.sampleExecutions` array unshifting executions instead of calling `store.addExecutions()`, bypassing signature deduplication.
- **FR-021**: Partial cloud state synchronization: `authManager.js:35,51` only maps `trade_journal: 'tradeJournal'`, leaving accounts (`tradingchart_journal_accounts`), prop challenges (`tradingchart_prop_firms`), playbooks (`tradingchart_journal_playbooks`), daily notes (`tradingchart_journal_notes`), annotations (`tradingchart_journal_annotations`), and settings (`tradingchart_journal_settings`) local-only.
- **FR-007**: Blocking browser alerts: `tradeJournalModal.js:300` and `dailyJournal.js:204` use native `alert()` when speech recognition is unavailable, instead of non-blocking toast notifications.
- **FR-017 & FR-015**: Blocking browser prompts: `propFirmTracker.js:130,132` and `playbookManager.js:111,113` use blocking `prompt()` for new challenges and setups instead of accessible form modals.
- **FR-021**: Missing server-side array limits: `server/accounts.js:512-515` (`STATE_LIMITS`) does not validate or cap `tradeJournal` execution count or size during cloud state sync, relying only on global 2MB `STATE_MAX_BYTES` buffer check.
