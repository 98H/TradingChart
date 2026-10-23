# Implementation Plan: Chart Workspace Shell

**Branch**: `001-chart-workspace-shell` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-chart-workspace-shell/spec.md`

## Summary

The Chart Workspace Shell is the core container and trading terminal of Chartivia. Built on the `@luxalgo/vela` WebGL2 charting engine, it provides institutional-grade market discovery, charting controls, analytical tools, and workspace customization. The shell integrates bilingual market search (English & Persian) with instant keyboard navigation, multi-timeframe switching (standard and user-defined custom intervals), 13 chart representation styles (including 7 client-side synthetic non-time-based series like Renko and Kagi), price scale docking (Auto, Logarithmic, Percentage, Inverted), multi-watchlist management with 7-color tagging and Space-stepping, rich modal utilities (Command Palette Ctrl+K, Keyboard Shortcuts reference, Go to Date, Chart Settings, Snapshot Studio, Historical Data Export, Symbol Comparison), live Web Audio feedback, admin platform announcement banners, and responsive layout docking for desktop (340 px side dock offset) and mobile viewports (≤ 768 px off-canvas drawer). All plan entitlements (`histBars`, `secondIntervals`, `customIntervals`, `synthChartTypes`, `dataExport`, `watchlists`, `watchlistSymbols`, `flagColors`) are gated across client and server boundaries.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser, Node.js v20+ ESM on server).

**Primary Dependencies**:
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine, workspace manager, canvas coordinate transforms, price scales).
- `@luxalgo/vela-pinets`: `^0.2.12` (Vela PineTS binding).
- `pinets`: `^0.9.33` (Pine Script execution engine).
- `express`: `^4.21.2` (HTTP backend framework, REST API, static asset server).
- `ws`: `^8.18.0` (WebSocket server for live ticker broadcasts).
- `cors`: `^2.8.5` (Cross-origin resource sharing middleware).
- `@fontsource/inter`: `^5.3.0` (Primary Latin typography).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Monospace numeral typography).
- `@fontsource/vazirmatn`: `^5.3.0` (Primary Persian typography).
- `lucide`: `^0.475.0` (Feather SVG icons).
- `puppeteer-core`: `^24.3.1` (Headless browser testing).
- `vite`: `^6.4.5` (Client bundler and build system).

**Storage**:
- Client `localStorage`:
  - `tradingchart_user_profile`: User profile state (defaultAsset, defaultTimeframe, name, avatar).
  - `tradingchart_user_settings`: User appearance, scales, trading, and system configurations.
  - `tradingchart_theme`: Active visual theme (`dark` | `light`).
  - `tradingchart_price_style`: Persisted chart price style (`candles`, `bars`, `heikinashi`, `renko`, etc.).
  - `tradingchart_custom_timeframes`: Serialized array of user-defined interval definitions.
  - `tradingchart_sound_muted`: Audio mute flag boolean string.
  - `tc_announcement_dismissed`: Timestamp string of the dismissed announcement revision (`updatedAt`).
  - `tradingchart_custom_watchlist`: Array of symbols in the active custom watchlist.
  - `tradingchart_watchlist_flags`: Map of symbol to color flag (`red`, `green`, `blue`, `yellow`, `purple`).
  - `tradingchart_user_watchlists`: Multi-watchlist structure `{ activeId, lists }`.
  - `tradingchart_watchlist_deleted`: Tombstone timestamps for deleted watchlists.
  - `tradingchart_current_layout`: Serialized active Vela workspace state.
- Server Atomic JSON Stores:
  - `server/data/accounts/platform_settings.json`: Global platform announcement, registration status, maintenance mode.
  - `server/data/accounts/plans.json`: Tier quotas, feature entitlement matrix, pricing.
  - `server/data/accounts/states/state_u_<userId>.json`: Cloud synchronization backup of client localStorage keys.

**Testing**:
- `node tests/qa_symsearch.cjs`: Tests symbol search modal filtering, keyboard inputs, and catalogue API.
- `node tests/qa_cycle_palette.cjs`: Tests Command Palette (Ctrl+K) trigger, fuzzy index search, and execution.
- `node tests/test_replay_and_scales.cjs`: Tests Auto, Log, %, Invert scale dock toggles and replay coordination.
- `node tests/qa_cycleA.cjs`: Comprehensive modal interaction, style picker, timeframe builder, export.
- `node tests/qa_cycleB.cjs`: Multi-canvas screenshot composition, panel switching, responsive UI.
- `npm run test:parity` (`tests/dogfood-tradingview-parity.cjs`): Topbar, scales, shortcuts, timeframes parity.
- `npm run test:ultimate` (`tests/dogfood-ultimate-tradingview.cjs`): End-to-end regression audit across terminal suites.

**Target Platform**: Web application running in modern evergreen browsers (Chrome 110+, Safari 16+, Firefox 115+, Edge) on Desktop (1440x900+) and Mobile (390px+), serving `/chart` and `/`.

**Project Type**: Web application (Vite-bundled client frontend under `client/`, Express.js HTTP/WS backend under `server/`).

**Performance Goals**:
- Maintain 60 FPS WebGL2 rendering under active manipulation with up to 50,000 candle bars.
- Live ticker stream coalesced to 1000–1200 ms push cadence; no runaway client poll loops.
- Client-side synthetic bar generation (Renko, Kagi, Range, PnF) completes within < 100 ms for 2,000 bars.
- Modal open and keyboard shortcut responsiveness < 50 ms.
- System memory footprint stays within systemd budget (`MemoryMax=420M`).

**Constraints**:
- Single-page application architecture: language switching and RTL toggling must occur in-place without page refresh.
- Offline resilience: when network candle fetch fails, the shell degrades to the last known-good candle series cache (`app.seriesCache`), never presenting an empty or broken chart.
- Safe DOM updates: admin announcement banner copy is treated as untrusted and injected strictly via `textContent`.
- Touch target safety: minimum 44 px target dimensions on mobile interfaces.

**Scale/Scope**:
- 24 source files covering 6 user stories and 24 functional requirements.
- 13 chart styles (6 native + 7 synthetic client-side algorithms).
- 13 standard intervals + arbitrary custom minute/hour/day intervals.
- Universal symbol catalogue supporting 50+ instruments across Crypto, Forex, Metals, Commodities, Indices, Stocks, Tehran Gold, and Tehran Stock Exchange (TSETMC).
- Command Palette indexing > 45 discrete application actions across 7 categories.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS (with GAP) | Live crypto tickers derive directly from real Binance feeds (`server/dataFeed.js`). Demo markets are visibly tagged in the UI topbar with route badges (`main.js:1354`, "DEMO" / "مدل‌سازی"). Exported OHLCV datasets match actual loaded chart candles (`dataExport.js:155`). Gap: side-dock technical rating card historically rendered estimated vote counts (`technicalRatingCard.js:53-75`, tracked in feature 004). |
| II | Spec Before Code | GAP | Built before SDD adoption (September–October 2026); this retrofit formalizes normative requirements and descriptive artifacts (`specs/001-chart-workspace-shell/spec.md`). |
| III | Real-Browser Zero-Defect Verification | PASS (with GAP) | Test suites (`tests/qa_symsearch.cjs`, `tests/qa_cycle_palette.cjs`, `tests/test_replay_and_scales.cjs`, `tests/dogfood-tradingview-parity.cjs`) execute real Puppeteer browser interactions, evaluate DOM state, inspect bounding boxes, and capture evidence screenshots. Gap: matrix verification across `desktop\|mobile` × `fa\|en` is split across individual cycle scripts rather than unified in one matrix harness. |
| IV | Bilingual Parity and RTL Correctness | PASS (with GAP) | Full dual-language support (English and formal Persian) managed via `client/src/i18n.js`. Dynamic document direction switching (`dir="rtl"` vs `dir="ltr"`), Vazirmatn typography, and in-place re-rendering without reload (`main.js:1794-1881`). Latin numerals, codes, and tickers isolated via `num-ltr` and `<bdi>`. Gap: `main.js:945` has hardcoded English toast `Magnet: ${mode}` without Persian translation. |
| V | Mobile Fit and Interaction Safety | PASS (with GAP) | Responsive layout rules in `client/styles/main.css`; side dock opens as an off-canvas drawer on viewports ≤ 768 px; quick-trade bar minimizes automatically (`main.js:1012`). Gap: custom timeframe delete buttons (`timeframeManager.js:155`) and screenshot action buttons (`screenshotModal.js:115-135`) are styled below the 44 px touch target standard on mobile viewports. |
| VI | Security and Privacy by Default | PASS | Client bundle contains no secrets or admin credentials. Admin console shortcut (`Ctrl+Shift+A`) gates strictly on `auth.isAdmin()` (`main.js:1194`). Platform announcement banner renders text via `textContent` only (`platformBanner.js:54`), avoiding XSS vectors. Server endpoints enforce clean input validation and sanitized JSON error payloads without stack traces (`server/index.js:80,201-208`). |
| VII | Single Source of Truth for Entitlements | GAP | Quotas are defined in `server/featuresCatalog.js` and `server/data/accounts/plans.json`. Candle depth `histBars` is enforced server-side (`server/index.js:93-96`). However, `secondIntervals`, `customIntervals`, `synthChartTypes`, `dataExport`, `watchlists`, `watchlistSymbols`, and `flagColors` are checked solely on the client via `auth.enforce()` / `auth.feature()`, and lack server-side validation during cloud state sync (`server/accounts.js:512`). |
| VIII | Performance Budget | PASS | Live ticker broadcasts throttled to 1200 ms (`server/index.js:284`). Countdown timer runs on a 1-second interval and halts execution when `document.hidden` is true (`scaleControls.js:196`). Synthetic candle builders enforce iteration guards (max 2000 steps) to prevent browser freezes (`syntheticChartTypes.js:41`). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Leverages standard Web APIs (WebGL2, Canvas 2D, Web Audio API, MutationObserver). Vendor packages in `node_modules` remain unmodified; Vela adaptations are performed through build transforms or external configuration wrappers (`vite.config.js`). |
| X | Hybrid SDD | PASS (with GAP) | Retrofit process adheres to Hybrid SDD governance rules: spec.md is immutable; descriptive Spec Kit artifacts bridge existing code to formal contracts; zero-token machine gates validate artifact presence. Retrofitted post-implementation. |

## Project Structure

### Documentation (this feature)

```text
specs/001-chart-workspace-shell/
├── spec.md                     # Normative WHAT (stories, FR-001..FR-024, SC-001..SC-006)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server REST routes, parameters, error contracts, WebSocket
│   └── module-api.md           # Client module interfaces, methods, lifecycle hooks, DOM IDs
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── tasks.md                    # Executed implementation task inventory mapped to FRs
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Shell HTML markup, topbar, modal mounts, layout containers
├── src/
│   ├── main.js                 # Master coordinator, keyboard shortcuts, deep links, i18n dispatch
│   ├── chartManager.js         # Vela WebGL2 workspace manager, candle feed bindings, side dock
│   ├── timeframeManager.js     # Standard timeframe picker & custom interval builder
│   ├── scaleControls.js        # Price scale dock (Auto, Log, %, Inv) & countdown display
│   ├── chartStylePicker.js     # Topbar chart style dropdown (native & synthetic types)
│   ├── syntheticChartTypes.js  # Client-side synthetic bar generators (Renko, Kagi, Range, etc.)
│   ├── commandPalette.js       # Quick search launcher (Ctrl+K) indexing symbols, tools, actions
│   ├── shortcutsModal.js       # Keyboard shortcuts reference modal (?)
│   ├── goToDate.js             # Date jump navigation modal (Alt+G)
│   ├── settingsModal.js        # Chart visual settings modal (4 tabs)
│   ├── screenshotModal.js      # Multi-canvas snapshot capture, download, social copy
│   ├── dataExport.js           # Historical OHLCV dataset export modal (CSV, JSON)
│   ├── canvasContextMenu.js    # Canvas price-pane, price-scale, and drawing context menu
│   ├── platformBanner.js       # Platform announcement banner component
│   ├── uiDialog.js             # Dialog replacement for alert/confirm prompts
│   ├── soundEngine.js          # Web Audio API synthesizer for alerts, clicks, orders
│   ├── compareModal.js         # Benchmark symbol comparison & PineTS overlay
│   ├── watchlistManager.js     # Multi-watchlist manager, quotes, sorting, flag cycling
│   └── i18n.js                 # Localization engine, translations, Persian digit formatting
├── styles/
│   ├── main.css                # Global theme, dock layout, modals, responsive CSS
│   └── fonts.css               # Typography font-face declarations
server/
├── index.js                    # Express HTTP & WebSocket server bootstrap, candle & ticker routes
├── dataFeed.js                 # Historical candle fetcher & 24h ticker cache
├── symbolCatalog.js            # Symbol catalogue search & instrument metadata
├── platformSettings.js         # Platform switches, announcement persistence & public API
├── accounts.js                 # Auth middleware, plan definitions, state sync endpoints
├── featuresCatalog.js          # Canonical plan entitlements & quota limits definition
└── data/
    └── accounts/
        ├── platform_settings.json # Persisted global announcement & platform flags
        └── plans.json          # Tiers (basic, essential, plus, premium, institutional)
