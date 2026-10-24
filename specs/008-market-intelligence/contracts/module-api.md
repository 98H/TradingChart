# Client Module API Contract: Market Intelligence

Internal module contracts, class interfaces, lifecycle methods, and coordination hooks across the client-side Market Intelligence components.

---

## 1. `MarketTrackersView` (`client/src/marketTrackersView.js`)

Viewer component for US alternative data disclosures (Congressional Trades, SEC Form 4 Insiders, Hedge Fund 13F, FINRA Short Volume).

```javascript
import { MarketTrackersView } from './marketTrackersView.js';

const trackers = new MarketTrackersView({
  container: HTMLElement // Required: parent DOM container element
});
```

### Public Methods
- `constructor(options = {})`: Initializes instance properties, sets `activeSubTab = 'congress'`, renders the skeleton UI, and triggers `fetchData()`.
- `async fetchData()`: Sends `GET /api/market-trackers`, parses response payload into `this.data`, and invokes `updateContent()`.
- `render()`: Reconstructs the outer wrapper, sample data disclaimer banner, 4 sub-tab buttons (`.subtab-btn`), text search input (`#tracker-filter-input`), and body container (`#tracker-body-area`).
- `updateContent()`: Evaluates the active sub-tab and current `searchQuery`, generating and inserting matching HTML tables or fund card grids into `#tracker-body-area`.

### Instance Properties
- `container` (`HTMLElement`): Host DOM container.
- `data` (`object | null`): Latest JSON payload from `/api/market-trackers`.
- `activeSubTab` (`'congress' | 'insider' | '13f' | 'short_vol'`): Active subtab identifier (default: `'congress'`).
- `searchQuery` (`string`): Lowercase query string filtering table rows across all columns.

### DOM Events Handled
- Subtab click (`.subtab-btn`): Switches `this.activeSubTab`, toggles `.active` class, and triggers `updateContent()`.
- Search input (`#tracker-filter-input`): Updates `this.searchQuery` on `input` event and re-filters visible records.

---

## 2. `MarketNewsView` (`client/src/marketNewsView.js`)

Real-time breaking market news and macro catalyst feed with category filtering, sentiment tagging, and 1-click chart symbol switching.

```javascript
import { MarketNewsView } from './marketNewsView.js';

const newsView = new MarketNewsView({
  container: HTMLElement, // Required: host container
  app: Object             // Optional: Chartivia application coordinator instance
});
```

### Public Methods
- `constructor(options = {})`: Binds container and app references, sets `currentCategory = 'all'`, renders DOM structure, fetches initial news, and initiates 15-second polling timer.
- `startPolling()`: Initiates a 15,000 ms `setInterval` that triggers `this.fetchNews(true)` whenever `!document.hidden`.
- `destroy()`: Clears `this.pollTimer` to dismantle background polling.
- `async fetchNews(silent = false)`: Fetches `/api/news?category=${this.currentCategory}&limit=30`, saves items to `this.newsItems`, and triggers `updateNewsList()`.
- `render()`: Builds news header strip, category filter pills (`.news-cat-btn`), search input (`#news-search-input`), and feed list container (`#news-items-container`).
- `renderLocalized()`: Re-renders the component to apply language updates (`this.render()`).
- `bindEvents()`: Attaches click listeners to category pills and input listener to `#news-search-input`.
- `updateNewsList()`: Filters `this.newsItems` against `searchQuery` across English/Persian title, summary, and ticker symbol; renders news feed cards or empty-state message.

### Instance Properties
- `container` (`HTMLElement`): Host DOM container.
- `app` (`Object | null`): Application coordinator reference.
- `currentCategory` (`string`): Selected category (`'all'`, `'crypto'`, `'metals'`, `'forex'`, `'equities'`, `'commodities'`).
- `searchQuery` (`string`): Lowercase search string.
- `newsItems` (`NewsItem[]`): In-memory list of fetched articles.
- `pollTimer` (`number | null`): Active interval ID returned by `setInterval`.

### Application Interactions
- Symbol pill click (`.news-sym-pill`): Invokes `this.app.chartManager.setSymbol(sym)` to repoint the active candlestick chart, followed by `this.app.showExecutionToast('SYMBOL', 1, sym)`.

---

## 3. `EconomicCalendarView` (`client/src/economicCalendar.js`)

Macroeconomic release calendar featuring impact filters, countdown banner for the next release, and deviation analysis.

```javascript
import { EconomicCalendarView } from './economicCalendar.js';

const calendar = new EconomicCalendarView({
  container: HTMLElement // Required: host container
});
```

### Public Methods
- `constructor(options = {})`: Initializes state filters, sets `isLoading = true`, and calls `init()`.
- `async init()`: Awaits `fetchEvents()` and calls `render()`.
- `async fetchEvents()`: Fetches `/api/economic-calendar`, populates `this.events`, sets `isLoading = false`, and triggers `render()`.
- `render()`: Calculates next upcoming release (`e.timestamp > Date.now()`), applies impact/country/category/search filters, and renders the header strip, filter pills, highlight banner, event card list, and telemetry footer.
- `bindEvents()`: Binds click handlers to `#btn-refresh-calendar` and `.cal-filter-btn` pills, plus input handler on `#calendar-search-input` (preserving cursor focus).

