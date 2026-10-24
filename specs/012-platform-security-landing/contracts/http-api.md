# HTTP & WebSocket API Contract: Platform, Security and Landing Page

**Branch**: `012-platform-security-landing` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](../spec.md)

This contract specifies the HTTP and WebSocket interfaces governing server security, perimeter routing, public platform endpoints, and static asset delivery for Chartivia.

---

## 1. Perimeter & Routing Middleware

### 1.1 Host Canonicalization Redirect

Intercepts incoming requests on legacy, national, or alternative domains and permanently redirects them to the canonical domain.

- **Method**: `ALL`
- **Path**: `*`
- **Trigger**: `req.headers.host` matches `www.chartivia.com`, `chartivia.ir`, `www.chartivia.ir`, or ends with `.chartivia.ir`.
- **Response**: `301 Moved Permanently`
- **Headers**:
  - `Location`: `https://chartivia.com${req.originalUrl}`

---

### 1.2 Global Security Headers Middleware

Applied to every HTTP response emitted by the server (`server/security.js:securityHeaders`).

- **Method**: `ALL`
- **Path**: `*`
- **Response Headers Applied**:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Cross-Origin-Resource-Policy: same-origin
  ```
- **Conditional Directives**:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (sent only if `req.secure` is true).
  - `Cache-Control: no-store` (applied to all paths starting with `/api/` unless already set).
  - `X-Powered-By` header is disabled globally via `app.disable('x-powered-by')`.

---

### 1.3 Same-Origin Write Barrier (`sameOriginWrites`)

Guards state-changing API endpoints against cross-site request forgery attacks.

- **Method**: `POST`, `PUT`, `PATCH`, `DELETE`
- **Path**: `/api/*`
- **Evaluation**:
  - If no `Origin` header is present (non-browser scripts, curl), request proceeds to endpoint auth.
  - If `Origin` header is present, its hostname is compared against `Host` and `X-Forwarded-Host`.
- **Error Response (403 Forbidden)**:
  ```json
  {
    "ok": false,
    "error": "cross_origin_forbidden"
  }
  ```

---

### 1.4 Global Per-IP API Rate Limiter (`apiRateLimit`)

Caps inbound request volume per IP across all `/api/*` routes within a sliding 60-second window.

- **Method**: `ALL`
- **Path**: `/api/*`
- **Threshold**: `TC_API_RATE_PER_MIN` (default `900` requests / 60 seconds).
- **Error Response (429 Too Many Requests)**:
  - Header: `Retry-After: <seconds_until_window_reset>`
  ```json
  {
    "ok": false,
    "error": "rate_limited"
  }
  ```

---

### 1.5 JSON Body Parser & API Error Middleware

Enforces request size limits and standardized JSON error structures.

- **Payload Limit**: `2.5mb`
- **Error Responses**:
  - `413 Payload Too Large` (body exceeds 2.5 MB):
    ```json
    {
      "ok": false,
      "error": "payload_too_large"
    }
    ```
  - `400 Bad Request` (malformed JSON syntax):
    ```json
    {
      "ok": false,
      "error": "invalid_json"
    }
    ```
  - `404 Not Found` (unmatched `/api/*` route):
    ```json
    {
      "ok": false,
      "error": "not_found"
    }
    ```
  - `500 Internal Server Error` (uncaught server exceptions):
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 2. Public Platform API Endpoints

### 2.1 GET /api/health

Public liveness and health check endpoint for reverse proxies and monitors.

- **Method**: `GET`
- **Path**: `/api/health`
- **Authentication**: Anonymous
- **Response Headers**:
  - `Cache-Control: no-store`
  - `Content-Type: application/json`
- **Response (200 OK)**:
  ```json
  {
    "status": "online",
    "product": "Chartivia",
    "timestamp": "2026-10-24T12:00:00.000Z"
  }
  ```

---

### 2.2 GET /api/plans

Retrieves subscription tier definitions, pricing, and feature quotas. Used by the landing page to dynamically render pricing cards.

- **Method**: `GET`
- **Path**: `/api/plans`
- **Authentication**: Anonymous or Authenticated Session
- **Response Headers**:
  - `Cache-Control: no-store`
  - `Content-Type: application/json`
- **Behavior**:
  - Inactive plans (`isActive === false`) are filtered out of `planOrder` and `plans` for anonymous visitors.
  - If authenticated, the user's current plan is included even if inactive.
  - If authenticated as an administrator (`isReqAdmin(req) === true`), all plans are returned.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plans": {
      "basic": {
        "id": "basic",
        "nameEn": "Basic",
        "nameFa": "پایه",
        "priceUSD": 0,
        "priceYearlyUSD": 0,
        "chartsPerTab": 1,
        "indicatorsPerChart": 3,
        "priceAlerts": 5,
        "histBars": 10000,
        "paperAccounts": 1,
        "webhookAlerts": false,
        "deepBacktest": false,
        "isActive": true,
        "isDefault": true
      },
      "plus": {
        "id": "plus",
        "nameEn": "Plus",
        "nameFa": "پلاس",
        "priceUSD": 14,
        "priceYearlyUSD": 12,
        "chartsPerTab": 2,
        "indicatorsPerChart": 5,
        "priceAlerts": 20,
        "histBars": 25000,
        "paperAccounts": 2,
        "webhookAlerts": true,
        "deepBacktest": false,
        "isActive": true
      },
      "pro": {
        "id": "pro",
        "nameEn": "Pro",
        "nameFa": "حرفه‌ای",
        "priceUSD": 29,
        "priceYearlyUSD": 24,
        "chartsPerTab": 4,
        "indicatorsPerChart": 10,
        "priceAlerts": 100,
        "histBars": 50000,
        "paperAccounts": 5,
        "webhookAlerts": true,
        "deepBacktest": true,
        "isActive": true
      }
    },
    "planOrder": ["basic", "plus", "pro"],
    "current": null,
    "usage": null,
    "isAdmin": false
  }
  ```

---

## 3. Web Page & Static Routes

### 3.1 GET / & GET /index.html

Serves the standalone marketing landing page HTML.

- **Method**: `GET`
- **Path**: `/` or `/index.html`
- **Authentication**: Anonymous
- **Response Headers**:
  - `Content-Type: text/html; charset=utf-8`
  - `Cache-Control: no-cache`
  - Standard security headers (CSP, nosniff, SAMEORIGIN, etc.)
- **Response (200 OK)**: HTML document `dist/index.html`.

---

### 3.2 GET /chart & GET /chart/*

Serves the main trading workspace application HTML shell.

- **Method**: `GET`
- **Path**: `/chart` or `/chart/*`
- **Authentication**: Anonymous / User
- **Response Headers**:
  - `Content-Type: text/html; charset=utf-8`
  - `Cache-Control: no-cache`
- **Response (200 OK)**: HTML document `dist/chart/index.html`.

---

### 3.3 GET /admin & GET /admin/*

Serves the administrative console HTML shell with hardened protection headers.

- **Method**: `GET`
- **Path**: `/admin` or `/admin/*`
- **Authentication**: Anonymous (UI gated by client authentication)
- **Response Headers**:
  - `Content-Type: text/html; charset=utf-8`
  - `Cache-Control: no-store`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Robots-Tag: noindex, nofollow`
- **Response (200 OK)**: HTML document `dist/admin/index.html`.

---

### 3.4 GET /assets/*

Serves Vite content-hashed static assets (scripts, styles, SVGs, web fonts).

- **Method**: `GET`
- **Path**: `/assets/*`
- **Response Headers**:
  - `Cache-Control: public, max-age=2592000, immutable` (30 days)
- **Response (200 OK / 304 Not Modified)**: Hashed file from `dist/assets/`.

---

### 3.5 Public Crawler & Compliance Files

Serves root public metadata files:

- `GET /robots.txt`:
  - `Content-Type: text/plain`
  - Allows `/`, disallows `/admin` and `/api/`, references sitemap.
- `GET /sitemap.xml`:
  - `Content-Type: application/xml`
  - Lists canonical URLs for `/` and `/chart`.
- `GET /manifest.webmanifest`:
  - `Content-Type: application/manifest+json`
  - PWA application manifest (`start_url: "/chart"`, `display: "standalone"`).
- `GET /.well-known/security.txt`:
  - `Content-Type: text/plain`
  - RFC 9116 security contact declaration.
- `GET /favicon.svg`:
  - `Content-Type: image/svg+xml`

---

### 3.6 GET * (Unknown Pages 404)

Renders a standalone bilingual 404 page for unmatched non-API routes.

- **Method**: `GET`
- **Path**: Any unmapped route outside `/api/*` and static assets.
- **Response Headers**:
  - `Status`: `404 Not Found`
  - `Content-Type: text/html; charset=utf-8`
  - `Cache-Control: no-cache`
- **Response Body**: HTML document with `<h1>۴۰۴</h1>`, text "صفحه‌ای که دنبال آن هستید پیدا نشد. · Page not found.", and navigation links to `/` and `/chart`.

---

## 4. WebSocket Live Stream

### 4.1 WS /ws/live

Bidirectional real-time market ticker broadcast channel.

- **Protocol**: `ws` or `wss`
- **Mount Path**: `/ws/live`
- **Limits**:
  - Maximum payload frame size: `4096` bytes.
  - Maximum concurrent connections: `2000`. Handshakes exceeding capacity are closed with code `1013 'busy'`.
  - Maximum subscriptions per socket: `50` symbols.
- **Client Inbound Frames**:
  - Subscribe to symbol:
    ```json
    { "action": "subscribe", "symbol": "BTCUSDT" }
    ```
  - Unsubscribe from symbol:
    ```json
    { "action": "unsubscribe", "symbol": "BTCUSDT" }
    ```
- **Server Outbound Frames** (Broadcast every 1200 ms):
  ```json
  {
    "type": "tick",
    "symbol": "BTCUSDT",
    "price": 68420.5,
    "change": 1250.2,
    "changePct": 1.86,
    "high": 69100.0,
    "low": 66800.0,
    "volume": 24150.32,
    "time": 1729771200000
  }
  ```
