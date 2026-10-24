# HTTP API Contract: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](../spec.md)

This document specifies the REST HTTP endpoints powering the Chartivia back-office administration console. Endpoints are mounted in `server/adminApi.js` and `server/accounts.js`.

---

## 1. Authentication & Session Management

### 1.1 POST /api/admin/auth

Unlocks the admin console using the root master key secret, creating an ephemeral 12-hour admin session cookie.

- **Method**: `POST`
- **Path**: `/api/admin/auth`
- **Authentication**: Anonymous
- **Rate Limit**: Max 5 requests per 60 seconds per IP (`rateGate(req, res, 'admin_auth', 5, 60000)`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "masterKey": "secret_master_key_string"
  }
  ```
- **Response (200 OK)**:
  - Header: `Set-Cookie: tc_admin=<token>; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200[; Secure]`
  ```json
  {
    "ok": true,
    "isAdmin": true,
    "expiresAt": 1729785600000
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "invalid_master_key" }
    ```
  - `429 Too Many Requests`:
    ```json
    { "ok": false, "error": "rate_limited" }
    ```

---

### 1.2 GET /api/admin/session

Inspects the administrative authorization state of the current caller.

- **Method**: `GET`
- **Path**: `/api/admin/session`
- **Authentication**: Anonymous / Admin
- **Request Headers**: None
- **Response (200 OK - Non-admin)**:
  ```json
  {
    "ok": true,
    "isAdmin": false
  }
  ```
- **Response (200 OK - Admin)**:
  ```json
  {
    "ok": true,
    "isAdmin": true,
    "via": "token",
    "actor": "admin-session a1b2c3",
    "userId": null,
    "username": null,
    "expiresAt": 1729785600000
  }
  ```
  *(Note: When authenticated via user role, `via` is `"role"`, `actor` is username, `userId` is `'u_...'`, and `expiresAt` is `null`)*.

---

### 1.3 POST /api/admin/logout

Revokes the caller's active admin session and clears the `tc_admin` cookie.

- **Method**: `POST`
- **Path**: `/api/admin/logout`
- **Authentication**: Admin session (`tc_admin`)
- **Request Headers**: None
- **Response (200 OK)**:
  - Header: `Set-Cookie: tc_admin=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`
  ```json
  {
    "ok": true
  }
  ```

---

## 2. Dashboard Overview

### 2.1 GET /api/admin/overview

Aggregates high-level business and operational KPIs, 30-day signup trajectories, plan distributions, and recent audit events.

- **Method**: `GET`
- **Path**: `/api/admin/overview`
- **Authentication**: Admin (`isReqAdmin`)
- **Query Parameters**:
  - `type` (`string`, optional): Scope filter. One of `'all'`, `'real'`, `'test'`. Default `'all'`.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "generatedAt": 1729700000000,
    "type": "real",
    "testCount": 12,
    "totalAll": 150,
    "kpi": {
      "users": 138,
      "new24": 4,
      "new7": 19,
      "new30": 62,
      "prev30": 45,
      "active24": 28,
      "active7": 84,
      "activeSessions": 35,
      "adminSessions": 1,
      "verified": 110,
      "twofa": 22,
      "suspended": 2,
      "admins": 3,
      "paid": 40,
      "planRequests": 1,
      "mrr": 1160.00,
      "plans": 5
    },
    "planDist": [
      {
        "id": "basic",
        "nameEn": "Basic",
        "nameFa": "پایه",
        "color": "#8b93a7",
        "count": 98,
        "priceUSD": 0
      }
    ],
    "signups": [
      { "day": "2026-09-24", "count": 2 },
      { "day": "2026-10-23", "count": 5 }
    ],
    "recentUsers": [],
    "recentEvents": []
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

## 3. Users Management

### 3.1 GET /api/admin/users

Returns a paginated, sorted, and filtered list of user accounts with admin-specific metadata.

- **Method**: `GET`
- **Path**: `/api/admin/users`
- **Authentication**: Admin (`isReqAdmin`)
- **Query Parameters**:
  - `q` (`string`, optional): Case-insensitive search term matching email, username, display name, or user ID.
  - `plan` (`string`, optional): Filter by plan ID or `'all'`.
  - `role` (`string`, optional): Filter by role (`'admin'`, `'user'`, or `'all'`).
  - `status` (`string`, optional): Filter by status (`'active'`, `'suspended'`, `'verified'`, `'unverified'`, `'twofa'`, `'plan_request'`).
  - `type` (`string`, optional): Scope filter (`'all'`, `'real'`, `'test'`). Default `'all'`.
  - `sort` (`string`, optional): Sort field (`'createdAt'`, `'lastSeen'`, `'username'`, `'email'`, `'plan'`, `'sessions'`). Default `'createdAt'`.
  - `dir` (`string`, optional): Sort direction (`'asc'` or `'desc'`). Default `'desc'`.
  - `page` (`number`, optional): Page number (1-indexed). Default `1`.
  - `pageSize` (`number`, optional): Items per page (between 5 and 100). Default `20`.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "total": 45,
    "testCount": 0,
    "page": 1,
    "pages": 3,
    "pageSize": 20,
    "users": [
      {
        "id": "u_f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "email": "trader@example.com",
        "username": "trader_pro",
        "displayName": "Trader Pro",
        "plan": "pro",
        "planName": "Pro",
        "planKnown": true,
        "planSince": 1729700000000,
        "role": "user",
        "isAdmin": false,
        "emailVerified": true,
        "totpEnabled": false,
        "isTest": false,
        "testOverride": false,
        "suspended": false,
        "suspendedAt": null,
        "suspendReason": "",
        "notes": "",
        "lastSeen": 1729705000000,
        "sessions": 1,
        "createdAt": 1729600000000,
        "timezone": "UTC",
        "currency": "USD",
        "usernameChangesLeft": 2,
        "planRequest": null
      }
    ]
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.2 GET /api/admin/users.csv

Exports the filtered user roster as a UTF-8 BOM CSV file with formula-injection guardrails.

- **Method**: `GET`
- **Path**: `/api/admin/users.csv`
- **Authentication**: Admin (`isReqAdmin`)
- **Query Parameters**: Same filters as `GET /api/admin/users` (`q, plan, role, status, type, sort, dir`).
- **Response (200 OK)**:
  - Header: `Content-Type: text/csv; charset=utf-8`
  - Header: `Content-Disposition: attachment; filename="tradingchart-users-YYYY-MM-DD.csv"`
  - Body: Begins with UTF-8 BOM `\ufeff`, followed by CSV lines:
    ```csv
    id,username,email,displayName,plan,role,emailVerified,totpEnabled,suspended,isTest,createdAt,lastSeen,sessions
    u_f47ac10b-58cc-4372-a567-0e02b2c3d479,trader_pro,trader@example.com,Trader Pro,pro,user,true,false,false,false,2026-10-23T12:00:00.000Z,2026-10-23T14:30:00.000Z,1
    ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.3 GET /api/admin/users/:id

