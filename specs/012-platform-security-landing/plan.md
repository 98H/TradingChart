# Implementation Plan: Platform, Security and Landing Page

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-platform-security-landing/spec.md`

## Summary

The Platform, Security, and Landing Page subsystem constitutes the perimeter gateway, canonical routing layer, and marketing storefront of the Chartivia platform. It is engineered to satisfy two primary objectives: (1) hardening the Express and WebSocket server surface for secure public internet exposure without external security dependencies, and (2) providing a lightweight, high-performance, bilingual marketing portal at `/` that presents the platform's capabilities, renders live pricing from the backend plan catalog, and channels prospective traders directly into the charting application (`/chart`).

The subsystem operates across three decoupled layers:
1. **Perimeter Security & Defensive Pipeline (`server/security.js`, `server/index.js`)**: An Express middleware pipeline enforcing strict Content-Security-Policy (CSP) headers, transport security (HSTS), browser capability isolation (Permissions-Policy), same-origin request isolation (COOP/CORP/nosniff), host canonicalization (HTTP 301 redirects to `https://chartivia.com`), defense-in-depth same-origin CSRF barriers for state-changing `/api/*` endpoints, sliding-window per-IP rate limiting (900 req/min), body size caps (2.5 MB), restricted CORS on public market endpoints, and a rigid static asset sandbox ensuring internal server source files, configuration files, and cryptographic keys can never be accessed over HTTP.
2. **Public Discoverability, PWA & Compliance Meta (`client/public/`)**: Search crawler directives (`robots.txt` allowing `/` while forbidding `/admin` and `/api/`), canonical XML sitemap (`sitemap.xml`), RFC 9116 security vulnerability reporting contact (`.well-known/security.txt`), standalone Progressive Web App manifest (`manifest.webmanifest` launching `/chart`), and favicon assets.
3. **Bilingual Frontend Landing Page (`client/index.html`, `client/landing/landing.js`, `client/landing/landing.css`)**: A standalone, zero-chart marketing single-page interface featuring 7 semantic sections (Hero, Features, Markets, Pricing, FAQ, CTA Band, Footer). It supports instantaneous in-place English/Persian switching with RTL/LTR layout mirroring, accessible keyboard navigation (`.skip` link), billing cycle toggling (Monthly vs. Yearly with 2 months free), dynamic plan card hydration from `GET /api/plans` (highlighting the `plus` tier and translating unlimited limits), native `<details>` FAQ accordions, and responsive viewport collapsing for mobile devices ($\le 640$px).

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser ESM; Node.js v20+ ESM on Express backend).

**Primary Dependencies**:
- `express`: `^4.21.2` (HTTP web server, routing, static asset serving, and middleware chain).
- `cors`: `^2.8.5` (CORS middleware scoped exclusively to public read-only market data endpoints).
- `ws`: `^8.18.0` (WebSocket broadcast server mounted on `/ws/live`).
- `vite`: `^6.4.5` (Multi-entry client asset bundler and minifier).
- `@fontsource/vazirmatn`: `^5.3.0` (Self-hosted Persian typography).
- `@fontsource/inter`: `^5.3.0` (Self-hosted Latin typography).
- `puppeteer-core`: `^24.3.1` (Headless browser testing harness).
- Standard Node.js `node:http`, `node:path`, `node:url` (Zero external security or auth dependencies).

**Storage**:
- Client `localStorage`:
  - `tradingchart_user_settings`: User configuration JSON object storing `{ language: 'fa' | 'en', ... }`, shared seamlessly with the `/chart` application.
- Server In-Memory Maps:
  - `hits` (`server/security.js`): `Map<string, { start: number, n: number }>` for per-IP 60-second sliding-window rate limiting. Auto-pruned every 120 seconds.
  - `activeSubscriptions` (`server/index.js`): `Map<WebSocket, Set<string>>` maintaining symbol subscriptions per live WebSocket client.
- Server Static and Data Stores:
  - `server/data/accounts/plans.json`: Atomic JSON store defining plan tiers, quotas, and pricing returned by `/api/plans`.
  - `server/data/admin_master.key`: Master 24-byte secret key file (mode `0o600`), isolated by the static serving sandbox.

