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
    chartStyleTitle: 'Chart Style',
    chartStyleDesc: 'Candles, Bars, Heikin Ashi, Line, Area, Baseline',
    barReplayTitle: 'Bar Replay',
    barReplayDesc: 'Historical rewind, step execution & strategy testing',
    dataExportTitle: 'Export Data',
    dataExportDesc: 'Download historical candles in CSV or JSON format',
    newsTitle: 'Market News & Catalysts',
    newsDesc: 'Breaking headlines, sentiment & macro catalysts',
    objectsTitle: 'Object Tree & Layers',
    objectsDesc: 'Manage drawings and indicator layers',
    dataWindowTitle: 'Data Window',
    dataWindowDesc: 'Real-time cursor OHLC, volume & indicator values',

    // Symbol Search
    symbolModalTitle: 'Symbol Search & Market Navigator',
    symbolPlaceholder: 'Type symbol name (e.g. BTC, ETH, XAU, EURUSD, AAPL)...',
    instrumentsCount: '30+ Instruments',

    // Indicators Modal
    indicatorsModalTitle: 'Indicators, Metrics & Strategies (114+ Library)',
    indicatorsSearchPlaceholder: 'Search 114+ technical indicators, metrics & scripts...',
    indicatorsCountPrefix: 'Showing',
    indicatorsCountSuffix: 'of 114 indicators',

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
    chartStyleTitle: 'نوع نمودار (Chart Style)',
    chartStyleDesc: 'کندل‌استیک، میله‌ای، هیکن‌آشی، خطی و ناحیه‌ای',
    barReplayTitle: 'بازپخش تاریخی کندل‌ها (Replay)',
    barReplayDesc: 'برگشت به گذشته، تست سناریو و اجرای گام‌به‌گام',
    dataExportTitle: 'خروجی داده‌ها (Export)',
    dataExportDesc: 'دریافت داده‌های OHLCV در قالب CSV و JSON',
    newsTitle: 'اخبار و کاتالیزورهای بازار (News)',
    newsDesc: 'سرخط اخبار فوری، شاخص سنتیمنت و متغیرهای کلان',
    objectsTitle: 'درخت لایه‌ها و ابزارها (Objects)',
    objectsDesc: 'مدیریت و پنهان‌سازی ترسیم‌ها و لایه‌های اندیکاتور',
    dataWindowTitle: 'پنجره داده‌ها (Data Window)',
    dataWindowDesc: 'مقادیر دقیق OHLCV و اندیکاتورها در نقطه کراس‌هیر',

    // Symbol Search
    symbolModalTitle: 'جستجوی نماد در تمام بازارهای مالی',
    symbolPlaceholder: 'نام یا نماد دارایی را تایپ کنید (مانند BTC، طلا، نفت، اپل)...',
    instrumentsCount: 'بیش از ۳۰ نماد جهانی',

    // Indicators Modal
    indicatorsModalTitle: 'دایره‌المعارف اندیکاتورها و استراتژی‌ها (۱۱۴ ابزار تخصصی)',
    indicatorsSearchPlaceholder: 'جستجو در بین ۱۱۴ اندیکاتور تکنیکال، اسمارت مانی و حجم...',
    indicatorsCountPrefix: 'نمایش',
    indicatorsCountSuffix: 'از ۱۱۴ اندیکاتور تحلیلی',

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

