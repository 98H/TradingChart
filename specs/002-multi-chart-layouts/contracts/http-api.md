# HTTP API Contract: Multi-Chart Layouts Cloud State

Server endpoints providing cloud synchronization and plan quota validation for multi-chart layout configurations and user workspaces.

---

## 1. `GET /api/user/state`

Retrieves the authenticated user's persisted cloud workspace state, including saved layouts, active layout snapshot, and synchronization settings.

- **Authentication**: Session cookie `tc_session` (`req.user` required).
- **Method**: `GET`
- **Path**: `/api/user/state`
- **Headers**:
  - `Cookie: tc_session=<session_token>`
- **Query Parameters**: None.

### Success Response (200 OK)

```json
{
  "ok": true,
  "state": {
    "layouts": [
      {
        "id": "usr_default",
        "name": "Institutional SMC Master",
        "nameFa": "طرح تحلیلی نهادی اسمارت مانی",
        "layoutId": "4",
        "badge": "4 Charts",
        "badgeFa": "۴ چارت",
        "sync": {
          "symbol": false,
          "timeframe": false,
          "crosshair": true,
          "viewport": true,
          "drawings": false,
          "style": false
        },
        "state": {
          "version": 2,
          "layoutId": "4",
          "name": "Institutional SMC Master",
          "cells": [
            { "id": "c1", "symbol": "universal:BTCUSDT", "timeframe": "60", "priceStyle": "candles", "indicators": [{ "nativeType": "volume" }] },
            { "id": "c2", "symbol": "universal:ETHUSDT", "timeframe": "60", "priceStyle": "candles", "indicators": [{ "nativeType": "volume" }] },
            { "id": "c3", "symbol": "universal:SOLUSDT", "timeframe": "60", "priceStyle": "candles", "indicators": [{ "nativeType": "volume" }] },
            { "id": "c4", "symbol": "universal:XAUUSD", "timeframe": "60", "priceStyle": "candles", "indicators": [{ "nativeType": "volume" }] }
          ]
        },
        "date": "2026-10-23"
      }
    ],
    "currentLayout": {
      "layoutId": "4",
      "name": "2x2 Quad Grid",
      "savedLayoutId": null,
      "sync": {
        "symbol": false,
        "timeframe": false,
        "crosshair": true,
        "viewport": true,
        "drawings": false,
        "style": false
      },
      "state": {
        "version": 2,
        "layoutId": "4",
        "name": "2x2 Quad Grid",
        "activeCellId": "c1",
        "cells": [
          { "id": "c1", "symbol": "universal:BTCUSDT", "timeframe": "60", "priceStyle": "candles", "watermark": true, "indicators": [] },
          { "id": "c2", "symbol": "universal:ETHUSDT", "timeframe": "60", "priceStyle": "candles", "watermark": true, "indicators": [] },
          { "id": "c3", "symbol": "universal:SOLUSDT", "timeframe": "60", "priceStyle": "candles", "watermark": true, "indicators": [] },
          { "id": "c4", "symbol": "universal:BNBUSDT", "timeframe": "60", "priceStyle": "candles", "watermark": true, "indicators": [] }
        ],
        "timestamp": 1729700000000
      },
      "timestamp": 1729700000000
    },
    "layoutSync": {
      "symbol": false,
      "timeframe": false,
      "crosshair": true,
      "viewport": true,
      "drawings": false,
      "style": false
    }
  },
  "updatedAt": 1729700000000,
  "plan": "plus"
}
```

### Error Responses

- **401 Unauthorized**: Missing, expired, or invalid session cookie.
  ```json
  {
    "ok": false,
    "error": "unauthenticated"
  }
  ```

---

## 2. `PUT /api/user/state`

Persists the full client workspace state to the user's cloud profile with optimistic concurrency control and plan quota validation.

- **Authentication**: Session cookie `tc_session` (`req.user` required).
- **Method**: `PUT`
- **Path**: `/api/user/state`
- **Headers**:
  - `Content-Type: application/json`
  - `Cookie: tc_session=<session_token>`
- **Request Body**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `state` | object | Yes | Key-value dictionary containing client localStorage state keys (`layouts`, `currentLayout`, `layoutSync`, `templates`, etc.). |
| `baseUpdatedAt` | number | No | Timestamp in ms of the state version the client read before modifying. Used for concurrency protection. |

```json
{
  "state": {
    "layouts": "[{\"id\":\"usr_default\",\"name\":\"Institutional SMC Master\",...}]",
    "currentLayout": "{\"layoutId\":\"4\",\"name\":\"2x2 Quad Grid\",...}",
    "layoutSync": "{\"symbol\":false,\"timeframe\":false,\"crosshair\":true,\"viewport\":true,\"drawings\":false,\"style\":false}"
  },
  "baseUpdatedAt": 1729700000000
}
```

### Validation & Limits

1. **Payload Size**: JSON payload byte length must not exceed `STATE_MAX_BYTES` (2MB / `2 * 1024 * 1024` bytes).
2. **Quota Checks**:
   - `savedLayouts`: Checked via `validateStateAgainstPlan(state, plan)`. The number of entries in `state.layouts` must not exceed `plan.savedLayouts` (unless unlimited `-1`).
   - `savedTemplates`: The number of entries in `state.templates` must not exceed `plan.savedTemplates`.
3. **Concurrency Control**: If `current.updatedAt > 0` and `Number(baseUpdatedAt || 0) < current.updatedAt`, the write is rejected as stale.

### Success Response (200 OK)

```json
{
  "ok": true,
  "updatedAt": 1729700500000
}
```

### Error Responses

- **400 Bad Request**: Payload is missing, non-object, an array, or fails JSON serialization.
  ```json
  {
    "ok": false,
    "error": "invalid_state"
  }
  ```

- **401 Unauthorized**: Request lacks valid session authentication.
  ```json
  {
    "ok": false,
    "error": "unauthenticated"
  }
  ```

- **403 Forbidden**: State payload exceeds the user's plan entitlements.
  ```json
  {
    "ok": false,
    "error": "limit_exceeded",
    "violations": [
      {
        "key": "layouts",
        "limit": 1,
        "current": 3
      }
    ]
  }
  ```

- **409 Conflict**: Optimistic concurrency collision detected (server state was modified by another session).
  ```json
  {
    "ok": false,
    "error": "conflict",
    "serverUpdatedAt": 1729700600000,
    "serverState": { ... }
  }
  ```

- **413 Payload Too Large**: State payload exceeds 2MB limit.
  ```json
  {
    "ok": false,
    "error": "state_too_large"
  }
  ```
