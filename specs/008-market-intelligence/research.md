# Research: Market Intelligence

History: `git log --format='%h %ad %s' --date=short -- client/src/marketTrackersView.js client/src/marketNewsView.js client/src/economicCalendar.js client/src/goldBubbleView.js client/src/tseTapeView.js client/src/marketSourcesModal.js server/marketTrackers.js server/newsFeed.js server/economicCalendar.js server/dataFeed.js`
— `ecdb389` (2026-09-17, Initial release of TradingChart with paper trading & alerts foundations), `267f359` (2026-09-18, Zero-defect architectural elevation across desktop, mobile, and RTL surfaces), `b1565ab` (2026-09-18, TradingView parity with multi-symbol compare overlay, economic calendar, floating scale controls, data export), `c724bb4` (2026-09-18, Complete TradingView replacement with chart styles, context menu, news feed, technical rating card), `6ccb1d9` (2026-09-18, Complete exhaustive QA & dogfooding cycles, white-label elevation, and bilingual parity), `26df247` (2026-09-18, Complete exhaustive browser dogfooding cycles, zero-defect UI/UX polish, and bilingual perfection), `defa0a3` (2026-09-18, Enforce margin-inline-start and clean logical styling across alternative data feeds), `3c9c194` (2026-09-19, Complete exhaustive browser dogfooding, balance quick-trade, harmonize icons, and zero-defect polish), `5ff5629` (2026-09-19, Achieve zero-defect parity across desktop, mobile, RTL Persian, and real browser dogfooding), `14f85d6` (2026-09-20, Zero-defect elevation wave-2 — responsive header, FA i18n completion, hardened QA harness), `1e0c675` (2026-09-20, Final wave evidence — all suites green on frozen build), `c22ef30` (2026-09-27, Topbar responsive overflow, username blocklist regex, interval teardown on gold/tse views), `7544e50` (2026-10-12, Real-browser zero-defect cycle: honest data, replay isolation, layout/app sync, resource-aware polling), `a94a611` (2026-10-22, Chartivia: production hardening + rebrand + TradingView-style routing).

---

## R1. Dual-surface view delivery (Bottom Panel Tabs and Vela Right-Dock Panels)

- **Decision**: Deliver Trackers, Economic Calendar, and Market News across two complementary UI surfaces:
  1. Expandable bottom panel tabs (`#view-trackers`, `#view-calendar`, `#view-news` inside `#bottom-panel`), selected via `.panel-tab[data-view="..."]`.
  2. Collapsible right-dock side panels inside the Vela WebGL2 workspace (`mountMarketTrackers`, `mountEconomicCalendar`, `mountMarketNews` registered via `velaPanels.js`), toggled via right-rail buttons (`.rail-btn[data-panel="..."]`).
- **Rationale**: Professional charting layouts require flexible workstation ergonomics. When analyzing macroeconomic trends alongside a wide candlestick chart, traders prefer an expandable bottom ledger. When active scalping or day trading on multi-pane layouts, traders need a persistent vertical drawer on the right edge that leaves chart height unconstrained. Supporting both surfaces satisfies both multi-tasking workflows.
- **Alternatives considered**:
  - Modal dialogs only (rejected: modals occlude chart canvas and prevent concurrent analysis while charting).
  - Bottom panel tabs only (rejected: violates TradingView UI parity where calendar and news reside in the right side rail).
  - Side dock panels only (rejected: side dock width of 420-440px is too cramped for wide tabular data like 7-column Congressional disclosures and 8-column SEC Form 4 filings).
- **Evidence**: `client/src/main.js:319-347, 490-515, 537-547, 1663-1703`, `client/src/velaPanels.js:169-206`, `client/chart/index.html:235-240, 275-290`.

## R2. In-memory static catalog architecture for US disclosures (Congress, Form 4, 13F, FINRA)

- **Decision**: Model alternative institutional data as static in-memory collections (`CONGRESSIONAL_TRADES`, `INSIDER_TRADES`, `HEDGE_FUND_13F`, `FINRA_SHORT_VOLUME`) in `server/marketTrackers.js`, served through `GET /api/market-trackers?kind=...`. Include authentic PDF links to `disclosures-clerk.house.gov`, `efdsearch.senate.gov`, and SEC EDGAR (`sec.gov/Archives/edgar/data/...`).
- **Rationale**: Scraping official US House, Senate, and SEC EDGAR endpoints in real-time introduces brittle network scraping dependencies, potential IP rate-limiting, and slow cold-start latencies. Serving curated in-memory datasets guarantees sub-5ms response times and deterministic payloads for testing while maintaining realistic schemas with genuine links to public filings.
- **Alternatives considered**:
  - Live scraping of SEC EDGAR RSS feeds (rejected: EDGAR requires custom User-Agent headers, enforces strict 10 req/s IP quotas, and introduces high external latency).
  - Third-party commercial API integration like Quiver Quantitative or Benzinga (rejected: requires expensive proprietary API keys, network egress, and subscription costs).
