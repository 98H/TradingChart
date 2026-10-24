# Module API Contract: Trade Journal and Prop-Firm Tools

Normative interface definitions, public methods, properties, and event bindings for client-side trade journal suites, reactive store, and prop-firm simulation engine.

---

## 1. `JournalStore` Class

Located at `client/src/journal/journalStore.js`. Manages execution storage, FIFO round-trip generation via `@luxalgo/journal-core`, account filters, challenge profiles, playbooks, notes, and local storage reactivity.

### Constructor
```javascript
new JournalStore(app = null)
```
- `app` (`object`, optional): Reference to the root application context (`window.__TRADING_APP__`).

### Public Properties
- `executions`: `Execution[]` — Array of atomic buy/sell trade executions.
- `accounts`: `JournalAccount[]` — Array of available trading accounts.
- `propFirms`: `PropChallenge[]` — Array of tracked prop-firm evaluations.
- `playbooks`: `PlaybookSetup[]` — Array of strategy playbooks with rule checklists.
- `notes`: `Record<string, DailyNote>` — Map of daily notes keyed by date (`YYYY-MM-DD`).
- `annotations`: `Record<string, TradeAnnotation>` — Map of qualitative annotations keyed by `tradeKey`.
- `settings`: `JournalSettings` — Active journal configuration object.

### Public Methods

#### `subscribe(listener: (store: JournalStore) => void): () => void`
Registers a callback to receive notifications when store contents change. Returns an unsubscribe function.

#### `notify(): void`
Dispatches update notifications to all registered listeners.

#### `addExecution(exec: Partial<Execution>): Execution`
Inserts a single trade execution into the store, writes to `localStorage`, and triggers `notify()`. Automatically generates an ID if missing and defaults account to `settings.activeAccount` or `'tradingchart-paper-1'`.

#### `addExecutions(execList: Partial<Execution>[], targetAccountId?: string): number`
Batch inserts multiple trade executions, skipping any duplicate whose 5-tuple signature (`symbol|side|price|quantity|executedAt`) matches an existing record. Returns the count of newly inserted executions.

#### `deleteExecution(id: string): void`
Removes an execution by ID and updates storage.

#### `clearExecutions(accountId?: string): void`
Clears all executions belonging to `accountId`, or all executions across the store if `accountId` is omitted or `'all'`.

#### `getFilteredExecutions(filterOverride?: object): Execution[]`
Returns raw executions matching `settings.activeAccount` and `settings.timeFilter` (or explicit overrides).

#### `getRoundTrips(filterOverride?: object): RoundTrip[]`
Passes filtered executions into `@luxalgo/journal-core/buildRoundTrips` with FIFO matching, overlays annotations from `this.annotations`, and returns paired round trips.

#### `getMetrics(filterOverride?: object): object | null`
Calculates comprehensive metrics (net P&L, win rate, profit factor, total trades, avg win/loss) via `@luxalgo/journal-core/computeMetrics`.

#### `getEdgeScore(metrics?: object): object | null`
Evaluates the 6-axis Edge Score v2 radar components and composite score (0–100) via `@luxalgo/journal-core/computeEdgeScore`.

#### `getEquityCurve(filterOverride?: object): { curve: object[], drawdown: object | null }`
Generates cumulative equity curve points and drawdown trajectories via `@luxalgo/journal-core/equityCurve` and `drawdown`.

#### `getDailyStats(filterOverride?: object): object[]`
Aggregates trades into daily statistical bins via `@luxalgo/journal-core/dailyStats`.

#### `getAttributions(filterOverride?: object): object`
Returns multi-dimensional trade attribution breakdowns (by weekday, hour, direction, symbol, asset class, playbook, tag, mistake, duration).

#### `getAdherence(): object[]`
Evaluates strategy rule adherence rates and discipline leak metrics via `@luxalgo/journal-core/analyzeAdherence`.

#### `saveSettings(patch: Partial<JournalSettings>): void`
Merges updates into `this.settings` and triggers a re-render.

