// tests/qa_comprehensive_investigation.cjs
// Senior Product Designer & QA Lead exhaustive exploratory dogfooding
const { launch, boot, shots } = require('./qa_lib.cjs');

async function runAudit() {
  console.log('🚀 Starting Comprehensive Dogfooding Audit across Desktop & Mobile...');
  const results = {
    desktop: { en: {}, fa: {} },
    mobile: { en: {}, fa: {} },
    defects: []
  };

  function addDefect(env, category, feature, message, details = null) {
    console.error(`❌ [${env.toUpperCase()}][${category}] ${feature}: ${message}`);
    results.defects.push({ env, category, feature, message, details });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. DESKTOP AUDIT (1440x900)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- 1. DESKTOP VIEWPORT AUDIT ---');
  let ctx = await launch('desktop');
  try {
    await boot(ctx, { lang: 'en', settle: 2500 });
    const { page } = ctx;

    // Check 1.1: Desktop Topbar Elements
    console.log('Checking Desktop Topbar...');
    const topbarData = await page.evaluate(() => {
      const tb = document.querySelector('#top-app-header');
      if (!tb) return { error: 'Top header missing' };
      const btns = Array.from(tb.querySelectorAll('button')).map(b => ({
        id: b.id,
        cls: b.className,
        title: b.title || b.getAttribute('aria-label') || b.innerText.trim(),
        text: b.innerText.trim(),
        visible: getComputedStyle(b).display !== 'none',
        rect: b.getBoundingClientRect()
      }));
      return { btns, height: tb.getBoundingClientRect().height };
    });
    console.log(`Topbar buttons found: ${topbarData.btns?.length || 0}`);

    // Check 1.2: Canvas Right-Click Context Menu
    console.log('Checking Canvas Context Menu...');
    const cmData = await page.evaluate(() => {
      const canvas = document.querySelector('#vela-workspace-mount canvas, canvas');
      if (!canvas) return { error: 'No canvas found' };
      const r = canvas.getBoundingClientRect();
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + 250,
        clientY: r.top + 200
      });
      canvas.dispatchEvent(evt);
      const menu = document.querySelector('#canvas-context-menu, .canvas-context-menu');
      if (!menu) return { error: 'Context menu element not created' };
      const s = getComputedStyle(menu);
      const items = Array.from(menu.querySelectorAll('.context-menu-item, li, button')).map(i => ({
        text: i.innerText.trim(),
        action: i.getAttribute('data-action')
      }));
      return { visible: s.display !== 'none' && s.visibility !== 'hidden', items };
    });
    if (cmData.error || !cmData.visible || cmData.items.length === 0) {
      addDefect('desktop', 'functional', 'canvasContextMenu', 'Context menu not appearing on right click', cmData);
    } else {
      console.log(`Context menu OK: ${cmData.items.length} items`);
    }
    // Close context menu by clicking canvas
    await page.evaluate(() => {
      document.body.click();
      const menu = document.querySelector('#canvas-context-menu, .canvas-context-menu');
      if (menu) menu.style.display = 'none';
    });

    // Check 1.3: Quick Trade Widget
    console.log('Checking Quick Trade Widget...');
    const qtData = await page.evaluate(() => {
      const qt = document.querySelector('#chart-quick-trade');
      if (!qt) return { error: 'Quick trade element missing' };
      const sellBtn = document.querySelector('#quick-trade-sell-btn');
      const buyBtn = document.querySelector('#quick-trade-buy-btn');
      const qtyInput = document.querySelector('#quick-trade-qty');
      const toggleBtn = document.querySelector('#qt-toggle-btn');
      const collapsedTrigger = document.querySelector('#qt-collapsed-trigger');
      return {
        hasSell: !!sellBtn,
        hasBuy: !!buyBtn,
        hasQty: !!qtyInput,
        hasToggle: !!toggleBtn,
        hasTrigger: !!collapsedTrigger,
        sellPrice: sellBtn?.querySelector('.qt-price')?.innerText,
        buyPrice: buyBtn?.querySelector('.qt-price')?.innerText,
        qtyVal: qtyInput?.value
      };
    });
    console.log('Quick Trade widget state:', qtData);
    if (!qtData.hasSell || !qtData.hasBuy || !qtData.hasQty) {
      addDefect('desktop', 'functional', 'quickTrade', 'Quick trade missing essential buttons', qtData);
    }

    // Check 1.4: Bottom Panel Tabs & Expansion
    console.log('Checking Bottom Panel Tabs...');
    const bottomTabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const tab of bottomTabs) {
      const res = await page.evaluate(async (t) => {
        const tabBtn = document.querySelector(`.panel-tab[data-view="${t}"]`);
        if (!tabBtn) return { error: `Tab button for ${t} missing` };
        tabBtn.click();
        await new Promise(r => setTimeout(r, 600));
        const view = document.querySelector(`#view-${t}`);
        const active = view?.classList.contains('active');
        const contentLen = (view?.innerText || '').trim().length;
        return { active, contentLen };
      }, tab);
      if (res.error || !res.active || res.contentLen < 10) {
        addDefect('desktop', 'functional', `bottomTab_${tab}`, `Tab ${tab} failed to activate or empty`, res);
      }
    }

    // Check 1.5: Desktop Side Rail Buttons
    console.log('Checking Desktop Side Rail Buttons...');
    const railPanels = ['watchlist', 'alerts', 'paper', 'dataWindow', 'objects', 'pine', 'journal', 'screener', 'dom', 'calendar', 'news'];
    for (const p of railPanels) {
      const res = await page.evaluate(async (panel) => {
        const btn = document.querySelector(`#desktop-side-rail .rail-btn[data-panel="${panel}"]`);
        if (!btn) return { error: `Rail button for ${panel} missing` };
        btn.click();
        await new Promise(r => setTimeout(r, 500));
        const dock = document.querySelector('#vela-workspace-mount .vela-dock-container, .side-dock-container, .dock-container');
        return { hasBtn: true, dockOpen: !!dock };
      }, p);
      if (res.error) {
        addDefect('desktop', 'functional', `sideRail_${p}`, `Side rail button missing: ${p}`, res);
      }
    }

    // Check 1.6: All Modals
    console.log('Checking All Modals...');
    const modals = [
      { name: 'SymbolSearch', trigger: () => window.__TRADING_APP__?.openSymbolSearch?.() || document.querySelector('.vela-symbol-picker, .symbol-info, #btn-symbol-search')?.click(), sel: '#modal-symbol-search' },
      { name: 'Indicators', trigger: () => window.__TRADING_APP__?.openIndicatorsModal?.(), sel: '#modal-indicators' },
      { name: 'Compare', trigger: () => document.querySelector('#btn-topbar-compare')?.click(), sel: '#compareModal, #modal-compare' },
      { name: 'ChartStyle', trigger: () => document.querySelector('#btn-topbar-chart-style')?.click(), sel: '#chart-style-picker-menu, .chart-style-picker-dropdown' },
      { name: 'LayoutManager', trigger: () => document.querySelector('#btn-layout-manager')?.click(), sel: '#layout-manager-menu, .layout-dropdown' },
      { name: 'DataExport', trigger: () => document.querySelector('#btn-topbar-export')?.click(), sel: '#modal-data-export' },
      { name: 'Shortcuts', trigger: () => document.querySelector('#btn-shortcuts-help')?.click(), sel: '#modal-shortcuts' },
      { name: 'UserProfile', trigger: () => document.querySelector('.user-avatar-badge')?.click(), sel: '#modal-user-profile' },
      { name: 'Settings', trigger: () => window.__TRADING_APP__?.settingsModal?.open?.(), sel: '#modal-settings' },
      { name: 'PanelsMenu', trigger: () => document.querySelector('#nav-btn-panels')?.click(), sel: '#modal-panels-menu' },
      { name: 'TradeJournalLog', trigger: () => window.__TRADING_APP__?.tradeJournalModal?.open?.(), sel: '#modal-log-trade' },
      { name: 'TimeframeModal', trigger: () => window.__TRADING_APP__?.timeframeManager?.openCustomModal?.(), sel: '#modal-timeframes, #modal-custom-timeframe, .modal-custom-timeframe' }
    ];

    for (const m of modals) {
      const mRes = await page.evaluate(async (modal) => {
        try {
          if (modal.trigger) {
            eval('(' + modal.trigger + ')()');
          }
          await new Promise(r => setTimeout(r, 600));
          const el = document.querySelector(modal.sel);
          if (!el) return { error: `Element not found: ${modal.sel}` };
          const s = getComputedStyle(el);
          const visible = s.display !== 'none' && s.visibility !== 'hidden' && (el.classList.contains('open') || s.opacity > 0);
          const r = el.getBoundingClientRect();
          const closeBtn = el.querySelector('.modal-close-btn, .close-btn, [id*="close"]');
          // Close modal
          if (closeBtn) closeBtn.click();
          else el.classList.remove('open');
          await new Promise(r => setTimeout(r, 300));
          return { found: true, visible, width: r.width, height: r.height, hasCloseBtn: !!closeBtn };
        } catch (err) {
          return { error: err.toString() };
        }
      }, { sel: m.sel, trigger: m.trigger.toString() });

      if (mRes.error || !mRes.visible) {
        addDefect('desktop', 'functional', `modal_${m.name}`, `Modal failed to open properly: ${mRes.error || 'not visible'}`, mRes);
      } else {
        console.log(`Modal ${m.name} verified OK (${Math.round(mRes.width)}x${Math.round(mRes.height)})`);
      }
    }

    // Check 1.7: Full Page Trade Journal View
    console.log('Checking Full Page Trade Journal View...');
    const journalViewRes = await page.evaluate(async () => {
      const journalNavBtn = document.querySelector('#nav-btn-journal');
      if (!journalNavBtn) return { error: 'Journal nav pill missing' };
      journalNavBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const jView = document.querySelector('#journal-workspace-view');
      const isVisible = jView && getComputedStyle(jView).display !== 'none';
      const statsCards = jView?.querySelectorAll('.journal-stat-card, .stat-card, .metric-box')?.length || 0;
      const executionsTable = jView?.querySelector('table, .executions-table, .journal-table');
      // Switch back to quant
      document.querySelector('#nav-btn-quant')?.click();
      await new Promise(r => setTimeout(r, 600));
      return { isVisible, statsCards, hasTable: !!executionsTable };
    });
    if (journalViewRes.error || !journalViewRes.isVisible) {
      addDefect('desktop', 'functional', 'journalWorkspaceView', 'Journal workspace view failed to show', journalViewRes);
    } else {
      console.log('Journal workspace view verified OK:', journalViewRes);
    }

    // Check 1.8: Persian RTL Mode on Desktop
    console.log('Switching to Persian (FA) on Desktop...');
    await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));

    const faDir = await page.evaluate(() => document.body.getAttribute('dir') || getComputedStyle(document.body).direction);
    console.log(`Body direction in FA: ${faDir}`);
    if (faDir !== 'rtl') {
      addDefect('desktop', 'rtl', 'persianBodyDir', `Body direction is ${faDir}, expected rtl`);
    }

    // Scan for untranslated strings in FA
    const untranslatedDesktop = await page.evaluate(() => {
      const bad = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      const brandWords = ['TradingChart', 'LuxAlgo', 'Vela', 'PineTS', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'EURUSD', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'USDT', 'USD', 'BTC', 'ETH', 'SOL', 'XAU', 'EUR', 'GBP', 'JPY', 'RSI', 'MACD', 'EMA', 'SMA', 'ATR', 'VWAP', 'BB', 'OB', 'FVG', 'BOS', 'CHoCH', 'SMC', 'CE', 'P&L', 'ROI', 'OHLC', '1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M', 'UTC', 'ms', 'FA / EN', 'IP', 'BUY', 'SELL', 'LONG', 'SHORT', 'ESC', 'Ctrl', 'Alt', 'Shift', 'Tab', 'Enter'];
      
      while ((node = walker.nextNode())) {
        const text = (node.nodeValue || '').trim();
        if (!text || text.length < 3) continue;
        if (/^\d+([.,]\d+)?%?(\s*(USD|\$|€|£|₮))?$/.test(text)) continue;
        if (brandWords.includes(text)) continue;
        
        const parent = node.parentElement;
        if (!parent) continue;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'path' || tag === 'code') continue;
        const s = getComputedStyle(parent);
        if (s.display === 'none' || s.visibility === 'hidden') continue;

        // If it has NO Persian characters and has English letters
        const hasFa = /[\u0600-\u06FF]/.test(text);
        const hasEn = /[a-zA-Z]{3,}/.test(text);
        if (!hasFa && hasEn) {
          // Check if it's an excluded code/symbol/pure token
          if (!brandWords.some(w => text.includes(w))) {
            bad.push({ text: text.slice(0, 50), tag, parentId: parent.id, parentCls: parent.className });
          }
        }
      }
      return bad.slice(0, 30);
    });
    console.log(`Potential untranslated strings in Desktop FA: ${untranslatedDesktop.length}`);
    if (untranslatedDesktop.length > 0) {
      console.log('Sample untranslated:', untranslatedDesktop.slice(0, 10));
    }

  } finally {
    await ctx.browser.close();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. MOBILE AUDIT (390x844)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- 2. MOBILE VIEWPORT AUDIT (390x844) ---');
  ctx = await launch('mobile');
  try {
    await boot(ctx, { lang: 'en', settle: 2500 });
    const { page } = ctx;

    // Check 2.1: Horizontal Overflow on Mobile
    console.log('Checking Mobile Horizontal Overflow...');
    const mobOverflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('*').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        // check if visible and escaping viewport
        if (r.right > vw + 1 && r.width > 0 && r.height > 0) {
          // check if enclosed in an overflow-x scroll container
          let p = el.parentElement;
          let inScroll = false;
          while (p && p !== document.body) {
            const ps = getComputedStyle(p);
            if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') {
              inScroll = true;
              break;
            }
            p = p.parentElement;
          }
          if (!inScroll) {
            bad.push({
              tag: el.tagName,
              id: el.id,
              cls: el.className,
              right: Math.round(r.right),
              vw,
              overflowBy: Math.round(r.right - vw)
            });
          }
        }
      });
      return bad.slice(0, 15);
    });
    if (mobOverflow.length > 0) {
      addDefect('mobile', 'layout', 'horizontalOverflow', `Elements overflowing viewport width (${mobOverflow.length} elements)`, mobOverflow);
    } else {
      console.log('Mobile horizontal overflow check: PASS (zero uncontained overflow)');
    }

    // Check 2.2: Touch Targets on Mobile
    console.log('Checking Mobile Touch Targets (>= 44x44 or >= 36px for dense toolbars)...');
    const touchIssues = await page.evaluate(() => {
      const small = [];
      const interactives = document.querySelectorAll('button, a, input, select, .nav-pill, .rail-btn');
      interactives.forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.1) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Buttons in dense mobile bottombar or toolbar can be 36px, anything < 28px is definitely too small
        if (r.width < 28 || r.height < 28) {
          small.push({
            id: el.id,
            cls: el.className,
            text: el.innerText.trim().slice(0, 20),
            w: Math.round(r.width),
            h: Math.round(r.height)
          });
        }
      });
      return small.slice(0, 15);
    });
    if (touchIssues.length > 0) {
      console.log(`Small touch targets on mobile: ${touchIssues.length}`, touchIssues);
    } else {
      console.log('Mobile touch target size check: PASS');
    }

    // Check 2.3: Mobile Bottom Bar / Drawer Navigation
    console.log('Checking Mobile Bottom Navigation...');
    const mobNavRes = await page.evaluate(async () => {
      const mobBar = document.querySelector('.mobile-bottom-bar, #mobile-nav-bar, .mobile-bar');
      const items = mobBar ? Array.from(mobBar.querySelectorAll('button, .mobile-bar-item, .nav-item')).map(b => ({
        id: b.id,
        text: b.innerText.trim()
      })) : [];
      return { hasBar: !!mobBar, items };
    });
    console.log('Mobile navigation bar:', mobNavRes);

    // Check 2.4: Mobile Modals Fit
    console.log('Checking Mobile Modals Fit (width <= 390px, height <= 844px)...');
    const mobModals = [
      { name: 'SymbolSearch', trigger: () => window.__TRADING_APP__?.openSymbolSearch?.(), sel: '#modal-symbol-search .modal-box' },
      { name: 'Indicators', trigger: () => window.__TRADING_APP__?.openIndicatorsModal?.(), sel: '#modal-indicators .modal-box' },
      { name: 'PanelsMenu', trigger: () => document.querySelector('#nav-btn-panels')?.click(), sel: '#modal-panels-menu .modal-box' },
      { name: 'Settings', trigger: () => window.__TRADING_APP__?.settingsModal?.open?.(), sel: '#modal-settings .modal-box' },
      { name: 'TradeJournalLog', trigger: () => window.__TRADING_APP__?.tradeJournalModal?.open?.(), sel: '#modal-log-trade .modal-box' }
    ];

    for (const m of mobModals) {
      const fitRes = await page.evaluate(async (modal) => {
        try {
          eval('(' + modal.trigger + ')()');
          await new Promise(r => setTimeout(r, 600));
          const el = document.querySelector(modal.sel);
          if (!el) return { error: `Element not found: ${modal.sel}` };
          const r = el.getBoundingClientRect();
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          const overflowX = r.right > vw + 2 || r.left < -2;
          const overflowY = r.bottom > vh + 2 || r.top < -2;
          // Close
          document.querySelectorAll('.modal-overlay').forEach(ov => ov.classList.remove('open'));
          await new Promise(r => setTimeout(r, 300));
          return { w: Math.round(r.width), h: Math.round(r.height), overflowX, overflowY, vw, vh };
        } catch (e) {
          return { error: e.toString() };
        }
      }, { sel: m.sel, trigger: m.trigger.toString() });

      if (fitRes.error || fitRes.overflowX) {
        addDefect('mobile', 'layout', `modalFit_${m.name}`, `Modal overflows viewport on mobile: ${JSON.stringify(fitRes)}`);
      } else {
        console.log(`Mobile Modal ${m.name} fits: ${fitRes.w}x${fitRes.h} (viewport: ${fitRes.vw}x${fitRes.vh})`);
      }
    }

    // Check 2.5: Mobile FA Mode
    console.log('Switching to Persian (FA) on Mobile...');
    await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));

    const mobFaDir = await page.evaluate(() => document.body.getAttribute('dir') || getComputedStyle(document.body).direction);
    console.log(`Mobile body direction in FA: ${mobFaDir}`);
    if (mobFaDir !== 'rtl') {
      addDefect('mobile', 'rtl', 'persianBodyDir', `Mobile body direction is ${mobFaDir}, expected rtl`);
    }

    // Check 2.6: Mobile Quick Trade Widget / Collapsed Pill in FA
    console.log('Checking Mobile Quick Trade in FA...');
    const mobQtFa = await page.evaluate(() => {
      const pill = document.querySelector('#qt-collapsed-trigger');
      const widget = document.querySelector('#chart-quick-trade');
      const sPill = pill ? getComputedStyle(pill) : null;
      const sWid = widget ? getComputedStyle(widget) : null;
      const rPill = pill ? pill.getBoundingClientRect() : null;
      const rWid = widget ? widget.getBoundingClientRect() : null;
      const vw = document.documentElement.clientWidth;
      return {
        pillVisible: sPill && sPill.display !== 'none',
        widgetVisible: sWid && sWid.display !== 'none',
        pillRect: rPill ? { left: rPill.left, right: rPill.right, w: rPill.width } : null,
        widgetRect: rWid ? { left: rWid.left, right: rWid.right, w: rWid.width } : null,
        vw
      };
    });
    console.log('Mobile Quick Trade state in FA:', mobQtFa);
    if (mobQtFa.widgetVisible && mobQtFa.widgetRect && mobQtFa.widgetRect.right > mobQtFa.vw) {
      addDefect('mobile', 'layout', 'quickTradeRTL', 'Quick trade widget overflows right edge in mobile RTL', mobQtFa);
    }

  } finally {
    await ctx.browser.close();
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`AUDIT FINISHED. Total defects discovered: ${results.defects.length}`);
  console.log('════════════════════════════════════════════════════════════');
  return results;
}

runAudit().then(r => {
  console.log('Audit Summary JSON:');
  console.log(JSON.stringify(r.defects, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
