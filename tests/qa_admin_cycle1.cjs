// tests/qa_admin_cycle1.cjs — Real-browser functional E2E suite for TradingChart admin console.
// Scenarios:
//   1. Gate (wrong key rejection, right key unlock, session verify, exactly 2 unlock attempts)
//   2. Navigation (sections render, sidebar on desktop, bottom-nav on mobile, mobile overflow check)
//   3. Dashboard (KPI cards, scope control real vs test vs all, match GET /api/admin/overview)
//   4. Users list (register 3 fresh test users, filter type/plan/status, search by runId, sorting, CSV export)
//   5. User drawer (tabs, plan change, notes, send reset, revoke sessions, suspend/unsuspend, delete user)
//   6. Bulk actions (select-all header toggle, select 2 users, bulk verify email)
//
// Usage: node tests/qa_admin_cycle1.cjs <desktop|mobile> <en|fa>

const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS, awaitRegisterWindow } = require('./qa_lib.cjs');

const VP = process.argv[2] || 'desktop';
const LANG = process.argv[3] || 'en';

if (!['desktop', 'mobile'].includes(VP)) {
  console.error(`Invalid viewport "${VP}". Must be "desktop" or "mobile".`);
  process.exit(1);
}
if (!['en', 'fa'].includes(LANG)) {
  console.error(`Invalid language "${LANG}". Must be "en" or "fa".`);
  process.exit(1);
}

const isMobile = VP === 'mobile';
const isFa = LANG === 'fa';
const KEY_FILE = path.resolve(__dirname, '../server/data/admin_master.key');
const OUTBOX_FILE = path.resolve(__dirname, '../server/data/accounts/outbox.json');
const EVID_DIR = path.resolve(__dirname, '../screenshots/qa_cycles/admin_e2e');
fs.mkdirSync(EVID_DIR, { recursive: true });

const MASTER_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
const RUN_ID = Math.random().toString(36).slice(2, 8);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function recordResult(name, status, defects = [], info = '') {
  results.push({ name, viewport: VP, lang: LANG, status, defects, info, ts: new Date().toISOString() });
  const tag = status === 'pass' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`[${tag}] ${name}` + (defects.length ? ` (${defects.length} defect(s))` : '') + (info ? ` — ${info}` : ''));
  for (const d of defects) {
    console.log(`    ↳ [${d.kind}] ${d.text}`);
  }
}

function printSummaryTable() {
  console.log('\n' + '═'.repeat(78));
  console.log(`QA Admin Cycle 1 Results — Viewport: ${VP}, Language: ${LANG}, RunId: ${RUN_ID}`);
  console.log('─'.repeat(78));
  console.log(`${'Test Name'.padEnd(25)} │ ${'Status'.padEnd(8)} │ Defects`);
  console.log('─'.repeat(78));
  for (const r of results) {
    const s = r.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const dCount = r.defects.length ? `${r.defects.length} issue(s)` : '-';
    console.log(`${r.name.padEnd(25)} │ ${s.padEnd(17)} │ ${dCount}`);
    for (const d of r.defects) {
      console.log(`  ↳ ${d.text.slice(0, 110)}`);
    }
  }
  console.log('═'.repeat(78));
  const fails = results.filter(r => r.status !== 'pass').length;
  console.log(`Total: ${results.length} | Passed: ${results.length - fails} | Failed: ${fails}\n`);
}

// Real click on a visible target, centred first so it never sits under the fixed mobile bottom nav.
async function tap(page, sel, opts = {}) {
  const h = await page.waitForSelector(sel, { visible: true, timeout: opts.timeout || 8000 });
  // Instant scroll (never smooth), then wait until the target stops moving before measuring/clicking.
  await h.evaluate(async (el) => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    let last = '';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = el.getBoundingClientRect();
      const k = `${Math.round(b.top)},${Math.round(b.left)},${Math.round(scrollY)}`;
      if (k === last) break;
      last = k;
    }
  });
  const cover = await h.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top || el === top || el.contains(top)) return null;
    const d = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
    const host = top.closest('.toasts, .bottom-nav, .sticky-save, #u-bulk, .drawer, .dialog-wrap, .topbar');
    return `${d(top)}${host && host !== top ? ' in ' + d(host) : ''} at y=${Math.round(r.top + r.height / 2)}`;
  });
  if (cover) throw new Error(`tap ${sel}: covered by ${cover}`);
  // Record what actually receives each click, for failure diagnostics.
  await page.evaluate(() => {
    if (window.__tapLog) return;
    window.__tapLog = [];
    document.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? (e.target.closest('button, a, input, label, [data-user], [data-bulk]') || e.target) : null;
      window.__tapLog.push(t ? t.outerHTML.replace(/\s+/g, ' ').slice(0, 100) : String(e.target));
    }, true);
  });
  await h.click();
}

