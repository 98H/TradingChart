/**
 * @spec 012
 * @covers FR-011, FR-012
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, closeAllBrowsers } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

function getMasterKey() {
  if (process.env.TRADINGCHART_MASTER_KEY) return process.env.TRADINGCHART_MASTER_KEY.trim();
  const candidates = [
    path.resolve(__dirname, '../../../server/data/admin_master.key'),
    path.resolve(process.cwd(), 'server/data/admin_master.key')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  return '';
}

// Verified real click: centers target and verifies top element at coordinates using elementFromPoint
async function realClick(page, selector, timeout = 12000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 100));
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
  console.log(`[012 Acceptance Suite 04] Running Browser Landing Navigation & Bilingual against ${BASE}...`);
  let ctx = null;

  try {
    ctx = await launch('desktop');
    const { page } = ctx;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Initial Persian RTL Landing Page & Sections (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  1. Verifying default Persian RTL layout and sections (FR-011)...');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });

    const initialLang = await page.evaluate(() => document.documentElement.lang);
    const initialDir = await page.evaluate(() => document.documentElement.dir);
    assert(initialLang === 'fa', 'FR-011 default document lang is fa', `Expected fa, got ${initialLang}`);
    assert(initialDir === 'rtl', 'FR-011 default document dir is rtl', `Expected rtl, got ${initialDir}`);

    const sections = await page.evaluate(() => ({
      topNav: !!document.querySelector('#top'),
      hero: !!document.querySelector('.hero'),
      features: !!document.querySelector('#features'),
      markets: !!document.querySelector('#markets'),
      pricing: !!document.querySelector('#pricing'),
      faq: !!document.querySelector('#faq'),
      ctaBand: !!document.querySelector('.cta-band'),
      footer: !!document.querySelector('.foot'),
      main: !!document.querySelector('#main')
    }));

    assert(sections.topNav, 'FR-011 #top navigation section present', 'Missing #top');
    assert(sections.hero, 'FR-011 .hero section present', 'Missing .hero');
    assert(sections.features, 'FR-011 #features section present', 'Missing #features');
    assert(sections.markets, 'FR-011 #markets section present', 'Missing #markets');
    assert(sections.pricing, 'FR-011 #pricing section present', 'Missing #pricing');
    assert(sections.faq, 'FR-011 #faq section present', 'Missing #faq');
    assert(sections.ctaBand, 'FR-011 .cta-band section present', 'Missing .cta-band');
    assert(sections.footer, 'FR-011 .foot section present', 'Missing .foot');
    assert(sections.main, 'FR-011 #main landmark present', 'Missing #main');

    // Skip to main content link
    const skipHref = await page.$eval('.skip', el => el.getAttribute('href')).catch(() => null);
    assert(skipHref === '#main', 'FR-011 skip link targets #main', `Expected #main, got ${skipHref}`);

    await page.focus('.skip');
    const skipTop = await page.evaluate(() => getComputedStyle(document.querySelector('.skip')).top);
    assert(skipTop !== '-60px' && parseInt(skipTop, 10) >= 0,
      'FR-011 skip link visible on focus', `Skip link did not move into view: ${skipTop}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Native Expandable FAQ Accordion (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  2. Verifying native FAQ accordion interaction (FR-011)...');
    const firstFaqDetails = '#faq details';
    const firstFaqSummary = '#faq details summary';

    const initiallyOpen = await page.$eval(firstFaqDetails, el => el.open);
    assert(!initiallyOpen, 'FR-011 FAQ details initially closed', 'FAQ was open before interaction');

    await realClick(page, firstFaqSummary);
    await page.waitForFunction(() => document.querySelector('#faq details').open === true, { timeout: 3000 });
    const openedState = await page.$eval(firstFaqDetails, el => el.open);
    assert(openedState === true, 'FR-011 FAQ details expands on click', 'FAQ details did not open');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Dynamic Pricing Hydration & Plus Plan Highlight (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  3. Verifying dynamic plan rendering and plus highlight (FR-012)...');
    await page.waitForSelector('#plans .plan', { timeout: 10000 });
    const plansCount = await page.$$eval('#plans .plan', els => els.length);
    assert(plansCount >= 3, 'FR-012 pricing plans rendered from API', `Expected >= 3 plans, got ${plansCount}`);

    // Plus plan styling & badge
    const plusPlanInfo = await page.evaluate(() => {
      const plusEl = document.querySelector('.plan.pop');
      if (!plusEl) return null;
      const badge = plusEl.querySelector('.badge');
      return {
        hasPop: true,
        badgeText: badge ? badge.textContent.trim() : null
      };
    });
    assert(plusPlanInfo && plusPlanInfo.hasPop,
      'FR-012 plus plan highlighted with .pop', 'Missing .plan.pop on plus plan');
    assert(plusPlanInfo.badgeText === 'محبوب‌ترین' || plusPlanInfo.badgeText === 'Most popular',
      'FR-012 plus plan badge text localized', `Unexpected badge text: ${plusPlanInfo.badgeText}`);

    // Check CTAs lead to /chart
    const planCtaHrefs = await page.$$eval('#plans .plan a.btn', els => els.map(e => e.getAttribute('href')));
    assert(planCtaHrefs.length > 0 && planCtaHrefs.every(h => h === '/chart'),
      'FR-012 all plan CTAs link to /chart', `Unexpected CTAs: ${JSON.stringify(planCtaHrefs)}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Billing Cycle Switcher (Monthly vs Yearly) (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  4. Verifying billing cycle toggle updates prices (FR-012)...');
    const monthlyPrices = await page.$$eval('#plans .price', els => els.map(e => e.textContent.trim()));
    const initialCycleMOn = await page.$eval('.cyc[data-cycle="m"]', el => el.classList.contains('on'));
    assert(initialCycleMOn, 'FR-012 monthly cycle active initially with .on class', 'Expected .on class on monthly cycle');

    // Switch to Yearly
    await realClick(page, '.cyc[data-cycle="y"]');
    await page.waitForFunction(() => document.querySelector('.cyc[data-cycle="y"]').getAttribute('aria-pressed') === 'true', { timeout: 3000 });
    const yearlyCyclePressed = await page.$eval('.cyc[data-cycle="y"]', el => el.getAttribute('aria-pressed'));
    const monthlyCyclePressed = await page.$eval('.cyc[data-cycle="m"]', el => el.getAttribute('aria-pressed'));
    assert(yearlyCyclePressed === 'true', 'FR-012 yearly cycle aria-pressed="true"', `Got ${yearlyCyclePressed}`);
    assert(monthlyCyclePressed === 'false', 'FR-012 monthly cycle aria-pressed="false"', `Got ${monthlyCyclePressed}`);

    const yearlyPrices = await page.$$eval('#plans .price', els => els.map(e => e.textContent.trim()));
    assert(yearlyPrices.join('|') !== monthlyPrices.join('|'),
      'FR-012 yearly cycle updates displayed plan prices',
      `Prices remained identical: ${yearlyPrices.join(' vs ')}`);

    // Switch back to Monthly
    await realClick(page, '.cyc[data-cycle="m"]');
    await page.waitForFunction(() => document.querySelector('.cyc[data-cycle="m"]').getAttribute('aria-pressed') === 'true', { timeout: 3000 });
    const restoredMonthlyPrices = await page.$$eval('#plans .price', els => els.map(e => e.textContent.trim()));
    assert(restoredMonthlyPrices.join('|') === monthlyPrices.join('|'),
      'FR-012 monthly prices restored cleanly', 'Monthly prices did not restore');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Bilingual Switching & Round-Trip Lossless Restoration (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  5. Verifying bilingual toggle and localStorage persistence (FR-011)...');
    const persianHeroH1 = await page.$eval('h1', el => el.textContent.trim());
    const persianTitle = await page.title();

    // Click language toggle to switch to English
    await realClick(page, '#lang-toggle');
    await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 5000 });

    const enLang = await page.evaluate(() => document.documentElement.lang);
    const enDir = await page.evaluate(() => document.documentElement.dir);
    const enHeroH1 = await page.$eval('h1', el => el.textContent.trim());
    const enTitle = await page.title();

    assert(enLang === 'en', 'FR-011 switched lang="en"', `Expected en, got ${enLang}`);
    assert(enDir === 'ltr', 'FR-011 switched dir="ltr"', `Expected ltr, got ${enDir}`);
    assert(enHeroH1 !== persianHeroH1, 'FR-011 hero heading translated to English', `Heading did not change`);
    assert(enTitle !== persianTitle, 'FR-011 document title translated to English', `Title did not change`);

    // Verify localStorage persistence under tradingchart_user_settings
    const storedSettings = await page.evaluate(() => localStorage.getItem('tradingchart_user_settings'));
    assert(storedSettings && JSON.parse(storedSettings).language === 'en',
      'FR-011 language selection persisted to localStorage',
      `Expected language "en" in settings, got: ${storedSettings}`);

    // Verify toggle button label switched to "فا" with aria-label "فارسی"
    const toggleButtonState = await page.$eval('#lang-toggle', el => ({
      text: el.textContent.trim(),
      ariaLabel: el.getAttribute('aria-label')
    }));
    assert(toggleButtonState.text === 'فا', 'FR-011 toggle button shows "فا" in English mode', `Got ${toggleButtonState.text}`);
    assert(toggleButtonState.ariaLabel === 'فارسی', 'FR-011 toggle button aria-label="فارسی"', `Got ${toggleButtonState.ariaLabel}`);

    // Toggle back to Persian and verify lossless restoration
    await realClick(page, '#lang-toggle');
    await page.waitForFunction(() => document.documentElement.lang === 'fa', { timeout: 5000 });

    const restoredLang = await page.evaluate(() => document.documentElement.lang);
    const restoredDir = await page.evaluate(() => document.documentElement.dir);
    const restoredHeroH1 = await page.$eval('h1', el => el.textContent.trim());
    const restoredTitle = await page.title();

    assert(restoredLang === 'fa', 'FR-011 restored lang="fa"', `Got ${restoredLang}`);
    assert(restoredDir === 'rtl', 'FR-011 restored dir="rtl"', `Got ${restoredDir}`);
    assert(restoredHeroH1 === persianHeroH1, 'FR-011 hero heading restored losslessly', `Heading mismatch: ${restoredHeroH1}`);
    assert(restoredTitle === persianTitle, 'FR-011 document title restored losslessly', `Title mismatch: ${restoredTitle}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Navigation CTA to /chart and Language Continuity (FR-011, FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  6. Verifying CTA navigation to /chart with language carry-over (FR-011)...');
    // Set to English again to verify carry-over to /chart
    await realClick(page, '#lang-toggle');
    await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 5000 });

    // Scroll to top and click primary CTA button
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 200));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      realClick(page, '.hero-actions .btn-primary')
    ]);

    const targetUrl = new URL(page.url());
    assert(targetUrl.pathname === '/chart',
      'FR-011 CTA navigated to /chart', `Expected /chart, got ${targetUrl.pathname}`);

    // Verify /chart boots with language carried over from landing
    await page.waitForFunction(() => !!window.__TRADING_APP__ || !!document.querySelector('.brand-mark'), { timeout: 25000 });
    const appLang = await page.evaluate(() => document.documentElement.lang);
    assert(appLang === 'en', 'FR-011 /chart inherited English language preference', `Expected en, got ${appLang}`);

    // Brand mark link navigates back to landing /
    const brandMarkHref = await page.$eval('.brand-mark', el => el.getAttribute('href')).catch(() => null);
    assert(brandMarkHref === '/', 'FR-011 brand mark links back to /', `Expected /, got ${brandMarkHref}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Error Note Display When Plan Loading Fails (FR-012 Edge Case)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  7. Verifying localized error note on plan fetch failure (FR-012)...');
    const errPage = await ctx.browser.newPage();
    try {
      await errPage.setRequestInterception(true);
      errPage.on('request', req => {
        if (req.url().includes('/api/plans')) {
          req.abort('failed');
        } else {
          req.continue();
        }
      });
      await errPage.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
      await errPage.waitForSelector('#plans .note', { timeout: 8000 });
      const errorNoteText = await errPage.$eval('#plans .note', el => el.textContent.trim());
      assert(errorNoteText.includes('بارگذاری قیمت‌ها ممکن نشد') || errorNoteText.includes('Pricing could not be loaded'),
        'FR-012 localized error note shown on plans failure',
        `Unexpected error note text: ${errorNoteText}`);
    } finally {
      await errPage.close();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Admin vs Anonymous Role Filtering on /api/plans (FR-012 Edge Case)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('  8. Verifying /api/plans caller role filtering (FR-012)...');
    const anonRes = await fetch(`${BASE}/api/plans`);
    const anonData = await anonRes.json();
    assert(anonData.ok === true && anonData.isAdmin === false,
      'FR-012 anonymous /api/plans isAdmin is false', `Got ${anonData.isAdmin}`);

    const masterKey = getMasterKey();
    if (masterKey) {
      const adminAuthRes = await fetch(`${BASE}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey })
      });
      const cookie = adminAuthRes.headers.get('set-cookie');
      if (cookie) {
        const adminPlansRes = await fetch(`${BASE}/api/plans`, {
          headers: { Cookie: cookie.split(';')[0] }
        });
        const adminData = await adminPlansRes.json();
        assert(adminData.ok === true && adminData.isAdmin === true,
          'FR-012 admin /api/plans isAdmin is true', `Got ${adminData.isAdmin}`);
      }
    }

  } finally {
    if (ctx) {
      await ctx.browser.close();
    }
  }

  console.log('[012 Acceptance Suite 04] PASS: All browser landing navigation & bilingual assertions passed.');
}

run().catch(async err => {
  console.error(`❌ Suite 04 unexpected error: ${err.message}`);
  await closeAllBrowsers();
  process.exit(1);
});
