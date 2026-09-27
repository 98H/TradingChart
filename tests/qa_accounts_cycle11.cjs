// tests/qa_accounts_cycle11.cjs — Last-hunter exploratory cycle.
// Places previous cycles never looked: legacy profile modal while signed in,
// guest menu FA mobile, plans modal mobile fit, session list edge cases,
// verification banner flows, language flip with open account modals.
const { launch, boot, auditStatic, shots, runSuite, INPAGE, BASE, awaitRegisterWindow } = require('./qa_lib.cjs');

const TS = Date.now().toString(36);
const EMAIL = `c11_${TS}@qa.test`;
const USERNAME = `c11user_${TS}`;
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

async function authLogin(page, identity, password = PASSWORD) {
  return page.evaluate(async ({ identity, password }) => {
    const am = window.__TRADING_APP__.auth;
    const r = await am.login({ identity, password });
    return { ok: r.ok, user: am.user?.username || null };
  }, { identity, password });
}

const tests = {
  desktop: {
    '01_setup': async (ctx) => {
      const r = await ctx.page.evaluate(async ({ email, username }) => {
        const am = window.__TRADING_APP__.auth;
        return am.register({ email, username, password: 'QaPass1234', displayName: 'QA Eleven' });
      }, { email: EMAIL, username: USERNAME });
      const defects = [];
      if (!r.ok) defects.push({ kind: 'setup', text: JSON.stringify(r.data) });
      return { defects };
    },

    '02_legacy_profile_modal_coexists_with_account': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      // open the legacy profile modal (menu → profile) and confirm it renders
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountMenu());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      await ctx.page.evaluate(() => document.querySelector('#tc-account-menu [data-act="profile"]')?.click());
      const opened = await pollUntil(() => ctx.page.evaluate(() => {
        const m = document.querySelector('#modal-user-profile');
        return m && (m.classList.contains('open') || getComputedStyle(m).display !== 'none') && m.innerText.length > 50;
      }));
      const defects = [];
      if (!opened) defects.push({ kind: 'profile-modal', text: 'legacy profile modal never opened from menu' });
      // account avatar must show inside it consistently
      const av = await ctx.page.evaluate(() => document.querySelector('#modal-user-profile')?.innerText || '');
      if (opened && !/🦾|QA Eleven|نکسوس/.test(av)) defects.push({ kind: 'profile-modal', text: 'profile modal content suspicious' });
      const audit = await auditStatic(ctx);
      if (audit.horizontalOverflow.length) defects.push({ kind: 'profile-modal/overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      await shots(ctx, 'c11_legacy_profile_modal');
      // close it
      await ctx.page.evaluate(() => document.querySelector('#modal-user-profile .close-btn, #modal-user-profile [data-close]')?.click());
      return { defects };
    },

    '03_language_flip_with_open_settings_modal': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountSettingsModal('profile'));
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('input[name="pf-username"]')));
      // flip to FA while the modal is open
      await ctx.page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await new Promise(r => setTimeout(r, 800));
      const txt = await ctx.page.evaluate(() => document.querySelector('#tc-acc-body')?.innerText || '');
      const defects = [];
      // The open modal should either live-translate or be re-rendered; stale EN
      // strings inside an FA document are a defect.
      if (/Public identity|About me|Save profile/.test(txt) && !/هویت عمومی/.test(txt)) {
        defects.push({ kind: 'live-i18n', text: 'open settings modal stayed English after FA switch' });
      }
      await ctx.page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      return { defects };
    },

    '04_verify_banner_flow_from_menu': async (ctx) => {
      // EMAIL user is unverified; the menu must offer verify, and clicking it
      // opens the verify modal with a code field.
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openAccountMenu());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      const hasVerify = await ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu [data-act="verify"]'));
      const defects = [];
      if (!hasVerify) defects.push({ kind: 'verify', text: 'unverified user menu lacks verify entry' });
      if (hasVerify) {
        await ctx.page.evaluate(() => document.querySelector('#tc-account-menu [data-act="verify"]')?.click());
        const opened = await pollUntil(() => ctx.page.evaluate(() => {
          const m = [...document.querySelectorAll('.modal-overlay')].find(x => /code|کد/i.test(x.innerText) && x.querySelector('input'));
          return !!m;
        }));
        if (!opened) defects.push({ kind: 'verify', text: 'verify modal never opened' });
        await shots(ctx, 'c11_verify_modal');
      }
      return { defects };
    },

    '05_plans_modal_mobile_grid_desktop_scroll': async (ctx) => {
      await authLogin(ctx.page, EMAIL);
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plans-modal')));
      const audit = await auditStatic(ctx);
      const defects = [];
      if (audit.horizontalOverflow.length) defects.push({ kind: 'plans/overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      const fit = await ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-plans-modal .modal-box');
        const r = b.getBoundingClientRect();
        return { w: r.width, vw: window.innerWidth, fits: r.width <= window.innerWidth };
      });
      if (!fit.fits) defects.push({ kind: 'plans/fit', text: JSON.stringify(fit) });
      // matrix table must be horizontally scrollable, not page-breaking
      const tableScroll = await ctx.page.evaluate(() => {
        const wrap = document.querySelector('#tc-plans-modal table')?.closest('div');
        return wrap ? getComputedStyle(wrap).overflowX : 'missing';
      });
      if (!['auto', 'scroll'].includes(tableScroll)) defects.push({ kind: 'plans/table', text: `table wrap overflowX=${tableScroll}` });
      await ctx.page.evaluate(() => document.querySelector('#tc-plans-modal [data-close]')?.click());
      return { defects };
    },

    '06_concurrent_login_two_tabs_same_user': async (ctx) => {
      // Same account in a second tab (same browser → same cookie jar): both
      // must be functional; a state write from tab A must be pulled by tab B.
      await authLogin(ctx.page, EMAIL);
      const page2 = await ctx.browser.newPage();
      await page2.setViewport(ctx.viewport);
      await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page2.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      const bUser = await page2.evaluate(() => window.__TRADING_APP__?.auth?.user?.username || null);
      const defects = [];
      if (bUser !== USERNAME) defects.push({ kind: 'multitab', text: `tab B user=${bUser}` });
      // tab A writes a marker; tab B pulls it
      await ctx.page.evaluate(async () => {
        const am = window.__TRADING_APP__.auth;
        localStorage.setItem('tradingchart_theme', '"tabA-marker"');
        am._dirty = true;
        await am.pushCloudState({ force: true });
      });
      await page2.evaluate(async () => { await window.__TRADING_APP__.auth.pullCloudState(); });
      const bTheme = await page2.evaluate(() => localStorage.getItem('tradingchart_theme'));
      if (bTheme !== '"tabA-marker"') defects.push({ kind: 'multitab', text: `tab B theme=${bTheme}` });
      await page2.close();
      return { defects, ignoreConsole: 'Failed to load resource' };
    }
  },
  mobile: {
    'm01_guest_menu_fa_mobile_complete': async (ctx) => {
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
      await new Promise(r => setTimeout(r, 900));
      // ensure guest
      await ctx.page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.renderAccountBadge());
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu')));
      const txt = await ctx.page.evaluate(() => document.querySelector('#tc-account-menu')?.innerText || '');
      const defects = [];
      for (const needle of ['ورود', 'ایجاد حساب رایگان', 'مقایسه پلن‌ها']) {
        if (!txt.includes(needle)) defects.push({ kind: 'guest-fa', text: `missing: ${needle}` });
      }
      const fit = await ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-account-menu');
        const r = m.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth + 1;
      });
      if (!fit) defects.push({ kind: 'guest-fa/fit', text: 'menu escapes viewport' });
      await shots(ctx, 'c11_guest_menu_fa_mobile');
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      return { defects };
    },

    'm02_plans_modal_mobile_fits_and_scrolls': async (ctx) => {
      await ctx.page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
      await ctx.page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
      await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plans-modal')));
      const fit = await ctx.page.evaluate(() => {
        const b = document.querySelector('#tc-plans-modal .modal-box');
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), vw: window.innerWidth, fits: r.width <= window.innerWidth };
      });
      const audit = await auditStatic(ctx);
      const defects = [];
      if (!fit.fits) defects.push({ kind: 'plans-mobile/fit', text: JSON.stringify(fit) });
      if (audit.horizontalOverflow.length) defects.push({ kind: 'plans-mobile/overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      // all 5 tier cards reachable via scroll inside the modal
      const tiers = await ctx.page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        return ['Basic', 'Essential', 'Plus', 'Premium', 'Ultimate'].filter(t => m.innerText.includes(t)).length;
      });
      if (tiers < 5) defects.push({ kind: 'plans-mobile/tiers', text: `${tiers} tiers visible` });
      await shots(ctx, 'c11_plans_mobile');
      return { defects };
    },

    'm03_signed_in_menu_fa_has_all_entries': async (ctx) => {
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
      await new Promise(r => setTimeout(r, 900));
      const login = await authLogin(ctx.page, EMAIL);
      if (!login.ok) return { defects: [{ kind: 'menu-fa', text: `login failed: ${JSON.stringify(login)}` }] };
      // A signed-in menu is only possible once the badge flips to auth=in;
      // opening earlier races the post-login cloud pull and renders guest items.
      const badgeIn = await pollUntil(() => ctx.page.evaluate(() =>
        document.querySelector('.user-avatar-badge')?.dataset.auth === 'in'), 10000);
      if (!badgeIn) return { defects: [{ kind: 'menu-fa', text: 'badge never flipped to signed-in' }] };
      await ctx.page.evaluate(() => document.querySelector('.user-avatar-badge')?.click());
      const menuUp = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-account-menu [data-act="logout"]')));
      if (!menuUp) {
        const d = await ctx.page.evaluate(() => ({
          txt: (document.querySelector('#tc-account-menu')?.innerText || 'NO MENU').slice(0, 150),
          lang: document.documentElement.lang,
          user: window.__TRADING_APP__?.auth?.user?.username || null,
          stored: (JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}')).language
        }));
        return { defects: [{ kind: 'menu-fa/open', text: JSON.stringify(d) }] };
      }
      const dbg = await ctx.page.evaluate(() => ({
        text: (document.querySelector('#tc-account-menu')?.innerText || '').slice(0, 200),
        htmlHead: (document.querySelector('#tc-account-menu')?.innerHTML || '').slice(0, 200),
        lang: document.documentElement.lang,
        user: window.__TRADING_APP__?.auth?.user?.username || null,
        storedLang: (JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}')).language,
        badgeAuth: document.querySelector('.user-avatar-badge')?.dataset.auth
      }));
      console.log('      [m03 debug]', JSON.stringify(dbg));
      const txt = dbg.text;
      const defects = [];
      if (!/تنظیمات|Settings/.test(txt)) defects.push({ kind: 'menu-fa/diag', text: JSON.stringify(dbg) });
      for (const needle of ['پروفایل و تنظیمات', 'حساب و صورت‌حساب', 'پلن‌ها و ارتقا', 'دستگاه‌های فعال', 'همگام‌سازی', 'خروج از حساب']) {
        if (!txt.includes(needle)) defects.push({ kind: 'menu-fa', text: `missing: ${needle}` });
      }
      await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('en'));
      return { defects, ignoreConsole: 'Failed to load resource' };
    }
  }
};

(async () => {
  await awaitRegisterWindow();
  await runSuite('accounts_cycle11', tests, {});
})();
