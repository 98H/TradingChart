# Research & Design Decisions: Platform, Security and Landing Page

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document formalizes the architectural decisions and implementation strategies embodied in the existing production codebase for platform perimeter security, server infrastructure, discoverability, and the public marketing landing page.

---

## R1. Multi-Path Single-Host Routing Architecture (`/`, `/chart`, `/admin`)

- **Decision**: The Express server implements path-based routing that dispatches incoming requests to three distinct client application bundles:
  1. `/` and `/index.html`: Serves the lightweight marketing landing page (`dist/index.html`) with `Cache-Control: no-cache`.
  2. `/chart` and `/chart/*`: Serves the primary trading workspace application (`dist/chart/index.html`) with `Cache-Control: no-cache`.
  3. `/admin` and `/admin/*`: Serves the administrative back-office console (`dist/admin/index.html`) with hardened headers (`Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`).
  Hashed assets under `/assets/*` are served with immutable long-term caching (`max-age=2592000, immutable`). Unmatched API paths return JSON 404, while unmatched web pages return a dedicated standalone 404 HTML document.
- **Rationale**: Isolates the resource-intensive charting engine and sensitive back-office console from casual prospective visitors. Landing page visitors download a minified bundle without WebGL or technical analysis overhead, achieving rapid initial load times. Applying strict `no-store` and `noindex` to `/admin` prevents search crawlers and intermediate caches from archiving administrative interfaces.
- **Alternatives considered**:
  - *Single SPA routing everything via client-side router*: Rejected because loading the heavy charting engine on the marketing page degrades First Contentful Paint (FCP) and conversion rates.
  - *Subdomain routing (`chart.chartivia.com`, `admin.chartivia.com`)*: Rejected to avoid complex cross-subdomain cookie handling, SSL management, and reverse proxy routing overhead.
- **Evidence**: `server/index.js:56-72`, `server/index.js:201-214`.

---

## R2. Content-Security-Policy with PineTS Runtime Scripting Exception

- **Decision**: Every response from the server includes a strict `Content-Security-Policy` header:
  `default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`.
  The `'unsafe-eval'` directive is explicitly retained in `script-src`, while inline scripts (`'unsafe-inline'`) are strictly forbidden.
- **Rationale**: The client-side Pine Script execution engine (`pinets` / `@luxalgo/vela-pinets`) dynamically compiles user-authored trading scripts into JavaScript executable bytecode using `new Function(...)` inside web workers and the chart context. Removing `'unsafe-eval'` breaks custom indicator and strategy compilation. Restricting `script-src` strictly to `'self'` and `'unsafe-eval'` guarantees that external scripts cannot be injected, while `'unsafe-inline'` prohibition mitigates reflected and stored XSS vectors.
- **Alternatives considered**:
  - *Full CSP without `'unsafe-eval'`*: Rejected because user-defined Pine indicators and strategies would cease to function.
  - *WASM-based compilation sandbox*: Rejected due to high development complexity and performance overhead compared to direct V8 JIT execution.
- **Evidence**: `server/security.js:10-25`, `server/security.js:28`.

---

## R3. Defense-in-Depth Same-Origin Write Enforcement (`sameOriginWrites`)

- **Decision**: The middleware `sameOriginWrites` inspects all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) directed to `/api/*`. If an incoming request carries an `Origin` header, the middleware extracts the origin's host and compares it against `req.headers.host` or `req.headers['x-forwarded-host']`. If the hosts do not match, the request is immediately terminated with `403 Forbidden` and error `{ ok: false, error: 'cross_origin_forbidden' }`. Requests without an `Origin` header (such as curl, server-to-server scripts, or mobile clients) bypass this check and are evaluated by the target endpoint's authentication.
- **Rationale**: While session cookies are already configured with `SameSite=Strict`, browser standards and edge-case cross-site navigations can introduce Cross-Site Request Forgery (CSRF) vulnerabilities. Modern browsers unconditionally append the `Origin` header to cross-origin state-changing requests. Verifying origin alignment provides a zero-dependency defense-in-depth shield that blocks cross-site attacks before requests reach business logic.
- **Alternatives considered**:
  - *CSRF synchronizer tokens (CSRF token per session)*: Rejected because token generation, rotation, and client synchronization add stateful session overhead without added security over strict SameSite + Origin validation.
  - *Relying solely on `SameSite=Strict` cookies*: Rejected because defense-in-depth is required by Constitution Principle VI.
- **Evidence**: `server/security.js:43-52`.

---