// ── Canonical Persian palette for auto-localizing Vela engine UI and
// dynamically injected labels (exact-match, applied continuously). ───────
export const VELA_UI_FA = {
  // Vela topbar / dialogs / menus
  'Indicators': 'اندیکاتورها',
  'Symbol Search': 'جستجوی نماد',
  'Change timeframe': 'تغییر بازه زمانی',
  'All': 'همه',
  'Stocks': 'سهام',
  'ETFs': 'صندوق‌های قابل معامله',
  'Crypto': 'رمزارزها',
  'Forex': 'فارکس',
  'Futures': 'فیوچرز',
  'Indices': 'شاخص‌ها',
  'Bonds': 'اوراق قرضه',
  'Economy': 'اقتصاد',
  // Chart styles
  'Candles': 'کندل‌استیک',
  'Bars': 'میله‌ای',
  'Line': 'خطی',
  'Area': 'ناحیه‌ای',
  'Baseline': 'خط مبنا',
  'Heikin Ashi': 'هیکن‌آشی',
  // Panels
  'Volume': 'حجم',
  'Object tree': 'درخت لایه‌ها',
  'Data window': 'پنجره داده‌ها',
  'Watchlist': 'دیده‌بان دارایی‌ها',
  'Alerts': 'سیستم هشدارها',
  'Trade': 'معاملات مجازی',
  'Pine editor': 'ویرایشگر پاین',
  'Strategy Tester': 'بک‌تستر استراتژی',
  'Prop-Firm Simulator': 'شبیه‌ساز پراپ‌فرم',
  'Trade Journal': 'ژورنال معاملات',
  'Market Trackers (SEC)': 'شفافیت بازار و نهنگ‌ها',
  'Indicator Templates': 'قالب‌های اندیکاتور',
  'Workspaces': 'فضاهای کاری',
  'Technical Screener': 'فیلتر تکنیکال',
  'Depth of Market (DOM)': 'عمق بازار (DOM)',
  'Depth of Market': 'عمق بازار',
  'Economic Calendar': 'تقویم اقتصادی',
  'Market News': 'اخبار بازار',
  'Market News & Catalysts': 'اخبار بازار',
  'Compare': 'مقایسه',
  'Compare & Overlay': 'مقایسه و همپوشانی',
  'Export Data': 'خروجی داده‌ها',
  'Bar Replay': 'بازپخش کندل‌ها',
  'Chart Style': 'حالت نمودار',
  'Chart type': 'نوع نمودار',
  'Layout': 'چیدمان',
  'Smart Trail': 'دنبال‌کننده هوشمند (Smart Trail)',
  'Buy Signal': 'سیگنال خرید',
  'Sell Signal': 'سیگنال فروش',
  'Shannon Rebalance Strategy': 'استراتژی بازتعادل شنون (Shannon)',
  'Multi-Chart Layout Grid': 'گرید چیدمان چندچارته',
  'Single (1×1)': 'تک پنجره (1×1)',
  'Dual H (2×1)': 'دو چارت افقی (2×1)',
  'Dual V (1×2)': 'دو چارت عمودی (1×2)',
  'Quad (2×2)': 'چهار چارت (2×2)',
  'Chart Synchronization': 'همگام‌سازی هوشمند چارت‌ها',
  'Sync Symbol': 'همگام‌سازی نماد',
  'Sync Timeframe': 'همگام‌سازی بازه زمانی',
  'Sync Crosshair': 'همگام‌سازی کراس‌هیر',
  'Sync Drawings': 'همگام‌سازی ترسیم‌ها',
  // Scale / replay / general controls
  'Auto': 'خودکار',
  'Log': 'لگاریتمی',
  'Inv': 'معکوس',
  'Undo': 'واگرد',
  'Redo': 'ازنو',
  'Screenshot': 'عکس‌برداری',
  'Close': 'بستن',
  'Save': 'ذخیره',
  'New': 'جدید',
  'Cancel': 'انصراف',
  'Apply': 'اعمال',
  'Delete Template': 'حذف قالب',
  'Play': 'پخش',
  'Pause': 'توقف',
  'Exit': 'خروج',
  'Step →': 'گام بعدی →',
  'Step': 'گام',
  'BUY': 'خرید',
  'SELL': 'فروش',
  'REPLAY': 'بازپخش کندل',
  'Spread': 'اسپرد',
  'Quantity': 'حجم معامله',
  'Order Type': 'نوع اردر',
  'Leverage': 'اهرم',
  // Pine Studio
  'Add to Chart': 'افزودن به چارت',
  'Backtest Strategy': 'بک‌تست استراتژی',
  'Diagnostics Console': 'کنسول عیب‌یابی',
  'Ready. Click \'Add to Chart\' to compile Pine Script.': 'آماده است. برای کامپایل پاین‌اسکریپت روی «افزودن به چارت» کلیک کنید.',
  // Large-frame data window / legend leftovers
  'YTD': 'از ابتدای سال',
  'ALL': 'همه',

  // ── Template / curated setup panel (rendered lazily when the dock opens) ──
  'Curated Algorithmic Setups': 'ستاپ‌های الگوریتمی آماده',
  '+ Save Current Setup': '+ ذخیره ستاپ جاری',
  'Save Current Setup': 'ذخیره ستاپ جاری',
  '✓ Apply Setup to Chart': '✓ اعمال ستاپ روی چارت',
  'Apply Setup to Chart': 'اعمال ستاپ روی چارت',
  'Your Saved Templates': 'قالبهای ذخیرهشده شما',
  'Template Name:': 'نام قالب جدید:',
  'Save ✓': 'ذخیره ✓',
  'TREND': 'روند',
  'VOLATILITY': 'نوسان',
  'VOLUME': 'حجم',

  // ── Prop-Firm simulator ──
  'Win Rate (%)': 'نرخ برد (%)',
  'Risk Per Trade (%)': 'ریسک در هر معامله (%)',
  'R:R Ratio': 'نسبت سود به ریسک',
  'Trades per Day': 'معاملات در روز',
  'Pass Probability': 'احتمال قبولی',
  'Risk of Ruin': 'ریسک سوختن حساب',
  'Expected Value': 'امید ریاضی سود',
  'Median Days to Funded': 'میانه روزها تا قبولی',
  'Chance of drawdown limit': 'احتمال رسیدن به سقف افت سرمایه',
  'Firm Challenge Preset': 'قالب آزمون پراپ‌فرم',
  'Run 10,000 Monte Carlo Paths': 'اجرای ۱۰،۰۰۰ مسیر مونت‌کارلو',

  // ── Trackers (SEC) ──
  'Chamber': 'مجلس',
  'Type': 'نوع',
  'Transaction Date': 'تاریخ معامله',
  'Amount': 'مبلغ',
  'Official Source': 'منبع رسمی',
  'Ticker': 'نماد',
  'Asset': 'دارایی',
  'Insider': 'مدیر ارشد',
  'Value': 'ارزش',

  // ── Economic calendar ──
  'High Impact 🔥': 'تأثیر بالا 🔥',
  'Medium Impact': 'تأثیر متوسط',
  'Low Impact': 'تأثیر کم',
  '🏛️ Central Banks': '️ بانک‌های مرکزی',
  '📈 Inflation': ' تورم',
  '🏦 Interest Rates': '🏦 نرخ بهره',
  '📊 Growth': '📊 رشد اقتصادی',
  '💼 Employment': '💼 اشتغال',
  'HIGH': 'بالا',
  'MEDIUM': 'متوسط',
  'MED': 'متوسط',
  'LOW': 'کم',

  // ── Technical screener ──
  'Symbol': 'نماد',
  'Last Price': 'آخرین قیمت',
  '24h Change': 'تغییر ۲۴ ساعته',
  '24h High': 'سقف ۲۴ ساعته',
  '24h Low': 'کف ۲۴ ساعته',
  'Rating': 'امتیاز',
  'RSI (14)': 'RSI (۱۴)',
  'SMA Cross': 'تقاطع میانگین',
  'Metals': 'فلزات',
  'Equities': 'سهام',
  'Commodities': 'کالاها',

  // ── Watchlist ──
  'Add': 'افزودن',
  'Add Symbol': 'افزودن نماد',
  'BINANCE': 'بایننس',

  // ── Paper trading / DOM / execution ──
  'Long': 'خرید',
  'Short': 'فروش',
  '− Sell': '− فروش',
  '+ Buy': '+ خرید',
  'Sell / Short': 'فروش / شورت',
  'Buy / Long': 'خرید / لانگ',
  'Balance': 'موجودی',
  'Equity': 'ارزش حساب',
  'Positions': 'موقعیت‌های باز',
  'Free Margin': 'مارجین آزاد',
  'Unrealized P&L': 'سود/زیان تحقق‌نیافته',
  'Order Book': 'دفتر سفارشات',
  'Bids': 'سفارش‌های خرید',
  'Asks': 'سفارش‌های فروش',

  // ── Object tree / data window ──
  'Main chart': 'چارت اصلی',
  'Date': 'تاریخ',
  'Time': 'زمان',
  'Price': 'قیمت',
  'Open': 'باز',
  'High price': 'بالا',
  'Low price': 'پایین',
  'Close price': 'بسته',
  'Change': 'تغییر',

  // ── Screener / watchlist column headers ──
  '24h Vol': 'حجم ۲۴ ساعته',
  'Trend': 'روند',
  'Technical Rating': 'امتیاز تکنیکال',
  'Action': 'اقدام',
  'Neutral': 'بی‌طرف',
  'Bull': 'صعودی',
  'Bullish': 'صعودی',
  'Bear': 'نزولی',
  'Bearish': 'نزولی',
  'Strong Buy': 'خرید قوی',
  'Strong Sell': 'فروش قوی',
  'Buy': 'خرید',
  'Sell': 'فروش',
  'CRYPTO': 'رمزارز',
  'FOREX': 'فارکس',
  'STOCKS': 'سهام',
  'METALS': 'فلزات',
  'INDICES': 'شاخص‌ها',
  'COMMODITIES': 'کالاها',

  // ── Economic calendar severity ──
  'Actual:': 'واقعی:',
  'Forecast:': 'پیش‌بینی:',
  'Previous:': 'قبلی:',

  // ── Prop-firm journey annotations ──
  'Target': 'تارگت سود',
  'Drawdown': 'افت سرمایه',
  'P90 worst-case:': 'بدترین سناریو (P90):',

  // ── Trackers (SEC) ──
  'Purchase': 'خرید',
  'Sale': 'فروش',
  'House': 'مجلس نمایندگان',
  'Senate': 'سنا',
  'Governor': 'فرماندار',
  'View Disclosure PDF ↗': 'مشاهده سند رسمی ↗',

  // ── Paper execution ticket ──
  'Leverage (x)': 'اهرم (x)',
  'Available Margin': 'مارجین قابل استفاده',
  'Order Value': 'ارزش سفارش',
  'Estimated Fee': 'کارمزد تخمینی',
  'Confirm Order': 'تأیید سفارش',
  'Clear': 'پاک‌سازی',

  // ── Economic calendar chrome ──
  'Macro Releases': 'رویدادهای کلان',
  'Direct Central Bank Stream': 'همگام‌سازی بلادرنگ فدرال رزرو و بانک‌های مرکزی',
  'Impact': 'میزان اثر',
  'Event': 'رویداد',
  'Actual': 'مقدار واقعی',
  'Forecast': 'پیش‌بینی',
  'Previous': 'مقدار قبلی',
  'High': 'بالا',
  'Medium': 'متوسط',
  'Low': 'پایین'
};

