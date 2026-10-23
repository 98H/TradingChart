# Feature Specification: Platform, Security and Landing Page

**Feature Branch**: `012-platform-security-landing` (retrofit) — **HIGH RISK** (security)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Chartivia must be safe to expose to the internet — strict headers, no cross-site writes, rate limits, nothing private ever served — on one canonical domain, with a fast bilingual landing page that explains the product, shows live plan prices and sends visitors into the chart."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Landing page converts visitors (Priority: P1)

A visitor lands on `/`, reads the hero, features, markets, pricing and FAQ in Persian (or switches to English), compares monthly and yearly prices loaded from the live plan catalogue, and opens the chart.

**Why this priority**: The landing page is the front door for every new user.

**Independent Test**: Open `/` on desktop and mobile in both languages: prices load, the monthly/yearly toggle changes prices, the FAQ opens, every CTA leads to `/chart`, nothing overflows.

**Acceptance Scenarios**:

1. **Given** `/`, **Then** the page renders in Persian (rtl) by default with sections hero, features, markets, pricing, FAQ, CTA band and footer.
2. **Given** the pricing section, **Then** one card per active plan is rendered from `GET /api/plans` with localized features ("Unlimited"/"نامحدود" for unlimited), the `plus` plan highlighted "Most popular"; if loading fails, the localized "Pricing could not be loaded…" note is shown.
3. **Given** Monthly / Yearly (2 months free), **When** toggled, **Then** every card shows the monthly or yearly price and the pressed state is announced (`aria-pressed`).
4. **Given** EN / فا, **When** clicked, **Then** texts, aria labels, title, direction and font switch, and the choice carries over to `/chart`.
5. **Given** any CTA ("Open chart", "Start free", "Get started"), **Then** the browser goes to `/chart`; "Compare plans" scrolls to pricing.
6. **Given** keyboard use, **When** Tab is pressed first, **Then** a "Skip to main content" link appears and jumps to the main content.
7. **Given** mobile (≤ 640 px), **Then** grids become one column, hero buttons are full width, touch targets are at least 40×40 px, and there is no horizontal scroll.

---

### User Story 2 - Hardened HTTP surface (Priority: P1)

Every response carries strict security headers; state-changing API calls from other origins are refused; abusive clients are rate-limited; private files are never served; errors never leak internals.

**Independent Test**: Run the security smoke suite: 27 of 27 checks pass.

**Acceptance Scenarios**:

1. **Given** any response, **Then** it includes the documented CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP and CORP headers, no `X-Powered-By`, and HSTS over HTTPS.
2. **Given** a POST/PUT/PATCH/DELETE to `/api/*` with an `Origin` that does not match the host, **Then** `403 cross_origin_forbidden`.
3. **Given** more than the per-IP limit of API requests per minute, **Then** `429 rate_limited` with `Retry-After`.
4. **Given** requests for `/server/data/admin_master.key`, `/.env`, `/package.json`, `/server/accounts.js` or `/.git/config`, **Then** none of them is served.
5. **Given** malformed JSON, an oversized body (> 2.5 MB), an unknown API route or an unexpected error, **Then** `400 invalid_json`, `413 payload_too_large`, `404 not_found` or `500 internal_error` respectively, without stack traces.

---

### User Story 3 - Canonical domain, routes and discoverability (Priority: P2)

Alternate hosts redirect to the canonical domain; `/`, `/chart` and `/admin` serve their apps with correct caching; search engines get robots, sitemap, hreflang and social metadata while `/admin` and `/api` are excluded; the app is installable.

**Acceptance Scenarios**:

1. **Given** a request to `www.chartivia.com`, `chartivia.ir` or any `*.chartivia.ir` host, **Then** a 301 redirect to `https://chartivia.com` with the same path.
2. **Given** `/admin`, **Then** it is served with `no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`.
3. **Given** hashed assets under `/assets/`, **Then** they are cached for 30 days as immutable; HTML is `no-cache`.
4. **Given** an unknown page, **Then** a 404 page "۴۰۴" with links to `/` and `/chart` is returned.

