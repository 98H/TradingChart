# Data Model: Platform, Security and Landing Page

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document formalizes the data model for the Platform, Security, and Landing Page subsystem. It details all persistent, in-memory, and client-side entities specified in `specs/012-platform-security-landing/spec.md`, their concrete storage representations, field definitions, validation rules, constraints, and operational lifecycles.

---

## 1. Security Policy (`SecurityPolicy`)

Represents the declarative configuration governing HTTP response headers, cross-origin access rules, and request throttling thresholds enforced across the platform.

- **Storage**: Server memory and code configuration constants (`server/security.js`, `server/index.js`).
- **Fields**:
  - `cspDirectives` (`string[]`, required): Content-Security-Policy directives array joined by `'; '`:
    - `default-src`: `'self'`
    - `script-src`: `'self' 'unsafe-eval'` (eval permitted for PineTS runtime indicator compilation)
    - `style-src`: `'self' 'unsafe-inline'`
    - `img-src`: `'self' data: blob:`
    - `font-src`: `'self' data:`
    - `connect-src`: `'self' ws: wss:`
    - `media-src`: `'self' data: blob:`
    - `worker-src`: `'self' blob:`
    - `object-src`: `'none'`
    - `base-uri`: `'self'`
    - `form-action`: `'self'`
    - `frame-ancestors`: `'self'`
  - `securityHeaders` (`Record<string, string>`, required): Fixed security header mappings applied by `securityHeaders` middleware:
    - `X-Content-Type-Options`: `'nosniff'`
    - `X-Frame-Options`: `'SAMEORIGIN'` (overridden to `'DENY'` on `/admin`)
    - `Referrer-Policy`: `'strict-origin-when-cross-origin'` (overridden to `'no-referrer'` on `/admin`)
    - `Permissions-Policy`: `'camera=(), microphone=(), geolocation=(), payment=(), usb=()'`
    - `Cross-Origin-Opener-Policy`: `'same-origin-allow-popups'`
    - `Cross-Origin-Resource-Policy`: `'same-origin'`
    - `Strict-Transport-Security`: `'max-age=31536000; includeSubDomains'` (sent only when `req.secure === true`)
  - `corsAllowList` (`RegExp`, required): Regular expression defining public read-only market data endpoints permitted for CORS access:
    `/^\/api\/(candles|tickers|symbols|symbol-info|news|economic-calendar|screener|depth)$/`.
  - `apiMaxPerMin` (`number`, required): Per-IP sliding-window request limit, resolved from `process.env.TC_API_RATE_PER_MIN` or defaulting to `900`.
  - `maxWsClients` (`number`, required): Maximum concurrent WebSocket connections, resolved from `process.env.TC_MAX_WS` or defaulting to `2000`.
  - `bodyLimit` (`string`, required): Maximum allowed JSON payload size for incoming API requests (`'2.5mb'`).
- **Validation**:
  - `cspDirectives` must not allow `'unsafe-inline'` for `script-src` or wildcard `*` origins for `connect-src`.
  - `corsAllowList` matches only `GET` requests on whitelisted endpoints; mutations are strictly forbidden.
- **Limits**:
  - Global sliding rate limit: 900 requests per 60 seconds per IP.
  - WebSocket connection cap: 2000 concurrent client sockets.
- **Lifecycle**:
  - Evaluated on server initialization in `server/security.js` and `server/index.js`.
  - Applied to incoming requests via the Express middleware chain before endpoint execution.

---

## 2. Public Plan View (`PublicPlanView`)

The sanitized public view of platform subscription plans returned by `GET /api/plans` and rendered on the landing page pricing grid.

- **Storage**:
  - Persisted on server in `server/data/accounts/plans.json`.
  - Cached in server memory in `server/accounts.js:PLANS`.
  - Transmitted via HTTP JSON response to the client.
  - Stored in client landing page memory in `client/landing/landing.js:plansData`.