// News source names are proper nouns — kept as-is by design (below maps the
// few that ship a Persian desk name for institutional reading).
export const VELA_UI_NEWS_SOURCES_FA = {
  'Bloomberg Markets': 'بازارهای بلومبرگ',
  'The Block': 'د بلاک',
  'Wall Street Journal': 'وال‌استریت ژورنال',
  'Platts Energy': 'پلتس انرژی',
  'MarketWatch': 'مارکتواچ',
  'Reuters': 'رویترز',
  'CoinDesk': 'کویین‌دسک',
  'Financial Times': 'فایننشال تایمز'
};

// Instrument display names and economic-calendar event titles arrive from the
// server catalogue as English proper nouns; they are user-facing copy on the
// screener and calendar panels, so they get canonical Persian renderings.
export const VELA_UI_MARKET_NAMES_FA = {
  // ── Compare-modal benchmark display names ──
  'US Dollar Index': 'شاخص دلار آمریکا (DXY)',
  'Gold Spot': 'طلا (نقدی)',
  'S&P 500': 'شاخص S&P 500',
  'Nasdaq 100': 'شاخص نزدک ۱۰۰',
  'Euro / USD': 'یورو / دلار آمریکا',
  // ── Crypto instruments ──
  'Bitcoin': 'بیت‌کوین',
  'Ethereum': 'اتریوم',
  'Solana': 'سولانا',
  'Ripple': 'ریپل',
  'Dogecoin': 'دوج‌کوین',
  'Cardano': 'کاردانو',
  'Avalanche': 'آوالانچ',
  'Chainlink': 'چین‌لینک',
  'Sui Network': 'سویی',
  'NEAR Protocol': 'نیر',
  'Aptos': 'اپتوس',
  'Pepe': 'پپه',
  'Shiba Inu': 'شیبا اینو',
  'Bittensor': 'بیتنسور',
  'Render': 'رندر',
  // ── Commodities / FX / Indices ──
  'Gold / US Dollar Spot': 'طلا / دلار آمریکا (نقدی)',
  'Silver / US Dollar Spot': 'نقره / دلار آمریکا (نقدی)',
  'WTI Crude Oil': 'نفت خام WTI',
  'Brent Crude Oil': 'نفت خام برنت',
  'Natural Gas': 'گاز طبیعی',
  'Euro / US Dollar': 'یورو / دلار آمریکا',
  'British Pound / US Dollar': 'پوند انگلیس / دلار آمریکا',
  'US Dollar / Japanese Yen': 'دلار آمریکا / ین ژاپن',
  'Australian Dollar / US Dollar': 'دلار استرالیا / دلار آمریکا',
  'US Dollar / Canadian Dollar': 'دلار آمریکا / دلار کانادا',
  'US Dollar / Swiss Franc': 'دلار آمریکا / فرانک سوئیس',
  'S&P 500 Index': 'شاخص S&P 500',
  'Nasdaq 100 Index': 'شاخص نزدک ۱۰۰',
  'Dow Jones Industrial Average': 'شاخص داوجونز',
  // ── Economic calendar events ──
  'FOMC Interest Rate Decision': 'تصمیم نرخ بهره فدرال رزرو (FOMC)',
  'FOMC Minutes': 'صورت‌جلسه فدرال رزرو',
  'Bank of England (BoE) Rate Decision': 'تصمیم نرخ بهره بانک انگلستان',
  'Bank of Japan (BoJ) Policy Rate': 'نرخ سیاستی بانک ژاپن',
  'ECB Monetary Policy Statement': 'بیانیه سیاست پولی بانک مرکزی اروپا',
  'US Non-Farm Payrolls': 'اشتغال بخش غیرکشاورزی آمریکا',
  'US CPI (Inflation)': 'شاخص قیمت مصرف‌کننده آمریکا (تورم)',
  'US Core PCE Price Index': 'شاخص قیمت هسته PCE آمریکا',
  'US GDP (Quarterly)': 'تولید ناخالص داخلی آمریکا (فصلی)',
  'US Retail Sales': 'خرده‌فروشی آمریکا',
  'US Unemployment Rate': 'نرخ بیکاری آمریکا',
  'US Initial Jobless Claims': 'مدعیان اولیه بیکاری آمریکا',
  'Michigan Consumer Sentiment': 'شاخص احساسات مصرف‌کننده میشیگان',
  'ISM Manufacturing PMI': 'شاخص مدیران خرید تولیدی ISM',
  'ISM Services PMI': 'شاخص مدیران خرید خدمات ISM'
};

