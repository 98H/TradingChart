# Client Module Contract: Landing Page Runtime (`client/landing/landing.js`)

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](../spec.md)

This contract specifies the internal JavaScript interfaces, state variables, localization dictionaries, and DOM event bindings implemented in `client/landing/landing.js`.

---

## 1. Module State & Storage Constants

### 1.1 `LS_KEY`
- **Type**: `string`
- **Value**: `'tradingchart_user_settings'`
- **Description**: Browser `localStorage` key shared between the marketing landing page and the trading application (`/chart`). Stores the serialized JSON object containing user interface settings (`{ language: 'fa' | 'en' }`).

### 1.2 Module-Scoped State Variables
- `lang` (`'fa' | 'en'`): Current active interface language. Initialized via `pickLang()`, defaults to `'fa'`.
- `cycle` (`'m' | 'y'`): Selected billing cycle. `'m'` for monthly, `'y'` for yearly (with 2 months free). Default `'m'`.
- `plansData` (`{ plans: Record<string, Plan>, planOrder: string[] } | 'error' | null`): In-memory cache of plan definitions fetched from `GET /api/plans`. Initialized to `null`.
- `faOriginal` (`Map<Element | 'title', string>`): In-memory cache preserving original Persian text content and attributes from HTML elements, guaranteeing lossless round-trip language switching.

---

## 2. Localization Dictionaries & Formatters

### 2.1 `EN` Dictionary Object
Complete English translation strings and dynamic pluralization functions covering all landing page sections:
- Section headings: `heroTitle`, `featTitle`, `mkTitle`, `prTitle`, `faqTitle`, `ctaTitle`.
- Nav links & CTA buttons: `navFeatures`, `navMarkets`, `navPricing`, `navFaq`, `ctaOpen`, `ctaStart`, `ctaPlans`.
- Pricing & Features:
  - `free`: `'Free'`
  - `mo`: `'/mo'`
  - `yr`: `'/yr'`
  - `popular`: `'Most popular'`
  - `choose`: `'Get started'`
  - `current`: `'Start free'`
  - `charts(n)`: `n => `${n} ${n === 1 ? 'chart' : 'charts'} per layout``
  - `inds(n)`: `n => `${n} indicators per chart``
  - `alerts(n)`: `n => `${n} price alerts``
  - `bars(n)`: `n => `${n.toLocaleString('en-US')} historical bars``
  - `paper(n)`: `n => `${n} paper ${n === 1 ? 'account' : 'accounts'}``
  - `webhook`: `'Webhook alerts'`
  - `backtest`: `'Deep backtesting'`
  - `loadErr`: `'Pricing could not be loaded. Open the chart to see plans.'`

### 2.2 `FA_FN` Dictionary Object
Persian translation strings and formatting functions:
- `free`: `'رایگان'`
- `mo`: `'/ماه'`
- `yr`: `'/سال'`
- `popular`: `'محبوب‌ترین'`
- `choose`: `'شروع کنید'`
- `current`: `'شروع رایگان'`
- `charts(n)`: `n => `${FA_DIGITS(n)} نمودار در هر چیدمان``
- `inds(n)`: `n => `${FA_DIGITS(n)} اندیکاتور در هر نمودار``
- `alerts(n)`: `n => `${FA_DIGITS(n)} هشدار قیمت``
- `bars(n)`: `n => `${FA_DIGITS(n.toLocaleString('en-US')).replace(/,/g, '٬')} کندل تاریخی``
- `paper(n)`: `n => `${FA_DIGITS(n)} حساب معاملات کاغذی``
- `webhook`: `'هشدار وب‌هوک'`
- `backtest`: `'بک‌تست عمیق'`
- `loadErr`: `'بارگذاری قیمت‌ها ممکن نشد. برای مشاهده پلن‌ها وارد نمودار شوید.'`

### 2.3 `FA_DIGITS(s: string | number): string`
Converts ASCII digits `0-9` into standard Persian glyphs `۰-۹`:
`s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])`.

---

## 3. Core Functions

