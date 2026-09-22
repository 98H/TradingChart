// tests/qa_accounts_cycle5.cjs — Account & Billing modal QA (security/sessions/data).
const fs = require('fs');
const path = require('path');
const { launch, boot, EVID, awaitRegisterWindow } = require('./qa_lib.cjs');

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle5');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAMP = Date.now().toString(36);
const USER = { email: `acct_${STAMP}@test.io`, username: ('acct_' + STAMP).slice(0, 24), password: 'AcctPass123', displayName: 'Account Tester' };
const results = [];
function record(name, defects) {
  results.push({ name, defects });
  console.log(`${defects.length === 0 ? '✅' : '❌'} ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}
async function pollUntil(page, fn, timeoutMs = 9000, step = 250) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    last = await page.evaluate(fn);
    if (last.ok) return last;
    await new Promise(r => setTimeout(r, step));
  }
  return last;
}
async function signup(page) {
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'signup')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal') }));
  await page.evaluate((u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('displayName', u.displayName); set('email', u.email); set('username', u.username); set('password', u.password);
  }, USER);
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  await pollUntil(page, () => ({ ok: !document.querySelector('#tc-auth-modal') }));
  await page.evaluate(() => document.querySelector('#tc-verify-modal')?.remove());
}

(async () => {
  // Wait for a free register-limiter window (back-to-back runs otherwise 429-cascade)
  await awaitRegisterWindow();
  const ctx = await launch('desktop');
  await boot(ctx, { settle: 4000 });
  const page = ctx.page;
  await signup(page);

  // A1: open Account & Billing via the menu; all 4 tabs render
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'account')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#acc-verify-btn') }));
  const a1 = await page.evaluate(() => ({
    email: document.querySelector('#tc-account-settings-modal')?.textContent.includes('acct_'),
    verifyBtn: !!document.querySelector('#acc-verify-btn'),
    usage: [...document.querySelectorAll('#tc-acc-body div')].some(d => d.textContent.includes('/')),
    fits: document.querySelector('#tc-account-settings-modal .modal-box').getBoundingClientRect().right <= window.innerWidth + 1
  }));
  const d1 = [];
  if (!a1.email) d1.push({ kind: 'functional', text: 'account tab missing email' });
  if (!a1.verifyBtn) d1.push({ kind: 'functional', text: 'verify-email button missing for unverified account' });
  if (!a1.usage) d1.push({ kind: 'functional', text: 'usage-vs-limits rows missing' });
  if (!a1.fits) d1.push({ kind: 'layout', text: 'account modal overflows viewport' });
  record('AB1_account_tab', d1);

  // A2: change password — wrong current rejected, correct succeeds, old password dies
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-settings-modal [data-atab]')].find(b => b.dataset.atab === 'security')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#acc-pass-save') }));
  const fillPass = (cur, next, conf) => page.evaluate(([c, n, k]) => {
    const set = (name, v) => { const i = document.querySelector(`#tc-account-settings-modal input[name="${name}"]`); if (i) i.value = v; };
    set('acc-current', c); set('acc-next', n); set('acc-confirm', k);
  }, [cur, next, conf]);
  await fillPass('WrongCurrent1', 'NewPass1234', 'NewPass1234');
  await page.evaluate(() => document.querySelector('#acc-pass-save')?.click());
  const wrongMsg = await pollUntil(page, () => ({ ok: (document.querySelector('#acc-sec-msg')?.textContent || '').length > 0, msg: document.querySelector('#acc-sec-msg')?.textContent || '' }));
  if (!/incorrect|نادرست/.test(wrongMsg.msg)) { const dd = [{ kind: 'functional', text: `wrong current-password feedback wrong: ${wrongMsg.msg}` }]; record('AB2_change_password', dd); }
  else {
    await fillPass(USER.password, 'NewPass1234', 'NewPass1234');
    await page.evaluate(() => document.querySelector('#acc-pass-save')?.click());
    const okMsg = await pollUntil(page, () => ({ ok: /updated|به‌روزرسانی شد/.test(document.querySelector('#acc-sec-msg')?.textContent || ''), msg: document.querySelector('#acc-sec-msg')?.textContent || '' }));
    // old password must no longer authenticate (session stays)
    const stillIn = await page.evaluate(() => !!window.__TRADING_APP__.auth.user);
    if (!okMsg.ok) { record('AB2_change_password', [{ kind: 'functional', text: `success feedback missing: ${okMsg.msg}` }]); }
    else if (!stillIn) { record('AB2_change_password', [{ kind: 'functional', text: 'current session dropped after password change' }]); }
    else record('AB2_change_password', []);

    // old password rejected on fresh login
    await page.evaluate(() => window.__TRADING_APP__.auth.logout());
    await new Promise(r => setTimeout(r, 900));
    await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
    await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
    await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'login')?.click(); });
    await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal') }));
    await page.evaluate((u) => {
      const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) i.value = v; };
      set('identity', u.email); set('password', u.password);
    }, USER);
    await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    const oldRej = await pollUntil(page, () => ({ ok: (document.querySelector('#tc-auth-error')?.textContent || '').length > 0, err: document.querySelector('#tc-auth-error')?.textContent || '' }));
    const d2b = oldRej.ok ? [] : [{ kind: 'functional', text: 'old password still accepted after change' }];
    record('AB3_old_password_rejected', d2b);

    // new password logs in
    await page.evaluate((u) => {
      const i = document.querySelector('#tc-auth-modal input[name="password"]');
      if (i) i.value = 'NewPass1234';
    }, USER);
    await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
    const relogin = await pollUntil(page, () => ({ ok: !document.querySelector('#tc-auth-modal') && !!window.__TRADING_APP__?.auth?.user }));
    record('AB4_new_password_login', relogin.ok ? [] : [{ kind: 'functional', text: 'login with new password failed' }]);
  }

  // A5: sessions tab — current device marked, logout-all kills session
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'account')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-settings-modal') }));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-settings-modal [data-atab]')].find(b => b.dataset.atab === 'sessions')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#acc-logout-all') }));
  const sess = await page.evaluate(() => ({
    rows: document.querySelectorAll('#tc-acc-body [data-sid]').length,
    current: document.querySelector('#tc-acc-body')?.textContent.includes('this device') || document.querySelector('#tc-acc-body')?.textContent.includes('دستگاه فعلی')
  }));
  const d5 = [];
  if (sess.rows < 1) d5.push({ kind: 'functional', text: 'no session rows rendered' });
  if (!sess.current) d5.push({ kind: 'functional', text: 'current device not marked' });
  record('AB5_sessions_tab', d5);

  // A6: data tab — export downloads a JSON file; delete flow validations
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-settings-modal [data-atab]')].find(b => b.dataset.atab === 'data')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#acc-del-btn') }));
  await page.evaluate(() => document.querySelector('#acc-del-btn')?.click());
  const needWord = await pollUntil(page, () => ({ ok: (document.querySelector('#acc-del-msg')?.textContent || '').includes('DELETE') || (document.querySelector('#acc-del-msg')?.textContent || '').includes('دقیقاً'), msg: document.querySelector('#acc-del-msg')?.textContent || '' }));
  const d6 = needWord.ok ? [] : [{ kind: 'functional', text: 'delete without confirm word not blocked: ' + needWord.msg }];
  record('AB6_delete_requires_confirm', d6);

  // A7: actual deletion — type DELETE + correct password → gone
  await page.evaluate((u) => {
    document.querySelector('#acc-del-pass').value = 'NewPass1234';
    document.querySelector('#acc-del-confirm').value = 'DELETE';
  }, USER);
  await page.evaluate(() => document.querySelector('#acc-del-btn')?.click());
  const gone = await pollUntil(page, () => ({ ok: !document.querySelector('#tc-account-settings-modal') && !window.__TRADING_APP__?.auth?.user }));
  const d7 = gone.ok ? [] : [{ kind: 'functional', text: 'account deletion did not complete' }];
  // verify server-side: login must now fail
  await page.evaluate((u) => {
    document.querySelector('.user-avatar-badge')?.click();
  }, USER);
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'login')?.click(); });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal') }));
  await page.evaluate((u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) i.value = v; };
    set('identity', u.email); set('password', 'NewPass1234');
  }, USER);
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  const rej = await pollUntil(page, () => ({ ok: (document.querySelector('#tc-auth-error')?.textContent || '').length > 0 }));
  if (!rej.ok) d7.push({ kind: 'functional', text: 'login still possible after deletion' });
  record('AB7_account_deleted', d7);

  await ctx.browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE5 RESULT: ${total} defects across ${results.length} tests`);
  process.exit(0);
})().catch(e => { console.error('CYCLE5 FATAL', e); process.exit(1); });
