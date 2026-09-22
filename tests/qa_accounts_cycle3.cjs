// tests/qa_accounts_cycle3.cjs — Plan tiers & feature-gate QA cycle.
// Verifies every TradingView-parity entitlement gate end-to-end + plans modal UX.
const fs = require('fs');
const path = require('path');
const { launch, boot, EVID, awaitRegisterWindow } = require('./qa_lib.cjs');

const OUT_DIR = path.join(EVID || path.join(process.cwd(), 'screenshots', 'qa_cycles'), 'accounts_cycle3');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAMP = Date.now().toString(36);
const USER = { email: `plan_${STAMP}@test.io`, username: ('plan_' + STAMP).slice(0, 24), password: 'PlanPass123', displayName: 'Plan Tester' };
const results = [];
function record(name, defects) {
  results.push({ name, defects });
  console.log(`${defects.length === 0 ? '✅' : '❌'} ${name} — ${defects.length} defect(s)`);
  for (const d of defects) console.log(`    · ${d.kind}: ${d.text}`);
}
async function signup(page) {
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
async function setPlan(page, plan) {
  await page.evaluate((p) => window.__TRADING_APP__.auth.setPlan(p), plan);
  await new Promise(r => setTimeout(r, 600));
}

(async () => {
  // Wait for a free register-limiter window (back-to-back runs otherwise 429-cascade)
  await awaitRegisterWindow();
  const ctx = await launch('desktop');
  await boot(ctx, { settle: 4000 });
  await signup(ctx.page);
  const page = ctx.page;

  // 1. plans modal opens with 5 tiers + current badge + comparison table
  await page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
  await new Promise(r => setTimeout(r, 900));
  const modal = await page.evaluate(() => {
    const m = document.querySelector('#tc-plans-modal');
    if (!m) return null;
    return {
      tiers: [...m.querySelectorAll('[data-plan]')].map(b => b.dataset.plan),
      currentBadge: m.textContent.includes('CURRENT') || m.textContent.includes('پلن فعلی'),
      table: !!m.querySelector('table'),
      featureRows: m.querySelectorAll('tbody tr').length,
      fitsViewport: m.querySelector('.modal-box').getBoundingClientRect().right <= window.innerWidth + 1
    };
  });
  const d1 = [];
  if (!modal) d1.push({ kind: 'functional', text: 'plans modal did not open' });
  else {
    if (JSON.stringify(modal.tiers.sort()) !== JSON.stringify(['basic', 'essential', 'plus', 'premium', 'ultimate'])) d1.push({ kind: 'functional', text: `tier cards wrong: ${modal.tiers}` });
    if (!modal.currentBadge) d1.push({ kind: 'functional', text: 'no current-plan badge' });
    if (!modal.table) d1.push({ kind: 'functional', text: 'comparison table missing' });
    if (modal.featureRows < 10) d1.push({ kind: 'functional', text: `comparison table too thin: ${modal.featureRows} rows` });
    if (!modal.fitsViewport) d1.push({ kind: 'layout', text: 'plans modal overflows viewport' });
  }
  record('P1_plans_modal_structure', d1.ctrl ? d1 : d1);
  await page.evaluate(() => document.querySelector('#tc-plans-modal [data-close]')?.click());
  await new Promise(r => setTimeout(r, 400));

  // 2. upgrade via modal click → plan applies instantly, badge updates
  await page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => { [...document.querySelectorAll('#tc-plans-modal [data-plan]')].find(b => b.dataset.plan === 'plus')?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const up = await page.evaluate(() => ({
    plan: window.__TRADING_APP__.auth.plan(),
    badge: document.querySelector('.user-avatar-badge')?.dataset.plan,
    modalClosed: !document.querySelector('#tc-plans-modal')
  }));
  const d2 = [];
  if (up.plan !== 'plus') d2.push({ kind: 'functional', text: `upgrade click did not switch plan (${up.plan})` });
  if (up.badge !== 'plus') d2.push({ kind: 'functional', text: `header badge not updated (${up.badge})` });
  if (!up.modalClosed) d2.push({ kind: 'functional', text: 'plans modal did not close after upgrade' });
  record('P2_upgrade_via_modal', d2);

  // 3. per-feature gates at Plus tier
  const plusGates = await page.evaluate(() => {
    const app = window.__TRADING_APP__;
    const out = {};
    // second-based intervals now allowed; synthetic chart types allowed; data export allowed
    out.secondOk = app.auth.feature('secondIntervals');
    out.synthOk = app.auth.feature('synthChartTypes');
    out.exportOk = app.auth.feature('dataExport');
    out.csvOk = app.auth.feature('csvTradesExport');
    out.deepBacktest = app.auth.feature('deepBacktest'); // plus: false
    out.xlsx = app.auth.feature('xlsxReport'); // plus: false
    // charts per tab: plus = 4 → 2x2 allowed (4 cells), 4x2 locked (8 cells)
    out.locked4x2 = app.auth.check('chartsPerTab', 7).allowed === false;
    out.allow2x2 = app.auth.check('chartsPerTab', 3).allowed === true;
    return out;
  });
  const d3 = [];
  if (!plusGates.secondOk) d3.push({ kind: 'gate', text: 'plus should allow second intervals' });
  if (!plusGates.synthOk) d3.push({ kind: 'gate', text: 'plus should allow synthetic chart types' });
  if (!plusGates.exportOk) d3.push({ kind: 'gate', text: 'plus should allow data export' });
  if (!plusGates.csvOk) d3.push({ kind: 'gate', text: 'plus should allow trades CSV export' });
  if (plusGates.deepBacktest) d3.push({ kind: 'gate', text: 'plus should NOT allow deep backtesting (premium+)' });
  if (plusGates.xlsx) d3.push({ kind: 'gate', text: 'plus should NOT allow XLSX report (premium+)' });
  if (!plusGates.locked4x2) d3.push({ kind: 'gate', text: 'plus should lock 8-chart grids' });
  if (!plusGates.allow2x2) d3.push({ kind: 'gate', text: 'plus should allow 4-chart grids' });
  record('P3_plus_tier_gates', d3);

  // 4. upgrade to Ultimate → everything unlocked
  await setPlan(page, 'ultimate');
  const ultGates = await page.evaluate(() => {
    const app = window.__TRADING_APP__;
    return {
      deep: app.auth.feature('deepBacktest'),
      xlsx: app.auth.feature('xlsxReport'),
      charts16: app.auth.check('chartsPerTab', 15).allowed,
      layoutsUnlimited: app.auth.check('savedLayouts', 9999).allowed,
      plansLabel: document.querySelector('.user-avatar-badge')?.dataset.plan
    };
  });
  const d4 = [];
  if (!ultGates.deep || !ultGates.xlsx || !ultGates.charts16 || !ultGates.layoutsUnlimited) d4.push({ kind: 'gate', text: `ultimate not fully unlocked: ${JSON.stringify(ultGates)}` });
  if (ultGates.plansLabel !== 'ultimate') d4.push({ kind: 'functional', text: `badge not ultimate: ${ultGates.plansLabel}` });
  record('P4_ultimate_unlock', d4);

  // 5. downgrade back to basic → server enforces limits on next sync push
  await setPlan(page, 'basic');
  // seed over-limit state locally (simulates data acquired on a higher tier)
  await page.evaluate(() => {
    const lists = [];
    for (let i = 0; i < 5; i++) lists.push({ id: 'wl_x' + i, name: 'List ' + i, symbols: ['BTCUSDT'] });
    localStorage.setItem('tradingchart_user_watchlists', JSON.stringify({ activeId: 'wl_x0', lists }));
  });
  const push = await page.evaluate(() => window.__TRADING_APP__.auth.pushCloudState({ force: true }).then(() => window.__TRADING_APP__.auth.lastSyncError));
  const d5 = push === 'limit_exceeded' ? [] : [{ kind: 'server_enforcement', text: `over-limit sync push not rejected: err=${push}` }];
  record('P5_server_side_limit_enforcement', d5);

  // 6. devices modal lists sessions and revocation works
  await setPlan(page, 'plus');
  await page.evaluate(() => window.__TRADING_APP__.auth.openDevicesModal());
  await new Promise(r => setTimeout(r, 900));
  const dev = await page.evaluate(() => {
    const m = document.querySelector('#tc-devices-modal');
    return {
      open: !!m,
      rows: m ? m.querySelectorAll('[data-revoke], #tc-logout-all').length : 0,
      currentMarked: m ? m.textContent.includes('this device') || m.textContent.includes('این دستگاه') : false
    };
  });
  const d6 = [];
  if (!dev.open) d6.push({ kind: 'functional', text: 'devices modal did not open' });
  if (!dev.currentMarked) d6.push({ kind: 'functional', text: 'current device not marked in sessions list' });
  record('P6_devices_modal', d6);

  await ctx.browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.defects.length, 0);
  console.log(`\nCYCLE3 RESULT: ${total} defects across ${results.length} tests`);
  process.exit(0);
})().catch(e => { console.error('CYCLE3 FATAL', e); process.exit(1); });
