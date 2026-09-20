# TradingChart — Zero-Defect QA & UI/UX Hardening Report

**Target:** `http://127.0.0.1:8088` (`tradingchart.service`)
**Method:** real-browser dogfooding (Puppeteer-core driving headless Chrome 153 — the same
engine as the local CDP service), desktop **1440×900**, mobile **390×844**, plus a tablet
check at **768×1024** and a small-phone check at **320×844**.
**Cycles:** A (feature sweep) → B (deep interactions) → C (data/persistence/resilience)
→ D (surfaces, a11y, stress, adversarial input) → repeated until zero defects.

---

## Final regression status

| Suite | Desktop | Mobile |
|---|---|---|
| Cycle A — feature sweep | 12/12 | 6/6 |
| Cycle B — deep interactions | 12/12 | 4/4 |
| Cycle C — data/persistence/resilience | 10/10 | 4/4 |
| Cycle D — surfaces/a11y/stress/input | 10/10 | 10/10 |
| i18n full-surface sweep | 0 leaks | 0 leaks |
| Data-window localisation round-trip | 0 leaks / 0 regressions | — |

**Genuine untranslated (Persian) strings across every surface: 0.**
**Every suite green on the final frozen build, verified by a full re-run after the last code change.**

---

## Defects found and fixed

### 1. Language preference lost on reload *(functional)*
Switching to Persian then reloading returned to English, and the Settings modal wrote a
stale `language` value that reverted the live UI.
**Fix:** `switchLanguage()` persists the choice; boot restores it before first paint;
`settingsModal` no longer clobbers the live language. Verified by round-trip reload test.

### 2. Charts fabricated for nonexistent symbols *(data integrity — highest severity)*
`/api/candles?symbol=ZZZZNOPE` returned **200 with invented candles**. Any unknown ticker
produced a fully-drawn chart indistinguishable from real market data.
**Fix:** `fetchBinanceKlines` now distinguishes “market does not exist” (HTTP 400/404) from a
network outage and raises `MARKET_NOT_FOUND`. `getCandles` refuses to synthesise data for
unknown instruments, and the API answers **404**. Verified: unknown tickers → 404,
real instruments → 200.

### 3. Empty data payloads crashed the chart/indicator engine *(robustness)*
During a data outage the client replaced its candle series with `[]`, leaving the Pine
indicator engine running against undefined bars, and a symbol switch during an outage
repointed the chart at a dead instrument.
**Fix:** a per-symbol/timeframe last-known-good series cache, a pre-flight existence check in
`switchSymbol`/`setTimeframe` (refuse + localised toast instead of breaking the chart), and
malformed-bar filtering.

### 4. Click handlers reading `data-id` from `event.target` *(functional)*
Three handlers — alert delete, alert enable/disable and **close position** — read
`data-id` off the click target rather than the button. Clicking the button's own text/child
silently did nothing, so a trader could not close a position.
**Fix:** read the id from the button; the position-close and alert-deletion paths now work
by real click. Also hardened symbol input against blank/whitespace tickers, which previously
blanked the header and quick-trade unit without changing the chart.

### 5. Untranslated Persian surfaces *(UI/UX)*
69 leaks at first pass, including the Vela engine's injected UI, the data window, screener
rating chips, prop-firm annotations, leveraged-position badges and the templates panel.
**Fix:** central auto-localization engine (lossless, round-trips back to English) plus
source-level translation of the Vela data window, whose panel rebuilds its DOM every frame
and therefore cannot be patched by DOM wrapping.

### 6. Layout/overflow defects *(UI/UX)*
- No global `box-sizing: border-box` — every `width:100%` element with padding overflowed
  its parent (news search, tracker filters, Pine toolbar).
- Undefined `--font-persian` token in 11 files → Persian text fell back to a generic
  sans-serif instead of Vazirmatn.
- Mobile quick-trade pill overlapped the chart; panels-menu item overflowed in RTL;
  touch targets below the 44px minimum.