**Testing**:
- Security Regression Suite:
  - `scripts/qa/security_smoke.sh`: Automated bash test suite verifying 27 API-level security assertions (CSP, headers, CORS absence on HTML, info leaks, rate limiting, path traversal, sensitive file shielding).
- Real-Browser E2E Suites:
  - `tests/qa_landing.cjs`: Headless Puppeteer test validating landing page rendering, pricing hydration, cycle toggle, FAQ accordion, language toggle round-trip, nav anchor scrolling, deep links, touch targets, and zero horizontal scroll across desktop/mobile and FA/EN.
- Orchestration:
  - `scripts/qa/chain_prod.sh`: Production test harness executing `security_smoke.sh` and `qa_landing.cjs` across all four matrix cells (`desktop fa`, `desktop en`, `mobile fa`, `mobile en`).

**Target Platform**: Responsive Web Browser across Desktop ($\ge 900$px), Tablet (641–900px), and Mobile Phone ($\le 640$px down to 360px), supporting Persian (RTL default) and English (LTR).

**Project Type**: Full-stack web application serving static marketing front-end (`/`), trading workspace (`/chart`), administrative back office (`/admin`), and REST/WebSocket API endpoints.

**Performance Goals**:
- Landing page First Contentful Paint (FCP) $< 600$ ms; complete DOM and pricing rendering $< 1500$ ms.
- Security middleware execution overhead $< 1$ ms per HTTP request.
- Per-IP rate limiter sliding-window lookup $< 0.1$ ms.
- Content-hashed static assets cached for 30 days (`max-age=2592000, immutable`).
- Dynamic language switch execution completing DOM re-localization $< 50$ ms without page reload.

**Constraints**:
- Zero external database engines; zero external security, header, or rate-limiting NPM packages.
- Reverse proxy header trust restricted strictly to loopback (`app.set('trust proxy', 'loopback')`).
- Static file server strictly sandboxed to `dist/`; server source code, data directories, `.env`, and git metadata must return 404 or index HTML fallback.
- Minimum 40×40 px touch targets for all interactive landing page buttons, toggles, and summaries on mobile.
- Zero horizontal overflow (`scrollWidth - innerWidth <= 1`) across all supported screen widths.

**Scale/Scope**:
- 7 landing page content sections.
- 15 HTTP response security directives.
- 27 automated security regression assertions.
- 2000 maximum concurrent WebSocket connections (`TC_MAX_WS`).
- 900 API requests per minute per IP limit (`TC_API_RATE_PER_MIN`).

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | Landing page pricing is hydrated dynamically from `/api/plans` reflecting authentic tier configurations in `server/data/accounts/plans.json`. Market coverage explicitly tags crypto as "داده زنده" / "Live data" and forex/commodities/stocks as "داده نمایشی" / "Demo data", preventing deceptive claims (`client/index.html:101-104`). |
| II | Spec Before Code | VIOLATION | Feature was implemented in production prior to SDD retrofit ratification; this retrofit documents the existing architecture (`spec.md`) and descriptive Spec Kit artifacts without changing production code. |
| III | Real-Browser Zero-Defect Verification | PASS | `tests/qa_landing.cjs` runs real-browser verification using `elementFromPoint` click coordinates across all four matrix cells (`desktop fa`, `desktop en`, `mobile fa`, `mobile en`), enforcing zero defects, zero clipped text, touch target sizes, and clean console logs. |
| IV | Bilingual Parity and RTL Correctness | PASS | Complete dual-dictionary localization (`client/landing/landing.js:EN`, `FA_FN`) covering all sections, titles, buttons, and ARIA labels. Switching updates `html[lang][dir]`, document font, and title in place, converts numerals using `FA_DIGITS`, and formats currency using Persian decimals (`٫`) and grouping (`٬`). |
| V | Mobile Fit and Interaction Safety | PASS | Responsive breakpoints at 900px and 640px collapse multi-column grids into single-column cards, expand hero action buttons to 100% width, maintain $\ge 40 \times 40$ px touch targets, and eliminate horizontal overflow (`client/landing/landing.css:106-122`). |
| VI | Security and Privacy by Default | PASS | Comprehensive security middleware in `server/security.js` enforces strict CSP, nosniff, SAMEORIGIN (DENY on `/admin`), Referrer-Policy, Permissions-Policy, COOP, CORP, and HSTS. Rejects cross-origin API mutations with 403, caps request rates per IP, limits JSON payloads to 2.5 MB, and isolates private server data and keys from static routes. |
| VII | Single Source of Truth for Entitlements | PASS | Pricing tiers rendered on the landing page are fetched via `GET /api/plans`, which references `server/data/accounts/plans.json` and `server/featuresCatalog.js`. The landing page does not hardcode tier quotas or prices. |
| VIII | Performance Budget | PASS | Landing page is a zero-dependency static page without chart engine overhead; rate limiter map is auto-pruned every 120s using unreferenced intervals (`gc.unref()`); WebSocket connections are capped at 2000 (`TC_MAX_WS`). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Native Node.js modules (`node:http`, `node:path`, `node:url`) and lightweight Express 4 middleware stack; zero third-party security or rate-limiting libraries; vendor code untouched. |
| X | Hybrid SDD | VIOLATION | Code pre-dated SDD adoption. This retrofit establishes normative specifications, plans, data models, contracts, and tasks to govern all future iterations and convergence cycles. |