---

### Edge Cases

- Public market-data GET endpoints allow CORS without credentials; HTML and state-changing routes send no CORS headers.
- Behind the local reverse proxy only loopback is trusted for forwarded headers.
- `GET /api/plans` hides inactive plans except the caller's current plan, and shows all plans to admins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every response MUST include `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Resource-Policy: same-origin`, HSTS (`max-age=31536000; includeSubDomains`) on secure requests, and no `X-Powered-By`.
- **FR-002**: State-changing `/api/*` requests carrying an `Origin` whose host differs from `Host` / `X-Forwarded-Host` MUST be refused with `403 cross_origin_forbidden`.
- **FR-003**: `/api/*` MUST be rate-limited per IP to `TC_API_RATE_PER_MIN` (default 900) requests per minute, answering `429 rate_limited` with `Retry-After`.
- **FR-004**: JSON bodies MUST be limited to 2.5 MB (`413 payload_too_large`); malformed JSON MUST give `400 invalid_json`; unknown API routes `404 not_found`; unexpected errors `500 internal_error` with no internals.
- **FR-005**: Only the built client (`dist/`) and public assets MUST be served statically; server sources, data files, keys, `.env`, `package.json` and `.git` MUST never be served.
- **FR-006**: CORS MUST be enabled only for GET on public market-data endpoints (candles, tickers, symbols, symbol-info, news, economic-calendar, screener, depth) without credentials.
- **FR-007**: Requests to `www.chartivia.com`, `chartivia.ir`, `www.chartivia.ir` and `*.chartivia.ir` MUST be redirected with 301 to `https://chartivia.com` preserving the path.
- **FR-008**: `/` MUST serve the landing page, `/chart` the trading app and `/admin` the console (with `no-store`, `DENY`, `no-referrer`, `noindex, nofollow`); hashed assets MUST be cached 30 days immutable and HTML `no-cache`; unknown pages MUST return the bilingual 404 page.
- **FR-009**: `GET /api/health` MUST return `{status: "online", product: "Chartivia", timestamp}` with `no-store` and no internal details.
- **FR-010**: `robots.txt` MUST allow `/` and disallow `/admin` and `/api/`, reference the sitemap; the sitemap MUST list the canonical pages; the landing page MUST carry SEO, Open Graph/Twitter metadata and hreflang alternates; a web app manifest (start `/chart`, standalone) and `/.well-known/security.txt` MUST be published.
- **FR-011**: The landing page MUST render hero, features, markets, pricing, FAQ (native expandable items), CTA band and footer; default to Persian rtl; provide a skip link; switch language (texts, aria labels, title, direction, font) and persist it for `/chart`.
- **FR-012**: Pricing MUST be rendered from `GET /api/plans` (active plans; inactive hidden except the caller's current plan; all for admins), with monthly/yearly toggle, localized features and unlimited values, the `plus` plan highlighted, CTAs to `/chart`, and the localized error note when loading fails.
- **FR-013**: The landing page MUST have no horizontal scroll, no clipped text and touch targets ≥ 40×40 px on mobile, and no "undefined", "NaN" or "null" text in either language.

### Key Entities

- **Security Policy**: header set, CORS allow-list, rate-limit window per IP.
- **Public Plan View**: id, EN/FA names, monthly/yearly price, headline entitlements, active flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The security smoke suite passes 27/27 against a fresh instance.
- **SC-002**: The landing suite passes on desktop and mobile in both languages with zero console errors.
- **SC-003**: Zero private files are reachable over HTTP.
- **SC-004**: The landing page shows prices within 2 s of load on a normal connection.

## Assumptions

- `'unsafe-eval'` in the CSP is required by the in-browser Pine engine (see 004 research) and is an accepted, documented exception.
- WebSocket limits and messages are specified in 005-market-data-feed.
- Known gaps for Converge: landing language detection always falls back to Persian (browser language ignored); silent catches in plans loading, socket parsing/broadcast and origin parsing; sitemap missing the English alternate; static HTML cache rule for extensionless paths; hard-coded copyright year in the static fallback.
