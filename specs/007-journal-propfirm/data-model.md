# Data Model: Trade Journal and Prop-Firm Tools

Entities defined by `specs/007-journal-propfirm/spec.md` (Key Entities) and their realization in the codebase. Entities reside across client `localStorage`, server atomic JSON files, and transient runtime memory.

---

## 1. Trade Execution (`Execution`)

An atomic fill or order execution recorded either manually, via broker statement import, or automatically from paper trading and bar replay.

- **Storage**:
  - Client `localStorage`: `tradingchart_trade_journal` (primary JSON array of execution objects).
  - Legacy fallback mirror: `trading_journal_executions` (read if primary is missing, written on save).
  - Server filesystem: `server/data/states/<userId>.json` under cloud state key `tradeJournal` (JSON stringified array).
- **Fields**:
  - `id` (`string`, required): Unique identifier (e.g. `'exec-open-1'`, `'exec-close-1'`, `'exec-1729700000000'`, or `'import-1729700000000-a1b2c'`).
  - `accountId` (`string`, required): Identifier of the journal account this execution belongs to (default `'tradingchart-paper-1'`).
  - `symbol` (`string`, required): Uppercase asset ticker symbol (e.g. `'BTCUSDT'`, `'ETHUSDT'`, `'XAUUSD'`, `'EURUSD'`).
  - `side` (`string`, required): Execution order side (`'buy'` or `'sell'`).
  - `quantity` (`number`, required): Executed volume / contract count (`> 0`).
  - `price` (`number`, required): Executed price per unit (`> 0`).
  - `fee` (`number`, required): Broker commission or trading fee (default `0` or `1.5`).
  - `executedAt` (`string`, required): ISO 8601 UTC timestamp of execution (e.g. `'2026-09-01T10:00:00Z'`).
  - `source` (`string`, optional): Source of trade (`'manual'`, `'import'`, `'paper'`, or `'replay'`).
  - `assetClass` (`string`, optional): Classification of the traded instrument (`'crypto'`, `'forex'`, `'futures'`, `'equities'`, or `'other'`).
  - `importMetadata` (`object`, optional): Metadata attached during statement parsing (e.g. broker order ID, exchange tag).
- **Validation**:
  - `symbol` is converted to uppercase and trimmed: `(exec.symbol || 'BTCUSDT').toUpperCase()`.
  - `side` is normalized to `'buy'` or `'sell'`: `exec.side === 'buy' || exec.side === 'long' ? 'buy' : 'sell'`.
  - `quantity` must be positive: `Math.abs(Number(exec.quantity) || 1)`.
  - `price` must be a valid finite number: `Number(exec.price) || 0`.
  - Deduplication signature: `symbol|side|price|quantity|executedAt`. Duplicate signatures are skipped during imports.
- **Limits**:
  - Maximum client storage is bounded by the browser's 5 MB `localStorage` quota.
  - Server cloud state sync enforces `STATE_MAX_BYTES` (2,097,152 bytes / 2 MB) across the entire user state JSON.
- **Lifecycle**:
  - Seeded automatically on first load with 19 sample trades (38 executions) from September 2026 if store is empty.
  - Created by manual log modal (`TradeJournalModal`), broker import commit (`StatementImporter`), paper trading position close (`PaperTrading`), or bar replay close (`BarReplay`).
  - Synchronized to server cloud state on push when signed in.
  - Deleted individually via `JournalStore.deleteExecution(id)` or cleared by account via `JournalStore.clearExecutions(accountId)`.

---

## 2. Reconstructed Round Trip (`RoundTrip`)

A paired closed or open trade consisting of matched opening and closing executions calculated using FIFO accounting.

- **Storage**:
  - Transient memory only. Reconstructed dynamically by `JournalStore.getRoundTrips()` using `@luxalgo/journal-core/round-trips.ts`.