- **Fields**:
  - `id` (`string`, required): Unique plan identifier (e.g. `'basic'`, `'plus'`, `'pro'`, `'ultimate'`).
  - `nameEn` (`string`, required): English display title (e.g. `'Basic'`, `'Plus'`, `'Pro'`).
  - `nameFa` (`string`, required): Persian display title (e.g. `'پایه'`, `'پلاس'`, `'حرفه‌ای'`).
  - `priceUSD` (`number`, required): Monthly subscription price in US Dollars (e.g. `0`, `14`, `29`).
  - `priceYearlyUSD` (`number`, required): Annualized monthly subscription price (with 2 months free discount applied).
  - `chartsPerTab` (`number`, required): Maximum chart splits per layout (`-1` for unlimited).
  - `indicatorsPerChart` (`number`, required): Maximum technical indicators allowed per chart (`-1` for unlimited).
  - `priceAlerts` (`number`, required): Maximum concurrent price alerts allowed (`-1` for unlimited).
  - `histBars` (`number`, required): Historical candle bars depth accessible (e.g. `10000`, `25000`, `50000`).
  - `paperAccounts` (`number`, required): Maximum paper trading accounts allowed (`-1` for unlimited).
  - `webhookAlerts` (`boolean`, required): Whether automated webhook alert relays are enabled.
  - `deepBacktest` (`boolean`, required): Whether high-resolution multi-year backtesting is enabled.
  - `isActive` (`boolean`, optional): Flag indicating if the plan is available for public subscription. Default `true`.
  - `isDefault` (`boolean`, optional): Whether this plan is the default fallback for new users.
- **Client Presentation Transform**:
  - Plan `id === 'plus'` receives CSS class `.pop` and badge `"محبوب‌ترین"` / `"Most popular"`.
  - Quotas with numeric value `-1` render as `"نامحدود"` (FA) or `"Unlimited"` (EN).
  - Free plans (`priceUSD === 0`) render button text `"شروع رایگان"` / `"Start free"`; paid plans render `"شروع کنید"` / `"Get started"`.
- **Validation**:
  - `priceUSD` and `priceYearlyUSD` must be non-negative numbers.
  - Numeric feature limits must be either `-1` (unlimited) or an integer $\ge 0$.
- **Limits**:
  - Filtered server-side: inactive plans (`isActive === false`) are omitted for anonymous users unless matching the user's current tier or caller is admin.
- **Lifecycle**:
  - Loaded from `server/data/accounts/plans.json` during server startup.
  - Fetched by `client/landing/landing.js:loadPlans()` on page load.
  - Re-rendered when the user switches billing cycle (`cycle = 'm' | 'y'`) or language (`lang = 'fa' | 'en'`).

---

## 3. User Interface Settings (`UserSettings`)

Client-side user configuration storing language preference, shared between the landing page and the trading application.

- **Storage**: Browser `localStorage` under key `tradingchart_user_settings`.
- **Fields**:
  - `language` (`'fa' | 'en'`, required): Active user interface language. Defaults to `'fa'` (Persian).
- **Validation**:
  - Value must be strictly `'fa'` or `'en'`. Other values fall back to `'fa'`.
- **Limits**:
  - Retained indefinitely across browser sessions within the origin's local storage.
  - Wrapped in `try / catch` blocks to gracefully tolerate private browsing modes or storage quota exceptions.
- **Lifecycle**:
  - Read by `client/landing/landing.js:pickLang()` during page initialization.
  - Updated by `applyLang(l)` when the visitor clicks `#lang-toggle`.
  - Read by `/chart` application during startup to ensure language continuity across page transitions.

---

## 4. Rate Limiter Hit Record (`RateLimitHit`)

Ephemeral server memory record tracking request counts per client IP within a sliding 60-second window.

- **Storage**: Server memory Map `server/security.js:hits` (`Map<string, { start: number, n: number }>`).
- **Fields**:
  - `start` (`number`, required): Millisecond epoch timestamp when the current 60-second window commenced.
  - `n` (`number`, required): Total number of requests received from this IP since `start`.
