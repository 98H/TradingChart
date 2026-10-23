# HTTP API Contract: Drawing Tools Cloud State

Server endpoints providing user cloud state persistence and profile synchronization for drawing tools favorites and layout drawing documents.

---

## 1. `GET /api/user/state`

Retrieves the authenticated user's workspace state, including favorite drawing tool keys (`drawingFavorites`), active layout snapshot (`currentLayout`), and saved layouts (`layouts`).

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
    "drawingFavorites": [
      "trendline",
      "hline",
      "ray",
      "fibretracement",
      "box",
      "position",
      "datepricerange",
      "freehand",
      "text"
    ],
    "currentLayout": {
      "layoutId": "1",
      "name": "1x1 Single Chart",
      "state": {
        "version": 2,
        "cells": [
          {
            "id": "c1",
            "symbol": "universal:BTCUSDT",
            "timeframe": "60",
            "priceStyle": "candles",
            "drawings": {
              "drawings": [
                {
                  "id": "dr_001",
                  "type": "trendline",
                  "points": [
                    { "time": 1729600000000, "price": 82500 },
                    { "time": 1729686400000, "price": 84200 }
                  ],
                  "locked": false,
                  "visible": true
                }
              ]
            }
          }
        ]
      }
    },
    "layoutSync": {
      "drawings": false
    }
  },
  "updatedAt": 1729700000000,
  "plan": "premium"
}
```

### Error Responses

- **401 Unauthorized**: Request lacks valid session authentication.
  ```json
  {
    "ok": false,
    "error": "unauthenticated"
  }
  ```

---

## 2. `PUT /api/user/state`

Persists user workspace state updates to the cloud store, updating `drawingFavorites` and layout drawings with optimistic concurrency protection.

- **Authentication**: Session cookie `tc_session` (`req.user` required).
- **Method**: `PUT`
- **Path**: `/api/user/state`
- **Headers**:
  - `Content-Type: application/json`
  - `Cookie: tc_session=<session_token>`
- **Request Body**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `state` | object | Yes | Key-value dictionary containing serialized state records. Maps client `drawing_favorites` to property `drawingFavorites`. |
| `baseUpdatedAt` | number | No | Millisecond timestamp of client's base state version for optimistic locking. |

```json
{
  "state": {
    "drawingFavorites": "[\"trendline\",\"hline\",\"ray\",\"fibretracement\",\"box\",\"pitchfork\"]",
    "currentLayout": "{\"layoutId\":\"1\",\"state\":{\"version\":2,\"cells\":[{\"id\":\"c1\",\"drawings\":{...}}]}}"
  },
  "baseUpdatedAt": 1729700000000
}
```

### Validation & Limits

1. **Payload Size**: The raw string byte length of the request body must not exceed `STATE_MAX_BYTES` (2MB / `2 * 1024 * 1024` bytes). Exceeding this limit returns HTTP 413 `state_too_large`.
2. **Authentication**: Must carry a valid session identifier; unauthenticated requests receive HTTP 401 `unauthenticated`.
3. **Payload Structure**: Payload must be a non-null JSON object and not an array; otherwise returns HTTP 400 `invalid_state`.
4. **Optimistic Locking**: If `current.updatedAt > 0` and `Number(baseUpdatedAt || 0) < current.updatedAt`, the write is rejected with HTTP 409 `conflict`.
5. **Plan Quotas**: Evaluated via `validateStateAgainstPlan(state, plan)`. Note that `drawingTools` is enabled across all plans (`standard`, `essential`, `plus`, `premium`, `ultimate`), so no quota violation is emitted for drawing favorites.

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

- **401 Unauthorized**: Missing or expired session cookie.
  ```json
  {
    "ok": false,
    "error": "unauthenticated"
  }
  ```

- **403 Forbidden**: State payload exceeds user plan quotas (e.g. `savedLayouts`).
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

- **409 Conflict**: Optimistic locking concurrency conflict.
  ```json
  {
    "ok": false,
    "error": "conflict",
    "serverUpdatedAt": 1729700600000,
    "serverState": { ... }
  }
  ```

- **413 Payload Too Large**: Payload exceeds 2MB limit.
  ```json
  {
    "ok": false,
    "error": "state_too_large"
  }
  ```