## R4. Zero-Dependency In-Memory Sliding-Window Rate Limiter (`apiRateLimit`)

- **Decision**: Global API traffic under `/api/*` is throttled on a per-IP basis using an in-memory sliding 60-second window tracked in `hits = new Map()`. The maximum request volume is configured by `TC_API_RATE_PER_MIN` (defaulting to 900 requests per minute). When an IP exceeds this budget, the middleware responds with `429 Too Many Requests`, error `{ ok: false, error: 'rate_limited' }`, and a `Retry-After: <seconds>` header indicating the remaining seconds in the window. Stale map entries are swept every 120 seconds via an unreferenced interval timer (`gc.unref()`).
- **Rationale**: Protects upstream market data quotas (e.g. Binance API rate limits) from scripted scraping floods and DoS amplification attacks, while providing generous throughput (15 req/s) for genuine multi-chart users polling candle feeds and economic events. Using an in-memory Map avoids external dependencies like Redis, keeping the runtime architecture minimal.
- **Alternatives considered**:
  - *Token bucket algorithm in Redis*: Rejected due to the project's zero external database architecture constraint.
  - *Express-rate-limit npm package*: Rejected to maintain minimal external dependencies (Constitution Principle IX).
- **Evidence**: `server/security.js:57-76`.

---

## R5. Hardened Server-Side Static Sandbox and Sensitive File Shielding

- **Decision**: The static asset hosting pipeline is strictly bounded to the built `dist/` directory via `express.static(distPath)`. All critical server-side source files (`server/index.js`, `server/accounts.js`), internal configuration files (`.env`, `package.json`), cryptographic secrets (`server/data/admin_master.key`), and version control metadata (`.git/config`) reside outside the `dist/` root and are never served. Requests for these paths are caught by the catch-all HTML 404 handler or the API 404 handler.
- **Rationale**: Exposing internal source code or environment files constitutes a severe security breach that reveals secret keys, account databases, and server internals. Enforcing a physical filesystem boundary ensures that directory traversal or static misconfigurations cannot leak private server artifacts.
- **Alternatives considered**:
  - *Serving the project root with a blacklist of denied patterns*: Rejected as highly vulnerable to path traversal bypasses and casing quirks.
  - *Nginx/Caddy static serving*: Rejected to keep the application self-contained and testable in standalone Node.js environments.
- **Evidence**: `server/index.js:51-53,70-71`, `scripts/qa/security_smoke.sh:31-33`.

---

## R6. Domain Canonicalization via 301 Permanent Redirects

- **Decision**: The server intercepts all incoming requests and inspects `req.headers.host`. If the hostname matches `www.chartivia.com`, `chartivia.ir`, `www.chartivia.ir`, or any subdomain ending in `.chartivia.ir`, the server issues an HTTP 301 redirect to `https://chartivia.com${req.originalUrl}`.
- **Rationale**: Consolidates search engine ranking signals (PageRank) onto a single canonical domain, eliminates duplicate content penalties, prevents TLS certificate mismatches across alternative domain holdings, and guarantees that user session cookies and local storage keys are anchored to a unified origin.
- **Alternatives considered**:
  - *Handling redirects at DNS / Cloudflare level*: Rejected because local and staging testing require the application server itself to enforce canonical domain policies consistently.
  - *Serving duplicate content across all domains*: Rejected due to SEO fragmentation and broken cross-domain authentication state.
- **Evidence**: `server/index.js:33-39`.

---

## R7. Restricted Public CORS Policy with Credentials Forbidden

- **Decision**: Cross-Origin Resource Sharing (CORS) is enabled exclusively on public, read-only market data endpoints:
  `/api/(candles|tickers|symbols|symbol-info|news|economic-calendar|screener|depth)` via `cors({ credentials: false })`.
  CORS is strictly disabled for HTML pages, user account management, authentication, administration, and state-changing API endpoints.
- **Rationale**: Allows public market intelligence, ticker rates, and candle data to be consumed by external widgets or third-party analytical integrations, while ensuring that authenticated user sessions, administrative controls, and cloud states remain strictly bound to the same origin. Disallowing credentials (`credentials: false`) prevents third-party origins from reading personalized user data.
- **Alternatives considered**:
  - *Permissive CORS (`*`) across all `/api/*`*: Rejected because it exposes authenticated user endpoints to cross-origin data exfiltration.
  - *Completely disabling CORS*: Rejected because public market data feeds are intended to be accessible for external market widgets.
- **Evidence**: `server/index.js:42-43`, `scripts/qa/security_smoke.sh:15`.

