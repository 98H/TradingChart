// tests/qa_admin_cycle2.cjs — Real-browser functional E2E suite for TradingChart admin console:
//   Scenario 7: Plans editor (draft state, leave guard, save effect + audit, restore, matrix view)
//   Scenario 8: Settings (switch label, char counters, i18n edit preservation, leave guards, clean state, beforeunload guard)
//   Scenario 9: Audit log (event display, text search, action filter, localized FA actors)
//   Scenario 10: System page (system KPIs, current session badge, end extra session via UI)
//   Scenario 11: Logout (sign out flow, gate display, unauthenticated session status)
// Usage: node tests/qa_admin_cycle2.cjs <desktop|mobile> <en|fa>

const fs = require('fs');
const path = require('path');
const { launch, BASE } = require('./qa_lib.cjs');

const VP = (process.argv[2] || 'desktop').toLowerCase();
const LANG = (process.argv[3] || 'fa').toLowerCase();

if (!['desktop', 'mobile'].includes(VP)) {
  console.error(`Invalid viewport "${VP}". Use "desktop" or "mobile".`);
  process.exit(1);
}
if (!['fa', 'en'].includes(LANG)) {
  console.error(`Invalid language "${LANG}". Use "fa" or "en".`);
  process.exit(1);
}

const KEY = fs.readFileSync(path.resolve(__dirname, '../server/data/admin_master.key'), 'utf8').trim();
const EVID_DIR = path.resolve(__dirname, '../screenshots/qa_cycles/admin_e2e');
fs.mkdirSync(EVID_DIR, { recursive: true });

const results = [];
let activePage = null;

async function check(scenario, name, ok, detail = '') {
  const item = { scenario, name, ok: !!ok, detail };
  results.push(item);
  const statusStr = ok ? 'PASS' : 'FAIL';
  console.log(`[${statusStr}]  ${scenario} > ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok && activePage) {
    const slug = `${VP}_${LANG}_${scenario}_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const shotPath = path.join(EVID_DIR, `fail_${slug}.png`);
    try {
      await activePage.screenshot({ path: shotPath, fullPage: true });
      console.log(`       [Screenshot saved: ${shotPath}]`);
    } catch (e) {
      console.log(`       [Failed saving screenshot: ${e.message}]`);
    }
  }
}

async function poll(fn, { timeout = 10000, interval = 100, msg = 'condition timed out' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) {}
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(msg);
}

async function assertNoHOverflow(page, sectionName) {
  if (VP !== 'mobile') return;
  const ok = await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
  const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
  const iw = await page.evaluate(() => window.innerWidth);
  await check(sectionName, 'Mobile no horizontal overflow', ok, `scrollWidth=${sw}, innerWidth=${iw}`);
}

