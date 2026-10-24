# Tasks: Gift Subscriptions

**Input**: spec.md, plan.md, contracts/http-api.md. Tests: tests/acceptance/013/ (locked before Phase 1).

## Phase 1: Server core — effective plan and gift lifecycle

- [ ] T001 [US1] Add `effectivePlanId(u, now)` and export it; add `effectivePlan` and `gift` to `publicUser` in server/accounts.js (FR-001, FR-002, FR-008)
- [ ] T002 [US1] Switch every entitlement read of `u.plan` / `req.user.plan` in server/accounts.js (state GET/PUT quotas, social links, `/api/plans` current) to `effectivePlanId` (FR-002)
- [ ] T003 [P] [US1] Use the effective plan for `histBars` in server/index.js (FR-002)
- [ ] T004 [P] [US1] Use the effective plan for `webhookAlerts` in server/tradeRelayApi.js and pass `effectivePlanId` through its dependency object from server/accounts.js (FR-002)
- [ ] T005 [US2] Add the 60 s gift-expiry job with `user.gift_expired` audit, and remove gifts on plan deletion with `user.gift_revoke` reason `plan_deleted`, in server/accounts.js (FR-006, FR-007)

## Phase 2: Admin API

- [ ] T006 [US1] Add `POST /api/admin/users/:id/gift` and `DELETE /api/admin/users/:id/gift` with validation and audit in server/adminApi.js, receiving `effectivePlanId` via the `mountAdminApi` dependency object in server/accounts.js (FR-003, FR-004)
- [ ] T007 [US4] Extend `POST /api/admin/users/bulk` with `action: "gift"` in server/adminApi.js (FR-005)
- [ ] T008 [US4] Add `gift` and `effectivePlan` to `adminRow`, `status=gift` filter, `kpi.gifts`, and exclude gift users from `mrr`/`paid` in server/adminApi.js (FR-009)

## Phase 3: Admin console UI

- [ ] T009 [US1] Add the gift card (current gift, Grant/Replace dialog with plan, expiry date vs Unlimited, note; Revoke with confirmation) to the user drawer overview in client/admin/admin.js (FR-010, FR-013)
- [ ] T010 [US4] Add the gift badge + expiry in the users table and mobile cards, the "Gift" status filter, the "Grant gift" bulk action and the "Active gifts" dashboard KPI in client/admin/admin.js (FR-011, FR-009, FR-013)
- [ ] T011 [P] [US1] Add FA/EN messages for `invalid_expiry`, `invalid_note`, `no_gift`, `plan_inactive` and gift audit action names in client/admin/core.js (FR-013)

## Phase 4: Trading app UI

- [ ] T012 [US3] Make `plan()` and entitlements use `user.effectivePlan`, and show the «اشتراک هدیه» / "Gift subscription" badge with «تا <تاریخ>» / "until <date>" or «نامحدود» / "Unlimited" in the avatar menu, account dialog and plans dialog in client/src/authManager.js (FR-012, FR-013)