---

## R8. Sanitized JSON Error Handling and Stack Trace Suppression

- **Decision**: Uncaught errors in API route handlers and Express body parser failures are routed through centralized error handlers:
  - JSON parse failure (`err.type === 'entity.parse.failed' || err.status === 400`): returns HTTP 400 with `{ ok: false, error: 'invalid_json' }`.
  - Oversized payloads (`err.type === 'entity.too.large' || err.status === 413`): returns HTTP 413 with `{ ok: false, error: 'payload_too_large' }`.
  - Unmatched `/api/*` routes: returns HTTP 404 with `{ ok: false, error: 'not_found' }`.
  - Uncaught backend exceptions (`serverError`): logs diagnostic details to `console.error` and returns HTTP 500 with `{ ok: false, error: 'internal_error' }`.
  No stack traces, internal variable dumps, or database paths are ever sent to HTTP clients.
- **Rationale**: Leaking stack traces or internal server error messages exposes framework versions, internal directory layouts, and execution flow details to potential attackers, facilitating exploit development. Standardized error codes enable client applications to handle failures gracefully.
- **Alternatives considered**:
  - *Default Express error handler (HTML stack traces in development)*: Rejected because accidental exposure in production exposes vulnerabilities.
  - *Custom localized error messages generated by server*: Rejected in favor of concise machine-readable error tokens localized client-side.
- **Evidence**: `server/security.js:97-100`, `server/index.js:201-208`.

---

## R9. Standalone Zero-Chart Landing Page Architecture

- **Decision**: The marketing landing page (`client/index.html`) is structured as an independent static document with its own dedicated stylesheet (`client/landing/landing.css`) and script (`client/landing/landing.js`). It intentionally omits the charting engine (`@luxalgo/vela`), indicator packages (`pinets`), drawing tools, and large vendor libraries.
- **Rationale**: The full charting workspace is a complex, WebGL-powered application with significant bundle weight. Isolating the marketing landing page ensures near-instantaneous page loads (<500 ms), zero layout shifts, excellent Google Core Web Vitals scores, and frictionless visitor onboarding on mobile devices.
- **Alternatives considered**:
  - *Embedding a live interactive chart on the landing page hero*: Rejected because initializing WebGL, fetching live candle history, and running indicator loops increases initial load time by over 2.5 seconds and causes high memory consumption on low-end mobile devices.
  - *Using server-side rendering (SSR) via Next.js or Nuxt*: Rejected to maintain simple static asset hosting and avoid Node.js SSR rendering bottlenecks.
- **Evidence**: `client/index.html:1-149`, `client/landing/landing.js:1-139`, `client/landing/landing.css:1-123`.

---

## R10. In-Place Lossless DOM Localization and Direction Mirroring

- **Decision**: Language switching on the landing page (`applyLang(l)`) updates the DOM dynamically without page reload:
  1. Mutates `document.documentElement.lang` (`'fa'` $\leftrightarrow$ `'en'`) and `dir` (`'rtl'` $\leftrightarrow$ `'ltr'`).
  2. Updates `[data-i18n]` text content using dual dictionaries (`EN` and `FA_FN`), caching original Persian text in `faOriginal = new Map()` to allow lossless round-trip restoration.
  3. Updates `[data-i18n-aria]` accessibility labels.
  4. Swaps document font family (`Vazirmatn` for Persian, `Inter` for English).
  5. Updates `document.title` and `#lang-toggle` button text.
  6. Persists language choice to `localStorage['tradingchart_user_settings']`, ensuring the selection carries over seamlessly when the visitor clicks through to `/chart`.
  7. Re-renders pricing cards in the newly selected language.
- **Rationale**: Instantaneous language toggling provides a fluid user experience without losing scroll position or triggering network roundtrips. Storing the preference in the shared user settings key guarantees that entering the trading application maintains user language continuity.
- **Alternatives considered**:
  - *Separate directory routes (`/fa/` and `/en/`)*: Rejected because managing duplicate HTML files creates maintenance synchronization drift.
  - *Full page reload on language switch*: Rejected because reloads disrupt user context, reset FAQ accordion states, and increase server load.
- **Evidence**: `client/landing/landing.js:55-83`, `tests/qa_landing.cjs:68-74,88-90`.

---

## R11. Dynamic Public Plan Hydration with Inactive Filtering and Unlimited Quota Formatting

