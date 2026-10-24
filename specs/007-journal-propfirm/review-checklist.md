# Review checklist — specs/007-journal-propfirm

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Switching workspace to `quant` dispatches a window resize event (`window.dispatchEvent(new Event('resize'))`) to re-measure chart canvas dimensions.
- [ ] Privacy mode toggle immediately masks all monetary values across KPIs, calendar tiles, equity curve Y-axes, trade ledger rows, scatter tooltips, and prop challenge cards as `$***.**` or `***`.
- [ ] Executions FIFO round-trip matching preserves order timestamps, handles scale-in/scale-out closures deterministically, and calculates exact net P&L minus broker fees.
- [ ] Manual trade log modal creates two atomic executions (open and close) and overlays annotations onto round-trip signature without corrupting the store.
- [ ] Manual trade log modal live preview updates signed P&L and $R$-multiple (`rewardPerUnit / riskPerUnit`) on every price, quantity, or direction input change.
- [ ] Statement importer detects format automatically, shows a 15-row preview reconciliation table, and deduplicates using 5-tuple signatures (`symbol|side|price|quantity|executedAt`).
- [ ] Closing a paper trading position or bar replay position automatically logs execution records into the trade journal store without user intervention.
- [ ] Replay trade executions use simulated candle timestamps (`barTime()`) rather than client wall-clock time, and tag `source: 'replay'`.
- [ ] Prop-firm simulator executes 500 Monte Carlo paths in under 2 seconds, displaying pass probability, risk of ruin, expected value, median days to funded, and 35 SVG sample paths.
- [ ] "Export to Prop-Sim" in Strategy Tester pre-fills strategy's actual win rate, average win R, and trades per day into the simulator and re-runs.
- [ ] Prop-firm tracker calculates drawdown buffer (`currentBalance - (initialBalance - maxLossLimit)`) and flags amber/red breach warnings when buffer is below 25% of max loss limit.
- [ ] Daily journal saves notes and one of 5 emotional mindset states per calendar date with saved/unsaved status indicators.
- [ ] CSV export downloads `tradingchart_journal_export_YYYY-MM-DD.csv` with the exact 18-column header.
- [ ] Empty states for Edge Score radar and duration scatter display honest informational guidance when insufficient closed trades exist.

## Architecture boundaries
- [ ] Reactive journal storage, FIFO calculations, account filtering, and CSV/JSON export are encapsulated in `client/src/journal/journalStore.js`.
- [ ] Mathematical analytics (metrics, equity, drawdown, Edge Score v2 composite, adherence) reside in `@luxalgo/journal-core` under `client/src/journal/core/`.
- [ ] Format detection and parsing for 14 statement types reside in `@luxalgo/journal-importers` under `client/src/journal/importers/`.
- [ ] SVG chart rendering (Edge radar, equity curve, session heatmap, scatter) is encapsulated in `client/src/journal/journalCharts.js`.
- [ ] Workspace view switching and side-dock/bottom-panel mounts are orchestrated in `client/src/main.js`.
- [ ] Plan feature entitlements (`tradeJournal`, `propFirmSim`) are defined in `server/featuresCatalog.js` and `server/accounts.js`.
- [ ] Chart canvas projections and workspace DOM interact strictly via public APIs; no files in `node_modules` are modified.

## Forbidden shortcuts
- [ ] No branches on test inputs, test environments, or user-agent sniffing in production journal logic.
- [ ] No placeholder or invented data shown to users without explicit synthetic/demo labeling (known legacy fallbacks tracked for Converge resolution).
- [ ] No un-throttled or perpetual background timer loops running while tab is hidden.
- [ ] No network egress during statement parsing or Monte Carlo simulations; all operations remain local/in-browser.
- [ ] No silent overwriting of locally added executions during cloud-state synchronization conflict resolution.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows uniform formal respectful register, strict ZWNJ usage, and Persian numerals in FA mode (`داشبورد و تقویم`, `تحلیل پیشرفته و رادار مهارت`, `دفترچه ستاپ‌ها و قوانین چک‌لیست معامله`, `شبیه‌ساز چالش‌های پراپ‌فرم`).
- [ ] Numbers, ticker symbols, prices, quantities, and R-multiples maintain strict LTR orientation inside RTL layouts (`num-ltr`, `<bdi>`, `dir="ltr"`).
- [ ] On viewports ≤ 768px, journal workspace is accessible through the +Panels drawer (`#nav-btn-panels`) with minimum 44px touch targets.
- [ ] Single-line non-blocking toast notifications confirm trade submission, CSV export, and statement import commit.
