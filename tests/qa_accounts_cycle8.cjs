// tests/qa_accounts_cycle8.cjs — Exploratory UX dogfood of the account system.
// Real-user journeys through EVERY account surface, desktop + mobile, FA + EN.
// Anything that looks, feels or behaves wrong is a defect — not just crashes.
const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');

const TS = Date.now().toString(36);
const EMAIL = `c8_${TS}@qa.test`;
const USERNAME = `c8user_${TS}`;
const PASSWORD = 'QaPass1234';

async function pollUntil(fn, timeoutMs = 12000, step = 350) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise(r => setTimeout(r, step));
  }
  return null;
}

async function registerViaApi(page, { email, username, password }) {
  return page.evaluate(async (body) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: r.status, data: await r.json() };
  }, { email, username, password, displayName: 'QA Eight' });
}

async function loginViaApi(page, identity, password) {
  return page.evaluate(async ({ identity, password }) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    return { status: r.status, data: await r.json() };
  }, { identity, password });
}

async function openSettings(page, tab) {
  return page.evaluate(async (t) => {
    const am = window.__TRADING_APP__?.auth;
    if (!am) return { ok: false };
    am.openAccountSettingsModal(t);
    return { ok: true };
  }, tab);
}

// Every account-surface modal must pass this shared checklist.
async function modalAudit(ctx, modalSel, name) {
  const defects = [];
  const a = await auditStatic(ctx);
  if (a.horizontalOverflow.length) defects.push({ kind: `${name}/overflow`, text: JSON.stringify(a.horizontalOverflow.slice(0, 2)) });
  const fit = await ctx.page.evaluate((sel) => {
    const b = document.querySelector(sel + ' .modal-box');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return {
      fitsW: r.width <= window.innerWidth,
      fitsH: r.top >= 0 && r.bottom <= window.innerHeight + 2,
      w: Math.round(r.width), vw: window.innerWidth, bottom: Math.round(r.bottom), vh: window.innerHeight
    };
  }, modalSel);
  if (!fit) defects.push({ kind: `${name}/missing`, text: 'modal not found' });
  else {
    if (!fit.fitsW) defects.push({ kind: `${name}/width`, text: JSON.stringify(fit) });
    if (!fit.fitsH) defects.push({ kind: `${name}/height`, text: JSON.stringify(fit) });
  }
  return defects;
}

