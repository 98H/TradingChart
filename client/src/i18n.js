// client/src/i18n.js
// Complete Internationalization Engine for TradingChart (English & Formal Persian with strict ZWNJ)

export const translations = {
  en: {
    // Header & Workspace
    navQuant: 'Quant',
    navJournal: 'Journal Workspace',
    navPanels: 'Panels',
    liveLatency: 'Live 12ms',
    toggleSideDock: 'Toggle Side Dock / Panels',
    langToggle: 'FA / EN',
    userProfile: 'Institutional Desk: TC-8942-INST',

    // Bottom Suite Tabs
    tabPine: 'Pine Editor',
    tabStrategy: 'Strategy Tester',
    tabPropsim: 'Prop-Firm Simulator',
    tabJournal: 'Trade Journal',
    tabTrackers: 'Trackers (SEC)',
    tabCalendar: 'Economic Calendar',
    tabScreener: 'Technical Screener',
    tabNews: 'Market News',

    // Panels Menu Drawer
    panelsMenuTitle: 'Workspace Panels & Tools',
    wlTitle: 'Watchlist',
    wlDesc: 'Live quotes, multi-asset search, categories',
    tradeTitle: 'Trade (Paper)',
    tradeDesc: 'Virtual execution, market/limit orders, P&L',
    alertsTitle: 'Alerts',
    alertsDesc: 'Price cross triggers & webhook relays',
    pineTitle: 'Pine Editor',
    pineDesc: 'Pine Script v5/v6 IDE, live compiler',
    strategyTitle: 'Strategy Tester',
    strategyDesc: 'PineTS backtest engine, Sharpe, drawdowns',
    propsimTitle: 'Prop-Firm Simulator',
    propsimDesc: '10,000 Monte Carlo paths, pass odds',
    journalTitle: 'Trade Journal',
    journalDesc: 'Monthly P&L calendar, edge score, analytics',
    trackersTitle: 'Market Trackers (SEC)',
    trackersDesc: 'Congressional trades, Insiders, 13F Hedge Funds',
    calendarTitle: 'Economic Calendar',
    calendarDesc: 'FOMC, CPI, NFP, GDP, Central Bank releases',
    screenerTitle: 'Technical Screener',
    screenerDesc: 'Live multi-asset RSI, SMA crosses, ratings',
    domTitle: 'Depth of Market (DOM)',
    domDesc: 'Level-2 order book ladder & 1-click limits',
    compareTitle: 'Compare & Overlay',
    compareDesc: 'Multi-symbol return % overlay & benchmarks',
    templatesTitle: 'Indicator Templates',
    templatesDesc: '1-click curated indicator setups',
    workspacesTitle: 'Workspaces',
    workspacesDesc: 'Multi-chart grid layouts & sync switches',

    // Symbol Search
    symbolModalTitle: 'Symbol Search & Market Navigator',
    symbolPlaceholder: 'Type symbol name (e.g. BTC, ETH, XAU, EURUSD, AAPL)...',
    instrumentsCount: '30+ Instruments',

    // Indicators Modal
    indicatorsModalTitle: 'Indicators, Metrics & Strategies (84+ Library)',
    indicatorsSearchPlaceholder: 'Search 84+ technical indicators, metrics & scripts...',
    indicatorsCountPrefix: 'Showing',
    indicatorsCountSuffix: 'of 84 indicators',

    // Settings Modal
    settingsModalTitle: 'Chart Settings & Preferences',
    candleAppearance: 'Candlestick Appearance',
    bullColor: 'Bullish Candle Color',
    bearColor: 'Bearish Candle Color',
    chartTimezone: 'Chart Timezone',
    gridLines: 'Grid Lines',
    colorTheme: 'Color Theme',
    interfaceLang: 'Interface Language',
    saveSettings: 'Save Settings',
    cancel: 'Cancel',

    // Tool Rail
    railWatchlist: 'Watchlist',
    railAlerts: 'Alerts',
    railTrade: 'Trade / Paper Execution',
    railDataWindow: 'Data Window',
    railObjectTree: 'Object Tree',
    railPine: 'Pine Editor',
    railJournal: 'Trade Journal',
    railScreener: 'Technical Screener',
    railDOM: 'Depth of Market (DOM)',
    railCalendar: 'Economic Calendar',
    railNews: 'Market News & Catalysts',

    // Quick Trade
    qtSell: 'SELL',
    qtBuy: 'BUY',
    qtTrade: 'Trade',
    qtQty: 'Quantity',
    qtSpread: 'Spread',
    layoutSave: 'Save',
    topbarReplay: 'Replay',

    // Mobile More Drawer
    moreUndo: 'Undo',
    moreRedo: 'Redo',
    moreScreenshot: 'Screenshot',
    moreChartType: 'Chart type',
    moreCandles: 'Candles',
    moreLayout: 'Layout',
    moreAlerts: 'Alerts',
    moreClose: 'Close'
  },
  fa: {
    // Header & Workspace
    navQuant: 'کوانت',
    navJournal: 'دفترچه جامع معاملات',
    navPanels: '+ پنل‌ها',
    liveLatency: 'زنده ۱۲ میلی‌ثانیه',
    toggleSideDock: 'باز و بسته کردن پنل‌های کناری',
    langToggle: 'EN / FA',
    userProfile: 'میز معاملات نهادی: TC-8942-INST',

    // Bottom Suite Tabs
    tabPine: 'ویرایشگر پاین',
    tabStrategy: 'بک‌تستر استراتژی',
    tabPropsim: 'شبیه‌ساز پراپ‌فرم',
    tabJournal: 'میز ژورنال معاملات',
    tabTrackers: 'پایش بازار \u200E(SEC)',
    tabCalendar: 'تقویم اقتصادی',
    tabScreener: 'دیده‌بان تکنیکال',
    tabNews: 'اخبار بازار',

    // Panels Menu Drawer
    panelsMenuTitle: 'پنل‌ها و ابزارهای تحلیلی فضای کاری',
    wlTitle: 'دیده‌بان دارایی‌ها (Watchlist)',
    wlDesc: 'نرخ لحظه‌ای، جستجوی چندبازاره و دسته‌بندی‌ها',
    tradeTitle: 'معاملات مجازی (Paper Trading)',
    tradeDesc: 'اجرای سفارش‌های مارکت و لیمیت، مدیریت مارجین و سود/زیان',
    alertsTitle: 'سیستم هشدار قیمت (Alerts)',
    alertsDesc: 'تریگرهای تقاطع قیمت و ارسال سیگنال وب‌هوک',
    pineTitle: 'ویرایشگر پاین‌اسکریپت (Pine Editor)',
    pineDesc: 'محیط توسعه IDE پاین نسخه ۵ و ۶ همراه کامپایلر زنده',
    strategyTitle: 'بک‌تستر استراتژی (Strategy Tester)',
    strategyDesc: 'موتور شبیه‌سازی پاین، محاسبه نسبت شارپ و افت سرمایه',
    propsimTitle: 'شبیه‌ساز آزمون پراپ‌فرم (Prop-Firm Sim)',
    propsimDesc: '۱۰،۰۰۰ مسیر شبیه‌سازی مونت‌کارلو و احتمال قبولی',
    journalTitle: 'ژورنال معاملات (Trade Journal)',
    journalDesc: 'تقویم حرارتی سود/زیان، امتیاز مهارت و تحلیل عملکرد',
    trackersTitle: 'شفافیت بازار و نهنگ‌ها (SEC Trackers)',
    trackersDesc: 'معاملات نمایندگان کنگره، اینسایدرها و صندوق‌های ۱۳F',
    calendarTitle: 'تقویم اقتصادی (Economic Calendar)',
    calendarDesc: 'رویدادهای ماکرو، FOMC، تورم و تصمیمات بانک‌های مرکزی',
    screenerTitle: 'دیده‌بان تکنیکال بازار (Screener)',
    screenerDesc: 'پایش لایو اندیکاتورها، RSI، تقاطع میانگین‌ها و سیگنال‌ها',
    domTitle: 'عمق بازار و دفتر سفارشات (DOM)',
    domDesc: 'دفتر سفارشات لول ۲، اسپرد لایو و اردر لیمیت یک‌کلیکه',
    compareTitle: 'مقایسه و همپوشانی (Compare & Overlay)',
    compareDesc: 'مقایسه همبستگی و بازدهی درصدی چند نماد',
    templatesTitle: 'قالب‌های منتخب اندیکاتور',
    templatesDesc: 'اعمال با یک کلیک ستاپ‌های تحلیل تکنیکال و اسمارت مانی',
    workspacesTitle: 'فضاهای کاری و چیدمان (Workspaces)',
    workspacesDesc: 'گرید چندچارته و کلیدهای همگام‌سازی ابزارها',

    // Symbol Search
    symbolModalTitle: 'جستجوی نماد در تمام بازارهای مالی',
    symbolPlaceholder: 'نام یا نماد دارایی را تایپ کنید (مانند BTC، طلا، نفت، اپل)...',
    instrumentsCount: 'بیش از ۳۰ نماد جهانی',

    // Indicators Modal
    indicatorsModalTitle: 'دایره‌المعارف اندیکاتورها و استراتژی‌ها (۸۴ ابزار تخصصی)',
    indicatorsSearchPlaceholder: 'جستجو در بین ۸۴ اندیکاتور تکنیکال، اسمارت مانی و حجم...',
    indicatorsCountPrefix: 'نمایش',
    indicatorsCountSuffix: 'از ۸۴ اندیکاتور تحلیلی',

    // Settings Modal
    settingsModalTitle: 'تنظیمات و سفارشی‌سازی چارت',
    candleAppearance: 'ظاهر و رنگ‌بندی کندل‌ها',
    bullColor: 'رنگ کندل‌های صعودی',
    bearColor: 'رنگ کندل‌های نزولی',
    chartTimezone: 'منطقه زمانی چارت',
    gridLines: 'خطوط شبکه پس‌زمینه',
    colorTheme: 'تم رنگی پلتفرم',
    interfaceLang: 'زبان رابط کاربری',
    saveSettings: 'ذخیره تنظیمات',
    cancel: 'انصراف',

    // Tool Rail
    railWatchlist: 'دیده‌بان',
    railAlerts: 'هشدارها',
    railTrade: 'معاملات دمو',
    railDataWindow: 'پنجره داده‌ها',
    railObjectTree: 'درخت لایه‌ها و ابزارها',
    railPine: 'ویرایشگر پاین',
    railJournal: 'ژورنال معاملات',
    railScreener: 'دیده‌بان تکنیکال',
    railDOM: 'عمق بازار و دفتر سفارشات (DOM)',
    railCalendar: 'تقویم اقتصادی',
    railNews: 'اخبار و کاتالیزورهای بازار',

    // Quick Trade
    qtSell: 'فروش',
    qtBuy: 'خرید',
    qtTrade: 'معامله',
    qtQty: 'حجم',
    qtSpread: 'اسپرد',
    layoutSave: 'ذخیره',
    topbarReplay: 'بازپخش',

    // Mobile More Drawer
    moreUndo: 'واگرد',
    moreRedo: 'ازنو',
    moreScreenshot: 'عکس‌برداری',
    moreChartType: 'نوع نمودار',
    moreCandles: 'کندل‌استیک',
    moreLayout: 'چیدمان',
    moreAlerts: 'هشدارها',
    moreClose: 'بستن'
  }
};

