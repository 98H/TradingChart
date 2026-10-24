# HTTP API Contract: Accounts, Plans and Cloud Sync

Comprehensive specification of backend REST HTTP endpoints mounted in `server/accounts.js` and `server/index.js`.

---

## 1. Authentication & Identity

### 1.1 POST /api/auth/register

Registers a new user account, computes scrypt salt/hash, creates initial session, issues email verification code, and sets session cookie.

- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Authentication**: Anonymous
- **Rate Limit**: 5 requests per 60 seconds per IP (`rateGate(req, res, 'register', 5, 60000)`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "trader@example.com",
    "username": "trader_pro",
    "password": "StrongPassword123!",
    "displayName": "Trader Pro"
  }
  ```
- **Response (200 OK)**:
  - Header: `Set-Cookie: tc_session=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`
  ```json
  {
    "ok": true,
    "user": {
      "id": "u_f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "email": "trader@example.com",
      "username": "trader_pro",
      "displayName": "Trader Pro",
      "bio": "",
      "avatarPreset": "mecha",
      "location": "",
      "signature": "",
      "socialLinks": {},
      "plan": "basic",
      "planSince": 1729700000000,
      "role": "user",
      "isAdmin": false,
      "emailVerified": false,
      "createdAt": 1729700000000,
      "usernameChangesLeft": 2,
      "totpEnabled": false,
      "timezone": "UTC",
      "currency": "USD",
      "planRequest": null
    },
    "needsVerification": true
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Field validation errors
    ```json
    { "ok": false, "errors": [{ "field": "email", "code": "invalid_email" }] }
    { "ok": false, "errors": [{ "field": "username", "code": "invalid_username" }] }
    { "ok": false, "errors": [{ "field": "username", "code": "username_blocked" }] }
    { "ok": false, "errors": [{ "field": "password", "code": "password_weak" }] }
    ```
  - `403 Forbidden`: Registration closed by administrator
    ```json
    { "ok": false, "error": "registration_closed" }
    ```
  - `409 Conflict`: Duplicate email or username
    ```json
    { "ok": false, "errors": [{ "field": "email", "code": "email_taken" }] }
    { "ok": false, "errors": [{ "field": "username", "code": "username_taken" }] }
    ```
  - `429 Too Many Requests`: Rate limit exceeded
    ```json
    { "ok": false, "error": "rate_limited" }
    ```
  - `503 Service Unavailable`: Platform maintenance mode active
    ```json
    { "ok": false, "error": "maintenance" }
    ```

---

### 1.2 POST /api/auth/login

Authenticates a user via email or username plus password. Supports optional 2FA challenge.

- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Authentication**: Anonymous
- **Rate Limit**: 10 requests per 60 seconds per IP (`rateGate(req, res, 'login', 10, 60000)`)
- **Request Body**:
  ```json
  {
    "identity": "trader_pro",
    "password": "StrongPassword123!",
    "totpCode": "123456"
  }
  ```
- **Response (200 OK) — Success**:
  - Header: `Set-Cookie: tc_session=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`
  ```json
  {
    "ok": true,
    "user": { /* PublicUser object */ }
  }
  ```
- **Response (200 OK) — 2FA Required (Step 1)**:
  ```json
  {
    "ok": true,
    "totpRequired": true
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials
    ```json
    { "ok": false, "error": "invalid_credentials" }
    ```
  - `401 Unauthorized`: Invalid TOTP code
    ```json
    { "ok": false, "error": "invalid_totp", "totpRequired": true }
    ```
  - `403 Forbidden`: Account suspended
    ```json
    { "ok": false, "error": "account_suspended" }
    ```
  - `429 Too Many Requests`:
    ```json
    { "ok": false, "error": "rate_limited" }
    ```
  - `503 Service Unavailable`:
    ```json
    { "ok": false, "error": "maintenance" }
    ```

---

### 1.3 POST /api/auth/logout

Terminates the current device session and clears the session cookie.

- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Authentication**: Anonymous or Session
- **Response (200 OK)**:
  - Header: `Set-Cookie: tc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  ```json
  { "ok": true }
  ```

---

### 1.4 POST /api/auth/logout-all

Revokes all active sessions for the calling user and clears the local session cookie.

- **Method**: `POST`
- **Path**: `/api/auth/logout-all`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

### 1.5 GET /api/auth/me

Bootstraps user identity and session ID from the `tc_session` cookie.

- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Authentication**: Anonymous or Session
- **Response (200 OK) — Authenticated**:
  ```json
  {
    "ok": true,
    "user": { /* PublicUser object */ },
    "sessionId": "s_183491ba-0bb7-4566-a2dc-775cf518ef31"
  }
  ```
- **Response (200 OK) — Guest**:
  ```json
  {
    "ok": true,
    "user": null
  }
  ```

---

### 1.6 PATCH /api/auth/me

Updates user profile fields, social links (plan-gated), email address, or username.

- **Method**: `PATCH`
- **Path**: `/api/auth/me`
- **Authentication**: Session required
- **Request Body**:
  ```json
  {
    "displayName": "New Name",
    "username": "new_handle",
    "bio": "Crypto & Macro Trader",
    "location": "London, UK",
    "signature": "Risk management first.",
    "avatarPreset": "mecha",
    "timezone": "Europe/London",
    "currency": "GBP",
    "email": "new_email@example.com",
    "socialLinks": {
      "x": "trader_x",
      "youtube": "https://youtube.com/@trader",
      "website": "https://trader.com"
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": { /* Updated PublicUser object */ }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure
    ```json
    { "ok": false, "errors": [{ "field": "username", "code": "invalid_username" }] }
    { "ok": false, "errors": [{ "field": "username", "code": "username_blocked" }] }
    { "ok": false, "errors": [{ "field": "email", "code": "invalid_email" }] }
    { "ok": false, "errors": [{ "field": "socialLinks.x", "code": "invalid_link" }] }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `403 Forbidden`: Lifetime username limit reached or plan doesn't permit social network
    ```json
    { "ok": false, "errors": [{ "field": "username", "code": "username_limit" }] }
    { "ok": false, "errors": [{ "field": "socialLinks.website", "code": "plan_required" }] }
    ```
  - `409 Conflict`: Username or email already in use
    ```json
    { "ok": false, "errors": [{ "field": "username", "code": "username_taken" }] }
    { "ok": false, "errors": [{ "field": "email", "code": "email_taken" }] }
    ```

---

### 1.7 POST /api/auth/change-password

Changes password and invalidates all other active sessions while keeping the current session alive.

- **Method**: `POST`
- **Path**: `/api/auth/change-password`
- **Authentication**: Session required
- **Request Body**:
  ```json
  {
    "current": "OldPassword123!",
    "next": "NewStrongPassword456!"
  }
  ```
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_current" }
    { "ok": false, "error": "password_weak" }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

### 1.8 POST /api/auth/request-reset

Requests a 6-digit password reset code delivered via SMTP or queued in the admin outbox. Never leaks account existence.

- **Method**: `POST`
- **Path**: `/api/auth/request-reset`
- **Authentication**: Anonymous
- **Rate Limit**: 5 requests per 60 seconds per IP
- **Request Body**:
  ```json
  { "email": "trader@example.com" }
  ```
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 1.9 POST /api/auth/reset

Sets a new password using a delivered 6-digit reset code. Revokes all active sessions.

- **Method**: `POST`
- **Path**: `/api/auth/reset`
- **Authentication**: Anonymous
- **Rate Limit**: 10 requests per 60 seconds per IP
- **Request Body**:
  ```json
  {
    "identity": "trader@example.com",
    "code": "123456",
    "password": "NewStrongPassword789!"
  }
  ```
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_code" }
    { "ok": false, "error": "password_weak" }
    ```
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 1.10 POST /api/auth/request-verify

Requests a fresh 6-digit email verification code for the signed-in user.

- **Method**: `POST`
- **Path**: `/api/auth/request-verify`
- **Authentication**: Session required
- **Rate Limit**: 3 requests per 60 seconds per IP
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 1.11 POST /api/auth/verify

Confirms email verification using a 6-digit code.

- **Method**: `POST`
- **Path**: `/api/auth/verify`
- **Authentication**: Session required
- **Request Body**:
  ```json
  { "code": "123456" }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": { /* Updated PublicUser with emailVerified: true */ }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "ok": false, "error": "invalid_code" }`
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

### 1.12 POST /api/auth/2fa/setup

Generates a pending RFC 6238 TOTP base32 secret and `otpauth://` URI.

- **Method**: `POST`
- **Path**: `/api/auth/2fa/setup`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    "otpauthUrl": "otpauth://totp/Chartivia%3Atrader_pro?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Chartivia&digits=6&period=30"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `409 Conflict`: `{ "ok": false, "error": "already_enabled" }`

---

### 1.13 POST /api/auth/2fa/enable

Confirms and enables TOTP 2FA using a live 6-digit code.

- **Method**: `POST`
- **Path**: `/api/auth/2fa/enable`
- **Authentication**: Session required
- **Rate Limit**: 6 requests per 60 seconds per IP
- **Request Body**:
  ```json
  { "code": "123456" }
  ```
- **Response (200 OK)**:
  ```json
  { "ok": true, "totpEnabled": true }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "no_pending_setup" }
    { "ok": false, "error": "invalid_code" }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 1.14 POST /api/auth/2fa/disable

Disables TOTP 2FA. Requires both current password and a live 6-digit code.

- **Method**: `POST`
- **Path**: `/api/auth/2fa/disable`
- **Authentication**: Session required
- **Rate Limit**: 6 requests per 60 seconds per IP
- **Request Body**:
  ```json
  {
    "password": "StrongPassword123!",
    "code": "123456"
  }
  ```
- **Response (200 OK)**:
  ```json
  { "ok": true, "totpEnabled": false }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "not_enabled" }
    { "ok": false, "error": "invalid_credentials" }
    { "ok": false, "error": "invalid_code" }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 1.15 DELETE /api/auth/me