### Instance Properties
- `container` (`HTMLElement`): Host DOM container.
- `events` (`EconomicEvent[]`): In-memory array of economic releases.
- `filterImpact` (`string`): Active impact filter (`'all'`, `'high'`, `'med'`, `'low'`).
- `filterCategory` (`string`): Active category filter (`'all'`, `'central bank'`, `'inflation'`, etc.).
- `filterCountry` (`string`): Active country filter (`'all'`, `'US'`, etc.).
- `searchQuery` (`string`): Active text query matching English event, Persian event, or currency.
- `isLoading` (`boolean`): Fetch in-progress state.
- `nextEventTimer` (`null`): Reserved unused property.

---

## 4. `GoldBubbleView` (`client/src/goldBubbleView.js`)

Tehran gold bullion quotes (17k Abshodeh, 18k Gram) and official coin bubble calculation studio.

```javascript
import { GoldBubbleView } from './goldBubbleView.js';

const goldView = new GoldBubbleView({
  container: HTMLElement, // Required: host container
  app: Object             // Optional: Application coordinator instance
});
```

### Public Methods
- `constructor(options = {})`: Sets up state, calls `render()`, and performs initial `fetchData()`.
- `mount()`: Fetches fresh data and starts a 4-second polling timer (`setInterval`) that runs while `!document.hidden`.
- `unmount()`: Clears active `pollInterval` (`clearInterval`) and resets timer to `null`.
- `async fetchData(silent = false)`: Queries `/api/gold-snapshot`, assigns `this.data`, and calls `updateUI()`.
- `formatToman(num)`: Formats number with thousands separators, converting to Persian digits in Persian mode.
- `formatUsd(num)`: Formats float to 2 decimal places with Persian digits in Persian mode.
- `render()`: Renders header strip, refresh button, "Melted Gold Chart" button, `#gold-cards-grid`, and `#gold-coins-tbody`.
- `bindEvents()`: Binds click handlers for `#btn-gold-refresh` and `#btn-chart-abshodeh`.
- `updateUI()`: Populates the 4 pillar cards (Abshodeh 17k, 18k Gram, Spot Ounce, Free USD/Nobitex USDT) and updates the 5 coin bubble table rows with dynamic color badges and "Chart" buttons.

### Instance Properties
- `container` (`HTMLElement`): Host DOM container.
- `app` (`Object | null`): Application coordinator reference.
- `data` (`GoldSnapshot | null`): Latest server snapshot.
- `pollInterval` (`number | null`): 4-second polling interval ID.
- `isLoading` (`boolean`): Request lock preventing overlapping fetches.

### Application Interactions
- `#btn-chart-abshodeh` click: Invokes `this.app?.switchSymbol?.('GOLD_ABSHODEH')`.
- `.btn-open-coin-chart` click: Invokes `this.app?.switchSymbol?.(sym)` with the target coin symbol (`COIN_EMAMI`, `COIN_BAHAR`, etc.).

---

## 5. `TseTapeView` (`client/src/tseTapeView.js`)

Tehran Stock Exchange (TSETMC) microstructure tape, retail vs institutional volume distribution, and smart money inspector.

```javascript
import { TseTapeView } from './tseTapeView.js';

const tseView = new TseTapeView({
  container: HTMLElement, // Required: host container
  app: Object             // Optional: Application coordinator instance
});
```

### Public Methods
- `constructor(options = {})`: Default `activeSymbol = 'FOOLAD'`, calls `render()`, and fetches initial data.
- `mount()`: Fetches fresh data and starts a 3-second polling timer (`setInterval`) guarded by `!document.hidden`.
- `unmount()`: Clears active `pollInterval` (`clearInterval`) and resets timer to `null`.
- `setSymbol(sym)`: Cleans and assigns new ticker (e.g. `'FAMELI'`), updates chip styling via `renderActiveSymbolChip()`, and calls `fetchData()`.
- `async fetchData(silent = false)`: Queries `/api/tse-tape?symbol=${this.activeSymbol}`, assigns `this.data`, and calls `updateUI()`.
- `formatNum(num)`: Rounds and formats number with thousands separators and Persian digit localization.
- `render()`: Renders header strip, 8 quick-switch symbol chips (`.tse-sym-chip`), `#tse-tape-scoreboard` grid, and `#tse-tape-details` volume distribution card.
- `renderActiveSymbolChip()`: Updates text in `#tse-active-sym-title` and synchronizes `.active` CSS class and border colors on chip buttons.
- `bindEvents()`: Binds symbol chips, refresh button `#btn-tse-refresh`, and chart load button `#btn-tse-load-chart`.
- `updateUI()`: Renders 4 scoreboard cards (Last Price, Buyer Power Ratio, Per-Capita Buy/Sell, Suspicious Volume & Queue) and updates the retail vs institutional volume distribution progress bar.

