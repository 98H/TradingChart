# Feature Specification: Gift Subscriptions

**Feature Branch**: `013-gift-subscriptions` (new feature) — **HIGH RISK** (plans, admin)

**Created**: 2026-10-23

**Status**: Draft — awaiting founder approval

**Input**: Founder intent (2026-10-23, verbatim): "کنسول مدیریت باید بتواند به کاربرها اشتراک هدیه‌ی دارای تاریخ انقضا یا نامحدود بدهد"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grant a gift subscription (Priority: P1)

From a user's drawer in the admin console, the operator grants a gift subscription: picks a plan, chooses either an expiry date or "Unlimited", optionally adds a note, and confirms. The user immediately gets that plan's entitlements everywhere.

**Why this priority**: This is the feature.

**Independent Test**: Grant Premium until a date 7 days ahead to a Basic user; the user's `/api/plans` reports Premium with the gift expiry, and a Premium-only limit (e.g. `histBars` 20 000) applies at once.

**Acceptance Scenarios**:

1. **Given** a Basic user, **When** the operator grants Premium with expiry in 7 days, **Then** the user's effective plan is Premium until that moment, their base plan stays Basic, and an audit event `user.gift_grant` records plan, expiry and actor.
2. **Given** the grant dialog, **When** "Unlimited" is chosen, **Then** the gift has no expiry and stays until revoked.
3. **Given** an expiry in the past, an unknown or inactive plan, or a note longer than 200 characters, **Then** the grant is refused (`invalid_expiry`, `unknown_plan`, `plan_inactive`, `invalid_note`) and nothing changes.
4. **Given** a user who already has a gift, **When** a new gift is granted, **Then** it replaces the previous gift (one active gift per user) and the audit event records the replaced gift.

---

### User Story 2 - Gift ends correctly (Priority: P1)

When a dated gift expires the user automatically returns to their base plan, with no admin action and no restart; the operator can also revoke a gift at any time.

**Independent Test**: Grant a gift expiring in 2 seconds; after 3 seconds the user's effective plan is the base plan again and a `user.gift_expired` audit event exists.

**Acceptance Scenarios**:

1. **Given** a gift whose expiry has passed, **When** the user makes any request, **Then** the base plan's entitlements apply on that request (never the gift's).
2. **Given** expired gifts, **Then** a periodic job (at most every 60 s) clears them and writes `user.gift_expired` once per gift.
3. **Given** an active gift, **When** the operator clicks Revoke and confirms, **Then** the gift is removed immediately and `user.gift_revoke` is audited.
4. **Given** synced cloud state that fits the gift plan but exceeds the base plan after expiry, **Then** existing data is kept, but further pushes that still exceed the base plan's limits are refused with `403 limit_exceeded` (same rule as a downgrade).

---

### User Story 3 - The user sees their gift (Priority: P2)

A user with a gift sees it labelled clearly in the avatar menu, the account dialog and the plans dialog: the plan name with an "Gift subscription" / «اشتراک هدیه» badge and "until <date>" or "Unlimited" («نامحدود»).

**Acceptance Scenarios**:

1. **Given** a dated gift, **Then** the avatar menu and account dialog show the gift plan with «اشتراک هدیه» and «تا <تاریخ>» in Persian (Persian digits), "Gift subscription" and "until <date>" in English.
2. **Given** an unlimited gift, **Then** «نامحدود» / "Unlimited" is shown instead of a date.
3. **Given** the plans dialog, **Then** the gift plan is marked as current with the gift badge, and the base plan is indicated as the plan after the gift ends (dated gifts only).

---

### User Story 4 - The operator sees and manages gifts (Priority: P2)

The operator sees gifts in the user list, filters users with active gifts, grants gifts in bulk, and sees gift counts on the dashboard; gifts are never counted as revenue.

**Acceptance Scenarios**:

