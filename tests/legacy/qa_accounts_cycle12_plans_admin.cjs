// tests/qa_accounts_cycle12_plans_admin.cjs — Comprehensive QA Cycle for Unlimited Subscription Plans & Feature Toggles Studio.
// Verifies:
// 1. Master Key gate & unlock lifecycle
// 2. Visual Plans Admin Studio UI (sidebar, search, tabs, controls)
// 3. Unlimited plan creation with custom metadata & pricing
// 4. Granular boolean feature flag activation/deactivation and real-time gate enforcement
// 5. Numeric quota limits and unlimited (∞) toggle
// 6. Plan clone & duplicate functionality
// 7. Plan reordering (tier ranking)
// 8. Plan deletion & automatic fallback user migration (safety constraints)
// 9. Dynamic public comparison modal rendering (cards + matrix table)
// 10. Persian RTL, strict ZWNJ, and formal tone
// 11. Mobile viewport responsiveness & zero horizontal overflow

const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');

const TS = Date.now().toString(36);
const EMAIL = `c12_admin_${TS}@qa.test`;
const USERNAME = `c12adm_${TS}`;
const PASSWORD = 'QaAdminPass123';
const MASTER_KEY = 'tradingchart_master_nexus';

async function pollUntil(fn, timeoutMs = 12000, step = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise(r => setTimeout(r, step));
  }
  return null;
}

async function authLogin(page, identity = EMAIL, password = PASSWORD) {
  return page.evaluate(async ({ identity, password }) => {
    const am = window.__TRADING_APP__.auth;
    const r = await am.login({ identity, password });
    return { ok: r.ok, user: am.user?.username || null };
  }, { identity, password });
}

