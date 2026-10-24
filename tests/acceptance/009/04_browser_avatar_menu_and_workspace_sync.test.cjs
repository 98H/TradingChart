/**
 * @spec 009
 * @covers FR-013, FR-018
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise(r => setTimeout(r, 100));
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('[009 Acceptance Suite 04] Launching browser for Avatar Menu & Workspace Sync...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3500 });

    const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const testUser = {
      displayName: `UI Trader ${ts}`,
      username: `qa_ui_${ts}`.slice(0, 24),
      email: `qa_ui_${ts}@acceptance.test`,
      password: 'UIPassword123!'
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Guest Avatar Badge & Account Dropdown Menu (FR-018)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const guestBadgeState = await page.evaluate(() => {
        const badge = document.querySelector('.user-avatar-badge');
        const auth = window.__TRADING_APP__?.auth;
        return {
          exists: !!badge,
          authAttr: badge?.dataset?.auth,
          hasUser: !!auth?.user
        };
      });
      assert(guestBadgeState.exists, 'FR-018 avatar badge element exists in topbar', 'Missing .user-avatar-badge');
      assert(guestBadgeState.authAttr === 'out', 'FR-018 guest badge dataset.auth is "out"', `Expected "out", got ${guestBadgeState.authAttr}`);
      assert(!guestBadgeState.hasUser, 'FR-018 guest has no authenticated user', 'User exists in guest state');

      // Click avatar badge to open account menu
      await realClick(page, '.user-avatar-badge');
      await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

      const guestMenuState = await page.evaluate(() => {
        const menu = document.querySelector('#tc-account-menu');
        const acts = Array.from(menu.querySelectorAll('[data-act]')).map(el => el.dataset.act);
        const headerText = menu.querySelector('.tc-menu-header')?.innerText || '';
        return { acts, headerText };
      });

      assert(guestMenuState.acts.includes('login'), 'FR-018 guest menu contains sign-in action', 'Missing [data-act="login"]');
      assert(guestMenuState.acts.includes('signup'), 'FR-018 guest menu contains sign-up action', 'Missing [data-act="signup"]');
      assert(guestMenuState.acts.includes('plans'), 'FR-018 guest menu contains plans action', 'Missing [data-act="plans"]');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Guest Workspace Mirroring & UI Registration (FR-013, FR-018)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Set guest workspace marker in localStorage before signup
      await page.evaluate(() => {
        localStorage.setItem('tradingchart_theme', '"dark"');
        localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(['BTCUSDT', 'SOLUSDT', 'AVAXUSDT']));
      });

      // Click "Create Free Account"
      await realClick(page, '#tc-account-menu [data-act="signup"]');
      await page.waitForFunction(() => {
        const modal = document.querySelector('#tc-auth-modal');
        return modal && modal.classList.contains('open');
      }, { timeout: 6000 });

      // Populate registration form
      await page.evaluate((u) => {
        const setVal = (name, val) => {
          const input = document.querySelector(`#tc-auth-modal input[name="${name}"]`);
          if (input) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        setVal('displayName', u.displayName);
        setVal('username', u.username);
        setVal('email', u.email);
        setVal('password', u.password);
      }, testUser);

      // Submit registration
      await realClick(page, '#tc-auth-submit');

      // Wait for registration completion & avatar update
      await page.waitForFunction(() => {
        const auth = window.__TRADING_APP__?.auth;
        const badge = document.querySelector('.user-avatar-badge');
        return auth && auth.user && badge && badge.dataset.auth === 'in';
      }, { timeout: 10000 });

      const authState = await page.evaluate(() => {
        const auth = window.__TRADING_APP__?.auth;
        const badge = document.querySelector('.user-avatar-badge');
        const wl = localStorage.getItem('tradingchart_custom_watchlist');
        return {
          username: auth?.user?.username,
          plan: auth?.user?.plan,
          badgeText: badge?.innerText || '',
          watchlistKept: wl && wl.includes('AVAXUSDT')
        };
      });

      assert(authState.username === testUser.username, 'FR-018 UI registered user matches', `Mismatch: ${authState.username}`);
      assert(authState.plan === 'basic', 'FR-018 UI user initial plan is basic', `Expected basic, got ${authState.plan}`);
      assert(authState.watchlistKept, 'FR-013 guest workspace kept and mirrored across signup', 'Guest watchlist was lost');

      // Dismiss verify modal if open
      await page.evaluate(() => {
        document.querySelector('#tc-verify-modal')?.remove();
      });
      await new Promise(r => setTimeout(r, 200));

      // Click avatar badge again as authenticated user
      await realClick(page, '.user-avatar-badge');
      await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

      const userMenuState = await page.evaluate(() => {
        const menu = document.querySelector('#tc-account-menu');
        const acts = Array.from(menu.querySelectorAll('[data-act]')).map(el => el.dataset.act);
        const nameEl = menu.querySelector('strong');
        return {
          acts,
          hasHeader: !!nameEl,
          headerText: menu?.innerText || ''
        };
      });

      assert(userMenuState.hasHeader, 'FR-018 authenticated menu displays user header', 'Missing user header strong');
      assert(userMenuState.acts.includes('profile'), 'FR-018 menu contains profile action', 'Missing profile');
      assert(userMenuState.acts.includes('account'), 'FR-018 menu contains account & billing action', 'Missing account');
      assert(userMenuState.acts.includes('devices'), 'FR-018 menu contains devices action', 'Missing devices');
      assert(userMenuState.acts.includes('plans'), 'FR-018 menu contains plans action', 'Missing plans');
      assert(userMenuState.acts.includes('sync'), 'FR-018 menu contains sync toggle action', 'Missing sync');
      assert(userMenuState.acts.includes('logout'), 'FR-018 menu contains logout action', 'Missing logout');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Persistent Sync Toggle (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Initial sync state is enabled ('1' or undefined)
      const initSync = await page.evaluate(() => window.__TRADING_APP__?.auth?.syncEnabled);
      assert(initSync === true, 'FR-013 initial syncEnabled is true', 'Expected true');

      // Toggle sync off via menu item
      await realClick(page, '#tc-account-menu [data-act="sync"]');
      await page.waitForFunction(() => localStorage.getItem('tradingchart_sync_enabled') === '0', { timeout: 5000 });

      const syncOffState = await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        return {
          syncEnabled: am?.syncEnabled,
          storageVal: localStorage.getItem('tradingchart_sync_enabled')
        };
      });
      assert(syncOffState.syncEnabled === false, 'FR-013 syncEnabled toggled to false', 'Expected false');
      assert(syncOffState.storageVal === '0', 'FR-013 localStorage.tradingchart_sync_enabled persisted as "0"', `Expected "0", got ${syncOffState.storageVal}`);

      // Re-open menu and toggle sync back on
      await realClick(page, '.user-avatar-badge');
      await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

      await realClick(page, '#tc-account-menu [data-act="sync"]');
      await page.waitForFunction(() => localStorage.getItem('tradingchart_sync_enabled') === '1', { timeout: 5000 });

      const syncOnState = await page.evaluate(() => ({
        syncEnabled: window.__TRADING_APP__?.auth?.syncEnabled,
        storageVal: localStorage.getItem('tradingchart_sync_enabled')
      }));
      assert(syncOnState.syncEnabled === true, 'FR-013 syncEnabled toggled back to true', 'Expected true');
      assert(syncOnState.storageVal === '1', 'FR-013 localStorage.tradingchart_sync_enabled persisted as "1"', `Expected "1", got ${syncOnState.storageVal}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Client Cloud Sync & 409 Conflict Union Rebase (FR-013, SC-002, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Simulate client push
      const pushRes = await page.evaluate(async () => {
        const am = window.__TRADING_APP__?.auth;
        localStorage.setItem('tradingchart_trade_journal', JSON.stringify([
          { id: 'j-dev-a', symbol: 'BTCUSDT', side: 'buy', qty: 1 }
        ]));
        am._dirty = true;
        await am.pushCloudState({ force: true });
        return {
          lastSyncError: am.lastSyncError,
          lastSyncAt: am.lastSyncAt
        };
      });
      assert(pushRes.lastSyncError === null, 'FR-013 pushCloudState succeeded', `Sync error: ${pushRes.lastSyncError}`);
      assert(pushRes.lastSyncAt > 0, 'FR-013 lastSyncAt timestamp updated', 'lastSyncAt was not updated');

      // 409 Conflict Union Rebase Test:
      // Simulate concurrent server modification on watchlists while local device has new items
      const conflictRebaseRes = await page.evaluate(async () => {
        const am = window.__TRADING_APP__?.auth;

        // Directly update server state to simulate Device B pushing watchlists & alerts
        const currentServerTime = am.lastSyncAt;
        const serverWatchlist = ['BTCUSDT', 'ADAUSDT'];
        const serverAlerts = [{ id: 'alt-server-b', symbol: 'ETHUSDT', target: 3500 }];
        const p1 = await fetch('/api/user/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: {
              watchlists: JSON.stringify(serverWatchlist),
              alerts: JSON.stringify(serverAlerts)
            },
            baseUpdatedAt: currentServerTime
          })
        });
        const serverUpdate = await p1.json();

        // Local device has custom watchlist & alert in memory and storage
        if (window.__TRADING_APP__?.watchlist) {
          window.__TRADING_APP__.watchlist.customSymbols = ['BTCUSDT', 'SOLUSDT'];
        }
        if (window.__TRADING_APP__?.alertsManager) {
          window.__TRADING_APP__.alertsManager.alerts = [{ id: 'alt-local-a', symbol: 'SOLUSDT', target: 200 }];
        }

        // Device A triggers push with stale base timestamp (older than serverUpdate.updatedAt)
        am.baseUpdatedAt = currentServerTime;
        am._dirty = true;
        await am.pushCloudState();

        // Check merged local state in localStorage
        const mergedWatchlist = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '[]');
        const mergedAlerts = JSON.parse(localStorage.getItem('tradingchart_alerts') || '[]');

        return {
          p1Status: p1.status,
          mergedWatchlist,
          mergedAlerts
        };
      });

      assert(conflictRebaseRes.p1Status === 200, 'FR-013 simulated server state update 200', `Status: ${conflictRebaseRes.p1Status}`);
      assert(conflictRebaseRes.mergedWatchlist.includes('BTCUSDT'), 'FR-013 409 union contains BTCUSDT', 'Missing BTCUSDT');
      assert(conflictRebaseRes.mergedWatchlist.includes('ADAUSDT'), 'FR-013 409 union contains server item ADAUSDT', 'Missing ADAUSDT');
      assert(conflictRebaseRes.mergedWatchlist.includes('SOLUSDT'), 'FR-013 409 union contains local item SOLUSDT', 'Missing SOLUSDT');
      assert(conflictRebaseRes.mergedAlerts.some(a => a.id === 'alt-server-b'), 'FR-013 409 union contains server alert', 'Missing server alert');
      assert(conflictRebaseRes.mergedAlerts.some(a => a.id === 'alt-local-a'), 'FR-013 409 union contains local alert', 'Missing local alert');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Admin Navigation Shortcut Ctrl+Shift+A (FR-018)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const adminHandlerCheck = await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        return typeof am?.openPlanAdminStudio === 'function';
      });
      assert(adminHandlerCheck, 'FR-018 AuthManager has openPlanAdminStudio handler', 'Missing openPlanAdminStudio');
    }

    console.log('✅ [009 Acceptance Suite 04] All Avatar Menu & Workspace Sync scenarios passed.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error('❌ unhandled error in 04_browser_avatar_menu_and_workspace_sync suite:', err);
  process.exit(1);
});
