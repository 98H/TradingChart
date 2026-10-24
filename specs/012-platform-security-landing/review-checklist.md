# Review checklist — specs/012-platform-security-landing

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

---

## Behaviour beyond the tests

- [ ] Content-Security-Policy strictly includes `script-src 'self' 'unsafe-eval'` for PineTS indicator compilation and prohibits inline scripts (`'unsafe-inline'`).
- [ ] `sameOriginWrites` middleware checks `req.headers.origin` against `Host` and `X-Forwarded-Host` for all `POST`, `PUT`, `PATCH`, `DELETE` calls to `/api/*`, returning `403 cross_origin_forbidden` on mismatch while permitting requests without `Origin` (curl, server automation).
- [ ] Sliding-window rate limiter in `server/security.js` tracks requests per IP over 60 seconds against `TC_API_RATE_PER_MIN` (default 900) and sends `Retry-After: <seconds>` on HTTP 429.
- [ ] In-memory rate limiting map `hits` auto-prunes stale records every 120 seconds using an unreferenced timer interval (`gc.unref()`).
- [ ] Body parser enforces 2.5 MB maximum payload size (`413 payload_too_large`) and catches malformed JSON with `400 invalid_json` without leaking stack traces.
- [ ] Server static asset hosting isolates internal server source code (`server/`), server data stores (`server/data/admin_master.key`), `.env`, `package.json`, and `.git/config` from public HTTP access.
- [ ] Host canonicalization in `server/index.js` permanently redirects `www.chartivia.com`, `chartivia.ir`, `www.chartivia.ir`, and `*.chartivia.ir` with HTTP 301 to `https://chartivia.com`, preserving the original request path.
- [ ] Administrative console route `/admin` is served with `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, nofollow`.
- [ ] Static hashed assets under `/assets/*` are served with `Cache-Control: public, max-age=2592000, immutable` (30 days), while HTML entry documents are served with `Cache-Control: no-cache`.
- [ ] Unmatched non-API web routes return a standalone bilingual 404 HTML document (`<h1>۴۰۴</h1>`) with navigation links to `/` and `/chart`.
- [ ] Public health check `GET /api/health` returns `{ status: 'online', product: 'Chartivia', timestamp }` with `Cache-Control: no-store` and zero server process or memory internals.
- [ ] Plan catalog endpoint `GET /api/plans` filters out inactive plans (`isActive === false`) for anonymous callers unless caller holds an admin session or matches the user's active tier.
- [ ] Landing page pricing grid highlights the `plus` tier with `.pop` styling and "محبوب‌ترین" / "Most popular" badge.
- [ ] Plan quota values equal to `-1` are rendered as "نامحدود" (FA) or "Unlimited" (EN).
- [ ] Plan loading failure renders a localized fallback note directing users to open `/chart`.
- [ ] Language switch updates `html[lang][dir]`, `document.title`, all `[data-i18n]` text, `[data-i18n-aria]` labels, persists language to `localStorage['tradingchart_user_settings']`, and carries over to `/chart`.

---

## Architecture boundaries

- [ ] Security headers, CSP directives, same-origin write barrier, per-IP rate limiting, and generic 500 error handlers reside exclusively in `server/security.js`.
- [ ] Server bootstrap, host redirects, static asset dispatch, route mounting, 404 handlers, and WebSocket live broadcasting reside exclusively in `server/index.js`.
- [ ] Subscription plan entitlement resolution and active tier filtering reside in `server/accounts.js:1043–1055`.
- [ ] Landing page semantic layout, SEO tags, OpenGraph/Twitter metadata, and section structure reside in `client/index.html`.
- [ ] Landing page bilingual dictionary, in-place DOM localizer, `/api/plans` fetcher, and billing cycle switcher reside in `client/landing/landing.js`.
- [ ] Landing page standalone styling, dark theme CSS variables, and responsive media queries reside in `client/landing/landing.css`.
- [ ] Search engine crawler rules, XML sitemap, PWA manifest, and RFC 9116 security contact declaration reside in `client/public/`.
- [ ] No chart engine (`@luxalgo/vela`), indicator packages (`pinets`), or drawing tool libraries are bundled or imported into `client/landing/`.

---

## Forbidden shortcuts

- [ ] No branches on test runners or environment detection (`NODE_ENV === 'test'`) in security middleware, CORS rules, or rate limiting logic.
- [ ] No placeholder, synthetic, or invented plan pricing numbers rendered on the landing page; all pricing data derives from `GET /api/plans`.
- [ ] No weakening or disabling of rate limiters, same-origin write checks, or CSP headers for testing or convenience.
- [ ] No plaintext exposure of master keys, secrets, or server source files over HTTP.
- [ ] No new external runtime NPM dependencies added for security, headers, or rate limiting.
- [ ] No hardcoded English or Persian strings in client JavaScript outside the bilingual dictionaries `EN` and `FA_FN`.

---

## Copy and UX (only items tests cannot see)

- [ ] Respectful formal Persian register with zero informal imperatives across landing page titles, feature descriptions, and FAQ answers.
- [ ] Strict Zero-Width Non-Joiner (ZWNJ, `\u200c`) usage in compound Persian words (e.g. `بیشتر دیده شوید`, `یک‌جا`, `پاین‌اسکریپت`, `چندنموداری`, `ذخیره‌شدنی`, `همگام‌سازی`).
- [ ] Persian numerals (`FA_DIGITS`) applied to counts, prices, and feature quotas in FA mode.
- [ ] Currency values (`$`), English acronyms (`BTCUSDT`, `RSI`, `MACD`, `PWA`, `FAQ`), and email addresses maintain strict LTR orientation.
- [ ] Keyboard accessibility: `.skip` link slides into view upon Tab focus, enabling immediate bypass to `#main`.
- [ ] Native `<details>` FAQ accordions expand and collapse with keyboard Enter/Space without requiring custom JavaScript animation handlers.
- [ ] Viewports $\le 640$px collapse grids into single-column cards and expand hero action buttons to 100% width without horizontal overflow.
- [ ] Touch targets satisfy $\ge 40 \times 40$ px for all buttons, cycle toggles, language buttons, and summary rows on mobile viewports.
