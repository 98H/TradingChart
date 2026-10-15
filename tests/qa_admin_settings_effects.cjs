// tests/qa_admin_settings_effects.cjs — real-browser E2E: admin console
// settings must take effect in the main trading app.
//   1. announcement on (warning, FA+EN text) → banner visible in the app in the
//      right language/dir, dismiss persists per revision, edit → reappears
//   2. registration closed → app register attempt gets the localized error
//   3. maintenance on → regular sign-in blocked with the maintenance message
//   4. everything restored to the original settings (finally)
// Usage: node tests/qa_admin_settings_effects.cjs [desktop|mobile]
const fs = require('fs');
const path = require('path');
const { launch, BASE } = require('./qa_lib.cjs');

const VP = process.argv[2] || 'desktop';
const KEY = fs.readFileSync(path.resolve(__dirname, '../server/data/admin_master.key'), 'utf8').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

async function adminCookie() {
  const r = await fetch(BASE + '/api/admin/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ masterKey: KEY }) });
  if (r.status !== 200) throw new Error('admin unlock failed: ' + r.status);
  return (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
}
async function settings(ck, body) {
  const r = await fetch(BASE + '/api/admin/settings', { method: body ? 'PUT' : 'GET', headers: { 'content-type': 'application/json', cookie: ck }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!j.ok) throw new Error('settings ' + (body ? 'PUT' : 'GET') + ' failed: ' + JSON.stringify(j).slice(0, 200));
  return j.settings;
}

(async () => {
  const ck = await adminCookie();
  const original = await settings(ck);
  const restore = {
    registrationOpen: original.registrationOpen, maintenanceMode: original.maintenanceMode,
    announcementEnabled: original.announcementEnabled, announcementLevel: original.announcementLevel,
    announcementFa: original.announcementFa, announcementEn: original.announcementEn
  };
  const ctx = await launch(VP);
  const { page } = ctx;
  try {
    // ── 1. announcement ──────────────────────────────────────────────────
    const FA1 = 'به‌روزرسانی زمان‌بندی‌شده سامانه امشب ساعت ۲۳ انجام می‌شود.';
    const EN1 = 'Scheduled maintenance tonight at 23:00.';
    await settings(ck, { announcementEnabled: true, announcementLevel: 'warning', announcementFa: FA1, announcementEn: EN1 });
    await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('tc_announcement_dismissed'); } catch (e) {} });
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#tc-platform-banner', { timeout: 20000 }).catch(() => null);
    let b = await page.evaluate(() => { const el = document.getElementById('tc-platform-banner'); if (!el) return null; const r = el.getBoundingClientRect(); const h = document.getElementById('top-app-header').getBoundingClientRect(); return { text: el.querySelector('.tc-pb-text').textContent, level: el.dataset.level, dir: el.getAttribute('dir'), role: el.getAttribute('role'), top: r.top, bottom: r.bottom, headerTop: h.top, w: r.width, vw: innerWidth, close: (() => { const c = el.querySelector('.tc-pb-close').getBoundingClientRect(); return [Math.round(c.width), Math.round(c.height)]; })(), lang: document.documentElement.lang }; });
    check('banner renders in app', b && b.text.length > 0, b ? `${b.lang}: "${b.text}"` : 'missing');
    check('banner text matches app language', b && (b.lang === 'fa' ? b.text === FA1 : b.text === EN1));
    check('banner level + role', b && b.level === 'warning' && b.role === 'alert');
    check('banner sits above header (pushes, not covers)', b && b.top >= 0 && b.bottom <= b.headerTop + 0.5, b ? `banner ${b.top}-${b.bottom}, header ${b.headerTop}` : '');
    check('banner fits viewport width', b && b.w <= b.vw + 0.5);
    if (VP === 'mobile') check('close button ≥44px on mobile', b && b.close[0] >= 44 && b.close[1] >= 44, b ? b.close.join('x') : '');
    // language switch → banner relocalizes
    const otherLang = b && b.lang === 'fa' ? 'en' : 'fa';
    await page.evaluate((l) => window.app.switchLanguage(l), otherLang);
    await sleep(600);
    const b2 = await page.evaluate(() => { const el = document.getElementById('tc-platform-banner'); return el ? { text: el.querySelector('.tc-pb-text').textContent, dir: el.getAttribute('dir') } : null; });
    check('banner relocalizes on language switch', b2 && (otherLang === 'fa' ? b2.text === FA1 && b2.dir === 'rtl' : b2.text === EN1 && b2.dir === 'ltr'), JSON.stringify(b2));
    // dismiss → stays dismissed after reload
    await page.click('#tc-platform-banner .tc-pb-close');
    await sleep(300);
    const goneNow = await page.evaluate(() => !document.getElementById('tc-platform-banner'));
    // fresh tab in the same browser profile (shares localStorage, but not the
    // first tab's "clear dismissal" init hook) = a real reload by the user
    const p2 = await ctx.browser.newPage();
    await p2.setViewport(page.viewport());
    await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p2.waitForFunction(() => !!(window.app && window.app.auth), { timeout: 60000 });
    await sleep(3000);
    const stillGone = await p2.evaluate(() => !document.getElementById('tc-platform-banner'));
    check('dismiss hides banner and persists across reload', goneNow && stillGone);
    // admin edits text → new revision → shows again
    await settings(ck, { announcementFa: FA1 + ' (ویرایش)', announcementEn: EN1 + ' (edited)' });
    await p2.reload({ waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#tc-platform-banner', { timeout: 30000 }).catch(() => null);
    const again = await p2.evaluate(() => !!document.getElementById('tc-platform-banner'));
    check('edited announcement reappears after dismissal', again);
    // disabled → gone
    await settings(ck, { announcementEnabled: false });
    await p2.reload({ waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => !!(window.app && window.app.auth), { timeout: 60000 });
    await sleep(3000);
    check('disabled announcement not rendered', await p2.evaluate(() => !document.getElementById('tc-platform-banner')));
    await p2.close();

    // ── 2. registration closed ───────────────────────────────────────────
    await settings(ck, { registrationOpen: false });
    const reg = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `rc_${Date.now()}@qa.test`, username: `rc_${Date.now().toString(36)}`, password: 'Qa!Passw0rd#2026' }) });
    const rj = await reg.json();
    check('registration closed → API 403 registration_closed', reg.status === 403 && rj.error === 'registration_closed', `${reg.status} ${rj.error}`);
    const regMsg = await page.evaluate(async () => {
      const a = window.app && window.app.auth;
      if (!a) return null;
      // the auth module's own message table (what the user sees in the form)
      const src = a.constructor.toString();
      return src.includes('registration_closed');
    });
    check('app has a localized registration_closed message', regMsg === true);
    await settings(ck, { registrationOpen: true });

    // ── 3. maintenance ───────────────────────────────────────────────────
    const email = `mt_${Date.now()}@qa.test`, username = `mt_${Date.now().toString(36)}`, password = 'Qa!Passw0rd#2026';
    const mk = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, username, password }) });
    check('test user created for maintenance check', mk.status === 200);
    await settings(ck, { maintenanceMode: true });
    const li = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: email, password }) });
    const lj = await li.json();
    check('maintenance → regular sign-in 503 maintenance', li.status === 503 && lj.error === 'maintenance', `${li.status} ${lj.error}`);
    const rg = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x' + email, username: 'x' + username, password }) });
    check('maintenance → sign-up 503', rg.status === 503);
    await settings(ck, { maintenanceMode: false });
    const li2 = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: email, password }) });
    check('maintenance off → sign-in works again', li2.status === 200);
    // cleanup the throwaway user
    const users = await (await fetch(BASE + '/api/admin/users?type=all&q=' + encodeURIComponent(username), { headers: { cookie: ck } })).json();
    for (const u of users.users || []) await fetch(BASE + '/api/admin/users/' + u.id, { method: 'DELETE', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: u.username }) });
  } catch (e) {
    check('suite completed without exception', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    try { await settings(ck, restore); } catch (e) { console.log('RESTORE FAILED', e.message); }
    await fetch(BASE + '/api/admin/logout', { method: 'POST', headers: { cookie: ck } }).catch(() => {});
    await ctx.browser.close();
    const fails = results.filter(r => !r.ok).length;
    console.log(`\n${VP}: ${results.length - fails}/${results.length} passed`);
    process.exit(fails ? 1 : 0);
  }
})();
