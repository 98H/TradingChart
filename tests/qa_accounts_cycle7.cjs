// tests/qa_accounts_cycle7.cjs — TradingView-parity account features QA
// Covers: public profile tab (avatar picker, username policy, social links plan
// gating, bio/location/signature), TOTP 2FA lifecycle, FA/EN + RTL + mobile fit.
const path = require('path');
const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');

const TS = Date.now().toString(36);
const EMAIL = `c7_${TS}@qa.test`;
const USERNAME = `c7user_${TS}`;
const PASSWORD = 'QaPass1234';

// ── helpers ────────────────────────────────────────────────────────────────
async function pollUntil(fn, timeoutMs = 12000, step = 350) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise(r => setTimeout(r, step));
  }
  return null;
}

async function registerViaApi(page, { email, username, password, displayName = 'QA Cycle7' }) {
  return page.evaluate(async (body) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: r.status, data: await r.json() };
  }, { email, username, password, displayName });
}

async function loginViaApi(page, { identity, password, totpCode }) {
  return page.evaluate(async (body) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: r.status, data: await r.json() };
  }, totpCode === undefined ? { identity, password } : { identity, password, totpCode });
}

async function patchMe(page, patch) {
  return page.evaluate(async (p) => {
    const r = await fetch('/api/auth/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    return { status: r.status, data: await r.json() };
  }, patch);
}

async function authApi(page, path, body) {
  return page.evaluate(async ({ path, body }) => {
    const r = await fetch(`/api/auth/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return { status: r.status, data: await r.json() };
  }, { path, body });
}

// Client-side RFC6238 TOTP for the test (mirrors server impl)
async function totpFor(page, secret) {
  return page.evaluate(async (secret) => {
    const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const dec = (s) => {
      let bits = 0, val = 0; const out = [];
      for (const ch of s.toUpperCase()) {
        const i = B32.indexOf(ch);
        if (i < 0) continue;
        val = (val << 5) | i; bits += 5;
        if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
      }
      return new Uint8Array(out);
    };
    const key = await crypto.subtle.importKey('raw', dec(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const msg = new ArrayBuffer(8);
    new DataView(msg).setBigUint64(0, BigInt(counter));
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
    const off = h[h.length - 1] & 0xf;
    const code = ((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1000000;
    return String(code).padStart(6, '0');
  }, secret);
}

async function openAccountSettings(page, tabId) {
  return page.evaluate(async (tab) => {
    const am = window.__TRADING_APP__?.auth;
    if (!am) return { ok: false, why: 'no auth manager' };
    if (!am.user) {
      const r = await am.login({ identity: window.__QA_EMAIL__, password: window.__QA_PASS__ });
      if (!r.ok) return { ok: false, why: 'login failed', r };
    }
    am.openAccountSettingsModal(tab);
    return { ok: true };
  }, tabId);
}

// ── tests ──────────────────────────────────────────────────────────────────
const tests = {
  desktop: {
    '01_register_fresh_user': async (ctx) => {
      const r = await registerViaApi(ctx.page, { email: EMAIL, username: USERNAME, password: PASSWORD });
      if (r.status !== 200 || !r.data.ok) return { defects: [{ kind: 'api', text: `register failed: ${JSON.stringify(r.data)}` }] };
      const u = r.data.user;
      const defects = [];
      if (u.usernameChangesLeft !== 2) defects.push({ kind: 'field', text: `usernameChangesLeft=${u.usernameChangesLeft} expected 2` });
      if (u.totpEnabled !== false) defects.push({ kind: 'field', text: 'totpEnabled should be false on new user' });
      if (!u.socialLinks || typeof u.socialLinks !== 'object') defects.push({ kind: 'field', text: 'socialLinks missing from publicUser' });
      ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      return { defects };
    },

    '02_profile_tab_renders_with_all_fields': async (ctx) => {
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      const open = await openAccountSettings(ctx.page, 'profile');
      if (!open.ok) return { defects: [{ kind: 'open', text: JSON.stringify(open) }] };
      const got = await pollUntil(() => ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
        if (!b) return null;
        return {
          avatars: b.querySelectorAll('.pf-avatar-btn').length,
          username: !!b.querySelector('input[name="pf-username"]'),
          bio: !!b.querySelector('textarea[name="pf-bio"]'),
          location: !!b.querySelector('input[name="pf-location"]'),
          signature: !!b.querySelector('input[name="pf-signature"]'),
          socials: ['x', 'youtube', 'facebook', 'instagram', 'website'].map(n => ({
            net: n, el: !!b.querySelector(`input[name="pf-social-${n}"]`),
            disabled: b.querySelector(`input[name="pf-social-${n}"]`)?.disabled
          })),
          joined: (b.innerText || '').includes('Member since') || (b.innerText || '').includes('عضویت از')
        };
      }));
      if (!got) return { defects: [{ kind: 'render', text: 'profile tab never rendered' }] };
      const defects = [];
      if (got.avatars < 6) defects.push({ kind: 'ui', text: `only ${got.avatars} avatar presets` });
      if (!got.username || !got.bio || !got.location || !got.signature) defects.push({ kind: 'ui', text: 'missing profile fields: ' + JSON.stringify(got) });
      // basic plan: x+youtube unlocked, facebook/instagram/website locked
      for (const s of got.socials) {
        if (!s.el) defects.push({ kind: 'ui', text: `social input missing: ${s.net}` });
        const shouldLock = ['facebook', 'instagram', 'website'].includes(s.net);
        if (s.disabled !== shouldLock) defects.push({ kind: 'gate', text: `social ${s.net} disabled=${s.disabled} expected=${shouldLock}` });
      }
      if (!got.joined) defects.push({ kind: 'ui', text: 'member-since date not shown' });
      await shots(ctx, 'c7_profile_tab_desktop');
      return { defects };
    },

    '03_profile_save_roundtrip_persists': async (ctx) => {
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      await openAccountSettings(ctx.page, 'profile');
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-bio"]')));
      await ctx.page.evaluate(() => {
        document.querySelector('input[name="pf-displayName"]').value = 'QA Cycle Seven';
        document.querySelector('textarea[name="pf-bio"]').value = 'ICT & Smart Money analyst — QA bio.';
        document.querySelector('input[name="pf-location"]').value = 'Tehran';
        document.querySelector('input[name="pf-signature"]').value = 'Trade the plan.';
        document.querySelector('input[name="pf-social-x"]').value = 'qa_cycle7';
        document.querySelector('input[name="pf-social-youtube"]').value = 'https://youtube.com/@qa7';
        document.querySelector('.pf-avatar-btn[data-avatar="whale"]')?.click();
      });
      await ctx.page.evaluate(() => document.querySelector('#pf-save')?.click());
      const saved = await pollUntil(() => ctx.page.evaluate(() => {
        const m = document.querySelector('#pf-msg');
        if (!m || m.style.display === 'none') return null;
        return { color: m.style.color, text: m.textContent };
      }));
      if (!saved) return { defects: [{ kind: 'save', text: 'no save confirmation appeared' }] };
      const r = await ctx.page.evaluate(async () => {
        const res = await fetch('/api/auth/me');
        return (await res.json()).user;
      });
      const defects = [];
      if (r.displayName !== 'QA Cycle Seven') defects.push({ kind: 'persist', text: `displayName=${r.displayName}` });
      if (r.bio !== 'ICT & Smart Money analyst — QA bio.') defects.push({ kind: 'persist', text: `bio=${r.bio}` });
      if (r.location !== 'Tehran') defects.push({ kind: 'persist', text: `location=${r.location}` });
      if (r.signature !== 'Trade the plan.') defects.push({ kind: 'persist', text: `signature=${r.signature}` });
      if (r.avatarPreset !== 'whale') defects.push({ kind: 'persist', text: `avatarPreset=${r.avatarPreset}` });
      if (r.socialLinks?.x !== 'qa_cycle7') defects.push({ kind: 'persist', text: `social x=${JSON.stringify(r.socialLinks)}` });
      // badge should now show the whale icon, not initials
      const badgeIcon = await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge .avatar-circle')?.textContent);
      if (badgeIcon !== '🐋') defects.push({ kind: 'badge', text: `badge shows "${badgeIcon}" expected 🐋` });
      return { defects };
    },

    '04_social_gate_rejects_website_on_basic': async (ctx) => {
      const r = await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      if (!r.data.ok) return { defects: [{ kind: 'login', text: 'login failed' }] };
      const bad = await patchMe(ctx.page, { socialLinks: { website: 'https://example.com' } });
      const defects = [];
      if (bad.status !== 403 || bad.data.errors?.[0]?.code !== 'plan_required')
        defects.push({ kind: 'gate', text: `website on basic: status=${bad.status} ${JSON.stringify(bad.data)}` });
      const malformed = await patchMe(ctx.page, { socialLinks: { x: 'not a valid handle!!!' } });
      if (malformed.status !== 400) defects.push({ kind: 'validate', text: `bad x handle accepted: ${JSON.stringify(malformed.data)}` });
      const badUrl = await patchMe(ctx.page, { socialLinks: { youtube: 'youtube.com/no-scheme' } });
      if (badUrl.status !== 400) defects.push({ kind: 'validate', text: `bad youtube url accepted` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '05_social_gate_unlocks_on_premium': async (ctx) => {
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'premium' }) });
      });
      const ok = await patchMe(ctx.page, { socialLinks: { website: 'https://qa7.example.com', instagram: 'https://instagram.com/qa7' } });
      const defects = [];
      if (!ok.data.ok) defects.push({ kind: 'gate', text: `premium social save rejected: ${JSON.stringify(ok.data)}` });
      if (ok.data.user?.socialLinks?.website !== 'https://qa7.example.com') defects.push({ kind: 'persist', text: `website=${JSON.stringify(ok.data.user?.socialLinks)}` });
      // restore basic for later tests
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'basic' }) });
      });
      return { defects };
    },

    '06_username_policy_limits_and_blocklist': async (ctx) => {
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      const defects = [];
      // blocked word
      const blocked = await patchMe(ctx.page, { username: 'vela_admin_x' });
      if (blocked.status !== 400 || blocked.data.errors?.[0]?.code !== 'username_blocked')
        defects.push({ kind: 'blocklist', text: `blocked name accepted: ${JSON.stringify(blocked.data)}` });
      // hyphen now allowed (TradingView parity)
      const hyph = await patchMe(ctx.page, { username: `${USERNAME}-a` });
      if (!hyph.data.ok) defects.push({ kind: 'hyphen', text: `hyphen username rejected: ${JSON.stringify(hyph.data)}` });
      if (hyph.data.user?.usernameChangesLeft !== 1) defects.push({ kind: 'counter', text: `changesLeft after 1st = ${hyph.data.user?.usernameChangesLeft}` });
      // second change OK
      const second = await patchMe(ctx.page, { username: `${USERNAME}-b` });
      if (!second.data.ok) defects.push({ kind: 'second', text: `2nd change rejected: ${JSON.stringify(second.data)}` });
      // third change must be refused with username_limit
      const third = await patchMe(ctx.page, { username: `${USERNAME}-c` });
      if (third.status !== 403 || third.data.errors?.[0]?.code !== 'username_limit')
        defects.push({ kind: 'limit', text: `3rd change not refused: status=${third.status} ${JSON.stringify(third.data)}` });
      // no-op rename (same username) must not consume quota nor error
      const noop = await patchMe(ctx.page, { username: `${USERNAME}-b` });
      if (!noop.data.ok || noop.data.user?.usernameChangesLeft !== 0)
        defects.push({ kind: 'noop', text: `same-name PATCH consumed quota or errored: ${JSON.stringify(noop.data)}` });
      // revert for later tests (login by email anyway)
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '07_2fa_full_lifecycle': async (ctx) => {
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      const defects = [];
      // setup
      const setup = await authApi(ctx.page, '2fa/setup');
      if (!setup.data.ok || !/^[A-Z2-7]{32}$/.test(setup.data.secret || ''))
        defects.push({ kind: '2fa', text: `setup failed: ${JSON.stringify(setup.data)}` });
      if (defects.length) return { defects };
      const secret = setup.data.secret;
      if (!setup.data.otpauthUrl?.startsWith('otpauth://totp/'))
        defects.push({ kind: '2fa', text: 'otpauthUrl missing/malformed' });
      // wrong code rejected
      const wrong = await authApi(ctx.page, '2fa/enable', { code: '000001' });
      if (wrong.status !== 400) defects.push({ kind: '2fa', text: 'wrong enable code accepted' });
      // correct code enables
      const code = await totpFor(ctx.page, secret);
      const en = await authApi(ctx.page, '2fa/enable', { code });
      if (!en.data.ok || en.data.totpEnabled !== true) defects.push({ kind: '2fa', text: `enable failed: ${JSON.stringify(en.data)}` });
      // me reports totpEnabled
      const me = await ctx.page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user);
      if (me.totpEnabled !== true) defects.push({ kind: '2fa', text: 'me.totpEnabled not true after enable' });
      // export must not leak the secret
      const exp = await ctx.page.evaluate(async () => (await (await fetch('/api/user/export')).json()));
      const expStr = JSON.stringify(exp);
      if (expStr.includes(secret)) defects.push({ kind: '2fa-leak', text: 'totp secret leaked into export payload' });
      if (exp.user?.totpSecret || exp.user?.pendingTotpSecret) defects.push({ kind: '2fa-leak', text: 'totp fields present in export user object' });
      // login without code → totpRequired, no session
      const noCode = await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      if (!noCode.data.totpRequired) defects.push({ kind: '2fa-login', text: `login w/o code did not demand TOTP: ${JSON.stringify(noCode.data)}` });
      // login with wrong code rejected
      const badLogin = await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD, totpCode: '999998' });
      if (badLogin.status !== 401 || badLogin.data.error !== 'invalid_totp')
        defects.push({ kind: '2fa-login', text: `wrong totp login: ${JSON.stringify(badLogin.data)}` });
      // login with right code succeeds
      const goodCode = await totpFor(ctx.page, secret);
      const goodLogin = await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD, totpCode: goodCode });
      if (!goodLogin.data.ok || !goodLogin.data.user) defects.push({ kind: '2fa-login', text: `valid totp login failed: ${JSON.stringify(goodLogin.data)}` });
      // disable requires password + code
      const badDisable = await authApi(ctx.page, '2fa/disable', { password: 'WrongPass999', code: goodCode });
      if (badDisable.status !== 400) defects.push({ kind: '2fa', text: 'disable accepted wrong password' });
      const disCode = await totpFor(ctx.page, secret);
      const dis = await authApi(ctx.page, '2fa/disable', { password: PASSWORD, code: disCode });
      if (!dis.data.ok || dis.data.totpEnabled !== false) defects.push({ kind: '2fa', text: `disable failed: ${JSON.stringify(dis.data)}` });
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '08_2fa_ui_in_security_tab': async (ctx) => {
      // The twofa rate limiter (6/min per IP) is exhausted by test 07. Register
      // + log in first, then probe 2fa/setup until the window reopens (429→200).
      const email2 = `c7b_${TS}@qa.test`;
      await awaitRegisterWindow();
      const reg = await registerViaApi(ctx.page, { email: email2, username: `c7b_${TS}`, password: PASSWORD });
      if (!reg.data.ok) return { defects: [{ kind: 'api', text: `second register failed: ${JSON.stringify(reg.data)}` }] };
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, email2, PASSWORD);
      // 2fa/setup is no longer rate-limited for authenticated users (see server
      // comment): the pending secret is inert until a valid code confirms it.
      const open = await openAccountSettings(ctx.page, 'security');
      if (!open.ok) return { defects: [{ kind: 'open', text: JSON.stringify(open) }] };
      const got = await pollUntil(() => ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
        if (!b) return null;
        return {
          enableBtn: !!b.querySelector('#acc-2fa-open-enable'),
          disableBtn: !!b.querySelector('#acc-2fa-open-disable'),
          passFields: b.querySelectorAll('input[type="password"]').length
        };
      }));
      if (!got) return { defects: [{ kind: 'render', text: 'security tab never rendered' }] };
      const defects = [];
      if (!got.enableBtn && !got.disableBtn) defects.push({ kind: 'ui', text: 'no 2FA enable/disable control in security tab' });
      if (got.passFields < 3) defects.push({ kind: 'ui', text: `password fields=${got.passFields} (need 3 for change-password)` });
      // enable flow UI: open setup box and confirm a base32 secret appears
      if (got.enableBtn) {
        await ctx.page.evaluate(() => document.querySelector('#acc-2fa-open-enable')?.click());
        const secretShown = await pollUntil(() => ctx.page.evaluate(() => {
          const el = document.querySelector('#acc-2fa-secret');
          return el && /^[A-Z2-7]{32}$/.test(el.textContent.trim()) ? el.textContent.trim() : null;
        }), 8000);
        if (!secretShown) defects.push({ kind: 'ui', text: 'TOTP secret never displayed in setup box' });
        else {
          // enter the live code and enable through the UI
          const code = await totpFor(ctx.page, secretShown);
          await ctx.page.evaluate((c) => {
            document.querySelector('input[name="acc-2fa-code"]').value = c;
            document.querySelector('#acc-2fa-enable-btn')?.click();
          }, code);
          const enabled = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#acc-2fa-open-disable')), 8000);
          if (!enabled) defects.push({ kind: 'ui', text: '2FA did not flip to enabled state in UI' });
          // cleanup: disable it again through API so other suites see clean state
          const c2 = await totpFor(ctx.page, secretShown);
          await authApi(ctx.page, '2fa/disable', { password: PASSWORD, code: c2 });
        }
        await shots(ctx, 'c7_security_tab_2fa_desktop');
      }
      return { defects };
    },
    '09_histbars_plan_gate': async (ctx) => {
      const defects = [];
      // guest → basic cap (10000)
      const guest = await ctx.page.evaluate(async () => {
        const r = await fetch('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000');
        return { cap: r.headers.get('X-History-Limit'), status: r.status, count: (await r.json()).count };
      });
      if (guest.cap !== '10000') defects.push({ kind: 'hist', text: `guest cap=${guest.cap} expected 10000` });
      if (guest.count > 10000) defects.push({ kind: 'hist', text: `guest got ${guest.count} bars over cap` });
      // premium user → 20000
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'premium' }) });
      });
      const prem = await ctx.page.evaluate(async () => {
        const r = await fetch('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000');
        return { cap: r.headers.get('X-History-Limit'), count: (await r.json()).count };
      });
      if (prem.cap !== '20000') defects.push({ kind: 'hist', text: `premium cap=${prem.cap} expected 20000` });
      if (prem.count > 20000) defects.push({ kind: 'hist', text: `premium got ${prem.count} bars over cap` });
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'basic' }) });
      });
      return { defects };
    },

    '10_replay_depth_clamped_for_basic': async (ctx) => {
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      const r = await ctx.page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const br = app?.barReplay;
        if (!br) return { ok: false, why: 'no barReplay' };
        // basic plan: 180 days; simulate a 1m chart (60000ms spacing) with a
        // huge history — 180d of 1m bars = 259200 bars. Start at index 0 must
        // clamp to total-259200.
        const total = 400000;
        br.app = app;
        br.startReplay(total, 0, 60000);
        const idx = br.currentIndex;
        br.container?.classList.remove('visible');
        return { ok: true, idx, total };
      });
      if (!r.ok) return { defects: [{ kind: 'replay', text: r.why }] };
      const defects = [];
      const expectedMin = r.total - 1 - Math.floor(180 * 24 * 60);
      if (r.idx < expectedMin) defects.push({ kind: 'replay', text: `basic replay reached idx=${r.idx}, min allowed ${expectedMin}` });
      return { defects };
    },

    '11_screener_refresh_follows_plan': async (ctx) => {
      const r = await ctx.page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        if (!app?.technicalScreener) return { ok: false, why: 'no screener' };
        const measure = () => new Promise(res => {
          const sc = app.technicalScreener;
          // read the cadence by introspecting via a fresh startAutoRefresh with
          // a spy on setInterval
          const orig = window.setInterval;
          let captured = null;
          window.setInterval = (fn, ms) => { captured = ms; return orig.call(window, () => {}, ms); };
          sc.startAutoRefresh();
          window.setInterval = orig;
          res(captured);
        });
        return { ok: true, basic: await measure() };
      });
      if (!r.ok) return { defects: [{ kind: 'screener', text: r.why }] };
      const defects = [];
      if (r.basic !== 60000) defects.push({ kind: 'screener', text: `guest/basic cadence=${r.basic}ms expected 60000` });
      // upgrade to plus → 10s
      await loginViaApi(ctx.page, { identity: EMAIL, password: PASSWORD });
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'plus' }) });
        // sync client entitlements
        const am = window.__TRADING_APP__.auth;
        am.entitlements = (await (await fetch('/api/plans')).json()).plans.plus;
        window.__TRADING_APP__.onPlanChanged('plus');
      });
      const plus = await ctx.page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        return new Promise(res => {
          const orig = window.setInterval;
          let captured = null;
          window.setInterval = (fn, ms) => { captured = ms; return orig.call(window, () => {}, ms); };
          app.technicalScreener.startAutoRefresh();
          window.setInterval = orig;
          res(captured);
        });
      });
      if (plus !== 10000) defects.push({ kind: 'screener', text: `plus cadence=${plus}ms expected 10000` });
      await ctx.page.evaluate(async () => {
        await fetch('/api/user/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'basic' }) });
      });
      return { defects };
    }

  },
  mobile: {
    'm01_profile_tab_fits_390px': async (ctx) => {
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      const open = await openAccountSettings(ctx.page, 'profile');
      if (!open.ok) return { defects: [{ kind: 'open', text: JSON.stringify(open) }] };
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      const audit = await auditStatic(ctx);
      const defects = [];
      if (audit.horizontalOverflow.length) defects.push({ kind: 'overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 3)) });
      const boxFit = await ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-account-settings-modal .modal-box');
        const r = b?.getBoundingClientRect();
        return r ? { w: r.width, vw: window.innerWidth, fits: r.width <= window.innerWidth } : null;
      });
      if (!boxFit || !boxFit.fits) defects.push({ kind: 'modal-fit', text: JSON.stringify(boxFit) });
      await shots(ctx, 'c7_profile_tab_mobile');
      return { defects };
    },

    'm02_avatar_picker_touch_targets': async (ctx) => {
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      await openAccountSettings(ctx.page, 'profile');
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('.pf-avatar-btn')));
      const small = await ctx.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.pf-avatar-btn')).map(b => {
          const r = b.getBoundingClientRect();
          return { id: b.dataset.avatar, w: Math.round(r.width), h: Math.round(r.height) };
        }).filter(x => x.w < 40 || x.h < 40);
      });
      const defects = small.map(s => ({ kind: 'touch', text: `avatar btn ${s.id} ${s.w}x${s.h}` }));
      return { defects };
    },

    'm03_fa_rtl_profile_tab': async (ctx) => {
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
      await new Promise(r => setTimeout(r, 900));
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      await openAccountSettings(ctx.page, 'profile');
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      const txt = await ctx.page.evaluate(() => document.querySelector('#tc-acc-body')?.innerText || '');
      const defects = [];
      for (const needle of ['هویت عمومی', 'نام نمایشی', 'درباره من', 'شبکه‌های اجتماعی', 'ذخیره پروفایل']) {
        if (!txt.includes(needle)) defects.push({ kind: 'i18n', text: `missing FA string: ${needle}` });
      }
      const leaks = await ctx.page.evaluate((H) => eval('(' + H.untranslated + ')()'), INPAGE);
      const modalLeaks = leaks.filter(l => l.text && !/^https?:|@channel|@qa|example\.com|TradingChart/i.test(l.text));
      for (const l of modalLeaks.slice(0, 8)) defects.push({ kind: 'untranslated', text: `${l.tag}.${l.cls}: ${l.text}` });
      await shots(ctx, 'c7_profile_tab_mobile_fa');
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      return { defects };
    },

    'm04_security_tab_2fa_mobile_fits': async (ctx) => {
      await ctx.page.evaluate((e, p) => { window.__QA_EMAIL__ = e; window.__QA_PASS__ = p; }, EMAIL, PASSWORD);
      await openAccountSettings(ctx.page, 'security');
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#acc-pass-save')));
      const audit = await auditStatic(ctx);
      const defects = [];
      if (audit.horizontalOverflow.length) defects.push({ kind: 'overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 3)) });
      const twofaVisible = await ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-acc-body');
        return b && /احراز|Two-factor/.test(b.innerText);
      });
      if (!twofaVisible) defects.push({ kind: 'ui', text: '2FA section not visible on mobile security tab' });
      await shots(ctx, 'c7_security_tab_mobile');
      return { defects };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle7', tests, {});
})();