Retrieves detailed information for a specific user, including active sessions, cloud state usage, and recent audit events.

- **Method**: `GET`
- **Path**: `/api/admin/users/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": { "...AdminUserRow..." },
    "sessions": [
      {
        "id": "s_183491ba-0bb7-4566-a2dc-775cf518ef31",
        "device": "Desktop Browser",
        "ua": "Mozilla/5.0 ...",
        "ip": "192.168.1.50",
        "createdAt": 1729700000000,
        "lastSeen": 1729705000000
      }
    ],
    "usage": {
      "layouts": 3,
      "templates": 5,
      "watchlists": 2,
      "alerts": 8,
      "paperAccounts": 1,
      "stateBytes": 145020,
      "stateUpdatedAt": 1729704800000
    },
    "events": [
      {
        "id": "ev_123456",
        "at": 1729700000000,
        "action": "user.update",
        "ok": true,
        "actor": "admin",
        "actorVia": "role",
        "ip": "127.0.0.1",
        "target": "u_...",
        "meta": {}
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.4 PATCH /api/admin/users/:id

Updates user attributes including plan, role, suspension status, email verification, notes, and test account flag.

- **Method**: `PATCH`
- **Path**: `/api/admin/users/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "plan": "premium",
    "planRequest": null,
    "role": "admin",
    "suspended": true,
    "suspendReason": "Terms of service violation",
    "emailVerified": true,
    "displayName": "Verified Trader",
    "testAccount": true,
    "notes": "Reviewed and verified identity"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": { "...AdminUserRow..." },
    "changed": true
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "unknown_plan" }
    { "ok": false, "error": "cannot_demote_self" }
    { "ok": false, "error": "cannot_suspend_self" }
    { "ok": false, "error": "invalid_display_name" }
    ```
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.5 POST /api/admin/users/:id/revoke-sessions

Terminates all active device sessions for a specified user.

- **Method**: `POST`
- **Path**: `/api/admin/users/:id/revoke-sessions`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "revoked": 3
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.6 DELETE /api/admin/users/:id/sessions/:sid

Terminates a specific device session for a user.

- **Method**: `DELETE`
- **Path**: `/api/admin/users/:id/sessions/:sid`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true
  }
  ```
