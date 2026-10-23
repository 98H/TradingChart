# Feature Specification: Chart Workspace Shell

**Feature Branch**: `001-chart-workspace-shell` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Give traders a TradingView-class chart workspace: find any market fast, switch timeframe and chart style, control the price scale, keep watchlists, compare symbols, export data and screenshots, all with keyboard shortcuts, in English and Persian, on desktop and mobile — honest about what each plan allows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and open a market (Priority: P1)

A trader opens the symbol search from the chart's symbol widget or with Ctrl+K, types part of a ticker or name (English or Persian), moves through results with the arrow keys and presses Enter; the active chart switches to that market.

**Why this priority**: Without switching markets the chart is useless.

**Independent Test**: Open the search, type "ETH", press Enter, and confirm the chart and its header show ETHUSDT with candles loaded.

**Acceptance Scenarios**:

1. **Given** the chart page, **When** the user clicks the symbol widget, **Then** the symbol search dialog opens with the search input focused.
2. **Given** the search dialog, **When** the user types a query, **Then** only catalogue entries matching symbol, name or Persian name are listed.
3. **Given** a result list, **When** the user presses ArrowDown and Enter, **Then** the dialog closes and the active chart loads the highlighted symbol.

---

### User Story 2 - Change timeframe and chart style (Priority: P1)

A trader opens the timeframe picker (topbar or ",") and the chart-style menu, and switches interval and style (candles, bars, Heikin Ashi, line, area, baseline, and synthetic types such as Renko or Kagi).

**Why this priority**: Timeframe and style are used on every session.

**Independent Test**: Switch to 1h and to Bars; confirm the chart and topbar labels change; pick a synthetic style on a plan without it and see the upgrade dialog instead.

**Acceptance Scenarios**:

1. **Given** the chart, **When** the user selects an interval in the timeframe dialog, **Then** the active chart reloads candles at that interval and the topbar shows it.
2. **Given** a plan without `secondIntervals` or `customIntervals`, **When** the user picks a seconds interval or creates a custom interval, **Then** the change is refused and the plans dialog opens.
3. **Given** the style menu, **When** the user picks a style, **Then** the price plot uses it, the topbar label and icon change, and the choice survives a reload.
4. **Given** a plan without `synthChartTypes`, **When** the user picks a synthetic style, **Then** the style does not change and the plans dialog opens.

---

### User Story 3 - Control the price scale (Priority: P2)

A trader toggles Auto, Log, Percent and Invert scale modes from the scale dock or with Alt+R / Alt+I, and sees the countdown to the next candle close.

**Independent Test**: Toggle each scale button and confirm its active state and the chart's scale mode.

**Acceptance Scenarios**:

1. **Given** the chart, **When** the user clicks Log, Percent or Invert, **Then** the button becomes active and the active chart's price scale switches mode; clicking again restores it.
2. **Given** the chart, **When** the user presses Alt+R, **Then** the price scale returns to auto-fit.

---

### User Story 4 - Watchlists (Priority: P2)

A trader keeps one or more named watchlists in the side dock, adds and removes symbols, flags symbols with colours, sorts columns, and steps through symbols with Space / Shift+Space.

**Independent Test**: Create a list, add two symbols, flag one red, reload, and confirm the list, symbols and flag persist.

**Acceptance Scenarios**:

1. **Given** the watchlist panel, **When** the user creates a list beyond the plan's `watchlists` count, **Then** creation is refused and the plans dialog opens.
2. **Given** a list at the plan's `watchlistSymbols` limit, **When** the user adds a symbol, **Then** it is refused with the upgrade dialog.
3. **Given** a list, **When** the user presses Space, **Then** the chart switches to the next symbol in the list (Shift+Space: previous).
4. **Given** a plan whose `flagColors` is 1, **When** the user cycles a flag, **Then** only red is available.

---

### User Story 5 - Workspace tools and shortcuts (Priority: P2)

A trader uses the command palette (Ctrl/Cmd+K), the shortcuts reference (?), Go to date (Alt+G), chart settings, the right-click context menu, compare (Alt+C), data export (Alt+E) and screenshot (Alt+S).

**Independent Test**: Trigger each dialog by its shortcut and by its button; confirm it opens and closes with Escape.

