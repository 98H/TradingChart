// tests/qa_accounts_cycle1.cjs — Account system QA cycle 1: register/login/logout/session
// Fresh page per test (doctrine), desktop + mobile viewports, console-error capture.
const fs = require('fs');
const path = require('path');
const { launch, boot, BASE, EVID, VIEWPORTS, awaitRegisterWindow } = require('./qa_lib.cjs');


/** Poll until fn returns ok:true (renderer busy-stretches make sleeps racy). */
async function pollUntil(page, fn, timeoutMs = 12000, step = 300) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    last = await Promise.race([
      page.evaluate(fn),
      new Promise(res => setTimeout(() => res(null), step * 4 + 1000))
    ]);
    if (last && last.ok) return last;
    await new Promise(r => setTimeout(r, step));
  }
  return last || { ok: false };
}

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle1');
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function record(name, vpName, defects, extra = {}) {
  results.push({ name, viewport: vpName, defects, ...extra, at: new Date().toISOString() });
  const icon = defects.length === 0 ? '✅' : '❌';
  console.log(`${icon} [${vpName}] ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}

const STAMP = Date.now().toString(36);
const USER = {
  email: `qa1_${STAMP}@test.io`,
  username: `qa1_${STAMP}`.slice(0, 24),
  password: 'QaPassw0rd123',
  displayName: 'QA Cycle One'
};

async function freshPage(vpName) {
  const ctx = await launch(vpName);
  await boot(ctx, { settle: 3500 });
  return ctx;
}

async function logoutViaMenu(ctx) {
  // open account menu → logout, with busy-stretch-tolerant polling
  await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await pollUntil(ctx.page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await ctx.page.evaluate(() => {
    const item = [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'logout');
    item?.click();
  });
  await pollUntil(ctx.page, () => ({
    ok: !document.querySelector('#tc-account-menu')
      && document.querySelector('.user-avatar-badge')?.dataset.auth === 'out'
      && !window.__TRADING_APP__?.auth?.user
  }), 12000);
}

async function openAuthModal(ctx, tab) {
  await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 350));
  await ctx.page.evaluate(() => {
    const item = [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'signup' || x.dataset.act === 'login');
    item?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  if (tab) {
    await ctx.page.evaluate((t) => document.querySelector(`.tc-auth-tab[data-tab="${t}"]`)?.click(), tab);
    await new Promise(r => setTimeout(r, 350));
  }
}

const tests = {
  '01_guest_boot_badge': async (ctx, vp) => {
    const defects = [];
    const st = await ctx.page.evaluate(() => ({
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      hasCircle: !!document.querySelector('.user-avatar-badge .avatar-circle'),
      menuOnNull: !document.querySelector('#tc-account-menu'),
      authBoot: !!window.__TRADING_APP__?.auth,
      isAuthed: window.__TRADING_APP__?.auth?.user || null
    }));
    if (st.authed !== 'out') defects.push({ kind: 'functional', text: `guest badge state wrong: ${st.authed}` });
    if (!st.authBoot) defects.push({ kind: 'functional', text: 'AuthManager not booted' });
    if (st.isAuthed) defects.push({ kind: 'functional', text: 'guest treated as authed' });
    return defects;
  },

  '02_signup_flow_full': async (ctx, vp) => {
    const defects = [];
    await openAuthModal(ctx, 'signup');
    const modal = await ctx.page.evaluate(() => !!document.querySelector('#tc-auth-modal'));
    if (!modal) { defects.push({ kind: 'functional', text: 'auth modal did not open' }); return defects; }
    // fill the signup form
    await ctx.page.evaluate((u) => {
      const set = (name, val) => { const i = document.querySelector(`#tc-auth-modal input[name="${name}"]`); if (i) { i.value = val; i.dispatchEvent(new Event('input', { bubbles: true })); } };
      set('displayName', u.displayName);
      set('email', u.email);
      set('username', u.username);
      set('password', u.password);
    }, USER);
    await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    await pollUntil(ctx.page, () => ({
      ok: (!document.querySelector('#tc-auth-modal') && !!window.__TRADING_APP__?.auth?.user)
        || (document.querySelector('#tc-auth-error')?.textContent || '').length > 0
    }));
    if (await ctx.page.evaluate(() => !document.querySelector('#tc-verify-modal'))) {
      await pollUntil(ctx.page, () => ({ ok: !!document.querySelector('#tc-verify-modal') }), 6000);
    }
    const after = await ctx.page.evaluate(() => ({
      modalGone: !document.querySelector('#tc-auth-modal'),
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      user: window.__TRADING_APP__?.auth?.user,
      verifyOpen: !!document.querySelector('#tc-verify-modal'),
      err: document.querySelector('#tc-auth-error')?.textContent || null,
      cookie: document.cookie,
      lastSyncError: window.__TRADING_APP__?.auth?.lastSyncError || null,
      cloudUpdatedAt: window.__TRADING_APP__?.auth?.cloudUpdatedAt || 0,
      syncEnabled: window.__TRADING_APP__?.auth?.syncEnabled,
      _dirty: window.__TRADING_APP__?.auth?._dirty
    }));
    if (!after.modalGone) defects.push({ kind: 'functional', text: `auth modal still open after signup (err=${after.err || 'none'}; syncErr=${after.lastSyncError}; dirty=${after._dirty})` });
    if (after.authed !== 'in') defects.push({ kind: 'functional', text: `avatar not marked signed-in after signup: ${after.authed}` });
    if (!after.user?.email) defects.push({ kind: 'functional', text: `auth.user not populated: ${JSON.stringify(after.user)}` });
    if (!after.verifyOpen) defects.push({ kind: 'functional', text: 'verify-email modal did not auto-open after signup' });
    // close verify modal (kept open for test 03's session, just note it)
    return defects;
  },

  '03_email_verification': async (ctx, vp) => {
    const defects = [];
    if (!await ctx.page.evaluate(() => !!window.__TRADING_APP__?.auth?.user)) {
      return [{ kind: 'chain', text: 'test 03 requires a signed-in session from test 02' }];
    }
    // read the code from the self-hosted outbox (operator-side delivery)
    await pollUntil(ctx.page, () => ({ ok: !!document.querySelector('#tc-verify-modal') }), 8000);
    const code = await getVerifyCode(USER.email);
    if (!code) { defects.push({ kind: 'functional', text: 'no verification code in outbox' }); return defects; }
    await ctx.page.evaluate(() => document.querySelector('#tc-verify-modal')?.remove());
    await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openVerifyFlow());
    await new Promise(r => setTimeout(r, 400));
    await ctx.page.evaluate((c) => {
      const i = document.querySelector('#tc-verify-code');
      if (i) i.value = c;
    }, code);
    await ctx.page.evaluate(() => document.querySelector('#tc-verify-submit')?.click());
    const vst = await pollUntil(ctx.page, () => ({
      ok: !!window.__TRADING_APP__?.auth?.user?.emailVerified && !document.querySelector('#tc-verify-modal'),
      verified: !!window.__TRADING_APP__?.auth?.user?.emailVerified,
      gone: !document.querySelector('#tc-verify-modal')
    }), 12000);
    const st = await ctx.page.evaluate(() => ({
      verified: window.__TRADING_APP__?.auth?.user?.emailVerified,
      gone: !document.querySelector('#tc-verify-modal')
    }));
    if (!st.verified) defects.push({ kind: 'functional', text: `email not verified: code=${code}` });
    if (!st.gone) defects.push({ kind: 'functional', text: 'verify modal did not close on success' });
    return defects;
  },

  '04_session_persists_across_reload': async (ctx, vp) => {
    const defects = [];
    await ctx.page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));
    const st = await ctx.page.evaluate(() => ({
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      user: window.__TRADING_APP__?.auth?.user
    }));
    if (st.authed !== 'in' || !st.user?.email) defects.push({ kind: 'functional', text: `session lost after reload (${st.authed})` });
    return defects;
  },

  '05_logout_roundtrip': async (ctx, vp) => {
    const defects = [];
    await logoutViaMenu(ctx);
    await pollUntil(ctx.page, () => ({
      ok: document.querySelector('.user-avatar-badge')?.dataset.auth === 'out' && !window.__TRADING_APP__?.auth?.user
    }));
    const st = await ctx.page.evaluate(() => ({
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      me: window.__TRADING_APP__?.auth?.user
    }));
    if (st.authed !== 'out' || st.me) defects.push({ kind: 'functional', text: `logout failed (${st.authed})` });
    return defects;
  },

  '06_login_wrong_password': async (ctx, vp) => {
    const defects = [];
    await openAuthModal(ctx, 'login');
    await ctx.page.evaluate((u) => {
      const set = (name, val) => { const i = document.querySelector(`#tc-auth-modal input[name="${name}"]`); if (i) { i.value = val; i.dispatchEvent(new Event('input', { bubbles: true })); } };
      set('identity', u.email);
      set('password', 'WrongPass999');
    }, USER);
    // watch the login response live
    ctx.page.on('response', (r) => { if (r.url().includes('/api/auth/login')) ctx._lastLoginStatus = r.status(); });
    await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    await pollUntil(ctx.page, () => ({
      ok: (!document.querySelector('#tc-auth-modal') && !!window.__TRADING_APP__?.auth?.user)
        || (document.querySelector('#tc-auth-error')?.textContent || '').length > 0
    }));
    if (await ctx.page.evaluate(() => !document.querySelector('#tc-verify-modal'))) {
      await pollUntil(ctx.page, () => ({ ok: !!document.querySelector('#tc-verify-modal') }), 6000);
    }
    const st = await ctx.page.evaluate(() => ({
      err: document.querySelector('#tc-auth-error')?.textContent || '',
      shown: getComputedStyle(document.querySelector('#tc-auth-error') || document.body).display !== 'none',
      stillGuest: !window.__TRADING_APP__?.auth?.user,
      modalCount: document.querySelectorAll('#tc-auth-modal').length,
      errBoxes: document.querySelectorAll('#tc-auth-error').length,
      modalOpen: !!document.querySelector('#tc-auth-modal')
    }));
    console.log(`    [06 debug] status=${ctx._lastLoginStatus} modalCount=${st.modalCount} errBoxes=${st.errBoxes} modalOpen=${st.modalOpen} err="${(st.err || '').slice(0, 60)}"`);
    if (!st.err) defects.push({ kind: 'functional', text: `no error message on wrong password (status=${ctx._lastLoginStatus}, modalOpen=${st.modalOpen})` });
    if (!st.shown) defects.push({ kind: 'layout', text: 'error message not visible' });
    if (!st.stillGuest) defects.push({ kind: 'functional', text: 'logged in despite wrong password!' });
    return defects;
  },

  '07_login_correct_and_menu': async (ctx, vp) => {
    const defects = [];
    await ctx.page.evaluate((u) => {
      const set = (name, val) => { const i = document.querySelector(`#tc-auth-modal input[name="${name}"]`); if (i) { i.value = val; i.dispatchEvent(new Event('input', { bubbles: true })); } };
      set('identity', u.email);
      set('password', u.password);
    }, USER);
    await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    const st = await pollUntil(ctx.page, () => ({
      ok: document.querySelector('.user-avatar-badge')?.dataset.auth === 'in' && !!window.__TRADING_APP__?.auth?.user,
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      user: !!window.__TRADING_APP__?.auth?.user
    }));
    const stRead = await ctx.page.evaluate(() => ({
      authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
      user: window.__TRADING_APP__?.auth?.user
    }));
    if (stRead.authed !== 'in' || !stRead.user) defects.push({ kind: 'functional', text: `login failed (${stRead.authed})` });
    // open account menu and check all items
    await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
    await pollUntil(ctx.page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
    const menu = await ctx.page.evaluate(() => ({
      open: !!document.querySelector('#tc-account-menu'),
      acts: [...document.querySelectorAll('#tc-account-menu [data-act]')].map(x => x.dataset.act)
    }));
    if (!menu.open) defects.push({ kind: 'functional', text: 'account menu did not open' });
    for (const need of ['profile', 'plans', 'devices', 'sync', 'logout']) {
      if (!menu.acts.includes(need)) defects.push({ kind: 'functional', text: `menu missing action: ${need}` });
    }
    await ctx.page.evaluate(() => document.body.click());
    return defects;
  },

  '08_duplicate_registration_rejected': async (ctx, vp) => {
    const defects = [];
    // logout first, then try to re-register the same email
    await logoutViaMenu(ctx);
    await openAuthModal(ctx, 'signup');
    await ctx.page.evaluate((u, stamp) => {
      const set = (name, val) => { const i = document.querySelector(`#tc-auth-modal input[name="${name}"]`); if (i) { i.value = val; i.dispatchEvent(new Event('input', { bubbles: true })); } };
      set('displayName', 'Dup');
      set('email', u.email);
      set('username', `dup_${stamp}`.slice(0, 24));
      set('password', u.password);
    }, USER, STAMP);
    await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    const st = await pollUntil(ctx.page, () => ({
      ok: (document.querySelector('#tc-auth-error')?.textContent || '').length > 0,
      err: document.querySelector('#tc-auth-error')?.textContent || '',
      stillGuest: !window.__TRADING_APP__?.auth?.user
    }));
    if (!st.err) defects.push({ kind: 'functional', text: 'duplicate email accepted silently' });
    if (!st.stillGuest) defects.push({ kind: 'functional', text: 'duplicate registration signed the user in' });
    return defects;
  },
};