### Instance Properties
- `container` (`HTMLElement`): Host DOM container.
- `app` (`Object | null`): Application coordinator reference.
- `activeSymbol` (`string`): Currently inspected ticker symbol (default: `'FOOLAD'`).
- `data` (`TseTapeData | null`): Latest server tape payload.
- `pollInterval` (`number | null`): 3-second polling interval ID.
- `isLoading` (`boolean`): Request lock preventing overlapping fetches.

### Application Interactions
- `#btn-tse-load-chart` click: Invokes `this.app?.switchSymbol?.(this.activeSymbol)`.

---

## 6. `MarketSourcesModal` (`client/src/marketSourcesModal.js`)

Multi-tier market data waterfall telemetry inspector modal displaying live Binance connectivity, ping latency, and demo data disclosures.

```javascript
import { MarketSourcesModal } from './marketSourcesModal.js';

const sourcesModal = new MarketSourcesModal({
  app: Object // Optional: Application coordinator instance
});
```

### Public Methods
- `constructor(options = {})`: Locates `#modal-market-sources` in DOM and runs `init()`.
- `init()`: Binds modal backdrop click, close button `#modal-close-sources`, and ping refresh `#btn-sources-refresh-ping`.
- `open()`: Adds `.open` class to `#modal-market-sources` and initiates `fetchSources()`.
- `close()`: Removes `.open` class from `#modal-market-sources`.
- `async fetchSources()`: Fetches `/api/market-sources`, assigns `this.data`, and calls `renderContent()`.
- `renderContent()`: Renders live telemetry banner with pulse dot, average latency metric, "Ping Test" button, 5 waterfall source cards (`.source-card`), and failover architecture description.

### Instance Properties
- `app` (`Object | null`): Application coordinator reference.
- `modalEl` (`HTMLElement | null`): The `#modal-market-sources` modal overlay element.
- `data` (`MarketSourceStatus | null`): Latest payload from `/api/market-sources`.

---

## 7. Application Shell Coordination (`client/src/main.js` & `client/src/velaPanels.js`)

### Bottom Panel Mounting & Teardown Lifecycle
In `client/src/main.js`:
- `initDesktopBottomSuite()`: Instantiates bottom panel views:
  ```javascript
  this.marketTrackers = new MarketTrackersView({ container: document.querySelector('#view-trackers') });
  this.economicCalendar = new EconomicCalendarView({ container: document.querySelector('#view-calendar') });
  this.marketNews = new MarketNewsView({ container: document.querySelector('#view-news'), app: this });
  this.goldBubbleView = new GoldBubbleView({ container: document.querySelector('#view-gold'), app: this });
  this.tseTapeView = new TseTapeView({ container: document.querySelector('#view-tse'), app: this });
  ```
- `switchBottomView(viewName)`:
  - Toggles `.active` classes on `.panel-tab` and `.panel-view`.
  - Unmounts inactive polling views:
    ```javascript
    if (viewName !== 'gold') this.goldBubbleView?.unmount?.();
    if (viewName !== 'tse') this.tseTapeView?.unmount?.();
    ```
  - Mounts active polling views:
    ```javascript
    if (viewName === 'gold') this.goldBubbleView?.mount?.();
    if (viewName === 'tse') {
      this.tseTapeView?.mount?.();
      if (this.currentSymbol) this.tseTapeView?.setSymbol?.(this.currentSymbol);
    }
    ```
- `toggleBottomPanel(forceCollapse)`: When collapsed, calls `unmount()` on both `goldBubbleView` and `tseTapeView`. When uncollapsed, mounts whichever view is currently active.

### Right-Dock Side Drawer Panel Registration
In `client/src/velaPanels.js` and `client/src/main.js`:
- Side panels registered via `registerSidePanel`:
  - `trackers`: width 440px, order 120, mounts `app.mountMarketTrackers(body)`.
  - `calendar`: width 420px, order 130, mounts `app.mountEconomicCalendar(body)`.
  - `news`: width 440px, order 140, mounts `app.mountMarketNews(body)`.
- Entitlement checks in `main.js`:
  ```javascript
  mountMarketTrackers(body) {
    if (this.auth && !this.auth.feature('marketTrackers')) {
      this.renderFeatureLocked(body, 'marketTrackers', 'Institutional Trackers', 'دیده‌بان معامله‌گران نهادی');
      return;
    }
    new MarketTrackersView({ container: body });
  }
  ```

### Topbar Source Badge Telemetry
In `client/src/main.js`:
- `updateTopbarSourceBadge(symbol)`: Inspects active symbol category and updates `#topbar-source-label` and `#topbar-source-route`.
  - For crypto symbols: displays `BINANCE` in green with `LIVE` (`زنده`) route tag.
  - For non-crypto symbols (Tehran Gold, TSE Bourse, Forex, Commodities, US Stocks): displays category name with `DEMO` (`نمایشی`) route tag and yellow/orange/cyan palette.
  - Clicking `#btn-topbar-market-source` opens `this.marketSourcesModal.open()`.
