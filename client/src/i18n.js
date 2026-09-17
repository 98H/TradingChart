// client/src/i18n.js
// Internationalization & Full DOM Translation Engine for English & Persian

export const translations = {
  en: {
    brandName: 'TradingChart',
    brandTag: 'PRO',
    symbolSearchPlaceholder: 'Search symbol (e.g. BTC, ETH, XAU, AAPL)...',
    indicatorsBtn: 'Indicators (80+)',
    layoutSingle: 'Single Chart (1x1)',
    layout2h: 'Dual Horizontal (2x1)',
    layout2v: 'Dual Vertical (1x2)',
    layout4: 'Quad Grid (2x2)',
    replayBtn: 'Replay',
    undoTitle: 'Undo (Ctrl+Z)',
    redoTitle: 'Redo (Ctrl+Y)',
    screenshotTitle: 'Take High-Res Screenshot',
    fullscreenTitle: 'Toggle Fullscreen',
    settingsTitle: 'Settings',
    sidebarTitle: 'Toggle Sidebar',
    tabWatchlist: 'Watchlist',
    tabTrade: 'Trade',
    tabAlerts: 'Alerts',
    tabPine: 'Pine Editor',
    tabStrategy: 'Strategy Tester',
    tabPropsim: 'Prop-Firm Simulator',
    tabJournal: 'Trade Journal',
    tabTrackers: 'Market Trackers (SEC)',
    liveBadge: 'LIVE 12ms',

    // Candle styles
    styleCandles: 'Candles',
    styleHollow: 'Hollow Candles',
    styleBars: 'Bars',
    styleLine: 'Line',
    styleArea: 'Area',
    styleHeikin: 'Heikin-Ashi',

    // Modal Titles
    indicatorsModalTitle: 'Indicators, Metrics & Strategies',
    symbolModalTitle: 'Symbol Search (Universal Universe)',
    settingsModalTitle: 'Chart Settings & Preferences',

    // Watchlist
    categoryCrypto: 'Crypto Top Assets',
    categoryMetals: 'Metals & Commodities',
    categoryForex: 'Forex Majors',
    categoryEquities: 'Indices & US Tech',
    categoryCustom: '★ Custom Watchlist',
    addSymbolPlaceholder: '+ Add symbol...',
    addBtn: 'Add',

    // Pine Studio
    pineNewBtn: 'New',
    pineSaveBtn: 'Save',
    pineCompileBtn: 'Add to Chart',
    pineBacktestBtn: 'Backtest Strategy',
    pineDiagTitle: 'Diagnostics Console',
    pineDiagReady: 'Ready. Click \'Add to Chart\' to compile Pine Script.',

    // Strategy Tester
    metricNetProfit: 'Net Profit',
    metricProfitFactor: 'Profit Factor',
    metricWinRate: 'Win Rate',
    metricMaxDrawdown: 'Max Drawdown',
    exportPropSimBtn: 'Export to Prop-Sim →',
    equityCurveTitle: 'Equity Curve ($)',
    recentTradesTitle: 'Recent Closed Trades',

    // Prop Firm
    propPresetLabel: 'Firm Challenge Preset',
    propWinRateLabel: 'Win Rate (%)',
    propRRLabel: 'R:R Ratio (Avg Win R)',
    propRiskLabel: 'Risk Per Trade (%)',
    propTPDLabel: 'Trades Per Day',
    propRunBtn: '⚡ Run Monte Carlo (500 Paths)',
    propCardPassProb: 'Pass Probability',
    propCardRuin: 'Risk of Ruin',
    propCardEV: 'Expected Value (EV)',
    propCardDays: 'Median Days to Funded',

    // Trade Journal
    journalMonthPnl: 'Monthly Realized P&L',
    journalWinRate: 'Win Rate',
    journalEdgeScore: 'Edge Score v2',
    journalBestDay: 'Best Day',
    journalHeatmapTitle: 'P&L Calendar Heatmap (September 2026)',
    journalActiveDays: '25 Active Trading Days',

    // Trackers Subtabs
    trackersSubCongress: 'Congressional Stock Trades',
    trackersSubInsider: 'SEC Form 4 Insider Trades',
    trackersSub13f: 'Hedge Fund 13F Portfolios',
    trackersSubShort: 'FINRA Short Sale Volume'
  },
  fa: {
    brandName: 'تریدینگ‌چارت',
    brandTag: 'حرفه‌ای',
    symbolSearchPlaceholder: 'جستجوی نماد (مانند BTC، طلا، نفت، اپل)...',
    indicatorsBtn: 'اندیکاتورها (۸۰+)',
    layoutSingle: 'تک‌چارت (۱×۱)',
    layout2h: 'دوچارت افقی (۲×۱)',
    layout2v: 'دوچارت عمودی (۱×۲)',
    layout4: 'چهارچارت (۲×۲)',
    replayBtn: 'بازپخش کندل‌ها',
    undoTitle: 'واگرد (Ctrl+Z)',
    redoTitle: 'ازنو (Ctrl+Y)',
    screenshotTitle: 'عکس از چارت با کیفیت بالا',
    fullscreenTitle: 'تمام‌صفحه',
    settingsTitle: 'تنظیمات چارت',
    sidebarTitle: 'سایدبار دیده‌بان',
    tabWatchlist: 'دیده‌بان',
    tabTrade: 'معاملات دمو',
    tabAlerts: 'هشدارها',
    tabPine: 'ویرایشگر پاین',
    tabStrategy: 'بک‌تستر استراتژی',
    tabPropsim: 'شبیه‌ساز پراپ‌فرم',
    tabJournal: 'ژورنال معاملات',
    tabTrackers: 'شفافیت بازار و نهنگ‌ها',
    liveBadge: 'زنده ۱۲ میلی‌ثانیه',

    // Candle styles
    styleCandles: 'کندل‌استیک',
    styleHollow: 'کندل‌های توخالی',
    styleBars: 'نمودار میله‌ای',
    styleLine: 'نمودار خطی',
    styleArea: 'نمودار ناحیه‌ای',
    styleHeikin: 'هیکن‌آشی',

    // Modal Titles
    indicatorsModalTitle: 'دایره‌المعارف اندیکاتورها و استراتژی‌ها',
    symbolModalTitle: 'جستجوی نماد در تمام بازارها',
    settingsModalTitle: 'تنظیمات و سفارشی‌سازی چارت',

    // Watchlist
    categoryCrypto: 'ارزهای دیجیتال برتر',
    categoryMetals: 'فلزات و کالاها (طلا و نفت)',
    categoryForex: 'جفت‌ارزهای فارکس',
    categoryEquities: 'شاخص‌ها و غول‌های فناوری',
    categoryCustom: '★ دیده‌بان اختصاصی',
    addSymbolPlaceholder: '+ افزودن نماد...',
    addBtn: 'افزودن',

    // Pine Studio
    pineNewBtn: 'اسکریپت جدید',
    pineSaveBtn: 'ذخیره',
    pineCompileBtn: 'افزودن به چارت',
    pineBacktestBtn: 'بک‌تست استراتژی',
    pineDiagTitle: 'کنسول عیب‌یابی و خطاها',
    pineDiagReady: 'کنسول آماده است. برای کامپایل پاین روی «افزودن به چارت» کلیک کنید.',

    // Strategy Tester
    metricNetProfit: 'سود خالص کل',
    metricProfitFactor: 'فاکتور سودآوری',
    metricWinRate: 'نرخ برد (Win Rate)',
    metricMaxDrawdown: 'حداکثر افت سرمایه',
    exportPropSimBtn: 'انتقال به شبیه‌ساز پراپ →',
    equityCurveTitle: 'نمودار رشد سرمایه (Equity Curve)',
    recentTradesTitle: 'معاملات بسته‌شده اخیر',

    // Prop Firm
    propPresetLabel: 'قالب چالش شرکت پراپ',
    propWinRateLabel: 'نرخ برد (%)',
    propRRLabel: 'نسبت ریسک به ریوارد',
    propRiskLabel: 'ریسک روی هر معامله (%)',
    propTPDLabel: 'تعداد معامله در روز',
    propRunBtn: '⚡ اجرای مونت‌کارلو (۵۰۰ مسیر)',
    propCardPassProb: 'احتمال واقعی قبولی',
    propCardRuin: 'ریسک سوختن حساب',
    propCardEV: 'امید ریاضی سود نهایی',
    propCardDays: 'میانه روزها تا دریافت سرمایه',

    // Trade Journal
    journalMonthPnl: 'سود و زیان محقق‌شده ماه',
    journalWinRate: 'نرخ برد معاملات',
    journalEdgeScore: 'امتیاز مهارت معاملاتی (Edge)',
    journalBestDay: 'سودآورترین روز هفته',
    journalHeatmapTitle: 'تقویم حرارتی ماهانه سود و زیان (سپتامبر ۲۰۲۶)',
    journalActiveDays: '۲۵ روز معاملاتی فعال',

    // Trackers Subtabs
    trackersSubCongress: 'معاملات نمایندگان کنگره آمریکا',
    trackersSubInsider: 'معاملات مدیران ارشد (SEC Form 4)',
    trackersSub13f: 'پرتفوی صندوق‌های تامینی وال‌استریت',
    trackersSubShort: 'آمار حجم معاملات شورت FINRA'
  }
};

