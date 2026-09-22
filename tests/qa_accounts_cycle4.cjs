// tests/qa_accounts_cycle4.cjs — i18n/RTL + mobile UX + validation edge cases.
const fs = require('fs');
const path = require('path');
const { launch, boot, EVID } = require('./qa_lib.cjs');

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle4');
fs.mkdirSync(OUT_DIR, { recursive: true });
const results = [];
function record(name, defects) {
  results.push({ name, defects });
  console.log(`${defects.length === 0 ? '✅' : '❌'} ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}
const STAMP = Date.now().toString(36);

/** Poll until the predicate passes (auth flows settle slowly under boot load). */
async function pollUntil(page, fn, timeoutMs = 8000, step = 250) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    last = await page.evaluate(fn);
    if (last.ok) return last;
    await new Promise(r => setTimeout(r, step));
  }
  return last;
}

/**
 * Open the auth modal reliably: click the avatar, poll for the menu, click the
 * requested item, poll for the modal + active tab. Returns the active tab.
 */
async function openAuthModalStrict(page, act) {
  await page.evaluate(() => {
    if (!document.querySelector('#tc-account-menu')) document.querySelector('.user-avatar-badge')?.click();
  });
  await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  await page.evaluate((a) => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === a)?.click(); }, act);
  const opened = await pollUntil(page, () => ({ ok: !!document.querySelector('#tc-auth-modal'), tab: document.querySelector('.tc-auth-tab.active')?.dataset.tab }));
  return opened;
}

// EN-leak detector for FA surfaces: text containing long latin words (excluding
// emails, URLs, tickers, brand names) inside FA-rendered account surfaces.
const EN_LEAK = /([A-Za-z]{4,})/g;
const ALLOW = /^(Sign|In|Up|OK|ID|PIN|OK|TC|GU|Plan|PRO)$/;

(async () => {
  // ── Persian mode: full account surface sweep ──
  const ctx = await launch('desktop');
  await boot(ctx, { lang: 'fa', settle: 4000 });
  const page = ctx.page;

  const d1 = [];
  const rtl = await page.evaluate(() => ({
    dir: document.documentElement.getAttribute('dir'),
    lang: document.documentElement.lang
  }));
  if (rtl.dir !== 'rtl' || rtl.lang !== 'fa') d1.push({ kind: 'i18n', text: `FA boot wrong: ${JSON.stringify(rtl)}` });

  // guest menu in FA
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 350));
  const guestMenu = await page.evaluate(() => {
    const m = document.querySelector('#tc-account-menu');
    return m ? { dir: m.dir, text: m.innerText } : null;
  });
  if (!guestMenu) d1.push({ kind: 'functional', text: 'guest account menu missing' });
  else {
    if (guestMenu.dir !== 'rtl') d1.push({ kind: 'i18n', text: 'guest menu not RTL' });
    if (guestMenu.text.includes('Sign In') || guestMenu.text.includes('Sign Up') || guestMenu.text.includes('Compare Plans')) d1.push({ kind: 'i18n', text: `EN leak in FA guest menu: ${guestMenu.text.slice(0, 80)}` });
  }
  await page.evaluate(() => document.body.click());
  record('FA1_rtl_guest_menu', d1);

  // auth modal FA + validation errors in FA
  const d2 = [];
  const openedFa = await openAuthModalStrict(page, 'signup');
  if (openedFa.tab !== 'signup') d2.push({ kind: 'functional', text: `signup modal did not open (tab=${openedFa.tab})` });
  await page.evaluate(() => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('displayName', 'کاربر آزمایشی');
    set('email', 'bad-email');
    set('username', 'ایران');
    set('password', 'کوتاه');
  });
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  const faErr = await pollUntil(page, () => {
    const box = document.querySelector('#tc-auth-error');
    const settled = box && box.style.display === 'block' && (box.textContent || '').length > 0;
    return { ok: settled, err: box?.textContent || '', visible: box ? getComputedStyle(box).display : 'none' };
  });
  if (!faErr.err) d2.push({ kind: 'functional', text: `no validation errors shown for bad FA inputs (steps=${JSON.stringify(await page.evaluate(() => ({ s: window.__apiSteps, dis: document.querySelector('#tc-auth-submit')?.disabled, mc: document.querySelectorAll('#tc-auth-modal').length })))})` });
  else if (faErr.visible === 'none') d2.push({ kind: 'layout', text: 'FA validation error not visible' });
  else {
    // errors must be Persian: contain Persian script
    if (!/[\u0600-\u06FF]/.test(faErr.err)) d2.push({ kind: 'i18n', text: `validation errors not Persian: ${faErr.err}` });
    // must mention invalid email specifically
    if (!faErr.err.includes('ایمیل')) d2.push({ kind: 'i18n', text: `email error not translated: ${faErr.err}` });
  }
  record('FA2_validation_errors_persian', d2);

  // auth modal in FA must be RTL with LTR credential inputs
  const d3 = [];
  const modalFa = await page.evaluate(() => {
    const m = document.querySelector('#tc-auth-modal .modal-box');
    if (!m) return null;
    const email = m.querySelector('input[name="email"]');
    return {
      boxDir: getComputedStyle(m).direction,
      emailDir: email ? getComputedStyle(email).direction : null,
      emailDirAttr: email ? email.getAttribute('dir') : null
    };
  });
  if (!modalFa) d3.push({ kind: 'functional', text: 'auth modal missing in FA check' });
  else {
    if (modalFa.boxDir !== 'rtl') d3.push({ kind: 'i18n', text: `auth modal box not RTL (${modalFa.boxDir})` });
    if (modalFa.emailDirAttr !== 'ltr') d3.push({ kind: 'i18n', text: `credential input not forced LTR (${modalFa.emailDirAttr})` });
  }
  record('FA3_auth_modal_rtl_inputs_ltr', d3);
  await page.evaluate(() => document.querySelector('#tc-auth-modal [data-close]')?.click());
  await new Promise(r => setTimeout(r, 300));

  // ── Signup in FA, then plans modal + account menu leak check ──
  const STAMP_FA = STAMP + 'fa';
  const d4 = [];
  await openAuthModalStrict(page, 'signup');
  await page.evaluate((s) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('displayName', 'حسین محمدی');
    set('email', `fa_${s}@test.io`);
    set('username', `fa_${s}`.slice(0, 24));
    set('password', 'FaPassw0rd99');
  }, STAMP_FA);
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => document.querySelector('#tc-verify-modal')?.remove());
  // signed-in menu in FA
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 350));
  const menuFa = await page.evaluate(() => {
    const m = document.querySelector('#tc-account-menu');
    return m ? { dir: m.dir, text: m.innerText, hasPlan: m.textContent.includes('پایه') } : null;
  });
  if (!menuFa) d4.push({ kind: 'functional', text: 'signed-in menu missing' });
  else {
    if (menuFa.dir !== 'rtl') d4.push({ kind: 'i18n', text: 'signed-in menu not RTL' });
    if (!menuFa.hasPlan) d4.push({ kind: 'i18n', text: `plan label not Persian: ${menuFa.text.slice(0, 60)}` });
    if (menuFa.text.includes('Profile & Settings') || menuFa.text.includes('Sign Out') || menuFa.text.includes('Active Devices')) d4.push({ kind: 'i18n', text: 'EN leak in FA signed-in menu' });
  }
  await page.evaluate(() => document.body.click());
  // plans modal FA leak check
  await page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
  await new Promise(r => setTimeout(r, 800));
  const plansFa = await page.evaluate(() => {
    const m = document.querySelector('#tc-plans-modal');
    if (!m) return null;
    const txt = m.innerText;
    const leaks = ['Charts per tab', 'Saved layouts', 'Indicators per chart', 'Price alerts', 'Historical bars', 'Sign in', 'Upgrade'].filter(x => txt.includes(x));
    return { leaks, rows: m.querySelectorAll('tbody tr').length };
  });
  if (!plansFa) d4.push({ kind: 'functional', text: 'FA plans modal missing' });
  else if (plansFa.leaks.length) d4.push({ kind: 'i18n', text: `EN leaks in FA plans modal: ${plansFa.leaks.join(', ')}` });
  await page.evaluate(() => document.querySelector('#tc-plans-modal [data-close]')?.click());
  record('FA4_signedin_plans_fa_complete', d4);
  await ctx.browser.close();

  // ── Mobile UX: modals fit, no horizontal overflow ──
  const M = await launch('mobile');
  await boot(M, { lang: 'fa', settle: 4000 });
  const d5 = [];
  await M.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await pollUntil(M.page, () => ({ ok: !!document.querySelector('#tc-account-menu') }));
  const menuFit = await M.page.evaluate(() => {
    const m = document.querySelector('#tc-account-menu');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
  });
  if (!menuFit) d5.push({ kind: 'functional', text: 'mobile account menu missing' });
  else {
    if (menuFit.left < -1 || menuFit.right > menuFit.vw + 1) d5.push({ kind: 'layout', text: `mobile menu overflows horizontally: ${JSON.stringify(menuFit)}` });
    if (menuFit.bottom > menuFit.vh + 1) d5.push({ kind: 'layout', text: `mobile menu overflows bottom: ${JSON.stringify(menuFit)}` });
  }
  await M.page.evaluate(() => document.body.click());
  // auth modal fit on mobile
  await openAuthModalStrict(M.page, 'signup');
  const authFit = await M.page.evaluate(() => {
    const m = document.querySelector('#tc-auth-modal .modal-box');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const inputs = [...m.querySelectorAll('input')].map(i => { const ir = i.getBoundingClientRect(); return { name: i.name, w: ir.width, visible: ir.width > 40 }; });
    return { left: r.left, right: r.right, vw: window.innerWidth, inputs, submit: !!m.querySelector('#tc-auth-submit') };
  });
  if (!authFit) d5.push({ kind: 'functional', text: 'mobile auth modal missing' });
  else {
    if (authFit.left < -1 || authFit.right > authFit.vw + 1) d5.push({ kind: 'layout', text: `mobile auth modal overflows: ${JSON.stringify({ left: authFit.left, right: authFit.right, vw: authFit.vw })}` });
    for (const i of authFit.inputs) if (!i.visible) d5.push({ kind: 'layout', text: `mobile input ${i.name} too narrow (${Math.round(i.w)}px)` });
    if (!authFit.submit) d5.push({ kind: 'functional', text: 'mobile signup submit missing' });
  }
  await M.page.evaluate(() => document.querySelector('#tc-auth-modal [data-close]')?.click());
  record('FA5_mobile_modal_fit', d5);
  await M.browser.close();

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE4 RESULT: ${total} defects across ${results.length} tests`);
  process.exit(0);
})().catch(e => { console.error('CYCLE4 FATAL', e); process.exit(1); });
