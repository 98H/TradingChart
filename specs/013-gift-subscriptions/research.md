# Research — 013 Gift Subscriptions

## R1. Separate gift record instead of overwriting the plan
- **Decision**: keep `u.plan` as base plan and add `u.gift`.
- **Rationale**: expiry and revoke need no restore logic; pending upgrade requests and admin plan changes keep working on the base plan; audit history stays clear.
- **Alternatives**: overwrite `u.plan` and store `previousPlan` — rejected (restore races with admin changes during the gift).

## R2. Single effective-plan helper
- **Decision**: one exported `effectivePlanId(u, now)` used by every entitlement check.
- **Rationale**: existing reads are spread across server/accounts.js, server/adminApi.js, server/index.js and server/tradeRelayApi.js (inventory 009/010); one helper prevents a forgotten path from leaking or withholding entitlements.

## R3. Lazy check + periodic cleanup
- **Decision**: expiry enforced at read time; a 60 s job only cleans up and audits.
- **Rationale**: correctness never depends on timer timing; audit still records expiry.

## R4. Gifts excluded from revenue
- **Decision**: users with an active gift are excluded from MRR and paid counts.
- **Rationale**: constitution principle I (honest data) — gifts are not income.

## R5. One gift per user
- **Decision**: a new grant replaces the old one (audited).
- **Rationale**: founder intent covers a single gift with expiry or unlimited; stacking adds ambiguity without need.