let currentLang = 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.body.classList.toggle('persian-mode', lang === 'fa');
    applyTranslationsToDOM();
  }
}

export function getLanguage() {
  return currentLang;
}

export function t(key) {
  return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

export function applyTranslationsToDOM() {
  const dict = translations[currentLang];
  if (!dict) return;

  // Header Brand
  const brandName = document.querySelector('#brand-logo-btn span:first-of-type');
  if (brandName) brandName.innerText = dict.brandName;
  const brandTag = document.querySelector('#brand-logo-btn .badge-tag');
  if (brandTag) brandTag.innerText = dict.brandTag;

  // Indicators button
  const btnInd = document.querySelector('#btn-open-indicators span');
  if (btnInd) btnInd.innerText = dict.indicatorsBtn;

  // Replay button
  const btnReplay = document.querySelector('#btn-toggle-replay span');
  if (btnReplay) btnReplay.innerText = dict.replayBtn;

  // Layout options
  const selLayout = document.querySelector('#header-layout-select');
  if (selLayout && selLayout.options.length >= 4) {
    selLayout.options[0].text = dict.layoutSingle;
    selLayout.options[1].text = dict.layout2h;
    selLayout.options[2].text = dict.layout2v;
    selLayout.options[3].text = dict.layout4;
  }

  // Style options
  const selStyle = document.querySelector('#header-style-select');
  if (selStyle && selStyle.options.length >= 6) {
    selStyle.options[0].text = dict.styleCandles;
    selStyle.options[1].text = dict.styleHollow;
    selStyle.options[2].text = dict.styleBars;
    selStyle.options[3].text = dict.styleLine;
    selStyle.options[4].text = dict.styleArea;
    selStyle.options[5].text = dict.styleHeikin;
  }

  // Sidebar Tabs
  const tabWl = document.querySelector('.sidebar-tab-btn[data-tab="watchlist"]');
  if (tabWl) tabWl.childNodes[tabWl.childNodes.length - 1].textContent = ` ${dict.tabWatchlist}`;
  const tabPaper = document.querySelector('.sidebar-tab-btn[data-tab="paper"]');
  if (tabPaper) tabPaper.childNodes[tabPaper.childNodes.length - 1].textContent = ` ${dict.tabTrade}`;
  const tabAlerts = document.querySelector('.sidebar-tab-btn[data-tab="alerts"]');
  if (tabAlerts) tabAlerts.childNodes[tabAlerts.childNodes.length - 1].textContent = ` ${dict.tabAlerts}`;

  // Bottom Panel Tabs
  const pTabPine = document.querySelector('.panel-tab[data-view="pine"]');
  if (pTabPine) pTabPine.childNodes[pTabPine.childNodes.length - 1].textContent = ` ${dict.tabPine}`;
  const pTabStrategy = document.querySelector('.panel-tab[data-view="strategy"]');
  if (pTabStrategy) pTabStrategy.childNodes[pTabStrategy.childNodes.length - 1].textContent = ` ${dict.tabStrategy}`;
  const pTabPropsim = document.querySelector('.panel-tab[data-view="propsim"]');
  if (pTabPropsim) pTabPropsim.childNodes[pTabPropsim.childNodes.length - 1].textContent = ` ${dict.tabPropsim}`;
  const pTabJournal = document.querySelector('.panel-tab[data-view="journal"]');
  if (pTabJournal) pTabJournal.childNodes[pTabJournal.childNodes.length - 1].textContent = ` ${dict.tabJournal}`;
  const pTabTrackers = document.querySelector('.panel-tab[data-view="trackers"]');
  if (pTabTrackers) pTabTrackers.childNodes[pTabTrackers.childNodes.length - 1].textContent = ` ${dict.tabTrackers}`;

  // Modals & inputs
  const inputSearch = document.querySelector('#symbol-search-input');
  if (inputSearch) inputSearch.placeholder = dict.symbolSearchPlaceholder;
  const inputWlAdd = document.querySelector('#wl-add-input');
  if (inputWlAdd) inputWlAdd.placeholder = dict.addSymbolPlaceholder;
}
