/**
 * @spec 003
 * @covers FR-013, FR-014
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
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className, topOuter: top?.outerHTML?.slice(0, 100) };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  // ──────────────────────────────────────────────────────────────────────────
  // Part 1: Mobile Viewport Verification (FR-013)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const mobileCtx = await launch('mobile');
    const { page } = mobileCtx;

    try {
      await boot(mobileCtx);

      // Verify floating toolbar is hidden on mobile (width <= 768 px)
      const toolbarDisplay = await page.evaluate(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb ? getComputedStyle(tb).display : 'none';
      });
      assert(toolbarDisplay === 'none', 'FR-013 floating toolbar hidden on mobile',
        `Expected display "none", got ${toolbarDisplay}`);

      // Open drawing tools library on mobile via app API
      await page.evaluate(() => window.__TRADING_APP__?.drawingToolsLibrary?.open());
      await page.waitForSelector('#drawing-tools-modal.open', { visible: true, timeout: 5000 });

      // Verify library modal fills mobile viewport and causes zero horizontal overflow
      const mobileLayout = await page.evaluate(() => {
        const box = document.querySelector('.dtl-box');
        const boxRect = box ? box.getBoundingClientRect() : null;
        const vw = document.documentElement.clientWidth;
        const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return {
          boxWidth: boxRect?.width,
          vw,
          hasOverflow
        };
      });
      assert(!mobileLayout.hasOverflow, 'FR-013 mobile page horizontal overflow',
        'Horizontal overflow detected with library dialog open on mobile');
      assert(mobileLayout.boxWidth <= mobileLayout.vw + 1, 'FR-013 library box width fits viewport',
        `Box width ${mobileLayout.boxWidth} exceeds viewport ${mobileLayout.vw}`);

      // Arm a drawing tool on mobile through library selection
      await page.evaluate(() => {
        window.__TRADING_APP__?.drawingToolsLibrary?.selectTool('trendline');
      });
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      const armedMobileTool = await page.evaluate(() => {
        return window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.();
      });
      assert(armedMobileTool === 'trendline', 'FR-013 arm tool on mobile via library',
        `Expected trendline armed on mobile, got ${armedMobileTool}`);

      await page.evaluate(() => window.__TRADING_APP__?.chartManager?.clearDrawingTool?.());
    } finally {
      await mobileCtx.browser.close();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Part 2: Persian RTL and Bilingual Parity Verification (FR-014)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const faCtx = await launch('desktop');
    const { page } = faCtx;

    try {
      // Boot in Persian mode (lang='fa')
      await boot(faCtx, { lang: 'fa' });

      // 1. Verify Floating Toolbar tooltips in Persian
      const faToolbarTooltips = await page.evaluate(() => {
        const trendBtn = document.querySelector('#floating-drawing-toolbar [data-tool="trendline"]');
        const lockBtn = document.querySelector('#fav-btn-lock');
        const hideBtn = document.querySelector('#fav-btn-hide');
        const allBtn = document.querySelector('#fav-btn-all-tools');
        return {
          trendTitle: trendBtn?.getAttribute('title') || '',
          lockTitle: lockBtn?.getAttribute('title') || '',
          hideTitle: hideBtn?.getAttribute('title') || '',
          allTitle: allBtn?.getAttribute('title') || ''
        };
      });
      assert(faToolbarTooltips.trendTitle.includes('خط روند'), 'FR-014 toolbar trendline Persian tooltip',
        `Expected Persian title containing "خط روند", got "${faToolbarTooltips.trendTitle}"`);
      assert(faToolbarTooltips.lockTitle.includes('قفل'), 'FR-014 toolbar lock Persian tooltip',
        `Expected Persian title containing "قفل", got "${faToolbarTooltips.lockTitle}"`);
      assert(faToolbarTooltips.hideTitle.includes('پنهان'), 'FR-014 toolbar hide Persian tooltip',
        `Expected Persian title containing "پنهان", got "${faToolbarTooltips.hideTitle}"`);

      // 2. Open Library and verify RTL direction and Persian labels
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      const faLibrary = await page.evaluate(() => {
        const box = document.querySelector('.dtl-box');
        const title = document.querySelector('.dtl-header-title, .dtl-title')?.innerText || '';
        const trendLabel = document.querySelector('[data-dtool="trendline"] .dtl-label')?.innerText || '';
        const pitchforkLabel = document.querySelector('[data-dtool="pitchfork"] .dtl-label')?.innerText || '';
        const groupTitle = document.querySelector('.dtl-group-title')?.innerText || '';
        return {
          dir: box?.getAttribute('dir'),
          title,
          trendLabel,
          pitchforkLabel,
          groupTitle
        };
      });
      assert(faLibrary.dir === 'rtl', 'FR-014 library modal RTL dir', `Expected dir="rtl", got "${faLibrary.dir}"`);
      assert(faLibrary.title.includes('ترسیم'), 'FR-014 library title Persian',
        `Expected Persian title with "ترسیم", got "${faLibrary.title}"`);
      assert(faLibrary.trendLabel === 'خط روند', 'FR-014 trendline Persian label',
        `Expected "خط روند", got "${faLibrary.trendLabel}"`);
      assert(faLibrary.pitchforkLabel.includes('چنگال'), 'FR-014 pitchfork Persian label',
        `Expected Persian name with "چنگال", got "${faLibrary.pitchforkLabel}"`);

      // 3. Verify Persian empty state message
      await page.type('#dtl-search', 'xyz_nonexistent_fa_query_999', { delay: 10 });
      await page.waitForSelector('#drawing-tools-modal .dtl-empty', { visible: true, timeout: 5000 });
      const faEmptyText = await page.evaluate(() => document.querySelector('#drawing-tools-modal .dtl-empty')?.innerText || '');
      assert(faEmptyText.includes('ابزاری یافت نشد'), 'FR-014 Persian empty state message',
        `Expected "ابزاری یافت نشد", got "${faEmptyText}"`);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      // 4. Verify Drawing Context Menu in Persian mode
      await page.evaluate(() => {
        const d = window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings;
        d.add('trendline', {
          points: [
            { time: Date.now() - 3600000 * 3, price: 60000 },
            { time: Date.now(), price: 62000 }
          ]
        });
      });
      await page.waitForFunction(() => (window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.all()?.length || 0) === 1);

      // Right-click canvas to trigger drawing context menu
      const chartBox = await page.$eval('#chart-area', el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      });
      await page.mouse.click(chartBox.x, chartBox.y, { button: 'right' });
      await page.waitForFunction(() => document.querySelector('#canvas-context-menu')?.style.display === 'block');

      const faContextMenu = await page.evaluate(() => {
        const menu = document.querySelector('#canvas-context-menu');
        const direction = getComputedStyle(menu).direction;
        const settingsText = document.querySelector('#ctx-draw-settings')?.innerText || '';
        const duplicateText = document.querySelector('#ctx-draw-duplicate')?.innerText || '';
        const removeText = document.querySelector('#ctx-draw-remove')?.innerText || '';
        return {
          direction,
          settingsText,
          duplicateText,
          removeText
        };
      });
      assert(faContextMenu.direction === 'rtl', 'FR-014 context menu RTL direction',
        `Expected direction "rtl", got "${faContextMenu.direction}"`);
      assert(faContextMenu.settingsText.includes('تنظیمات'), 'FR-014 context menu Persian settings',
        `Expected Persian text containing "تنظیمات", got "${faContextMenu.settingsText}"`);
      assert(faContextMenu.duplicateText.includes('تکرار'), 'FR-014 context menu Persian duplicate',
        `Expected Persian text containing "تکرار", got "${faContextMenu.duplicateText}"`);
      assert(faContextMenu.removeText.includes('حذف'), 'FR-014 context menu Persian remove',
        `Expected Persian text containing "حذف", got "${faContextMenu.removeText}"`);

      await page.keyboard.press('Escape');
    } finally {
      await faCtx.browser.close();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Part 3: English LTR Parity Verification (FR-014)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const enCtx = await launch('desktop');
    const { page } = enCtx;

    try {
      await boot(enCtx, { lang: 'en' });

      // Verify English library LTR direction and English labels
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      const enLibrary = await page.evaluate(() => {
        const box = document.querySelector('.dtl-box');
        const trendLabel = document.querySelector('[data-dtool="trendline"] .dtl-label')?.innerText || '';
        return {
          dir: box?.getAttribute('dir'),
          trendLabel
        };
      });
      assert(enLibrary.dir === 'ltr' || !enLibrary.dir, 'FR-014 library modal English LTR dir',
        `Expected dir="ltr", got "${enLibrary.dir}"`);
      assert(enLibrary.trendLabel === 'Trend Line', 'FR-014 trendline English label',
        `Expected "Trend Line", got "${enLibrary.trendLabel}"`);

      await page.keyboard.press('Escape');
    } finally {
      await enCtx.browser.close();
    }
  }

  console.log('PASS: 003 [05_mobile_viewport_and_persian_rtl]');
}

run().catch(err => {
  console.error(`❌ Unexpected fatal failure: ${err.message}`);
  process.exit(1);
});
