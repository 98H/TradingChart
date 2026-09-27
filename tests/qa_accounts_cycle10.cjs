// tests/qa_accounts_cycle10.cjs — Final parity cycle: cloud-sync semantics,
// guest→user mirror migration, email-change reverification, sync toggle,
// session cookie security attributes, plan persistence across re-login.
const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');

const TS = Date.now().toString(36);
const EMAIL = `c10_${TS}@qa.test`;
const USERNAME = `c10user_${TS}`;
const PASSWORD = 'QaPass1234';

async function pollUntil(fn, timeoutMs = 12000, step = 350) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise(r => setTimeout(r, step));
  }
  return null;
}

async function registerViaApi(page, email, username) {
  return page.evaluate(async ({ email, username }) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password: 'QaPass1234', displayName: 'QA Ten' })
    });
    return { status: r.status, data: await r.json() };
  }, { email, username });
}


async function authLogin(page, identity, password = PASSWORD) {
  return page.evaluate(async ({ identity, password }) => {
    const am = window.__TRADING_APP__.auth;
    const r = await am.login({ identity, password });
    return { ok: r.ok, totpRequired: !!r.data?.totpRequired, user: am.user?.username || null };
  }, { identity, password });
}

async function loginViaApi(page, identity, password = PASSWORD) {
  return page.evaluate(async ({ identity, password }) => {
    const am = window.__TRADING_APP__?.auth;
    if (am) {
      const r = await am.login({ identity, password });
      return { status: r.ok ? 200 : 401, data: r };
    }
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    return { status: r.status, data: await r.json() };
  }, { identity, password });
}

