# Data model — 013 Gift Subscriptions

## User.gift (server/data/accounts/users.json, per user; absent or null = no gift)
| Field | Type | Rules |
|---|---|---|
| plan | string | must exist in PLANS and be active at grant time |
| expiresAt | number \| null | UTC epoch ms > now at grant; null = unlimited |
| grantedAt | number | UTC epoch ms |
| grantedBy | string | admin actor (username or `master-key`) |
| note | string | ≤ 200 chars, optional (default "") |

Lifecycle: granted (admin) → replaced (admin) | revoked (admin) | expired (job) | removed (plan deleted).

## Derived: effectivePlan
`gift.plan` if gift exists, plan exists and (`expiresAt` null or > now); otherwise base `plan` (or default plan).

## Audit events (audit.jsonl)
`user.gift_grant` {plan, expiresAt, note, replaced}, `user.gift_revoke` {plan, expiresAt, reason: admin|plan_deleted}, `user.gift_expired` {plan, expiresAt} (actor `system`).