- **Fields**:
  - `key` (`string`, required): Unique trade signature identifier: `${accountId}|${symbol}|${direction}|${openedAt}`.
  - `accountId` (`string`, required): Journal account identifier.
  - `symbol` (`string`, required): Ticker symbol.
  - `direction` (`string`, required): Position direction (`'long'` or `'short'`).
  - `status` (`string`, required): Lifecycle state (`'closed'` or `'open'`).
  - `openedAt` (`string`, required): ISO 8601 timestamp of first fill in this round trip.
  - `closedAt` (`string | null`, required): ISO 8601 timestamp of final closing fill, or `null` if still open.
  - `quantity` (`number`, required): Total closed volume.
  - `avgEntry` (`number`, required): Weighted average entry price.
  - `avgExit` (`number`, required): Weighted average exit price (`0` if open).
  - `grossPnl` (`number`, required): Gross profit/loss in quote currency before fees.
  - `fees` (`number`, required): Sum of all execution fees for this round trip.
  - `netPnl` (`number`, required): Net profit/loss: `grossPnl - fees`.
  - `durationMs` (`number`, required): Trade holding duration in milliseconds (`closedAt - openedAt`).
  - `executions` (`Execution[]`, required): Array of raw execution records paired into this round trip.
  - `annotations` (`TradeAnnotation`, required): Trader qualitative metadata overlaid from `tradingchart_journal_annotations`.
- **Validation**:
  - Matching logic strictly follows FIFO: earliest opening executions are paired against earliest closing executions.
  - Reversals (e.g. selling 2 contracts while long 1 contract) split the execution into a close for the long position and an open for the new short position.
- **Limits**:
  - Bounded by the number of raw executions loaded into memory.
- **Lifecycle**:
  - Computed on-demand whenever filters, settings, or raw executions change.
  - Filtered by `activeAccount` and `timeFilter` before consumption by views.

---

## 3. Journal Account (`JournalAccount`)

A trading account profile used to isolate trade ledgers, performance statistics, and challenge tracking.

- **Storage**:
  - Client `localStorage`: `tradingchart_journal_accounts` (JSON array).
  - Server filesystem: `server/data/states/<userId>.json` (Note: currently local-only, see mismatches).
- **Fields**:
  - `id` (`string`, required): Unique account identifier (e.g. `'all'`, `'tradingchart-paper-1'`, `'prop-ftmo-100k'`, `'binance-futures-main'`).
  - `name` (`string`, required): English account label (e.g. `'Paper Trading'`, `'FTMO $100K Challenge (Phase 1)'`).
  - `nameFa` (`string`, optional): Persian account label (e.g. `'حساب آزمایشی'`, `'چالش FTMO صد هزار دلاری (مرحله ۱)'`).
  - `currency` (`string`, required): Denomination currency (`'USD'`, `'USDT'`, `'EUR'`).
  - `type` (`string`, required): Account classification: `'aggregate'`, `'paper'`, `'prop'`, or `'live'`.
  - `startingBalance` (`number`, optional): Initial account balance in USD (e.g. `100000`).
  - `target` (`number`, optional): Target profit in USD for prop challenges (e.g. `10000`).
  - `maxLoss` (`number`, optional): Maximum drawdown loss limit in USD (e.g. `10000`).
  - `dailyLoss` (`number`, optional): Maximum daily loss limit in USD (e.g. `5000`).
- **Validation**:
  - Account `id` must be unique.
  - The aggregate account `'all'` cannot be removed or filtered.
  - Default accounts are initialized on first boot via `JournalStore.loadAccounts()`.
- **Limits**:
  - Default store ships with 4 standard accounts.
- **Lifecycle**:
  - Created at startup or dynamically added when creating new prop challenges or paper accounts.
  - Persisted to `localStorage.tradingchart_journal_accounts`.

---

## 4. Prop-Firm Challenge (`PropChallenge`)

A tracked challenge evaluation record monitoring trader balance, profit target progress, drawdown buffer, and evaluation fee cash flows.

- **Storage**:
  - Client `localStorage`: `tradingchart_prop_firms` (JSON array).