const tests = {
  desktop: {
    '01_setup_user': async (ctx) => {
      const r = await registerViaApi(ctx.page, EMAIL, USERNAME);
      const defects = [];
      if (!r.data.ok) defects.push({ kind: 'setup', text: JSON.stringify(r.data) });
      return { defects };
    },

    '02_session_cookie_security_attributes': async (ctx) => {
      // Log in and inspect the Set-Cookie header the server issues.
      const attrs = await ctx.page.evaluate(async ({ identity, password }) => {
        const r = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, password })
        });
        // Set-Cookie is invisible to JS fetch — read the resulting cookie jar
        // properties via document.cookie reachability instead: HttpOnly cookies
        // must NOT appear in document.cookie.
        return { ok: r.ok, docCookieHasSession: document.cookie.includes('tc_session') };
      }, { identity: EMAIL, password: PASSWORD });
      const defects = [];
      if (!attrs.ok) defects.push({ kind: 'cookie', text: 'login failed' });
      if (attrs.docCookieHasSession) defects.push({ kind: 'cookie', text: 'tc_session visible to document.cookie — HttpOnly missing!' });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '03_guest_workspace_migrates_on_first_login': async (ctx) => {
      // As guest: write a recognizable local state, then register a NEW account
      // — the guest workspace must be mirrored up to the fresh cloud account.
      await ctx.page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
      await ctx.page.evaluate(() => {
        localStorage.setItem('tradingchart_theme', '"guest-marker-c10"');
      });
      await awaitRegisterWindow();
      const email2 = `c10g_${TS}@qa.test`;
      const reg = await registerViaApi(ctx.page, email2, `c10g_${TS}`);
      const defects = [];
      if (!reg.data.ok) return { defects: [{ kind: 'mirror', text: `register failed: ${JSON.stringify(reg.data)}` }] };
      // pullCloudState runs inside register(); wait then read the server copy
      const cloud = await pollUntil(() => ctx.page.evaluate(async () => {
        const r = await fetch('/api/user/state');
        const d = await r.json();
        return d.state?.theme || null;
      }), 10000);
      if (cloud !== '"guest-marker-c10"') defects.push({ kind: 'mirror', text: `guest theme not mirrored to cloud: ${cloud}` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '04_cloud_wins_conflict_409': async (ctx) => {
      // Dedicated account so seed pushes never collide with state from 01-03.
      const email4 = `c10c_${TS}@qa.test`;
      await awaitRegisterWindow(); await awaitRegisterWindow(); await awaitRegisterWindow();
      const reg = await registerViaApi(ctx.page, email4, `c10c_${TS}`);
      if (!reg.data.ok) return { defects: [{ kind: '409', text: `setup register: ${JSON.stringify(reg.data)}` }], ignoreConsole: 'Failed to load resource' };
      // Server must be EMPTY for the conflict math to be deterministic: register
      // via raw fetch does not run the client sync engine, so no state exists yet.
      const r = await ctx.page.evaluate(async () => {
        const H = { 'Content-Type': 'application/json' };
        // Seed server with updatedAt=T1 (empty server + base 0 → must succeed)
        const p1 = await fetch('/api/user/state', { method: 'PUT', headers: H, body: JSON.stringify({ state: { theme: '"server-v1"' }, baseUpdatedAt: 0 }) });
        const d1 = await p1.json();
        // Stale client pushes with base 0 → must get 409 + server copy
        const p2 = await fetch('/api/user/state', { method: 'PUT', headers: H, body: JSON.stringify({ state: { theme: '"stale-client"' }, baseUpdatedAt: 0 }) });
        const d2 = await p2.json();
        return { s1: p1.status, t1: d1.updatedAt, s2: p2.status, conflict: d2.error, serverTheme: d2.serverState?.theme };
      });
      const defects = [];
      if (r.s1 !== 200) defects.push({ kind: '409', text: `seed push → ${r.s1}` });
      if (r.s2 !== 409 || r.conflict !== 'conflict') defects.push({ kind: '409', text: `stale push → ${r.s2} ${r.conflict}` });
      if (r.serverTheme !== '"server-v1"') defects.push({ kind: '409', text: `409 body server copy theme=${r.serverTheme}` });
      // server state must NOT have been overwritten by the stale push
      const fin = await ctx.page.evaluate(async () => (await (await fetch('/api/user/state')).json()).state?.theme);
      if (fin !== '"server-v1"') defects.push({ kind: '409', text: `stale push overwrote server: ${fin}` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '05_sync_toggle_pauses_and_resumes': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      const r = await ctx.page.evaluate(async () => {
        const am = window.__TRADING_APP__.auth;
        const out = {};
        am.syncEnabled = true;
        am._dirty = true;
        await am.pushCloudState({ force: true });
        out.pushWhenOn = am.lastSyncError === null;
        am.syncEnabled = false;
        am.lastSyncError = null; am.lastSyncAt = 0;
        am._dirty = true;
        await am.pushCloudState(); // must no-op while disabled
        out.blockedWhenOff = am.lastSyncAt === 0;
        am.syncEnabled = true;
        return out;
      });
      const defects = [];
      if (!r.pushWhenOn) defects.push({ kind: 'sync', text: 'push failed while sync ON' });
      if (!r.blockedWhenOff) defects.push({ kind: 'sync', text: 'push executed while sync OFF' });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '06_email_change_triggers_reverification': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      // verify current email first
      const fs = require('fs');
      const box0 = JSON.parse(fs.readFileSync('/root/TradingChart/server/data/accounts/outbox.json', 'utf8'));
      const vmsg = box0.messages.find(m => m.email === EMAIL && m.kind === 'verify');
      if (vmsg) {
        await ctx.page.evaluate(async (code) => {
          await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        }, vmsg.code);
      }
      const newEmail = `c10new_${TS}@qa.test`;
      const r = await ctx.page.evaluate(async (email) => {
        const res = await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        return res.json();
      }, newEmail);
      const defects = [];
      if (!r.ok) defects.push({ kind: 'email', text: `email change failed: ${JSON.stringify(r)}` });
      if (r.user?.email !== newEmail) defects.push({ kind: 'email', text: `email=${r.user?.email}` });
      if (r.user?.emailVerified !== false) defects.push({ kind: 'email', text: 'emailVerified not reset after email change' });
      // a fresh verify code must have been queued for the NEW address
      const box1 = JSON.parse(fs.readFileSync('/root/TradingChart/server/data/accounts/outbox.json', 'utf8'));
      const msg2 = box1.messages.find(m => m.email === newEmail && m.kind === 'verify');
      if (!msg2) defects.push({ kind: 'email', text: 'no verify code queued for new address' });
      else {
        const v = await ctx.page.evaluate(async (code) => {
          const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
          return res.json();
        }, msg2.code);
        if (!v.ok || v.user?.emailVerified !== true) defects.push({ kind: 'email', text: `reverify failed: ${JSON.stringify(v)}` });
      }
      // old email must no longer log in
      const oldLogin = await loginViaApi(ctx.page, EMAIL);
      if (oldLogin.status !== 401) defects.push({ kind: 'email', text: `old email still logs in (${oldLogin.status})` });
      // restore the original address so later suites/tests keep a stable account
      await ctx.page.evaluate(async (email) => {
        await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      }, EMAIL);
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '07_plan_persists_across_logout_login': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"plan":"essential"}' });
        // sync client-side plan/entitlements so logout/relogin reflects server truth
        window.__TRADING_APP__.auth.user.plan = 'essential';
      });
      await ctx.page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
      const re = await ctx.page.evaluate(async ({ identity, password }) => {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, password }) });
        return { status: r.status, data: await r.json() };
      }, { identity: EMAIL, password: PASSWORD });
      const defects = [];
      if (re.data.user?.plan !== 'essential') defects.push({ kind: 'plan', text: `plan after relogin=${re.data.user?.plan}` });
      // restore basic
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"plan":"basic"}' });
      });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '08_profile_roundtrip_via_ui_in_en': async (ctx) => {
      // Full EN-language UI roundtrip (previous cycles covered FA heavily).
      // Hard-reset stored language then reload for a true EN boot.
      await ctx.page.evaluate(() => {
        try {
          const s = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
          s.language = 'en';
          localStorage.setItem('tradingchart_user_settings', JSON.stringify(s));
        } catch (e) {}
      });
      await ctx.page.reload({ waitUntil: 'domcontentloaded' });
      await ctx.page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      await authLogin(ctx.page, EMAIL);
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      const rendered = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      const txt = await ctx.page.evaluate(() => (document.querySelector('#tc-acc-body')?.innerText || '').toLowerCase());
      const defects = [];
      if (!rendered) defects.push({ kind: 'en-i18n', text: 'profile tab never rendered in EN boot' });
      for (const needle of ['public identity', 'display name', 'about me', 'social links', 'save profile', 'member since']) {
        if (!txt.includes(needle)) defects.push({ kind: 'en-i18n', text: `missing EN string: ${needle}` });
      }
      // RTL must be OFF in EN
      const dir = await ctx.page.evaluate(() => getComputedStyle(document.body).direction);
      if (dir !== 'ltr') defects.push({ kind: 'en-rtl', text: `body direction=${dir} in EN mode` });
      await shots(ctx, 'c10_profile_en');
      return { defects };
    },

    '09_avatar_change_updates_badge_live': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('.pf-avatar-btn')));
      await ctx.page.evaluate(() => {
        document.querySelector('.pf-avatar-btn[data-avatar="falcon"]')?.click();
        document.querySelector('#pf-save')?.click();
      });
      const badge = await pollUntil(() => ctx.page.evaluate(() => {
        const c = document.querySelector('.user-avatar-badge .avatar-circle');
        return c?.textContent === '🦅' ? '🦅' : null;
      }), 8000);
      const defects = [];
      if (badge !== '🦅') defects.push({ kind: 'avatar', text: 'badge did not live-update to falcon after profile save' });
      // persists through reload
      await ctx.page.reload({ waitUntil: 'domcontentloaded' });
      await ctx.page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      const after = await pollUntil(() => ctx.page.evaluate(() => {
        const c = document.querySelector('.user-avatar-badge .avatar-circle');
        return window.__TRADING_APP__?.auth?.user ? c?.textContent : null;
      }), 12000);
      if (after !== '🦅') defects.push({ kind: 'avatar', text: `badge after reload="${after}" expected 🦅` });
      return { defects };
    },

    '10_logout_all_from_settings_kills_session': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('sessions'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#acc-logout-all')));
      await ctx.page.evaluate(() => document.querySelector('#acc-logout-all')?.click());
      const out = await pollUntil(() => ctx.page.evaluate(async () => {
        const am = window.__TRADING_APP__.auth;
        if (am.user) return null; // still signed in
        const me = await (await fetch('/api/auth/me')).json();
        return me.user === null;
      }), 10000);
      const defects = [];
      if (!out) defects.push({ kind: 'logoutall', text: 'logout-all from settings did not sign out' });
      return { defects };
    }
  },
  mobile: {
    'm01_sync_menu_item_toggles': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      // Force a known starting state so the toggle must move it
      await ctx.page.evaluate(() => { window.__TRADING_APP__.auth.syncEnabled = true; });
      const clicked = await ctx.page.evaluate(() => {
        const item = document.querySelector('#tc-account-menu [data-act="sync"]');
        if (!item) return { found: false };
        item.click();
        return { found: true };
      });
      if (!clicked.found) return { defects: [{ kind: 'sync-toggle', text: 'sync menu item not found' }] };
      await new Promise(r => setTimeout(r, 500));
      const after = await ctx.page.evaluate(() => window.__TRADING_APP__.auth.syncEnabled);
      const persisted = await ctx.page.evaluate(() => localStorage.getItem('tradingchart_sync_enabled'));
      const defects = [];
      if (after !== false) defects.push({ kind: 'sync-toggle', text: `syncEnabled true→${after}` });
      if (persisted !== '0') defects.push({ kind: 'sync-toggle', text: `persisted=${persisted}` });
      // toggle back on for subsequent tests
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.toggleSync());
      return { defects };
    },

    'm02_en_mode_all_tabs_fit_mobile': async (ctx) => {
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      await new Promise(r => setTimeout(r, 600));
      await authLogin(ctx.page, EMAIL);
      const defects = [];
      for (const tab of ['profile', 'security']) {
        await ctx.page.evaluate((t) => window.__TRADING_APP__.auth.openAccountSettingsModal(t), tab);
        await pollUntil(() => ctx.page.evaluate(() => {
          const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
          return b && b.innerText.trim().length > 20;
        }));
        const a = await auditStatic(ctx);
        if (a.horizontalOverflow.length) defects.push({ kind: `en/${tab}/overflow`, text: JSON.stringify(a.horizontalOverflow.slice(0, 2)) });
      }
      await shots(ctx, 'c10_en_mobile_tabs');
      await ctx.page.evaluate(() => document.querySelector('#tc-account-settings-modal [data-close]')?.click());
      return { defects, ignoreConsole: 'Failed to load resource' };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle10', tests, {});
})();
