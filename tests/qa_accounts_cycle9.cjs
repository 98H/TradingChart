// tests/qa_accounts_cycle9.cjs — Deep adversarial & exploratory dogfood.
// Keyboard flows, focus management, double-submit races, session edge cases,
// concurrent-tab semantics, rapid tab switching, XSS hygiene in profile fields.
const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');

const TS = Date.now().toString(36);
const EMAIL = `c9_${TS}@qa.test`;
const USERNAME = `c9user_${TS}`;
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
      body: JSON.stringify({ email, username, password: 'QaPass1234', displayName: 'QA Nine' })
    });
    return { status: r.status, data: await r.json() };
  }, { email, username });
}

async function loginViaApi(page, identity, password = PASSWORD) {
  return page.evaluate(async ({ identity, password }) => {
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

    '02_xss_in_profile_fields_is_neutralized': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      const payload = '<img src=x onerror=window.__XSS_FIRED__=1>';
      const r = await ctx.page.evaluate(async (p) => {
        const res = await fetch('/api/auth/me', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: p, bio: p, location: p, signature: p })
        });
        return res.json();
      }, payload);
      const defects = [];
      if (!r.ok) defects.push({ kind: 'xss/save', text: 'profile with html chars rejected — over-escaping' });
      // open the profile tab and the menu — the payload must render as text
      await ctx.page.evaluate(() => {
        const am = window.__TRADING_APP__.auth;
        am.renderAccountBadge();
        am.openAccountSettingsModal('profile');
      });
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      await new Promise(r2 => setTimeout(r2, 700));
      const fired = await ctx.page.evaluate(() => !!window.__XSS_FIRED__);
      if (fired) defects.push({ kind: 'xss', text: 'onerror handler fired from stored profile field' });
      const imgs = await ctx.page.evaluate(() => document.querySelectorAll('#tc-account-settings-modal img[src="x"]').length);
      if (imgs > 0) defects.push({ kind: 'xss', text: 'payload parsed as live HTML in modal' });
      // cleanup
      await ctx.page.evaluate(async () => {
        await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: 'QA Nine', bio: '', location: '', signature: '' }) });
      });
      return { defects };
    },

    '03_rapid_tab_switching_no_stale_state': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      // hammer the tab bar
      await ctx.page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#tc-account-settings-modal [data-atab]')];
        for (let i = 0; i < 12; i++) tabs[i % tabs.length].click();
      });
      const settled = await pollUntil(() => ctx.page.evaluate(() => {
        const modals = document.querySelectorAll('#tc-account-settings-modal').length;
        const body = document.querySelector('#tc-acc-body');
        return modals === 1 && body && body.innerText.trim().length > 20;
      }), 10000);
      const defects = [];
      if (!settled) defects.push({ kind: 'tabs', text: 'rapid tab switching left broken/duplicated modal' });
      return { defects };
    },

    '04_escape_closes_modals_not_app': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-settings-modal')));
      await ctx.page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
      const defects = await ctx.page.evaluate(() => {
        const out = [];
        if (document.querySelector('#tc-account-settings-modal')) out.push({ kind: 'esc', text: 'settings modal survived Escape' });
        if (!document.querySelector('canvas')) out.push({ kind: 'esc', text: 'chart canvas missing after Escape' });
        return out;
      });
      return { defects };
    },

    '05_double_submit_register_guarded': async (ctx) => {
      // fire two concurrent registers through the manager (simulates double click)
      const email2 = `c9b_${TS}@qa.test`;
      const results = await ctx.page.evaluate(async ({ email, username }) => {
        const am = window.__TRADING_APP__.auth;
        const [r1, r2] = await Promise.all([
          am.register({ email, username, password: 'QaPass1234', displayName: 'QA Nine B' }),
          am.register({ email, username, password: 'QaPass1234', displayName: 'QA Nine B' })
        ]);
        return [r1.ok, r2.ok, r1.data, r2.data];
      }, { email: email2, username: `c9b_${TS}` });
      const defects = [];
      const okCount = results.slice(0, 2).filter(Boolean).length;
      if (okCount === 2) defects.push({ kind: 'race', text: 'two concurrent registers BOTH succeeded — duplicate account risk' });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '06_password_change_invalidates_other_sessions': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      // create a second session (another "device")
      const s2 = await ctx.page.evaluate(async ({ identity, password }) => {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, password }) });
        // capture the new session cookie set on this page (replaces old) —
        // for the test we only need the server-side session count.
        return r.json();
      }, { identity: EMAIL, password: PASSWORD });
      const before = await ctx.page.evaluate(async () => (await (await fetch('/api/user/sessions')).json()).sessions.length);
      const r = await ctx.page.evaluate(async () => {
        const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current: 'QaPass1234', next: 'QaPass5678' }) });
        return res.json();
      });
      const after = await ctx.page.evaluate(async () => (await (await fetch('/api/user/sessions')).json()).sessions.length);
      const defects = [];
      if (!r.ok) defects.push({ kind: 'pw', text: `change-password failed: ${JSON.stringify(r)}` });
      if (before < 1) defects.push({ kind: 'pw', text: `sessions before=${before}` });
      if (after !== 1) defects.push({ kind: 'pw', text: `sessions after=${after} — other devices not revoked` });
      // new password must work, old must not
      const oldLogin = await ctx.page.evaluate(async ({ identity }) => {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, password: 'QaPass1234' }) });
        return r.status;
      }, { identity: EMAIL });
      const newLogin = await ctx.page.evaluate(async ({ identity }) => {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, password: 'QaPass5678' }) });
        return r.status;
      }, { identity: EMAIL });
      if (oldLogin !== 401) defects.push({ kind: 'pw', text: `old password still accepted (${oldLogin})` });
      if (newLogin !== 200) defects.push({ kind: 'pw', text: `new password rejected (${newLogin})` });
      // restore original password for subsequent suites
      await ctx.page.evaluate(async () => {
        await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current: 'QaPass5678', next: 'QaPass1234' }) });
      });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '07_remote_session_revoke_kicks_device': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      const sessions = await ctx.page.evaluate(async () => (await (await fetch('/api/user/sessions')).json()).sessions);
      const other = sessions.find(s => !s.current);
      const defects = [];
      if (other) {
        const r = await ctx.page.evaluate(async (sid) => {
          const res = await fetch(`/api/user/sessions/${sid}`, { method: 'DELETE' });
          return res.status;
        }, other.id);
        if (r !== 200) defects.push({ kind: 'revoke', text: `revoke returned ${r}` });
      }
      // revoking a non-owned session id must 404, not 500
      const bogus = await ctx.page.evaluate(async () => {
        const res = await fetch('/api/user/sessions/s_doesnotexist', { method: 'DELETE' });
        return res.status;
      });
      if (bogus !== 404) defects.push({ kind: 'revoke', text: `bogus sid → ${bogus} (expected 404)` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '08_guest_cannot_hit_user_endpoints': async (ctx) => {
      // fresh page, no login
      await ctx.page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
      const checks = await ctx.page.evaluate(async () => {
        const out = {};
        out.state = (await fetch('/api/user/state')).status;
        out.sessions = (await fetch('/api/user/sessions')).status;
        out.export = (await fetch('/api/user/export')).status;
        out.planPost = (await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"plan":"ultimate"}' })).status;
        out.patch = (await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"bio":"x"}' })).status;
        out.meGuest = (await (await fetch('/api/auth/me')).json());
        return out;
      });
      const defects = [];
      for (const k of ['state', 'sessions', 'export', 'planPost', 'patch']) {
        if (checks[k] !== 401) defects.push({ kind: 'authz', text: `${k} → ${checks[k]} for guest (expected 401)` });
      }
      if (checks.meGuest.user !== null) defects.push({ kind: 'authz', text: 'guest /me leaked a user object' });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '09_state_size_limit_enforced': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      const big = 'x'.repeat(2 * 1024 * 1024); // 2MB+ blob
      const r = await ctx.page.evaluate(async (blob) => {
        const cur = await (await fetch('/api/user/state')).json();
        const res = await fetch('/api/user/state', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: { junk: blob }, baseUpdatedAt: cur.updatedAt || 0 })
        });
        // 413 responses may be HTML (express payload limit) or JSON (our guard)
        const text = await res.text();
        let code = null;
        try { code = JSON.parse(text).error; } catch (e) { /* html error page */ }
        return { status: res.status, code };
      }, big);
      const defects = [];
      if (r.status !== 413) defects.push({ kind: 'state', text: `oversize state → ${r.status} (expected 413)` });
      // normal-size state still accepted (rebase on current updatedAt first)
      const ok = await ctx.page.evaluate(async () => {
        const cur = await (await fetch('/api/user/state')).json();
        const res = await fetch('/api/user/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: { ...(cur.state || {}), theme: '"dark"' }, baseUpdatedAt: cur.updatedAt || 0 }) });
        return res.status;
      });
      if (ok !== 200) defects.push({ kind: 'state', text: `normal state write → ${ok}` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '10_plan_downgrade_with_over_limit_state_403': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL);
      // upgrade to premium, push 10 layouts, downgrade to basic (1 layout), push again → server must refuse
      const r = await ctx.page.evaluate(async () => {
        const H = { 'Content-Type': 'application/json' };
        const base = async () => (await (await fetch('/api/user/state')).json()).updatedAt || 0;
        const cur = async () => (await (await fetch('/api/user/state')).json()).state || {};
        await fetch('/api/user/plan', { method: 'POST', headers: H, body: '{"plan":"premium"}' });
        const layouts = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: 'L' + i })));
        const put1 = await fetch('/api/user/state', { method: 'PUT', headers: H,
          body: JSON.stringify({ state: { ...(await cur()), layouts }, baseUpdatedAt: await base() }) });
        await fetch('/api/user/plan', { method: 'POST', headers: H, body: '{"plan":"basic"}' });
        const put2 = await fetch('/api/user/state', { method: 'PUT', headers: H,
          body: JSON.stringify({ state: { ...(await cur()), layouts }, baseUpdatedAt: await base() }) });
        const out = { put1: put1.status, put2: put2.status, body: await put2.json() };
        // cleanup: restore a sane state
        await fetch('/api/user/state', { method: 'PUT', headers: H,
          body: JSON.stringify({ state: { ...(await cur()), layouts: '[]' }, baseUpdatedAt: await base() }) });
        return out;
      });
      const defects = [];
      if (r.put1 !== 200) defects.push({ kind: 'downgrade', text: `premium write → ${r.put1}` });
      if (r.put2 !== 403 || r.body.error !== 'limit_exceeded') defects.push({ kind: 'downgrade', text: `over-limit write on basic → ${r.put2} ${JSON.stringify(r.body)}` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    }
  },
  mobile: {
    'm01_signup_keyboard_flow': async (ctx) => {
      await awaitRegisterWindow();
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      await ctx.page.evaluate(() => document.querySelector('#tc-account-menu [data-act="signup"]')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-auth-modal input[name="email"]')));
      // type via keyboard like a real mobile user
      await ctx.page.focus('#tc-auth-modal input[name="displayName"]');
      await ctx.page.keyboard.type('QA Mobile');
      await ctx.page.focus('#tc-auth-modal input[name="email"]');
      await ctx.page.keyboard.type(`c9m_${TS}@qa.test`);
      await ctx.page.focus('#tc-auth-modal input[name="username"]');
      await ctx.page.keyboard.type(`c9m_${TS}`);
      await ctx.page.focus('#tc-auth-modal input[name="password"]');
      await ctx.page.keyboard.type('QaPass1234');
      await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
      const done = await pollUntil(() => ctx.page.evaluate(() => !document.querySelector('#tc-auth-modal')), 15000);
      const defects = [];
      if (!done) defects.push({ kind: 'signup-kb', text: 'signup via typed input never completed' });
      const signed = await ctx.page.evaluate(() => !!window.__TRADING_APP__?.auth?.user);
      if (!signed) defects.push({ kind: 'signup-kb', text: 'not signed in after keyboard signup' });
      await shots(ctx, 'c9_signup_mobile');
      return { defects };
    },

    'm02_focus_survives_modal_input': async (ctx) => {
      // modal must not re-render on every keystroke (drops mobile keyboard)
      await loginViaApi(ctx.page, `c9m_${TS}@qa.test`);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-location"]')));
      const focusStable = await ctx.page.evaluate(async () => {
        const inp = document.querySelector('input[name="pf-location"]');
        inp.focus();
        for (const ch of 'Teh') {
          inp.value += ch;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 60));
          if (document.activeElement !== inp) return false;
        }
        return document.activeElement === inp;
      });
      const defects = [];
      if (!focusStable) defects.push({ kind: 'focus', text: 'input lost focus while typing (modal re-render bug)' });
      return { defects };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle9', tests, {});
})();
