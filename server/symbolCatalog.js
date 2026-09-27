// server/symbolCatalog.js
// Universal symbol registry across Crypto, Forex, Metals, Commodities, Indices, Stocks,
// Tehran Gold & Currency Market, and Tehran Stock Exchange (TSETMC).

export const SYMBOL_CATALOG = [
  // ── 1. Crypto Spot & Perpetuals (Binance / Global Exchanges) ────────
  { symbol: 'BTCUSDT', name: 'Bitcoin', nameFa: 'بیت‌کوین', category: 'crypto', base: 'BTC', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.0001, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'ETHUSDT', name: 'Ethereum', nameFa: 'اتریوم', category: 'crypto', base: 'ETH', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.001, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'SOLUSDT', name: 'Solana', nameFa: 'سولانا', category: 'crypto', base: 'SOL', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'BNBUSDT', name: 'BNB', nameFa: 'بایننس کوین', category: 'crypto', base: 'BNB', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'XRPUSDT', name: 'Ripple', nameFa: 'ریپل', category: 'crypto', base: 'XRP', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'TONUSDT', name: 'Toncoin', nameFa: 'تون کوین', category: 'crypto', base: 'TON', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 0.1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', nameFa: 'دوج کوین', category: 'crypto', base: 'DOGE', quote: 'USDT', precision: 5, minTick: 0.00001, lotSize: 1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'ADAUSDT', name: 'Cardano', nameFa: 'کاردانو', category: 'crypto', base: 'ADA', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', nameFa: 'آوالانچ', category: 'crypto', base: 'AVAX', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'LINKUSDT', name: 'Chainlink', nameFa: 'چین‌لینک', category: 'crypto', base: 'LINK', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'SUIUSDT', name: 'Sui Network', nameFa: 'سویی', category: 'crypto', base: 'SUI', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', nameFa: 'نیر پروتکل', category: 'crypto', base: 'NEAR', quote: 'USDT', precision: 3, minTick: 0.001, lotSize: 0.1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'APTUSDT', name: 'Aptos', nameFa: 'آپتوس', category: 'crypto', base: 'APT', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'PEPEUSDT', name: 'Pepe', nameFa: 'پپه', category: 'crypto', base: 'PEPE', quote: 'USDT', precision: 8, minTick: 0.00000001, lotSize: 1000, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', nameFa: 'شیبا اینو', category: 'crypto', base: 'SHIB', quote: 'USDT', precision: 8, minTick: 0.00000001, lotSize: 1000, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'TAOUSDT', name: 'Bittensor', nameFa: 'بیت‌تنسور', category: 'crypto', base: 'TAO', quote: 'USDT', precision: 1, minTick: 0.1, lotSize: 0.001, exchange: 'Binance', market: 'crypto', currency: 'USDT' },
  { symbol: 'RENDERUSDT', name: 'Render', nameFa: 'رندر', category: 'crypto', base: 'RENDER', quote: 'USDT', precision: 3, minTick: 0.001, lotSize: 0.1, exchange: 'Binance', market: 'crypto', currency: 'USDT' },

  // ── 2. Metals & Global Commodities (OANDA / NYMEX / ICE) ─────────────
  { symbol: 'XAUUSD', name: 'Gold / US Dollar Spot', nameFa: 'انس طلای جهانی', category: 'metals', base: 'XAU', quote: 'USD', precision: 2, minTick: 0.05, lotSize: 1, exchange: 'OANDA', market: 'metals', currency: 'USD' },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar Spot', nameFa: 'انس نقره جهانی', category: 'metals', base: 'XAG', quote: 'USD', precision: 3, minTick: 0.005, lotSize: 50, exchange: 'OANDA', market: 'metals', currency: 'USD' },
  { symbol: 'USOIL', name: 'WTI Crude Oil', nameFa: 'نفت خام وست تگزاس', category: 'commodities', base: 'WTI', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 10, exchange: 'NYMEX', market: 'commodities', currency: 'USD' },
  { symbol: 'UKOIL', name: 'Brent Crude Oil', nameFa: 'نفت خام برنت دریای شمال', category: 'commodities', base: 'BRENT', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 10, exchange: 'ICE', market: 'commodities', currency: 'USD' },
  { symbol: 'NATGAS', name: 'Natural Gas', nameFa: 'گاز طبیعی هنری هاب', category: 'commodities', base: 'NG', quote: 'USD', precision: 3, minTick: 0.001, lotSize: 100, exchange: 'NYMEX', market: 'commodities', currency: 'USD' },

  // ── 3. Forex Majors & Crosses (FX_IDC / MT5 Bridge) ─────────────────
  { symbol: 'EURUSD', name: 'Euro / US Dollar', nameFa: 'یورو / دلار آمریکا', category: 'forex', base: 'EUR', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'USD' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', nameFa: 'پوند انگلیس / دلار آمریکا', category: 'forex', base: 'GBP', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'USD' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', nameFa: 'دلار آمریکا / ین ژاپن', category: 'forex', base: 'USD', quote: 'JPY', precision: 3, minTick: 0.001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'JPY' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', nameFa: 'دلار استرالیا / دلار آمریکا', category: 'forex', base: 'AUD', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'USD' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', nameFa: 'دلار آمریکا / دلار کانادا', category: 'forex', base: 'USD', quote: 'CAD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'CAD' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', nameFa: 'دلار آمریکا / فرانک سوئیس', category: 'forex', base: 'USD', quote: 'CHF', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'CHF' },
  { symbol: 'EURGBP', name: 'Euro / British Pound', nameFa: 'یورو / پوند بریتانیا', category: 'forex', base: 'EUR', quote: 'GBP', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'GBP' },
  { symbol: 'EURJPY', name: 'Euro / Japanese Yen', nameFa: 'یورو / ین ژاپن', category: 'forex', base: 'EUR', quote: 'JPY', precision: 3, minTick: 0.001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'JPY' },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', nameFa: 'پوند بریتانیا / ین ژاپن', category: 'forex', base: 'GBP', quote: 'JPY', precision: 3, minTick: 0.001, lotSize: 10000, exchange: 'FX_IDC', market: 'forex', currency: 'JPY' },

  // ── 4. Global Indices & Equities (CBOE / NASDAQ / NYSE) ─────────────
  { symbol: 'SPX', name: 'S&P 500 Index', nameFa: 'شاخص اس‌اندپی ۵۰۰', category: 'indices', base: 'SPX', quote: 'USD', precision: 2, minTick: 0.1, lotSize: 1, exchange: 'CBOE', market: 'indices', currency: 'USD' },
  { symbol: 'NDX', name: 'Nasdaq 100 Index', nameFa: 'شاخص نزدک ۱۰۰', category: 'indices', base: 'NDX', quote: 'USD', precision: 2, minTick: 0.25, lotSize: 1, exchange: 'NASDAQ', market: 'indices', currency: 'USD' },
  { symbol: 'DJI', name: 'Dow Jones Industrial Average', nameFa: 'شاخص داو جونز', category: 'indices', base: 'DJI', quote: 'USD', precision: 2, minTick: 1.0, lotSize: 1, exchange: 'DJ', market: 'indices', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc.', nameFa: 'سهام شرکت اپل', category: 'stocks', base: 'AAPL', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', nameFa: 'سهام شرکت انویدیا', category: 'stocks', base: 'NVDA', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', nameFa: 'سهام شرکت تسلا', category: 'stocks', base: 'TSLA', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', nameFa: 'سهام مایکروسافت', category: 'stocks', base: 'MSFT', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', nameFa: 'سهام آمازون', category: 'stocks', base: 'AMZN', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', nameFa: 'سهام آلفابت (گوگل)', category: 'stocks', base: 'GOOGL', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },
  { symbol: 'META', name: 'Meta Platforms Inc.', nameFa: 'سهام متا (فیسبوک)', category: 'stocks', base: 'META', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ', market: 'stocks', currency: 'USD' },

  // ── 5. Tehran Gold Market, Coins & Currencies (FinTech Engine) ──────
  { symbol: 'GOLD_ABSHODEH', name: 'Melted Gold 17k (Tehran Bazaar)', nameFa: 'طلای آبشده بنکداری تهران (۱۷ عیار / مثقال)', category: 'iran_gold', base: 'ABSHODEH', quote: 'TMN', precision: 0, minTick: 1000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'آبشده' },
  { symbol: 'GOLD_18K', name: '18k Gram Gold 750', nameFa: 'طلای ۱۸ عیار (۷۵۰ گرمی)', category: 'iran_gold', base: 'GOLD18K', quote: 'TMN', precision: 0, minTick: 1000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'طلا ۱۸' },
  { symbol: 'COIN_EMAMI', name: 'Emami Gold Coin (New Bahar)', nameFa: 'سکه تمام بهار آزادی طرح جدید (امامی)', category: 'iran_gold', base: 'EMAMI', quote: 'TMN', precision: 0, minTick: 10000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'سکه امامی' },
  { symbol: 'COIN_BAHAR', name: 'Bahar Azadi Gold Coin (Old)', nameFa: 'سکه تمام بهار آزادی طرح قدیم', category: 'iran_gold', base: 'BAHAR', quote: 'TMN', precision: 0, minTick: 10000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'سکه بهار' },
  { symbol: 'COIN_NIM', name: 'Half Bahar Azadi Coin', nameFa: 'نیم سکه بهار آزادی', category: 'iran_gold', base: 'NIM', quote: 'TMN', precision: 0, minTick: 10000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'نیم سکه' },
  { symbol: 'COIN_ROB', name: 'Quarter Bahar Azadi Coin', nameFa: 'ربع سکه بهار آزادی', category: 'iran_gold', base: 'ROB', quote: 'TMN', precision: 0, minTick: 10000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'ربع سکه' },
  { symbol: 'COIN_GERMI', name: 'Central Bank 1g Gold Coin', nameFa: 'سکه یک گرمی بانک مرکزی', category: 'iran_gold', base: 'GERMI', quote: 'TMN', precision: 0, minTick: 10000, lotSize: 1, exchange: 'Tehran Bazaar', market: 'iran_gold', currency: 'TMN', tickerFa: 'سکه گرمی' },
  { symbol: 'USD_TEHRAN', name: 'Tehran Free Market USD', nameFa: 'دلار آزاد بازار تهران', category: 'iran_gold', base: 'USD', quote: 'TMN', precision: 0, minTick: 50, lotSize: 100, exchange: 'Tehran FX', market: 'iran_gold', currency: 'TMN', tickerFa: 'دلار تهران' },
  { symbol: 'USDT_TOMAN', name: 'Tether USDT / Iranian Toman', nameFa: 'تتر تومانی صرافی‌های ایران (نوبیتکس)', category: 'iran_gold', base: 'USDT', quote: 'TMN', precision: 0, minTick: 50, lotSize: 10, exchange: 'Nobitex', market: 'iran_gold', currency: 'TMN', tickerFa: 'تتر تومان' },
  { symbol: 'AED_DIRHAM', name: 'UAE Dirham Remittance', nameFa: 'حواله درهم امارات (دبی)', category: 'iran_gold', base: 'AED', quote: 'TMN', precision: 0, minTick: 20, lotSize: 100, exchange: 'Dubai FX', market: 'iran_gold', currency: 'TMN', tickerFa: 'درهم امارات' },

  // ── 6. Tehran Stock Exchange (TSETMC / بورس و فرابورس ایران) ──────────
  { symbol: 'FOOLAD', name: 'Mobarakeh Steel Co.', nameFa: 'فولاد مبارکه اصفهان', category: 'iran_tse', base: 'فولاد', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'فولاد', insco: '46348559193224090' },
  { symbol: 'FAMELI', name: 'National Iranian Copper (NICICO)', nameFa: 'ملی صنایع مس ایران', category: 'iran_tse', base: 'فملی', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'فملی', insco: '35425587644337450' },
  { symbol: 'KHODRO', name: 'Iran Khodro Co.', nameFa: 'ایران خودرو', category: 'iran_tse', base: 'خودرو', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'خودرو', insco: '65883838195688438' },
  { symbol: 'SAIPA', name: 'Saipa Motor Corp.', nameFa: 'سایپا (خساپا)', category: 'iran_tse', base: 'خساپا', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'خساپا', insco: '35700344742885862' },
  { symbol: 'SHASTA', name: 'Social Security Investment (SSIC)', nameFa: 'سرمایه‌گذاری تامین اجتماعی (شستا)', category: 'iran_tse', base: 'شستا', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'شستا', insco: '2400322364771558' },
  { symbol: 'AHRAM', name: 'Charisma Leveraged ETF (Ahram)', nameFa: 'صندوق اهرمی کاریزما (اهرم)', category: 'iran_tse', base: 'اهرم', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'اهرم', insco: '61101334180158305' },
  { symbol: 'AGAS', name: 'Agah Premium Stock Fund', nameFa: 'صندوق سرمایه‌گذاری آگاه (آگاس)', category: 'iran_tse', base: 'آگاس', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'آگاس', insco: '43924729177519967' },
  { symbol: 'TALA', name: 'Lotus Gold ETF', nameFa: 'صندوق طلای لوتوس (طلا)', category: 'iran_tse', base: 'طلا', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'طلا', insco: '63870029980856737' },
  { symbol: 'AYAR', name: 'Mofid Ayar Gold ETF', nameFa: 'صندوق طلای عیار مفید (عیار)', category: 'iran_tse', base: 'عیار', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'عیار', insco: '48688404286121404' },
  { symbol: 'TAVAN', name: 'Mofid Tavan Leveraged ETF', nameFa: 'صندوق اهرمی توان مفید (توان)', category: 'iran_tse', base: 'توان', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'توان', insco: '43924729177519967' },
  { symbol: 'SHPNA', name: 'Isfahan Oil Refining Co.', nameFa: 'پالایش نفت اصفهان (شپنا)', category: 'iran_tse', base: 'شپنا', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'شپنا', insco: '35366681030756042' },
  { symbol: 'SHETRAN', name: 'Tehran Oil Refining Co.', nameFa: 'پالایش نفت تهران (شتران)', category: 'iran_tse', base: 'شتران', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'شتران', insco: '2400322364771558' },
  { symbol: 'DARAYEKOM', name: 'Dara Yekom Financial ETF', nameFa: 'صندوق واسطه‌گری مالی یکم (دارا یکم)', category: 'iran_tse', base: 'دارایکم', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'دارا یکم', insco: '65883838195688438' },
  { symbol: 'PALAYESH', name: 'Palayesh Yekom Energy ETF', nameFa: 'صندوق پالایشی یکم (پالایش)', category: 'iran_tse', base: 'پالایش', quote: 'IRR', precision: 0, minTick: 10, lotSize: 10, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'پالایش', insco: '35700344742885862' },
  { symbol: 'VABANKE', name: 'National Development Group', nameFa: 'سرمایه‌گذاری گروه توسعه ملی (وبانک)', category: 'iran_tse', base: 'وبانک', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'وبانک', insco: '35425587644337450' },
  { symbol: 'FARABOURSE', name: 'Fara Bourse Iran', nameFa: 'فرابورس ایران (فرابورس)', category: 'iran_tse', base: 'فرابورس', quote: 'IRR', precision: 0, minTick: 10, lotSize: 100, exchange: 'TSETMC', market: 'iran_tse', currency: 'IRR', tickerFa: 'فرابورس', insco: '46348559193224090' }
];

export function searchSymbols(query = '', category = 'all', exchange = 'all') {
  const q = String(query || '').trim().toLowerCase();
  const cat = String(category || 'all').toLowerCase();
  const ex = String(exchange || 'all').toLowerCase();

  return SYMBOL_CATALOG.filter(item => {
    // 1. Category filter
    let matchCat = true;
    if (cat !== 'all') {
      if (cat === 'crypto') matchCat = item.category === 'crypto';
      else if (cat === 'metals') matchCat = item.category === 'metals';
      else if (cat === 'commodities') matchCat = item.category === 'commodities';
      else if (cat === 'forex') matchCat = item.category === 'forex';
      else if (cat === 'indices') matchCat = item.category === 'indices';
      else if (cat === 'stocks') matchCat = item.category === 'stocks';
      else if (cat === 'iran_gold' || cat === 'gold_fx') matchCat = item.category === 'iran_gold';
      else if (cat === 'iran_tse' || cat === 'bourse') matchCat = item.category === 'iran_tse';
      else matchCat = item.category === cat;
    }
    if (!matchCat) return false;

    // 2. Exchange filter
    if (ex !== 'all') {
      const itemEx = (item.exchange || '').toLowerCase();
      if (!itemEx.includes(ex)) return false;
    }

    // 3. Query string filter (Matches symbol, English name, Persian name, or base asset)
    if (!q) return true;

    const symMatch = item.symbol.toLowerCase().includes(q);
    const nameMatch = item.name.toLowerCase().includes(q);
    const nameFaMatch = item.nameFa && item.nameFa.toLowerCase().includes(q);
    const baseMatch = item.base && item.base.toLowerCase().includes(q);
    const tickerFaMatch = item.tickerFa && item.tickerFa.toLowerCase().includes(q);

    return symMatch || nameMatch || nameFaMatch || baseMatch || tickerFaMatch;
  });
}

export function getSymbolMeta(symbol) {
  const clean = String(symbol || '').replace(/^.*:/, '').toUpperCase();
  const found = SYMBOL_CATALOG.find(s => s.symbol === clean);
  if (found) return found;

  const isCrypto = clean.endsWith('USDT') || clean.endsWith('BTC') || clean.endsWith('ETH');
  return {
    symbol: clean,
    name: clean,
    nameFa: clean,
    category: isCrypto ? 'crypto' : 'stocks',
    base: clean.replace(/(USDT|USD|EUR|BTC|IRR|TMN)$/, ''),
    quote: isCrypto ? 'USDT' : 'USD',
    precision: isCrypto ? 2 : 2,
    minTick: 0.01,
    lotSize: 1,
    exchange: isCrypto ? 'Binance' : 'Global',
    market: isCrypto ? 'crypto' : 'stocks',
    currency: isCrypto ? 'USDT' : 'USD'
  };
}