- **Validation**:
  - If `Date.now() - start > 60000`, the window has lapsed; `start` resets to `Date.now()` and `n` resets to `0`.
- **Limits**:
  - `n` must not exceed `API_MAX_PER_MIN` (default `900`). Requests where `n > API_MAX_PER_MIN` trigger HTTP 429.
- **Lifecycle**:
  - Instantiated on the first `/api/*` request from a given IP address.
  - Incremented on every subsequent API request from the same IP.
  - Pruned every 120 seconds by background garbage collection interval `gc`:
    `for (const [ip, h] of hits) if (now - h.start > 60000) hits.delete(ip);`.

---

## 5. WebSocket Subscription Session (`WsSubscription`)

In-memory data structure tracking subscribed symbols for active WebSocket connections.

- **Storage**: Server memory Map `server/index.js:activeSubscriptions` (`Map<WebSocket, Set<string>>`).
- **Fields**:
  - Key: `WebSocket` client instance.
  - Value: `Set<string>` containing uppercase sanitized trading symbol pairs (e.g. `Set(['BTCUSDT', 'ETHUSDT'])`).
- **Validation**:
  - Symbol names must match `cleanSymbol()` regex (`/^[A-Z0-9][A-Z0-9_.\-]{0,23}$/`).
  - Max 50 symbols per connection (`subs.size >= 50`).
- **Limits**:
  - Max 50 distinct subscribed symbols per client socket.
  - Max 2000 concurrent client sockets connected to `/ws/live`. Excess sockets receive close code `1013 'busy'`.
- **Lifecycle**:
  - Created when a client establishes a WebSocket handshake on `/ws/live`, seeded with default symbol `'BTCUSDT'`.
  - Mutated via client messages:
    - `{"action": "subscribe", "symbol": "ETHUSDT"}`: Adds symbol to the set.
    - `{"action": "unsubscribe", "symbol": "ETHUSDT"}`: Removes symbol from the set.
  - Deleted when socket emits the `'close'` event.

---

## 6. Public Health Status (`HealthStatus`)

Sanitized telemetry payload returned by `GET /api/health` for uptime monitors and load balancers.

- **Storage**: Ephemeral JSON response generated dynamically in `server/index.js:76-78`.
- **Fields**:
  - `status` (`string`, required): Liveness indicator string, strictly `'online'`.
  - `product` (`string`, required): Fixed brand name string, strictly `'Chartivia'`.
  - `timestamp` (`string`, required): ISO 8601 UTC timestamp of request processing (e.g. `'2026-10-24T12:00:00.000Z'`).
- **Validation**:
  - Strictly forbidden from containing process memory (`process.memoryUsage()`), CPU load, OS release, disk paths, or host identifiers.
- **Lifecycle**:
  - Minted dynamically upon `GET /api/health`. Served with `Cache-Control: no-store`.

---

## 7. Bilingual 404 Error View (`Error404View`)

Bilingual standalone HTML error document returned when a client navigates to a non-existent web route.

- **Storage**: Inlined HTML template string in `server/index.js:211-214`.
- **Fields / Elements**:
  - Status code: `404 Not Found`.
  - Headers: `Cache-Control: no-cache`, `Content-Type: text/html; charset=utf-8`.
  - Language & Direction: `<html lang="fa" dir="rtl">`.
  - Robots tag: `<meta name="robots" content="noindex">`.
  - Heading: `<h1>۴۰۴</h1>`.
  - Message: `<p>صفحه‌ای که دنبال آن هستید پیدا نشد. · Page not found.</p>`.
  - Navigation actions:
    - Link to Home: `<a href="/">صفحه اصلی · Home</a>`
    - Link to Chart: `<a class="g" href="/chart">نمودار · Chart</a>`
- **Lifecycle**:
  - Rendered synchronously on any unmatched GET request outside `/api/*` and `/assets/*`.