// Persistent controls (header, drawer head/foot, bottom nav, save/bulk bars) covered by a visible toast.
async function controlsUnderToast(page) {
  return page.evaluate(() => {
    if (!document.querySelector('.toasts .toast')) return [];
    const hits = [];
    for (const b of document.querySelectorAll('.topbar button, .drawer-head button, .drawer-foot button, .bottom-nav button, .sticky-save button, #u-bulk button, #u-bulk select')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight) continue;
      const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const under = stack.find(n => !n.closest('.toasts'));
      if (!under || !(b === under || b.contains(under))) continue; // already hidden (e.g. topbar under an open drawer)
      if (stack[0] && stack[0].closest('.toasts')) hits.push((b.getAttribute('aria-label') || b.textContent || b.className).trim().slice(0, 30));
    }
    return hits;
  });
}

async function confirmCurrentDialog(page) {
  try {
    await page.waitForSelector('.dialog-wrap [data-dlg-ok]', { visible: true, timeout: 8000 });
  } catch (e) {
    const diag = await page.evaluate(() => ({
      dialogs: document.querySelectorAll('.dialog-wrap').length,
      lastClicks: (window.__tapLog || []).slice(-3),
      toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent.trim().slice(0, 80)),
      scrollY: Math.round(scrollY),
    }));
    throw new Error(`confirm dialog did not open: ${JSON.stringify(diag)}`);
  }
  await tap(page, '.dialog-wrap [data-dlg-ok]');
  await page.waitForFunction(() => !document.querySelector('.dialog-wrap'), { timeout: 8000 });
}

