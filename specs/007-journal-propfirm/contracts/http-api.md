# HTTP API Contract: Trade Journal and Prop-Firm Tools

Normative REST HTTP endpoint specifications for user cloud state persistence and synchronization covering trade journal executions.

---

## 1. `GET /api/user/state`

Retrieves the authenticated user's synchronized cloud state including serialized Trade Journal executions.

- **Method**: `GET`
- **Path**: `/api/user/state`
- **Authentication**: Session cookie (`tc_session`), resolved to `req.user`.
- **Headers**:
  - `Accept: application/json`
- **Request Parameters / Body**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "state": {
      "tradeJournal": "[{\"id\":\"exec-1729700000000\",\"accountId\":\"tradingchart-paper-1\",\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"quantity\":0.5,\"price\":76200,\"fee\":1.5,\"executedAt\":\"2026-09-01T10:00:00Z\",\"source\":\"manual\",\"assetClass\":\"crypto\"}]",
      "paperAccounts": "[{\"id\":\"pap_main\",\"name\":\"Main Paper\",\"balance\":100000,\"positions\":[],\"history\":[]}]",
      "watchlists": "[\"BTCUSDT\",\"ETHUSDT\",\"SOLUSDT\"]"
    },
    "updatedAt": 1729700000000,
    "plan": "premium"
  }
  ```
  - `ok` (`boolean`): Operation status indicator (`true`).
  - `state` (`Record<string, string>`): Dictionary of JSON-stringified client state slices keyed according to `SYNC_MAP`.
    - `tradeJournal` (`string`): JSON-serialized array of trade execution records.
  - `updatedAt` (`number`): Millisecond Unix epoch timestamp of last server state write.
  - `plan` (`string`): User account plan tier identifier (`'basic'`, `'essential'`, `'plus'`, `'premium'`, `'ultimate'`).
- **Error Responses**:
  - **401 Unauthorized**:
    ```json
    {
      "ok": false,
      "error": "unauthenticated"
    }
    ```
    Triggered when session cookie is missing, expired, or invalid.
  - **500 Internal Server Error**:
    ```json
    {
      "ok": false,
      "error": "internal_error"
    }
    ```

---

## 2. `PUT /api/user/state`

Persists modified client state slices, including updated Trade Journal executions, to the server with optimistic concurrency control and quota checks.

- **Method**: `PUT`
- **Path**: `/api/user/state`
- **Authentication**: Session cookie (`tc_session`), resolved to `req.user`.
- **Headers**:
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body**:
  ```json
  {
    "state": {
      "tradeJournal": "[{\"id\":\"exec-open-1\",\"accountId\":\"tradingchart-paper-1\",\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"quantity\":0.5,\"price\":76200,\"fee\":1.5,\"executedAt\":\"2026-09-01T10:00:00Z\",\"source\":\"manual\",\"assetClass\":\"crypto\"}]"
    },
    "baseUpdatedAt": 1729700000000
  }
  ```
  - `state` (`Record<string, string>`, required): Dictionary containing state slices to merge. `tradeJournal` contains the JSON stringified execution array.
  - `baseUpdatedAt` (`number`, optional): Client's last observed `updatedAt` timestamp for conflict detection.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "updatedAt": 1729700050000
  }
  ```
  - `ok` (`boolean`): Confirmation indicator (`true`).
  - `updatedAt` (`number`): New server millisecond timestamp of the persisted state file (`server/data/states/<userId>.json`).
- **Error Responses**:
  - **400 Bad Request**:
    ```json
    {
      "ok": false,
      "error": "invalid_state"
    }
    ```
    Triggered when `state` is not an object or contains malformed keys.
  - **401 Unauthorized**:
    ```json
    {
      "ok": false,
      "error": "unauthenticated"
    }
    ```
    Triggered when session is invalid or missing.
  - **403 Forbidden**:
    ```json
    {
      "ok": false,
      "error": "limit_exceeded",
      "violations": [
        { "key": "savedLayouts", "limit": 1, "current": 3 }
      ]
    }
    ```
    Triggered if plan quotas for tracked array entities (layouts, templates, watchlists, alerts, paperAccounts) are exceeded.
  - **409 Conflict**:
    ```json
    {
      "ok": false,
      "error": "conflict",
      "serverUpdatedAt": 1729700045000,
      "serverState": { ... }
    }
    ```
    Triggered when `baseUpdatedAt` is older than server's `updatedAt`, signaling that another client tab or session updated the state concurrently. The client invokes `AuthManager.handleConflict` to union executions.
  - **413 Payload Too Large**:
    ```json
    {
      "ok": false,
      "error": "state_too_large"
    }
    ```
    Triggered when the total serialized state payload exceeds `STATE_MAX_BYTES` (2,097,152 bytes / 2 MB).