- **Evidence**: `server/marketTrackers.js:4-146`, `server/index.js:153-161`, `client/src/marketTrackersView.js:16-26, 95-208`.

## R3. Macroeconomic calendar release telemetry and multi-parameter filtering

- **Decision**: In `server/economicCalendar.js` and `client/src/economicCalendar.js`, deliver a scheduled feed of 10 macroeconomic releases with impact classification (`HIGH`, `MED`, `LOW`), actual/forecast/previous figures, and currency/country mappings. Implement a dual-tier UI consisting of:
  1. An upcoming release highlight banner displaying the nearest future event (`timestamp > Date.now()`) with country flag, forecast, and impact badge.
  2. A scrollable event card list with quick-filter toggle buttons (All Events, High Impact 🔥, 🇺🇸 USD, Central Banks, Inflation) and a dynamic search filter.
- **Rationale**: High-impact economic announcements (FOMC, CPI, NFP) trigger extreme volatility in currency and index markets. Traders need instant clarity on the next immediate catalyst without scrolling through historical releases. Toggling an active filter button returns the view to 'all', enabling rapid keyboard-less filtering.
- **Alternatives considered**:
  - Full-page month-view calendar widget (rejected: excessive vertical footprint that cannot fit inside a bottom tab or 420px side dock).
  - External TradingView / ForexFactory iframe embed (rejected: violates white-label branding, fails in offline environments, and cannot be styled with application CSS tokens).
- **Evidence**: `server/economicCalendar.js:5-190`, `client/src/economicCalendar.js:40-85, 173-186`.

## R4. Real-time market news feed with polling and 1-click chart symbol switching

- **Decision**: In `MarketNewsView`, render breaking headlines tagged by sentiment (`bullish`, `bearish`, `neutral`) and impact (`high`, `medium`). Start a 15-second background polling timer (`setInterval`) that fetches `/api/news?category=...&limit=30` only when `!document.hidden`. Every news card includes an interactive symbol pill (`.news-sym-pill`) that switches the active chart via `app.chartManager.setSymbol(sym)` and triggers an execution toast (`SYMBOL 1 <SYM>`).
- **Rationale**: News items without actionable charting connections create friction. Allowing traders to click any ticker pill (e.g. `BTCUSDT`, `NVDA`, `USOIL`) and instantly repoint the primary chart canvas fulfills the core product principle of contextual market intelligence.
- **Alternatives considered**:
  - WebSocket push stream for news (rejected: news volume in simulated catalogs does not warrant WebSocket connection overhead; 15-second HTTP polling is lightweight and easy to throttle).
  - Generic anchor links navigating away to external news websites (rejected: pulls user attention away from the trading platform).
- **Evidence**: `client/src/marketNewsView.js:25-28, 30-42, 160-196`, `server/newsFeed.js:5-162`.

## R5. Tehran Gold Market & Coin Bubble calculation model (Institutional Formula)

- **Decision**: Implement the canonical Iranian bullion and coin market pricing formulation in `server/dataFeed.js:getGoldMarketSnapshot` and display it in `client/src/goldBubbleView.js`:
  $$\text{Intrinsic Value} = \left(\frac{\text{Ounce USD} \times \text{USD Free Rate}}{31.1035}\right) \times \text{Weight (g)} \times \text{Purity} + \text{Mint Wage}$$
  Compute the bubble in Tomans (`marketPrice - intrinsicValue`) and percentage (`(bubbleAmount / marketPrice) * 100`). Render four top-level summary cards (Melted Gold 17k Mesghal, 18k Gram Gold 750, Spot Ounce, Free USD / Nobitex USDT) and a 5-coin valuation table (Emami, Bahar, Nim, Rob, Gerami).
- **Rationale**: Iran's retail gold and coin market is one of the most liquid alternative investment channels for Iranian traders. Iranian coins trade at significant premiums (bubbles) above their gold melt value due to retail demand and central bank mint quotas. Providing transparent mathematical decomposition of melt value vs bubble is an indispensable tool for Iranian arbitrage and swing traders.
- **Alternatives considered**:
  - Displaying raw scrap gold prices without coin bubble calculation (rejected: leaves traders unable to evaluate coin premium risk).
  - Client-side calculation only (rejected: server-side snapshot allows centralized price broadcasting and synchronization across chart tickers and table).
- **Evidence**: `server/dataFeed.js:180-242`, `client/src/goldBubbleView.js:63-277`.

