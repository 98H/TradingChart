/**
 * @spec 012
 * @covers FR-013
 */
const { launch, BASE, closeAllBrowsers } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function run() {
  console.log(`[012 Acceptance Suite 05] Running Viewport & Visual Integrity against ${BASE}...`);

  const matrix = [
    { vp: 'desktop', lang: 'fa' },
    { vp: 'desktop', lang: 'en' },
    { vp: 'mobile', lang: 'fa' },
    { vp: 'mobile', lang: 'en' }
  ];

  for (const item of matrix) {
    const { vp, lang } = item;
    console.log(`  Evaluating matrix cell: viewport=${vp}, lang=${lang}...`);
    let ctx = null;

    try {
      ctx = await launch(vp);
      const { page } = ctx;

      const targetUrl = `${BASE}/${lang === 'en' ? '?lang=en' : ''}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll('#plans .plan').length > 0, { timeout: 15000 });

      // ────────────────────────────────────────────────────────────────────────
      // 1. Horizontal Scroll Prevention (FR-013)
      // ────────────────────────────────────────────────────────────────────────
      const scrollDiff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(scrollDiff <= 1,
        `FR-013 [${vp}/${lang}] no horizontal scrollbar`,
        `Horizontal overflow detected: scrollWidth exceeds window.innerWidth by ${scrollDiff}px`);

      // ────────────────────────────────────────────────────────────────────────
      // 2. Corrupt Text Tokens (undefined, NaN, null) (FR-013)
      // ────────────────────────────────────────────────────────────────────────
      const badTextMatch = await page.evaluate(() => {
        const text = document.body.innerText;
        const matches = text.match(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/g);
        return matches ? matches.slice(0, 5) : null;
      });
      assert(!badTextMatch,
        `FR-013 [${vp}/${lang}] no corrupt text tokens`,
        `Corrupt text tokens detected in body: ${JSON.stringify(badTextMatch)}`);

      // ────────────────────────────────────────────────────────────────────────
      // 3. Clipped Text & Box Overflow (FR-013)
      // ────────────────────────────────────────────────────────────────────────
      const clippedElements = await page.evaluate(() => {
        const candidates = [...document.querySelectorAll('h1, h2, h3, p, a.btn, .price, li, summary')];
        return candidates
          .filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible')
          .map(e => e.textContent.trim().slice(0, 40))
          .slice(0, 5);
      });
      assert(clippedElements.length === 0,
        `FR-013 [${vp}/${lang}] no clipped text`,
        `Clipped text elements found: ${clippedElements.join(' | ')}`);

      // ────────────────────────────────────────────────────────────────────────
      // 4. Touch Targets Dimensions (FR-013 on Mobile)
      // ────────────────────────────────────────────────────────────────────────
      if (vp === 'mobile') {
        const smallTouchTargets = await page.evaluate(() => {
          const interactives = [...document.querySelectorAll('a, button, summary')];
          return interactives
            .filter(e => {
              const b = e.getBoundingClientRect();
              return e.getClientRects().length && b.width > 0 && (b.height < 40 || b.width < 40) && !e.classList.contains('skip') && !e.closest('.copy');
            })
            .map(e => `${(e.textContent || '').trim().slice(0, 25)} (${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`)
            .slice(0, 5);
        });
        assert(smallTouchTargets.length === 0,
          `FR-013 [${vp}/${lang}] mobile touch targets >= 40x40px`,
          `Undersized touch targets found: ${smallTouchTargets.join(' | ')}`);

        // Mobile layout behavior: .links hidden and buttons full width
        const mobileLayout = await page.evaluate(() => {
          const links = document.querySelector('.links');
          const heroBtn = document.querySelector('.hero-actions .btn');
          const isLinksHidden = !links || getComputedStyle(links).display === 'none' || links.offsetWidth === 0;
          const heroBtnWidth = heroBtn ? heroBtn.getBoundingClientRect().width : 0;
          return {
            isLinksHidden,
            heroBtnFullWidth: heroBtnWidth >= 300
          };
        });

        assert(mobileLayout.isLinksHidden,
          `FR-013 [${vp}/${lang}] navigation links collapsed on mobile`,
          'Navigation links (.links) are visible on mobile');
        assert(mobileLayout.heroBtnFullWidth,
          `FR-013 [${vp}/${lang}] hero CTA buttons expand on mobile`,
          'Hero CTA button not expanded to mobile column width');
      }

    } finally {
      if (ctx) {
        await ctx.browser.close();
      }
    }
  }

  console.log('[012 Acceptance Suite 05] PASS: All viewport & visual integrity assertions passed across all matrix cells.');
}

run().catch(async err => {
  console.error(`❌ Suite 05 unexpected error: ${err.message}`);
  await closeAllBrowsers();
  process.exit(1);
});