Permanently deletes the user account, removes active sessions, and deletes cloud state file.

- **Method**: `DELETE`
- **Path**: `/api/auth/me`
- **Authentication**: Session required
- **Rate Limit**: 3 requests per 60 seconds per IP
- **Request Body**:
  ```json
  { "password": "StrongPassword123!" }
  ```
- **Response (200 OK)**:
  - Header: `Set-Cookie: tc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  ```json
  { "ok": true, "deleted": true }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    { "ok": false, "errors": [{ "field": "password", "code": "invalid_credentials" }] }
    ```
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

## 2. Cloud State Synchronization

### 2.1 GET /api/user/state

Retrieves the calling user's stored workspace dictionary, last update timestamp, and plan ID.

- **Method**: `GET`
- **Path**: `/api/user/state`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "state": {
      "profile": "{...}",
      "settings": "{...}",
      "layouts": "[...]",
      "currentLayout": "{...}",
      "templates": "[...]",
      "userWatchlists": "[...]",
      "watchlists": "[\"BTCUSDT\",\"ETHUSDT\"]",
      "alerts": "[...]",
      "paperAccounts": "[...]",
      "paperActive": "acc-1",
      "watchlistFlags": "{...}",
      "priceStyle": "candles",
      "drawingFavorites": "[\"trend_line\",\"fib_retracement\"]",
      "pineCode": "//@version=5\nindicator(...)",
      "theme": "dark",
      "tradeJournal": "[...]",
      "customTimeframes": "[\"3m\",\"2h\"]",
      "layoutSync": "true",
      "soundMuted": "false"
    },
    "updatedAt": 1729700500000,
    "plan": "plus"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

### 2.2 PUT /api/user/state

Saves workspace settings to the cloud with 2MB budget enforcement, quota validation, and 409 conflict detection.

- **Method**: `PUT`
- **Path**: `/api/user/state`
- **Authentication**: Session required
- **Request Body**:
  ```json
  {
    "state": { /* 19 workspace key-value pairs */ },
    "baseUpdatedAt": 1729700500000
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "updatedAt": 1729700800000
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid state payload format
    ```json
    { "ok": false, "error": "invalid_state" }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `403 Forbidden`: Array quota exceeded for user's plan tier
    ```json
    {
      "ok": false,
      "error": "limit_exceeded",
      "violations": [
        { "key": "layouts", "limit": 1, "current": 3 }
      ]
    }
    ```
  - `409 Conflict`: Stale writer detected (server state is newer than `baseUpdatedAt`)
    ```json
    {
      "ok": false,
      "error": "conflict",
      "serverUpdatedAt": 1729700750000,
      "serverState": { /* Current server state dictionary */ }
    }
    ```
  - `413 Payload Too Large`: State document exceeds 2MB limit
    ```json
    { "ok": false, "error": "state_too_large" }
    ```

---

## 3. Session & Device Management

### 3.1 GET /api/user/sessions

Lists active devices and sessions for the calling user.

- **Method**: `GET`
- **Path**: `/api/user/sessions`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "sessions": [
      {
        "id": "s_183491ba-0bb7-4566-a2dc-775cf518ef31",
        "device": "Desktop Browser",
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
        "ip": "192.168.1.50",
        "createdAt": 1729700000000,
        "lastSeen": 1729700800000,
        "current": true
      },
      {
        "id": "s_92bc44aa-33ff-4112-b511-9922aa11bb02",
        "device": "Mobile Browser",
        "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...",
        "ip": "192.168.1.51",
        "createdAt": 1729690000000,
        "lastSeen": 1729695000000,
        "current": false
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

### 3.2 DELETE /api/user/sessions/:sid

Revokes a specific session row by its identifier.

- **Method**: `DELETE`
- **Path**: `/api/user/sessions/:sid`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  { "ok": true }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `404 Not Found`: `{ "ok": false, "error": "not_found" }`

---

## 4. Privacy & Data Export

### 4.1 GET /api/user/export

Exports complete account data (SafeUser, cloud state, active sessions) in JSON format.

- **Method**: `GET`
- **Path**: `/api/user/export`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "exportedAt": "2026-10-24T12:00:00.000Z",
    "user": {
      "id": "u_f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "email": "trader@example.com",
      "username": "trader_pro",
      "displayName": "Trader Pro",
      "plan": "plus",
      "createdAt": 1729700000000
    },
    "state": { /* Full 19-key cloud state dictionary */ },
    "sessions": [
      {
        "id": "s_183491ba-0bb7-4566-a2dc-775cf518ef31",
        "device": "Desktop Browser",
        "ua": "...",
        "ip": "...",
        "createdAt": 1729700000000,
        "lastSeen": 1729700800000
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

## 5. Plans & Upgrades

### 5.1 GET /api/plans

Retrieves the public plan matrix, prices, feature flags, the calling user's current plan, and quota usage.

- **Method**: `GET`
- **Path**: `/api/plans`
- **Authentication**: Anonymous or Session
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plans": {
      "basic": { /* Plan definition object */ },
      "essential": { /* Plan definition object */ },
      "plus": { /* Plan definition object */ },
      "premium": { /* Plan definition object */ },
      "ultimate": { /* Plan definition object */ }
    },
    "planOrder": ["basic", "essential", "plus", "premium", "ultimate"],
    "current": "plus",
    "usage": {
      "layouts": 2,
      "templates": 1,
      "watchlists": 3,
      "alerts": 12,
      "paperAccounts": 1,
      "stateBytes": 45120,
      "stateUpdatedAt": 1729700800000
    },
    "isAdmin": false
  }
  ```

---

### 5.2 POST /api/user/plan

Switches plan tier. Free tiers activate immediately; paid tiers create a pending request (202 Accepted) awaiting admin approval unless `TC_BILLING_MODE=simulated`.

- **Method**: `POST`
- **Path**: `/api/user/plan`
- **Authentication**: Session required
- **Rate Limit**: 10 requests per 60 seconds per IP (`rateGate(req, res, 'plan_request', 10, 60000)`)
- **Request Body**:
  ```json
  { "plan": "plus" }
  ```
- **Response (200 OK) — Immediate Switch (Free / Simulated / Admin)**:
  ```json
  {
    "ok": true,
    "user": { /* Updated PublicUser */ },
    "entitlements": { /* Plan object */ }
  }
  ```
- **Response (202 Accepted) — Pending Approval (Paid / Standard Mode)**:
  ```json
  {
    "ok": true,
    "pending": true,
    "user": { /* PublicUser with planRequest: { plan: "plus", at: 1729700800000 } */ }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "unknown_plan" }
    { "ok": false, "error": "plan_inactive", "message": "This plan is currently inactive." }
    ```
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`
  - `429 Too Many Requests`: `{ "ok": false, "error": "rate_limited" }`

---

### 5.3 DELETE /api/user/plan-request

Cancels a pending plan upgrade request.

- **Method**: `DELETE`
- **Path**: `/api/user/plan-request`
- **Authentication**: Session required
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": { /* PublicUser with planRequest: null */ }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "ok": false, "error": "unauthenticated" }`

---

## 6. Platform Information & External Gates

### 6.1 GET /api/platform

Fetches public platform status, open registration state, maintenance mode, global announcements, and email delivery capability.

- **Method**: `GET`
- **Path**: `/api/platform`
- **Authentication**: Anonymous
- **Response Headers**: `Cache-Control: no-store`
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "registrationOpen": true,
    "maintenanceMode": false,
    "announcement": null,
    "emailDelivery": true
  }
  ```

---

### 6.2 GET /api/candles (Entitlement Gate Header)

Validates historical candle query depth against the user's plan tier and exposes the cap in response headers.

- **Method**: `GET`
- **Path**: `/api/candles`
- **Query Parameters**: `symbol`, `timeframe`, `limit`, `from_time`, `to_time`
- **Response Headers**:
  - `X-History-Limit`: Number of historical bars permitted for user's tier (`10000` for basic/essential/plus, `20000` for premium, `40000` for ultimate).