(async () => {
  let ctx = null;
  const createdUsers = [];

  try {
    ctx = await launch(VP);
    const { page, logs } = ctx;

    // Force language into localStorage before page mounts
    await page.evaluateOnNewDocument((lang) => {
      try {
        localStorage.setItem('tc_admin_lang', lang);
        localStorage.setItem('tradingchart_user_settings', JSON.stringify({ language: lang }));
      } catch (e) {}
    }, LANG);

    // Filter console logs per test
    let logCursor = 0;
    function getNewErrors(ignoreRe) {
      const slice = logs.slice(logCursor).filter(l => ['error', 'pageerror', 'requestfailed'].includes(l.type));
      logCursor = logs.length;
      if (!ignoreRe) return slice;
      return slice.filter(l => !ignoreRe.test(String(l.text || '')));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 1: Gate
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '01_gate';
      const defects = [];
      try {
        await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForSelector('#gate-key', { timeout: 15000 });

        // Ensure language is set correctly at gate
        const curLang = await page.evaluate(() => document.documentElement.lang);
        if (curLang !== LANG) {
          await tap(page, '#gate-lang');
          await page.waitForFunction((l) => document.documentElement.lang === l, { timeout: 5000 }, LANG);
        }

        // Attempt 1: Wrong key
        await page.type('#gate-key', 'deliberate_wrong_admin_master_key_attempt');
        await tap(page, '#gate-submit');

        // Wait for localized error
        await page.waitForFunction(() => {
          const el = document.querySelector('#gate-err');
          return el && !el.hidden && el.textContent.trim().length > 0;
        }, { timeout: 8000 });

        const errText = await page.evaluate(() => document.querySelector('#gate-err')?.textContent?.trim() || '');
        const expectedErr = isFa ? 'کلید مدیریت نادرست است.' : 'The admin key is incorrect.';
        if (!errText.includes(expectedErr)) {
          defects.push({ kind: 'gate_error_text', text: `Expected localized error "${expectedErr}", got "${errText}"` });
        }

        // Fresh API check: session must NOT be granted
        const sessWrong = await page.evaluate(async () => {
          const r = await fetch('/api/admin/session');
          return await r.json();
        });
        if (sessWrong.isAdmin !== false) {
          defects.push({ kind: 'gate_unauthorized_session', text: `Session granted after wrong key: ${JSON.stringify(sessWrong)}` });
        }

        // Attempt 2: Right key
        await page.evaluate(() => {
          const inp = document.querySelector('#gate-key');
          if (inp) inp.value = '';
        });
        await page.type('#gate-key', MASTER_KEY);
        await tap(page, '#gate-submit');

        // Wait for console shell to load
        await page.waitForSelector('#view', { timeout: 15000 });
        await page.waitForFunction(() => !document.querySelector('#gate-form'), { timeout: 8000 });

        // Fresh API check: session must be granted
        const sessRight = await page.evaluate(async () => {
          const r = await fetch('/api/admin/session');
          return await r.json();
        });
        if (!sessRight.ok || !sessRight.isAdmin) {
          defects.push({ kind: 'gate_authorized_session', text: `Session not active after correct key: ${JSON.stringify(sessRight)}` });
        }

        // Check GET /api/admin/audit for both attempts
        const auditData = await page.evaluate(async () => {
          const r = await fetch('/api/admin/audit?pageSize=20');
          return await r.json();
        });
        const events = auditData.events || [];
        const failedUnlock = events.find(e => e.action === 'admin.unlock' && e.ok === false);
        const successUnlock = events.find(e => e.action === 'admin.unlock' && e.ok === true);
        if (!failedUnlock) {
          defects.push({ kind: 'audit_missing_failed_unlock', text: 'Audit log missing failed admin.unlock entry' });
        }
        if (!successUnlock) {
          defects.push({ kind: 'audit_missing_success_unlock', text: 'Audit log missing successful admin.unlock entry' });
        }

        const newErrors = getNewErrors(/401|invalid_master_key|status of 401/);
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 2: Navigation
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '02_navigation';
      const defects = [];
      const sections = ['dashboard', 'users', 'plans', 'audit', 'settings', 'system'];
      const sectionTitles = {
        dashboard: isFa ? 'داشبورد' : 'Dashboard',
        users: isFa ? 'کاربران' : 'Users',
        plans: isFa ? 'پلن‌ها' : 'Plans',
        audit: isFa ? 'گزارش رویدادها' : 'Audit log',
        settings: isFa ? 'تنظیمات' : 'Settings',
        system: isFa ? 'سلامت سامانه' : 'System health'
      };

      try {
        for (const sec of sections) {
          if (isMobile) {
            const btnSelector = `.bottom-nav button[data-nav="${sec}"]`;
            await page.waitForSelector(btnSelector, { visible: true, timeout: 8000 });
            await tap(page, btnSelector);
          } else {
            const linkSelector = `.sidebar nav.nav a[data-nav="${sec}"]`;
            await page.waitForSelector(linkSelector, { visible: true, timeout: 8000 });
            await tap(page, linkSelector);
          }

          // Wait for hash to update
          await page.waitForFunction((s) => location.hash === '#/' + s, { timeout: 8000 }, sec);

          // Wait for view container to mount
          await page.waitForFunction((s) => {
            const view = document.querySelector('#view');
            if (!view) return false;
            if (s === 'dashboard') return !!view.querySelector('#dash-body');
            if (s === 'users') return !!view.querySelector('#u-list');
            if (s === 'plans') return !!view.querySelector('.plans-layout, #plans-table, .plan-card, .plan-item');
            if (s === 'audit') return !!view.querySelector('#a-list');
            if (s === 'settings') return !!view.querySelector('#s-body');
            if (s === 'system') return !!view.querySelector('.grid, .card');
            return true;
          }, { timeout: 12000 }, sec);

          // Assert document.title and #page-title
          const pageTitle = await page.evaluate(() => document.querySelector('#page-title')?.textContent?.trim() || '');
          const docTitle = await page.title();
          const expectedLabel = sectionTitles[sec];

          if (pageTitle !== expectedLabel) {
            defects.push({ kind: 'nav_page_title', text: `Section "${sec}": expected #page-title "${expectedLabel}", got "${pageTitle}"` });
          }
          if (!docTitle.includes(expectedLabel)) {
            defects.push({ kind: 'nav_doc_title', text: `Section "${sec}": document.title "${docTitle}" does not contain "${expectedLabel}"` });
          }

          // Mobile horizontal overflow check: document.scrollingElement.scrollWidth <= innerWidth + 1
          if (isMobile) {
            const overflowData = await page.evaluate(() => {
              const el = document.scrollingElement || document.documentElement;
              return {
                scrollWidth: el.scrollWidth,
                innerWidth: window.innerWidth,
                overflow: el.scrollWidth > window.innerWidth + 1
              };
            });
            if (overflowData.overflow) {
              defects.push({
                kind: 'mobile_horizontal_overflow',
                text: `Section "${sec}" overflows: scrollWidth ${overflowData.scrollWidth} > innerWidth ${overflowData.innerWidth}`
              });
            }
          }
        }

        const newErrors = getNewErrors();
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 3: Dashboard
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '03_dashboard';
      const defects = [];
      try {
        // Navigate to dashboard
        if (isMobile) {
          await tap(page, '.bottom-nav button[data-nav="dashboard"]');
        } else {
          await tap(page, '.sidebar nav.nav a[data-nav="dashboard"]');
        }
        await page.waitForFunction(() => location.hash === '#/dashboard', { timeout: 8000 });
        await page.waitForSelector('#dash-body .card.kpi', { timeout: 12000 });

        // Helper to normalize numbers in both Persian and English digits
        const normalizeDigits = (str) => {
          return String(str || '')
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[,٬\s$دلار]/g, '');
        };

        // Test "real" scope
        await tap(page, '[data-scope="real"]');
        await page.waitForFunction(() => {
          const btn = document.querySelector('[data-scope="real"]');
          return btn && btn.getAttribute('aria-pressed') === 'true';
        }, { timeout: 6000 });
        await page.waitForFunction(() => !document.querySelector('#dash-body .skeleton'), { timeout: 10000 });

        const realUiValues = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.card.kpi .kpi-value')).map(el => el.textContent.trim());
        });
        if (!realUiValues.length) {
          defects.push({ kind: 'dashboard_no_kpis', text: 'No KPI cards rendered in dashboard' });
        }

        const realApiOverview = await page.evaluate(async () => {
          const r = await fetch('/api/admin/overview?type=real');
          return await r.json();
        });
        const realUsersUi = Number(normalizeDigits(realUiValues[0])) || 0;
        const realUsersApi = realApiOverview.kpi?.users ?? -1;
        if (realUsersUi !== realUsersApi) {
          defects.push({ kind: 'dashboard_real_users_mismatch', text: `Real scope: UI shows ${realUsersUi}, API returns ${realUsersApi}` });
        }

        // Test "test" scope
        await tap(page, '[data-scope="test"]');
        await page.waitForFunction(() => {
          const btn = document.querySelector('[data-scope="test"]');
          return btn && btn.getAttribute('aria-pressed') === 'true';
        }, { timeout: 6000 });
        await page.waitForFunction(() => !document.querySelector('#dash-body .skeleton'), { timeout: 10000 });

        const testUiValues = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.card.kpi .kpi-value')).map(el => el.textContent.trim());
        });
        const testApiOverview = await page.evaluate(async () => {
          const r = await fetch('/api/admin/overview?type=test');
          return await r.json();
        });
        const testUsersUi = Number(normalizeDigits(testUiValues[0])) || 0;
        const testUsersApi = testApiOverview.kpi?.users ?? -1;
        if (testUsersUi !== testUsersApi) {
          defects.push({ kind: 'dashboard_test_users_mismatch', text: `Test scope: UI shows ${testUsersUi}, API returns ${testUsersApi}` });
        }

        // Scope switch must change shown numbers if test accounts exist
        if (testApiOverview.testCount > 0 && realUsersUi === testUsersUi) {
          defects.push({ kind: 'dashboard_scope_unchanged', text: `Scope switch real vs test did not change total users (${realUsersUi})` });
        }

        const newErrors = getNewErrors();
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 4: Users list
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '04_users_list';
      const defects = [];
      try {
        // Step 1: Create 3 fresh test users
        await awaitRegisterWindow();
        for (let i = 1; i <= 3; i++) {
          const email = `adm-e2e-${RUN_ID}-${i}@qa.test`;
          const username = `adme2e_${RUN_ID}_${i}`;
          const password = 'Qa!Password2026';
          let registered = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            const r = await fetch(BASE + '/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, username, password })
            });
            if (r.status === 200) {
              const d = await r.json();
              createdUsers.push({ ...d.user, password });
              registered = true;
              break;
            }
            if (r.status === 429) {
              const retryAfter = parseInt(r.headers.get('retry-after') || '36', 10);
              await sleep((retryAfter || 36) * 1000);
              continue;
            }
            throw new Error(`Registration failed (${r.status}): ${await r.text()}`);
          }
          if (!registered) throw new Error(`Could not register ${email} after retries`);
        }

        // Navigate to users section
        if (isMobile) {
          await tap(page, '.bottom-nav button[data-nav="users"]');
        } else {
          await tap(page, '.sidebar nav.nav a[data-nav="users"]');
        }
        await page.waitForFunction(() => location.hash === '#/users', { timeout: 8000 });
        await page.waitForSelector('#u-type', { visible: true, timeout: 12000 });

        // Step 2: Switch type filter to "all" to include test accounts
        await page.select('#u-type', 'all');
        await page.waitForFunction(() => !document.querySelector('#u-list[aria-busy="true"]'), { timeout: 8000 });

        // Step 3: Search by runId
        await page.type('#u-q', RUN_ID);
        await page.waitForFunction((rid) => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          return rows.length === 3;
        }, { timeout: 12000 }, RUN_ID);

        const foundCount = await page.evaluate(() => {
          return document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr').length;
        });
        if (foundCount !== 3) {
          defects.push({ kind: 'users_search_count', text: `Search by runId found ${foundCount} users (expected 3)` });
        }

        // Fresh API read check for search
        const searchApi = await page.evaluate(async (rid) => {
          const r = await fetch(`/api/admin/users?type=all&q=${encodeURIComponent(rid)}`);
          return await r.json();
        }, RUN_ID);
        if (searchApi.total !== 3) {
          defects.push({ kind: 'users_search_api_mismatch', text: `API search returned total ${searchApi.total} (expected 3)` });
        }

        // Step 4: Plan and status filters
        // Status: suspended (should return 0)
        await page.select('#u-status', 'suspended');
        await page.waitForFunction(() => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          const empty = document.querySelector('#u-list .empty');
          return rows.length === 0 && !!empty;
        }, { timeout: 8000 });
        const suspApi = await page.evaluate(async (rid) => {
          const r = await fetch(`/api/admin/users?type=all&status=suspended&q=${encodeURIComponent(rid)}`);
          return await r.json();
        }, RUN_ID);
        if (suspApi.total !== 0) {
          defects.push({ kind: 'users_filter_status_api', text: `Status=suspended API returned ${suspApi.total} (expected 0)` });
        }

        // Reset status filter back to 'all'
        await page.select('#u-status', 'all');
        await page.waitForFunction((rid) => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          return rows.length === 3;
        }, { timeout: 8000 }, RUN_ID);

        // Plan: premium (should return 0)
        await page.select('#u-plan', 'premium');
        await page.waitForFunction(() => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          return rows.length === 0;
        }, { timeout: 8000 });
        const planApi = await page.evaluate(async (rid) => {
          const r = await fetch(`/api/admin/users?type=all&plan=premium&q=${encodeURIComponent(rid)}`);
          return await r.json();
        }, RUN_ID);
        if (planApi.total !== 0) {
          defects.push({ kind: 'users_filter_plan_api', text: `Plan=premium API returned ${planApi.total} (expected 0)` });
        }

        // Reset plan filter back to 'all'
        await page.select('#u-plan', 'all');
        await page.waitForFunction((rid) => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          return rows.length === 3;
        }, { timeout: 8000 }, RUN_ID);

        // Step 5: Sorting changes order
        // Trigger sort on username
        await page.evaluate(() => document.querySelector('[data-sort="username"]')?.click());
        await page.waitForFunction(() => !document.querySelector('#u-list[aria-busy="true"]'), { timeout: 8000 });
        const orderAsc = await page.evaluate(() => {
          const els = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem strong' : '#u-list tbody tr strong');
          return Array.from(els).map(e => e.textContent.trim());
        });

        await page.evaluate(() => document.querySelector('[data-sort="username"]')?.click());
        await page.waitForFunction(() => !document.querySelector('#u-list[aria-busy="true"]'), { timeout: 8000 });
        const orderDesc = await page.evaluate(() => {
          const els = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem strong' : '#u-list tbody tr strong');
          return Array.from(els).map(e => e.textContent.trim());
        });

        if (JSON.stringify(orderAsc) === JSON.stringify(orderDesc)) {
          defects.push({ kind: 'users_sort_unchanged', text: `Sort toggle on username did not change order: ${JSON.stringify(orderAsc)}` });
        }

        // Step 6: CSV export
        const csvContent = await page.evaluate(async (rid) => {
          const r = await fetch(`/api/admin/users.csv?type=all&q=${encodeURIComponent(rid)}`);
          return await r.text();
        }, RUN_ID);

        if (!csvContent.includes('id,username,email')) {
          defects.push({ kind: 'csv_missing_header', text: 'CSV export missing expected header row' });
        }
        for (const u of createdUsers) {
          if (!csvContent.includes(u.email)) {
            defects.push({ kind: 'csv_missing_email', text: `CSV export missing email: ${u.email}` });
          }
        }

        // Check audit log for users.export
        const auditData = await page.evaluate(async () => {
          const r = await fetch('/api/admin/audit?action=users.export&pageSize=5');
          return await r.json();
        });
        const exportAudit = (auditData.events || []).find(e => e.action === 'users.export');
        if (!exportAudit) {
          defects.push({ kind: 'audit_missing_csv_export', text: 'Audit log missing users.export entry' });
        }

        const newErrors = getNewErrors();
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 5: User drawer
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '05_user_drawer';
      const defects = [];
      const u1 = createdUsers[0];
      let u1SessionCookie = '';

      try {
        // Step 1: Open drawer for user 1
        const userBtnSel = isMobile ? `.mlist button[data-user="${u1.id}"]` : `.tbl button[data-user="${u1.id}"]`;
        await page.waitForSelector(userBtnSel, { visible: true, timeout: 8000 });
        await tap(page, userBtnSel);
        await page.waitForSelector('.drawer #dr-title', { visible: true, timeout: 8000 });

        // Check tabs render
        const tabs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.drawer button.tab')).map(b => b.dataset.tab);
        });
        if (!tabs.includes('overview') || !tabs.includes('sessions') || !tabs.includes('activity')) {
          defects.push({ kind: 'drawer_tabs_missing', text: `Drawer tabs expected [overview, sessions, activity], got [${tabs.join(', ')}]` });
        }

        // Change plan to 'premium'
        await page.select('#dr-plan', 'premium');
        await confirmCurrentDialog(page);

        // Fresh API check: plan updated
        const u1PlanApi = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`);
          return await r.json();
        }, u1.id);
        if (u1PlanApi.user?.plan !== 'premium') {
          defects.push({ kind: 'user_plan_change_failed', text: `User plan expected 'premium', API returned '${u1PlanApi.user?.plan}'` });
        }
        // Audit log check: user.update
        const auditPlan = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.update&pageSize=10`);
          return await r.json();
        }, u1.id);
        const planAuditEvent = (auditPlan.events || []).find(e => e.target === u1.id && e.meta?.changes?.plan);
        if (!planAuditEvent) {
          defects.push({ kind: 'audit_missing_plan_change', text: 'Audit log missing plan change entry for user 1' });
        }

        // Admin notes save
        const noteText = 'Internal admin audit test note ' + RUN_ID;
        await page.evaluate((val) => {
          const ta = document.querySelector('#dr-notes');
          if (ta) {
            ta.value = val;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, noteText);
        await page.waitForFunction(() => !document.querySelector('#dr-notes-save').disabled, { timeout: 5000 });
        await tap(page, '#dr-notes-save');
        await page.waitForSelector('.toasts .toast', { visible: true, timeout: 6000 }).catch(() => {});
        {
          const hid = await controlsUnderToast(page);
          if (hid.length) defects.push({ kind: 'toast_covers_controls', text: `after saving notes: toast covers ${hid.join(', ')}` });
        }
        await page.screenshot({ path: path.join(EVID_DIR, `toast_drawer_${VP}_${LANG}.png`) }).catch(() => {});
        await page.waitForFunction(() => document.querySelector('#dr-notes-save').disabled, { timeout: 8000 });

        const u1NotesApi = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`);
          return await r.json();
        }, u1.id);
        if (u1NotesApi.user?.notes !== noteText) {
          defects.push({ kind: 'user_notes_save_failed', text: `User notes API expected "${noteText}", got "${u1NotesApi.user?.notes}"` });
        }
        const auditNotes = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.update&pageSize=10`);
          return await r.json();
        }, u1.id);
        const notesAuditEvent = (auditNotes.events || []).find(e => e.target === u1.id && e.meta?.changes?.notes);
        if (!notesAuditEvent) {
          defects.push({ kind: 'audit_missing_notes_update', text: 'Audit log missing notes update entry for user 1' });
        }

        // Send reset code
        await tap(page, '#dr-reset');
        await confirmCurrentDialog(page);

        // Check outbox.json for reset email
        const outboxRaw = fs.readFileSync(OUTBOX_FILE, 'utf8');
        const outbox = JSON.parse(outboxRaw);
        const resetMsg = (outbox.messages || []).find(m => m.email === u1.email && m.kind === 'reset');
        if (!resetMsg) {
          defects.push({ kind: 'outbox_missing_reset', text: `outbox.json missing reset message for ${u1.email}` });
        } else if (resetMsg.kind !== 'reset' || resetMsg.email !== u1.email) {
          defects.push({ kind: 'outbox_invalid_fields', text: `outbox message metadata mismatch: kind=${resetMsg.kind}, email=${resetMsg.email}` });
        }
        const auditReset = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.send_reset&pageSize=10`);
          return await r.json();
        }, u1.id);
        const resetAuditEvent = (auditReset.events || []).find(e => e.target === u1.id && e.action === 'user.send_reset');
        if (!resetAuditEvent) {
          defects.push({ kind: 'audit_missing_send_reset', text: 'Audit log missing user.send_reset entry' });
        }

        // Revoke sessions:
        // Log user 1 in to create an active session
        const loginRes = await fetch(BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: u1.email, password: u1.password })
        });
        if (loginRes.status !== 200) {
          throw new Error(`Failed to log in test user 1 (${loginRes.status}): ${await loginRes.text()}`);
        }
        const setCookieHeaders = loginRes.headers.getSetCookie?.() || [loginRes.headers.get('set-cookie')];
        u1SessionCookie = setCookieHeaders.map(c => c?.split(';')[0]).filter(Boolean).join('; ');

        // Verify user 1 has active session
        const meBefore = await fetch(BASE + '/api/auth/me', { headers: { cookie: u1SessionCookie } });
        if (meBefore.status !== 200 || !(await meBefore.json()).user) {
          throw new Error(`User 1 meBefore check failed: status ${meBefore.status}`);
        }

        // Switch to sessions tab in drawer
        await page.evaluate(() => document.querySelector('.drawer button[data-tab="sessions"]')?.click());
        await page.waitForSelector('#dr-revoke-all', { visible: true, timeout: 8000 });
        await tap(page, '#dr-revoke-all');
        await confirmCurrentDialog(page);

        // Wait for sessions to become empty in drawer
        await page.waitForFunction(() => {
          const tab = document.querySelector('#dr-tab');
          return tab && (tab.textContent.includes('No active sessions') || tab.textContent.includes('نشست فعالی وجود ندارد'));
        }, { timeout: 8000 });

        // A revoked cookie must be dead. /api/auth/me is the main app's boot probe: by contract it
        // answers 200 {user:null} for guests (authManager.init), so assert that, plus a guarded
        // endpoint rejecting the old cookie with 401.
        const meAfter = await fetch(BASE + '/api/auth/me', { headers: { cookie: u1SessionCookie } });
        const meAfterJson = await meAfter.json().catch(() => ({}));
        if (meAfter.status !== 200 || meAfterJson.user !== null) {
          defects.push({ kind: 'session_revoke', text: `GET /api/auth/me after revoke: expected 200 {user:null}, got ${meAfter.status} ${JSON.stringify(meAfterJson)}` });
        }
        const guardedAfter = await fetch(BASE + '/api/user/sessions', { headers: { cookie: u1SessionCookie } });
        if (guardedAfter.status !== 401) {
          defects.push({ kind: 'session_revoke', text: `GET /api/user/sessions with revoked cookie: expected 401, got ${guardedAfter.status}` });
        }
        const auditRevoke = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.revoke_sessions&pageSize=10`);
          return await r.json();
        }, u1.id);
        const revokeAuditEvent = (auditRevoke.events || []).find(e => e.target === u1.id && e.action === 'user.revoke_sessions');
        if (!revokeAuditEvent) {
          defects.push({ kind: 'audit_missing_revoke_sessions', text: 'Audit log missing user.revoke_sessions entry' });
        }

        // Suspend user
        await tap(page, '#dr-suspend');
        await confirmCurrentDialog(page);

        // Verify login fails with 403
        const suspLoginRes = await fetch(BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: u1.email, password: u1.password })
        });
        const suspLoginJson = await suspLoginRes.json().catch(() => ({}));
        if (suspLoginRes.status !== 403 || suspLoginJson.error !== 'account_suspended') {
          defects.push({
            kind: 'suspend_login_not_blocked',
            text: `Suspended user login expected 403 account_suspended, got ${suspLoginRes.status} (${suspLoginJson.error})`
          });
        }
        const auditSuspend = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.update&pageSize=10`);
          return await r.json();
        }, u1.id);
        const suspendAuditEvent = (auditSuspend.events || []).find(e => e.target === u1.id && e.meta?.changes?.suspended);
        if (!suspendAuditEvent) {
          defects.push({ kind: 'audit_missing_suspend', text: 'Audit log missing suspend update entry' });
        }

        // Unsuspend user
        await tap(page, '#dr-suspend');
        // Unsuspended = the footer button is back to the amber 'Suspend account' action.
        await page.waitForFunction(() => {
          const btn = document.querySelector('#dr-suspend');
          return btn && btn.classList.contains('btn-warn') && !btn.disabled;
        }, { timeout: 8000 });

        // Verify login works again
        const unsusLoginRes = await fetch(BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: u1.email, password: u1.password })
        });
        if (unsusLoginRes.status !== 200) {
          defects.push({
            kind: 'unsuspend_login_failed',
            text: `Unsuspended user login expected 200, got ${unsusLoginRes.status}`
          });
        }

        // Delete user: completing confirmation dialog
        await tap(page, '#dr-delete');
        await page.waitForSelector('.dialog-wrap #del-confirm', { visible: true, timeout: 8000 });
        await page.type('.dialog-wrap #del-confirm', u1.username);
        await page.waitForFunction(() => !document.querySelector('.dialog-wrap [data-dlg-ok]').disabled, { timeout: 5000 });
        await tap(page, '.dialog-wrap [data-dlg-ok]');
        await page.waitForFunction(() => !document.querySelector('.dialog-wrap') && !document.querySelector('.drawer'), { timeout: 8000 });

        // Fresh API read: GET /api/admin/users/:id must return 404
        const delCheck = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`);
          return { status: r.status };
        }, u1.id);
        if (delCheck.status !== 404) {
          defects.push({ kind: 'user_delete_not_404', text: `Deleted user GET returned status ${delCheck.status} (expected 404)` });
        }

        // Audit log check: user.delete
        const auditDel = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/audit?action=user.delete&pageSize=10`);
          return await r.json();
        }, u1.id);
        const delAuditEvent = (auditDel.events || []).find(e => e.target === u1.id && e.action === 'user.delete');
        if (!delAuditEvent) {
          defects.push({ kind: 'audit_missing_user_delete', text: 'Audit log missing user.delete entry' });
        }

        const newErrors = getNewErrors(/401|403|404|account_suspended|user_not_found|status of 40/);
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 6: Bulk actions
    // ──────────────────────────────────────────────────────────────────────────
    {
      const testName = '06_bulk_actions';
      const defects = [];
      const u2 = createdUsers[1];
      const u3 = createdUsers[2];

      try {
        // Wait until table/list refreshes after user 1 deletion, leaving exactly 2 users
        await page.waitForFunction((rid) => {
          const rows = document.querySelectorAll(window.innerWidth <= 860 ? '.mlist .mitem' : '#u-list tbody tr');
          return rows.length === 2 && !document.querySelector('#u-list[aria-busy="true"]');
        }, { timeout: 12000 }, RUN_ID);

        // Select-all: table-header checkbox on desktop, list-head checkbox on mobile — real clicks only.
        const selAll = await page.evaluate(() => (window.innerWidth <= 860 ? '#u-all-m' : '#u-all'));
        const isShown = (s) => page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        }, s);
        const checkedCount = () => page.evaluate(() => new Set([...document.querySelectorAll('input[data-sel]:checked')].map(c => c.dataset.sel)).size);
        const waitChecked = (n) => page.waitForFunction((k) => !document.querySelector('#u-list[aria-busy="true"]')
          && new Set([...document.querySelectorAll('input[data-sel]:checked')].map(c => c.dataset.sel)).size === k, { timeout: 12000 }, n);
        if (!(await isShown(selAll))) {
          defects.push({ kind: 'bulk_select_all_missing', text: `select-all control ${selAll} is not visible in this viewport` });
        } else {
          await tap(page, selAll);   // 1. select all
          await waitChecked(2);
          await tap(page, selAll);   // 2. deselect all
          await waitChecked(0);
        }
        // Select the 2 test users one by one via their VISIBLE row checkbox; select-all must track it.
        const clickVisibleSel = async (id) => {
          for (const h of await page.$$(`input[data-sel="${id}"]`)) {
            const box = await h.boundingBox();
            if (box && box.width > 0 && box.height > 0) {
              await h.evaluate(el => el.scrollIntoView({ block: 'center' }));
              await new Promise(r => setTimeout(r, 150));
              await h.click(); return true;
            }
          }
          return false;
        };
        const allState = () => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? { checked: el.checked, indeterminate: el.indeterminate } : null; }, selAll);
        // Selecting a row must not move the other rows (the bulk bar used to appear above the list and push it down).
        const docTop = (id) => page.evaluate((i) => {
          const el = [...document.querySelectorAll(`input[data-sel="${i}"]`)].find(e => e.getBoundingClientRect().width > 0);
          const r = el ? (el.closest('tr, .mitem') || el).getBoundingClientRect() : null;
          const base = (document.querySelector('#view') || document.body).getBoundingClientRect().top;
          return r ? Math.round(r.top - base) : null;
        }, id);
        const top3Before = await docTop(u3.id);
        if (!(await clickVisibleSel(u2.id))) defects.push({ kind: 'bulk_row_checkbox', text: 'no visible checkbox for user 2' });
        {
          const hid = await controlsUnderToast(page);
          if (hid.length) defects.push({ kind: 'toast_covers_controls', text: `bulk bar shown: toast covers ${hid.join(', ')}` });
        }
        const st1 = await allState();
        const top3After = await docTop(u3.id);
        if (top3Before == null || top3After == null || Math.abs(top3After - top3Before) > 1) {
          defects.push({ kind: 'bulk_layout_shift', text: `selecting one row moved the next row by ${top3After - top3Before}px; rows must stay put when the bulk bar appears` });
        }
        if (!st1 || st1.checked || !st1.indeterminate) defects.push({ kind: 'bulk_select_all_state', text: `1 of 2 selected: select-all should be indeterminate, got ${JSON.stringify(st1)}` });
        if (!(await clickVisibleSel(u3.id))) defects.push({ kind: 'bulk_row_checkbox', text: 'no visible checkbox for user 3' });
        const st2 = await allState();
        if (!st2 || !st2.checked || st2.indeterminate) defects.push({ kind: 'bulk_select_all_state', text: `2 of 2 selected: select-all should be checked, got ${JSON.stringify(st2)}` });
        const nSel = await checkedCount();
        if (nSel !== 2) defects.push({ kind: 'bulk_selection_count', text: `expected 2 selected users, got ${nSel}` });

        // Wait for bulk action bar to appear
        await page.waitForSelector('#u-bulk button[data-bulk="verify"]', { visible: true, timeout: 10000 });

        // Run bulk action: verify email
        await tap(page, '#u-bulk button[data-bulk="verify"]');
        await confirmCurrentDialog(page);
        await page.waitForSelector('.toasts .toast', { visible: true, timeout: 6000 }).catch(() => {});
        await page.screenshot({ path: path.join(EVID_DIR, `toast_list_${VP}_${LANG}.png`) }).catch(() => {});

        // API check: must reflect verified for both users
        const u2Api = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`);
          return await r.json();
        }, u2.id);
        const u3Api = await page.evaluate(async (uid) => {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`);
          return await r.json();
        }, u3.id);

        if (!u2Api.user?.emailVerified) {
          defects.push({ kind: 'bulk_verify_u2_failed', text: 'Bulk verify did not set emailVerified on user 2' });
        }
        if (!u3Api.user?.emailVerified) {
          defects.push({ kind: 'bulk_verify_u3_failed', text: 'Bulk verify did not set emailVerified on user 3' });
        }

        // Audit log check: users.bulk
        const auditBulk = await page.evaluate(async () => {
          const r = await fetch('/api/admin/audit?action=users.bulk&pageSize=5');
          return await r.json();
        });
        const bulkEvent = (auditBulk.events || []).find(e => e.action === 'users.bulk' && e.meta?.action === 'verify');
        if (!bulkEvent) {
          defects.push({ kind: 'audit_missing_bulk_action', text: 'Audit log missing users.bulk entry with action=verify' });
        }

        const newErrors = getNewErrors();
        if (newErrors.length) {
          defects.push(...newErrors.map(e => ({ kind: 'console_error', text: String(e.text || '').slice(0, 140) })));
        }
      } catch (err) {
        defects.push({ kind: 'harness_exception', text: err.message });
      }

      const status = defects.length === 0 ? 'pass' : 'fail';
      if (status !== 'pass') {
        await page.screenshot({ path: path.join(EVID_DIR, `${testName}_${VP}_${LANG}.png`), fullPage: false }).catch(() => {});
      }
      recordResult(testName, status, defects);
    }

  } catch (fatal) {
    recordResult('fatal_suite_error', 'fail', [{ kind: 'suite_crash', text: fatal.message }]);
  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // Cleanup: delete every user this run created via API, then logout
    // ──────────────────────────────────────────────────────────────────────────
    try {
      const authRes = await fetch(BASE + '/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: MASTER_KEY })
      });
      const ck = (authRes.headers.getSetCookie?.() || [authRes.headers.get('set-cookie')]).map(c => c?.split(';')[0]).filter(Boolean).join('; ');

      for (const u of createdUsers) {
        await fetch(BASE + '/api/admin/users/' + u.id, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie: ck },
          body: JSON.stringify({ confirm: u.username })
        }).catch(() => {});
      }

      await fetch(BASE + '/api/admin/logout', {
        method: 'POST',
        headers: { cookie: ck }
      }).catch(() => {});
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }

    if (ctx && ctx.browser) {
      await ctx.browser.close().catch(() => {});
    }

    printSummaryTable();

    const failures = results.filter(r => r.status !== 'pass');
    if (failures.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
})();
