// tests/qa_accounts_cycle2.cjs — Cloud sync across two devices + persistence depth.
// Device A (desktop): mutate watchlist/alerts/theme/paper account → device B (mobile)
// boots, logs in, and must see the same state. Also verifies local reload persistence.
const fs = require('fs');
const path = require('path');
const { launch, boot, EVID, awaitRegisterWindow } = require('./qa_lib.cjs');

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle2');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAMP = Date.now().toString(36);
const USER = { email: `sync_${STAMP}@test.io`, username: ('sync_' + STAMP).slice(0, 24), password: 'SyncPass123', displayName: 'Sync Tester' };
const results = [];
function record(name, defects, extra = {}) {
  results.push({ name, defects, ...extra });
  console.log(`${defects.length === 0 ? '✅' : '❌'} ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}

async function signupOnce(page) {
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'signup')?.click(); });
  await new Promise(r => setTimeout(r, 450));
  await page.evaluate((u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('displayName', u.displayName); set('email', u.email); set('username', u.username); set('password', u.password);
  }, USER);
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => document.querySelector('#tc-verify-modal')?.remove());
}

async function loginOnce(page) {
  await page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'login')?.click(); });
  await new Promise(r => setTimeout(r, 450));
  await page.evaluate((u) => {
    const set = (n, v) => { const i = document.querySelector(`#tc-auth-modal input[name="${n}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('identity', u.email); set('password', u.password);
  }, USER);
  await page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
  await new Promise(r => setTimeout(r, 2500));
}

// Harness guard: if signup/login silently fails (e.g. the per-IP register limiter,
// 5/min, was drained by another process), every sync check below would run as a
// guest and report misleading "sync" defects. Verify the account really exists,
// wait out the limiter window once, and otherwise fail loudly as an env error.
async function authStep(page, once, label) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = page.waitForResponse(r => /\/api\/auth\/(register|login)$/.test(new URL(r.url()).pathname), { timeout: 15000 }).catch(() => null);
    await once(page);
    const r = await resp;
    if (await page.evaluate(() => Boolean(window.__TRADING_APP__?.auth?.user))) return true;
    console.log(`⚠ ${label} attempt ${attempt} failed (HTTP ${r ? r.status() : 'no response'})`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { document.querySelector('#tc-auth-modal')?.remove(); document.querySelector('#tc-verify-modal')?.remove(); });
    if (attempt === 1) await new Promise(res => setTimeout(res, 62000));
  }
  return false;
}
const signup = (page) => authStep(page, signupOnce, 'signup');
const login = (page) => authStep(page, loginOnce, 'login');

