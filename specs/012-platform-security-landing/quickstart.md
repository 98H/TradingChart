# Quickstart & Verification: Platform, Security and Landing Page

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This guide provides instructions for launching the environment, manually verifying each of the three core user stories on a running Chartivia instance, and executing the automated security and browser E2E test suites.

---

## 1. Environment & Prerequisites

Ensure Node.js (v20+) is installed and the Chartivia server is running.

```bash
# Set base URL (defaults to port 8088)
export SDD_BASE_URL="http://127.0.0.1:8088"

# Check if the service is running and healthy
curl -s -o /dev/null -w "%{http_code}\n" "${SDD_BASE_URL}/api/health" || echo "Server not running"

# If not running, build the frontend and launch the server
npm run build && node server/index.js &
```

The application is mounted at:
- Marketing Landing Page: `${SDD_BASE_URL}/`
- Trading Application: `${SDD_BASE_URL}/chart`
- Admin Console: `${SDD_BASE_URL}/admin`

---

## 2. Manual Verification by User Story

### Story 1: Landing Page Converts Visitors (P1)

1. **Verify Default Persian RTL Layout & Sections**:
   - Open `${SDD_BASE_URL}/` in a clean browser window.
   - Confirm the page renders in Persian (`html[lang="fa"][dir="rtl"]`) with `Vazirmatn` typography.
   - Verify all 7 sections are present: Top Nav (`#top`), Hero (`.hero`), Features (`#features`), Markets (`#markets`), Pricing (`#pricing`), FAQ (`#faq`), CTA Band (`.cta-band`), and Footer (`.foot`).
2. **Verify Accessible Skip Link**:
   - Focus the browser URL bar, then press `Tab`.
   - Confirm the skip link appears at the top left (`رفتن به محتوای اصلی`).
   - Press `Enter`: confirm keyboard focus jumps directly to `#main`.
3. **Verify Pricing Hydration from `/api/plans`**:
   - Scroll down to the Pricing section (`#pricing`).
   - Confirm cards render dynamically for each active plan (`basic`, `plus`, `pro`, `ultimate`).
   - Verify the `plus` tier has highlighted styling (`.pop`) and the badge "محبوب‌ترین" / "Most popular".
   - Confirm unlimited feature quotas (value `-1`) display as "نامحدود" (or "Unlimited" in English).
4. **Verify Billing Cycle Toggle**:
   - Click the **سالانه (۲ ماه رایگان)** / **Yearly (2 months free)** button (`.cyc[data-cycle="y"]`).
   - Confirm button gains `.on` and `aria-pressed="true"`.
   - Verify all card prices immediately update to yearly discounted rates (`priceYearlyUSD`).
   - Click **ماهانه** / **Monthly** (`.cyc[data-cycle="m"]`): verify prices return to standard monthly rates.
5. **Verify Bilingual Language Switching**:
   - Click the language toggle button `#lang-toggle` (labeled `EN`).
   - Confirm document changes to `html[lang="en"][dir="ltr"]` with `Inter` typography.
   - Verify all texts, navigation links, buttons, and `document.title` update to English.
   - Confirm the toggle button label changes to `فا` with `aria-label="فارسی"`.
   - Toggle back to Persian: verify all original Persian texts and numbers restore losslessly.
6. **Verify CTAs and Language Persistence**:
   - Switch language to English (`EN`).
   - Click any primary CTA button ("Open chart" or "Start free").
   - Confirm browser navigates to `/chart` and the trading application boots in English (`lang="en"`).
7. **Verify Native FAQ Accordion**:
   - Scroll to FAQ section (`#faq`). Click any question `<summary>`.
   - Confirm the item expands smoothly and the trailing icon toggles from `+` to `−`.
8. **Verify Mobile Responsiveness (Viewport $\le 640$px)**:
   - Resize browser window or open DevTools device emulation at 390×844px.
   - Confirm:
     - Navigation links (`.links`) are hidden.
     - Features, Markets, and Pricing grids collapse into a single column.
     - Hero CTA buttons expand to 100% width.
     - Touch targets are at least 40×40 px.
     - No horizontal scrollbar appears (`scrollWidth - innerWidth <= 1`).

---

### Story 2: Hardened HTTP Surface (P1)

1. **Verify Security Headers**:
   ```bash
   curl -sI "${SDD_BASE_URL}/"
   ```
   - Confirm the presence of:
     - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; ...`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: SAMEORIGIN`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
     - `Cross-Origin-Opener-Policy: same-origin-allow-popups`
     - `Cross-Origin-Resource-Policy: same-origin`
   - Confirm that `X-Powered-By` header is completely absent.
   - Confirm that `Access-Control-Allow-Origin` is absent on HTML responses.
