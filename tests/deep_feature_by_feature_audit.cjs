// tests/deep_feature_by_feature_audit.cjs — In-depth Feature-by-Feature QA & Dogfooding Audit
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8088';
const EVID = '/root/TradingChart/screenshots/feature_by_feature';
if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const issues = [];
  const logIssue = (severity, surface, desc, meta = {}) => {
    issues.push({ severity, surface, desc, meta });
    console.log(`[${severity.toUpperCase()}] [${surface}] ${desc}`);
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.toString()));

    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));

    // ==========================================
    // 1. TOP HEADER & QUICK CONTROLS
    // ==========================================
    console.log('\n=== 1. AUDITING TOPBAR CONTROLS ===');
    const headerDetails = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#top-app-header button')).map(b => ({
        id: b.id,
        cls: b.className,
        text: b.innerText.trim().replace(/\s+/g, ' '),
        title: b.getAttribute('title'),
        ariaLabel: b.getAttribute('aria-label'),
        rect: { w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }
      }));
      return btns;
    });

    headerDetails.forEach(b => {
      if (!b.title && !b.ariaLabel) {
        logIssue('medium', 'topbar', `Button #${b.id || b.cls} is missing both title and aria-label`);
      }
      // Only check dimensions for visible buttons on desktop (skip mobile-only elements)
      if (b.rect.w > 0 && b.rect.h > 0 && (b.rect.w < 24 || b.rect.h < 24)) {
        logIssue('medium', 'topbar', `Button #${b.id || b.cls} hit area too small: ${b.rect.w}x${b.rect.h}px`);
      }
    });

    // 1.1 Chart Style Picker
    console.log('Testing Chart Style Picker...');
    await page.click('#btn-topbar-chart-style');
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(EVID, '01_chart_style_dropdown.png') });
    const styleMenu = await page.evaluate(() => {
      const m = document.querySelector('#popover-chart-style, .chart-style-picker-dropdown');
      const items = m ? Array.from(m.querySelectorAll('.style-menu-item, [data-style]')).map(i => ({
        text: i.innerText.trim(),
        style: i.getAttribute('data-style')
      })) : [];
      return { found: !!m && m.style.display !== 'none', count: items.length, items };
    });
    console.log('Chart style menu:', styleMenu);
    if (!styleMenu.found || styleMenu.count === 0) {
      logIssue('high', 'chart-style-picker', 'Chart style picker dropdown did not render items on click');
    }

    // 1.2 Layout Manager
    console.log('Testing Layout Manager...');
    await page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(EVID, '02_layout_manager_dropdown.png') });
    const layoutMenu = await page.evaluate(() => {
      const m = document.querySelector('.layout-picker-menu, #modal-layout-studio, [class*="layout-dropdown"]');
      const btns = m ? m.querySelectorAll('[data-layout]').length : 0;
      return { found: !!m, count: btns };
    });
    console.log('Layout menu:', layoutMenu);
    if (!layoutMenu.found || layoutMenu.count === 0) {
      logIssue('high', 'layout-manager', 'Layout manager dropdown did not render layout options');
    }

    // Close any open popover
    await page.evaluate(() => document.querySelectorAll('.modal-overlay, .dropdown-menu').forEach(m => m.classList.remove('open')));

    // ==========================================
    // 2. BOTTOM SUITE VIEWS (8 PANELS)
    // ==========================================
    console.log('\n=== 2. AUDITING ALL BOTTOM SUITE PANELS ===');
    await page.click('#btn-toggle-bottom-panel');
    await new Promise(r => setTimeout(r, 600));

    const tabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const tab of tabs) {
      console.log(`Auditing bottom tab [${tab}]...`);
      await page.click(`.panel-tab[data-view="${tab}"]`);
      await new Promise(r => setTimeout(r, 600));

      const tabInfo = await page.evaluate((t) => {
        const v = document.querySelector(`#view-${t}`);
        if (!v) return { missing: true };
        const text = v.innerText.trim();
        // Check for empty or broken elements
        const brokenImgs = Array.from(v.querySelectorAll('img')).filter(i => !i.naturalWidth && !i.src.includes('data:image'));
        // Check buttons
        const btns = Array.from(v.querySelectorAll('button')).map(b => ({
          text: b.innerText.trim(),
          w: Math.round(b.getBoundingClientRect().width),
          h: Math.round(b.getBoundingClientRect().height),
          aria: b.getAttribute('aria-label') || b.getAttribute('title')
        }));
        return {
          charCount: text.length,
          brokenImgs: brokenImgs.length,
          btnsCount: btns.length,
          smallBtns: btns.filter(b => b.w > 0 && b.h > 0 && (b.w < 24 || b.h < 22))
        };
      }, tab);

      console.log(`Tab [${tab}] info:`, tabInfo);
      if (tabInfo.missing) logIssue('critical', `bottom-${tab}`, 'View container element missing');
      if (tabInfo.brokenImgs > 0) logIssue('medium', `bottom-${tab}`, `${tabInfo.brokenImgs} broken images`);
      if (tabInfo.smallBtns.length > 0) {
        logIssue('low', `bottom-${tab}`, `${tabInfo.smallBtns.length} buttons are smaller than 24x22px`, tabInfo.smallBtns);
      }
      await page.screenshot({ path: path.join(EVID, `03_bottom_${tab}.png`) });
    }

    // ==========================================
    // 3. ALL SIDE DOCK PANELS
    // ==========================================
    console.log('\n=== 3. AUDITING ALL SIDE DOCK PANELS ===');
    const sidePanels = ['watchlist', 'alerts', 'paper', 'dataWindow', 'objects', 'pine', 'journal', 'screener', 'dom', 'calendar', 'news'];
    for (const p of sidePanels) {
      console.log(`Auditing side panel [${p}]...`);
      const btn = await page.$(`#desktop-side-rail .rail-btn[data-panel="${p}"]`);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 600));

        const pInfo = await page.evaluate((panelId) => {
          const dock = document.querySelector('.vela-dock-panel') || document.querySelector('.vela-dw') || document.querySelector('.vela-ot') || document.querySelector(`.vela-panel-${panelId}`) || document.querySelector(`[data-panel-id="${panelId}"]`);
          if (!dock) return { opened: false };
          const rect = dock.getBoundingClientRect();
          const text = dock.innerText.trim();
          const btns = Array.from(dock.querySelectorAll('button')).map(b => ({
            text: b.innerText.trim(),
            w: Math.round(b.getBoundingClientRect().width),
            h: Math.round(b.getBoundingClientRect().height)
          }));
          return {
            opened: true,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            charCount: text.length,
            smallBtns: btns.filter(b => b.w > 0 && b.h > 0 && (b.w < 22 || b.h < 20))
          };
        }, p);

        console.log(`Side panel [${p}] info:`, pInfo);
        if (!pInfo.opened) {
          logIssue('high', `side-${p}`, `Side panel did not open on clicking rail button`);
        } else if (pInfo.charCount < 10) {
          logIssue('medium', `side-${p}`, `Side panel has virtually empty content (${pInfo.charCount} chars)`);
        }
        await page.screenshot({ path: path.join(EVID, `04_side_${p}.png`) });
      } else {
        logIssue('medium', `side-${p}`, `Rail button for panel not found in DOM`);
      }
    }

    // ==========================================
    // 4. SYMBOL SEARCH & I18N DEEP VERIFICATION
    // ==========================================
    console.log('\n=== 4. AUDITING SYMBOL SEARCH MODAL IN EN & FA ===');
    // Open in English
    await page.evaluate(() => window.__TRADING_APP__.openSymbolSearch());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '05_sym_search_en.png') });

    const symSearchEn = await page.evaluate(() => {
      const m = document.querySelector('#modal-symbol-search');
      const cats = Array.from(m.querySelectorAll('.sym-cat-btn')).map(c => c.innerText.trim());
      const rows = m.querySelectorAll('.sym-search-row').length;
      const clearBtn = m.querySelector('#symbol-clear-search');
      const input = m.querySelector('#symbol-search-input');
      return {
        cats,
        rows,
        clearRight: clearBtn ? getComputedStyle(clearBtn).right : null,
        clearLeft: clearBtn ? getComputedStyle(clearBtn).left : null,
        inputPadding: input ? getComputedStyle(input).padding : null
      };
    });
    console.log('Symbol search EN:', symSearchEn);

    // Switch to Persian and test Symbol Search
    await page.evaluate(() => {
      document.querySelector('#modal-symbol-search')?.classList.remove('open');
      window.__TRADING_APP__.switchLanguage('fa');
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => window.__TRADING_APP__.openSymbolSearch());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVID, '06_sym_search_fa.png') });

    const symSearchFa = await page.evaluate(() => {
      const m = document.querySelector('#modal-symbol-search');
      const cats = Array.from(m.querySelectorAll('.sym-cat-btn')).map(c => c.innerText.trim());
      const rows = m.querySelectorAll('.sym-search-row').length;
      const clearBtn = m.querySelector('#symbol-clear-search');
      const input = m.querySelector('#symbol-search-input');
      const hint = m.querySelector('div[style*="justify-content: space-between"] span')?.innerText;
      return {
        cats,
        rows,
        clearRight: clearBtn ? getComputedStyle(clearBtn).right : null,
        clearLeft: clearBtn ? getComputedStyle(clearBtn).left : null,
        inputPadding: input ? getComputedStyle(input).padding : null,
        hint
      };
    });
    console.log('Symbol search FA:', symSearchFa);

    // Check if category buttons remained English in Persian mode!
    const unlocalizedCats = symSearchFa.cats.filter(c => /^[A-Za-z]+$/.test(c));
    if (unlocalizedCats.length > 0) {
      logIssue('high', 'symbol-search-i18n', `Symbol search category buttons remain untranslated in Persian: ${unlocalizedCats.join(', ')}`);
    }

    // Check clear button alignment in RTL: if clearRight is 8px and clearLeft is 'auto', it is on the right side in RTL!
    if (symSearchFa.clearRight === '8px' && (symSearchFa.clearLeft === 'auto' || !symSearchFa.clearLeft)) {
      logIssue('high', 'symbol-search-rtl', 'Symbol search clear button remains anchored to right in RTL mode, colliding with Persian text');
    }

    // Close symbol search
    await page.evaluate(() => document.querySelector('#modal-symbol-search')?.classList.remove('open'));

    // ==========================================
    // 5. MOBILE VIEWPORT DEEP AUDIT (390x844)
    // ==========================================
    console.log('\n=== 5. AUDITING MOBILE VIEWPORT (390x844) ===');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(EVID, '07_mobile_overview.png') });

    const mobileCheck = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;

      // Check Quick Trade widget placement
      const qt = document.querySelector('#chart-quick-trade');
      const qtr = qt ? qt.getBoundingClientRect() : null;

      // Check small tap targets on mobile across the entire document
      const btns = Array.from(document.querySelectorAll('button:not(.qt-step-btn)'));
      const tinyTouchTargets = btns.filter(b => {
        const r = b.getBoundingClientRect();
        const vis = getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden';
        return vis && r.width > 2 && r.height > 2 && (r.width < 32 || r.height < 32);
      }).map(b => ({
        id: b.id,
        cls: b.className,
        text: b.innerText.trim().slice(0, 20),
        w: Math.round(b.getBoundingClientRect().width),
        h: Math.round(b.getBoundingClientRect().height)
      }));

      return {
        vw,
        scrollW,
        bodyScrollW,
        hasHorizontalOverflow: scrollW > vw + 1 || bodyScrollW > vw + 1,
        qtRect: qtr ? { left: Math.round(qtr.left), right: Math.round(qtr.right), w: Math.round(qtr.width) } : null,
        tinyTouchTargets
      };
    });

    console.log('Mobile Check:', {
      vw: mobileCheck.vw,
      scrollW: mobileCheck.scrollW,
      overflow: mobileCheck.hasHorizontalOverflow,
      qtRect: mobileCheck.qtRect,
      tinyCount: mobileCheck.tinyTouchTargets.length
    });

    if (mobileCheck.hasHorizontalOverflow) {
      logIssue('critical', 'mobile-layout', `Horizontal page scroll detected on mobile: ${mobileCheck.scrollW}px vs ${mobileCheck.vw}px`);
    }

    if (mobileCheck.tinyTouchTargets.length > 0) {
      logIssue('medium', 'mobile-touch', `${mobileCheck.tinyTouchTargets.length} touch targets are smaller than 32px on mobile`, mobileCheck.tinyTouchTargets);
    }

    // Check runtime errors
    console.log('\n=== RUNTIME CONSOLE & PAGE ERRORS ===');
    console.log(errors);
    errors.forEach(e => logIssue('high', 'runtime-error', e));

    console.log('\n========================================');
    console.log(`TOTAL ISSUES IDENTIFIED: ${issues.length}`);
    console.log('========================================');
    fs.writeFileSync(path.join(EVID, 'audit_report.json'), JSON.stringify(issues, null, 2));

  } finally {
    await browser.close();
  }
}

run().catch(e => {
  console.error('Audit script failed:', e);
  process.exit(1);
});