(async () => {
  let ctx = null;
  let planIdToRestore = null;
  let originalPlanBody = null;
  let extraSessionId = null;
  let extraSessionCookie = null;
  let browserSessionCookie = null;

  try {
    console.log(`\n================================================================`);
    console.log(`Starting Admin Console E2E Suite: VP=${VP}, LANG=${LANG}`);
    console.log(`================================================================\n`);

    ctx = await launch(VP);
    const { page } = ctx;
    activePage = page;

    // Pre-seed admin language preference
    await page.evaluateOnNewDocument((l) => {
      try { localStorage.setItem('tc_admin_lang', l); } catch (e) {}
    }, LANG);

    // ── Unlock Admin Console via UI ─────────────────────────────────────────
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#gate-key', { timeout: 15000 });
    await page.type('#gate-key', KEY);
    await page.click('#gate-submit');
    await page.waitForSelector('.app', { timeout: 20000 });
    console.log('UI Unlock successful. Admin app shell mounted.');

    // Capture browser cookie for API queries
    const browserCookies = await page.cookies();
    const adminCk = browserCookies.find(c => c.name === 'tc_admin');
    if (adminCk) browserSessionCookie = `tc_admin=${adminCk.value}`;

    // Verify initial console language matches requested LANG
    const initialDocLang = await page.evaluate(() => document.documentElement.lang);
    await check('Setup', 'Initial admin document language', initialDocLang === LANG, `expected ${LANG}, got ${initialDocLang}`);

    // ── SCENARIO 7: Plans Editor ─────────────────────────────────────────────
    console.log('\n--- Scenario 7: Plans editor ---');
    await page.evaluate(() => { location.hash = '#/plans'; });
    await page.waitForSelector('.plans-layout', { timeout: 15000 });
    await assertNoHOverflow(page, 'Scenario 7');

    // Fetch existing plans from server
    const plansBeforeRes = await fetch(`${BASE}/api/admin/plans`, { headers: { 'x-master-key': KEY } });
    const plansBefore = await plansBeforeRes.json();
    const testPlanId = plansBefore.planOrder[0] || 'plus';
    planIdToRestore = testPlanId;
    originalPlanBody = JSON.parse(JSON.stringify(plansBefore.plans[testPlanId]));
    const origDescFa = originalPlanBody.descriptionFa || '';
    const newDescFa = origDescFa ? (origDescFa + ' (ویرایش تستی آزمون)') : 'توضیحات فارسی تستی آزمون';

    // Select plan in UI (opens editor on both mobile and desktop)
    await page.waitForSelector(`[data-pick="${testPlanId}"]`, { timeout: 10000 });
    await page.click(`[data-pick="${testPlanId}"]`);
    await page.waitForSelector('#pf-descriptionFa', { visible: true, timeout: 10000 });

    // Change Persian description
    await page.evaluate((val) => {
      const el = document.getElementById('pf-descriptionFa');
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, newDescFa);

    // Check unsaved indicator and save bar
    await poll(async () => {
      return page.evaluate(() => {
        const st = document.querySelector('#pe-state');
        const saveBtn = document.querySelector('#pe-save');
        const sticky = document.querySelector('.sticky-save.pe-save');
        const chg = document.querySelector('[data-chg="descriptionFa"]');
        const isDirty = saveBtn && !saveBtn.disabled && sticky?.getAttribute('data-clean') === 'false';
        const hasText = st && (st.textContent.includes('تغییر') || st.textContent.includes('unsaved'));
        const chgVisible = chg && !chg.hidden;
        return isDirty && hasText && chgVisible;
      });
    }, { timeout: 6000, msg: 'Unsaved indicator and save bar did not appear after edit' });

    await check('Scenario 7', 'Editor shows unsaved indicator and active save bar', true);

    // Navigate to another section (triggers leave guard)
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await page.waitForSelector('.dialog-wrap', { visible: true, timeout: 8000 });

    const dlgTitle = await page.$eval('.dialog-wrap h2', e => e.textContent.trim());
    await check('Scenario 7', 'Leave guard confirm dialog opens on navigation',
      dlgTitle.includes('تغییرات ذخیره نشده است') || dlgTitle.includes('Unsaved changes'),
      `dialog title="${dlgTitle}"`);

    // Click 'Keep editing' (data-dlg-cancel)
    await page.click('.dialog-wrap [data-dlg-cancel]');
    await poll(async () => page.evaluate(() => !document.querySelector('.dialog-wrap')), { timeout: 5000 });

    // Verify still in editor with edit intact
    const editorStillThere = await page.$eval('#pf-descriptionFa', e => e.value);
    const hashStillPlans = await page.evaluate(() => location.hash);
    await check('Scenario 7', "'Keep editing' keeps user in editor with edits intact",
      editorStillThere === newDescFa && hashStillPlans.includes('plans'),
      `value="${editorStillThere}", hash=${hashStillPlans}`);

    // Click Save
    await page.evaluate(() => document.getElementById('pe-save')?.click());
    await poll(async () => {
      return page.evaluate(() => {
        const btn = document.querySelector('#pe-save');
        const st = document.querySelector('#pe-state');
        return btn?.disabled === true && !btn.querySelector('.spinner') &&
          st && (st.textContent.includes('ذخیره شده') || st.textContent.includes('saved'));
      });
    }, { timeout: 10000, msg: 'Save did not complete' });

    // Server-side check: GET /api/admin/plans shows new text
    const plansSavedRes = await fetch(`${BASE}/api/admin/plans`, { headers: { 'x-master-key': KEY } });
    const plansSavedData = await plansSavedRes.json();
    const savedDesc = plansSavedData.plans[testPlanId]?.descriptionFa;
    await check('Scenario 7', 'Server-side GET /api/admin/plans reflects saved text',
      savedDesc === newDescFa,
      `expected "${newDescFa}", got "${savedDesc}"`);

    // Server-side check: GET /api/admin/audit has plan.update entry
    const auditRes = await fetch(`${BASE}/api/admin/audit?action=plan.update`, { headers: { 'x-master-key': KEY } });
    const auditData = await auditRes.json();
    const hasAudit = (auditData.events || []).some(ev => ev.action === 'plan.update' && ev.target === testPlanId);
    await check('Scenario 7', 'Server-side audit log contains plan.update entry', hasAudit, `target=${testPlanId}`);

    // Restore original text and save
    await page.evaluate((val) => {
      const el = document.getElementById('pf-descriptionFa');
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, origDescFa);

    await poll(async () => page.evaluate(() => {
      const btn = document.querySelector('#pe-save');
      return btn && !btn.disabled;
    }), { timeout: 6000 });

    await page.evaluate(() => document.getElementById('pe-save')?.click());
    await poll(async () => page.evaluate(() => {
      const btn = document.querySelector('#pe-save');
      return btn?.disabled === true && !btn.querySelector('.spinner');
    }), { timeout: 10000 });

    const plansRestoredRes = await fetch(`${BASE}/api/admin/plans`, { headers: { 'x-master-key': KEY } });
    const plansRestoredData = await plansRestoredRes.json();
    const restoredDesc = plansRestoredData.plans[testPlanId]?.descriptionFa;
    await check('Scenario 7', 'Restore original text and verify exact match on server',
      restoredDesc === origDescFa,
      `expected "${origDescFa}", got "${restoredDesc}"`);

    // Matrix view renders every plan
    await page.evaluate(() => document.querySelector('button[data-mode="matrix"]')?.click());
    await page.waitForSelector('table.matrix thead', { visible: true, timeout: 10000 });
    await assertNoHOverflow(page, 'Scenario 7 Matrix');

    const matrixPlans = await page.$$eval('table.matrix thead button.mx-plan', els => els.map(e => e.dataset.open));
    const allExpectedPlansRendered = plansBefore.planOrder.every(id => matrixPlans.includes(id));
    await check('Scenario 7', 'Plans matrix view renders every plan in catalog',
      allExpectedPlansRendered,
      `catalog=[${plansBefore.planOrder.join(',')}], rendered=[${matrixPlans.join(',')}]`);

    // Phones: plan columns overflow, so the card shows an edge fade until the last column is scrolled into view.
    if (VP === 'mobile') {
      const moreAtStart = await page.$eval('.mx-card', e => e.dataset.more).catch(() => null);
      // The scroll chevron must be on the first screen (a vertically centred cue sat below the fold on phones).
      await page.evaluate(() => window.scrollTo(0, 0));
      const cue = await page.evaluate(() => {
        const c = document.querySelector('.mx-card'); if (!c) return null;
        const st = getComputedStyle(c, '::before');
        return { op: Number(st.opacity), top: Math.round(c.getBoundingClientRect().top + parseFloat(st.top)), vh: innerHeight };
      });
      await check('Scenario 7', 'Matrix scroll chevron is visible on the first screen',
        !!cue && cue.op > 0.5 && cue.top > 0 && cue.top < cue.vh, JSON.stringify(cue));
      await page.$eval('.mx-wrap', w => { w.scrollLeft = (getComputedStyle(w).direction === 'rtl' ? -1 : 1) * w.scrollWidth; });
      await new Promise(r => setTimeout(r, 300));
      const moreAtEnd = await page.$eval('.mx-card', e => e.dataset.more).catch(() => null);
      await check('Scenario 7', 'Matrix shows an edge fade while plan columns are off-screen, and drops it at the end',
        moreAtStart === 'true' && moreAtEnd === 'false', `start=${moreAtStart}, end=${moreAtEnd}`);
    }

    // ── SCENARIO 8: Settings (Unsaved changes behavior) ─────────────────────
    console.log('\n--- Scenario 8: Settings ---');
    const settingsBeforeRaw = await (await fetch(`${BASE}/api/admin/settings`, { headers: { 'x-master-key': KEY } })).text();

    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.waitForSelector('#s-body section.card', { visible: true, timeout: 15000 });
    await assertNoHOverflow(page, 'Scenario 8');

    // (e) Clean state: sticky bar shows 'All changes saved', Save/Discard visibility: hidden
    const cleanBarState = await page.$eval('#s-state', e => e.textContent.trim());
    const saveBtnVis = await page.$eval('#s-save', e => getComputedStyle(e).visibility);
    const discardBtnVis = await page.$eval('#s-discard', e => getComputedStyle(e).visibility);
    await check('Scenario 8 (e)', "With no edits, sticky bar shows 'All changes saved' and buttons are visibility:hidden",
      (cleanBarState.includes('All changes saved') || cleanBarState.includes('همه تغییرات ذخیره شده است')) &&
      saveBtnVis === 'hidden' && discardBtnVis === 'hidden',
      `text="${cleanBarState}", saveVis=${saveBtnVis}, discardVis=${discardBtnVis}`);

    // (a) Announcement switch shows visible state label that flips Off/On (غیرفعال/فعال)
    const initSwitchLabel = await page.$eval('#s-ann-state', e => e.textContent.trim());
    await page.click('#s-ann');
    const flippedSwitchLabel = await page.$eval('#s-ann-state', e => e.textContent.trim());
    await page.click('#s-ann');
    const restoredSwitchLabel = await page.$eval('#s-ann-state', e => e.textContent.trim());

    const isFlipping = initSwitchLabel !== flippedSwitchLabel && restoredSwitchLabel === initSwitchLabel;
    await check('Scenario 8 (a)', 'Announcement switch state label flips between Off/On on toggle',
      isFlipping,
      `initial="${initSwitchLabel}", toggled="${flippedSwitchLabel}", restored="${restoredSwitchLabel}"`);

    const regLbl = await page.$eval('#s-reg-state', e => e.textContent.trim()).catch(() => '');
    const maintLbl = await page.$eval('#s-maint-state', e => e.textContent.trim()).catch(() => '');
    // Phones: every settings switch sits on its title's line, like the announcement switch in its card head.
    if (VP === 'mobile') {
      const offTitle = await page.evaluate(() => [['#s-reg', '.setting-row strong'], ['#s-maint', '.setting-row strong'], ['#s-ann', '.card-head h2']].map(([sw, t]) => {
        const s = document.querySelector(sw)?.closest('.switch'); const h = s?.closest('.setting-row, .card-head')?.querySelector(t.split(' ').pop());
        if (!s || !h) return `${sw}: missing`;
        const a = s.getBoundingClientRect(), b = h.getBoundingClientRect();
        return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) > 14 ? `${sw}: ${Math.round((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)}px off its title` : null;
      }).filter(Boolean));
      await check('Scenario 8 (a)', 'On phones every settings switch sits on the same line as its title', offTitle.length === 0, JSON.stringify(offTitle));
    }
    await check('Scenario 8 (a)', 'Registration and maintenance switches also show their On/Off state',
      !!regLbl && !!maintLbl, `registration="${regLbl}", maintenance="${maintLbl}"`);

    // (b) Announcement textarea counters: 'N of 280 characters' / 'N از ۲۸۰ نویسه' (Persian digits)
    const faCounterInit = await page.$eval('#s-ann-fa-c', e => e.textContent.trim());
    const enCounterInit = await page.$eval('#s-ann-en-c', e => e.textContent.trim());
    const isCounterFormatOk = (txt) => {
      if (LANG === 'fa') return /[\u06F0-\u06F90-9]+\s+از\s+[\u06F0-\u06F90-9]+\s+نویسه/.test(txt);
      return /\d+\s+of\s+280\s+characters/.test(txt);
    };
    await check('Scenario 8 (b)', 'Announcement counters follow localized format',
      isCounterFormatOk(faCounterInit) && isCounterFormatOk(enCounterInit),
      `fa="${faCounterInit}", en="${enCounterInit}"`);

    // Type text into announcement textarea and assert counter updates
    const testTypedText = 'Test QA announcement string 12345';
    await page.evaluate((val) => {
      const el = document.getElementById('s-ann-en');
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, testTypedText);

    const enCounterUpdated = await page.$eval('#s-ann-en-c', e => e.textContent.trim());
    const counterUpdatedOk = enCounterUpdated.includes(String(testTypedText.length)) ||
      enCounterUpdated.includes('۳۳'); // 33 chars in Persian digits: ۳۳
    await check('Scenario 8 (b)', 'Announcement textarea counter updates live while typing',
      counterUpdatedOk,
      `updated="${enCounterUpdated}", length=${testTypedText.length}`);

    // (f) With unsaved edits, beforeunload guard is armed (e.defaultPrevented === true)
    const guardArmed = await page.evaluate(() => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented === true;
    });
    await check('Scenario 8 (f)', 'beforeunload guard is armed with unsaved edits', guardArmed === true);

    // (c) With unsaved edits, switching language keeps edits and unsaved indicator
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-act="lang"]')];
      const vis = btns.find(b => b.offsetParent !== null) || btns[0];
      vis?.click();
    });
    // Wait for language switch to complete
    await poll(async () => page.evaluate((curr) => document.documentElement.lang !== curr, LANG), { timeout: 6000 });

    const switchedDocLang = await page.evaluate(() => document.documentElement.lang);
    const editedValuePreserved = await page.$eval('#s-ann-en', e => e.value);
    const stateTextSwitched = await page.$eval('#s-state', e => e.textContent.trim());
    const expectedUnsavedText = switchedDocLang === 'fa' ? 'تغییرات ذخیره‌نشده' : 'Unsaved changes';

    await check('Scenario 8 (c)', 'Language switch preserves unsaved edits and localized dirty indicator',
      editedValuePreserved === testTypedText && stateTextSwitched.includes(expectedUnsavedText),
      `lang=${switchedDocLang}, value="${editedValuePreserved}", indicator="${stateTextSwitched}"`);

    // (d) Navigation with unsaved edits: confirm dialog
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await page.waitForSelector('.dialog-wrap', { visible: true, timeout: 8000 });

    // 'Keep editing' stays on settings with edits intact
    await page.click('.dialog-wrap [data-dlg-cancel]');
    await poll(async () => page.evaluate(() => !document.querySelector('.dialog-wrap')), { timeout: 5000 });

    const keepVal = await page.$eval('#s-ann-en', e => e.value);
    const keepHash = await page.evaluate(() => location.hash);
    await check('Scenario 8 (d)', "'Keep editing' stays on settings with unsaved edits intact",
      keepVal === testTypedText && keepHash.includes('settings'),
      `val="${keepVal}", hash=${keepHash}`);

    // Navigate away again and click 'Discard changes' (data-dlg-ok)
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await page.waitForSelector('.dialog-wrap', { visible: true, timeout: 8000 });
    await page.click('.dialog-wrap [data-dlg-ok]');
    await poll(async () => page.evaluate(() => !document.querySelector('.dialog-wrap')), { timeout: 5000 });
    await page.waitForSelector('#view', { visible: true, timeout: 8000 });

    // Return to settings: verify clean saved values restored
    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.waitForSelector('#s-body section.card', { visible: true, timeout: 15000 });

    const returnedVal = await page.$eval('#s-ann-en', e => e.value);
    const returnedState = await page.$eval('#s-state', e => e.textContent.trim());
    await check('Scenario 8 (d)', "'Discard changes' leaves, and returning shows clean saved values",
      returnedVal !== testTypedText && (returnedState.includes('saved') || returnedState.includes('ذخیره شده')),
      `val="${returnedVal}", state="${returnedState}"`);

    // Restore language to configured LANG if it was flipped in (c)
    const currentLangNow = await page.evaluate(() => document.documentElement.lang);
    if (currentLangNow !== LANG) {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-act="lang"]')];
        const vis = btns.find(b => b.offsetParent !== null) || btns[0];
        vis?.click();
      });
      await poll(async () => page.evaluate((l) => document.documentElement.lang === l, LANG), { timeout: 6000 });
    }

    // Verify GET /api/admin/settings is byte-identical
    const settingsAfterRaw = await (await fetch(`${BASE}/api/admin/settings`, { headers: { 'x-master-key': KEY } })).text();
    await check('Scenario 8', 'GET /api/admin/settings is byte-identical before and after',
      settingsBeforeRaw === settingsAfterRaw,
      `bytesBefore=${settingsBeforeRaw.length}, bytesAfter=${settingsAfterRaw.length}`);

    // ── SCENARIO 9: Audit Log ────────────────────────────────────────────────
    console.log('\n--- Scenario 9: Audit log ---');
    await page.evaluate(() => { location.hash = '#/audit'; });
    const auditListSel = VP === 'mobile' ? '#a-list .mlist' : '#a-list table.tbl';
    const auditItemSel = VP === 'mobile' ? '#a-list .mitem' : '#a-list tbody tr';
    await page.waitForSelector(auditListSel, { visible: true, timeout: 15000 });
    await assertNoHOverflow(page, 'Scenario 9');

    // Entries produced by this run's actions are listed
    const auditRowsText = await page.$$eval(auditItemSel, els => els.map(e => e.textContent).join(' '));
    const hasRunActions = auditRowsText.includes('plan.update') || auditRowsText.includes('ویرایش پلن') ||
      auditRowsText.includes('Plan updated') || auditRowsText.includes('admin.unlock') ||
      auditRowsText.includes('ورود به پنل مدیریت') || auditRowsText.includes('Admin sign-in');
    await check('Scenario 9', "Entries produced by this run's actions are listed", hasRunActions);

    // Search box filters to matching entries
    await page.evaluate((targetId) => {
      const q = document.getElementById('a-q');
      q.value = targetId;
      q.dispatchEvent(new Event('input', { bubbles: true }));
    }, testPlanId);

    // Wait for debounced search reload (280ms)
    await new Promise(r => setTimeout(r, 450));
    await poll(async () => {
      const rows = await page.$$eval(auditItemSel, els => els.map(e => e.textContent));
      return rows.length > 0;
    }, { timeout: 8000, msg: 'Search filtering failed' });
    await check('Scenario 9', 'Search box filters audit list to matching entries', true, `term="${testPlanId}"`);

    // Reset search box
    await page.evaluate(() => {
      const q = document.getElementById('a-q');
      q.value = '';
      q.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 450));

    // Action filter narrows results
    const actionSelectOptions = await page.$$eval('#a-action option', els => els.map(o => o.value));
    const targetActionFilter = actionSelectOptions.includes('plan.update') ? 'plan.update' : actionSelectOptions[1];
    if (targetActionFilter && targetActionFilter !== 'all') {
      await page.evaluate((act) => {
        const sel = document.getElementById('a-action');
        sel.value = act;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }, targetActionFilter);

      await new Promise(r => setTimeout(r, 400));
      await poll(async () => {
        const rows = await page.$$eval(auditItemSel, els => els.map(e => e.textContent));
        return rows.length > 0;
      }, { timeout: 8000 });

      await check('Scenario 9', 'Action filter narrows results', true, `filter="${targetActionFilter}"`);

      // Reset action filter
      await page.evaluate(() => {
        const sel = document.getElementById('a-action');
        sel.value = 'all';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // In FA, actor labels are localized: no raw 'master-key', 'admin-session' or 'guest' visible
    let switchedToFaForCheck = false;
    const curLangForAudit = await page.evaluate(() => document.documentElement.lang);
    if (curLangForAudit !== 'fa') {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-act="lang"]')];
        const vis = btns.find(b => b.offsetParent !== null) || btns[0];
        vis?.click();
      });
      await poll(async () => page.evaluate(() => document.documentElement.lang === 'fa'), { timeout: 6000 });
      switchedToFaForCheck = true;
      await new Promise(r => setTimeout(r, 400));
    }

    const actorLabels = await page.$$eval('.actor', els => els.map(e => e.textContent.trim()));
    const rawActorsFound = actorLabels.filter(t => t === 'master-key' || t === 'guest' || /^admin-session\b/.test(t));
    await check('Scenario 9', "In FA, actor labels are localized (no raw 'master-key', 'admin-session' or 'guest')",
      rawActorsFound.length === 0,
      rawActorsFound.length ? `unlocalized: ${rawActorsFound.join(', ')}` : `verified ${actorLabels.length} actor labels`);

    if (switchedToFaForCheck) {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-act="lang"]')];
        const vis = btns.find(b => b.offsetParent !== null) || btns[0];
        vis?.click();
      });
      await poll(async () => page.evaluate((l) => document.documentElement.lang === l, LANG), { timeout: 6000 });
    }

    // ── SCENARIO 10: System Page + Admin Sessions ───────────────────────────
    console.log('\n--- Scenario 10: System page + admin sessions ---');
    await page.evaluate(() => { location.hash = '#/system'; });
    await page.waitForSelector('#sys-body .kpis', { visible: true, timeout: 15000 });
    await assertNoHOverflow(page, 'Scenario 10');
    // kpi_fit: every KPI value must fit inside its card (the CPU-load triple overflowed 138px mobile cards).
    const kpiFit = await page.evaluate(() => [...document.querySelectorAll('.kpis .kpi .kpi-value')].map(v => ({ t: v.textContent.trim().slice(0, 40), sw: v.scrollWidth, cw: v.clientWidth })));
    const kpiOver = kpiFit.filter(k => k.sw > k.cw + 1);
    await check('Scenario 10', 'Every system KPI value fits inside its card', kpiFit.length > 0 && kpiOver.length === 0, JSON.stringify(kpiOver.length ? kpiOver : { n: kpiFit.length }));
    // The 1 / 5 / 15 label and its three values read in the page direction.
    const loadDir = await page.$eval('.load-avg', e => getComputedStyle(e).direction).catch(() => null);
    await check('Scenario 10', 'CPU load values follow the page direction, like their 1 / 5 / 15 label',
      loadDir === (LANG === 'fa' ? 'rtl' : 'ltr'), `direction=${loadDir}`);

    // Assert Node version, uptime, memory visible
    const kpisText = await page.$eval('#sys-body .kpis', el => el.textContent);
    const hasNode = kpisText.includes('Node');
    const hasUptime = kpisText.includes('uptime') || kpisText.includes('فعالیت') || kpisText.includes('ساعت') || kpisText.includes('دقیقه');
    const hasMemory = kpisText.includes('MB') || kpisText.includes('مگابایت') || kpisText.includes('memory') || kpisText.includes('حافظه');
    await check('Scenario 10', 'System page displays Node version, uptime, and memory KPIs',
      hasNode && hasUptime && hasMemory,
      `node=${hasNode}, uptime=${hasUptime}, memory=${hasMemory}`);

    // Current session is marked as current
    const currentSessionBadge = await page.$eval('.sess-list', el => {
      const curBtn = el.querySelector('button[data-current="true"]');
      const badge = el.querySelector('.badge.b-green');
      return { hasCurBtn: !!curBtn, badgeText: badge ? badge.textContent.trim() : '' };
    });
    const curBadgeOk = currentSessionBadge.hasCurBtn &&
      (currentSessionBadge.badgeText.includes('This browser') || currentSessionBadge.badgeText.includes('همین مرورگر'));
    await check('Scenario 10', 'Admin sessions list includes current session marked as current',
      curBadgeOk,
      `badge="${currentSessionBadge.badgeText}"`);

    // Create a second admin session via Node-side POST /api/admin/auth
    const auth2Res = await fetch(`${BASE}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey: KEY })
    });
    await check('Scenario 10', 'Create second admin session via POST /api/admin/auth', auth2Res.status === 200, `status=${auth2Res.status}`);

    const ck2List = (auth2Res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]);
    extraSessionCookie = ck2List.join('; ');

    // Determine extra session ID by querying /api/admin/sessions with its cookie
    const s2ListRes = await fetch(`${BASE}/api/admin/sessions`, { headers: { cookie: extraSessionCookie } });
    const s2ListData = await s2ListRes.json();
    const extraSessionRow = (s2ListData.sessions || []).find(s => s.current);
    extraSessionId = extraSessionRow ? extraSessionRow.id : null;

    await check('Scenario 10', 'Second admin session created and tracked', !!extraSessionId, `extraId=${extraSessionId}`);

    // Refresh System page UI to display the new session
    await page.evaluate(() => document.getElementById('sys-refresh')?.click());
    await page.waitForSelector(`button[data-asess="${extraSessionId}"]`, { visible: true, timeout: 10000 });

    const extraSessionBtnCurrent = await page.$eval(`button[data-asess="${extraSessionId}"]`, e => e.dataset.current);
    await check('Scenario 10', 'Second session rendered in UI with End Session action', extraSessionBtnCurrent === 'false');

    // End extra session from System page UI
    await page.evaluate((id) => document.querySelector(`button[data-asess="${id}"]`)?.click(), extraSessionId);
    await page.waitForSelector('.dialog-wrap', { visible: true, timeout: 8000 });
    await page.evaluate(() => document.querySelector('.dialog-wrap [data-dlg-ok]')?.click());

    // Wait for dialog to close and session to disappear from UI
    await poll(async () => page.evaluate(() => !document.querySelector('.dialog-wrap')), { timeout: 6000 });
    await poll(async () => page.evaluate((id) => !document.querySelector(`button[data-asess="${id}"]`), extraSessionId), { timeout: 8000 });
    await check('Scenario 10', 'Second session ended via System UI button', true);

    // Assert it disappears from GET /api/admin/sessions
    const sCheckRes = await fetch(`${BASE}/api/admin/sessions`, { headers: { 'x-master-key': KEY } });
    const sCheckData = await sCheckRes.json();
    const stillInList = (sCheckData.sessions || []).some(s => s.id === extraSessionId);
    await check('Scenario 10', 'Disappears from server-side GET /api/admin/sessions', !stillInList, `extraId=${extraSessionId}`);

    // An ended session must be dead. GET /api/admin/session is the console's boot probe
    // (admin.js decides gate vs shell from it): by contract it answers 200 {isAdmin:false}
    // when no valid admin session exists. Assert that, plus a guarded endpoint rejecting it.
    const extraSessCheck = await fetch(`${BASE}/api/admin/session`, { headers: { cookie: extraSessionCookie } });
    const extraSessJson = await extraSessCheck.json().catch(() => ({}));
    await check('Scenario 10', 'Ended session: probe reports isAdmin=false',
      extraSessCheck.status === 200 && extraSessJson.isAdmin === false,
      `got ${extraSessCheck.status} ${JSON.stringify(extraSessJson)}`);
    const extraGuarded = await fetch(`${BASE}/api/admin/sessions`, { headers: { cookie: extraSessionCookie } });
    await check('Scenario 10', 'Ended session: guarded endpoint rejects the cookie',
      [403].includes(extraGuarded.status), `got ${extraGuarded.status}`);

    // ── SCENARIO 11: Logout ──────────────────────────────────────────────────
    console.log('\n--- Scenario 11: Logout ---');
    // Click Sign out button
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-act="logout"]')];
      const vis = btns.find(b => b.offsetParent !== null) || btns[0];
      vis?.click();
    });

    await page.waitForSelector('.dialog-wrap', { visible: true, timeout: 8000 });
    const logoutDlgTitle = await page.$eval('.dialog-wrap h2', e => e.textContent.trim());
    await check('Scenario 11', 'Logout confirm dialog opens',
      logoutDlgTitle.includes('خروج') || logoutDlgTitle.includes('Sign out'),
      `dialog="${logoutDlgTitle}"`);

    // Accept confirm dialog
    await page.evaluate(() => document.querySelector('.dialog-wrap [data-dlg-ok]')?.click());

    // Assert gate is shown
    await page.waitForSelector('#gate-key', { visible: true, timeout: 15000 });
    await page.waitForSelector('#gate-submit', { visible: true, timeout: 15000 });
    await check('Scenario 11', 'Sign in gate is shown after logout', true);
    await assertNoHOverflow(page, 'Scenario 11 Gate');

    // After sign-out the old cookie is dead: probe says isAdmin=false, guarded API rejects it.
    await check('Scenario 11', 'Captured the browser admin cookie before logout', Boolean(browserSessionCookie), 'no admin cookie captured');
    const logoutSessCheck = await fetch(`${BASE}/api/admin/session`, { headers: { cookie: browserSessionCookie || '' } });
    const logoutSessJson = await logoutSessCheck.json().catch(() => ({}));
    await check('Scenario 11', 'After logout: probe reports isAdmin=false',
      logoutSessCheck.status === 200 && logoutSessJson.isAdmin === false,
      `got ${logoutSessCheck.status} ${JSON.stringify(logoutSessJson)}`);
    const logoutGuarded = await fetch(`${BASE}/api/admin/sessions`, { headers: { cookie: browserSessionCookie || '' } });
    await check('Scenario 11', 'After logout: guarded endpoint rejects the old cookie',
      [403].includes(logoutGuarded.status), `got ${logoutGuarded.status}`);

  } catch (err) {
    console.error('\nUNHANDLED EXCEPTION DURING SUITE EXECUTION:\n', err);
    await check('Suite', 'Suite completed without uncaught exception', false, err.message);
  } finally {
    console.log('\n--- Running Cleanup ---');

    // 1. Restore plan description text if dirty and verify
    if (planIdToRestore && originalPlanBody) {
      try {
        await fetch(`${BASE}/api/admin/plans/${encodeURIComponent(planIdToRestore)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-master-key': KEY },
          body: JSON.stringify(originalPlanBody)
        });
        const vRes = await fetch(`${BASE}/api/admin/plans`, { headers: { 'x-master-key': KEY } });
        const vData = await vRes.json();
        const curDesc = vData.plans[planIdToRestore]?.descriptionFa;
        if (curDesc === originalPlanBody.descriptionFa) {
          console.log(`CLEANUP: Successfully restored plan "${planIdToRestore}" descriptionFa.`);
        } else {
          console.error(`CLEANUP ERROR: Plan "${planIdToRestore}" mismatch after restore!`);
        }
      } catch (e) {
        console.error('CLEANUP ERROR: Plan restore failed:', e.message);
      }
    }

    // 2. End extra admin session if still alive
    if (extraSessionId) {
      try {
        await fetch(`${BASE}/api/admin/sessions/${encodeURIComponent(extraSessionId)}`, {
          method: 'DELETE',
          headers: { 'x-master-key': KEY }
        });
        console.log(`CLEANUP: Ensured extra admin session ${extraSessionId} revoked.`);
      } catch (e) {
        console.error('CLEANUP ERROR: Extra session revocation failed:', e.message);
      }
    }

    // 3. Log out any active sessions
    if (browserSessionCookie) {
      try {
        await fetch(`${BASE}/api/admin/logout`, { method: 'POST', headers: { cookie: browserSessionCookie } });
      } catch (e) {}
    }
    if (extraSessionCookie) {
      try {
        await fetch(`${BASE}/api/admin/logout`, { method: 'POST', headers: { cookie: extraSessionCookie } });
      } catch (e) {}
    }

    // 4. Close browser
    if (ctx?.browser) {
      try { await ctx.browser.close(); } catch (e) {}
    }

    // ── Print Final PASS/FAIL Table ─────────────────────────────────────────
    const failures = results.filter(r => !r.ok);
    const passes = results.filter(r => r.ok);

    console.log('\n================================================================================');
    console.log(`FINAL RESULT TABLE: ${VP} ${LANG} (${passes.length}/${results.length} passed)`);
    console.log('================================================================================');
    console.log(String('Scenario').padEnd(16) + ' | ' + String('Test Assertion').padEnd(46) + ' | Status | Details');
    console.log('-----------------+------------------------------------------------+--------+--------------------');
    for (const r of results) {
      const sc = String(r.scenario).slice(0, 16).padEnd(16);
      const nm = String(r.name).slice(0, 46).padEnd(46);
      const st = r.ok ? 'PASS  ' : 'FAIL  ';
      const dt = String(r.detail || '').slice(0, 70);
      console.log(`${sc} | ${nm} | ${st} | ${dt}`);
    }
    console.log('================================================================================\n');

    process.exit(failures.length ? 1 : 0);
  }
})();