1. **Given** the users list, **Then** users with an active gift show the gift plan with a gift badge and expiry; the status filter "Gift" lists only them.
2. **Given** several selected users, **When** the operator applies the bulk action "Grant gift" with a plan and expiry/unlimited, **Then** each user gets the gift (the operator's own account included) and done/skipped counts are reported.
3. **Given** the dashboard, **Then** a KPI "Active gifts" shows the count, and MRR and paid-user counts exclude users whose effective plan comes from a gift.

---

### Edge Cases

- Gift plan equal to the base plan → allowed (useful to freeze a paid plan) but labelled as gift.
- Gift plan deleted by the admin → gifts on that plan are removed and audited as `user.gift_revoke` with reason `plan_deleted`.
- A pending upgrade request while a gift is active → unaffected; approving it changes the base plan only.
- Suspended user → gift is kept but has no effect while suspended (suspension already blocks access).
- Clock: expiry is stored as UTC epoch milliseconds; the date picker uses the operator's local date and the end of that day (23:59:59 local).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST store at most one gift per user as `{ plan, expiresAt | null, grantedAt, grantedBy, note }`, separate from the user's base plan.
- **FR-002**: The server MUST compute the user's effective plan as the gift plan while a gift exists and (`expiresAt` is null or in the future), otherwise the base plan, and MUST use the effective plan for every entitlement decision (synced-state quotas, `histBars`, social links, `webhookAlerts`, `/api/user/state` plan, `/api/plans` current plan).
- **FR-003**: `POST /api/admin/users/:id/gift` (admin only) MUST accept `{ plan, expiresAt | null, note? }`, validate (`unknown_plan`, `plan_inactive`, `invalid_expiry` for non-numeric or ≤ now, `invalid_note` for > 200 chars), replace any existing gift, return the updated admin row, and audit `user.gift_grant` with plan, expiry, note and any replaced gift.
- **FR-004**: `DELETE /api/admin/users/:id/gift` (admin only) MUST remove the gift (`no_gift` if none) and audit `user.gift_revoke`.
- **FR-005**: `POST /api/admin/users/bulk` MUST support `action: "gift"` with `plan` and `expiresAt | null`, applying FR-003 validation once and granting to every found user.
- **FR-006**: A server job running at least every 60 s MUST remove expired gifts and audit `user.gift_expired` exactly once per gift; regardless of the job, an expired gift MUST never grant entitlements (FR-002).
- **FR-007**: Deleting a plan MUST remove gifts on that plan and audit `user.gift_revoke` with reason `plan_deleted`.
- **FR-008**: The public user object (`/api/auth/me`, login, `/api/plans`) MUST include `effectivePlan` and `gift: { plan, expiresAt | null } | null`; `plan` MUST keep meaning the base plan.
- **FR-009**: The admin users list and user detail MUST include the gift; `GET /api/admin/users` MUST support `status=gift`; the overview MUST report `kpi.gifts` and MUST exclude gift-derived plans from `mrr` and `paid`.
- **FR-010**: The admin user drawer MUST show the current gift (plan, expiry or Unlimited, granted by, granted at, note) with Grant/Replace and Revoke actions; the grant dialog MUST offer plan, "Expiry date" vs "Unlimited", and note, and Revoke MUST require confirmation.
- **FR-011**: The users list (table and mobile cards) MUST mark gift users with a gift badge and expiry, the status filter MUST include "Gift", and the bulk bar MUST include "Grant gift".
- **FR-012**: The trading app MUST show the effective plan with the «اشتراک هدیه» / "Gift subscription" badge and «تا <تاریخ>» / "until <date>" or «نامحدود» / "Unlimited" in the avatar menu, account dialog and plans dialog, and MUST apply client-side gates from the effective plan.
- **FR-013**: All new console and app strings MUST exist in Persian (formal register, Persian digits) and English, including localized messages for every new error code.

### Key Entities

- **Gift**: plan id, expiry (UTC ms or null = unlimited), granted at, granted by (actor), note (≤ 200 chars).
- **Effective Plan**: derived — gift plan if active, else base plan.
- **Audit Events**: `user.gift_grant`, `user.gift_revoke`, `user.gift_expired`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A gift takes effect on the user's next request (0 restarts, < 1 s).
- **SC-002**: 100% of expired gifts stop granting entitlements at their expiry instant and are cleared within 60 s.
- **SC-003**: 100% of gift grants, revokes and expiries produce exactly one audit event.
- **SC-004**: MRR is unchanged by granting any number of gifts.
- **SC-005**: Gift UI passes the UI probe and console suites in both languages on desktop and mobile with zero defects.

## Assumptions

- Gifts are an operator tool; users cannot request or transfer gifts.
- One active gift per user is enough; stacking is out of scope.
- No payment is involved; gifts never count as revenue.
- Notifying the user by email about a gift is out of scope for this version.
