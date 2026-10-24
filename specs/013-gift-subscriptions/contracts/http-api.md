# HTTP contract — Gift subscriptions

All routes below require an admin (`403 forbidden_admin_only` otherwise).

## POST /api/admin/users/:id/gift
Request: `{ "plan": "premium", "expiresAt": 1793000000000 | null, "note": "optional ≤200 chars" }`
200: `{ "ok": true, "user": AdminUserRow }` — `AdminUserRow.gift = { plan, expiresAt, grantedAt, grantedBy, note }`
400: `unknown_plan` | `plan_inactive` | `invalid_expiry` | `invalid_note`  ·  404: `user_not_found`
Audit: `user.gift_grant` target=user id, meta `{ plan, expiresAt, note, replaced: {plan, expiresAt} | null }`

## DELETE /api/admin/users/:id/gift
200: `{ "ok": true, "user": AdminUserRow }`  ·  400: `no_gift`  ·  404: `user_not_found`
Audit: `user.gift_revoke` meta `{ plan, expiresAt, reason: "admin" }`

## POST /api/admin/users/bulk  (extended)
Request: `{ "ids": [...], "action": "gift", "plan": "plus", "expiresAt": null | ms, "note"?: "" }`
200: `{ ok, done, skipped }` — validation errors as above, checked once before applying.

## GET /api/admin/users?status=gift
Only users with an active gift. Each row carries `gift` (or null) and `effectivePlan`.

## GET /api/admin/overview
`kpi.gifts` = users with an active gift. `kpi.mrr` / `kpi.paid` count only users whose effective plan is
their base plan (no active gift).

## Public user object (GET /api/auth/me, login, PATCH me, /api/plans `current`)
Adds `effectivePlan: string` and `gift: { plan, expiresAt | null } | null`. `plan` remains the base plan.
`GET /api/plans` → `current` = effective plan; `GET /api/user/state` → `plan` = effective plan.

## Background
Every ≤ 60 s: expired gifts removed, audit `user.gift_expired` (actor `system`) once per gift.
Plan deletion: gifts on that plan removed, audit `user.gift_revoke` with `reason: "plan_deleted"`.