(async () => {
  // Wait for a free register-limiter window (back-to-back runs otherwise 429-cascade)
  await awaitRegisterWindow();
  // ── Device A: register, upgrade to Plus (simulated billing), then mutate ──
  const A = await launch('desktop');
  await boot(A, { settle: 3500 });
  if (!(await signup(A.page))) {
    record('A_setup_signup', [{ kind: 'env', text: 'signup did not complete — sync checks skipped (see ⚠ lines)' }]);
    console.log('CYCLE2 RESULT: aborted — environment failure (signup)');
    await A.browser.close();
    process.exit(2);
  }

  // A0: on Basic, the tier gates must REJECT over-limit creations (TradingView parity)
  const basicBlocks = await A.page.evaluate(() => {
    const out = { watchlistBlocked: false, alertBlocked: false, paperBlocked: false };
    const app = window.__TRADING_APP__;
    out.watchlistBlocked = app.watchlist.createList('Should Fail') === null;
    // Fill the Basic quota (3) with real alerts, then the 4th must be refused.
    app.alertsManager.currentPrice = 78000;
    const filled = [97000, 98000, 98500].map(px => app.alertsManager.addAlert(px)).filter(Boolean).length;
    out.alertQuotaFilled = filled;
    out.alertBlocked = filled === 3 && app.alertsManager.addAlert(99000) === null;
    out.paperBlocked = app.paperTrading.createAccount('Should Fail') === null;
    return out;
  });
  const d0 = [];
  if (!basicBlocks.watchlistBlocked) d0.push({ kind: 'gate', text: 'basic plan allowed a 2nd watchlist (limit 1)' });
  if (!basicBlocks.alertBlocked) d0.push({ kind: 'gate', text: 'basic plan allowed a 4th price alert (limit 3)' });
  if (!basicBlocks.paperBlocked) d0.push({ kind: 'gate', text: 'basic plan allowed a 2nd paper account (limit 1)' });
  record('A0_basic_plan_gates_enforced', d0);

  // upgrade to Plus via the product's own plan-switch API (simulated billing)
  await A.page.evaluate(() => window.__TRADING_APP__.auth.setPlan('plus'));
  await new Promise(r => setTimeout(r, 600));

  // 1. add two custom watchlist symbols
  await A.page.evaluate(() => {
    const app = window.__TRADING_APP__;
    const wl = app.watchlist;
    for (const sym of ['DOGEUSDT', 'ADAUSDT']) {
      if (!wl.customSymbols.includes(sym)) wl.customSymbols.push(sym);
    }
    localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(wl.customSymbols));
  });
  // 2. add a second named watchlist (Plus allows 10)
  await A.page.evaluate(() => {
    window.__TRADING_APP__.watchlist.createList('Altcoins');
  });
  // 3. add a price alert (Plus allows 100)
  await A.page.evaluate(() => {
    const am = window.__TRADING_APP__.alertsManager;
    am.currentPrice = 78000;
    am.addAlert(99000);
  });
  // 4. switch theme to light
  await A.page.evaluate(() => {
    localStorage.setItem('tradingchart_theme', 'light');
    window.__TRADING_APP__.applyStoredTheme();
  });
  // 5. create a second paper account with a custom name (Plus allows 4)
  await A.page.evaluate(() => {
    const pt = window.__TRADING_APP__.paperTrading;
    pt.createAccount('Prop Challenge');
  });
  // 6. force a sync push and wait for it (retry absorbs the 409 rebase cycle)
  const pushA = await A.page.evaluate(async () => {
    const am = window.__TRADING_APP__.auth;
    await am.pushCloudState({ force: true });
    await new Promise(r => setTimeout(r, 600));
    if (am.lastSyncError === 'conflict') await am.pushCloudState({ force: true });
    return { err: am.lastSyncError, at: am.cloudUpdatedAt };
  });
  console.log('pushA:', JSON.stringify(pushA));

  // reload device A to prove persistence survives reload
  await A.page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));
  const afterReload = await A.page.evaluate(() => {
    const wlDoc = JSON.parse(localStorage.getItem('tradingchart_user_watchlists') || '{"lists":[]}');
    return {
      watchlists: wlDoc.lists.map(l => l.name),
      mainSymbols: (wlDoc.lists.find(l => l.id === 'wl_main') || {}).symbols || [],
      activeList: wlDoc.activeId,
      alerts: JSON.parse(localStorage.getItem('tradingchart_alerts') || '[]').length,
      theme: localStorage.getItem('tradingchart_theme'),
      paperAccounts: JSON.parse(localStorage.getItem('tradingchart_paper_accounts') || '[]').map(a => a.name)
    };
  });
  console.log('A after reload:', JSON.stringify(afterReload));
  const d1 = [];
  if (!afterReload.mainSymbols.includes('DOGEUSDT')) d1.push({ kind: 'sync', text: 'symbol DOGEUSDT lost after reload' });
  if (!afterReload.watchlists.includes('Altcoins')) d1.push({ kind: 'sync', text: 'watchlist Altcoins lost after reload' });
  if (afterReload.alerts < 4 /* 3 basic + 1 after upgrade */) d1.push({ kind: 'sync', text: `alerts not persisted (${afterReload.alerts})` });
  if (afterReload.theme !== 'light') d1.push({ kind: 'sync', text: 'theme not persisted' });
  if (!afterReload.paperAccounts.includes('Prop Challenge')) d1.push({ kind: 'sync', text: 'paper account lost' });
  record('A1_mutate_and_reload_persist', d1);
  await A.browser.close();

  // ── Device B (different profile, mobile viewport): login → pull state ──
  const B = await launch('mobile');
  await boot(B, { settle: 3500 });
  // wipe local storage to simulate a genuinely different device
  await B.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await B.page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));
  await login(B.page);
  await new Promise(r => setTimeout(r, 1500));
  const stateB = await B.page.evaluate(() => {
    const wlDoc = JSON.parse(localStorage.getItem('tradingchart_user_watchlists') || '{"lists":[]}');
    return {
      watchlists: wlDoc.lists.map(l => l.name),
      mainSymbols: (wlDoc.lists.find(l => l.id === 'wl_main') || {}).symbols || [],
      alerts: JSON.parse(localStorage.getItem('tradingchart_alerts') || '[]').length,
      theme: localStorage.getItem('tradingchart_theme'),
      paperAccounts: JSON.parse(localStorage.getItem('tradingchart_paper_accounts') || '[]').map(a => a.name),
      docTheme: document.documentElement.dataset.theme || 'dark'
    };
  });
  console.log('B state:', JSON.stringify(stateB));
  const d2 = [];
  if (!stateB.watchlists.includes('Altcoins')) d2.push({ kind: 'sync', text: `watchlists not pulled to device B (${JSON.stringify(stateB.watchlists)})` });
  if (!stateB.mainSymbols.includes('DOGEUSDT')) d2.push({ kind: 'sync', text: 'symbols not pulled to device B' });
  if (stateB.alerts < 4) d2.push({ kind: 'sync', text: `alerts not pulled (${stateB.alerts})` });
  if (stateB.theme !== 'light') d2.push({ kind: 'sync', text: 'theme not pulled' });
  if (!stateB.paperAccounts.includes('Prop Challenge')) d2.push({ kind: 'sync', text: 'paper accounts not pulled' });
  record('B1_cross_device_pull', d2);

  // ── Device B mutates → Device C (desktop re-login) receives B's changes ──
  // (manager's in-memory list predates the login pull — union with storage
  // first so the pulled symbols are not lost)
  await B.page.evaluate(() => {
    const wl = window.__TRADING_APP__.watchlist;
    const stored = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '[]');
    for (const s of stored) if (!wl.customSymbols.includes(s)) wl.customSymbols.push(s);
    if (!wl.customSymbols.includes('LINKUSDT')) wl.customSymbols.push('LINKUSDT');
    localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(wl.customSymbols));
  });
  const pushB = await B.page.evaluate(async () => {
    const am = window.__TRADING_APP__.auth;
    await am.pushCloudState({ force: true });
    await new Promise(r => setTimeout(r, 600));
    if (am.lastSyncError === 'conflict') await am.pushCloudState({ force: true });
    return am.lastSyncError;
  });
  console.log('pushB err:', pushB);
  await B.browser.close();

  const C = await launch('desktop');
  await boot(C, { settle: 3500 });
  await login(C.page);
  await new Promise(r => setTimeout(r, 1500));
  const symbolsC = await C.page.evaluate(() => JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '[]'));
  const d3 = symbolsC.includes('LINKUSDT') ? [] : [{ kind: 'sync', text: `B→C sync failed (${JSON.stringify(symbolsC)})` }];
  record('C1_bidirectional_sync', d3);

  // ── Logout from C must NOT leak state to a fresh guest ──
  await C.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
  await new Promise(r => setTimeout(r, 300));
  await C.page.evaluate(() => { [...document.querySelectorAll('#tc-account-menu [data-act]')].find(x => x.dataset.act === 'logout')?.click(); });
  await new Promise(r => setTimeout(r, 800));
  await C.page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));
  const guest = await C.page.evaluate(() => ({
    authed: document.querySelector('.user-avatar-badge')?.dataset.auth,
    user: window.__TRADING_APP__?.auth?.user
  }));
  const d4 = (guest.authed !== 'out' || guest.user) ? [{ kind: 'functional', text: `guest state after logout: ${guest.authed}` }] : [];
  record('C2_logout_clean', d4);

  await C.browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE2 RESULT: ${total} defects across ${results.length} tests`);
  process.exit(0);
})().catch(e => { console.error('CYCLE2 FATAL', e); process.exit(1); });