async function getVerifyCode(email) {
  // The outbox lives server-side; read it from disk (operator view).
  try {
    const raw = fs.readFileSync('/root/TradingChart/server/data/accounts/outbox.json', 'utf8');
    const box = JSON.parse(raw);
    const msg = box.messages.find(m => m.email === email && m.kind === 'verify');
    return msg ? msg.code : null;
  } catch (e) { return null; }
}

(async () => {
  // Wait for a free register-limiter window (back-to-back runs otherwise 429-cascade)
  await awaitRegisterWindow();
  for (const vpName of ['desktop', 'mobile']) {
    // per-viewport unique user so mobile re-runs the full flow legitimately
    const vpStamp = STAMP + (vpName === 'desktop' ? 'd' : 'm');
    USER.email = `qa1_${vpStamp}@test.io`;
    USER.username = `qa1_${vpStamp}`.slice(0, 24);
    // test 02 establishes the shared signed-in session; 03–08 reuse it
    let shared = null;
    for (const [name, fn] of Object.entries(tests)) {
      const isChain = /^0[3-8]/.test(name);
      const establishes = name.startsWith('02');
      if (isChain && !shared) shared = await freshPage(vpName);
      if (establishes && !shared) shared = await freshPage(vpName);
      const ctx = (isChain || establishes) ? shared : await freshPage(vpName);
      try {
        const defects = await withTimeout(fn(ctx, VIEWPORTS[vpName]), 45000, name);
        record(name, vpName, defects);
      } catch (e) {
        record(name, vpName, [{ kind: 'crash', text: e.message }]);
      }
      if (!isChain && !establishes) { await ctx.browser.close().catch(() => {}); }
      await new Promise(r => setTimeout(r, 400));
    }
    if (shared) await shared.browser.close().catch(() => {});
  }
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE1 RESULT: ${total} defects across ${results.length} tests → ${path.join(OUT_DIR, 'results.json')}`);
  process.exit(0);
})().catch(async (e) => {
  console.error('CYCLE1 FATAL', e);
  process.exit(1);
});

function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`test timeout after ${ms}ms`)), ms))
  ]);
}
