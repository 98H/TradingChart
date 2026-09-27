// server/featuresCatalog.js
// Canonical features and entitlement definitions catalog for TradingChart
// Defines both numeric quotas and boolean feature flags with full i18n metadata.

export const FEATURES_CATALOG = [
  // ── 1. Chart & Technical Analysis Quotas ──────────────────────────────────
  {
    id: 'chartsPerTab',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Charts per tab',
    nameFa: 'چارت در هر تب',
    descEn: 'Maximum number of simultaneous chart cells in a multi-grid layout',
    descFa: 'حداکثر تعداد چارت‌های همزمان در شبکه چندتایی (Multi-Chart)',
    default: 1, min: 1, max: 16, step: 1, unitEn: 'charts', unitFa: 'چارت'
  },
  {
    id: 'savedLayouts',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Saved layouts',
    nameFa: 'چیدمان‌های ذخیره‌شده',
    descEn: 'Cloud-synced chart layout configurations',
    descFa: 'تعداد چیدمان‌های قابل ذخیره‌سازی در فضای ابری',
    default: 1, min: 1, max: 100, step: 1, unitEn: 'layouts', unitFa: 'چیدمان'
  },
  {
    id: 'indicatorsPerChart',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Indicators per chart',
    nameFa: 'اندیکاتور در هر چارت',
    descEn: 'Max active indicators applied simultaneously to a single chart cell',
    descFa: 'حداکثر تعداد اندیکاتورهای فعال همزمان روی یک چارت',
    default: 2, min: 1, max: 100, step: 1, unitEn: 'indicators', unitFa: 'اندیکاتور'
  },
  {
    id: 'indicatorsOnIndicator',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Indicators on indicator',
    nameFa: 'اندیکاتور روی اندیکاتور',
    descEn: 'Chained indicator overlay depth (e.g. EMA on RSI)',
    descFa: 'عمق لایه‌بندی اندیکاتور روی اندیکاتور دیگر (مانند میانگین روی RSI)',
    default: 1, min: 0, max: 50, step: 1, unitEn: 'layers', unitFa: 'لایه'
  },
  {
    id: 'savedTemplates',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Saved templates',
    nameFa: 'قالب‌های ذخیره‌شده',
    descEn: 'Saved indicator bundle templates for one-click setup',
    descFa: 'تعداد قالب‌های آماده اندیکاتور قابل ذخیره',
    default: 1, min: 1, max: 100, step: 1, unitEn: 'templates', unitFa: 'قالب'
  },
  {
    id: 'histBars',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Historical bars depth',
    nameFa: 'کندل‌های تاریخی',
    descEn: 'Maximum historical OHLCV candles returned and rendered per timeframe',
    descFa: 'حداکثر عمق کندل‌های تاریخی قابل بارگذاری در هر تایم‌فریم',
    default: 10000, min: 1000, max: 100000, step: 1000, unitEn: 'bars', unitFa: 'کندل'
  },
  {
    id: 'barReplayMinuteDays',
    type: 'numeric',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Minute replay depth (days)',
    nameFa: 'بازپخش داده دقیقه‌ای (روز)',
    descEn: 'How far back minute-level bar replay can rewind (-1 for unlimited)',
    descFa: 'عمق زمانی بازپخش دقیقه‌ای کندل‌ها بر حسب روز (۱- برای نامحدود)',
    default: 180, min: 30, max: 3650, step: 30, unitEn: 'days', unitFa: 'روز'
  },

  // ── 2. Chart & Analysis Boolean Feature Flags ──────────────────────────────
  {
    id: 'secondIntervals',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Second-based intervals (1s, 5s, 15s, 30s)',
    nameFa: 'تایم‌فریم‌های ثانیه‌ای (۱، ۵، ۱۵ و ۳۰ ثانیه)',
    descEn: 'Access sub-minute ultra-high frequency candlestick intervals',
    descFa: 'دسترسی به تایم‌فریم‌های بسیار سریع ثانیه‌ای برای اسکالپ',
    default: false
  },
  {
    id: 'tickIntervals',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Tick-level intervals',
    nameFa: 'تایم‌فریم‌های تیک (Tick)',
    descEn: 'Trade-by-trade raw tick resolution charting',
    descFa: 'تحلیل چارت با وضوح داده تیک‌به‌تیک معاملات خام',
    default: false
  },
  {
    id: 'customIntervals',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Custom intervals & timeframes',
    nameFa: 'تایم‌فریم‌های سفارشی',
    descEn: 'Create custom candle intervals (e.g. 7m, 3h, 2d)',
    descFa: 'تعریف بازه‌های زمانی دلخواه (مانند ۷ دقیقه یا ۳ ساعته)',
    default: false
  },
  {
    id: 'synthChartTypes',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Synthetic chart types (Renko, Kagi, P&F)',
    nameFa: 'انواع چارت پیشرفته (رنکو، کاگی، P&F)',
    descEn: 'Price-action filtering charts including Renko, Kagi, and Point & Figure',
    descFa: 'چارت‌های فیلترکننده نویز بازار مانند رنکو، کاگی و پوینت‌اند‌فیگور',
    default: false
  },
  {
    id: 'multiTfAnalysis',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Multi-timeframe analysis',
    nameFa: 'تحلیل چند‌تایم‌فریم همزمان',
    descEn: 'Multi-timeframe overlays and indicator sync across timeframes',
    descFa: 'هم‌پوشانی و تحلیل همزمان داده‌های تایم‌فریم‌های بالاتر روی چارت',
    default: false
  },
  {
    id: 'barReplaySecond',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Second-level bar replay',
    nameFa: 'بازپخش داده‌های ثانیه‌ای',
    descEn: 'Tick and second-by-second historical bar playback',
    descFa: 'بازپخش تاریخی دقیق معاملات در مقیاس ثانیه‌ای',
    default: false
  },
  {
    id: 'dataExport',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Chart data export (CSV/JSON)',
    nameFa: 'خروجی داده چارت (CSV/JSON)',
    descEn: 'Export clean historical OHLCV bar data to CSV or JSON',
    descFa: 'امکان دریافت خروجی از داده‌های کندل‌های چارت به فرمت فایل',
    default: false
  },
  {
    id: 'compareSymbol',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Multi-symbol comparison & overlay',
    nameFa: 'مقایسه و هم‌پوشانی نمادها',
    descEn: 'Overlay multiple tickers and compare percentage performance',
    descFa: 'هم‌پوشانی چند نماد معاملاتی و مقایسه عملکرد درصدی آن‌ها',
    default: true
  },
  {
    id: 'volumeProfile',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Volume Profile & Footprint suite',
    nameFa: 'مجموعه ابزارهای پروفایل حجم',
    descEn: 'Fixed Range & Session Volume Profile and Point of Control (POC)',
    descFa: 'پروفایل حجم معاملات، محدوده ثابت و خطوط POC',
    default: false
  },
  {
    id: 'drawingTools',
    type: 'boolean',
    category: 'chart',
    categoryNameEn: 'Chart & Layouts',
    categoryNameFa: 'چارت و چیدمان‌ها',
    nameEn: 'Advanced drawing tools & patterns',
    nameFa: 'جعبه‌ابزار پیشرفته ترسیم و الگوها',
    descEn: 'Full suite of Fibonacci, Gann, harmonic, and geometric drawing tools',
    descFa: 'دسترسی کامل به ابزارهای فیبوناچی، گن، امواج الیوت و الگوها',
    default: true
  },

  // ── 3. Alerts & Webhooks ──────────────────────────────────────────────────
  {
    id: 'priceAlerts',
    type: 'numeric',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Price alerts',
    nameFa: 'هشدارهای قیمتی',
    descEn: 'Maximum active price crossing and channel alerts',
    descFa: 'حداکثر تعداد هشدارهای فعال عبور از قیمت و کانال‌ها',
    default: 3, min: 0, max: 2000, step: 5, unitEn: 'alerts', unitFa: 'هشدار'
  },
  {
    id: 'technicalAlerts',
    type: 'numeric',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Technical & indicator alerts',
    nameFa: 'هشدارهای تکنیکال و اندیکاتوری',
    descEn: 'Indicator signal alerts (RSI overbought, MACD cross, Bollinger break)',
    descFa: 'هشدارهای بر پایه اندیکاتورها مانند تقاطع میانگین‌ها و نواحی اشباع',
    default: 0, min: 0, max: 2000, step: 5, unitEn: 'alerts', unitFa: 'هشدار'
  },
  {
    id: 'watchlistAlerts',
    type: 'numeric',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Watchlist-wide alerts',
    nameFa: 'هشدارهای کلی واچ‌لیست',
    descEn: 'Simultaneous alerts applied to an entire watchlist collection',
    descFa: 'تنظیم یکباره هشدار برای تمامی نمادهای موجود در یک واچ‌لیست',
    default: 0, min: 0, max: 50, step: 1, unitEn: 'alerts', unitFa: 'هشدار'
  },
  {
    id: 'alertDays',
    type: 'numeric',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Alert lifetime (days)',
    nameFa: 'ماندگاری هشدار (روز)',
    descEn: 'Days before an untriggered alert automatically expires (-1 for infinite)',
    descFa: 'مدت ماندگاری هشدارهای فعال بر حسب روز (۱- برای بدون انقضا)',
    default: 30, min: 7, max: 365, step: 7, unitEn: 'days', unitFa: 'روز'
  },
  {
    id: 'webhookAlerts',
    type: 'boolean',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Webhook & trading bot notifications',
    nameFa: 'هشدار وب‌هوک و اتصال به ربات',
    descEn: 'Send JSON payloads to external webhook endpoints, Telegram bots, or execution relays',
    descFa: 'ارسال خودکار سیگنال‌ها از طریق وب‌هوک به سرورها و ربات‌های معامله‌گر',
    default: false
  },
  {
    id: 'multiCondAlerts',
    type: 'boolean',
    category: 'alerts',
    categoryNameEn: 'Alerts & Webhooks',
    categoryNameFa: 'هشدارها و وب‌هوک',
    nameEn: 'Multi-condition compound alerts',
    nameFa: 'هشدارهای ترکیبی و چند‌شرطی',
    descEn: 'Trigger alerts only when multiple indicators and price conditions align',
    descFa: 'فعال‌سازی هشدار تنها در صورت تحقق همزمان چند شرط تکنیکال مختلف',
    default: false
  },

  // ── 4. Screener & Watchlists ──────────────────────────────────────────────
  {
    id: 'watchlists',
    type: 'numeric',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Watchlists count',
    nameFa: 'تعداد واچ‌لیست‌ها',
    descEn: 'Maximum number of custom symbol lists',
    descFa: 'حداکثر تعداد لیست‌های سفارشی زیرنظر برای نمادها',
    default: 1, min: 1, max: 100, step: 1, unitEn: 'lists', unitFa: 'لیست'
  },
  {
    id: 'watchlistSymbols',
    type: 'numeric',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Symbols per watchlist',
    nameFa: 'نماد در هر واچ‌لیست',
    descEn: 'Maximum tickers stored inside a single watchlist',
    descFa: 'حداکثر تعداد نمادهای قابل گنجاندن در هر واچ‌لیست',
    default: 30, min: 10, max: 5000, step: 10, unitEn: 'symbols', unitFa: 'نماد'
  },
  {
    id: 'flagColors',
    type: 'numeric',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Watchlist flag colors',
    nameFa: 'رنگ‌های پرچم دیده‌بان',
    descEn: 'Number of distinct colored symbol flags available (1 to 7)',
    descFa: 'تعداد رنگ‌های متمایز پرچم برای دسته‌بندی بصری نمادها (۱ تا ۷)',
    default: 1, min: 1, max: 7, step: 1, unitEn: 'colors', unitFa: 'رنگ'
  },
  {
    id: 'screenerAutoRefreshSec',
    type: 'numeric',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Screener auto-refresh rate (sec)',
    nameFa: 'سرعت تازه‌سازی اسکرینر (ثانیه)',
    descEn: 'Auto-refresh polling interval in seconds for the technical screener',
    descFa: 'فاصله زمانی به‌روزرسانی خودکار جدول اسکرینر تکنیکال',
    default: 60, min: 5, max: 120, step: 5, unitEn: 'sec', unitFa: 'ثانیه'
  },
  {
    id: 'aiScreenerReq',
    type: 'numeric',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'AI screener queries / day',
    nameFa: 'درخواست‌های روزانه اسکرینر هوشمند',
    descEn: 'Daily allocation for natural language AI screener and pattern filters',
    descFa: 'سهمیه روزانه جستجو و فیلترهای هوش مصنوعی روی کل بازار',
    default: 100, min: 10, max: 5000, step: 50, unitEn: 'req/day', unitFa: 'درخواست'
  },
  {
    id: 'marketTrackers',
    type: 'boolean',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Institutional & SEC EDGAR trackers',
    nameFa: 'دیده‌بان معامله‌گران نهادی و SEC',
    descEn: 'Access congressional trades, insider transactions, and hedge fund 13F filings',
    descFa: 'مشاهده معاملات کنگره آمریکا، خریدهای اینسایدر و فرم‌های 13F صندوق‌های بزرگ',
    default: true
  },
  {
    id: 'economicCalendar',
    type: 'boolean',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Global economic calendar & events',
    nameFa: 'تقویم اقتصادی و رویدادهای جهانی',
    descEn: 'Real-time high-impact macroeconomic releases (FOMC, CPI, NFP, GDP)',
    descFa: 'تقویم لحظه‌ای داده‌های اقتصاد کلان شامل تصمیمات بهره و تورم جهانی',
    default: true
  },
  {
    id: 'marketNews',
    type: 'boolean',
    category: 'screener',
    categoryNameEn: 'Watchlists & Screener',
    categoryNameFa: 'دیده‌بان و اسکرینر',
    nameEn: 'Real-time breaking market news',
    nameFa: 'اخبار و کاتالیزورهای فوری بازار',
    descEn: 'Live breaking catalyst news feed categorized by asset class',
    descFa: 'پوشش زنده اخبار دست‌اول و کاتالیزورهای نوسان‌ساز بازار',
    default: true
  },

  // ── 5. Trading, Simulators & Journal ──────────────────────────────────────
  {
    id: 'paperAccounts',
    type: 'numeric',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Paper trading accounts',
    nameFa: 'حساب‌های معاملاتی آزمایشی',
    descEn: 'Number of independent paper trading simulator accounts',
    descFa: 'حداکثر تعداد حساب‌های آزمایشی مستقل معاملات کاغذی (Paper Trading)',
    default: 1, min: 1, max: 20, step: 1, unitEn: 'accounts', unitFa: 'حساب'
  },
  {
    id: 'holdingsPerAccount',
    type: 'numeric',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Max open positions per account',
    nameFa: 'پوزیشن‌های باز در هر حساب',
    descEn: 'Simultaneous open orders and holdings allowed per paper account',
    descFa: 'سقف پوزیشن‌های باز همزمان در هر حساب معاملاتی',
    default: 20, min: 10, max: 500, step: 10, unitEn: 'positions', unitFa: 'پوزیشن'
  },
  {
    id: 'propFirmSim',
    type: 'boolean',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Prop-Firm challenge simulator',
    nameFa: 'شبیه‌ساز چالش‌های پراپ‌فرم',
    descEn: 'Evaluation simulator with strict daily drawdown and profit targets (FTMO, MFF rules)',
    descFa: 'شبیه‌ساز تخصصی چالش‌های پراپ‌فرم با قوانین افت سرمایه و اهداف سودآوری',
    default: true
  },
  {
    id: 'depthOfMarket',
    type: 'boolean',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Level 2 Depth of Market (DOM)',
    nameFa: 'عمق بازار پیشرفته (DOM لول ۲)',
    descEn: 'Interactive Level 2 orderbook ladder with volume imbalances and one-click execution',
    descFa: 'نردبان عمق دفتر سفارشات لول ۲ با نمایش عدم تعادل حجم و اجرای سریع سفارش',
    default: true
  },
  {
    id: 'tradeJournal',
    type: 'boolean',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Interactive trade journal & analytics',
    nameFa: 'ژورنال معاملاتی هوشمند و تحلیل',
    descEn: 'Full trade logbook, tags, emotional state tracking, and performance analytics',
    descFa: 'ثبت و تحلیل حرفه‌ای معاملات همراه با برچسب‌گذاری و ارزیابی روانی معامله‌گر',
    default: true
  },
  {
    id: 'technicalRating',
    type: 'boolean',
    category: 'trading',
    categoryNameEn: 'Trading & Simulators',
    categoryNameFa: 'معاملات و شبیه‌سازها',
    nameEn: 'Multi-indicator technical rating summary',
    nameFa: 'خلاصه ارزیابی تکنیکال چنداندیکاتوره',
    descEn: 'Aggregated Buy/Sell/Neutral gauge score derived from oscillators and moving averages',
    descFa: 'کارت امتیازدهی تجمیعی وضعیت خرید/فروش تکنیکال نماد بر اساس میانگین‌ها و اسیلاتورها',
    default: true
  },

  // ── 6. Pine Script, Backtesting & Reports ─────────────────────────────────
  {
    id: 'pineStudio',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Pine Script studio & editor',
    nameFa: 'استودیو و کامپایلر پاین‌اسکریپت',
    descEn: 'Write, debug, and run custom Pine Script v5 indicators and strategies',
    descFa: 'محیط کدنویسی و اجرای اسکریپت‌ها و استراتژی‌های اختصاصی پاین‌اسکریپت',
    default: true
  },
  {
    id: 'pineTimeLimitSec',
    type: 'numeric',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Pine execution timeout (sec)',
    nameFa: 'سقف زمان اجرای اسکریپت پاین (ثانیه)',
    descEn: 'Maximum script execution runtime before timeout protection',
    descFa: 'حداکثر زمان مجاز پردازش اسکریپت‌های پاین تا پیشگیری از قفل شدن',
    default: 20, min: 5, max: 300, step: 5, unitEn: 'sec', unitFa: 'ثانیه'
  },
  {
    id: 'deepBacktest',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Deep backtesting engine',
    nameFa: 'موتور بک‌تست عمیق',
    descEn: 'Backtest strategies on all available historical data beyond chart window',
    descFa: 'آزمایش استراتژی روی کل سابقه تاریخی در دسترس، فراتر از کندل‌های روی چارت',
    default: false
  },
  {
    id: 'strategyTester',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Strategy tester panel & metrics',
    nameFa: 'پنل تستر استراتژی معاملاتی',
    descEn: 'Net profit, drawdown, win-rate, profit factor, and trade-by-trade review',
    descFa: 'محاسبه سود خالص، افت سرمایه، نسبت برد و ضریب سودآوری استراتژی',
    default: true
  },
  {
    id: 'advancedReport',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Advanced performance analytics',
    nameFa: 'گزارش‌های تحلیلی عملکرد',
    descEn: 'Detailed distribution curves, Sharpe/Sortino ratios, and trade duration charts',
    descFa: 'نمودارهای پیشرفته نسبت شارپ و سورتینو و توزیع مدت زمان معاملات',
    default: false
  },
  {
    id: 'csvTradesExport',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Trades CSV export',
    nameFa: 'خروجی CSV معاملات',
    descEn: 'Download raw simulated trade history log in CSV format',
    descFa: 'دریافت فایل داده‌های متنی CSV از کلیه معاملات انجام‌شده در آزمون استراتژی',
    default: false
  },
  {
    id: 'xlsxReport',
    type: 'boolean',
    category: 'backtest',
    categoryNameEn: 'Pine Script & Backtest',
    categoryNameFa: 'پاین‌اسکریپت و بک‌تست',
    nameEn: 'Comprehensive XLSX executive report',
    nameFa: 'گزارش جامع اکسل (XLSX)',
    descEn: 'Export institutional multi-sheet Excel workbook with formatted charts and metrics',
    descFa: 'دریافت گزارش مالی جامع اکسل چندبرگی با فرمت‌بندی پیشرفته و محاسبات عملکرد',
    default: false
  },

  // ── 7. Platform & Social Limits ───────────────────────────────────────────
  {
    id: 'marketSubscriptions',
    type: 'numeric',
    category: 'platform',
    categoryNameEn: 'Platform & Social',
    categoryNameFa: 'پلتفرم و شبکه‌های اجتماعی',
    nameEn: 'Simultaneous market subscriptions',
    nameFa: 'اشتراک‌های فعال همزمان بازار',
    descEn: 'Concurrent live price WebSocket subscription channels allowed',
    descFa: 'تعداد کانال‌های اتصال همزمان دریافت نرخ زنده بازار از طریق سوکت',
    default: 2, min: 1, max: 500, step: 1, unitEn: 'subs', unitFa: 'اشتراک'
  },
  {
    id: 'socialLinks',
    type: 'boolean',
    category: 'platform',
    categoryNameEn: 'Platform & Social',
    categoryNameFa: 'پلتفرم و شبکه‌های اجتماعی',
    nameEn: 'Public profile social links',
    nameFa: 'پیوندهای شبکه‌های اجتماعی در پروفایل',
    descEn: 'Display verified social media links on public profile card',
    descFa: 'امکان درج پیوندهای شبکه‌های اجتماعی در صفحه پروفایل عمومی',
    default: true
  },
  {
    id: 'screenshotShare',
    type: 'boolean',
    category: 'platform',
    categoryNameEn: 'Platform & Social',
    categoryNameFa: 'پلتفرم و شبکه‌های اجتماعی',
    nameEn: 'Chart screenshot & social share',
    nameFa: 'ثبت تصویر و اشتراک‌گذاری چارت',
    descEn: 'One-click high-res chart snapshots with watermark & direct sharing link',
    descFa: 'امکان ذخیره تصاویر باکیفیت از چارت با واترمارک و ایجاد لینک اشتراک‌گذاری',
    default: true
  }
];

export const CATEGORIES = [
  { id: 'chart', nameEn: 'Chart & Analysis', nameFa: 'چارت و تحلیل تکنیکال', icon: '📊' },
  { id: 'alerts', nameEn: 'Alerts & Webhooks', nameFa: 'هشدارها و وب‌هوک', icon: '🔔' },
  { id: 'screener', nameEn: 'Watchlists & Screener', nameFa: 'دیده‌بان و اسکرینر', icon: '🔍' },
  { id: 'trading', nameEn: 'Trading & Simulators', nameFa: 'معاملات و شبیه‌سازها', icon: '💼' },
  { id: 'backtest', nameEn: 'Pine Script & Backtest', nameFa: 'پاین‌اسکریپت و بک‌تست', icon: '🔬' },
  { id: 'platform', nameEn: 'Platform & Social', nameFa: 'پلتفرم و دسترسی‌ها', icon: '🌐' }
];
