/**
 * @spec 008
 * @covers FR-011, FR-012, FR-013
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise(r => setTimeout(r, 150));
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('[008 Panels, Mobile & Bilingual Suite] Starting verification...');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Desktop Mode: Multi-Surface Panels & Entitlement Gating (FR-011)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  1. Running Desktop Mode (1440x900)...');
    const ctx = await launch('desktop');
    const { page } = ctx;

    try {
      await boot(ctx, { settle: 3000 });

      // 1.1 Bottom panel tabs exist for Trackers, Calendar and News
      const tabsCheck = await page.evaluate(() => {
        const q = s => !!document.querySelector(s);
        return {
          hasTrackers: q('#bottom-panel .panel-tab[data-view="trackers"]'),
          hasCalendar: q('#bottom-panel .panel-tab[data-view="calendar"]'),
          hasNews: q('#bottom-panel .panel-tab[data-view="news"]'),
          hasGold: q('#bottom-panel .panel-tab[data-view="gold"]'),
          hasTse: q('#bottom-panel .panel-tab[data-view="tse"]')
        };
      });

      assert(tabsCheck.hasTrackers, 'FR-011 trackers available as bottom panel tab', 'Missing trackers bottom tab');
      assert(tabsCheck.hasCalendar, 'FR-011 calendar available as bottom panel tab', 'Missing calendar bottom tab');
      assert(tabsCheck.hasNews, 'FR-011 news available as bottom panel tab', 'Missing news bottom tab');
      assert(tabsCheck.hasGold && tabsCheck.hasTse, 'FR-011 gold and tse available as bottom panel tabs', 'Missing gold/tse tab');

      // 1.2 Side-dock vertical rail buttons exist
      const railCheck = await page.evaluate(() => {
        const q = s => !!document.querySelector(s);
        return {
          hasCalendarRail: q('.rail-btn[data-panel="calendar"]'),
          hasNewsRail: q('.rail-btn[data-panel="news"]'),
          hasGoldRail: q('.rail-btn[data-panel="gold"]'),
          hasTseRail: q('.rail-btn[data-panel="tse"]')
        };
      });

      assert(railCheck.hasCalendarRail, 'FR-011 calendar available as side-dock rail button', 'Missing calendar rail button');
      assert(railCheck.hasNewsRail, 'FR-011 news available as side-dock rail button', 'Missing news rail button');

      // 1.3 Open Calendar from right-dock rail
      await realClick(page, '.rail-btn[data-panel="calendar"]');
      await page.waitForFunction(() => {
        return !!document.querySelector('.vela-panel-calendar .calendar-panel-wrapper') ||
               !!document.querySelector('.vela-panel-calendar .cal-event-row');
      }, { timeout: 6000 });

      const calDockMounted = await page.evaluate(() => {
        const p = document.querySelector('.vela-panel-calendar');
        return !!p && getComputedStyle(p).display !== 'none';
      });
      assert(calDockMounted, 'FR-011 side-dock calendar mounts EconomicCalendarView', 'Calendar side panel failed to mount');

      // 1.4 Open News from right-dock rail
      await realClick(page, '.rail-btn[data-panel="news"]');
      await page.waitForFunction(() => {
        return !!document.querySelector('.vela-panel-news .news-feed-card') ||
               !!document.querySelector('.vela-panel-news');
      }, { timeout: 6000 });

      const newsDockMounted = await page.evaluate(() => {
        const p = document.querySelector('.vela-panel-news');
        return !!p && getComputedStyle(p).display !== 'none';
      });
      assert(newsDockMounted, 'FR-011 side-dock news mounts MarketNewsView', 'News side panel failed to mount');

      // 1.5 Plan Entitlement Gating: Feature Locked Card (FR-011, US6 Scenario 1)
      const gatingResult = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const origFeature = app.auth?.feature;

        // Simulate plan lacking marketTrackers, economicCalendar, and marketNews
        app.auth.feature = (k) => false;

        const bodyTrackers = document.createElement('div');
        app.mountMarketTrackers(bodyTrackers);
        const trLocked = bodyTrackers.querySelector('.tc-feature-locked');
        const trBtn = bodyTrackers.querySelector('.tc-upgrade-btn');

        const bodyCal = document.createElement('div');
        app.mountEconomicCalendar(bodyCal);
        const calLocked = bodyCal.querySelector('.tc-feature-locked');
        const calBtn = bodyCal.querySelector('.tc-upgrade-btn');

        const bodyNews = document.createElement('div');
        app.mountMarketNews(bodyNews);
        const newsLocked = bodyNews.querySelector('.tc-feature-locked');
        const newsBtn = bodyNews.querySelector('.tc-upgrade-btn');

        // Restore auth
        app.auth.feature = origFeature;

        return {
          trackersLocked: !!trLocked && !!trBtn,
          calLocked: !!calLocked && !!calBtn,
          newsLocked: !!newsLocked && !!newsBtn,
          hasUpgradeText: trLocked?.innerText?.includes('Upgrade') || trLocked?.innerText?.includes('ارتقا')
        };
      });

      assert(gatingResult.trackersLocked, 'FR-011 locked upgrade card rendered for marketTrackers', 'Missing upgrade card');
      assert(gatingResult.calLocked, 'FR-011 locked upgrade card rendered for economicCalendar', 'Missing upgrade card');
      assert(gatingResult.newsLocked, 'FR-011 locked upgrade card rendered for marketNews', 'Missing upgrade card');
      assert(gatingResult.hasUpgradeText, 'FR-011 upgrade card displays upgrade CTA button', 'Missing upgrade button');

      // ────────────────────────────────────────────────────────────────────────
      // 2. Bilingual Parity & Persian RTL Correctness (FR-013, SC-004)
      // ────────────────────────────────────────────────────────────────────────
      console.log('  2. Verifying Persian RTL Parity across all 5 views...');
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await page.waitForFunction(() => {
        const dir = document.documentElement.getAttribute('dir') || document.body.getAttribute('dir');
        return dir === 'rtl';
      }, { timeout: 6000 });

      const faReport = await page.evaluate(async () => {
        const app = window.__TRADING_APP__;
        const htmlDir = document.documentElement.getAttribute('dir') || document.body.getAttribute('dir');

        // Trackers in Persian
        app.switchBottomView('trackers');
        await new Promise(r => setTimeout(r, 400));
        const trText = document.querySelector('#view-trackers')?.innerText || '';

        // Calendar in Persian
        app.switchBottomView('calendar');
        await new Promise(r => setTimeout(r, 400));
        const calText = document.querySelector('#view-calendar')?.innerText || '';

        // News in Persian
        app.switchBottomView('news');
        await new Promise(r => setTimeout(r, 400));
        const newsText = document.querySelector('#view-news')?.innerText || '';

        // Gold in Persian
        app.switchBottomView('gold');
        await new Promise(r => setTimeout(r, 400));
        const goldText = document.querySelector('#view-gold')?.innerText || '';

        // TSE in Persian
        app.switchBottomView('tse');
        await new Promise(r => setTimeout(r, 400));
        const tseText = document.querySelector('#view-tse')?.innerText || '';

        return {
          htmlDir,
          trFa: trText.includes('کنگره') || trText.includes('مدیران') || trText.includes('پرتفوی'),
          calFa: calText.includes('تورم') || calText.includes('بانک') || calText.includes('رویداد'),
          newsFa: newsText.includes('بیت‌کوین') || newsText.includes('کریپتو') || newsText.includes('جهش'),
          goldFa: goldText.includes('آبشده') || goldText.includes('طلا') || goldText.includes('سکه'),
          tseFa: tseText.includes('فولاد') || tseText.includes('حقیقی') || tseText.includes('تابلوخوانی')
        };
      });

      assert(faReport.htmlDir === 'rtl', 'FR-013 Persian layout has dir=rtl', `Expected dir=rtl, got ${faReport.htmlDir}`);
      assert(faReport.trFa, 'FR-013 Trackers view localized in Persian', 'Missing Persian text in Trackers');
      assert(faReport.calFa, 'FR-013 Calendar view localized in Persian', 'Missing Persian text in Calendar');
      assert(faReport.newsFa, 'FR-013 News view localized in Persian', 'Missing Persian text in News');
      assert(faReport.goldFa, 'FR-013 Gold view localized in Persian', 'Missing Persian text in Gold');
      assert(faReport.tseFa, 'FR-013 TSE view localized in Persian', 'Missing Persian text in TSE');

    } finally {
      await ctx.browser.close();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Mobile Viewport (<= 768px): Panels Menu for Gold & TSE (FR-012)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  3. Running Mobile Mode (390x844)...');
    const mCtx = await launch('mobile');
    const { page } = mCtx;

    try {
      await boot(mCtx, { settle: 3000 });

      // 3.1 Open mobile panels menu (US6 Scenario 2)
      await realClick(page, '#nav-btn-panels');
      await page.waitForFunction(() => document.querySelector('#modal-panels-menu')?.classList.contains('open'), { timeout: 6000 });

      const menuState = await page.evaluate(() => {
        const menu = document.querySelector('#modal-panels-menu');
        const items = Array.from(menu.querySelectorAll('.panel-menu-item')).map(i => i.innerText.trim());
        return {
          isOpen: menu.classList.contains('open'),
          hasGoldItem: items.some(t => t.includes('Gold') || t.includes('طلا')),
          hasTseItem: items.some(t => t.includes('Bourse') || t.includes('Tape') || t.includes('بورس'))
        };
      });

      assert(menuState.isOpen, 'FR-012 mobile panels menu drawer opened', 'Menu drawer not open');
      assert(menuState.hasGoldItem, 'FR-012 mobile panels menu contains Gold option', 'Missing Gold menu item');
      assert(menuState.hasTseItem, 'FR-012 mobile panels menu contains TSE option', 'Missing TSE menu item');

      // 3.2 Select Tehran Gold & Bubbles from mobile menu
      const goldItemHandle = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item'))
          .find(el => el.innerText.includes('Gold') || el.innerText.includes('طلا'));
      });
      await goldItemHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await new Promise(r => setTimeout(r, 150));
      const goldBox = await goldItemHandle.boundingBox();
      await page.mouse.click(goldBox.x + goldBox.width / 2, goldBox.y + goldBox.height / 2);

      await page.waitForFunction(() => {
        const bp = document.querySelector('#bottom-panel');
        const vg = document.querySelector('#view-gold');
        const menu = document.querySelector('#modal-panels-menu');
        return bp && !bp.classList.contains('collapsed') && vg && vg.classList.contains('active') &&
               menu && !menu.classList.contains('open');
      }, { timeout: 6000 });

      const goldViewOpened = await page.evaluate(() => {
        const bp = document.querySelector('#bottom-panel');
        const vg = document.querySelector('#view-gold');
        return bp && !bp.classList.contains('collapsed') && vg && vg.classList.contains('active');
      });
      assert(goldViewOpened, 'FR-012 selecting Gold from mobile panels menu opens Gold bottom view',
        'Gold view failed to activate on mobile');

      // 3.3 Reopen panels menu and select Iran Bourse & Tape (TSE)
      await realClick(page, '#nav-btn-panels');
      await page.waitForFunction(() => document.querySelector('#modal-panels-menu')?.classList.contains('open'), { timeout: 6000 });

      const tseItemHandle = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item'))
          .find(el => el.innerText.includes('Bourse') || el.innerText.includes('Tape') || el.innerText.includes('بورس'));
      });
      await tseItemHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await new Promise(r => setTimeout(r, 150));
      const tseBox = await tseItemHandle.boundingBox();
      await page.mouse.click(tseBox.x + tseBox.width / 2, tseBox.y + tseBox.height / 2);

      await page.waitForFunction(() => {
        const bp = document.querySelector('#bottom-panel');
        const vt = document.querySelector('#view-tse');
        const menu = document.querySelector('#modal-panels-menu');
        return bp && !bp.classList.contains('collapsed') && vt && vt.classList.contains('active') &&
               menu && !menu.classList.contains('open');
      }, { timeout: 6000 });

      const tseViewOpened = await page.evaluate(() => {
        const bp = document.querySelector('#bottom-panel');
        const vt = document.querySelector('#view-tse');
        return bp && !bp.classList.contains('collapsed') && vt && vt.classList.contains('active');
      });
      assert(tseViewOpened, 'FR-012 selecting TSE from mobile panels menu opens TSE bottom view',
        'TSE view failed to activate on mobile');

    } finally {
      await mCtx.browser.close();
    }
  }

  console.log('✅ [008 Panels, Mobile & Bilingual Suite] All scenarios passed with verified desktop rails, mobile drawer, gating, and RTL parity.');
}

run().catch(err => {
  console.error(`❌ Suite unhandled error: ${err.stack || err.message}`);
  process.exit(1);
});
