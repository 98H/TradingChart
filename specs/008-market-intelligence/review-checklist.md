# Review checklist — specs/008-market-intelligence

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

---

## Behaviour beyond the tests

- [ ] Clicking any `.news-sym-pill` repoints the active chart via `app.chartManager.setSymbol(sym)` and triggers a toast notification (`SYMBOL 1 <SYM>`).
- [ ] Clicking "Melted Gold Chart" or any coin "Chart" button in `GoldBubbleView` repoints the active chart via `app.switchSymbol(...)` and updates the topbar source badge to `TEHRAN GOLD DEMO`.
- [ ] Clicking "Open Symbol Chart" in `TseTapeView` loads the selected stock's candlestick chart via `app.switchSymbol(activeSymbol)`.
- [ ] Subtab switching in `MarketTrackersView` (Congress, Insider, 13F, Short Vol) preserves the active search query and filters records dynamically.
- [ ] Re-clicking an active filter pill in `EconomicCalendarView` (High Impact, USD, Central Banks, Inflation) toggles the filter off and returns to "All Events" (`'all'`).
- [ ] Searching in `MarketNewsView` with zero matching records displays the exact empty state: *"No headlines matched active filter."* / *"خبری مطابق با فیلتر جاری یافت نشد."*.
- [ ] Upcoming release highlight banner in `EconomicCalendarView` displays the earliest event whose `timestamp > Date.now()`.
- [ ] `TseTapeView` flags `smartMoneyInflow = true` whenever `buyerPowerRatio >= 1.25`, rendering the green lightning badge.
- [ ] `MarketSourcesModal` calculates average latency only across operational live feeds (`live: true` and `status: 'online'`), rendering `—` if degraded.
- [ ] Inactive bottom views tear down polling intervals cleanly: `switchBottomView` unmounts `goldBubbleView` and `tseTapeView` when navigating to another tab.

---

## Architecture boundaries

- [ ] Alternative data catalogs (`CONGRESSIONAL_TRADES`, `INSIDER_TRADES`, `HEDGE_FUND_13F`, `FINRA_SHORT_VOLUME`) reside exclusively in `server/marketTrackers.js`.
- [ ] Real-time breaking news items and filtering helpers reside in `server/newsFeed.js`.
- [ ] Macroeconomic calendar events and filtering logic reside in `server/economicCalendar.js`.
- [ ] Tehran gold intrinsic/bubble math and TSETMC algorithmic tape simulation reside in `server/dataFeed.js`.
- [ ] REST API routes for market intelligence are mounted in `server/index.js` under `/api/`.
- [ ] Client views (`MarketTrackersView`, `MarketNewsView`, `EconomicCalendarView`, `GoldBubbleView`, `TseTapeView`, `MarketSourcesModal`) maintain isolated instance state without global pollution.
- [ ] Right-dock side panel definitions are registered exclusively through `registerSidePanel` in `client/src/velaPanels.js`.
- [ ] Entitlements are declared in `server/featuresCatalog.js` and defined in `server/data/accounts/plans.json`.

---

## Forbidden shortcuts

- [ ] No branches on test inputs, test environment flags (`NODE_ENV === 'test'`), or user-agent sniffing in production logic.
- [ ] No hardcoded or fabricated latency numbers in Market Sources; latency metrics must derive from live network probes to Binance Vision ping.
- [ ] Synthetic and modelled demo feeds are explicitly disclosed to users next to values (`DEMO DATA` / `داده نمایشی`).
- [ ] Background polling timers (15s News, 4s Gold, 3s TSE) must check `!document.hidden` before issuing network requests.
- [ ] No new third-party dependencies added and no modifications made to files under `node_modules/`.

---

## Copy and UX (only items tests cannot see)

- [ ] Persian copy follows uniform formal respectful register with zero informal imperatives.
- [ ] Persian numerals (`toPersianDigits`) are applied to figures, prices, and percentages in FA mode.
- [ ] Numbers, prices, ticker symbols, and percentages maintain strict LTR orientation inside RTL layouts (`.num-ltr`, `<bdi>`, `dir="ltr"`).
- [ ] Interactive touch targets meet or exceed 36-44px across all chips, subtabs, filter pills, and icon buttons.
- [ ] Modals and bottom panels fit cleanly within 390px mobile viewports without horizontal scrolling or layout clipping.