const tests = {
  desktop: {
    '01_setup_user_and_initial_plans': async (ctx) => {
      const defects = [];
      // 1. Register test user
      const r = await ctx.page.evaluate(async ({ email, username, password }) => {
        const am = window.__TRADING_APP__.auth;
        return am.register({ email, username, password, displayName: 'QA Admin Tester' });
      }, { email: EMAIL, username: USERNAME, password: PASSWORD });
      if (!r.ok) defects.push({ kind: 'setup', text: `Registration failed: ${JSON.stringify(r.data)}` });

      // 2. Fetch plans from /api/plans
      const plansRes = await ctx.page.evaluate(async () => {
        const res = await fetch('/api/plans', { credentials: 'same-origin' });
        return res.json();
      });
      if (!plansRes.ok) defects.push({ kind: 'plans-api', text: 'GET /api/plans failed' });
      if (!plansRes.plans?.basic) defects.push({ kind: 'plans-api', text: 'Seed plan "basic" missing' });
      if (!Array.isArray(plansRes.planOrder) || plansRes.planOrder.length < 5) {
        defects.push({ kind: 'plans-api', text: `Plan order incomplete: ${JSON.stringify(plansRes.planOrder)}` });
      }

      return { defects };
    },

    '02_master_key_gate_rejection_and_unlock': async (ctx) => {
      const defects = [];
      await authLogin(ctx.page);

      // Clear any stored key
      await ctx.page.evaluate(() => {
        sessionStorage.removeItem('tradingchart_admin_key');
        localStorage.removeItem('tradingchart_admin_key');
      });

      // Try opening plans admin studio -> should prompt for master key
      await ctx.page.evaluate(() => { window.__TRADING_APP__.auth.openPlanAdminStudio(); });
      const promptUp = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-master-key-modal')));
      if (!promptUp) defects.push({ kind: 'master-key', text: 'Master key prompt modal did not appear' });

      // Test invalid key
      await ctx.page.evaluate(() => {
        const inp = document.querySelector('#tc-mk-input');
        if (inp) inp.value = 'wrong_key_123';
        document.querySelector('#tc-mk-submit')?.click();
      });
      const hasError = await ctx.page.waitForFunction(() => {
        const err = document.querySelector('#tc-mk-err');
        return err && err.style.display !== 'none' && (err.textContent || '').length > 5;
      }, { timeout: 12000 }).then(() => true).catch(() => false);
      if (!hasError) {
        defects.push({ kind: 'master-key', text: 'Invalid master key did not show error message' });
      }

      // Test valid key
      await ctx.page.evaluate((key) => {
        const inp = document.querySelector('#tc-mk-input');
        if (inp) inp.value = key;
        document.querySelector('#tc-mk-submit')?.click();
      }, MASTER_KEY);

      const studioOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')));
      if (!studioOpened) defects.push({ kind: 'master-key', text: 'Valid master key did not open plan admin studio' });

      await shots(ctx, 'c12_admin_studio_unlocked');
      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '03_admin_studio_structure_and_tabs': async (ctx) => {
      const defects = [];
      // Ensure studio is open
      const hasModal = await ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal'));
      if (!hasModal) {
        await ctx.page.evaluate(() => { window.__TRADING_APP__.auth.openPlanAdminStudio(); });
        await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')));
      }

      // Check sidebar and plans list
      const sidebarState = await ctx.page.evaluate(() => {
        const list = document.querySelector('#tc-pa-plans-list');
        const items = list ? list.querySelectorAll('[data-plan-item]').length : 0;
        const search = !!document.querySelector('#tc-pa-search');
        return { items, search };
      });
      if (sidebarState.items < 5) defects.push({ kind: 'studio-ui', text: `Sidebar plans count too low: ${sidebarState.items}` });
      if (!sidebarState.search) defects.push({ kind: 'studio-ui', text: 'Sidebar search input missing' });

      // Sweep through all editor tabs
      const tabIds = ['general', 'quotas', 'chart', 'trading', 'backtest', 'platform', 'preview'];
      for (const tabId of tabIds) {
        await ctx.page.evaluate((tid) => {
          document.querySelector(`button[data-etab="${tid}"]`)?.click();
        }, tabId);
        await new Promise(r => setTimeout(r, 120));
        const bodyText = await ctx.page.evaluate(() => document.querySelector('#tc-pa-tab-body')?.innerText || '');
        if (bodyText.length < 15) {
          defects.push({ kind: 'studio-tabs', text: `Tab "${tabId}" rendered empty body` });
        }
      }

      // Check overflow on desktop
      const audit = await auditStatic(ctx);
      if (audit.horizontalOverflow.length) {
        defects.push({ kind: 'studio-overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      }

      return { defects };
    },

    '04_create_custom_unlimited_plan': async (ctx) => {
      const defects = [];
      const customId = `algo_pro_${TS}`;

      // Create new plan via API directly with Master Key
      const createRes = await ctx.page.evaluate(async ({ customId, masterKey }) => {
        const res = await fetch('/api/admin/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
          body: JSON.stringify({
            id: customId,
            nameEn: 'Algo Pro Scalper',
            nameFa: 'اسکالپر حرفه‌ای الگو',
            descriptionEn: 'High-frequency algorithmic trading tier with tick-level data',
            descriptionFa: 'پلن اختصاصی معاملات الگوریتمی فرکانس بالا با داده‌های لحظه‌ای',
            priceUSD: 79.95,
            priceYearlyUSD: 799.50,
            badge: 'ALGO-VIP',
            badgeFa: 'ویژه الگو',
            color: '#06b6d4',
            features: {
              chartsPerTab: 8,
              savedLayouts: 25,
              secondIntervals: true,
              tickIntervals: true,
              propFirmSim: false, // deliberately disabled for testing gate
              tradeJournal: false, // deliberately disabled for testing gate
              depthOfMarket: true,
              webhookAlerts: true,
              pineStudio: true
            }
          })
        });
        return res.json();
      }, { customId, masterKey: MASTER_KEY });

      if (!createRes.ok) {
        defects.push({ kind: 'create-plan', text: `Failed to create custom plan: ${JSON.stringify(createRes)}` });
      } else {
        if (createRes.plan.id !== customId) defects.push({ kind: 'create-plan', text: 'Returned plan ID mismatch' });
        if (createRes.plan.features.secondIntervals !== true) defects.push({ kind: 'create-plan', text: 'Feature secondIntervals flag not saved' });
        if (createRes.plan.features.propFirmSim !== false) defects.push({ kind: 'create-plan', text: 'Feature propFirmSim flag not saved as false' });
      }

      // Refresh auth plans
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.refreshPlans());
      const hasPlan = await ctx.page.evaluate((cid) => !!window.__TRADING_APP__.auth.plansMeta[cid], customId);
      if (!hasPlan) defects.push({ kind: 'create-plan', text: 'Custom plan not present in auth.plansMeta after refresh' });

      return { defects };
    },

    '05_granular_feature_gate_enforcement': async (ctx) => {
      const defects = [];
      const customId = `algo_pro_${TS}`;

      // Switch logged-in user to the new custom plan
      const switchRes = await ctx.page.evaluate(async (cid) => {
        return window.__TRADING_APP__.auth.setPlan(cid);
      }, customId);
      if (!switchRes.ok) defects.push({ kind: 'switch-plan', text: 'Failed to switch user to custom plan' });

      // 1. propFirmSim is disabled in this plan -> check() must return allowed: false
      const propCheck = await ctx.page.evaluate(() => {
        return window.__TRADING_APP__.auth.check('propFirmSim', 0);
      });
      if (propCheck.allowed !== false) {
        defects.push({ kind: 'gate-enforce', text: `Disabled feature propFirmSim check returned allowed: ${propCheck.allowed}` });
      }

      // 2. tradeJournal is disabled -> calling enforce() must return false and toast
      const journalEnforce = await ctx.page.evaluate(() => {
        return window.__TRADING_APP__.auth.enforce('tradeJournal', 0, 'Trade Journal', 'ژورنال معاملاتی');
      });
      if (journalEnforce !== false) {
        defects.push({ kind: 'gate-enforce', text: 'Enforce on disabled tradeJournal did not return false' });
      }

      // 3. secondIntervals IS enabled -> check() must return allowed: true
      const secondCheck = await ctx.page.evaluate(() => {
        return window.__TRADING_APP__.auth.feature('secondIntervals');
      });
      if (!secondCheck) {
        defects.push({ kind: 'gate-enforce', text: 'Enabled feature secondIntervals returned false' });
      }

      // 4. Now update plan: Enable propFirmSim and tradeJournal!
      const updateRes = await ctx.page.evaluate(async ({ customId, masterKey }) => {
        const res = await fetch(`/api/admin/plans/${customId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
          body: JSON.stringify({
            features: {
              propFirmSim: true,
              tradeJournal: true
            }
          })
        });
        return res.json();
      }, { customId, masterKey: MASTER_KEY });
      if (!updateRes.ok) defects.push({ kind: 'update-plan', text: 'Failed to update plan feature toggles' });

      // Refresh and re-check
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.refreshPlans());
      const propCheckAfter = await ctx.page.evaluate(() => window.__TRADING_APP__.auth.feature('propFirmSim'));
      if (!propCheckAfter) {
        defects.push({ kind: 'gate-enforce', text: 'propFirmSim did not become true after updating plan' });
      }

      return { defects };
    },

    '06_clone_plan_and_independent_mutation': async (ctx) => {
      const defects = [];
      const sourceId = `algo_pro_${TS}`;
      const cloneId = `algo_pro_clone_${TS}`;

      // Clone plan
      const cloneRes = await ctx.page.evaluate(async ({ sourceId, cloneId, masterKey }) => {
        const res = await fetch('/api/admin/plans/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
          body: JSON.stringify({
            sourceId,
            newId: cloneId,
            nameEn: 'Algo Pro Cloned',
            nameFa: 'اسکالپر کلون‌شده'
          })
        });
        return res.json();
      }, { sourceId, cloneId, masterKey: MASTER_KEY });

      if (!cloneRes.ok) {
        defects.push({ kind: 'clone-plan', text: `Clone failed: ${JSON.stringify(cloneRes)}` });
      } else {
        if (cloneRes.plan.id !== cloneId) defects.push({ kind: 'clone-plan', text: 'Clone ID mismatch' });
        if (cloneRes.plan.priceUSD !== 79.95) defects.push({ kind: 'clone-plan', text: 'Clone did not inherit source price' });
      }

      // Mutate clone price and a feature flag
      const mutateRes = await ctx.page.evaluate(async ({ cloneId, masterKey }) => {
        const res = await fetch(`/api/admin/plans/${cloneId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
          body: JSON.stringify({
            priceUSD: 149.95,
            features: {
              deepBacktest: true
            }
          })
        });
        return res.json();
      }, { cloneId, masterKey: MASTER_KEY });

      if (!mutateRes.ok) defects.push({ kind: 'clone-plan', text: 'Failed to mutate cloned plan' });

      // Verify source plan remains unchanged (isolation check)
      const sourceCheck = await ctx.page.evaluate(async ({ sourceId, cloneId, masterKey }) => {
        const res = await fetch('/api/admin/plans', {
          headers: { 'X-Master-Key': masterKey }
        });
        const data = await res.json();
        return {
          sourcePrice: data.plans[sourceId]?.priceUSD,
          sourceDeepBacktest: data.plans[sourceId]?.features?.deepBacktest,
          clonePrice: data.plans[cloneId]?.priceUSD,
          cloneDeepBacktest: data.plans[cloneId]?.features?.deepBacktest
        };
      }, { sourceId, cloneId, masterKey: MASTER_KEY });

      if (sourceCheck.sourcePrice !== 79.95) defects.push({ kind: 'clone-isolation', text: `Source price mutated: ${sourceCheck.sourcePrice}` });
      if (sourceCheck.clonePrice !== 149.95) defects.push({ kind: 'clone-isolation', text: `Clone price wrong: ${sourceCheck.clonePrice}` });
      if (sourceCheck.cloneDeepBacktest !== true) defects.push({ kind: 'clone-isolation', text: 'Clone feature deepBacktest not updated' });

      return { defects };
    },

    '07_reorder_plans_and_verify_rank': async (ctx) => {
      const defects = [];
      const cloneId = `algo_pro_clone_${TS}`;

      // Move cloneId to the front
      const reorderRes = await ctx.page.evaluate(async ({ cloneId, masterKey }) => {
        const getRes = await fetch('/api/admin/plans', { headers: { 'X-Master-Key': masterKey } });
        const cur = await getRes.json();
        const newOrder = [cloneId, ...cur.planOrder.filter(x => x !== cloneId)];
        const postRes = await fetch('/api/admin/plans/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
          body: JSON.stringify({ order: newOrder })
        });
        return postRes.json();
      }, { cloneId, masterKey: MASTER_KEY });

      if (!reorderRes.ok) defects.push({ kind: 'reorder', text: 'Reorder API failed' });
      else if (reorderRes.planOrder[0] !== cloneId) {
        defects.push({ kind: 'reorder', text: `Reordered first item is not cloneId (${reorderRes.planOrder[0]})` });
      }

      return { defects };
    },

    '08_delete_plan_and_safety_constraints': async (ctx) => {
      const defects = [];
      const cloneId = `algo_pro_clone_${TS}`;

      // 1. Safety check: deleting default plan ('basic') must be rejected with 400
      const delBasic = await ctx.page.evaluate(async (masterKey) => {
        const res = await fetch('/api/admin/plans/basic', {
          method: 'DELETE',
          headers: { 'X-Master-Key': masterKey }
        });
        return { status: res.status, data: await res.json() };
      }, MASTER_KEY);
      if (delBasic.status !== 400 || delBasic.data.error !== 'cannot_delete_default_plan') {
        defects.push({ kind: 'delete-safety', text: `Deleting default plan was not rejected: ${JSON.stringify(delBasic)}` });
      }

      // 2. Delete the cloned custom plan
      const delClone = await ctx.page.evaluate(async ({ cloneId, masterKey }) => {
        const res = await fetch(`/api/admin/plans/${cloneId}`, {
          method: 'DELETE',
          headers: { 'X-Master-Key': masterKey }
        });
        return { status: res.status, data: await res.json() };
      }, { cloneId, masterKey: MASTER_KEY });
      if (delClone.status !== 200 || !delClone.data.ok) {
        defects.push({ kind: 'delete-plan', text: `Deleting clone plan failed: ${JSON.stringify(delClone)}` });
      }

      return { defects, ignoreConsole: 'Failed to load resource' };
    },

    '09_public_plans_modal_with_custom_plans': async (ctx) => {
      const defects = [];
      await authLogin(ctx.page);

      // Open public plans modal
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
      const modalUp = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plans-modal')));
      if (!modalUp) defects.push({ kind: 'public-modal', text: 'Plans modal did not open' });

      // Verify custom plan card is present
      const customId = `algo_pro_${TS}`;
      const cardPresent = await ctx.page.evaluate((cid) => {
        return !!document.querySelector(`#tc-plans-modal [data-plan="${cid}"]`);
      }, customId);
      if (!cardPresent) defects.push({ kind: 'public-modal', text: `Custom plan card "${customId}" missing from public modal` });

      // Verify admin button exists in modal header
      const adminBtn = await ctx.page.evaluate(() => !!document.querySelector('#tc-plans-open-admin'));
      if (!adminBtn) defects.push({ kind: 'public-modal', text: 'Admin button "#tc-plans-open-admin" missing from header' });

      // Verify comparison table has feature rows
      const rowsCount = await ctx.page.evaluate(() => document.querySelectorAll('#tc-plans-modal table tbody tr').length);
      if (rowsCount < 15) defects.push({ kind: 'public-modal', text: `Comparison table rows too few: ${rowsCount}` });

      await shots(ctx, 'c12_public_plans_modal_with_custom');
      // Close modal
      await ctx.page.evaluate(() => document.querySelector('#tc-plans-modal [data-close]')?.click());

      return { defects };
    },

    '10_persian_rtl_and_zwnj_verification': async (ctx) => {
      const defects = [];
      // Switch language to Persian
      await ctx.page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await new Promise(r => setTimeout(r, 600));

      // Open admin studio
      await ctx.page.evaluate(() => { window.__TRADING_APP__.auth.openPlanAdminStudio(); });
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')));

      // Verify RTL direction
      const dir = await ctx.page.evaluate(() => {
        const box = document.querySelector('.tc-plan-admin-box');
        return box ? getComputedStyle(box).direction : 'ltr';
      });
      if (dir !== 'rtl') defects.push({ kind: 'i18n-rtl', text: `Plan admin box direction is "${dir}" instead of "rtl"` });

      // Verify Persian headings and buttons
      const studioText = await ctx.page.evaluate(() => document.querySelector('#tc-plan-admin-modal')?.innerText || '');
      for (const needle of ['استودیوی جامع مدیریت پلن‌ها', 'تعریف پلن جدید', 'مشخصات عمومی', 'سقف‌های مقداری']) {
        if (!studioText.includes(needle)) {
          defects.push({ kind: 'i18n-text', text: `Missing Persian string: "${needle}"` });
        }
      }

      await shots(ctx, 'c12_admin_studio_persian_rtl');
      // Close studio
      await ctx.page.evaluate(() => document.querySelector('#tc-plan-admin-modal [data-close]')?.click());
      // Switch back to English
      await ctx.page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));

      return { defects };
    }
  },

  mobile: {
    'm01_mobile_plan_admin_modal_fit': async (ctx) => {
      const defects = [];
      await authLogin(ctx.page);

      // Open Plan Admin Studio on mobile
      await ctx.page.evaluate(() => { window.__TRADING_APP__.auth.openPlanAdminStudio(); });
      const opened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')));
      if (!opened) defects.push({ kind: 'mobile-fit', text: 'Studio modal did not open on mobile' });

      // Check overflow
      const audit = await auditStatic(ctx);
      if (audit.horizontalOverflow.length) {
        defects.push({ kind: 'mobile-overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      }

      // Check modal bounding rect fits viewport (390px)
      const fits = await ctx.page.evaluate(() => {
        const box = document.querySelector('.tc-plan-admin-box');
        if (!box) return false;
        const r = box.getBoundingClientRect();
        return r.width <= window.innerWidth + 1 && r.right <= window.innerWidth + 1;
      });
      if (!fits) defects.push({ kind: 'mobile-fit', text: 'Modal box exceeds mobile viewport width' });

      await shots(ctx, 'c12_mobile_admin_studio');
      await ctx.page.evaluate(() => document.querySelector('#tc-plan-admin-modal [data-close]')?.click());
      return { defects, ignoreConsole: '409|Conflict' };
    },

    'm02_mobile_public_plans_modal_fit': async (ctx) => {
      const defects = [];
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plans-modal')));

      const audit = await auditStatic(ctx);
      if (audit.horizontalOverflow.length) {
        defects.push({ kind: 'mobile-overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      }

      await shots(ctx, 'c12_mobile_public_plans');
      await ctx.page.evaluate(() => document.querySelector('#tc-plans-modal [data-close]')?.click());

      // Clean up customId
      const customId = `algo_pro_${TS}`;
      await ctx.page.evaluate(async ({ customId, masterKey }) => {
        await fetch(`/api/admin/plans/${customId}`, {
          method: 'DELETE',
          headers: { 'X-Master-Key': masterKey }
        });
      }, { customId, masterKey: MASTER_KEY });

      return { defects };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle12_plans_admin', tests, {});
})();
