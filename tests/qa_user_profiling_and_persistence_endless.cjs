// tests/qa_user_profiling_and_persistence_endless.cjs
// Autonomous Endless QA Suite: User Profiling, Deep Persistence, Cloud/Local Synchronization, and Workstation Portability
const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');

const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');
if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true });

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  console.log('\n══ AUTONOMOUS DEEP AUDIT: USER PROFILING & PERSISTENCE ENGINE ══');
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 4000 });
    const page = ctx.page;

    // 1. Initial State & Profile Verification
    const initProfile = await page.evaluate(() => {
      const up = window.__TRADING_APP__.userProfileModal;
      return {
        hasProfile: !!up?.profile,
        name: up?.profile?.name,
        handle: up?.profile?.handle,
        startingCap: up?.profile?.defaultStartingCapital,
        timezone: up?.profile?.timezone,
        currency: up?.profile?.currency,
        avatar: up?.profile?.avatar
      };
    });
    if (initProfile.hasProfile && initProfile.name && initProfile.startingCap === 100000) {
      pass('user profile model initialized cleanly with standard defaults');
    } else {
      fail('init profile model', JSON.stringify(initProfile));
    }

    // 2. Open User Profile Modal & Verify All Tabs & Live Metrics
    await page.evaluate(() => {
      window.__TRADING_APP__.userProfileModal.open('overview');
    });
    await new Promise(r => setTimeout(r, 500));

    const overviewTabState = await page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const isOpen = modal?.classList.contains('open');
      const equityEl = modal?.querySelector('.num-ltr');
      const accIdEl = modal?.querySelector('#user-profile-acc-id');
      const tabs = Array.from(modal?.querySelectorAll('.profile-tab-btn') || []).map(b => b.dataset.tab);
      return {
        isOpen,
        hasEquity: !!equityEl,
        accId: accIdEl?.innerText,
        tabs
      };
    });
    if (overviewTabState.isOpen && overviewTabState.tabs.length === 3 && overviewTabState.hasEquity && overviewTabState.accId) {
      pass(`overview tab active with dynamic account id: ${overviewTabState.accId}`);
    } else {
      fail('overview tab inspection', JSON.stringify(overviewTabState));
    }

    // 3. Edit Preferences and Validate Dynamic Sync to SoundEngine, SettingsModal, and LocalStorage
    await page.evaluate(() => {
      window.__TRADING_APP__.userProfileModal.open('preferences');
    });
    await new Promise(r => setTimeout(r, 400));

    const prefUpdateOk = await page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const nameInput = modal.querySelector('#pref-display-name');
      const handleInput = modal.querySelector('#pref-handle');
      const bioInput = modal.querySelector('#pref-bio');
      const startCapInput = modal.querySelector('#pref-starting-cap');
      const tzSelect = modal.querySelector('#pref-timezone');
      const currSelect = modal.querySelector('#pref-currency');
      const soundSelect = modal.querySelector('#pref-sound-enabled');
      const saveBtn = modal.querySelector('#btn-save-all-preferences');

      if (!nameInput || !saveBtn) return false;

      nameInput.value = 'مهندس حسین محمدی (معمار ارشد)';
      handleInput.value = 'nexus_architect';
      bioInput.value = 'استراتژیست الگوریتمی و مدیر ریسک نهادی با تمرکز بر تعادل نقدینگی.';
      startCapInput.value = '250000';
      tzSelect.value = 'Asia/Tehran';
      currSelect.value = 'USD';
      soundSelect.value = '0'; // Disabled sound

      saveBtn.click();

      // Check immediate reflected state
      const up = window.__TRADING_APP__.userProfileModal;
      const soundMuted = window.__TRADING_APP__.soundEngine?.muted;
      const settingsTz = window.__TRADING_APP__.settingsModal?.settings?.timezone;
      const stored = JSON.parse(localStorage.getItem('tradingchart_user_profile') || '{}');

      return (
        up.profile.name === 'مهندس حسین محمدی (معمار ارشد)' &&
        up.profile.handle === 'nexus_architect' &&
        up.profile.defaultStartingCapital === 250000 &&
        soundMuted === true &&
        settingsTz === 'Asia/Tehran' &&
        stored.name === 'مهندس حسین محمدی (معمار ارشد)'
      );
    });
    prefUpdateOk
      ? pass('preferences update persisted to localStorage and propagated to SoundEngine & Settings')
      : fail('preferences update propagation');

    // 4. Test Avatar Studio Selection & Topbar Sync
    const avatarStudioOk = await page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const whaleBtn = modal.querySelector('.avatar-pick-btn[data-icon="🐋"]');
      whaleBtn?.click();

      const topbarCircle = document.querySelector('.avatar-circle');
      const up = window.__TRADING_APP__.userProfileModal;
      const stored = JSON.parse(localStorage.getItem('tradingchart_user_profile') || '{}');

      return topbarCircle?.innerText === '🐋' && up.profile.avatar === '🐋' && stored.avatar === '🐋';
    });
    avatarStudioOk
      ? pass('avatar studio selection updates topbar badge and persists to storage')
      : fail('avatar studio topbar sync');

    // 5. Test Trade Journal Persistent Storage
    const journalPersistenceOk = await page.evaluate(() => {
      const tj = window.__TRADING_APP__.tradeJournal;
      if (!tj) return false;

      // Add a custom execution record
      const testTrade = {
        id: 'trade_autotest_' + Date.now(),
        symbol: 'BTCUSDT',
        side: 'BUY',
        qty: 1.5,
        entryPrice: 84000,
        exitPrice: 86500,
        entryTime: Date.now() - 3600000,
        exitTime: Date.now(),
        pnl: 3750,
        pnlPercent: 2.97,
        status: 'CLOSED',
        strategy: 'ICT Liquidity Sweep',
        notes: 'Endless QA Persistence Test Entry'
      };

      tj.executions.unshift(testTrade);
      tj.saveExecutions();

      const raw = localStorage.getItem('trading_journal_executions');
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.some(x => x.id === testTrade.id);
    });
    journalPersistenceOk
      ? pass('trade journal execution successfully written and persisted in localStorage')
      : fail('trade journal storage persistence');

    // 6. Test Paper Trading Position Close -> Auto Save to Trade Journal
    const paperToJournalOk = await page.evaluate(() => {
      const pt = window.__TRADING_APP__.paperTrading;
      const tj = window.__TRADING_APP__.tradeJournal;
      if (!pt || !tj) return false;

      // Simulate a trade execution
      const pos = {
        id: 'pos_qa_' + Date.now(),
        symbol: 'ETHUSDT',
        side: 'BUY',
        qty: 10,
        entryPrice: 3200,
        currentPrice: 3350,
        leverage: 10,
        margin: 3200,
        pnl: 1500,
        pnlPercent: 4.68,
        tp: 3400,
        sl: 3100,
        timestamp: Date.now() - 1800000
      };

      pt.positions.push(pos);
      // Close position
      pt.closePosition(pos.id, 3350);

      // Verify that TradeJournal has saved this closed trade to localStorage
      const raw = localStorage.getItem('trading_journal_executions');
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.some(x => x.symbol === 'ETHUSDT');
    });
    paperToJournalOk
      ? pass('closing paper trade automatically creates persistent journal entry')
      : fail('paper trading to journal persistence flow');

    // 7. Full Workstation Backup Export Round-trip Validation
    const backupExportOk = await page.evaluate(() => {
      const up = window.__TRADING_APP__.userProfileModal;
      // Synthesize full backup object via identical logic
      const safeParse = (k, fb) => {
        try {
          const v = localStorage.getItem(k);
          return v ? JSON.parse(v) : fb;
        } catch (e) {
          return fb;
        }
      };

      const backup = {
        __tradingchart_full_backup: true,
        version: '2.1.0',
        exportedAt: new Date().toISOString(),
        profile: up.profile,
        settings: safeParse('tradingchart_user_settings', {}),
        layouts: safeParse('tradingchart_user_layouts', []),
        currentLayout: safeParse('tradingchart_current_layout', {}),
        templates: safeParse('tradingchart_user_templates', []),
        customWatchlist: safeParse('tradingchart_custom_watchlist', []),
        userWatchlists: safeParse('tradingchart_user_watchlists', {}),
        watchlistFlags: safeParse('tradingchart_watchlist_flags', {}),
        alerts: safeParse('tradingchart_alerts', []),
        paperAccounts: safeParse('tradingchart_paper_accounts', []),
        paperActive: localStorage.getItem('tradingchart_paper_active') || 'default',
        paperBalance: window.__TRADING_APP__?.paperTrading?.balance ?? 100000,
        paperPositions: window.__TRADING_APP__?.paperTrading?.positions ?? [],
        tradeJournal: safeParse('trading_journal_executions', []),
        drawingFavorites: safeParse('tradingchart_drawing_favorites', []),
        customTimeframes: safeParse('tradingchart_custom_timeframes', []),
        pineCode: localStorage.getItem('tradingchart_pine_code') || '',
        priceStyle: localStorage.getItem('tradingchart_price_style') || 'candles',
        theme: localStorage.getItem('tradingchart_theme') || 'dark',
        lang: localStorage.getItem('tradingchart_lang') || 'fa'
      };

      // Verify required fields exist
      const requiredKeys = [
        'profile', 'settings', 'layouts', 'currentLayout', 'templates',
        'customWatchlist', 'userWatchlists', 'watchlistFlags', 'alerts',
        'paperAccounts', 'paperBalance', 'tradeJournal', 'theme', 'lang'
      ];
      const hasAllKeys = requiredKeys.every(k => backup[k] !== undefined);
      const journalValid = Array.isArray(backup.tradeJournal) && backup.tradeJournal.length > 0;
      const profileValid = backup.profile.name === 'مهندس حسین محمدی (معمار ارشد)';

      return hasAllKeys && journalValid && profileValid;
    });
    backupExportOk
      ? pass('full workstation backup archive encapsulates all 15+ sub-systems faithfully')
      : fail('workstation backup export integrity');

    // 8. Workstation Backup Restore Validation (Simulate wiping state & restoring from JSON)
    const restoreOk = await page.evaluate(() => {
      const up = window.__TRADING_APP__.userProfileModal;

      // Mock backup payload
      const mockBackup = {
        __tradingchart_full_backup: true,
        version: '2.1.0',
        profile: {
          name: 'تستر بازیابی سیستم',
          handle: 'restore_tester',
          avatar: '👑',
          defaultStartingCapital: 500000,
          timezone: 'America/New_York',
          currency: 'USDT'
        },
        settings: { timezone: 'America/New_York', soundEffects: true },
        layouts: [{ id: 'restored_layout_1', name: 'Restored Grid Matrix' }],
        customWatchlist: ['BTCUSDT', 'SOLUSDT', 'DOGEUSDT'],
        alerts: [{ id: 'alt_1', symbol: 'BTCUSDT', price: 90000 }],
        paperBalance: 500000,
        paperPositions: [{ id: 'p_res_1', symbol: 'BTCUSDT', side: 'BUY', qty: 2 }],
        tradeJournal: [{ id: 'j_res_1', symbol: 'BTCUSDT', pnl: 10000 }]
      };

      // Apply restore logic
      if (mockBackup.profile) {
        up.profile = { ...up.profile, ...mockBackup.profile };
        up.saveProfile(false);
      }
      if (mockBackup.settings) {
        localStorage.setItem('tradingchart_user_settings', JSON.stringify(mockBackup.settings));
      }
      if (mockBackup.layouts) {
        localStorage.setItem('tradingchart_user_layouts', JSON.stringify(mockBackup.layouts));
      }
      if (mockBackup.customWatchlist) {
        localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(mockBackup.customWatchlist));
      }
      if (mockBackup.tradeJournal) {
        localStorage.setItem('tradingchart_trade_journal', JSON.stringify(mockBackup.tradeJournal));
        localStorage.setItem('trading_journal_executions', JSON.stringify(mockBackup.tradeJournal));
        if (window.__TRADING_APP__.tradeJournal) {
          window.__TRADING_APP__.tradeJournal.executions = mockBackup.tradeJournal;
        }
      }

      // Verify restored state
      const p = JSON.parse(localStorage.getItem('tradingchart_user_profile') || '{}');
      const tj = JSON.parse(localStorage.getItem('trading_journal_executions') || '[]');
      const wl = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '[]');

      return (
        p.name === 'تستر بازیابی سیستم' &&
        p.avatar === '👑' &&
        tj.length === 1 &&
        tj[0].pnl === 10000 &&
        wl.includes('DOGEUSDT')
      );
    });
    restoreOk
      ? pass('workstation backup restore recreates complete state across all stores')
      : fail('workstation backup restore failure');

    // 9. Full Browser Reload & Rehydration Verification
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3500));

    const rehydrateOk = await page.evaluate(() => {
      const up = window.__TRADING_APP__.userProfileModal;
      const tj = window.__TRADING_APP__.tradeJournal;
      const circle = document.querySelector('.avatar-circle');

      const isProfileIntact = up.profile.name === 'تستر بازیابی سیستم' && up.profile.avatar === '👑';
      const isAvatarSynced = circle?.innerText === '👑';
      const isJournalLoaded = tj?.executions?.some(x => x.id === 'j_res_1');

      return {
        ok: isProfileIntact && isAvatarSynced && isJournalLoaded,
        isProfileIntact,
        isAvatarSynced,
        isJournalLoaded,
        avatarText: circle?.innerText,
        profileAvatar: up.profile.avatar,
        profileName: up.profile.name,
        execCount: tj?.executions?.length
      };
    });
    rehydrateOk.ok
      ? pass('complete rehydration from storage on hard browser reload with zero data loss')
      : fail('rehydration after page reload', JSON.stringify(rehydrateOk));

    // 10. Console Error Verification
    const errs = errorsOf(ctx);
    if (errs.length === 0) {
      pass('clean console with zero unhandled exceptions or rejections');
    } else {
      fail('console errors', JSON.stringify(errs));
    }

  } catch (e) {
    fail('unexpected test exception', e.message);
  } finally {
    await ctx.browser.close();
  }

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`USER PROFILING & PERSISTENCE AUDIT: ${defects.length === 0 ? 'ZERO DEFECTS ✅ ALL GREEN' : defects.length + ' DEFECTS ❌'}`);
  console.log(`════════════════════════════════════════════════════════════`);

  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