export function toPersianDigits(str) {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, w => farsiDigits[+w]);
}

let currentLang = 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    document.body.classList.toggle('persian-mode', lang === 'fa');
    applyTranslationsToDOM();
    localizeMoreDrawer();
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

  // 1. Header Navigation Pills
  const qEl = document.querySelector('#nav-label-quant');
  if (qEl) qEl.innerText = dict.navQuant;
  const jEl = document.querySelector('#nav-label-journal');
  if (jEl) jEl.innerText = dict.navJournal;
  const pEl = document.querySelector('#nav-label-panels');
  if (pEl) pEl.innerText = dict.navPanels;

  // 2. Bottom Suite Tabs
  const tabPine = document.querySelector('#tab-label-pine');
  if (tabPine) tabPine.innerText = dict.tabPine;
  const tabStrat = document.querySelector('#tab-label-strategy');
  if (tabStrat) tabStrat.innerText = dict.tabStrategy;
  const tabProp = document.querySelector('#tab-label-propsim');
  if (tabProp) tabProp.innerText = dict.tabPropsim;
  const tabJour = document.querySelector('#tab-label-journal');
  if (tabJour) tabJour.innerText = dict.tabJournal;
  const tabTrack = document.querySelector('#tab-label-trackers');
  if (tabTrack) tabTrack.innerHTML = currentLang === 'fa' ? '<span>پایش بازار</span> <span dir="ltr" style="display:inline-block;">(SEC)</span>' : 'Trackers';

  // 3. Panels Menu Modal Titles & Descs
  const panelsMenuTitle = document.querySelector('#panels-menu-title');
  if (panelsMenuTitle) panelsMenuTitle.innerText = dict.panelsMenuTitle;

  const panelItems = [
    { panel: 'watchlist', title: dict.wlTitle, desc: dict.wlDesc },
    { panel: 'paper', title: dict.tradeTitle, desc: dict.tradeDesc },
    { panel: 'alerts', title: dict.alertsTitle, desc: dict.alertsDesc },
    { panel: 'pine', title: dict.pineTitle, desc: dict.pineDesc },
    { panel: 'strategy', title: dict.strategyTitle, desc: dict.strategyDesc },
    { panel: 'propsim', title: dict.propsimTitle, desc: dict.propsimDesc },
    { panel: 'journal', title: dict.journalTitle, desc: dict.journalDesc },
    { panel: 'trackers', title: dict.trackersTitle, desc: dict.trackersDesc },
    { panel: 'calendar', title: dict.calendarTitle, desc: dict.calendarDesc },
    { panel: 'compare', title: dict.compareTitle, desc: dict.compareDesc },
    { panel: 'templates', title: dict.templatesTitle, desc: dict.templatesDesc },
    { panel: 'workspaces', title: dict.workspacesTitle, desc: dict.workspacesDesc }
  ];

  for (const item of panelItems) {
    const card = document.querySelector(`.panel-menu-item[data-panel="${item.panel}"]`);
    if (card) {
      const titleEl = card.querySelector('.panel-item-title');
      const descEl = card.querySelector('.panel-item-desc');
      if (titleEl) titleEl.innerText = item.title;
      if (descEl) descEl.innerText = item.desc;
    }
  }

  const tabCal = document.querySelector('#tab-label-calendar');
  if (tabCal) tabCal.innerText = dict.tabCalendar;

  const tabScr = document.querySelector('#tab-label-screener');
  if (tabScr) tabScr.innerText = dict.tabScreener;

  const tabNews = document.querySelector('#tab-label-news');
  if (tabNews) tabNews.innerText = dict.tabNews;

  const compareLabel = document.querySelector('#topbar-compare-label');
  if (compareLabel) compareLabel.innerText = currentLang === 'fa' ? 'مقایسه' : 'Compare';

  const exportLabel = document.querySelector('#topbar-export-label');
  if (exportLabel) exportLabel.innerText = currentLang === 'fa' ? 'خروجی' : 'Export';

  const railCal = document.querySelector('#desktop-side-rail .rail-btn[data-panel="calendar"]');
  if (railCal) railCal.title = dict.tabCalendar;

  const railScr = document.querySelector('#desktop-side-rail .rail-btn[data-panel="screener"]');
  if (railScr) railScr.title = dict.tabScreener;

  const railDom = document.querySelector('#desktop-side-rail .rail-btn[data-panel="dom"]');
  if (railDom) railDom.title = currentLang === 'fa' ? 'عمق بازار (DOM)' : 'Depth of Market (DOM)';

  // 4. Symbol Search Modal
  const symTitle = document.querySelector('#symbol-search-modal-title');
  if (symTitle) symTitle.innerText = dict.symbolModalTitle;
  const symInput = document.querySelector('#symbol-search-input');
  if (symInput) symInput.placeholder = dict.symbolPlaceholder;

  // 5. Indicators Modal
  const indTitle = document.querySelector('#ind-modal-title');
  if (indTitle) indTitle.innerText = dict.indicatorsModalTitle;
  const indSearch = document.querySelector('#ind-search-input');
  if (indSearch) indSearch.placeholder = dict.indicatorsSearchPlaceholder;

  // 6. Right Tool Rail Tooltips
  const railWl = document.querySelector('#desktop-side-rail .rail-btn[data-panel="watchlist"]');
  if (railWl) railWl.title = dict.railWatchlist;
  const railAlerts = document.querySelector('#desktop-side-rail .rail-btn[data-panel="alerts"]');
  if (railAlerts) railAlerts.title = dict.railAlerts;
  const railTrade = document.querySelector('#desktop-side-rail .rail-btn[data-panel="paper"]');
  if (railTrade) railTrade.title = dict.railTrade;
  const railData = document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]');
  if (railData) railData.title = dict.railDataWindow;
  const railObj = document.querySelector('#desktop-side-rail .rail-btn[data-panel="objects"]');
  if (railObj) railObj.title = dict.railObjectTree;
  const railPine = document.querySelector('#desktop-side-rail .rail-btn[data-panel="pine"]');
  if (railPine) railPine.title = dict.railPine;
  const railJour = document.querySelector('#desktop-side-rail .rail-btn[data-panel="journal"]');
  if (railJour) railJour.title = dict.railJournal;
  const railScreener = document.querySelector('#desktop-side-rail .rail-btn[data-panel="screener"]');
  if (railScreener) railScreener.title = dict.railScreener;
  const railDOM = document.querySelector('#desktop-side-rail .rail-btn[data-panel="dom"]');
  if (railDOM) railDOM.title = dict.railDOM;
  const railCalendar = document.querySelector('#desktop-side-rail .rail-btn[data-panel="calendar"]');
  if (railCalendar) railCalendar.title = dict.railCalendar;
  const railNews = document.querySelector('#desktop-side-rail .rail-btn[data-panel="news"]');
  if (railNews) railNews.title = dict.railNews;

  // 7. Vela topbar Indicators button translation
  const velaIndBtn = document.querySelector('.vela-widget-indicators');
  if (velaIndBtn) {
    const textNode = Array.from(velaIndBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.nodeValue = currentLang === 'fa' ? ' اندیکاتورها' : ' Indicators';
    }
  }

  // 8. Vela side panel dock header titles translation
  const panelTitlesMap = {
    alerts: currentLang === 'fa' ? 'سیستم هشدارها' : 'Alerts',
    watchlist: currentLang === 'fa' ? 'دیده‌بان دارایی‌ها' : 'Watchlist',
    paper: currentLang === 'fa' ? 'معاملات مجازی' : 'Trade',
    pine: currentLang === 'fa' ? 'ویرایشگر پاین' : 'Pine Editor',
    strategy: currentLang === 'fa' ? 'بک‌تستر استراتژی' : 'Strategy Tester',
    propsim: currentLang === 'fa' ? 'شبیه‌ساز پراپ‌فرم' : 'Prop-Firm Simulator',
    journal: currentLang === 'fa' ? 'ژورنال معاملات' : 'Trade Journal',
    trackers: currentLang === 'fa' ? 'شفافیت بازار و نهنگ‌ها' : 'Market Trackers',
    templates: currentLang === 'fa' ? 'قالب‌های اندیکاتور' : 'Indicator Templates',
    workspaces: currentLang === 'fa' ? 'فضاهای کاری' : 'Workspaces',
    dataWindow: currentLang === 'fa' ? 'پنجره داده‌ها' : 'Data window',
    objects: currentLang === 'fa' ? 'درخت لایه‌ها' : 'Object tree',
    screener: currentLang === 'fa' ? 'دیده‌بان تکنیکال' : 'Technical Screener',
    dom: currentLang === 'fa' ? 'عمق بازار (DOM)' : 'Depth of Market (DOM)',
    calendar: currentLang === 'fa' ? 'تقویم اقتصادی' : 'Economic Calendar',
    news: currentLang === 'fa' ? 'اخبار بازار' : 'Market News'
  };

  for (const [id, title] of Object.entries(panelTitlesMap)) {
    const el = document.querySelector(`.vela-panel-${id} .vela-panel-title`);
    if (el) el.textContent = title;
  }

  // 9. Quick Trade Labels
  const qtSell = document.querySelector('#qt-sell-label');
  if (qtSell) qtSell.innerText = dict.qtSell || 'SELL';
  const qtBuy = document.querySelector('#qt-buy-label');
  if (qtBuy) qtBuy.innerText = dict.qtBuy || 'BUY';
  const qtPill = document.querySelector('#qt-pill-label');
  if (qtPill) qtPill.innerText = dict.qtTrade || 'Trade';
  const qtSpread = document.querySelector('#qt-spread-label');
  if (qtSpread) qtSpread.innerText = dict.qtSpread || 'Spread';

  // 10. Topbar Layout & Replay Labels
  const saveLabel = document.querySelector('#layout-save-label');
  if (saveLabel) saveLabel.innerText = dict.layoutSave || 'Save';
  const replayLabel = document.querySelector('#topbar-replay-label');
  if (replayLabel) replayLabel.innerText = dict.topbarReplay || 'Replay';
  if (window.app?.layoutManager) window.app.layoutManager.updateTopbarLabel();

  // 11. Localize MoreDrawer if open
  localizeMoreDrawer();

  // 12. Trigger sub-component re-renders if active
  if (window.app?.paperTrading) window.app.paperTrading.render();
  if (window.app?.alertsManager) window.app.alertsManager.render();
  if (window.app?.marketTrackers) window.app.marketTrackers.render();
  if (window.app?.shortcutsModal) window.app.shortcutsModal.render();
  if (window.app?.tradeJournal) window.app.tradeJournal.render();
  if (window.app?.fullPageJournal) window.app.fullPageJournal.render();
}