- **Fields**:
  - `id` (`string`, required): Unique challenge identifier (e.g. `'ftmo-1'`, `'prop-1729700000000'`).
  - `firmName` (`string`, required): Prop firm organization name (e.g. `'FTMO'`, `'Topstep'`, `'FundedNext'`).
  - `accountId` (`string`, required): Associated journal account ID (e.g. `'prop-ftmo-100k'`).
  - `accountNumber` (`string`, required): Broker login or challenge reference ID (e.g. `'FTMO-98241'`, `'TOPSTEP-49120'`).
  - `initialBalance` (`number`, required): Starting challenge balance in USD (e.g. `50000`, `100000`, `200000`).
  - `currentBalance` (`number`, required): Live balance including realized P&L.
  - `targetProfit` (`number`, required): Dollar profit required to pass the phase (typically 8–10% of initial balance).
  - `maxLossLimit` (`number`, required): Maximum total drawdown limit in USD (typically 10% of initial balance).
  - `dailyLossLimit` (`number`, required): Maximum loss allowed in a single trading day (typically 5% of initial balance).
  - `phase` (`string`, required): Challenge progression phase (`'Phase 1'`, `'Phase 2'`, or `'Funded'`).
  - `status` (`string`, required): Operational status (`'active'`, `'passed'`, `'breached'`, or `'closed'`).
  - `evalFee` (`number`, required): Cost paid to purchase the challenge (e.g. `$540`).
  - `resetFees` (`number`, required): Sum of all account reset fees paid.
  - `payoutsRequested` (`number`, required): Sum of profit withdrawals requested.
  - `payoutsReceived` (`number`, required): Sum of realized profit withdrawals paid out to trader.
  - `startDate` (`string`, required): Date when challenge trading began (`'YYYY-MM-DD'`).
  - `notes` (`string`, optional): Trader notes and challenge rules.
- **Validation**:
  - `initialBalance` and `currentBalance` must be positive numbers.
  - Drawdown buffer is dynamically evaluated: `drawdownBuffer = currentBalance - (initialBalance - maxLossLimit)`.
  - Amber/red warning state is flagged when `drawdownBuffer < (maxLossLimit * 0.25)`.
- **Limits**:
  - No artificial cap on tracked challenges.
- **Lifecycle**:
  - Initialized with default FTMO 100k challenge.
  - New challenges created via `PropFirmTracker` button ("+ Add Prop Challenge").
  - Mutated on payouts, resets, or balance adjustments.

---

## 5. Strategy Playbook Setup (`PlaybookSetup`)

A structured strategy setup containing execution rules used to verify rule adherence and analyze discipline leaks.

- **Storage**:
  - Client `localStorage`: `tradingchart_journal_playbooks` (JSON array).
- **Fields**:
  - `id` (`string`, required): Unique playbook identifier (e.g. `'smc-order-block'`, `'fvg-retest'`, `'break-and-retest'`, `'trend-pullback'`).
  - `name` (`string`, required): English setup name (e.g. `'SMC Order Block & Liquidity Sweep'`).
  - `nameFa` (`string`, optional): Persian setup name (e.g. `'اردربلاک اسمارت مانی و شکار نقدینگی'`).
  - `rules` (`string[]`, required): Array of rule statements required for setup validation.
- **Validation**:
  - Playbook `id` must be a valid kebab-case or alphanumeric string.
  - `rules` must contain at least one rule string.
- **Limits**:
  - Ships with 4 pre-configured institutional setups (SMC Order Block, FVG Retest, Breakout & Retest, EMA Trend Pullback).
- **Lifecycle**:
  - Loaded on store initialization; new setups added via `PlaybookManager` prompt ("+ New Playbook Setup").

---

## 6. Daily Journal Note (`DailyNote`)

A reflective post-market summary capturing trader psychology, emotional state, voice dictations, and daily routine compliance.

- **Storage**:
  - Client `localStorage`: `tradingchart_journal_notes` (JSON dictionary keyed by date `'YYYY-MM-DD'`).
- **Fields**:
  - `text` (`string`, required): Text of daily notes and market analysis.
  - `voiceDictations` (`string[]`, optional): Array of voice-transcribed snippets.
  - `emotion` (`string`, required): Selected psychological state (`'Calm'`, `'Focused'`, `'Anxious'`, `'FOMO'`, or `'Frustrated'`).
  - `rulesCompleted` (`string[]`, optional): List of daily routine checklist items completed.
  - `updatedAt` (`string`, required): ISO 8601 timestamp of last modification.
- **Validation**:
  - Keyed strictly by date formatted as `YYYY-MM-DD`.
  - Emotion must match one of the 5 supported psychological presets.
- **Limits**:
  - One entry per calendar date.
- **Lifecycle**:
  - Instantiated when navigating to a date in `DailyJournal`.
  - Mutated by typing, voice dictation, or emotion pill click; saved upon clicking "Save Note".

---

## 7. Trade Annotation (`TradeAnnotation`)

Trader qualitative feedback and discipline metadata attached to a specific closed trade round trip.

- **Storage**:
  - Client `localStorage`: `tradingchart_journal_annotations` (JSON dictionary keyed by `tradeKey`).
