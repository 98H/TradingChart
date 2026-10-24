/**
 * @spec 003
 * @covers FR-004, FR-005, FR-006
 */
const { launch, boot } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:8088';

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
  // FR-006: Cloud-synced state via HTTP API (GET / PUT /api/user/state)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // 1. Unauthenticated request must return 401
    const unauthRes = await fetch(`${BASE_URL}/api/user/state`);
    const unauthBody = await unauthRes.json();
    assert(unauthRes.status === 401, 'FR-006 unauthenticated GET /api/user/state status 401',
      `Expected 401, got ${unauthRes.status}`);
    assert(unauthBody && unauthBody.error === 'unauthenticated', 'FR-006 unauthenticated error string',
      `Expected error "unauthenticated", got ${unauthBody?.error}`);

    // 2. Register fresh deterministic test user
    const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `drw_sync_${ts}@qa.test`;
    const username = `u_drw_${ts}`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password: 'Password123!', displayName: 'Drawing Test User' })
    });
    assert(regRes.status === 200, 'FR-006 register test user status 200', `Expected 200, got ${regRes.status}`);
    const cookieHeader = regRes.headers.get('set-cookie');
    assert(!!cookieHeader, 'FR-006 session cookie issued on registration', 'Missing Set-Cookie header');
    const sessionCookie = cookieHeader.split(';')[0];

    // 3. PUT user state with drawingFavorites
    const testFavorites = ['trendline', 'ray', 'box', 'fibretracement', 'pitchfork', 'gannbox'];
    const putRes = await fetch(`${BASE_URL}/api/user/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        state: {
          drawingFavorites: JSON.stringify(testFavorites)
        }
      })
    });
    const putBody = await putRes.json();
    assert(putRes.status === 200, 'FR-006 PUT /api/user/state status 200', `Expected 200, got ${putRes.status}`);
    assert(putBody.ok === true, 'FR-006 PUT state ok === true', 'Expected ok: true in response');

    // 4. GET user state and verify drawingFavorites persisted
    const getRes = await fetch(`${BASE_URL}/api/user/state`, {
      headers: { 'Cookie': sessionCookie }
    });
    const getBody = await getRes.json();
    assert(getRes.status === 200, 'FR-006 GET /api/user/state status 200', `Expected 200, got ${getRes.status}`);
    assert(getBody.ok === true, 'FR-006 GET state ok === true', 'Expected ok: true in response');

    let savedFavs = getBody.state?.drawingFavorites;
    if (typeof savedFavs === 'string') {
      try { savedFavs = JSON.parse(savedFavs); } catch (e) {}
    }
    assert(Array.isArray(savedFavs) && savedFavs.includes('gannbox') && savedFavs.includes('pitchfork'),
      'FR-006 cloud-synced drawingFavorites content', `Unexpected drawingFavorites: ${JSON.stringify(savedFavs)}`);

    // 5. Invalid payload returns 400
    const badRes = await fetch(`${BASE_URL}/api/user/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ state: ['not-an-object'] })
    });
    assert(badRes.status === 400, 'FR-006 invalid state payload status 400', `Expected 400, got ${badRes.status}`);

    // Clean up session via logout
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UI Verification: Browser automation for library and favorites toolbar
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ──────────────────────────────────────────────────────────────────────────
    // FR-004: Drawing tools library modal, categories, search, empty state
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open library from floating toolbar 9-dots button
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      const isInputFocused = await page.evaluate(() => document.activeElement === document.querySelector('#dtl-search'));
      assert(isInputFocused, 'FR-004 search input auto-focused', 'Expected #dtl-search to be focused upon opening');

      const totalTools = await page.evaluate(() => document.querySelectorAll('#drawing-tools-modal [data-dtool]').length);
      assert(totalTools >= 60, 'FR-004 catalogue lists supported tools (>= 60)', `Found only ${totalTools} tools`);

      const groupCount = await page.evaluate(() => document.querySelectorAll('#drawing-tools-modal .dtl-group').length);
      assert(groupCount >= 7, 'FR-004 tool categories group count', `Expected >= 7 groups, got ${groupCount}`);

      // Live search English query "fib"
      await page.type('#dtl-search', 'fib', { delay: 15 });
      await page.waitForFunction((total) => {
        const count = document.querySelectorAll('#drawing-tools-modal [data-dtool]').length;
        return count > 0 && count < total;
      }, {}, totalTools);
      const fibCount = await page.evaluate(() => document.querySelectorAll('#drawing-tools-modal [data-dtool]').length);
      assert(fibCount >= 8 && fibCount < totalTools, 'FR-004 live search English "fib"', `Expected >= 8 fib tools, got ${fibCount}`);

      // Clear search
      await page.evaluate(() => {
        const i = document.querySelector('#dtl-search');
        i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((total) => {
        return document.querySelectorAll('#drawing-tools-modal [data-dtool]').length === total;
      }, {}, totalTools);

      // Empty state query
      await page.type('#dtl-search', 'xyz_nonexistent_tool_query_123', { delay: 10 });
      await page.waitForSelector('#drawing-tools-modal .dtl-empty', { visible: true, timeout: 5000 });
      const emptyText = await page.evaluate(() => document.querySelector('#drawing-tools-modal .dtl-empty')?.innerText || '');
      assert(emptyText.includes('No tools found') || emptyText.includes('ابزاری یافت نشد'),
        'FR-004 empty search state message', `Expected "No tools found" message, got "${emptyText}"`);

      // Reset search input
      await page.evaluate(() => {
        const i = document.querySelector('#dtl-search');
        i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((total) => {
        return document.querySelectorAll('#drawing-tools-modal [data-dtool]').length === total;
      }, {}, totalTools);

      // Edge case: Chart engine drawings API unavailable fallback lists static catalogue
      const staticCatalogueSize = await page.evaluate(() => {
        const lib = window.__TRADING_APP__?.drawingToolsLibrary;
        const orig = window.__TRADING_APP__.chartManager.workspace.active;
        window.__TRADING_APP__.chartManager.workspace.active = null;
        lib.supportedCache = null;
        const fallback = lib.supportedTypes();
        window.__TRADING_APP__.chartManager.workspace.active = orig;
        lib.supportedCache = null;
        return fallback.size;
      });
      assert(staticCatalogueSize >= 76, 'FR-004 edge case static catalogue fallback',
        `Expected >= 76 static catalogue tools, got ${staticCatalogueSize}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-005: Choosing tool in library arms tool and closes modal; closing mechanisms
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Pick pitchfork tool from library
      await realClick(page, '#drawing-tools-modal [data-dtool="pitchfork"]');
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      const armed = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.chart?.drawings?.getTool?.());
      assert(armed === 'pitchfork', 'FR-005 pick tool arms on active chart', `Expected pitchfork, got ${armed}`);

      // Test close via Escape key
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      assert(await page.evaluate(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open')),
        'FR-005 close library via Escape', 'Modal remained open after Escape');

      // Test close via ✕ button (#dtl-close)
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      await realClick(page, '#dtl-close');
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      assert(await page.evaluate(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open')),
        'FR-005 close library via ✕ button', 'Modal remained open after #dtl-close click');

      // Test close via backdrop click (click outside .dtl-box)
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      await page.mouse.click(10, 10);
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      assert(await page.evaluate(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open')),
        'FR-005 close library via backdrop click', 'Modal remained open after backdrop click');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FR-006: Star / un-star favorite pinning and localStorage persistence
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Re-open library
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      // Star gannbox tool
      await realClick(page, '[data-star="gannbox"]');
      await page.waitForFunction(() => {
        const star = document.querySelector('[data-star="gannbox"]');
        const inToolbar = document.querySelector('#floating-drawing-toolbar [data-tool="gannbox"]');
        return star?.classList.contains('fav') && !!inToolbar;
      });

      const inStorage = await page.evaluate(() => {
        const favs = JSON.parse(localStorage.getItem('tradingchart_drawing_favorites') || '[]');
        return favs.includes('gannbox');
      });
      assert(inStorage, 'FR-006 star tool persisted in localStorage', 'gannbox not present in tradingchart_drawing_favorites');

      // Close library and reload page to verify persistence across sessions
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const tb = document.querySelector('#floating-drawing-toolbar');
        return tb && !!tb.querySelector('[data-tool="gannbox"]');
      }, { timeout: 10000 });

      const persistedOnReload = await page.evaluate(() => !!document.querySelector('#floating-drawing-toolbar [data-tool="gannbox"]'));
      assert(persistedOnReload, 'FR-006 favorite tool persisted after reload', 'gannbox favorite button missing after reload');

      // Un-star gannbox to restore default state
      await realClick(page, '#fav-btn-all-tools');
      await page.waitForFunction(() => document.querySelector('#drawing-tools-modal')?.classList.contains('open'));
      await realClick(page, '[data-star="gannbox"]');
      await page.waitForFunction(() => {
        const star = document.querySelector('[data-star="gannbox"]');
        const inToolbar = document.querySelector('#floating-drawing-toolbar [data-tool="gannbox"]');
        return !star?.classList.contains('fav') && !inToolbar;
      });

      const removedFromToolbar = await page.evaluate(() => !document.querySelector('#floating-drawing-toolbar [data-tool="gannbox"]'));
      assert(removedFromToolbar, 'FR-006 un-star tool removes from toolbar', 'gannbox still present on toolbar');
      await page.keyboard.press('Escape');
    }

  } catch (err) {
    console.error(`❌ Unexpected failure: ${err.stack || err.message}`);
    process.exit(1);
  } finally {
    await ctx.browser.close();
  }

  console.log('PASS: 003 [02_library_search_and_cloud_sync]');
}

run().catch(err => {
  console.error(`❌ Unexpected fatal failure: ${err.message}`);
  process.exit(1);
});
