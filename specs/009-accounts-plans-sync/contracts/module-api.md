# Module API Contract: Accounts, Plans and Cloud Sync

Client-side JavaScript module APIs, classes, events, and integration contracts for `AuthManager` and `UserProfileModal`.

---

## 1. Storage Bus & Global Events

### 1.1 `window.__TC_STORAGE_BUS__`

Intercepts `Storage.prototype.setItem` to notify the cloud sync engine whenever a `tradingchart_*` key is mutated.

- **Setup**: Evaluated at module load in `client/src/authManager.js:12-21`.
- **Event Dispatched**: `storage-write`
- **Target**: `window`
- **Detail**: `{ key: string }`
- **Consumer**: `AuthManager.observeStorage()` sets `this._dirty = true` to trigger debounced push.

```javascript
// Example: External module writes to storage
localStorage.setItem('tradingchart_alerts', JSON.stringify(newAlerts));
// Dispatches: CustomEvent('storage-write', { detail: { key: 'tradingchart_alerts' } })
```

---

## 2. AuthManager (`client/src/authManager.js`)

The client orchestrator for user identity, entitlement enforcement, modal presentation, and cloud synchronization.

### 2.1 Constructor & Initialization

```javascript
import { AuthManager } from './authManager.js';
const auth = new AuthManager(app);
await auth.init();
```

#### Properties
- `user`: `PublicUser | null` — Currently signed-in user object, or `null` in guest mode.
- `entitlements`: `Plan` — Active tier entitlements object (defaults to `PLANS.basic`).
- `usage`: `UsageSummary | null` — Resource quota usage metrics received from `/api/plans`.
- `plansMeta`: `Record<string, Plan>` — Cached plans catalog.
- `syncEnabled`: `boolean` — Persistent sync switch (`localStorage.tradingchart_sync_enabled !== '0'`).
- `syncInFlight`: `boolean` — Lock flag preventing concurrent cloud pushes.
- `lastSyncAt`: `number` — Epoch timestamp ms of last successful sync.
- `menuOpen`: `boolean` — Tracks whether `#tc-account-menu` is open.

### 2.2 Entitlement Queries & Gates

#### `plan(): string`
Returns the active plan tier identifier (`'basic'`, `'essential'`, `'plus'`, `'premium'`, `'ultimate'`).

#### `ent(key: string): number | boolean | undefined`
Retrieves quota or boolean feature value for given key from active plan.

#### `check(key: string, currentCount?: number): { allowed: boolean, limit?: number, plan: string, needUpgrade?: { plan: string, priceUSD: number }, isBoolean?: boolean }`
Evaluates whether an action within a quota is permitted.
- `allowed`: `true` if current count is below quota or feature is enabled.
- `limit`: Numerical cap or `-1` for unlimited.
- `needUpgrade`: Next tier recommendation if limit exceeded.

#### `feature(key: string): boolean`
Convenience boolean query for feature flags (`secondIntervals`, `synthChartTypes`, `deepBacktest`, `pineStudio`, `strategyTester`).

#### `enforce(key: string, currentCount: number, featureLabelEn: string, featureLabelFa?: string): boolean`
Evaluates permission. If blocked, displays a localized warning toast citing the reached limit, recommended next plan tier, and price. Returns `true` if allowed, `false` if blocked.

```javascript
// Usage example in ChartManager or IndicatorsModal:
if (!this.app.auth.enforce('indicatorsPerChart', activeCount, 'indicators per chart', 'اندیکاتور در هر چارت')) {
  return false; // Action blocked, toast displayed
}
```

---

### 2.3 Cloud State Synchronization

#### `collectLocalState(): Record<string, string>`
Gathers all 19 mapped `tradingchart_*` storage keys into a cloud state dictionary.

#### `applyCloudState(state: Record<string, string>): void`
Unpacks cloud state dictionary and writes keys into `localStorage`.

#### `async pullCloudState(): Promise<void>`
Fetches `/api/user/state`. If cloud state exists, applies it to local storage and triggers `app.onCloudStateApplied(cloud)`. If local guest data exists without cloud state, performs initial push with `{ force: true }`.

#### `async pushCloudState(options?: { force?: boolean }): Promise<void>`
Pushes local state to `PUT /api/user/state`. Handles HTTP 409 Conflict:
1. Merges server state (cloud wins for shared keys; local-only keys preserved).
2. Unions in-memory list collections: `tradeJournal`, `watchlists`, `alerts`, `paperAccounts`.
3. Applies merged state to `localStorage`.
4. Re-pushes once with fresh `baseUpdatedAt`.

#### `startAutoSync(): void`
Initializes periodic 8-second interval timer pushing local state if `_dirty` flag is set.

#### `toggleSync(): void`
Flips `this.syncEnabled`, persists to `localStorage.tradingchart_sync_enabled`, updates dropdown menu label, and shows a localized toast.

