# Review checklist — 013 Gift Subscriptions (reviewer: check the diff against every item)

## Behaviour beyond tests
- [ ] No entitlement decision anywhere in server/ still reads `u.plan` / `req.user.plan` directly (grep the diff and the touched files); only `effectivePlanId` is used for entitlements. `u.plan` may still be read/written as the base plan (plan change, plan request, admin plan select).
- [ ] An expired gift can never grant entitlements even if the job has not run yet (check is in `effectivePlanId`, not only in the job).
- [ ] The expiry job writes exactly one audit event per expired gift and calls `unref()` on its timer.
- [ ] Gift routes are admin-only and reuse the existing `isReqAdmin` guard and `audit` helper.

## Architecture boundaries
- [ ] `u.plan` is never overwritten by granting, revoking or expiring a gift.
- [ ] No new dependency, no new data file; gift lives on the user record in users.json.
- [ ] Bulk "gift" validates plan/expiry/note once, before touching any user.

## Forbidden shortcuts
- [ ] No test-specific branches, no hard-coded user ids, dates or plans.
- [ ] No change to tests/acceptance/**, specs/** or .sdd/**.
- [ ] MRR/paid exclusion is computed, not special-cased by plan id.

## Copy and UX
- [ ] Persian strings use the formal register and exact terms «اشتراک هدیه», «نامحدود», «تا …»; Persian digits for dates in FA.
- [ ] Revoke and bulk grant require confirmation; error messages are localized for every new code.
- [ ] Gift controls are usable on mobile (≤ 860 px console, ≤ 768 px app) with ≥ 44 px touch targets.