// Individually branded engine strings keep their official product name in both
// languages (TradingView / LuxAlgo parity) — never machine-translated.
export const VELA_BRAND_WHITELIST = [
  /^LuxAlgo\s*-/,
  /^Nexus\s/,
  /^PineTS\b/,
  /^Vela\b/,
  /^TradingChart\b/,
  // TradingView is the reference platform this terminal reaches parity with;
  // the brand name stays verbatim in both languages, like the others above.
  /^TradingView\b/
];

const _origTextKey = 'velaI18n';
let _autoRunning = false;

// Pattern-based localization for dynamic Vela strings (timeframe, meta lines)
const VELA_TF_FA = { 'm': 'د', 'h': 'س', 'D': 'ر', 'W': 'ه', 'M': 'م' }; // minute/hour/Day/Week/Month suffixes
const tfFa = (tf) => toPersianDigits(String(tf)).replace(/([mhDWM])$/, (s, u) => VELA_TF_FA[u] || u);
const VELA_UI_PATTERNS = [
  // Legend metadata line: "· UNIVERSAL · 15m" / "· OVERLAY · 1h"
  [/^·\s*UNIVERSAL\s*·\s*([0-9A-Za-z.]+)\s*$/, (m) => `· جهانی · ${tfFa(m[1])}`],
  [/^·\s*OVERLAY\s*·\s*([0-9A-Za-z.]+)\s*$/, (m) => `· روی‌نمود · ${tfFa(m[1])}`],
  [/^·\s*OSCILLATOR\s*·\s*([0-9A-Za-z.]+)\s*$/, (m) => `· نوسان‌نما · ${tfFa(m[1])}`],
  [/^Indicators\s*\((\d+)\)$/, (m) => `اندیکاتورها (${toPersianDigits(m[1])})`],
  [/^(\d+)\s*Instruments$/, (m) => `${toPersianDigits(m[1])} نماد`],
  // Screener rating chip: "▲ Bull"
  [/^([▲▼])\s*Bull$/, (m) => `${m[1]} صعودی`],
  [/^([▲▼])\s*Bear$/, (m) => `${m[1]} نزولی`],
  // Prop-firm worst-case line: "P90 worst-case: 15d"
  [/^P90 worst-case:\s*(\d+)\s*d$/, (m) => `بدترین سناریو (P90): ${toPersianDigits(m[1])} روز`],
  // Prop-firm journey annotations: "— Target (+$10,000)" / "— Drawdown (-$10,000)"
  [/^—\s*Target\s*\((.*)\)$/, (m) => `— تارگت سود (${m[1]})`],
  [/^—\s*Drawdown\s*\((.*)\)$/, (m) => `— افت سرمایه (${m[1]})`],
  // Paper trading leverage badge: "LONG 10x"
  [/^(LONG|SHORT)\s+(\d+x)$/, (m) => `${m[1] === 'LONG' ? 'خرید' : 'فروش'} ${m[2]}`]
];