tests/
├── qa_symsearch.cjs            # Symbol search input, filtering, and API test
├── qa_cycle_palette.cjs        # Command palette Ctrl+K fuzzy search & execution test
├── test_replay_and_scales.cjs  # Scale controls auto/log/inv and replay tests
├── qa_cycleA.cjs               # Modal interactions, timeframe builder, export tests
├── qa_cycleB.cjs               # Screenshot modal, style picker, panel tests
├── dogfood-tradingview-parity.cjs # Parity testing for topbar, scales, shortcuts
└── dogfood-ultimate-tradingview.cjs # Full regression audit across terminal surfaces
```

**Structure Decision**: Web application consisting of an Express.js server providing REST APIs and WebSocket streams, paired with a vanilla ES6 modular client bundled via Vite. All chart operations dock into the main `#chart-area` viewport with auxiliary modals and docks appended to `#app-container` or `document.body`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| I: Historical fabricated rating card metrics | Shipped in early prototype (commit `c724bb4`) for visual parity with TradingView symbol detail card. | Real-time technical calculation requires substantial computation or screener backend; already scheduled for clean refactor in feature 004/008. |
| II: Built prior to SDD specification | Product was created rapidly prior to adopting the Hybrid Spec-Driven Development framework. | Retrofit spec restores full SDD compliance without halting production operations. |
| IV: Hardcoded English string in magnet toast (`main.js:945`) | Minor developer oversight during drawing toolbar magnet implementation. | Will be unified in feature 011 (i18n & RTL polish). |
| V: Sub-44px touch targets on mobile modal buttons | Compact UI density designed primarily for desktop financial monitors was reused on mobile viewports. | Responsive overrides must be added in mobile polish cycle without degrading desktop information density. |
| VII: Client-side only enforcement of plan limits (intervals, styles, export, watchlists) | Fast client feedback was prioritized; server currently validates state payload syntax but not quota arrays during state sync. | Adding synchronous server checks requires schema validation middleware on state sync routes; tracked for Converge phase. |