2. **Verify Cross-Origin Write Barrier**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST "${SDD_BASE_URL}/api/auth/login" \
     -H 'Content-Type: application/json' \
     -H 'Origin: https://evil.example.com' \
     -d '{}'
   ```
   - Confirm the response status is `403 Forbidden` with body `{"ok":false,"error":"cross_origin_forbidden"}`.
3. **Verify API Rate Limiting**:
   - Execute rapid automated requests against an API endpoint:
     ```bash
     for i in $(seq 1 950); do curl -s -o /dev/null "${SDD_BASE_URL}/api/health"; done
     ```
   - Confirm that requests beyond 900 return HTTP 429 with `{ "ok": false, "error": "rate_limited" }` and a `Retry-After` header.
4. **Verify Sensitive File Shielding**:
   ```bash
   for path in "server/data/admin_master.key" ".env" "package.json" "server/accounts.js" ".git/config"; do
     code=$(curl -s -o /dev/null -w "%{http_code}" "${SDD_BASE_URL}/${path}")
     echo "${path} -> HTTP ${code}"
   done
   ```
   - Confirm that none of the private files return HTTP 200 containing raw file contents.
5. **Verify Sanitized Error Handling**:
   - Send malformed JSON:
     ```bash
     curl -s -X POST "${SDD_BASE_URL}/api/auth/login" -H 'Content-Type: application/json' -d '{invalid'
     ```
     Confirm response is HTTP 400: `{"ok":false,"error":"invalid_json"}` (no stack traces).
   - Request unknown API route:
     ```bash
     curl -s "${SDD_BASE_URL}/api/non_existent_route"
     ```
     Confirm response is HTTP 404: `{"ok":false,"error":"not_found"}`.

---

### Story 3: Canonical Domain, Routes and Discoverability (P2)

1. **Verify Host Canonicalization 301 Redirects**:
   ```bash
   curl -sI -H 'Host: www.chartivia.com' "${SDD_BASE_URL}/chart" | grep -E "^(HTTP|Location:)"
   curl -sI -H 'Host: chartivia.ir' "${SDD_BASE_URL}/pricing" | grep -E "^(HTTP|Location:)"
   ```
   - Confirm HTTP 301 redirect with `Location: https://chartivia.com/chart` and `https://chartivia.com/pricing`.
2. **Verify Admin Console Protective Headers**:
   ```bash
   curl -sI "${SDD_BASE_URL}/admin"
   ```
   - Confirm `Cache-Control: no-store`.
   - Confirm `X-Frame-Options: DENY`.
   - Confirm `Referrer-Policy: no-referrer`.
   - Confirm `X-Robots-Tag: noindex, nofollow`.
3. **Verify Static Asset Caching**:
   - Inspect a static file under `/assets/`:
     ```bash
     curl -sI "${SDD_BASE_URL}/assets/styles.css"
     ```
     Confirm `Cache-Control: public, max-age=2592000, immutable`.
   - Inspect root `/`: confirm `Cache-Control: no-cache`.
4. **Verify Unknown Web Route 404**:
   ```bash
   curl -s "${SDD_BASE_URL}/unknown_page"
   ```
   - Confirm HTTP 404 with standalone HTML document containing `<h1>۴۰۴</h1>` and links to `/` and `/chart`.
5. **Verify Public Metadata & Compliance Endpoints**:
   - `curl -s "${SDD_BASE_URL}/robots.txt"`: verify `Allow: /`, `Disallow: /admin`, `Disallow: /api/`.
   - `curl -s "${SDD_BASE_URL}/sitemap.xml"`: verify valid XML containing `https://chartivia.com/` and `https://chartivia.com/chart`.
   - `curl -s "${SDD_BASE_URL}/manifest.webmanifest"`: verify JSON PWA manifest with `start_url: "/chart"`.
   - `curl -s "${SDD_BASE_URL}/.well-known/security.txt"`: verify RFC 9116 security contact declaration.

---

## 3. Automated Test Suites

### 3.1 Security Smoke Regression Suite (`scripts/qa/security_smoke.sh`)

Executes 27 automated assertions verifying headers, CORS, rate limits, path traversal, and file protection:

```bash
bash scripts/qa/security_smoke.sh
# Expected output:
# Total: 27 | Passed: 27 | Failed: 0
```

### 3.2 Real-Browser Landing E2E Suite (`tests/qa_landing.cjs`)

Executes headless Puppeteer tests with real mouse clicks across all viewport and language matrix cells:

```bash
# Run desktop Persian
node tests/qa_landing.cjs desktop fa

# Run desktop English
node tests/qa_landing.cjs desktop en

# Run mobile Persian
node tests/qa_landing.cjs mobile fa

# Run mobile English
node tests/qa_landing.cjs mobile en
```

### 3.3 Full Production Regression Chain (`scripts/qa/chain_prod.sh`)

Runs the full automated verification chain:

```bash
bash scripts/qa/chain_prod.sh
```