#### `togglePrivacy(): boolean`
Toggles `settings.privacyMode` between `true` and `false`. Returns new state.

#### `exportCsv(): void`
Generates and downloads `tradingchart_journal_export_YYYY-MM-DD.csv` containing all paired round trips.

#### `exportJson(): void`
Generates and downloads a complete JSON workstation backup (`tradingchart_journal_backup_YYYY-MM-DD.json`).

---

## 2. `TradeJournal` Class

Located at `client/src/tradeJournal.js`. Top-level UI controller organizing the header ribbon, global filters, 8-suite sub-navigation, dashboard, and trades ledger.

### Constructor
```javascript
new TradeJournal(options = {})
```
- `options.container` (`HTMLElement`, required): DOM node where the journal is mounted.
- `options.app` (`object`, optional): Reference to the root application.
- `options.store` (`JournalStore`, optional): Instance of `JournalStore`. Defaults to a new store.

### Public Properties
- `activeTab`: `'dashboard' | 'analytics' | 'trades' | 'daily' | 'prop' | 'playbooks' | 'aicoach' | 'importer'` — Currently active suite tab.
- `importer`: `StatementImporter`
- `propTracker`: `PropFirmTracker`
- `playbookMgr`: `PlaybookManager`
- `dailyJour`: `DailyJournal`
- `aiCoach`: `AiCoach`

### Public Methods

#### `render(): void`
Constructs the top ribbon, filter dropdowns, privacy toggle, suite tab strip, and renders the active suite into `#journal-suite-content`.

#### `reloadFromStorage(): void`
Reloads executions from `localStorage` into the underlying store and re-renders the active suite.

---

## 3. `TradeJournalModal` Class

Located at `client/src/tradeJournalModal.js`. Interactive dialog for logging executions with live P&L and risk-reward previews, playbook tagging, and speech recognition.

### Constructor
```javascript
new TradeJournalModal(app)
```
- `app` (`object`, required): Application context (`window.__TRADING_APP__`).

### Public Methods

#### `open(): void`
Checks `auth.enforce('tradeJournal')`. If permitted, creates or selects `#modal-log-trade`, pre-fills symbol and market price, sets side to BUY, calculates initial risk/reward, and adds `.open`.

#### `close(): void`
Halts voice recognition if active and removes `.open` from `#modal-log-trade`.

#### `stopVoice(): void`
Stops speech recognition instance and resets button styling.

#### `render(): void`
Builds modal DOM layout, binds 1-click direction toggle, inputs for entry/exit/sl/qty, live P&L calculation, voice dictation, and save action.

---

## 4. `PropFirmSimulator` Class

Located at `client/src/propFirmSimulator.js`. Monte Carlo challenge evaluation engine powered by `@luxalgo/prop-firm-sim-core`.

### Constructor
```javascript
new PropFirmSimulator(options = {})
```
- `options.container` (`HTMLElement`, required): Container element mounting the simulator view.

### Public Properties
- `currentPresetKey`: `'ftmo-100k' | 'ftmo-200k' | 'topstep-50k'` — Active challenge specification.
- `winRate`: `number` (clamped between `0.10` and `0.95`, default `0.54`).
- `avgWinR`: `number` (default `2.0`).
- `tradesPerDay`: `number` (default `2.5`).
- `riskPct`: `number` (default `1.0`).

### Public Methods

#### `setProfileParams(params: { winRate?: number, avgWinR?: number, tradesPerDay?: number }): void`
Updates simulation parameters (e.g. exported from Strategy Tester) and immediately re-runs the simulation.

#### `render(): void`
Constructs parameter controls ribbon and KPI/trajectory output area.

#### `runSimulation(): void`
Executes `simulate(spec, profile, { paths: 500 })`, updates pass rate, risk of ruin, expected value, and median days to funded, and renders 35 SVG Monte Carlo paths.

---

## 5. `PropFirmTracker` Class

Located at `client/src/journal/propFirmTracker.js`. Manages prop challenge portfolios, evaluation fees, payouts, ROI, and drawdown buffer alerts.