### 3.1 `pickLang(): 'fa' | 'en'`
Resolves the initial language preference on page initialization.
- **Priority**:
  1. URL query parameter: `?lang=en` or `?lang=fa`.
  2. Stored preference: `JSON.parse(localStorage.getItem(LS_KEY)).language`.
  3. Browser preference: `navigator.language` (falls back to `'fa'`).
- **Returns**: `'fa'` or `'en'`.

### 3.2 `applyLang(l: 'fa' | 'en'): void`
Applies language switch across the entire document.
- **Operations**:
  1. Sets module variable `lang = l`.
  2. Updates root element attributes: `document.documentElement.lang = l` and `dir = (l === 'fa' ? 'rtl' : 'ltr')`.
  3. Re-localizes all elements matching `[data-i18n]` using `EN` or cached `faOriginal`.
  4. Re-localizes all elements matching `[data-i18n-aria]` accessibility labels.
  5. Updates `document.title` and `#lang-toggle` button text (`'EN'` in FA mode, `'فا'` in EN mode) and `aria-label` (`'English'` in FA mode, `'فارسی'` in EN mode).
  6. Persists language choice to `localStorage[LS_KEY]`.
  7. Invokes `renderPlans()` to refresh pricing cards.

### 3.3 `loadPlans(): Promise<void>`
Fetches plan catalog from `GET /api/plans`.
- **Headers**: `credentials: 'same-origin'`.
- **Success Handling**: Sets `plansData = { plans: d.plans, planOrder: d.planOrder.filter(...) }` filtering out inactive plans (`isActive !== false`).
- **Failure Handling**: Catches exceptions and sets `plansData = 'error'`.
- **Termination**: Invokes `renderPlans()`.

### 3.4 `renderPlans(): void`
Renders pricing cards into `#plans`.
- **Empty/Error States**:
  - If `plansData === 'error'`, renders `<p class="note center">${T('loadErr')}</p>`.
- **Hydration Rules**:
  - Loops over `planOrder`.
  - Determines plan name: `p.nameFa` (FA) or `p.nameEn` (EN).
  - Determines price: `cycle === 'y' ? p.priceYearlyUSD : p.priceUSD`.
  - Detects `id === 'plus'` to add `.pop` class and `<span class="badge">${T('popular')}</span>`.
  - Replaces quota values of `-1` with `"نامحدود"` / `"Unlimited"`.
  - Renders CTA button `<a class="btn" href="/chart">` labeled `"شروع رایگان"` / `"Start free"` for $0 or `"شروع کنید"` / `"Get started"` for paid tiers.

### 3.5 Utility Functions
- `T(k: string)`: Returns translation string or formatting function based on active `lang`.
- `esc(s: any): string`: HTML-escapes `&`, `<`, `>`, `"`, and `'`.
- `money(v: number): string`: Formats numeric price with commas/decimals and converts to Persian digits in FA mode.

---

## 4. DOM Events & Bindings

### 4.1 Language Toggle
- **Target**: `#lang-toggle`
- **Event**: `click`
- **Handler**: Toggles between `'fa'` and `'en'`: `applyLang(lang === 'fa' ? 'en' : 'fa')`.

### 4.2 Billing Cycle Switcher
- **Target**: `.cyc` buttons (`[data-cycle="m"]` and `[data-cycle="y"]`)
- **Event**: `click`
- **Handler**:
  1. Sets module variable `cycle = b.dataset.cycle`.
  2. Updates `.on` CSS class and `aria-pressed="true"` / `aria-pressed="false"`.
  3. Re-renders pricing cards via `renderPlans()`.

### 4.3 Keyboard Skip Link
- **Target**: `.skip` (`href="#main"`)
- **Behavior**: Hidden offscreen (`top: -60px`). Slides into view on keyboard focus (`top: 12px`), allowing keyboard users to bypass navigation header directly to `#main`.

### 4.4 Dynamic Copyright Year
- **Target**: `#year`
- **Execution**: On script load, sets `document.getElementById('year').textContent = String(new Date().getFullYear())`.
