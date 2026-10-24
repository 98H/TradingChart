# HTTP API Contract: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This contract defines the HTTP endpoints, status codes, request/response payloads, and static entrypoints governing internationalisation, language synchronization, platform announcements, and error pages.

---

## 1. Platform Announcement & Public State

### `GET /api/platform`

Retrieves public operational status, registration availability, email delivery status, and active bilingual platform announcements.

- **Authentication**: Anonymous / Public.
- **Headers**:
  - Response: `Cache-Control: no-store`
- **Request Parameters**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "registrationOpen": true,
    "maintenanceMode": false,
    "announcement": {
      "level": "warning",
      "fa": "تعمیرات دوره‌ای سرور دوشنبه ساعت ۰۲:۰۰ بامداد انجام خواهد شد.",
      "en": "Scheduled server maintenance on Monday at 02:00 AM UTC.",
      "updatedAt": 1729785600000
    },
    "emailDelivery": false
  }
  ```
  *(Note: If no announcement is currently enabled, `announcement` is `null`)*.
- **Error Responses**:
  - `500 Internal Server Error`: `{ "ok": false, "error": "server_error" }`

---

## 2. User State & Language Sync

### `GET /api/user/state`

Retrieves the authenticated user's persisted cloud workspace state, including their saved language preference.

- **Authentication**: Required (Session cookie `tc_session` or `Authorization: Bearer <token>`).
- **Request Parameters**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "state": {
      "tradingchart_user_settings": {
        "language": "fa",
        "theme": "dark"
      }
    },
    "updatedAt": 1729785600000,
    "plan": "basic"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `500 Internal Server Error`: `{ "ok": false, "error": "server_error" }`

---

### `PUT /api/user/state`

Persists user workspace state and language preference to the user's atomic server store.

- **Authentication**: Required (Session cookie `tc_session` or `Authorization: Bearer <token>`).
- **Request Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "state": {
      "tradingchart_user_settings": {
        "language": "fa",
        "theme": "dark"
      }
    },
    "baseUpdatedAt": 1729785600000
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "updatedAt": 1729785900000
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    - Payload is not a JSON object: `{ "ok": false, "error": "invalid_state" }`
    - Malformed JSON body: `{ "ok": false, "error": "invalid_json" }`
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `403 Forbidden`: Quota or tier limit exceeded: `{ "ok": false, "error": "limit_exceeded", "violations": ["..."] }`
  - `409 Conflict`: Stale base write detected (optimistic concurrency):
    ```json
    {
      "ok": false,
      "error": "conflict",
      "serverUpdatedAt": 1729786000000,
      "serverState": { ... }
    }
    ```
  - `413 Payload Too Large`: State exceeds 2 MB (`STATE_MAX_BYTES = 2097152`): `{ "ok": false, "error": "state_too_large" }`
  - `500 Internal Server Error`: `{ "ok": false, "error": "server_error" }`

---

## 3. Localized Static Application Entrypoints

### `GET /`

Serves the bilingual landing page single-page application shell.

- **Authentication**: Anonymous / Public.
- **Response**: `200 OK` (Content-Type: `text/html; charset=UTF-8`).
- **Initial HTML Direction**: `<html lang="fa" dir="rtl">`.
- **Source File**: `client/index.html`.

---

### `GET /chart`

Serves the core trading and charting application workspace.

- **Authentication**: Anonymous / Public.
- **Response**: `200 OK` (Content-Type: `text/html; charset=UTF-8`).
- **Initial HTML Direction**: `<html lang="en">` (re-evaluated and mutated to `fa`/`rtl` dynamically by `main.js` on boot).
- **Source File**: `client/chart/index.html`.

---

### `GET /admin`

Serves the administrative back-office management console.

- **Authentication**: Anonymous (gate view) / Administrative session.
- **Response**: `200 OK` (Content-Type: `text/html; charset=UTF-8`).
- **Initial HTML Direction**: `<html lang="fa" dir="rtl">`.
- **Source File**: `client/admin/index.html`.

---

### `GET *` (Unmatched Route Handler / 404)

Serves a dedicated Persian RTL 404 page for any unmapped route outside the `/api/*` tree.

- **Authentication**: Anonymous / Public.
- **Response Status**: `404 Not Found`.
- **Headers**: `Cache-Control: no-cache`, `Content-Type: text/html; charset=utf-8`.
- **HTML Payload**:
  ```html
  <!doctype html>
  <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="robots" content="noindex">
      <title>صفحه پیدا نشد · Chartivia</title>
      ...
    </head>
    <body>
      <main>
        <h1>۴۰۴</h1>
        <p>صفحه‌ای که دنبال آن هستید پیدا نشد. · Page not found.</p>
        <a href="/">صفحه اصلی · Home</a>
        <a class="g" href="/chart">نمودار · Chart</a>
      </main>
    </body>
  </html>
  ```