## R6. TSETMC equity tape algorithmic microstructure simulation (iran_tse.py port)

- **Decision**: Port the Python algorithmic tape generator (`iran_tse.py`) to ESM in `server/dataFeed.js:getTseMarketTape`. Calculate realistic microstructure metrics:
  - Last traded price, close price, yesterday reference price, session high/low.
  - Retail (individual) vs institutional (legal entity) buy and sell volumes.
  - Individual buy count and sell count.
  - Retail per-capita buy/sell in Tomans:
    $$\text{Buy Per-Capita} = \frac{\text{Individual Buy Volume} \times \text{Last Price}}{\text{Individual Buy Count} \times 10}$$
  - Buyer power ratio: $\frac{\text{Buy Per-Capita}}{\text{Sell Per-Capita}}$.
  - Smart money inflow trigger: `buyerPowerRatio >= 1.25`.
  - Queue status (Buy Queue if change $\ge 2.8\%$, Sell Queue if change $\le -2.8\%$, Balanced otherwise).
  Provide 8 quick-switch symbol chips (FOOLAD, FAMELI, KHODRO, AHRAM, SHASTA, TALA, AYAR, TAVAN) and a button to load the stock's full OHLCV chart.
- **Rationale**: The Tehran Stock Exchange (TSETMC) is characterized by a strict 2% to 7% daily price band (damaneh nesan) and pervasive order queueing. Iranian "Tablokhani" (tape reading) relies heavily on retail buyer power ratio to detect smart money accumulation before price limits are locked. Simulating this exact microstructure provides authentic analytical fidelity.
- **Alternatives considered**:
  - Scraping live TSETMC HTTP endpoints directly (rejected: TSETMC web servers block cloud VPS IP ranges, lack CORS, and suffer frequent network timeouts).
  - Simple OHLCV bars without orderflow or per-capita metrics (rejected: misses the defining characteristic of Iranian equity trading analysis).
- **Evidence**: `server/dataFeed.js:247-329`, `client/src/tseTapeView.js:63-301`.

## R7. Multi-tier market data waterfall telemetry and live Binance ping probe

- **Decision**: Provide a dedicated modal inspector (`MarketSourcesModal` in `client/src/marketSourcesModal.js`) and a persistent topbar status button (`#btn-topbar-market-source`). Query `GET /api/market-sources` which runs `server/dataFeed.js:probeBinance` against `https://data-api.binance.vision/api/v3/ping` (cached for 30s with a 4s abort timeout). Display 5 waterfall tier cards:
  - Tier 1: Binance Direct (live spot crypto, real latency in ms).
  - Tier 2: Forex, Metals & Commodities (modelled demo series).
  - Tier 3: US Indices & Equities (modelled demo series).
  - Tier 4: Tehran Gold & Currencies (modelled demo series).
  - Tier 5: Tehran Stock Exchange (modelled demo series).
- **Rationale**: Adheres to the Constitution's Honest Data principle (Principle I). Clearly distinguishes between the live upstream crypto connection and modelled/synthetic demo feeds. Gives traders transparent insight into latency and active routing.
- **Alternatives considered**:
  - Masking demo feeds as "Live" to enhance perceived product completeness (rejected: strictly prohibited by Constitution Principle I; fake "live" badges destroy platform credibility).
  - Hardcoded latency numbers in the UI (rejected: live probe against Binance Vision ping ensures real network latency measurements).
- **Evidence**: `server/dataFeed.js:611-649`, `client/src/marketSourcesModal.js:50-147`, `client/src/main.js:1330-1374`.

## R8. Resource-aware polling and unmount lifecycle teardown

- **Decision**: In `GoldBubbleView` (4s poll) and `TseTapeView` (3s poll), implement explicit `mount()` and `unmount()` lifecycle methods. In `main.js:switchBottomView` and `main.js:toggleBottomPanel`, invoke `unmount()` on inactive views to clear their interval timers (`clearInterval`). Furthermore, in all active polling timers, guard execution with `if (!document.hidden)` to halt network calls when the browser tab is minimized or backgrounded.
- **Rationale**: Preserves client CPU resources, prevents background memory leaks, and complies with Constitution Principle VIII (Performance Budget: no perpetual DOM loops, skip operations while `document.hidden`).
- **Alternatives considered**:
  - Global single timer that continuously polls all endpoints regardless of active tab (rejected: wasteful network traffic and unnecessary CPU wakeups).
  - Relying on garbage collection without clearing intervals (rejected: active `setInterval` references retain instance memory permanently).
- **Evidence**: `client/src/goldBubbleView.js:19-31`, `client/src/tseTapeView.js:20-32`, `client/src/main.js:1652-1659, 1670-1675`.

## R9. Mobile drawer integration via quick navigation cards