/**
 * Continuously localize Vela engine UI + dynamically injected labels (FA).
 * Persian is reached by wrapping matches in data-marked spans so the switch
 * back to English is perfectly lossless.
 */
export function autoLocalizeUI(root = document.body) {
  if (typeof document === 'undefined' || _autoRunning) return 0;
  _autoRunning = true;
  try {
    // 1. Lossless restore pass (always runs, cheap)
    root.querySelectorAll('span[' + _origTextKey + ']').forEach(sp => {
      const orig = sp.getAttribute(_origTextKey);
      if (orig !== null) sp.replaceWith(document.createTextNode(orig));
    });
    if (currentLang !== 'fa') return 0;

    const SKIP = 'script,style,svg,.num-ltr,#pine-code-editor,.code-editor,pre,code,[data-no-i18n],' +
                 '.vela-widget-symbol-badge,[class*="price-badge"],[class*="axis-badge"]';
    let count = 0;

    // 2. Text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const el = node.parentElement;
      if (!el || el.closest(SKIP)) continue;
      const txt = (node.textContent || '').trim();
      if (!txt || /[\u0600-\u06FF]/.test(txt)) continue;
      let fa = VELA_UI_FA[txt] || VELA_UI_NEWS_SOURCES_FA[txt] || VELA_UI_MARKET_NAMES_FA[txt];
      if (!fa) {
        for (const [re, fn] of VELA_UI_PATTERNS) {
          const m = txt.match(re);
          if (m) { fa = fn(m); break; }
        }
      }
      if (!fa) continue;
      const span = document.createElement('span');
      span.className = 'vela-localized';
      span.setAttribute(_origTextKey, txt);
      span.textContent = fa;
      node.parentNode?.replaceChild(span, node);
      count++;
    }

    // 3. Attributes (tooltips / accessibility / placeholders)
    root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
      if (el.closest(SKIP)) return;
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(attr);
        if (v && VELA_UI_FA[v]) { el.setAttribute(attr, VELA_UI_FA[v]); count++; }
      }
    });
    return count;
  } finally {
    _autoRunning = false;
  }
}

