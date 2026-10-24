# Tasks: Platform, Security and Landing Page

**Input**: Design documents from `/specs/012-platform-security-landing/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Frontend document templates, stylesheets, vector brand assets, and manifest files

- [x] T001 [P] Mount document HTML shell, viewport meta, theme colors, and font styles in client/index.html (infra)
- [x] T002 [P] Define dark theme variables, responsive typography, and layout rules in client/landing/landing.css (infra)
- [x] T003 [P] Place platform vector brand icon in client/public/favicon.svg (infra)
- [x] T004 [P] Configure PWA web application manifest for standalone launching at /chart in client/public/manifest.webmanifest (infra)

---

## Phase 2: Foundational (Server Perimeter Security & Defensive Pipeline)

**Purpose**: Core HTTP middleware, security headers, request throttling, and payload boundaries

- [x] T005 [P] Implement Content-Security-Policy and standard defensive HTTP security headers in server/security.js (FR-001)
- [x] T006 Implement same-origin write barrier for state-changing API endpoints in server/security.js (FR-002)
- [x] T007 Implement in-memory 60-second sliding-window per-IP rate limiter in server/security.js (FR-003)
- [x] T008 [P] Enforce 2.5 MB JSON body cap, invalid JSON handling, and sanitized 404/500 error responses in server/index.js (FR-004)
- [x] T009 Enforce loopback proxy trust and disable x-powered-by header in server/index.js (FR-001)

---

## Phase 3: User Story 1 - Landing page converts visitors (Priority: P1) 🎯 MVP

**Goal**: Visitors land on `/`, explore features, compare monthly and yearly pricing cards loaded from `/api/plans`, and navigate into `/chart`.

- [x] T010 [P] [US1] Render hero, features, markets, pricing, FAQ, CTA band, and footer sections in client/index.html (FR-011)
- [x] T011 [P] [US1] Implement accessible keyboard skip link jumping to main content in client/index.html (FR-011)
- [x] T012 [US1] Implement bilingual translation dictionary (EN/FA) and language switch coordinator in client/landing/landing.js (FR-011)
- [x] T013 [US1] Implement in-place DOM re-localization and direction switching in client/landing/landing.js (FR-011)
- [x] T014 [US1] Persist selected language preference to localStorage tradingchart_user_settings in client/landing/landing.js (FR-011)
- [x] T015 [US1] Implement live plan catalog fetch from /api/plans and active tier filtering in client/landing/landing.js (FR-012)
- [x] T016 [US1] Render dynamic plan cards with plus highlight badge and unlimited value formatting in client/landing/landing.js (FR-012)
- [x] T017 [US1] Implement monthly and yearly billing cycle switch with aria-pressed updates in client/landing/landing.js (FR-012)
- [x] T018 [US1] Render localized failure fallback note when plan catalog fetch fails in client/landing/landing.js (FR-012)
- [x] T019 [US1] Bind pricing and hero CTA buttons to direct navigation into /chart in client/landing/landing.js (FR-012)
- [x] T020 [P] [US1] Style native expandable FAQ details accordion with +/− indicators in client/landing/landing.css (FR-011)
- [x] T021 [P] [US1] Implement multi-column grid collapse and full-width CTA buttons for mobile viewports in client/landing/landing.css (FR-013)
- [x] T022 [US1] Validate landing page E2E workflows, language round-trip, and touch targets in tests/qa_landing.cjs (FR-011, FR-012, FR-013)

---

## Phase 4: User Story 2 - Hardened HTTP surface (Priority: P1)

**Goal**: Platform enforces strict security headers, cross-origin write blocks, rate limits, sensitive file shielding, and leak-free errors.

- [x] T023 [P] [US2] Enforce HSTS header on HTTPS requests and no-store on API routes in server/security.js (FR-001)
- [x] T024 [P] [US2] Restrict static file serving strictly to dist directory and isolate sensitive files in server/index.js (FR-005)
- [x] T025 [US2] Restrict Cross-Origin Resource Sharing (CORS) to GET on public market endpoints in server/index.js (FR-006)
- [x] T026 [P] [US2] Implement generic 500 error handler suppressing internal stack traces in server/security.js (FR-004)
- [x] T027 [P] [US2] Implement public liveness health check endpoint returning no internal details in server/index.js (FR-009)
- [x] T028 [P] [US2] Verify 27 automated security regression checks in scripts/qa/security_smoke.sh (FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009)

---

## Phase 5: User Story 3 - Canonical domain, routes and discoverability (Priority: P2)

**Goal**: Alternate domains redirect to canonical host, routes serve correct bundles with caching, search crawlers are instructed, and RFC 9116 security contact is declared.

- [x] T029 [P] [US3] Implement HTTP 301 host canonicalization redirect for www and .ir domains in server/index.js (FR-007)
- [x] T030 [US3] Serve / and /chart with no-cache and /assets with 30-day immutable caching in server/index.js (FR-008)
- [x] T031 [US3] Mount /admin with no-store, frame denial, no-referrer, and noindex headers in server/index.js (FR-008)
- [x] T032 [US3] Render standalone bilingual 404 HTML document for unmapped web paths in server/index.js (FR-008)
- [x] T033 [P] [US3] Configure search crawler rules in client/public/robots.txt (FR-010)
- [x] T034 [P] [US3] Declare canonical sitemap URLs for / and /chart in client/public/sitemap.xml (FR-010)
- [x] T035 [P] [US3] Publish RFC 9116 security vulnerability contact declaration in client/public/.well-known/security.txt (FR-010)
- [x] T036 [P] [US3] Embed OpenGraph, Twitter card, and hreflang alternate tags in client/index.html (FR-010)

---

## Phase 6: Polish & Cross-Cutting Integration

**Purpose**: Full regression suite orchestration and cross-matrix verification

- [x] T037 [P] Enforce server plan filtering for inactive tiers on GET /api/plans in server/accounts.js (FR-012)
- [x] T038 [P] Enforce touch target minimums (>= 40x40px) and zero horizontal scroll in client/landing/landing.css (FR-013)
- [x] T039 [P] Orchestrate full sequential production QA chain across all matrix cells in scripts/qa/chain_prod.sh (FR-001, FR-011, FR-012, FR-013)