- **Fields**:
  - `playbook` (`string`, optional): ID of playbook setup applied (e.g. `'smc-order-block'`).
  - `tags` (`string[]`, optional): User tags (e.g. `['A+ Setup', 'London Open']`).
  - `mistakes` (`string[]`, optional): Classification of discipline mistakes (e.g. `['None']`, `['Chased Candle']`, `['Moved Stop']`, `['Overleveraged']`).
  - `notes` (`string`, optional): Qualitative commentary and reasoning.
  - `stopLoss` (`number`, optional): Stop-loss price level assigned at execution.
  - `rating` (`number`, optional): Self-assessment rating score from 1 to 5.
  - `rulesChecked` (`Record<string, boolean>`, optional): Map of specific playbook rules and whether they were followed.
- **Validation**:
  - Keyed by round-trip trade key: `${accountId}|${symbol}|${direction}|${openTime}`.
- **Limits**:
  - One annotation object per unique trade key.
- **Lifecycle**:
  - Created during manual trade logging in `TradeJournalModal` or edited directly in trade ledger.
  - Merged onto reconstructed round trips by `JournalStore.getRoundTrips()`.

---

## 8. Journal Settings (`JournalSettings`)

Global user preferences governing journal filtering, calculation methods, and privacy masking.

- **Storage**:
  - Client `localStorage`: `tradingchart_journal_settings` (JSON object).
- **Fields**:
  - `privacyMode` (`boolean`, required): When `true`, masks all monetary amounts (`$***.**`) across all views (default `false`).
  - `method` (`string`, required): Round-trip pairing method (`'fifo'`, default `'fifo'`).
  - `activeAccount` (`string`, required): Currently selected account filter ID (`'all'` or specific account ID, default `'all'`).
  - `timeFilter` (`string`, required): Time-window filter (`'all'`, `'this_month'`, `'30d'`, `'7d'`, default `'all'`).
  - `timeZone` (`string`, required): Display timezone for daily metrics (`'UTC'`, default `'UTC'`).
- **Validation**:
  - `timeFilter` must be one of the 4 supported enum values.
- **Limits**:
  - Single settings object per browser profile.
- **Lifecycle**:
  - Initialized with default settings on first boot. Updated via UI filter dropdowns and privacy toggle button.

---

## 9. Simulation Profile & Preset (`SimulationProfile` & `PropPreset`)

Configuration specifications and statistical distributions feeding the `@luxalgo/prop-firm-sim-core` Monte Carlo engine.

- **Storage**:
  - In-memory static constants in `client/src/propFirmSimulator.js` (`PROP_FIRM_PRESETS`).
- **Fields (Preset)**:
  - `challengeId` (`string`, required): Preset identifier (`'ftmo-100k'`, `'ftmo-200k'`, `'topstep-50k'`).
  - `name` (`string`, required): Descriptive name.
  - `productType` (`string`, required): Market asset type (`'cfd'` or `'futures'`).
  - `accountSize` (`number`, required): Base challenge balance in USD.
  - `currency` (`string`, required): Currency denomination (`'USD'`).
  - `steps` (`object[]`, required): Array of phase targets: `[{ profitTargetPct, minTradingDays }]`.
  - `dailyLoss` (`object`, required): Daily loss rules: `{ pct: number }`.
  - `maxLoss` (`object`, required): Maximum drawdown mode and limit: `{ mode: 'static-initial' | 'trailing-realized-eod', pct: number }`.
  - `fees` (`object`, required): Challenge purchase price: `{ price: number }`.
  - `funded` (`object`, required): Payout terms: `{ profitSplitPct: number, payoutFrequency: string }`.
- **Fields (Profile)**:
  - `kind` (`string`, required): Profile type (`'parametric'`).
  - `winRate` (`number`, required): Trade win probability (clamped between `0.10` and `0.95`).
  - `avgWinR` (`number`, required): Average winning trade $R$-multiple (`>= 0.5`).
  - `avgLossR` (`number`, required): Average losing trade $R$-multiple (default `1.0`).
  - `tradesPerDay` (`number`, required): Average trading frequency per day (`>= 0.5`).
  - `risk` (`object`, required): Risk sizing: `{ type: 'percent', value: number }`.
- **Validation**:
  - Input parameters are clamped to prevent math domain errors.
- **Lifecycle**:
  - Populated from UI inputs or exported from Strategy Tester backtest results.
  - Consumed by `simulate(spec, profile, { paths: 500 })` on change.