### Constructor
```javascript
new PropFirmTracker(journalStore, app = null)
```

### Public Methods

#### `render(container: HTMLElement): void`
Renders cash flow KPI ribbon, active challenges grid, target progress bars, and drawdown buffer warnings.

#### `bindEvents(container: HTMLElement): void`
Binds "+ Add Prop Challenge" prompt dialog and "Prop-Firm Simulator" navigation button.

---

## 6. `PlaybookManager` Class

Located at `client/src/journal/playbookManager.js`. Manages strategy setups, checklist rules, and rule adherence metrics.

### Constructor
```javascript
new PlaybookManager(journalStore, app = null)
```

### Public Methods

#### `render(container: HTMLElement): void`
Renders adherence KPI ribbon, setup cards with rule checklists, and adherence badges.

#### `bindEvents(container: HTMLElement): void`
Binds "+ New Playbook Setup" prompt dialog.

---

## 7. `DailyJournal` Class

Located at `client/src/journal/dailyJournal.js`. Daily reflection notes editor, emotion selector, date stepping, and voice dictation.

### Constructor
```javascript
new DailyJournal(journalStore, app = null)
```

### Public Methods

#### `render(container: HTMLElement): void`
Renders date navigation controls, day trade stats, 5-state emotion selector, notes textarea, and executions list.

#### `bindEvents(container: HTMLElement): void`
Binds date navigation buttons (`‹`, `›`, `Today`), emotion pill clicks, Web Speech voice dictation, and "Save Note" action.

---

## 8. `AiCoach` Class

Located at `client/src/journal/aiCoach.js`. Grounded reflection assistant answering trading performance queries.

### Constructor
```javascript
new AiCoach(journalStore, app = null)
```

### Public Methods

#### `render(container: HTMLElement): void`
Renders AI coach introductory banner, quick-query suggestion chips, chat thread, and input box.

#### `computeAnswer(question: string, isFa: boolean): string`
Analyzes round trips, attributions, and metrics to return a grounded factual response for mistakes, best weekdays, long vs short, and overall expectancy.

---

## 9. `StatementImporter` Class

Located at `client/src/journal/statementImporter.js`. Universal multi-broker statement parser and preview reconciliation table.

### Constructor
```javascript
new StatementImporter(journalStore, app = null)
```

### Public Methods

#### `render(container: HTMLElement): void`
Renders account selector, drag-and-drop dropzone, text paste area, preview reconciliation table, and commit button.

#### `handleFile(file: File, container: HTMLElement): void`
Reads file content via `FileReader` and triggers `parseContent()`.

#### `parseContent(content: string, container: HTMLElement, sourceName?: string): void`
Invokes `detectFormat(content)` and `parseAuto(content)`. Updates preview card with detected broker badge and up to 15 parsed rows.

---

## 10. `JournalCharts` Static Class

Located at `client/src/journal/journalCharts.js`. High-performance, zero-dependency SVG chart renderers.

### Static Methods

#### `renderEdgeRadar(container: HTMLElement, components: object | null, overallScore?: number): void`
Renders 6-axis Edge Score v2 polygon radar (winRate, profitFactor, avgWinLoss, drawdown, recovery, consistency) with composite badge. Displays empty state message if `components` is null.

#### `renderEquityCurve(container: HTMLElement, curveData: object[], privacyMode?: boolean): void`
Renders cumulative equity growth SVG curve with zero-line and peak markers, applying privacy masking if enabled.

#### `renderHourlyHeatmap(container: HTMLElement, hourlyStats: object[]): void`
Renders 24-hour UTC session tiles with Tokyo (00-09 UTC), London (07-16 UTC), and New York (13-22 UTC) session ribbons.

#### `renderTradeScatter(container: HTMLElement, roundTrips: RoundTrip[], privacyMode?: boolean): void`
Renders trade holding duration vs net P&L bubble scatter plot. Displays empty state message if no closed trades exist.