**Acceptance Scenarios**:

1. **Given** the chart, **When** the user presses Ctrl+K, **Then** the command palette opens; typing filters actions and Enter runs the highlighted one.
2. **Given** the chart, **When** the user presses "?", **Then** the shortcuts dialog lists the shortcuts in three categories.
3. **Given** Go to date, **When** the user submits a date, **Then** the active chart's visible range moves to include that date.
4. **Given** a right-click on the price pane, **Then** a menu offers "Add Alert at X", "Buy Limit at X" and "Sell Limit at X" with X the price under the cursor.
5. **Given** a plan with `dataExport`, **When** the user exports, **Then** a CSV or JSON file of the loaded OHLCV bars downloads; without it, the plans dialog opens.
6. **Given** the screenshot dialog, **Then** it offers Download PNG, Print, Embed, Copy share link and Copy post text, and the PNG contains the chart canvases.
7. **Given** compare, **When** the user adds a benchmark symbol, **Then** an overlay shows it on the active chart (percent return or price).

---

### User Story 6 - Language, sound and platform announcements (Priority: P3)

A trader switches FA/EN, mutes sounds, and sees a dismissible platform announcement set by the admin.

**Acceptance Scenarios**:

1. **Given** English, **When** the user clicks FA/EN, **Then** the document direction becomes rtl, Persian fonts apply and all shell labels re-render in Persian without reload; switching back restores ltr English.
2. **Given** sound on, **When** the user clicks the sound button, **Then** sounds are muted and the setting persists.
3. **Given** an active announcement from `GET /api/platform`, **Then** a banner shows its text in the current language with a close button; once dismissed, the same announcement (same `updatedAt`) does not show again.

---

### Edge Cases

- A symbol with no market data → the chart shows an empty state instead of failing (API behaviour in 005).
- Corrupted localStorage profile or settings JSON → defaults are used, the app still starts.
- Browser blocks audio autoplay → app continues silently.
- Mobile (≤ 768 px): side dock is an off-canvas drawer; topbar controls remain reachable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The symbol search MUST open from the symbol widget, focus its input, filter the catalogue by symbol, English name and Persian name, support ArrowUp/ArrowDown/Enter, and switch the active chart to the chosen symbol.
- **FR-002**: The symbol search MUST query the symbol catalogue API (contract owned by 005-market-data-feed) and show the result count.
- **FR-003**: Switching symbol or interval MUST load the active chart's candles through the market-data provider (005); the number of bars available MUST follow the caller's plan `histBars` cap enforced by the server (005).
- **FR-004**: Symbol headers and watchlist rows MUST show last price and 24 h change from the ticker API (005).
- **FR-005**: The active chart's latest candle MUST update in real time from the live stream (005) while the page is open.
- **FR-006**: The timeframe dialog (topbar or ",") MUST switch the active chart's interval; seconds intervals MUST require `secondIntervals` and custom intervals MUST require `customIntervals`, otherwise the plans dialog opens; custom intervals MUST persist on the device.
- **FR-007**: The style menu MUST offer candles, bars, Heikin Ashi, line, area, baseline and the synthetic types (Renko, Kagi, Line Break, Range, Point & Figure, Hollow, Volume); synthetic types MUST require `synthChartTypes`; the chosen style MUST persist across reloads.
- **FR-008**: The scale dock MUST toggle Auto, Log, Percent and Invert on the active chart with an active-state indicator; Alt+R MUST auto-fit and Alt+I MUST invert; a countdown to the current candle close MUST be shown when enabled in settings.
- **FR-009**: Watchlists MUST support multiple named lists with an active list, add/remove symbols, colour flags, sortable columns and Space / Shift+Space stepping; the number of lists, symbols per list and flag colours MUST be limited by `watchlists`, `watchlistSymbols` and `flagColors`, opening the plans dialog when exceeded; lists and flags MUST persist on the device.
- **FR-010**: The command palette MUST open with Ctrl+K / Cmd+K, index symbols, timeframes, styles, tools and panels, filter by typed text and execute the highlighted entry with Enter.
- **FR-011**: The shortcuts dialog MUST open with "?" or its topbar button and list shortcuts in three categories.
- **FR-012**: Go to date (Alt+G or context menu) MUST move the active chart's visible range to the submitted date.
- **FR-013**: Chart settings MUST provide four tabs (Appearance, Scales & Grid, Trading & Audio, System & Language) and persist saved values in `tradingchart_user_settings`, applying them to the workspace.
- **FR-014**: Right-click on the price pane MUST open a context menu with "Add Alert at X", "Buy Limit at X" and "Sell Limit at X" (X = price under the cursor); right-click on the price scale and on a drawing MUST open their own menus.
- **FR-015**: Data export (button or Alt+E) MUST download the loaded OHLCV bars as CSV or JSON and MUST require `dataExport`, otherwise the plans dialog opens.
- **FR-016**: The screenshot dialog (widget or Alt+S) MUST composite all chart canvases into one image and offer Download PNG, Print, Embed, Copy share link and Copy post text.
- **FR-017**: Compare (button or Alt+C) MUST add and remove benchmark overlays on the active chart in percent-return or price mode.
- **FR-018**: The side-dock toggle MUST show/hide the right dock (desktop offset 340 px); the Quant/Journal navigation MUST switch between the chart area and the journal workspace.
- **FR-019**: The FA/EN toggle MUST switch language, document direction (rtl/ltr) and fonts, and re-render every shell label, dialog and the platform banner without reload; the choice MUST persist.
- **FR-020**: The sound toggle MUST mute/unmute all app sounds, show the state visually and persist it.
- **FR-021**: `GET /api/platform` MUST return `{ok, registrationOpen, announcement|null, emailDelivery}`; an active announcement MUST render as a banner in the current language with a close control, and a dismissed announcement MUST stay hidden until its `updatedAt` changes.
- **FR-022**: `GET /api/health` MUST return `{status: "online", product: "Chartivia", timestamp}`.
- **FR-023**: Corrupt localStorage values for profile, settings or deep-link parameters MUST NOT prevent the app from starting; defaults MUST be used.
- **FR-024**: On viewports ≤ 768 px the side dock MUST open as an off-canvas drawer and every shell control of this feature MUST remain reachable.