let _autoScheduled = false;
function scheduleAutoLocalize() {
  if (_autoScheduled) return;
  _autoScheduled = true;
  const run = () => { _autoScheduled = false; autoLocalizeUI(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 30));
  else setTimeout(run, 60);
}

// Expose for QA/debug tooling so the localization engine can be driven directly.
if (typeof window !== 'undefined') window.__TC_AUTO_LOCALIZE__ = () => autoLocalizeUI();

/**
 * Localize Vela's Data Window at the DATA SOURCE.
 *
 * The data-window panel calls `body.replaceChildren()` on every crosshair move /
 * bar tick, so wrapping its label text nodes in spans is always lost on the next
 * frame. Instead we intercept the renderer's `dataWindowReadout()` and translate
 * the labels before the panel ever builds its DOM. Rendering a live series is
 * cheap and survives every rebuild, and switching back to EN is lossless because
 * we only transform a copy of the readout object.
 */
function translateDataWindowReadout(readout) {
  if (!readout || currentLang !== 'fa') return readout;
  const L = (s) => (typeof s === 'string' && s ? (VELA_UI_FA[s] || s) : s);
  const out = { ...readout };
  out.groups = Array.isArray(readout.groups)
    ? readout.groups.map(g => ({ ...g, name: L(g.name), rows: (g.rows || []).map(r => ({ ...r, label: L(r.label) })) }))
    : [];
  return out;
}

/** Translate the Data Window's hardcoded section titles/labels in the built DOM.
 *  Runs from a MutationObserver callback (before paint) and is a no-op when the
 *  text is already Persian, so it cannot loop. Switching back to EN needs no
 *  restore step: the panel rebuilds from scratch on the next refresh. */
function localizeDataWindowDom(body) {
  if (!body) return 0;
  let n = 0;
  // OHLC labels read as PRICE fields ("Close" = the closing price, not the verb
  // "close"), so the data window gets its own map instead of the generic UI
  // dictionary — where 'Close' correctly means the action "بستن".
  const DW = {
    'Date': 'تاریخ', 'Time': 'زمان', 'Price': 'قیمت',
    'Open': 'باز', 'High': 'بالا', 'Low': 'پایین', 'Close': 'بسته',
    'Volume': 'حجم', 'Time': 'زمان', 'Change': 'تغییر',
    'Smart Trail': 'دنبال‌کننده هوشمند (Smart Trail)',
    'Buy Signal': 'سیگنال خرید',
    'Sell Signal': 'سیگنال فروش',
    'No data': 'داده‌ای موجود نیست',
    'This renderer provides no data readout.': 'این موتور داده خروجی ارائه نمی‌دهد.'
  };
  const map = (t) => DW[t] || VELA_UI_FA[t] || VELA_UI_MARKET_NAMES_FA[t];
  const nodes = body.querySelectorAll('.vela-dw-group, .vela-dw-label, .vela-dw-empty');
  if (currentLang !== 'fa') {
    // Lossless restore: put back the engine's original (English) wording.
    nodes.forEach(el => {
      const orig = el.dataset.tcDwOrig;
      if (orig !== undefined && el.textContent !== orig) { el.textContent = orig; delete el.dataset.tcDwOrig; n++; }
    });
    return n;
  }
  nodes.forEach(el => {
    const txt = (el.textContent || '').trim();
    const fa = map(txt);
    if (fa && fa !== txt) {
      el.dataset.tcDwOrig = txt;   // remember the engine text for the EN restore
      el.textContent = fa;
      n++;
    }
  });
  return n;
}

