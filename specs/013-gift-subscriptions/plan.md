# Implementation Plan: Gift Subscriptions

**Branch**: `013-gift-subscriptions` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

## Summary

Add an optional per-user `gift` record next to the base `plan`. A single server helper `effectivePlanId(u)`
becomes the only way entitlement code reads a user's plan; every existing `u.plan` read used for
entitlements is switched to it. Admin endpoints grant/revoke gifts (single and bulk), a 60 s job clears
expired gifts with audit events, plan deletion clears gifts on that plan, and the overview excludes gifts
from revenue. The trading app reads `effectivePlan` / `gift` from the public user and shows a gift badge;
the console drawer, list, filter and bulk bar get gift controls.

## Technical Context

**Language**: JavaScript (Node ESM server, browser ES modules). **Dependencies**: none new.
**Storage**: `server/data/accounts/users.json` (user field `gift`), `audit.jsonl`.
**Testing**: acceptance tests under `tests/acceptance/013/` against `$SDD_BASE_URL` (API + puppeteer).
**Constraints**: zero new dependencies; no restart needed for gifts to apply or expire.

## Constitution Check

| Principle | Status |
|---|---|
| I Honest data | PASS — gifts are labelled as gifts and excluded from MRR |
| II Spec before code | PASS — this spec |
| III Zero-defect real-browser QA | PASS — acceptance + UI probe |
| IV FA/EN parity, RTL | PASS — FR-013 |
| V Mobile | PASS — list cards and drawer on mobile |
| VI Security | PASS — admin-only routes, audit, server-side effective plan |
| VII Server-side plan enforcement | PASS — FR-002 single helper |
| VIII Performance | PASS — O(1) per request, O(users) per minute |
| IX Minimal dependencies | PASS — none |
| X Hybrid SDD | PASS — high-risk paths listed; architect reviews the diff |

## Project Structure (files touched)

```
server/accounts.js        effectivePlanId(), publicUser fields, gift expiry job, plan delete hook, all entitlement reads
server/adminApi.js        gift grant/revoke routes, bulk "gift", adminRow gift, status=gift filter, overview kpi.gifts + MRR rule
server/index.js           histBars via effective plan
server/tradeRelayApi.js   webhookAlerts via effective plan
client/admin/admin.js     drawer gift card + dialogs, list badge, status filter, bulk action, dashboard KPI
client/admin/core.js      error messages for new codes
client/src/authManager.js plan() = effective plan, gift badge in avatar menu, account dialog, plans dialog
client/src/i18n.js        app strings (if needed)
```

## Design decisions

- **D1** Base plan stays in `u.plan`; gifts never overwrite it, so expiry needs no "restore" logic.
- **D2** `effectivePlanId(u, now = Date.now())` returns `u.gift.plan` when `u.gift && PLANS[u.gift.plan] && (u.gift.expiresAt == null || u.gift.expiresAt > now)`, else `PLANS[u.plan] ? u.plan : defaultPlanId()`. Exported and passed to `mountAdminApi` / `mountTradeRelay` via their dependency objects.
- **D3** Expiry job: `setInterval(…, 60_000).unref()`; removes `u.gift` when expired, audits `user.gift_expired` (actor `system`), flushes once if anything changed.
- **D4** Audit from accounts.js uses the existing `audit` import from `adminAuth.js`.
- **D5** Expiry from the console date picker = end of the chosen local day, sent as epoch ms.