### Key Entities

- **Instrument**: catalogue entry — symbol, EN/FA names, Persian ticker, category, exchange, base/quote, display order.
- **Candle**: time, open, high, low, close, volume.
- **Ticker**: 24 h statistics for one symbol.
- **User Settings**: theme, colours, watermark, grid, scale mode, timezone, language, sound, order confirmation, countdown.
- **Watchlist Set**: active list id and named lists of symbols; per-symbol colour flags.
- **Custom Timeframe**: id, label, EN/FA names.
- **Platform Announcement**: id, level (info/warning/success), EN/FA text, updatedAt.
- **Plan Entitlements used here**: `histBars`, `secondIntervals`, `customIntervals`, `synthChartTypes`, `dataExport`, `compareSymbol`, `watchlists`, `watchlistSymbols`, `flagColors`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch the active chart to any catalogue symbol in at most 3 interactions (open search, type, Enter).
- **SC-002**: 100% of plan-gated actions in this feature (seconds/custom intervals, synthetic styles, data export, list/symbol/flag limits) open the plans dialog instead of performing the action when the entitlement is missing.
- **SC-003**: After a symbol or interval switch the active chart shows candles of the new market within 5 s in 100% of runs on live data.
- **SC-004**: Every shortcut listed in FR-008 to FR-017 opens its target within 1 s.
- **SC-005**: Switching language re-renders all shell labels with zero untranslated user-facing strings and zero console errors on desktop and mobile.
- **SC-006**: Shell suites (symbol search, palette, scales, cycle A/B) report zero defects.

## Assumptions

- Chart rendering, panes and scale mechanics come from the chart engine; this feature configures and exposes them.
- Plan gates other than `histBars` are mirrored client-side; server-side enforcement of watchlist, flag and export limits is a known gap tracked for the Converge phase, not a requirement of the current behaviour.
- Market-data HTTP/WebSocket contracts, sources and fallbacks are owned by 005-market-data-feed; multi-chart layouts in 002; drawing tools in 003; i18n/RTL details in 011.