/** Attach (once per panel instance) a before-paint observer on the data window. */
export function observeVelaDataWindow() {
  if (typeof document === 'undefined') return false;
  const body = document.querySelector('.vela-panel.vela-dw .vela-panel-body');
  if (!body) return false;
  body.dataset.tcDwObserved = '1';
  localizeDataWindowDom(body);
  if (body.dataset.tcDwWatching === '1') return false;
  body.dataset.tcDwWatching = '1';
  const mo = new MutationObserver(() => localizeDataWindowDom(body));
  mo.observe(body, { childList: true, subtree: true, characterData: true });
  return true;
}

/** Idempotently wrap the active renderer's readout provider (re-run after rebuilds). */
export function patchVelaDataWindow() {
  if (typeof document === 'undefined') return false;
  observeVelaDataWindow();
  try {
    const app = window.app || window.__TRADING_APP__;
    const chart = app?.chartManager?.workspace?.active?.chart;
    const renderer = chart?.renderer;
    if (!renderer || typeof renderer.dataWindowReadout !== 'function') return false;
    if (renderer.__tcDwPatched === true) return false;
    const orig = renderer.dataWindowReadout.bind(renderer);
    renderer.dataWindowReadout = function () {
      return translateDataWindowReadout(orig());
    };
    renderer.__tcDwPatched = true;
    return true;
  } catch (e) {
    return false;
  }
}

