# Quickstart — 013 Gift Subscriptions

Base URL: `$SDD_BASE_URL` (default http://127.0.0.1:8088). Admin: header `X-Master-Key: <key>` or console sign-in.

1. Register a test user (Basic). In `/admin` → Users → open the user → Gift → plan Premium, expiry 7 days ahead → Grant.
   Expect: drawer shows the gift; user's `/api/auth/me` has `effectivePlan: "premium"`, `plan: "basic"`;
   `/api/candles?limit=50000` as that user returns `X-History-Limit: 20000`.
2. Grant again with "Unlimited" → `gift.expiresAt: null`; app avatar menu shows «اشتراک هدیه · نامحدود».
3. Grant with expiry 2 s ahead via API; wait 65 s → `effectivePlan` back to base, audit has `user.gift_expired` once.
4. Revoke → `user.gift_revoke`; Users → status "Gift" no longer lists the user.
5. Dashboard: "Active gifts" equals gifted users; MRR unchanged by gifts.

Automated: `node tests/acceptance/013/*.cjs` (locked).