- **Error Responses**:
  - `404 Not Found`:
    ```json
    { "ok": false, "error": "user_not_found" }
    { "ok": false, "error": "session_not_found" }
    ```
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.7 POST /api/admin/users/:id/reset-2fa

Disables TOTP 2FA for a user account, clearing active and pending TOTP secrets.

- **Method**: `POST`
- **Path**: `/api/admin/users/:id/reset-2fa`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "ok": false, "error": "twofa_not_enabled" }`
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.8 POST /api/admin/users/:id/send-reset

Generates a 6-digit password recovery code valid for 15 minutes. Delivers via SMTP if configured; otherwise returns the code directly in the response for manual admin delivery.

- **Method**: `POST`
- **Path**: `/api/admin/users/:id/send-reset`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK - SMTP Configured)**:
  ```json
  {
    "ok": true,
    "mailed": true,
    "expiresAt": 1729700900000
  }
  ```
- **Response (200 OK - No SMTP)**:
  ```json
  {
    "ok": true,
    "mailed": false,
    "code": "849201",
    "expiresAt": 1729700900000
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.9 DELETE /api/admin/users/:id

Permanently deletes a user account, all associated device sessions, in-memory state caches, and cloud workspace state files.

- **Method**: `DELETE`
- **Path**: `/api/admin/users/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "confirm": "trader_pro"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "deleted": "u_f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "cannot_delete_self" }
    { "ok": false, "error": "confirm_mismatch" }
    ```
  - `404 Not Found`: `{ "ok": false, "error": "user_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 3.10 POST /api/admin/users/bulk

Performs bulk actions across up to 1000 selected user IDs.

- **Method**: `POST`
- **Path**: `/api/admin/users/bulk`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "ids": ["u_1", "u_2", "u_3"],
    "action": "suspend",
    "plan": "premium"
  }
  ```
  *(Supported actions: `'suspend'`, `'unsuspend'`, `'plan'`, `'verify'`, `'delete'`)*.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "done": 2,
    "skipped": 1
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_ids" }
    { "ok": false, "error": "invalid_action" }
    { "ok": false, "error": "unknown_plan" }
    ```
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

## 4. Audit Trail

### 4.1 GET /api/admin/audit

Retrieves filtered, paginated events from `server/data/accounts/audit.jsonl`.

- **Method**: `GET`
- **Path**: `/api/admin/audit`
- **Authentication**: Admin (`isReqAdmin`)
- **Query Parameters**:
  - `q` (`string`, optional): Search query matching any event attribute.
  - `action` (`string`, optional): Exact action filter or `'all'`.
  - `status` (`string`, optional): Filter by outcome (`'ok'`, `'failed'`, or `'all'`).
  - `page` (`number`, optional): Page number. Default `1`.
  - `pageSize` (`number`, optional): Items per page (5 to 100). Default `25`.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "total": 120,
    "page": 1,
    "pages": 5,
    "pageSize": 25,
    "actions": ["admin.lock", "admin.unlock", "plan.update", "user.update", "users.export"],
    "events": [
      {
        "id": "ev_8a9b1c",
        "at": 1729705000000,
        "action": "plan.update",
        "ok": true,
        "actor": "admin",
        "actorVia": "role",
        "ip": "127.0.0.1",
        "target": "pro",
        "meta": { "fields": ["priceUSD", "priceYearlyUSD"] }
      }
    ]
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

## 5. Platform Settings & System Health

### 5.1 GET /api/admin/settings

Retrieves the complete platform configuration.

- **Method**: `GET`
- **Path**: `/api/admin/settings`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "settings": {
      "registrationOpen": true,
      "maintenanceMode": false,
      "announcementEnabled": true,
      "announcementLevel": "info",
      "announcementFa": "بروزرسانی سرور امشب انجام می‌شود.",
      "announcementEn": "Server maintenance scheduled tonight.",
      "testDomains": ["test.io", "qa.test", "example.com"],
      "updatedAt": 1729700000000
    }
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 5.2 PUT /api/admin/settings

Updates platform settings fields.

- **Method**: `PUT`
- **Path**: `/api/admin/settings`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "registrationOpen": false,
    "maintenanceMode": false,
    "announcementEnabled": true,
    "announcementLevel": "warning",
    "announcementFa": "ثبت‌نام موقتاً بسته است.",
    "announcementEn": "Registration temporarily closed.",
    "testDomains": ["test.io", "qa.test"]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "settings": { "...PlatformSettings..." },
    "changed": ["registrationOpen", "announcementLevel"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    {
      "ok": false,
      "error": "validation_failed",
      "errors": [
        { "field": "testDomains", "code": "invalid_domain", "values": ["invalid_domain"] },
        { "field": "announcement", "code": "announcement_empty" },
        { "field": "announcementLevel", "code": "invalid" }
      ]
    }
    ```
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 5.3 GET /api/admin/system

Reports process metrics, OS telemetry, storage counts, email status, and outbound code queues.

- **Method**: `GET`
- **Path**: `/api/admin/system`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "server": {
      "uptimeSec": 14250,
      "bootAt": 1729690000000,
      "node": "v20.18.0",
      "rssMB": 185,
      "heapMB": 92,
      "load": [0.42, 0.38, 0.25],
      "cpus": 4,
      "memTotalMB": 8192,
      "memFreeMB": 4210,
      "keySource": "file"
    },
    "storage": {
      "users": 150,
      "sessions": 42,
      "stateFiles": 150,
      "stateBytes": 3410500
    },
    "outbox": [
      {
        "kind": "reset",
        "email": "user@example.com",
        "code": "123456",
        "at": "2026-10-23T14:00:00.000Z"
      }
    ],
    "mail": {
      "enabled": false,
      "configured": false
    }
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 5.4 GET /api/admin/sessions

Lists active master-key-authenticated admin sessions.

- **Method**: `GET`
- **Path**: `/api/admin/sessions`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "sessions": [
      {
        "id": "as_a1b2c3d4e5f6",
        "ip": "127.0.0.1",
        "ua": "Mozilla/5.0 ...",
        "userId": null,
        "createdAt": 1729700000000,
        "expiresAt": 1729743200000,
        "current": true
      }
    ]
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 5.5 DELETE /api/admin/sessions/:id

Revokes an active master key admin session.

- **Method**: `DELETE`
- **Path**: `/api/admin/sessions/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "self": true
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "ok": false, "error": "session_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

## 6. Plans Catalog & Quotas Management

### 6.1 GET /api/admin/plans

Returns the complete plan catalog, feature definitions, and user assignment metrics.

- **Method**: `GET`
- **Path**: `/api/admin/plans`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plans": {
      "basic": {
        "id": "basic",
        "nameEn": "Basic",
        "nameFa": "پایه",
        "badge": "Free",
        "badgeFa": "رایگان",
        "descriptionEn": "Free charting essentials",
        "descriptionFa": "امکانات ضروری نمودار",
        "priceUSD": 0,
        "priceYearlyUSD": 0,
        "color": "#8b93a7",
        "isActive": true,
        "isDefault": true,
        "order": 0,
        "features": {
          "maxChartsPerLayout": 1,
          "savedLayouts": 1
        }
      }
    },
    "planOrder": ["basic", "pro", "premium"],
    "catalog": [
      {
        "id": "maxChartsPerLayout",
        "category": "chart",
        "type": "quota",
        "nameEn": "Charts per layout",
        "nameFa": "نمودار در هر چیدمان",
        "min": 1,
        "max": 16,
        "unitEn": "charts",
        "unitFa": "نمودار"
      }
    ],
    "categories": [
      { "id": "chart", "nameEn": "Chart & Layouts", "nameFa": "نمودار و چیدمان‌ها" }
    ],
    "builtin": ["basic", "pro", "premium"],
    "userCounts": {
      "basic": 110,
      "pro": 35,
      "premium": 5
    }
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.2 POST /api/admin/plans

Creates a new custom plan tier.

- **Method**: `POST`
- **Path**: `/api/admin/plans`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "id": "elite",
    "nameEn": "Elite Trader",
    "nameFa": "معامله‌گر نخبه",
    "priceUSD": 49.99,
    "priceYearlyUSD": 499.00,
    "color": "#f59e0b",
    "isActive": true,
    "isDefault": false,
    "features": {
      "maxChartsPerLayout": 8,
      "savedLayouts": 25
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plan": { "...Plan..." },
    "planOrder": ["basic", "pro", "premium", "elite"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_plan_id", "message": "Plan ID must be 2–32 alphanumeric chars or hyphens/underscores" }
    { "ok": false, "error": "plan_exists", "message": "A plan with this ID already exists" }
    { "ok": false, "error": "validation_failed", "errors": ["nameEn is required"] }
    ```
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.3 PUT /api/admin/plans/:id

Updates attributes or feature quotas for an existing plan tier.

- **Method**: `PUT`
- **Path**: `/api/admin/plans/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "nameFa": "حرفه‌ای پیشرفته",
    "priceUSD": 29.99,
    "features": {
      "savedLayouts": 15
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plan": { "...Plan..." },
    "planOrder": ["basic", "pro", "premium"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "validation_failed", "errors": [] }
    { "ok": false, "error": "cannot_unset_default", "message": "Mark another plan as default instead" }
    { "ok": false, "error": "default_must_be_active", "message": "The default plan must stay active" }
    ```
  - `404 Not Found`: `{ "ok": false, "error": "plan_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.4 DELETE /api/admin/plans/:id

Deletes a custom plan tier and automatically migrates all assigned users to the default plan.

- **Method**: `DELETE`
- **Path**: `/api/admin/plans/:id`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "deleted": "elite",
    "fallbackPlan": "basic",
    "migratedUsers": 12,
    "planOrder": ["basic", "pro", "premium"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "cannot_delete_last_plan" }
    { "ok": false, "error": "cannot_delete_default_plan", "message": "Set another plan as default before deleting this one" }
    { "ok": false, "error": "cannot_delete_builtin_plan", "message": "Built-in plans cannot be deleted; deactivate it instead" }
    ```
  - `404 Not Found`: `{ "ok": false, "error": "plan_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.5 POST /api/admin/plans/reorder

Updates the display sort order of plans.

- **Method**: `POST`
- **Path**: `/api/admin/plans/reorder`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "order": ["basic", "premium", "pro"]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "planOrder": ["basic", "premium", "pro"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "ok": false, "error": "invalid_order" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.6 POST /api/admin/plans/clone

Duplicates an existing plan and its feature matrix under a new plan ID.

- **Method**: `POST`
- **Path**: `/api/admin/plans/clone`
- **Authentication**: Admin (`isReqAdmin`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "sourceId": "pro",
    "newId": "pro_plus",
    "nameEn": "Pro Plus",
    "nameFa": "پرو پلاس"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plan": { "...Plan..." },
    "planOrder": ["basic", "pro", "premium", "pro_plus"]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_new_id" }
    { "ok": false, "error": "plan_exists" }
    { "ok": false, "error": "validation_failed", "errors": [] }
    ```
  - `404 Not Found`: `{ "ok": false, "error": "source_plan_not_found" }`
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`

---

### 6.7 POST /api/admin/plans/reset

Restores canonical seed plans (`basic`, `pro`, `premium`), removes custom tiers, and migrates orphaned users to the fallback plan.

- **Method**: `POST`
- **Path**: `/api/admin/plans/reset`
- **Authentication**: Admin (`isReqAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "plans": { "...SeedPlans..." },
    "planOrder": ["basic", "pro", "premium"]
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{ "ok": false, "error": "forbidden_admin_only" }`