---

### 2.4 Authentication API Methods

- `async register(fields: { email, username, password, displayName }): Promise<{ ok: boolean, error?: string, errors?: Array }>`
- `async login(fields: { identity, password, totpCode? }): Promise<{ ok: boolean, totpRequired?: boolean, error?: string }>`
- `async logout(): Promise<void>` — Stashes guest mirror, calls `/api/auth/logout`, clears user session, resets entitlements to Basic, and invokes `app.onAuthChanged('logout')`.
- `async changePassword(current: string, next: string): Promise<Result>`
- `async updateProfile(patch: object): Promise<Result>`
- `async requestReset(email: string): Promise<Result>`
- `async resetPassword(fields: { identity, code, password }): Promise<Result>`
- `async requestVerify(): Promise<Result>`
- `async verifyEmail(code: string): Promise<Result>`
- `async setup2FA(): Promise<{ ok: boolean, secret: string, otpauthUrl: string }>`
- `async enable2FA(code: string): Promise<Result>`
- `async disable2FA(password: string, code: string): Promise<Result>`
- `async deleteAccount(password: string): Promise<Result>`
- `async requestPlan(planId: string): Promise<Result>`
- `async cancelPlanRequest(): Promise<Result>`
- `async getSessions(): Promise<{ ok: boolean, sessions: Array }>`
- `async revokeSession(sid: string): Promise<Result>`

---

### 2.5 UI Modals & Presentation

- `renderAccountBadge(): void` — Updates `.user-avatar-badge` in chart topbar with user initial/preset and plan badge.
- `bindAvatar(): void` — Attaches click listener opening `#tc-account-menu`.
- `openAccountMenu(): void` — Opens account dropdown anchored to avatar, supporting RTL/LTR and mobile viewport clamping.
- `closeAccountMenu(): void` — Dismisses `#tc-account-menu`.
- `openAuthModal(mode: 'login' | 'signup' | 'reset' | 'verify', options?: object): void` — Displays progressive auth dialog `#tc-auth-modal`.
- `openAccountSettingsModal(initialTab?: 'profile' | 'account' | 'security' | 'sessions' | 'data'): void` — Opens 5-tab settings modal `#tc-account-settings-modal`.
- `openPlansModal(): void` — Opens plan comparison dialog `#tc-plans-modal` with 22-row feature comparison matrix.
- `openDevicesModal(): void` — Displays active devices and session revocation dialog.
- `openPlanAdminStudio(route?: string): void` — Navigates admin users to `/admin#/dashboard`.

---

## 3. UserProfileModal (`client/src/userProfileModal.js`)

Coordinates the institutional trader profile dialog, paper trading statistics, and offline workstation backup and restore.

### 3.1 Properties
- `profile`: `object` — Local user profile state (`name`, `handle`, `avatar`, `bio`, `timezone`, `currency`).
- `activeTab`: `'overview' | 'preferences' | 'data'` — Currently visible profile tab.

### 3.2 Methods
- `open(initialTab?: string): void` — Mounts and displays `#modal-user-profile`.
- `close(): void` — Closes profile modal.
- `loadProfile(): object` — Reads `localStorage.tradingchart_user_profile` or initializes default institutional profile.
- `saveProfile(syncWithAuth?: boolean): void` — Writes profile to `localStorage` and synchronizes with `AuthManager`.
- `syncTopbarAvatar(): void` — Updates topbar avatar SVG icon to match selected preset.
- `exportFullBackup(): void` — Packages 15 `tradingchart_*` storage keys into JSON file `tradingchart-complete-backup-<date>.json` and triggers browser download.
- `importFullBackup(e: Event): Promise<void>` — Reads uploaded backup JSON, validates schema, restores 15 storage keys to `localStorage`, and triggers workspace reloads across managers (`watchlistManager`, `tradeJournal`, `alertsManager`).
- `resetPaperTrading(): void` — Clears paper trading storage keys and reloads initial balance.
- `resetLayouts(): void` — Clears saved chart layouts and reloads default layout.

---

## 4. Host App Integration Callbacks

The host application object (`window.app` / `client/src/main.js`) implements lifecycle hooks invoked by `AuthManager`:

```javascript
app = {
  onAuthChanged(action) {
    // action: 'login' | 'logout' | 'register'
    // Updates topbar avatar, re-evaluates locked panel placeholders
  },
  onCloudStateApplied(cloudState) {
    // Reloads workspace managers after cloud state is merged into localStorage
    this.paperTrading?.reloadFromStorage?.();
    this.watchlist?.reloadFromStorage?.();
    this.alertsManager?.reloadFromStorage?.();
    this.tradeJournal?.reloadFromStorage?.();
    this.timeframeManager?.reloadFromStorage?.();
  }
};
```