- **Decision**: On viewports $\le 768\text{px}$, route access to Gold Studio, TSE Tape, and Market Sources through the mobile drawer menu (`#modal-panels-menu`, triggered via `#nav-btn-panels`). Clicking `.panel-menu-item[data-panel="gold"]` or `[data-panel="tse"]` switches the active bottom view and expands the panel; clicking `[data-panel="sources"]` opens the Market Sources modal.
- **Rationale**: Mobile viewports have restricted header and footer real estate. Hiding secondary bottom tabs behind a standardized mobile drawer while maintaining minimum 44px touch targets satisfies Constitution Principle V (Mobile Fit and Interaction Safety).
- **Alternatives considered**:
  - Wrapping bottom panel tabs into multiple rows on mobile (rejected: severely encroaches on chart canvas height on mobile devices).
  - Completely disabling Gold and TSE views on mobile devices (rejected: degrades feature parity for mobile-first Iranian traders).
- **Evidence**: `client/src/main.js:868-878`, `client/chart/index.html:50-56`, `tests/qa_iran_and_sources_deep.cjs:196-256`.

## R10. Asymmetric entitlement gating strategy (Vela dock drawer vs bottom panel)

- **Decision**: Enforce plan feature checks (`this.auth.feature('marketTrackers')`, `this.auth.feature('economicCalendar')`, `this.auth.feature('marketNews')`) when mounting views into the Vela right-dock side drawer (`mountMarketTrackers`, `mountEconomicCalendar`, `mountMarketNews`), displaying a locked upgrade card (`renderFeatureLocked`) if the user lacks entitlement. Leave bottom-panel tab mounts (`#view-trackers`, `#view-calendar`, `#view-news`) and REST API routes ungated.
- **Rationale**: Historical artifact of phased rollout. The bottom-panel views were initially created as open diagnostic and research tools. Later, during Vela WebGL2 workspace side-panel integration, plan gating checks were introduced to protect side-dock drawer features.
- **Alternatives considered**:
  - Gating bottom panels immediately (rejected during retrofit: would break backwards compatibility for existing free users before normative architect convergence).
  - Gating REST APIs with session tokens (rejected during retrofit: requires breaking API changes for unauthenticated clients; tracked for Converge resolution).
- **Evidence**: `client/src/main.js:319-347, 490-546`, `server/featuresCatalog.js:350-384`, `server/data/accounts/plans.json:55, 95, 167, 207, 279, 319, 391, 431, 503, 543`.

---

## Spec/code mismatches

- **FR-009**: Unknown TSE symbols with valid alphanumeric syntax return an algorithmically simulated fallback tape (`{ base: 5000, name: clean }`) rather than `400 invalid_symbol` (which is only returned when symbol regex validation fails), in `server/index.js:147` and `server/dataFeed.js:269`.
- **FR-006**: `MarketNewsView` polling timer (15s) is created on instantiation in `client/src/marketNewsView.js:27`, but `client/src/main.js:1670-1675` (`switchBottomView`) only calls `unmount()` on `goldBubbleView` and `tseTapeView`; it never invokes `marketNews.destroy()`, leaving background polling active across bottom tab switches.
- **FR-011**: Inconsistent plan entitlement gating: `main.js:319-347` mounts bottom-panel `#view-trackers`, `#view-calendar`, and `#view-news` without checking `auth.feature()`, and `server/index.js:153, 164, 189` exposes REST routes anonymously; entitlement checks are only enforced on side-dock drawer mounts in `main.js:491, 505, 538`.
- **FR-004**: `EconomicCalendarView.init()` in `client/src/economicCalendar.js:20-23` performs a redundant re-render by awaiting `fetchEvents()` (which already invokes `this.render()` in its `finally` block at line 36) and then immediately calling `this.render()` again.
- **FR-013**: Untranslated accessibility attributes remain in English in Persian mode: `aria-label="Congressional Stock Trades"`, `aria-label="SEC Form 4 Insider Trades"`, `aria-label="Hedge Fund 13F Portfolios"`, and `aria-label="FINRA Short Sale Volume"` in `client/src/marketTrackersView.js:37,40,43,46`; `aria-label="Switch Chart to ${item.symbol}"` in `client/src/marketNewsView.js:163`; `title="Refresh Calendar"` in `client/src/economicCalendar.js:67`; and HTML modal shell title `#sources-modal-title` in `client/chart/index.html:647`.
- **FR-001 / FR-003 / FR-005 / FR-007 / FR-009**: Data provenance relies on static in-memory catalogs (`server/marketTrackers.js`, `server/newsFeed.js`, `server/economicCalendar.js`) and mathematical simulation formulas (`server/dataFeed.js`) rather than live exchange and regulatory upstreams, as documented in spec assumptions.