const tests = {
  desktop: {
    '01_guest_menu_shows_value_prop': async (ctx) => {
      await ctx.page.evaluate(() => {
        document.querySelector('.user-avatar-badge')?.click();
      });
      const menu = await pollUntil(() => ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-account-menu');
        return m ? m.innerText : null;
      }));
      const defects = [];
      if (!menu) { defects.push({ kind: 'menu', text: 'guest menu never opened' }); return { defects }; }
      if (!/Sign In|ورود/.test(menu)) defects.push({ kind: 'menu', text: 'no sign-in entry' });
      if (!/Create Free Account|ایجاد حساب/.test(menu)) defects.push({ kind: 'menu', text: 'no signup entry' });
      if (!/Compare Plans|مقایسه پلن/.test(menu)) defects.push({ kind: 'menu', text: 'no plans entry for guest' });
      return { defects };
    },

    '02_full_signup_journey_via_ui': async (ctx) => {
      const defects = [];
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      // click the EXACT signup action (DOM order picks login first otherwise)
      await ctx.page.evaluate(() => document.querySelector('#tc-account-menu [data-act="signup"]')?.click());
      const form = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-auth-modal input[name="email"]')));
      if (!form) return { defects: [{ kind: 'signup', text: 'signup form never opened' }] };
      await ctx.page.evaluate(({ email, username, password }) => {
        document.querySelector('#tc-auth-modal input[name="displayName"]').value = 'QA Eight';
        document.querySelector('#tc-auth-modal input[name="email"]').value = email;
        document.querySelector('#tc-auth-modal input[name="username"]').value = username;
        document.querySelector('#tc-auth-modal input[name="password"]').value = password;
      }, { email: EMAIL, username: USERNAME, password: PASSWORD });
      await ctx.page.evaluate(() => document.querySelector('#tc-auth-submit')?.click());
      // success = auth modal closes and verify flow opens
      const verified = await pollUntil(() => ctx.page.evaluate(() => {
        const authGone = !document.querySelector('#tc-auth-modal');
        const verifyOpen = !!document.querySelector('#tc-verify-modal') ||
          [...document.querySelectorAll('.modal-overlay')].some(m => /verify|تأیید/i.test(m.innerText));
        return authGone && verifyOpen;
      }), 15000);
      if (!verified) defects.push({ kind: 'signup', text: 'signup did not lead into the verify flow' });
      // user state must be signed-in now
      const state = await ctx.page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        return { signedIn: !!am?.user, plan: am?.user?.plan, badge: document.querySelector('.user-avatar-badge')?.dataset.auth };
      });
      if (!state.signedIn) defects.push({ kind: 'signup', text: 'not signed in after signup' });
      if (state.badge !== 'in') defects.push({ kind: 'badge', text: `badge auth=${state.badge}` });
      await shots(ctx, 'c8_signup_journey');
      return { defects };
    },

    '03_verify_email_via_outbox_code': async (ctx) => {
      // pull the code straight from the server outbox (self-hosted mail)
      const code = await ctx.page.evaluate(async (email) => {
        // outbox is server-side; use the debug read path exposed for QA? No —
        // read via a privileged fetch is not available, so instead assert the
        // request-verify endpoint works and the UI accepts the code from the
        // outbox file through a server-side helper endpoint... we must use fs.
        return null;
      }, EMAIL);
      const fs = require('fs');
      const box = JSON.parse(fs.readFileSync('/root/TradingChart/server/data/accounts/outbox.json', 'utf8'));
      const msg = box.messages.find(m => m.email === EMAIL && m.kind === 'verify');
      const defects = [];
      if (!msg) { defects.push({ kind: 'verify', text: 'no verify code in outbox' }); return { defects }; }
      const r = await ctx.page.evaluate(async ({ email, password, code }) => {
        const login = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: email, password }) });
        if (!(await login.json()).ok) return { ok: false, why: 'login failed' };
        const v = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        return v.json();
      }, { email: EMAIL, password: PASSWORD, code: msg.code });
      if (!r.ok || r.user?.emailVerified !== true) defects.push({ kind: 'verify', text: `verify failed: ${JSON.stringify(r)}` });
      return { defects };
    },

    '04_account_menu_shows_verified_badge_and_plan': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      await ctx.page.evaluate(async () => {
        const am = window.__TRADING_APP__.auth;
        await am.pullCloudState?.();
        am.renderAccountBadge();
        document.querySelector('.user-avatar-badge')?.click();
      });
      const menu = await pollUntil(() => ctx.page.evaluate(() => document.querySelector('#tc-account-menu')?.innerText || null));
      const defects = [];
      if (!menu) return { defects: [{ kind: 'menu', text: 'signed-in menu never opened' }] };
      if (!/Verified|تأییدشده/.test(menu)) defects.push({ kind: 'menu', text: 'verified badge missing in menu' });
      if (!/Basic|پایه/.test(menu)) defects.push({ kind: 'menu', text: 'plan badge missing in menu' });
      if (!/Profile|پروفایل/.test(menu)) defects.push({ kind: 'menu', text: 'profile entry missing' });
      if (!/Active Devices|دستگاه‌های فعال/.test(menu)) defects.push({ kind: 'menu', text: 'devices entry missing' });
      return { defects };
    },

    '05_all_settings_tabs_render_and_fit': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      const defects = [];
      for (const tab of ['profile', 'account', 'security', 'sessions', 'data']) {
        await openSettings(ctx.page, tab);
        const ok = await pollUntil(() => ctx.page.evaluate((t) => {
          const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
          return b && b.innerText.trim().length > 20;
        }, tab));
        if (!ok) { defects.push({ kind: `tab/${tab}`, text: 'tab body never rendered' }); continue; }
        defects.push(...await modalAudit(ctx, '#tc-account-settings-modal', `tab/${tab}`));
        // tab switch must keep a single modal (no stacking duplicates)
        const modalCount = await ctx.page.evaluate(() => document.querySelectorAll('#tc-account-settings-modal').length);
        if (modalCount !== 1) defects.push({ kind: `tab/${tab}`, text: `${modalCount} duplicate modals stacked` });
      }
      await shots(ctx, 'c8_all_tabs_desktop');
      await ctx.page.evaluate(() => document.querySelector('#tc-account-settings-modal [data-close]')?.click());
      return { defects };
    },

    '06_plans_modal_matrix_and_upgrade': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
      const ok = await pollUntil(() => ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        return m && /Ultimate|آلتیمیت/.test(m.innerText);
      }));
      const defects = [];
      if (!ok) return { defects: [{ kind: 'plans', text: 'plans modal never rendered' }] };
      const info = await ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        const text = m.innerText;
        const faNames = { Basic: 'پایه', Essential: 'اسنشیال', Plus: 'پلاس', Premium: 'پریمیوم', Ultimate: 'آلتیمیت' };
        return {
          tiers: Object.keys(faNames).filter(t => text.includes(t) || text.includes(faNames[t])).length,
          prices: (text.match(/\$\d+(\.\d+)?/g) || []).length,
          hasTable: !!m.querySelector('table'),
          featureRows: m.querySelectorAll('tbody tr').length,
          upgradeBtns: m.querySelectorAll('.tc-plan-btn:not([disabled])').length
        };
      });
      if (info.tiers < 5) defects.push({ kind: 'plans', text: `only ${info.tiers} tiers visible` });
      if (info.prices < 4) defects.push({ kind: 'plans', text: `prices found=${info.prices}` });
      if (!info.hasTable || info.featureRows < 15) defects.push({ kind: 'plans', text: `feature matrix rows=${info.featureRows}` });
      if (info.upgradeBtns < 4) defects.push({ kind: 'plans', text: `upgrade buttons=${info.upgradeBtns}` });
      // upgrade via the actual modal button (user path, not API shortcut)
      await ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        [...m.querySelectorAll('.tc-plan-btn')].find(b => b.dataset.plan === 'plus')?.click();
      });
      const badge = await pollUntil(() => ctx.page.evaluate(() => {
        const b = document.querySelector('.user-avatar-badge');
        return b?.dataset.plan === 'plus' ? 'plus' : null;
      }), 8000);
      if (badge !== 'plus') defects.push({ kind: 'plans', text: `badge plan=${badge} after UI upgrade click` });
      await shots(ctx, 'c8_plans_modal');
      await ctx.page.evaluate(async () => { await window.__TRADING_APP__.auth.setPlan('basic'); });
      return { defects };
    },

    '07_devices_modal_lists_current_session': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openDevicesModal());
      const ok = await pollUntil(() => ctx.page.evaluate(() => {
        const m = [...document.querySelectorAll('.modal-overlay')].find(x => /device|دستگاه/i.test(x.innerText));
        return !!m && m.innerText.length > 40;
      }));
      const defects = [];
      if (!ok) return { defects: [{ kind: 'devices', text: 'devices modal never rendered' }] };
      const hasCurrent = await ctx.page.evaluate(() => {
        const m = [...document.querySelectorAll('.modal-overlay')].find(x => /device|دستگاه/i.test(x.innerText));
        return /this device|دستگاه فعلی/.test(m.innerText);
      });
      if (!hasCurrent) defects.push({ kind: 'devices', text: 'current device not marked' });
      await shots(ctx, 'c8_devices_modal');
      await ctx.page.evaluate(() => [...document.querySelectorAll('.modal-overlay [data-close], .modal-overlay button')].find(b => b.textContent.trim() === '✕')?.click());
      return { defects };
    },

    '08_signout_roundtrip_restores_guest': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      await ctx.page.evaluate(async () => { await window.__TRADING_APP__.auth.logout(); });
      const state = await pollUntil(() => ctx.page.evaluate(() => {
        const am = window.__TRADING_APP__.auth;
        const badge = document.querySelector('.user-avatar-badge');
        return (!am.user && badge?.dataset.auth === 'out') ? true : null;
      }));
      const defects = [];
      if (!state) defects.push({ kind: 'logout', text: 'guest state not restored after logout' });
      return { defects };
    },

    '09_cloud_sync_survives_reload': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL, PASSWORD);
      // write a marker into a synced key and force an immediate push
      await ctx.page.evaluate(async () => {
        localStorage.setItem('tradingchart_theme', '"qa-cycle8-marker"');
        const am = window.__TRADING_APP__.auth;
        am._dirty = true;
        await am.pushCloudState?.();
      });
      await new Promise(r => setTimeout(r, 500));
      // reload the page entirely — the cloud pull must restore the marker
      await ctx.page.reload({ waitUntil: 'domcontentloaded' });
      await ctx.page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      const got = await pollUntil(() => ctx.page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        if (!am?.user) return null;
        return localStorage.getItem('tradingchart_theme');
      }), 15000);
      const defects = [];
      if (got !== '"qa-cycle8-marker"') defects.push({ kind: 'sync', text: `theme after reload = ${got}` });
      return { defects };
    }
  },
  mobile: {
    'm01_account_menu_fits_and_anchors': async (ctx) => {
      await registerViaApi(ctx.page, { email: EMAIL.replace('@', '+m@'), username: USERNAME + 'm', password: PASSWORD });
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      const fit = await ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-account-menu');
        const r = m.getBoundingClientRect();
        return { left: r.left, right: r.right, vw: window.innerWidth, inside: r.left >= 0 && r.right <= window.innerWidth + 1 };
      });
      const defects = [];
      if (!fit.inside) defects.push({ kind: 'menu-fit', text: JSON.stringify(fit) });
      await shots(ctx, 'c8_menu_mobile');
      return { defects };
    },

    'm02_all_tabs_fit_mobile': async (ctx) => {
      await loginViaApi(ctx.page, EMAIL.replace('@', '+m@'), PASSWORD);
      const defects = [];
      for (const tab of ['profile', 'account', 'security', 'sessions', 'data']) {
        await openSettings(ctx.page, tab);
        const ok = await pollUntil(() => ctx.page.evaluate(() => {
          const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
          return b && b.innerText.trim().length > 20;
        }));
        if (!ok) { defects.push({ kind: `mtab/${tab}`, text: 'never rendered' }); continue; }
        defects.push(...await modalAudit(ctx, '#tc-account-settings-modal', `mtab/${tab}`));
      }
      await shots(ctx, 'c8_tabs_mobile');
      await ctx.page.evaluate(() => document.querySelector('#tc-account-settings-modal [data-close]')?.click());
      return { defects };
    },

    'm03_fa_full_menu_and_tabs_rtl': async (ctx) => {
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
      await new Promise(r => setTimeout(r, 900));
      await loginViaApi(ctx.page, EMAIL.replace('@', '+m@'), PASSWORD);
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      const menuTxt = await ctx.page.evaluate(() => document.querySelector('#tc-account-menu')?.innerText || '');
      const defects = [];
      for (const needle of ['پروفایل و تنظیمات', 'حساب و صورت‌حساب', 'پلن‌ها', 'دستگاه‌های فعال', 'خروج از حساب']) {
        if (!menuTxt.includes(needle)) defects.push({ kind: 'menu-i18n', text: `missing: ${needle}` });
      }
      const dir = await ctx.page.evaluate(() => document.querySelector('#tc-account-menu')?.dir);
      if (dir !== 'rtl') defects.push({ kind: 'rtl', text: `menu dir=${dir}` });
      // every settings tab in FA
      await ctx.page.evaluate(() => document.querySelector('#tc-account-menu')?.remove());
      for (const tab of ['profile', 'security']) {
        await openSettings(ctx.page, tab);
        await pollUntil(() => ctx.page.evaluate(() => {
          const b = document.querySelector('#tc-account-settings-modal #tc-acc-body');
          return b && b.innerText.trim().length > 20;
        }));
        const leaks = await ctx.page.evaluate((H) => eval('(' + H.untranslated + ')()'), INPAGE);
        const real = leaks.filter(l => l.text && !/^https?:|@|example\.com|TradingChart|YouTube|Facebook|Instagram|X$|123456|•+/.test(l.text));
        for (const l of real.slice(0, 6)) defects.push({ kind: `fa-leak/${tab}`, text: `${l.tag}: ${l.text}` });
      }
      await shots(ctx, 'c8_fa_mobile');
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      return { defects };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle8', tests, {});
})();