**Fix:** global box-sizing reset, token rename to `--font-vazirmatn`, RTL-aware flex
layouts, mobile positioning/z-index and touch-target sizing. Verified by clip-aware overflow
detection at four viewports.

### 7. Accessibility *(a11y)*
The screenshot-modal close control had no accessible name (icon-only, no `title`).
**Fix:** added `title` + `aria-label` (localised). Full a11y sweep now reports zero
unlabelled interactive controls and zero `<img>` without `alt`.

---

## Systemic issues resolved

- **Orphaned Chrome processes:** crashed suites left ~200MB-RSS browsers behind, starving the
  2GB VPS and eventually timing out later runs. The harness now registers every browser,
  force-closes on all exit/signal paths, and refuses to launch below 250MB available memory —
  protecting the product's own service from OOM.
- **Diagnostic accuracy:** the overflow detector now accounts for clipping ancestors, and the
  i18n scanner distinguishes genuine untranslated copy from instrument tickers, SEC filer
  names, news outlets and brand terms — eliminating false positives that masked real work.

## Evidence

- Per-test JSON: `screenshots/qa_cycles/cycle{A,B,C,D}_{desktop,mobile}_results.json`
- Screenshots: `screenshots/qa_cycles/*.png`
- Harness: `tests/qa_lib.cjs`; suites `tests/qa_cycle{A,B,C,D}.cjs`, `tests/qa_i18n_final.cjs`
- Build/deploy: `scripts/build_and_restart.sh`; safe optimisation: `scripts/optimize_resources.sh`

---

## Late-cycle findings (defects the build-up cycles masked)

A second wave of defects surfaced only once the earlier ones stopped hiding them.
They are the reason the suite was re-run to green rather than declared done:

- **Screener blanked on language switch.** `render()` repaints the table header and
  leaves an empty `<tbody>` placeholder, so switching language wiped every row until
  the next 30s refresh. Rows are now repainted immediately.
- **Screener and calendar panel instances were discarded.** `mountTechnicalScreener`
  / `mountEconomicCalendar` created the Vela-dock instances without keeping a
  reference, so those drawers could never react to a language change at all.
- **Untranslated copy in the screener, DOM ladder and calendar.** Raw `▲ Bull` /
  `▼ Bear` trend chips, `+ Buy` / `− Sell` DOM buttons and `HIGH`/`MED`/`LOW` impact
  badges all rendered in Latin under Persian. Instrument display names arriving from
  the server catalogue (Shiba Inu, Gold / US Dollar Spot, …) are now localised through
  a shared `localizeInstrumentName()` helper.
- **Duplicate dictionary keys.** `'Close'` was defined twice — first as the action
  ("بستن"), later as the OHLC field ("بسته") — and in JS the later definition silently
  wins, so every "Close" button would have read "بسته". The OHLC labels now use a
  dedicated data-window map and the dictionary is verified duplicate-free.
  The same class of collision was found on `'Indicator Templates'` (one entry had a
  stray ZWNJ), which is fixed and de-duplicated.

## System resource optimisation (no impact on other projects)

`scripts/optimize_resources.sh` runs a before/after health check across all 15 peer
services, so any side effect is visible immediately.

- npm + apt caches cleared (589MB / package archives)
- systemd journal bounded at 100MB
- reclaimable page cache dropped (never anonymous memory in use)
- **logrotate was silently broken system-wide.** `/var/log` is group-writable by
  `syslog`, so logrotate refused to rotate *every* file and has been failing its
  weekly run — syslog had grown to **144MB**. Adding `su root syslog` to
  `/etc/logrotate.d/rsyslog` fixed rotation (verified: a dry-run across all 21 log
  paths now reports no errors), the backlog was rotated and compressed to 12MB, and
  the script now re-checks this on every run.
- Rotated logs older than 14 days are pruned.

Result: all 15 services `active` before and after, and every product endpoint still
answers HTTP 200 (`/`, `/api/health`, `/api/candles?…`, `:8095/`).