// Vela rebuilds its widget (and therefore its renderer) on layout/style changes,
// so re-apply the patch on a low-frequency timer in addition to the observer.
if (typeof window !== 'undefined') {
  const arm = () => { patchVelaDataWindow(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
  setInterval(arm, 1500);
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
    autoLocalizeUI();
  }
}

export function getLanguage() {
  return currentLang;
}

export function t(key) {
  return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

/**
 * Localize an instrument display name that arrives from the server catalogue
 * (e.g. "Shiba Inu", "Gold / US Dollar Spot"). Server-supplied names bypass the
 * client dictionary because they are injected straight into a template string,
 * so panels must call this instead of printing `item.name` raw.
 */
export function localizeInstrumentName(name) {
  if (currentLang !== 'fa' || typeof name !== 'string') return name;
  return VELA_UI_MARKET_NAMES_FA[name] || VELA_UI_FA[name] || name;
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
    { panel: 'screener', title: dict.screenerTitle, desc: dict.screenerDesc },
    { panel: 'dom', title: dict.domTitle, desc: dict.domDesc },
    { panel: 'compare', title: dict.compareTitle, desc: dict.compareDesc },
    { panel: 'templates', title: dict.templatesTitle, desc: dict.templatesDesc },
    { panel: 'workspaces', title: dict.workspacesTitle, desc: dict.workspacesDesc },
    { panel: 'news', title: dict.newsTitle, desc: dict.newsDesc },
    { panel: 'objects', title: dict.objectsTitle, desc: dict.objectsDesc },
    { panel: 'dataWindow', title: dict.dataWindowTitle, desc: dict.dataWindowDesc },
    { panel: 'chartStyle', title: dict.chartStyleTitle, desc: dict.chartStyleDesc },
    { panel: 'barReplay', title: dict.barReplayTitle, desc: dict.barReplayDesc },
    { panel: 'dataExport', title: dict.dataExportTitle, desc: dict.dataExportDesc }
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

  const symCatsMap = {
    all: currentLang === 'fa' ? 'همه' : 'All',
    crypto: currentLang === 'fa' ? 'رمزارزها' : 'Crypto',
    metals: currentLang === 'fa' ? 'فلزات' : 'Metals',
    commodities: currentLang === 'fa' ? 'کالاها' : 'Commodities',
    forex: currentLang === 'fa' ? 'فارکس' : 'Forex',
    indices: currentLang === 'fa' ? 'شاخص‌ها' : 'Indices',
    stocks: currentLang === 'fa' ? 'سهام' : 'Stocks'
  };
  document.querySelectorAll('.sym-cat-btn').forEach(btn => {
    const cat = btn.getAttribute('data-cat');
    if (cat && symCatsMap[cat]) btn.textContent = symCatsMap[cat];
  });

  const symClearBtn = document.querySelector('#symbol-clear-search');
  if (symClearBtn) {
    symClearBtn.style.left = currentLang === 'fa' ? '8px' : 'auto';
    symClearBtn.style.right = currentLang === 'fa' ? 'auto' : '8px';
  }
  if (symInput) {
    symInput.style.padding = currentLang === 'fa' ? '6px 12px 6px 36px' : '6px 36px 6px 12px';
    symInput.style.direction = currentLang === 'fa' ? 'rtl' : 'ltr';
    symInput.style.textAlign = currentLang === 'fa' ? 'right' : 'left';
  }
  const symHint = document.querySelector('#modal-symbol-search [style*="justify-content: space-between"] span:first-child');
  if (symHint) {
    symHint.innerHTML = currentLang === 'fa'
      ? '<kbd>↑</kbd> <kbd>↓</kbd> پیمایش &nbsp;·&nbsp; <kbd>↵</kbd> انتخاب &nbsp;·&nbsp; <kbd>ESC</kbd> بستن'
      : '<kbd>↑</kbd> <kbd>↓</kbd> Navigate &nbsp;·&nbsp; <kbd>↵</kbd> Select &nbsp;·&nbsp; <kbd>ESC</kbd> Close';
  }
  const symCountBadge = document.querySelector('#sym-count-badge');
  if (symCountBadge) {
    const countMatch = symCountBadge.innerText.match(/\d+/);
    const num = countMatch ? countMatch[0] : '30+';
    symCountBadge.innerText = currentLang === 'fa' ? `${num} ابزار معاملاتی` : `${num} Instruments`;
  }

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
  const targetApp = window.app || window.__TRADING_APP__;
  if (targetApp) {
    if (targetApp.layoutManager) targetApp.layoutManager.updateTopbarLabel();
    if (targetApp.paperTrading) targetApp.paperTrading.render();
    if (targetApp.alertsManager) targetApp.alertsManager.render();
    if (targetApp.marketTrackers) targetApp.marketTrackers.render();
    if (targetApp.shortcutsModal) targetApp.shortcutsModal.render();
    if (targetApp.tradeJournal) targetApp.tradeJournal.render();
    if (targetApp.fullPageJournal) targetApp.fullPageJournal.render();
    if (targetApp.economicCalendar) targetApp.economicCalendar.render();
    if (targetApp.technicalScreener) targetApp.technicalScreener.render();
    if (targetApp.depthOfMarket) targetApp.depthOfMarket.render();
    if (targetApp.marketNews) targetApp.marketNews.render();
    if (targetApp.timeframeManager) targetApp.timeframeManager.render();
    if (targetApp.templateManager) targetApp.templateManager.render();
    if (targetApp.scaleControls) targetApp.scaleControls.render();
    if (targetApp.chartStylePicker) targetApp.chartStylePicker.updateButtonUI();
  }
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
      'Technical Screener': isFa ? 'فیلتر تکنیکال' : 'Technical Screener',
      'Depth of Market (DOM)': isFa ? 'عمق بازار (DOM)' : 'Depth of Market (DOM)',
      'Depth of Market': isFa ? 'عمق بازار' : 'Depth of Market',
      'Economic Calendar': isFa ? 'تقویم اقتصادی' : 'Economic Calendar',
      'Market News': isFa ? 'اخبار بازار' : 'Market News',
      'Market News & Catalysts': isFa ? 'اخبار بازار' : 'Market News & Catalysts',
      'Compare & Overlay': isFa ? 'مقایسه و همپوشانی' : 'Compare & Overlay',
      'Bar Replay': isFa ? 'بازپخش کندل‌ها' : 'Bar Replay',
      'Export Data': isFa ? 'خروجی داده‌ها' : 'Export Data',
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
      'شفافیت بازار و نهنگ‌ها': isFa ? 'شفافیت بازار و نهنگ‌ها' : 'Market Trackers (SEC)',
      'فیلتر تکنیکال': isFa ? 'فیلتر تکنیکال' : 'Technical Screener',
      'عمق بازار (DOM)': isFa ? 'عمق بازار (DOM)' : 'Depth of Market (DOM)',
      'عمق بازار': isFa ? 'عمق بازار' : 'Depth of Market',
      'تقویم اقتصادی': isFa ? 'تقویم اقتصادی' : 'Economic Calendar',
      'اخبار بازار': isFa ? 'اخبار بازار' : 'Market News',
      'مقایسه و همپوشانی': isFa ? 'مقایسه و همپوشانی' : 'Compare & Overlay',
      'بازپخش کندل‌ها': isFa ? 'بازپخش کندل‌ها' : 'Bar Replay',
      'خروجی داده‌ها': isFa ? 'خروجی داده‌ها' : 'Export Data'
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
    // Continuously localize Vela engine surfaces & dynamic labels (FA)
    scheduleAutoLocalize();
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