let isLocalizingDrawer = false;

export function localizeMoreDrawer() {
  if (isLocalizingDrawer) return;
  const drawer = document.querySelector('.vela-drawer');
  if (!drawer) return;
  const isFa = currentLang === 'fa';

  if (drawer.dataset.localizedLang === currentLang) return;
  isLocalizingDrawer = true;

  try {
    drawer.dataset.localizedLang = currentLang;

    // Actions: Undo, Redo, Screenshot
    const actionMap = {
      'Undo': isFa ? 'واگرد' : 'Undo',
      'Redo': isFa ? 'ازنو' : 'Redo',
      'Screenshot': isFa ? 'عکس‌برداری' : 'Screenshot',
      'واگرد': isFa ? 'واگرد' : 'Undo',
      'ازنو': isFa ? 'ازنو' : 'Redo',
      'عکس‌برداری': isFa ? 'عکس‌برداری' : 'Screenshot'
    };

    drawer.querySelectorAll('.vela-md-action').forEach(btn => {
      for (const [k, v] of Object.entries(actionMap)) {
        if (btn.innerText.includes(k)) {
          const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
          if (textNode) textNode.nodeValue = v;
        }
      }
    });

    // Rows: labels and values
    const rowLabelsMap = {
      'Chart type': isFa ? 'نوع نمودار' : 'Chart type',
      'Layout': isFa ? 'چیدمان' : 'Layout',
      'Data window': isFa ? 'پنجره داده‌ها' : 'Data window',
      'Object tree': isFa ? 'درخت لایه‌ها' : 'Object tree',
      'Pine editor': isFa ? 'ویرایشگر پاین' : 'Pine editor',
      'Indicator Templates': isFa ? 'قالب‌های اندیکاتور' : 'Indicator Templates',
      'Workspaces': isFa ? 'فضاهای کاری' : 'Workspaces',
      'Watchlist': isFa ? 'دیده‌بان دارایی‌ها' : 'Watchlist',
      'Trade': isFa ? 'معاملات مجازی' : 'Trade',
      'Alerts': isFa ? 'سیستم هشدارها' : 'Alerts',
      'Strategy Tester': isFa ? 'بک‌تستر استراتژی' : 'Strategy Tester',
      'Prop-Firm Simulator': isFa ? 'شبیه‌ساز پراپ‌فرم' : 'Prop-Firm Simulator',
      'Trade Journal': isFa ? 'ژورنال معاملات' : 'Trade Journal',
      'Market Trackers (SEC)': isFa ? 'شفافیت بازار و نهنگ‌ها' : 'Market Trackers (SEC)',
      'نوع نمودار': isFa ? 'نوع نمودار' : 'Chart type',
      'چیدمان': isFa ? 'چیدمان' : 'Layout',
      'پنجره داده‌ها': isFa ? 'پنجره داده‌ها' : 'Data window',
      'درخت لایه‌ها': isFa ? 'درخت لایه‌ها' : 'Object tree',
      'ویرایشگر پاین': isFa ? 'ویرایشگر پاین' : 'Pine editor',
      'قالب‌های اندیکاتور': isFa ? 'قالب‌های اندیکاتور' : 'Indicator Templates',
      'فضاهای کاری': isFa ? 'فضاهای کاری' : 'Workspaces',
      'دیده‌بان دارایی‌ها': isFa ? 'دیده‌بان دارایی‌ها' : 'Watchlist',
      'معاملات مجازی': isFa ? 'معاملات مجازی' : 'Trade',
      'سیستم هشدارها': isFa ? 'سیستم هشدارها' : 'Alerts',
      'بک‌تستر استراتژی': isFa ? 'بک‌تستر استراتژی' : 'Strategy Tester',
      'شبیه‌ساز پراپ‌فرم': isFa ? 'شبیه‌ساز پراپ‌فرم' : 'Prop-Firm Simulator',
      'ژورنال معاملات': isFa ? 'ژورنال معاملات' : 'Trade Journal',
      'شفافیت بازار و نهنگ‌ها': isFa ? 'شفافیت بازار و نهنگ‌ها' : 'Market Trackers (SEC)'
    };

    drawer.querySelectorAll('.vela-md-row').forEach(row => {
      const labelEl = row.querySelector('.vela-md-row-label');
      const valEl = row.querySelector('.vela-md-row-value');
      if (labelEl) {
        const cur = labelEl.innerText.trim();
        if (rowLabelsMap[cur]) {
          labelEl.innerText = rowLabelsMap[cur];
        }
        if (cur === 'Alerts' || cur === 'سیستم هشدارها') {
          if (!valEl) {
            const badge = document.createElement('span');
            badge.className = 'vela-md-row-value num-ltr';
            badge.innerText = isFa ? '۲ فعال' : '2 Active';
            labelEl.insertAdjacentElement('afterend', badge);
          }
        }
      }
      if (valEl) {
        const vText = valEl.innerText.trim();
        if (vText === 'Candles' || vText === 'کندل‌استیک') {
          valEl.innerText = isFa ? 'کندل‌استیک' : 'Candles';
        } else if (vText === '1 × 1' || vText === '۱ × ۱') {
          valEl.innerText = isFa ? '۱ × ۱' : '1 × 1';
        }
      }
    });

    // Ensure close button exists in drawer title area
    const titleEl = drawer.querySelector('.vela-drawer-title');
    if (titleEl && !titleEl.querySelector('.vela-drawer-close-custom')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'vela-drawer-close-custom';
      closeBtn.innerHTML = '✕';
      closeBtn.title = isFa ? 'بستن' : 'Close';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        ${isFa ? 'left: 14px;' : 'right: 14px;'}
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #cbd5e1;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        z-index: 5;
      `;
      closeBtn.addEventListener('click', () => {
        window.app?.chartManager?.workspace?.moreDrawer?.close();
      });
      titleEl.appendChild(closeBtn);
    }
  } finally {
    isLocalizingDrawer = false;
  }
}

let drawerObserverInitialized = false;
export function initDrawerObserver() {
  if (drawerObserverInitialized || typeof MutationObserver === 'undefined') return;
  drawerObserverInitialized = true;
  const observer = new MutationObserver(() => {
    if (isLocalizingDrawer) return;
    const drawer = document.querySelector('.vela-drawer[data-state="open"]');
    if (drawer && drawer.dataset.localizedLang !== currentLang) {
      localizeMoreDrawer();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'class'] });
}

// Auto-initialize observer in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initDrawerObserver());
  } else {
    initDrawerObserver();
  }
}
