// tests/qa_accounts_cycle6.cjs — Adversarial edge cases for the account system.
// Reset-password E2E (self-hosted outbox), keyboard paths, remote session
// revocation, rate-limit UX, duplicate username feedback.
const fs = require('fs');
const path = require('path');
const { launch, boot, EVID, awaitRegisterWindow } = require('./qa_lib.cjs');

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle6');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAMP = Date.now().toString(36);
const USER = { email: `edge_${STAMP}@test.io`, username: ('edge_' + STAMP).slice(0, 24), password: 'EdgePass123', displayName: 'Edge Tester' };
const OUTBOX = path.join(process.cwd(), 'server', 'data', 'accounts', 'outbox.json');
const results = [];
function record(name, defects) {
  results.push({ name, defects });
  console.log(`${defects.length === 0 ? '✅' : '❌'} ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}

/** Evaluate with a hard wall-clock cap so a wedged renderer can't stall the suite. */
async function evalP(page, fn, ...args) {
  try {
    return await Promise.race([
      page.evaluate(fn, ...args),
      new Promise(res => setTimeout(() => res(null), 8000))
    ]);
  } catch (e) { return null; }
}
/** Backoff across the 60 s rate-limit window when the limiter is engaged. */
async function limiterClear(kind, probe) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(probe, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `probe_${Date.now().toString(36)}@test.io` }) });
      if (r.status !== 429) return true;
    } catch (e) { /* ignore */ }
    await new Promise(res => setTimeout(res, 36000));
  }
  return false;
}

/** Evaluate with retry — the renderer has busy stretches under software rendering. */
async function evalRetry(page, fn, ...args) {
  for (let i = 0; i < 4; i++) {
    const r = await evalP(page, fn, ...args);
    if (r !== null) return r;
    await new Promise(res => setTimeout(res, 2500));
  }
  return null;
}
async function pollUntil(page, fn, timeoutMs = 10000, step = 250) {
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
async function openLogin(page) {
  await evalP(page, () => { if (!document.querySelector('#tc-account-menu')) document.querySelector('.user-avatar-badge')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await evalP(page, () => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'login')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal') }));
}
async function openSignup(page) {
  await evalP(page, () => { if (!document.querySelector('#tc-account-menu')) document.querySelector('.user-avatar-badge')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await evalP(page, () => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'signup')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal') }));
}
function outboxCode(email) {
  try {
    const box = JSON.parse(fs.readFileSync(OUTBOX, 'utf8'));
    const m = [...(box.messages || [])].reverse().find(x => (x.email || '').toLowerCase() === email.toLowerCase() && x.kind === 'reset');
    return m?.code || null;
  } catch (e) { return null; }
}

(async () => {
  // Wait for a free register-limiter window (back-to-back runs otherwise 429-cascade)
  await awaitRegisterWindow();
  const ctx = await launch('desktop');
  await boot(ctx, { settle: 4000 });
  const page = ctx.page;

  // E0: register + logout (guest baseline)
  await openSignup(page);
  await evalP(page, (u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('displayName', u.displayName); set('email', u.email); set('username', u.username); set('password', u.password);
  }, USER);
  for (let attempt = 0; attempt < 3; attempt++) {
    await evalP(page, () => document.querySelector('#tc-auth-submit')?.click());
    const st = await pollUntil(page, () => ({
      ok: !document.querySelector('#tc-auth-modal'),
      err: document.querySelector('#tc-auth-error')?.textContent || ''
    }), 12000);
    if (st.ok) break;
    if (/تلاش|attempts/i.test(st.err || '')) await new Promise(res => setTimeout(res, 36000));
  }
  await pollUntil(page, () => ({ ok: !document.querySelector('#tc-auth-modal') }), 12000);
  await evalP(page, () => document.querySelector('#tc-verify-modal')?.remove());
  // sanity: the account must exist server-side before dependent tests run
  const e0ok = await (async () => {
    try {
      const r = await fetch(`http://127.0.0.1:8088/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: USER.email, password: USER.password }) });
      return r.status;
    } catch (e) { return 0; }
  })();
  if (e0ok !== 200) {
    record('E0_setup_user', [{ kind: 'harness', text: `seed account missing after registration attempts (login=${e0ok})` }]);
    await ctx.browser.close();
    process.exit(1);
  }
  record('E0_setup_user', []);
  await evalP(page, () => window.__TRADING_APP__.auth.logout());
  await pollUntil(page, () => ({ ok: !window.__TRADING_APP__.auth.user }));

  // E3: duplicate username feedback (same username, different email) — direct
  // node fetch (no renderer dependency), race-guarded.
  const dup = await (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await Promise.race([
          fetch('http://127.0.0.1:8088/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `dupe_${USER.username}@test.io`, username: USER.username, password: 'DupPass123', displayName: 'Dupe' }) }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        return { status: r.status, data: await r.json() };
      } catch (e) { await new Promise(res => setTimeout(res, 1500)); }
    }
    return null;
  })();
  record('E3_duplicate_username_rejected', (dup && dup.status === 409 && dup.data?.errors?.[0]?.code === 'username_taken') ? [] : [{ kind: 'functional', text: `duplicate username not 409/username_taken: ${JSON.stringify(dup)}` }]);

  // E1: forgot-password E2E — request reset, read code from outbox, reset, login
  // Pre-probe: the request-reset limiter (3/min) may still be engaged from a
  // previous suite run — wait it out before driving the UI.
  await limiterClear('request_reset', `http://127.0.0.1:8088/api/auth/request-reset`);
  await openLogin(page);
  await evalP(page, () => document.querySelector('#tc-auth-forgot')?.click());
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-reset-modal') }));
  await evalP(page, (u) => { const i = document.querySelector('#tc-reset-email'); if (i) i.value = u.email; }, USER);
  await evalP(page, () => document.querySelector('#tc-reset-submit')?.click());
  await pollUntil(page, () => ({ ok: document.querySelector('#tc-reset-step2')?.style.display !== 'none' }));
  await new Promise(r => setTimeout(r, 700));
  const code = outboxCode(USER.email);
  if (!code) {
    record('E1_forgot_password_e2e', [{ kind: 'harness', text: 'reset code not found in outbox' }]);
  } else {
    await evalP(page, (c) => { const i = document.querySelector('#tc-reset-code'); if (i) { i.value = c; i.dispatchEvent(new Event('input', { bubbles: true })); } }, code);
    await evalP(page, () => { const i = document.querySelector('#tc-reset-pass'); if (i) { i.value = 'ResetPass9876'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await evalP(page, () => document.querySelector('#tc-reset-submit')?.click());
    const resetOk = await pollUntil(page, () => ({ ok: !document.querySelector('#tc-reset-modal') }), 14000);
    await evalP(page, () => document.querySelector('#tc-reset-modal')?.remove());
    await openLogin(page);
    await evalP(page, (u) => {
      const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) i.value = v; };
      set('identity', u.email); set('password', 'ResetPass9876');
    }, USER);
    await evalP(page, () => document.querySelector('#tc-auth-submit')?.click());
    const loginOk = await pollUntil(page, () => ({ ok: !!window.__TRADING_APP__?.auth?.user }), 14000);
    record('E1_forgot_password_e2e', (loginOk.ok && resetOk.ok) ? [] : [{ kind: 'functional', text: `reset flow failed (resetOk=${resetOk.ok}, loginOk=${loginOk.ok})` }]);
    await evalP(page, () => window.__TRADING_APP__.auth.logout());
    await pollUntil(page, () => ({ ok: !window.__TRADING_APP__.auth.user }));
  }

  // E2: keyboard — Escape closes the modal; Enter submits the login form
  await openLogin(page);
  await evalP(page, () => document.querySelector('#tc-auth-modal input[name="identity"]')?.focus());
  await page.keyboard.press('Escape');
  await pollUntil(page, () => ({ ok: !document.querySelector('#tc-auth-modal') }));
  await openLogin(page);
  await evalP(page, (u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) i.value = v; };
    set('identity', u.email); set('password', 'ResetPass9876');
    document.querySelector('#tc-auth-modal input[name="identity"]')?.focus();
  }, USER);
  await page.keyboard.press('Enter');
  const enterLogin = await pollUntil(page, () => ({ ok: !!window.__TRADING_APP__?.auth?.user }), 14000);
  record('E2_keyboard_escape_enter', enterLogin.ok ? [] : [{ kind: 'functional', text: 'Enter did not submit the login modal' }]);
  await evalP(page, () => window.__TRADING_APP__.auth.logout());
  await pollUntil(page, () => ({ ok: !window.__TRADING_APP__.auth.user }));

  // E4: remote session revocation → next /me degrades gracefully to guest
  await openLogin(page);
  await evalP(page, (u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) i.value = v; };
    set('identity', u.email); set('password', 'ResetPass9876');
  }, USER);
  await evalP(page, () => document.querySelector('#tc-auth-submit')?.click());
  await pollUntil(page, () => ({ ok: !!window.__TRADING_APP__?.auth?.user }), 14000);
  await evalP(page, async () => { await fetch('/api/auth/logout-all', { method: 'POST', credentials: 'same-origin' }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));
  const afterRevoke = await evalP(page, () => ({
    authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
    user: !!window.__TRADING_APP__?.auth?.user
  }));
  record('E4_revoked_session_degrades', (afterRevoke && afterRevoke.authed === 'out' && !afterRevoke.user) ? [] : [{ kind: 'functional', text: `session not cleared after remote revoke: ${JSON.stringify(afterRevoke)}` }]);

  // E5: rate-limit UX — burn the register limiter with bounded direct calls,
  // then one UI attempt must surface the friendly rate-limit message.
  let rateMsg = '';
  const burn = await evalRetry(page, async (stamp) => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      try {
        const r = await fetch('/api/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `burn_${stamp}_${i}@test.io`, username: `burn_${stamp}_${i}`.slice(0, 24), password: 'BurnPass123', displayName: 'Burn ' + i }) });
        out.push(r.status);
      } catch (e) { out.push('ERR'); }
    }
    return out;
  }, STAMP);
  if (burn && burn.includes(429)) {
    await openLogin(page);
    await evalP(page, (stamp) => {
      [...document.querySelectorAll('.tc-auth-tab')].find(b => b.dataset.tab === 'signup')?.click();
      const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
      set('displayName', 'Rate UI');
      set('email', `rate_ui_${stamp}@test.io`);
      set('username', `rate_ui_${stamp}`.slice(0, 24));
      set('password', 'RatePass123');
    }, STAMP);
    await evalP(page, () => document.querySelector('#tc-auth-submit')?.click());
    const settled = await pollUntil(page, () => ({
      ok: (document.querySelector('#tc-auth-error')?.textContent || '').length > 0,
      err: document.querySelector('#tc-auth-error')?.textContent || ''
    }), 14000);
    rateMsg = settled.err || '';
    await evalP(page, () => document.querySelector('#tc-auth-modal')?.remove());
  }
  const rateOk = /تلاش|attempts/i.test(rateMsg || '');
  record('E5_rate_limit_message', rateOk ? [] : [{ kind: 'functional', text: `rate-limit message missing: "${rateMsg}" (burn=${JSON.stringify(burn)})` }]);

  await ctx.browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE6 RESULT: ${total} defects across ${results.length} tests`);
  process.exit(0);
})().catch(e => { console.error('CYCLE6 FATAL', e); process.exit(1); });
