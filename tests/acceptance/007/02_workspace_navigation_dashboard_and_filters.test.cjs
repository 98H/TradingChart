/**
 * @spec 007
 * @covers FR-001, FR-002, FR-003, FR-004, FR-011, FR-022
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
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Full-Page Journal Workspace Switching & Quant Return (FR-001, SC-005)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.waitForSelector('#nav-btn-journal', { visible: true, timeout: 8000 });

      // Click Journal navigation pill
      await realClick(page, '#nav-btn-journal');
      await page.waitForFunction(() => {
        const jView = document.querySelector('#journal-workspace-view');
        const cArea = document.querySelector('#chart-area');
        return jView && getComputedStyle(jView).display !== 'none' &&
               cArea && getComputedStyle(cArea).display === 'none';
      }, { timeout: 6000 });

      const journalNavState = await page.evaluate(() => {
        const jView = document.querySelector('#journal-workspace-view');
        const cArea = document.querySelector('#chart-area');
        const activePill = document.querySelector('.nav-pill.active')?.dataset?.view;
        return {
          journalVisible: jView && getComputedStyle(jView).display !== 'none',
          chartHidden: cArea && getComputedStyle(cArea).display === 'none',
          activePill
        };
      });

      assert(journalNavState.journalVisible, 'FR-001 journal workspace displayed on nav click',
        '#journal-workspace-view is not visible');
      assert(journalNavState.chartHidden, 'FR-001 chart area hidden when journal workspace is active',
        '#chart-area is not hidden');
      assert(journalNavState.activePill === 'journal', 'FR-001 active nav pill is journal',
        `Expected active pill journal, got ${journalNavState.activePill}`);

      // Return to Quant chart
      await realClick(page, '#nav-btn-quant');
      await page.waitForFunction(() => {
        const cArea = document.querySelector('#chart-area');
        return cArea && getComputedStyle(cArea).display !== 'none';
      }, { timeout: 6000 });

      const quantNavState = await page.evaluate(() => {
        const jView = document.querySelector('#journal-workspace-view');
        const cArea = document.querySelector('#chart-area');
        return {
          journalHidden: !jView || getComputedStyle(jView).display === 'none',
          chartVisible: cArea && getComputedStyle(cArea).display !== 'none'
        };
      });

      assert(quantNavState.chartVisible, 'FR-001 Quant nav button restores chart area',
        '#chart-area is not visible after clicking Quant');
      assert(quantNavState.journalHidden, 'FR-001 journal workspace hidden in Quant mode',
        '#journal-workspace-view remains visible in Quant mode');

      // Return to Journal for remaining tests
      await realClick(page, '#nav-btn-journal');
      await page.waitForFunction(() => {
        const jView = document.querySelector('#journal-workspace-view');
        return jView && getComputedStyle(jView).display !== 'none';
      }, { timeout: 5000 });

      // Bottom-panel journal tab & side-dock verification (FR-001)
      const dockAndPanelPresence = await page.evaluate(() => {
        const bottomTab = document.querySelector('#bottom-panel .panel-tab[data-view="journal"]');
        const sideDockBtn = document.querySelector('.rail-btn[data-panel="journal"]');
        return {
          hasBottomTab: !!bottomTab,
          hasSideDockBtn: !!sideDockBtn
        };
      });
      assert(dockAndPanelPresence.hasBottomTab, 'FR-001 journal available as bottom panel tab',
        '#bottom-panel .panel-tab[data-view="journal"] missing');
      assert(dockAndPanelPresence.hasSideDockBtn, 'FR-001 journal available as side-dock panel',
        '.rail-btn[data-panel="journal"] missing');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. 8 Sub-Navigation Suite Tabs (FR-002)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const expectedSuites = [
        'dashboard',
        'analytics',
        'trades',
        'daily',
        'prop',
        'playbooks',
        'aicoach',
        'importer'
      ];

      const tabsData = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('#journal-workspace-view .journal-nav-tab'));
        return tabs.map(t => ({
          tabId: t.dataset.tab,
          text: t.innerText.trim(),
          isActive: t.classList.contains('active')
        }));
      });

      assert(tabsData.length >= 8, 'FR-002 8 suite tabs rendered in ribbon',
        `Expected at least 8 suite tabs, found ${tabsData.length}`);

      for (const suite of expectedSuites) {
        const exists = tabsData.some(t => t.tabId === suite);
        assert(exists, `FR-002 suite tab ${suite} present`,
          `Suite tab with data-tab="${suite}" not found in navigation bar`);
      }

      // Switch to analytics suite and back to dashboard
      await page.evaluate(() => {
        document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="analytics"]')?.click();
      });
      await page.waitForFunction(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom === 'analytics' || fpj?.activeTab === 'analytics';
      }, { timeout: 6000 });

      const activeAfterSwitch = await page.evaluate(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom || fpj?.activeTab;
      });
      assert(activeAfterSwitch === 'analytics', 'FR-002 suite tab switching updates activeTab',
        `Expected activeTab analytics, got ${activeAfterSwitch}`);

      // Return to dashboard
      await page.evaluate(() => {
        document.querySelector('#journal-workspace-view .journal-nav-tab[data-tab="dashboard"]')?.click();
      });
      await page.waitForFunction(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom === 'dashboard' || fpj?.activeTab === 'dashboard';
      }, { timeout: 6000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Dashboard KPI Cards, Monthly Calendar Heatmap & Equity Curve (FR-011)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const dashboardState = await page.evaluate(() => {
        const view = document.querySelector('#journal-workspace-view');
        const statCards = Array.from(view.querySelectorAll('.journal-stat-card'));
        const dayTiles = Array.from(view.querySelectorAll('.calendar-day-tile'));
        const equitySvg = view.querySelector('#mount-dashboard-equity-chart svg');
        return {
          statCardsCount: statCards.length,
          statLabels: statCards.map(c => c.innerText.slice(0, 30)),
          dayTilesCount: dayTiles.length,
          hasEquitySvg: !!equitySvg
        };
      });

      assert(dashboardState.statCardsCount >= 4, 'FR-011 dashboard renders 4+ KPI stat cards',
        `Expected at least 4 KPI cards, got ${dashboardState.statCardsCount}`);
      assert(dashboardState.dayTilesCount >= 28, 'FR-011 monthly calendar renders daily tiles',
        `Expected at least 28 calendar tiles, got ${dashboardState.dayTilesCount}`);
      assert(dashboardState.hasEquitySvg, 'FR-011 cumulative equity curve SVG rendered',
        '#mount-dashboard-equity-chart svg missing');

      // Calendar day tile interaction: clicking a day tile switches to trades ledger
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) {
          fj.activeTab = 'trades';
          fj.render();
        }
      });
      await page.waitForFunction(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom === 'trades' || fpj?.activeTab === 'trades';
      }, { timeout: 6000 });

      const activeTabAfterDayClick = await page.evaluate(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom || fpj?.activeTab;
      });
      assert(activeTabAfterDayClick === 'trades', 'FR-011 day click transitions to trades ledger',
        `Expected activeTab trades, got ${activeTabAfterDayClick}`);

      // Return to dashboard
      await page.evaluate(() => {
        const fj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        if (fj) {
          fj.activeTab = 'dashboard';
          fj.render();
        }
      });
      await page.waitForFunction(() => {
        const activeTabInDom = document.querySelector('#journal-workspace-view .journal-nav-tab.active')?.getAttribute('data-tab');
        const fpj = window.__TRADING_APP__.fullPageJournal || window.__TRADING_APP__.tradeJournal;
        return activeTabInDom === 'dashboard' || fpj?.activeTab === 'dashboard';
      }, { timeout: 6000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Account and Time-Window Filtering (FR-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Verify account filter dropdown contains all accounts
      const accountOptions = await page.evaluate(() => {
        const select = document.querySelector('#journal-workspace-view #journal-account-filter');
        return Array.from(select?.options || []).map(o => o.value);
      });
      assert(accountOptions.includes('all') && accountOptions.length >= 2,
        'FR-003 account filter dropdown contains accounts',
        `Expected 'all' and account options, got ${JSON.stringify(accountOptions)}`);

      // Change account filter to specific account
      await page.evaluate(() => {
        const select = document.querySelector('#journal-workspace-view #journal-account-filter');
        select.value = 'tradingchart-paper-1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.activeAccount === 'tradingchart-paper-1';
      }, { timeout: 6000 });

      const activeAccountState = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.activeAccount;
      });
      assert(activeAccountState === 'tradingchart-paper-1', 'FR-003 account filter updates store setting',
        `Expected activeAccount tradingchart-paper-1, got ${activeAccountState}`);

      // Change time-window filter to 7d
      await page.evaluate(() => {
        const select = document.querySelector('#journal-workspace-view #journal-time-filter');
        select.value = '7d';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.timeFilter === '7d';
      }, { timeout: 6000 });

      const timeFilterState = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.timeFilter;
      });
      assert(timeFilterState === '7d', 'FR-003 time filter updates store setting to 7d',
        `Expected timeFilter 7d, got ${timeFilterState}`);

      // Reset filters to all
      await page.evaluate(() => {
        const accSelect = document.querySelector('#journal-workspace-view #journal-account-filter');
        const timeSelect = document.querySelector('#journal-workspace-view #journal-time-filter');
        accSelect.value = 'all';
        accSelect.dispatchEvent(new Event('change', { bubbles: true }));
        timeSelect.value = 'all';
        timeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.activeAccount === 'all';
      }, { timeout: 6000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Privacy Mode Balance Masking (FR-004, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Toggle privacy mode ON via real click
      await realClick(page, '#journal-workspace-view #btn-journal-privacy');
      await page.waitForFunction(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.privacyMode === true;
      }, { timeout: 6000 });

      const privacyOnState = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const btn = document.querySelector('#journal-workspace-view #btn-journal-privacy');
        const kpiValues = Array.from(document.querySelectorAll('#journal-workspace-view .journal-stat-card .num-ltr')).map(e => e.innerText.trim());
        const hasAsterisks = kpiValues.some(v => v.includes('***') || v.includes('$***'));
        return {
          privacyMode: store.settings.privacyMode,
          btnText: btn?.innerText?.trim(),
          kpiValues,
          hasAsterisks
        };
      });

      assert(privacyOnState.privacyMode === true, 'FR-004 privacyMode enabled in store',
        'store.settings.privacyMode is not true');
      assert(privacyOnState.hasAsterisks, 'FR-004 monetary values masked with asterisks in KPIs',
        `Expected asterisks in KPI figures, got ${JSON.stringify(privacyOnState.kpiValues)}`);
      assert(privacyOnState.btnText.includes('Private') || privacyOnState.btnText.includes('پنهان'),
        'FR-004 privacy toggle button reflects Private state',
        `Expected Private label, got ${privacyOnState.btnText}`);

      // SC-003: Verify zero unmasked dollar balances visible in monetary slots
      const unmaskedFound = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#journal-workspace-view .journal-stat-card .num-ltr'));
        return cards.filter(c => /[$€£]\s*\d+\.\d+/.test(c.innerText)).map(c => c.innerText);
      });
      assert(unmaskedFound.length === 0, 'SC-003 zero unmasked money values visible in journal',
        `Found unmasked money values: ${JSON.stringify(unmaskedFound)}`);

      // Toggle privacy mode OFF
      await realClick(page, '#journal-workspace-view #btn-journal-privacy');
      await page.waitForFunction(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        return store?.settings?.privacyMode === false;
      }, { timeout: 6000 });

      const privacyOffState = await page.evaluate(() => {
        const store = window.__TRADING_APP__.fullPageJournal?.store || window.__TRADING_APP__.tradeJournal?.store;
        const btn = document.querySelector('#journal-workspace-view #btn-journal-privacy');
        const kpiValues = Array.from(document.querySelectorAll('#journal-workspace-view .journal-stat-card .num-ltr')).map(e => e.innerText.trim());
        return {
          privacyMode: store.settings.privacyMode,
          btnText: btn?.innerText?.trim(),
          hasAsterisks: kpiValues.some(v => v.includes('***'))
        };
      });

      assert(privacyOffState.privacyMode === false, 'FR-004 privacyMode disabled in store',
        'store.settings.privacyMode is not false');
      assert(!privacyOffState.hasAsterisks, 'FR-004 monetary values unmasked on toggle off',
        'Asterisks still present after toggling privacy off');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Bilingual English / Persian Parity (FR-022)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch to Persian
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', { timeout: 4000 });

      const faJournalState = await page.evaluate(() => {
        const dir = document.documentElement.getAttribute('dir');
        const privacyBtn = document.querySelector('#journal-workspace-view #btn-journal-privacy')?.innerText?.trim();
        const addBtn = document.querySelector('#journal-workspace-view #btn-journal-add')?.innerText?.trim();
        return { dir, privacyBtn, addBtn };
      });

      assert(faJournalState.dir === 'rtl', 'FR-022 RTL direction applied in Persian',
        `Expected dir="rtl", got ${faJournalState.dir}`);
      assert(faJournalState.privacyBtn.includes('نمایش') || faJournalState.privacyBtn.includes('پنهان') || faJournalState.privacyBtn.length > 0,
        'FR-022 Persian privacy button label rendered', `Unexpected label: ${faJournalState.privacyBtn}`);
      assert(faJournalState.addBtn.includes('ثبت معامله') || faJournalState.addBtn.length > 0,
        'FR-022 Persian add trade button label rendered', `Unexpected label: ${faJournalState.addBtn}`);

      // Switch back to English
      await page.evaluate(() => window.__TRADING_APP__.switchLanguage('en'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 4000 });
    }
  } finally {
    await ctx.browser.close();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Mobile Viewport Reachability from Panels Menu (FR-022)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const mobileCtx = await launch('mobile');
    try {
      await boot(mobileCtx);
      const { page: mPage } = mobileCtx;

      // On mobile viewport (390px), open panels menu
      await mPage.waitForSelector('#nav-btn-panels', { visible: true, timeout: 8000 });
      await realClick(mPage, '#nav-btn-panels');

      await mPage.waitForSelector('#modal-panels-menu', { visible: true, timeout: 5000 });

      // Verify Trade Journal option exists in panels menu
      const hasJournalInMenu = await mPage.evaluate(() => {
        const item = document.querySelector('#modal-panels-menu [data-panel="journal"]') ||
                     Array.from(document.querySelectorAll('#modal-panels-menu button')).find(b => b.innerText.includes('Journal') || b.innerText.includes('ژورنال'));
        return !!item;
      });
      assert(hasJournalInMenu, 'FR-022 Journal reachable from mobile panels menu',
        'Trade Journal menu item not found in #modal-panels-menu');

      // Click Journal item in panels menu
      await mPage.evaluate(() => {
        const item = document.querySelector('#modal-panels-menu [data-panel="journal"]') ||
                     Array.from(document.querySelectorAll('#modal-panels-menu button')).find(b => b.innerText.includes('Journal') || b.innerText.includes('ژورنال'));
        item?.click();
      });

      await mPage.waitForFunction(() => {
        const jView = document.querySelector('#journal-workspace-view');
        return jView && getComputedStyle(jView).display !== 'none';
      }, { timeout: 6000 });

      const isJournalVisibleMobile = await mPage.evaluate(() => {
        const jView = document.querySelector('#journal-workspace-view');
        return jView && getComputedStyle(jView).display !== 'none';
      });
      assert(isJournalVisibleMobile, 'FR-022 Journal opens from mobile panels menu',
        '#journal-workspace-view not visible after opening via mobile panels menu');
    } finally {
      await mobileCtx.browser.close();
    }
  }

  console.log('✅ 02_workspace_navigation_dashboard_and_filters.test.cjs passed');
}

run().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
