# HTTP API Contract: Paper Trading, Alerts and Bar Replay

Normative REST HTTP endpoint specifications for Trade-Relay execution, webhook management, and cloud state synchronization.

---

## 1. `POST /api/webhook`

In-app authenticated session webhook endpoint for executing simulated paper orders on the user's isolated Trade-Relay engine.

- **Method**: `POST`
- **Path**: `/api/webhook`
- **Authentication**: Session cookie (`tc_session`), resolved to `req.user`.
- **Headers**:
  - `Content-Type: application/json`
- **Entitlement Requirement**: `webhookAlerts` (Plan: Plus, Premium, Institutional).
- **Request Body**:
  ```json
  {
    "action": "BUY",
    "symbol": "BTCUSDT",
    "quantity": 0.1,
    "price": 78200.50,
    "orderType": "market",
    "sl": 77000.00,
    "tp": 80000.00,
    "source": "tradingchart_alert_relay"
  }
  ```
  - `action` (`string`, required): `'BUY'` or `'SELL'` (case-insensitive).
  - `symbol` (`string`, required): Ticker symbol string.
  - `quantity` (`number`, required): Order volume (`> 0` and `<= 1e9`).
  - `price` (`number`, optional): Limit or reference execution price.
  - `orderType` (`string`, optional): `'market'` or `'limit'` (default `'market'`).
  - `sl` (`number`, optional): Stop-loss price.
  - `tp` (`number`, optional): Take-profit price.
  - `source` (`string`, optional): Metadata tracking source.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "success": true,
    "log": {
      "id": "ord-8x92abc",
      "receivedAt": "2026-10-23T14:30:00.000Z",
      "payload": { "action": "BUY", "symbol": "BTCUSDT", "quantity": 0.1, "price": 78200.5 },
      "status": "filled",
      "rejectionReason": null,
      "executionPrice": 78200.5,
      "filledQuantity": 0.1,
      "pnl": 0
    },
    "account": {
      "balance": 100000.00,
      "equity": 100000.00,
      "openPositions": [
        {
          "symbol": "BTCUSDT",
          "qty": 0.1,
          "avgPrice": 78200.5,
          "side": "long",
          "sl": 77000,
          "tp": 80000
        }
      ]
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request` — Validation failure or safety rail rejection:
    ```json
    { "ok": false, "success": false, "error": "invalid_action" }
    ```
    Possible error strings:
    - `"invalid_action"`: Action missing or not `'BUY'` / `'SELL'`.
    - `"invalid_symbol"`: Symbol empty or invalid.
    - `"invalid_quantity"`: Quantity not a finite number `<= 0` or `> 1e9`.
    - `"invalid_price"`: Price provided but not a positive finite number.
    - `"invalid_sl_tp"`: SL or TP is `NaN`.
    - `"Rate limit exceeded: too many orders per second"`: Orders spaced `< 1,000 ms`.
    - `"Order notional $... exceeds safety cap of $50000"`: Notional value `> $50,000`.
    - `"Circuit Breaker: Daily drawdown ...% breached limit 5%"`: Cumulative daily loss `≥ 5.0%`.
  - `401 Unauthorized`:
    ```json
    { "ok": false, "success": false, "error": "unauthenticated" }
    ```
  - `403 Forbidden`:
    ```json
    { "ok": false, "success": false, "error": "plan_feature_locked", "feature": "webhookAlerts" }
    ```

---

## 2. `POST /api/webhook/:token`

External automation webhook endpoint (e.g. TradingView alerts, custom python bots) authenticating via a personal secret URL token.

- **Method**: `POST`
- **Path**: `/api/webhook/:token`
- **URL Parameters**:
  - `token` (`string`, required): 24-byte `base64url` token issued to the user.
- **Authentication**: Token matched by computing `sha256(token)` against `users[].webhookTokenHash`.
- **Rate Limit**: 60 requests per minute per IP via `rateGate`.
- **Entitlement Requirement**: Account must have `webhookAlerts` enabled (Plus+).
- **Request Body**: Identical to `POST /api/webhook`.
- **Success Response (200 OK)**: Identical to `POST /api/webhook`.
- **Error Responses**:
  - `400 Bad Request`: Payload validation or safety rail rejection (identical to `/api/webhook`).
  - `403 Forbidden`:
    ```json
    { "ok": false, "success": false, "error": "plan_feature_locked", "feature": "webhookAlerts" }
    ```
  - `404 Not Found`:
    ```json
    { "ok": false, "error": "not_found" }
    ```
    Returned if token format does not match `/^[A-Za-z0-9_-]{20,64}$/`, no user matches the hash, or user account is suspended.
  - `429 Too Many Requests`: Triggered when exceeding 60 requests/minute.

---

## 3. `GET /api/trade-relay/account`

Inspects the caller's private in-memory Trade-Relay state and recent order log recorder.

- **Method**: `GET`
- **Path**: `/api/trade-relay/account`
- **Authentication**: Session cookie (`tc_session`).
- **Success Response (200 OK)**:
  ```json
  {
    "balance": 100000.00,
    "initialBalance": 100000,
    "positions": [
      {
        "symbol": "BTCUSDT",
        "qty": 0.1,
        "avgPrice": 78200.5,
        "side": "long",
        "sl": 77000,
        "tp": 80000
      }
    ],
    "recentLogs": [
      {
        "id": "ord-8x92abc",
        "receivedAt": "2026-10-23T14:30:00.000Z",
        "payload": { "action": "BUY", "symbol": "BTCUSDT", "quantity": 0.1 },
        "status": "filled",
        "rejectionReason": null,
        "executionPrice": 78200.5,
        "filledQuantity": 0.1,
        "pnl": 0
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    ```

---

## 4. `GET /api/user/webhook`

Queries the current user's webhook configuration status and masked token hint.

- **Method**: `GET`
- **Path**: `/api/user/webhook`
- **Authentication**: Session cookie (`tc_session`).
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "enabled": true,
    "hasToken": true,
    "hint": "4f9B"
  }
  ```
  - `enabled`: `true` if caller's plan includes `webhookAlerts`.
  - `hasToken`: `true` if a token has previously been generated.
  - `hint`: Last 4 characters of the active token, or `null`.
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    ```

---

## 5. `POST /api/user/webhook/rotate`

Generates a new 24-byte secret token, stores its SHA-256 hash in `users.json`, and returns the raw token to the client.

- **Method**: `POST`
- **Path**: `/api/user/webhook/rotate`
- **Authentication**: Session cookie (`tc_session`).
- **Rate Limit**: 5 requests per minute per IP via `rateGate`.
- **Entitlement Requirement**: `webhookAlerts`.
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "token": "u4_kM8_a29QzP01L-xVw9bY2",
    "hint": "9bY2"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    ```
  - `403 Forbidden`:
    ```json
    { "ok": false, "error": "plan_feature_locked", "feature": "webhookAlerts" }
    ```
  - `429 Too Many Requests`: Exceeded 5 rotations/minute.

---

## 6. `GET /api/user/state`

Retrieves the synchronized cloud state envelope for the authenticated user.

- **Method**: `GET`
- **Path**: `/api/user/state`
- **Authentication**: Session cookie (`tc_session`).
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "state": {
      "alerts": "[{\"id\":\"alt-1\",\"symbol\":\"BTCUSDT\",\"targetPrice\":79000,\"direction\":\"above\",\"active\":true}]",
      "paperAccounts": "[{\"id\":\"pap_main\",\"name\":\"Main Paper\",\"balance\":100000,\"positions\":[],\"history\":[]}]",
      "paperActive": "pap_main"
    },
    "updatedAt": 1729690000000,
    "plan": "plus"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    ```

---

## 7. `PUT /api/user/state`

Saves updated client state to the user's cloud profile, enforcing plan quotas for `alerts` (`priceAlerts`) and `paperAccounts` (`paperAccounts`).

- **Method**: `PUT`
- **Path**: `/api/user/state`
- **Authentication**: Session cookie (`tc_session`).
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "state": {
      "alerts": "[...serialized alerts JSON...]",
      "paperAccounts": "[...serialized paper accounts JSON...]",
      "paperActive": "pap_main"
    },
    "expectedUpdatedAt": 1729690000000
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "updatedAt": 1729691000000
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "ok": false, "error": "invalid_state" }
    ```
  - `401 Unauthorized`:
    ```json
    { "ok": false, "error": "unauthenticated" }
    ```
  - `403 Forbidden` — Quota limit exceeded:
    ```json
    {
      "ok": false,
      "error": "limit_exceeded",
      "violations": [
        { "key": "alerts", "limit": 3, "current": 4 }
      ]
    }
    ```
  - `409 Conflict`: `expectedUpdatedAt` mismatch (concurrent edit detected).
  - `413 Payload Too Large`: Serialized state exceeds 512 KB payload ceiling.