- **Decision**: On page load, `loadPlans()` executes `GET /api/plans`. The server automatically filters out inactive plans (`isActive === false`) for anonymous visitors. The client renders cards for each plan in `planOrder`:
  - Special highlight styling (`.pop`) and badge ("محبوب‌ترین" / "Most popular") are applied specifically to plan `id === 'plus'`.
  - Quota values equal to `-1` are transformed into "نامحدود" (FA) or "Unlimited" (EN).
  - Monthly vs. Yearly pricing toggle updates card prices dynamically, displaying yearly price (`priceYearlyUSD`) or monthly price (`priceUSD`).
  - If the API call fails or returns an error, the grid displays a localized fallback note: "بارگذاری قیمت‌ها ممکن نشد. برای مشاهده پلن‌ها وارد نمودار شوید." / "Pricing could not be loaded. Open the chart to see plans.".
- **Rationale**: Centralizing plan tiers in `server/data/accounts/plans.json` guarantees that pricing changes made in the admin console immediately reflect on the landing page without frontend rebuilds. Highlighting the `plus` tier establishes a clear product value anchor.
- **Alternatives considered**:
  - *Hardcoding pricing cards directly in `index.html`*: Rejected because hardcoding causes pricing and quota synchronization drift between the marketing page and the actual account checkout system.
  - *Requiring payment checkout directly on the landing page*: Rejected because account registration and plan requests are handled inside the authenticated workspace `/chart`.
- **Evidence**: `client/landing/landing.js:92-129`, `server/accounts.js:1043-1055`.

---

## R12. Search Engine Discoverability, RFC 9116 Compliance, and PWA Installability

- **Decision**: Public discovery and compliance metadata are integrated into the root directory:
  - `robots.txt`: Grants universal crawler access to `/`, while explicitly disallowing `/admin` and `/api/`, and points to `https://chartivia.com/sitemap.xml`.
  - `sitemap.xml`: Lists canonical URLs for `/` (priority 1.0) and `/chart` (priority 0.9).
  - `.well-known/security.txt`: Complies with RFC 9116, publishing security contact email `mailto:security@chartivia.com`, languages (`fa, en`), canonical URL, and expiration date (`2027-10-22`).
  - `manifest.webmanifest`: Configures standalone Progressive Web App (PWA) installation launching `/chart` with custom theme colors and icons.
  - `client/index.html`: Implements full OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`), Twitter card, and `hreflang` alternates (`fa` and `en`).
- **Rationale**: Maximizes organic search engine discoverability and social media sharing previews, ensures security researchers have a recognized disclosure channel, and enables mobile users to install Chartivia directly to their home screens.
- **Alternatives considered**:
  - *Omitting security.txt*: Rejected because RFC 9116 compliance is a best practice for financial and trading platforms.
  - *Single language metadata*: Rejected because bilingual platforms require `hreflang` alternates to avoid international SEO conflicts.
- **Evidence**: `client/public/robots.txt`, `client/public/sitemap.xml`, `client/public/manifest.webmanifest`, `client/public/.well-known/security.txt`, `client/index.html:4-22`.

---

## Spec/code mismatches

- **FR-010**: `client/public/sitemap.xml:3-4` lists only `https://chartivia.com/` and `https://chartivia.com/chart`, omitting the English alternate URL `https://chartivia.com/?lang=en` declared in `client/index.html:18`.
- **FR-011**: `client/landing/landing.js:59` uses the redundant fallback ternary `(navigator.language || '').toLowerCase().startsWith('fa') ? 'fa' : 'fa'`, always returning `'fa'` and ignoring user browser English language preference when no URL query parameter or localStorage setting exists.
- **FR-012**: `client/landing/landing.js:127` catches errors in `loadPlans()` with an empty error block `catch (e) { plansData = 'error'; }` without logging or telemetry.
- **FR-002**: `server/security.js:48` catches invalid `Origin` URL parsing errors with an empty block `catch (e) { host = ''; }`, causing unparseable origin headers to be rejected without diagnostic logging.
- **FR-008**: `server/index.js:71` static HTML caching condition `filePath.endsWith('.html') || filePath === distPath` only checks file paths ending in `.html` or matching root directory, not matching extensionless HTML routes if served by general static middleware.
- **FR-011**: `client/index.html:144` contains a hardcoded static copyright year `<span id="year">2026</span>` before client JavaScript dynamically updates it to current calendar year.
- **FR-003**: In-memory rate limiting map `hits` in `server/security.js:58` tracks client requests using `req.ip`, which defaults to `'unknown'` if undefined, effectively aggregating all unidentifiable clients into a single rate limit bucket (`server/security.js:61`).