## Project Structure

### Documentation (this feature)

```text
specs/012-platform-security-landing/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-013, SC-001..SC-004)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/plans, /api/health, static routes, errors)
│   └── module-api.md           # Client module interfaces (landing.js functions, dictionary, events)
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
├── review-checklist.md         # Post-phase review checklist
└── tasks.md                    # Retrofit task inventory mapping code to requirements
```

### Source Code (repository root)

```text
client/
├── index.html                  # Landing page HTML shell, SEO metadata, OpenGraph/Twitter, 7 sections
├── landing/
│   ├── landing.js              # Bilingual dictionary, DOM localizer, /api/plans fetch, plan card renderer
│   └── landing.css             # Standalone dark-theme stylesheet, CSS variables, responsive breakpoints
└── public/
    ├── robots.txt              # Search crawler rules (allow /, disallow /admin and /api/)
    ├── sitemap.xml             # XML sitemap with canonical URLs
    ├── manifest.webmanifest    # PWA application manifest (/chart start, standalone)
    ├── .well-known/
    │   └── security.txt        # RFC 9116 security reporting contact and policy
    └── favicon.svg             # Vector favicon icon

server/
├── index.js                    # Express bootstrap, host redirects, static asset dispatch, 404 handler, ws
├── security.js                 # Security headers, CSP, sameOriginWrites, apiRateLimit, validators, 500 handler
└── accounts.js (1043–1055)     # Public /api/plans endpoint implementation and active tier filtering

scripts/qa/
├── security_smoke.sh           # 27-check API security regression test suite
└── chain_prod.sh               # Sequential production QA orchestration script

tests/
├── qa_landing.cjs              # Headless Puppeteer E2E suite for landing page across desktop/mobile & FA/EN
└── qa_lib.cjs                  # Shared QA browser launch helper and screenshot utility
```

**Structure Decision**: Clean architectural separation between server-level perimeter security enforcement (`server/security.js`), server bootstrap and static dispatch (`server/index.js`), plan data resolution (`server/accounts.js`), discoverability and crawler manifests (`client/public/`), and the standalone client landing application (`client/index.html`, `client/landing/landing.js`, `client/landing/landing.css`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| II: Built prior to SDD adoption | Implemented during platform launch phase before Hybrid SDD protocol adoption. | Retrofit procedure establishes full Spec Kit artifacts without risking regressions in stable production infrastructure. |
| X: Retrofit feature governance | Feature existed in production prior to SDD pipeline ratification. | Retrofit protocol establishes backward-looking descriptive truth to enable gated future feature cycles. |
