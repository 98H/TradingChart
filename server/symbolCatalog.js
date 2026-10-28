// server/symbolCatalog.js
// Universal real symbol registry across Crypto (Binance spot universe),
// Curated TradingView global markets (Forex, Metals, Commodities, Indices, Stocks, ETFs, Bonds),
// and legacy alias resolution. Honest data only (zero demo/synthetic).

import { CostLruCache } from './lru.js';
import { TGJU_ENTRIES, TGJU_SLUG_MAP } from './tgjuClient.js';
import { tseSource } from './tseSource.js';

const TV_SEARCH_URL = 'https://symbol-search.tradingview.com/symbol_search/v3/';
const TV_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BINANCE_BASES = [
  'https://data-api.binance.vision/api/v3',
  'https://api.binance.com/api/v3',
  'https://api.binance.us/api/v3'
];

const STANDARD_TIMEFRAMES = [
  '1s', '1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', '3D', 'W', 'M'
];

// Curated Persian names for major crypto assets
const CRYPTO_FA_NAMES = {
  BTC: 'بیت‌کوین',
  ETH: 'اتریوم',
  SOL: 'سولانا',
  BNB: 'بایننس کوین',
  XRP: 'ریپل',
  TON: 'تون کوین',
  DOGE: 'دوج کوین',
  ADA: 'کاردانو',
  AVAX: 'آوالانچ',
  LINK: 'چین‌لینک',
  SUI: 'سویی',
  NEAR: 'نیر پروتکل',
  APT: 'آپتوس',
  PEPE: 'پپه',
  SHIB: 'شیبا اینو',
  TAO: 'بیت‌تنسور',
  RENDER: 'رندر',
  DOT: 'پولکادات',
  POL: 'پالیگان',
  MATIC: 'پالیگان',
  LTC: 'لایت‌کوین',
  BCH: 'بیت‌کوین کش',
  UNI: 'یونی‌سواپ',
  ATOM: 'کازماس',
  XLM: 'استلار',
  TRX: 'ترون',
  ETC: 'اتریوم کلاسیک',
  FIL: 'فایل‌کوین',
  ARB: 'آربیتروم',
  OP: 'آپتیمیزم',
  TIA: 'سلستیا',
  INJ: 'اینجکتیو',
  FET: 'فچ هوش مصنوعی',
  WIF: 'داگ‌ویف‌هت',
  BONK: 'بونک',
  FLOKI: 'فلوکی'
};

// ── Curated TradingView Defaults per Category ──────────────────────────────
export const CURATED_TV_DEFAULTS = [
  // 1. Forex Majors & Crosses (OANDA)
  { symbol: 'OANDA:EURUSD', name: 'EUR/USD', nameFa: 'یورو / دلار آمریکا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:GBPUSD', name: 'GBP/USD', nameFa: 'پوند انگلیس / دلار آمریکا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:USDJPY', name: 'USD/JPY', nameFa: 'دلار آمریکا / ین ژاپن', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'JPY', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 10000 },
  { symbol: 'OANDA:AUDUSD', name: 'AUD/USD', nameFa: 'دلار استرالیا / دلار آمریکا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:USDCAD', name: 'USD/CAD', nameFa: 'دلار آمریکا / دلار کانادا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'CAD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:USDCHF', name: 'USD/CHF', nameFa: 'دلار آمریکا / فرانک سوئیس', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'CHF', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:NZDUSD', name: 'NZD/USD', nameFa: 'دلار نیوزیلند / دلار آمریکا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:EURGBP', name: 'EUR/GBP', nameFa: 'یورو / پوند بریتانیا', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'GBP', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:EURJPY', name: 'EUR/JPY', nameFa: 'یورو / ین ژاپن', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'JPY', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 10000 },
  { symbol: 'OANDA:GBPJPY', name: 'GBP/JPY', nameFa: 'پوند بریتانیا / ین ژاپن', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'JPY', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 10000 },
  { symbol: 'OANDA:EURCHF', name: 'EUR/CHF', nameFa: 'یورو / فرانک سوئیس', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'CHF', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 5, minTick: 0.00001, lotSize: 10000 },
  { symbol: 'OANDA:AUDJPY', name: 'AUD/JPY', nameFa: 'دلار استرالیا / ین ژاپن', exchange: 'OANDA', type: 'forex', category: 'forex', currency: 'JPY', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 10000 },

  // 2. Metals (OANDA / TVC)
  { symbol: 'OANDA:XAUUSD', name: 'Gold / US Dollar', nameFa: 'انس طلای جهانی', exchange: 'OANDA', type: 'commodity', category: 'metals', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'OANDA:XAGUSD', name: 'Silver / US Dollar', nameFa: 'انس نقره جهانی', exchange: 'OANDA', type: 'commodity', category: 'metals', currency: 'USD', source: 'tradingview', dataStatus: 'live', delaySec: 0, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 50 },
  { symbol: 'TVC:PLATINUM', name: 'Platinum Spot', nameFa: 'پلاتین جهانی', exchange: 'TVC', type: 'commodity', category: 'metals', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.05, lotSize: 1 },
  { symbol: 'TVC:PALLADIUM', name: 'Palladium Spot', nameFa: 'پالادیوم جهانی', exchange: 'TVC', type: 'commodity', category: 'metals', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.05, lotSize: 1 },
  { symbol: 'TVC:COPPER', name: 'Copper Spot', nameFa: 'مس جهانی', exchange: 'TVC', type: 'commodity', category: 'metals', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 4, minTick: 0.0001, lotSize: 1 },

  // 3. Energy & Commodities (TVC)
  { symbol: 'TVC:USOIL', name: 'WTI Crude Oil', nameFa: 'نفت خام وست تگزاس', exchange: 'TVC', type: 'commodity', category: 'energy', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 10 },
  { symbol: 'TVC:UKOIL', name: 'Brent Crude Oil', nameFa: 'نفت خام برنت دریای شمال', exchange: 'TVC', type: 'commodity', category: 'energy', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 10 },
  { symbol: 'TVC:NATGAS', name: 'Natural Gas', nameFa: 'گاز طبیعی هنری هاب', exchange: 'TVC', type: 'commodity', category: 'energy', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 100 },

  // 4. Major Global Indices
  { symbol: 'SP:SPX', name: 'S&P 500 Index', nameFa: 'شاخص اس‌اندپی ۵۰۰', exchange: 'SP', type: 'index', category: 'indices', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:NDX', name: 'Nasdaq 100 Index', nameFa: 'شاخص نزدک ۱۰۰', exchange: 'NASDAQ', type: 'index', category: 'indices', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'DJ:DJI', name: 'Dow Jones Industrial Average', nameFa: 'شاخص داو جونز', exchange: 'DJ', type: 'index', category: 'indices', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 1.0, lotSize: 1 },
  { symbol: 'TVC:VIX', name: 'CBOE Volatility Index', nameFa: 'شاخص نوسان VIX', exchange: 'TVC', type: 'index', category: 'indices', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'TVC:DAX', name: 'DAX 40 Index', nameFa: 'شاخص داکس آلمان', exchange: 'TVC', type: 'index', category: 'indices', currency: 'EUR', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 1, minTick: 0.1, lotSize: 1 },
  { symbol: 'TVC:FTSE', name: 'FTSE 100 Index', nameFa: 'شاخص فوتسی ۱۰۰ بریتانیا', exchange: 'TVC', type: 'index', category: 'indices', currency: 'GBP', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 1, minTick: 0.1, lotSize: 1 },
  { symbol: 'TVC:NI225', name: 'Nikkei 225', nameFa: 'شاخص نیکی ۲۲۵ ژاپن', exchange: 'TVC', type: 'index', category: 'indices', currency: 'JPY', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 1, minTick: 1.0, lotSize: 1 },
  { symbol: 'TVC:DXY', name: 'US Dollar Currency Index', nameFa: 'شاخص دلار آمریکا (DXY)', exchange: 'TVC', type: 'index', category: 'indices', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 1 },

  // 5. Top US/EU Stocks
  { symbol: 'NASDAQ:AAPL', name: 'Apple Inc.', nameFa: 'سهام شرکت اپل', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:NVDA', name: 'NVIDIA Corporation', nameFa: 'سهام شرکت انویدیا', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:MSFT', name: 'Microsoft Corporation', nameFa: 'سهام مایکروسافت', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:AMZN', name: 'Amazon.com Inc.', nameFa: 'سهام آمازون', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:GOOGL', name: 'Alphabet Inc.', nameFa: 'سهام آلفابت (گوگل)', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:META', name: 'Meta Platforms Inc.', nameFa: 'سهام متا (فیسبوک)', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:TSLA', name: 'Tesla Inc.', nameFa: 'سهام شرکت تسلا', exchange: 'NASDAQ', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NYSE:BRK.A', name: 'Berkshire Hathaway Inc.', nameFa: 'سهام برکشایر هاتاوی', exchange: 'NYSE', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NYSE:JPM', name: 'JPMorgan Chase & Co.', nameFa: 'سهام جی‌پی مورگان', exchange: 'NYSE', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NYSE:V', name: 'Visa Inc.', nameFa: 'سهام ویزا', exchange: 'NYSE', type: 'stock', category: 'stocks', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'XETR:SAP', name: 'SAP SE', nameFa: 'سهام اس‌آپی آلمان', exchange: 'XETR', type: 'stock', category: 'stocks', currency: 'EUR', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },

  // 6. ETFs
  { symbol: 'AMEX:SPY', name: 'SPDR S&P 500 ETF Trust', nameFa: 'صندوق اس‌اندپی ۵۰۰ اسپایدر', exchange: 'AMEX', type: 'fund', category: 'etf', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'NASDAQ:QQQ', name: 'Invesco QQQ Trust', nameFa: 'صندوق نزدک اینوسکو', exchange: 'NASDAQ', type: 'fund', category: 'etf', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'AMEX:GLD', name: 'SPDR Gold Shares', nameFa: 'صندوق طلای اسپایدر', exchange: 'AMEX', type: 'fund', category: 'etf', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'AMEX:SLV', name: 'iShares Silver Trust', nameFa: 'صندوق نقره آی‌شیرز', exchange: 'AMEX', type: 'fund', category: 'etf', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },
  { symbol: 'AMEX:TLT', name: 'iShares 20+ Year Treasury Bond ETF', nameFa: 'صندوق اوراق ۲۰ ساله خزانه‌داری', exchange: 'AMEX', type: 'fund', category: 'etf', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 900, timeframes: STANDARD_TIMEFRAMES, precision: 2, minTick: 0.01, lotSize: 1 },

  // 7. Yields & Bonds
  { symbol: 'TVC:US10Y', name: 'US 10-Year Treasury Yield', nameFa: 'بازده اوراق ۱۰ ساله خزانه‌داری آمریکا', exchange: 'TVC', type: 'bond', category: 'bonds', currency: 'USD', source: 'tradingview', dataStatus: 'delayed', delaySec: 600, timeframes: STANDARD_TIMEFRAMES, precision: 3, minTick: 0.001, lotSize: 1 }
];

// Initial seed crypto pairs to guarantee synchronous availability
const SEED_CRYPTO_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'TONUSDT', 'DOGEUSDT', 'ADAUSDT',
  'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'NEARUSDT', 'APTUSDT', 'PEPEUSDT', 'SHIBUSDT', 'TAOUSDT',
  'RENDERUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'ATOMUSDT', 'XLMUSDT',
  'TRXUSDT', 'ETCUSDT', 'FILUSDT', 'ARBUSDT', 'OPUSDT', 'TIAUSDT', 'INJUSDT', 'FETUSDT',
  'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT', 'BTCUSDC', 'ETHUSDC', 'SOLUSDC', 'ETHBTC', 'SOLBTC',
  'BNBBTC', 'XRPBTC', 'ADABTC', 'BTCEUR', 'ETHEUR', 'BTCTRY', 'ETHTRY'
].map(pair => {
  const quote = pair.endsWith('USDT') ? 'USDT' : pair.endsWith('USDC') ? 'USDC' : pair.endsWith('BTC') ? 'BTC' : pair.endsWith('EUR') ? 'EUR' : 'TRY';
  const base = pair.slice(0, pair.length - quote.length);
  const nameFa = CRYPTO_FA_NAMES[base] ? `${CRYPTO_FA_NAMES[base]} / ${quote}` : `${base} / ${quote}`;
  const precision = quote === 'USDT' || quote === 'USDC' || quote === 'EUR' ? (pair === 'PEPEUSDT' || pair === 'SHIBUSDT' ? 8 : 2) : 6;
  const minTick = precision === 8 ? 0.00000001 : precision === 6 ? 0.000001 : 0.01;
  return {
    symbol: `BINANCE:${pair}`,
    name: `${base}/${quote}`,
    nameFa,
    exchange: 'Binance',
    type: 'crypto',
    category: 'crypto',
    currency: quote,
    base,
    quote,
    source: 'binance',
    dataStatus: 'live',
    delaySec: 0,
    timeframes: STANDARD_TIMEFRAMES,
    precision,
    minTick,
    lotSize: 1
  };
});

// ── Legacy Alias Table ─────────────────────────────────────────────────────
export const LEGACY_ALIASES = {
  // Forex
  'EURUSD': 'OANDA:EURUSD',
  'GBPUSD': 'OANDA:GBPUSD',
  'USDJPY': 'OANDA:USDJPY',
  'AUDUSD': 'OANDA:AUDUSD',
  'USDCAD': 'OANDA:USDCAD',
  'USDCHF': 'OANDA:USDCHF',
  'NZDUSD': 'OANDA:NZDUSD',
  'EURGBP': 'OANDA:EURGBP',
  'EURJPY': 'OANDA:EURJPY',
  'GBPJPY': 'OANDA:GBPJPY',
  'EURCHF': 'OANDA:EURCHF',
  'AUDJPY': 'OANDA:AUDJPY',
  // Metals & Energy
  'XAUUSD': 'OANDA:XAUUSD',
  'XAGUSD': 'OANDA:XAGUSD',
  'USOIL': 'TVC:USOIL',
  'UKOIL': 'TVC:UKOIL',
  'NATGAS': 'TVC:NATGAS',
  // Indices & Macro
  'SPX': 'SP:SPX',
  'NDX': 'NASDAQ:NDX',
  'DJI': 'DJ:DJI',
  'VIX': 'TVC:VIX',
  'DAX': 'TVC:DAX',
  'DXY': 'TVC:DXY',
  'US10Y': 'TVC:US10Y',
  // Equities & ETFs
  'AAPL': 'NASDAQ:AAPL',
  'NVDA': 'NASDAQ:NVDA',
  'TSLA': 'NASDAQ:TSLA',
  'MSFT': 'NASDAQ:MSFT',
  'AMZN': 'NASDAQ:AMZN',
  'GOOGL': 'NASDAQ:GOOGL',
  'META': 'NASDAQ:META',
  'SPY': 'AMEX:SPY',
  'QQQ': 'NASDAQ:QQQ',
  // Tehran / Iran
  'GOLD_18K': 'IR:GOLD_18K',
  'GOLD_24K': 'IR:GOLD_24K',
  'GERAM24': 'IR:GOLD_24K',
  'COIN_EMAMI': 'IR:COIN_EMAMI',
  'COIN_BAHAR': 'IR:COIN_BAHAR',
  'COIN_NIM': 'IR:COIN_NIM',
  'COIN_ROB': 'IR:COIN_ROB',
  'COIN_GERMI': 'IR:COIN_GERMI',
  'USD_TEHRAN': 'IR:USD_FREE',
  'USD_FREE': 'IR:USD_FREE',
  'USDT_FREE': 'IR:USDT_FREE',
  'USDT_IRR': 'IR:USDT_FREE',
  'GOLD_ABSHODEH': 'IR:GOLD_MESGHAL',
  'IR:GOLD_ABSHODEH': 'IR:GOLD_MESGHAL',
  'GOLD_MESGHAL': 'IR:GOLD_MESGHAL',
  'MESGHAL': 'IR:GOLD_MESGHAL',
  'ABSHODEH': 'IR:GOLD_MESGHAL'
};

// Aliases mapped from bare crypto pair -> BINANCE:<PAIR>
const binancePairSet = new Set();

// Active catalog store and lookup map
export const SYMBOL_CATALOG = [];
const catalogMap = new Map();

function rebuildCatalog(cryptoEntries) {
  catalogMap.clear();
  binancePairSet.clear();
  SYMBOL_CATALOG.length = 0;

  // 1. Add curated TradingView entries
  for (const item of CURATED_TV_DEFAULTS) {
    SYMBOL_CATALOG.push(item);
    catalogMap.set(item.symbol, item);
  }

  // 2. Add TGJU entries
  for (const item of TGJU_ENTRIES) {
    SYMBOL_CATALOG.push(item);
    catalogMap.set(item.symbol, item);
  }

  // 3. Add crypto entries
  for (const item of cryptoEntries) {
    if (!catalogMap.has(item.symbol)) {
      SYMBOL_CATALOG.push(item);
      catalogMap.set(item.symbol, item);
      const bare = item.symbol.replace(/^BINANCE:/, '');
      binancePairSet.add(bare);
    }
  }

  // 4. Add TSE entries only when enabled
  if (tseSource.isTseEnabled()) {
    for (const item of tseSource.symbolsCache) {
      if (!catalogMap.has(item.symbol)) {
        SYMBOL_CATALOG.push(item);
        catalogMap.set(item.symbol, item);
      }
    }
  }
}

// Initial bootstrap with seed crypto
rebuildCatalog(SEED_CRYPTO_PAIRS);

export function resolveSymbolAlias(raw) {
  if (!raw) return raw;
  const s = String(raw).trim().toUpperCase();
  if (LEGACY_ALIASES[s]) return LEGACY_ALIASES[s];
  if (s.includes(':')) return s;

  if (binancePairSet.has(s) || catalogMap.has(`BINANCE:${s}`)) {
    return `BINANCE:${s}`;
  }

  // Common crypto quote suffixes
  if (/^(?:[A-Z0-9]{2,12})(USDT|USDC|BTC|ETH|BNB|EUR|FDUSD|TRY)$/.test(s)) {
    return `BINANCE:${s}`;
  }

  return s;
}

export function getSymbolMeta(symbol) {
  if (!symbol) return null;
  const raw = String(symbol).trim().toUpperCase();
  const canonical = resolveSymbolAlias(raw);
  if (catalogMap.has(canonical)) return catalogMap.get(canonical);
  if (catalogMap.has(raw)) return catalogMap.get(raw);

  const bare = raw.replace(/^.*:/, '');
  if (catalogMap.has(bare)) return catalogMap.get(bare);

  const tgjuEntry = TGJU_ENTRIES.find(e => e.symbol === canonical || e.symbol === raw);
  if (tgjuEntry) return tgjuEntry;

  // TradingView symbol on-demand: exchange:ticker (e.g. OANDA:EURUSD, NASDAQ:AAPL)
  if (canonical.includes(':') && !canonical.startsWith('BINANCE:') && !canonical.startsWith('IR:') && !canonical.startsWith('TSE:')) {
    const parts = canonical.split(':');
    const exch = parts[0];
    const ticker = parts[1];
    return {
      symbol: canonical,
      name: ticker,
      nameFa: ticker,
      category: 'stocks',
      exchange: exch,
      type: 'stock',
      currency: 'USD',
      source: 'tradingview',
      dataStatus: 'delayed',
      delaySec: 600,
      timeframes: STANDARD_TIMEFRAMES,
      precision: 2,
      minTick: 0.01,
      lotSize: 1
    };
  }

  return null;
}

export function isKnownSymbol(sym) {
  if (!sym) return false;
  const raw = String(sym).trim().toUpperCase();
  const canonical = resolveSymbolAlias(raw);
  if (catalogMap.has(canonical) || catalogMap.has(raw)) return true;
  if (LEGACY_ALIASES[raw]) return true;

  if (canonical.startsWith('TSE:') || raw.startsWith('TSE:')) {
    return tseSource.isTseEnabled() && (catalogMap.has(canonical) || catalogMap.has(raw));
  }

  if (canonical.startsWith('IR:') || raw.startsWith('IR:')) {
    return catalogMap.has(canonical) || catalogMap.has(raw) || !!TGJU_SLUG_MAP[canonical];
  }

  if (canonical.includes(':') && !canonical.startsWith('BINANCE:')) {
    return true;
  }
  return false;
}

// ── Binance Spot Universe Loader (FR-005, 24 h refresh) ────────────────────
export async function loadBinanceUniverse() {
  for (const base of BINANCE_BASES) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`${base}/exchangeInfo`, {
        signal: ctl.signal,
        headers: { accept: 'application/json' }
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !Array.isArray(data.symbols) || data.symbols.length === 0) continue;

      const tradingPairs = data.symbols.filter(s => s.status === 'TRADING' && s.isSpotTradingAllowed !== false);
      if (tradingPairs.length < 500) continue;

      const cryptoEntries = tradingPairs.map(s => {
        let minTick = 0.01;
        let precision = 2;
        let lotSize = 1;

        if (Array.isArray(s.filters)) {
          const priceFilter = s.filters.find(f => f.filterType === 'PRICE_FILTER');
          if (priceFilter && priceFilter.tickSize) {
            const rawTick = parseFloat(priceFilter.tickSize);
            if (rawTick > 0) minTick = rawTick;
            const cleanTick = String(priceFilter.tickSize).replace(/0+$/, '');
            const dot = cleanTick.indexOf('.');
            precision = dot >= 0 ? Math.max(0, cleanTick.length - dot - 1) : 0;
          }
          const lotFilter = s.filters.find(f => f.filterType === 'LOT_SIZE');
          if (lotFilter && lotFilter.stepSize) {
            const rawStep = parseFloat(lotFilter.stepSize);
            if (rawStep > 0) lotSize = rawStep;
          }
        }

        const baseAsset = s.baseAsset;
        const quoteAsset = s.quoteAsset;
        const nameFa = CRYPTO_FA_NAMES[baseAsset]
          ? `${CRYPTO_FA_NAMES[baseAsset]} / ${quoteAsset}`
          : `${baseAsset} / ${quoteAsset}`;

        return {
          symbol: `BINANCE:${s.symbol}`,
          name: `${baseAsset}/${quoteAsset}`,
          nameFa,
          exchange: 'Binance',
          type: 'crypto',
          category: 'crypto',
          currency: quoteAsset,
          base: baseAsset,
          quote: quoteAsset,
          source: 'binance',
          dataStatus: 'live',
          delaySec: 0,
          timeframes: STANDARD_TIMEFRAMES,
          precision,
          minTick,
          lotSize
        };
      });

      rebuildCatalog(cryptoEntries);
      return SYMBOL_CATALOG;
    } catch (e) {
      // Try next mirror
    }
  }

  return SYMBOL_CATALOG;
}

// 24 h auto-refresh
const refreshTimer = setInterval(() => {
  loadBinanceUniverse().catch(() => {});
}, 24 * 60 * 60 * 1000);
if (refreshTimer && refreshTimer.unref) refreshTimer.unref();

export const initPromise = loadBinanceUniverse();

// ── TradingView Symbol Search Proxy & Merge (/api/symbols?q=) ──────────────
const tvSearchCache = new CostLruCache(500);
const TV_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function mapTvType(rawType) {
  const t = String(rawType || '').toLowerCase();
  if (t === 'forex') return 'forex';
  if (t === 'crypto' || t === 'spot' || t === 'swap') return 'crypto';
  if (t === 'index') return 'index';
  if (t === 'stock' || t === 'dr') return 'stock';
  if (t === 'fund') return 'fund';
  if (t === 'bond') return 'bond';
  if (t === 'commodity' || t === 'futures') return 'commodity';
  return t || 'stock';
}

function mapTvCategory(rawType, sym) {
  const t = String(rawType || '').toLowerCase();
  const s = String(sym || '').toUpperCase();
  if (t === 'forex') return 'forex';
  if (t === 'crypto' || t === 'spot' || t === 'swap') return 'crypto';
  if (t === 'index') return 'indices';
  if (t === 'fund') return 'etf';
  if (t === 'bond') return 'bonds';
  if (t === 'commodity' || t === 'futures') {
    if (s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER') || s.includes('PLATINUM') || s.includes('COPPER')) {
      return 'metals';
    }
    if (s.includes('OIL') || s.includes('GAS') || s.includes('BRENT')) {
      return 'energy';
    }
    return 'commodities';
  }
  return 'stocks';
}

export async function searchSymbols(query = '', category = 'all', exchange = 'all', limit = 200) {
  const q = String(query || '').trim();
  const cat = String(category || 'all').toLowerCase();
  const ex = String(exchange || 'all').toLowerCase();
  const maxLimit = Math.max(1, Math.min(2500, Number(limit) || 200));

  const matchesCat = (itemCat) => {
    const ic = String(itemCat || '').toLowerCase();
    if (ic === 'iran_tse' && !tseSource.isTseEnabled()) return false;
    if (cat === 'all') return true;
    if (cat === 'crypto') return ic === 'crypto';
    if (cat === 'metals') return ic === 'metals';
    if (cat === 'energy' || cat === 'commodities') return ic === 'energy' || ic === 'commodities';
    if (cat === 'forex') return ic === 'forex';
    if (cat === 'indices') return ic === 'indices';
    if (cat === 'stocks') return ic === 'stocks';
    if (cat === 'etf' || cat === 'fund') return ic === 'etf' || ic === 'fund';
    if (cat === 'bonds' || cat === 'bond') return ic === 'bonds' || ic === 'bond';
    if (cat === 'iran_gold') return ic === 'iran_gold';
    if (cat === 'iran_fx') return ic === 'iran_fx';
    if (cat === 'iran_tse') return ic === 'iran_tse' && tseSource.isTseEnabled();
    return ic === cat;
  };

  const matchesEx = (itemEx) => {
    const ie = String(itemEx || '').toLowerCase();
    if (ie === 'tse' && !tseSource.isTseEnabled()) return false;
    if (ex === 'all') return true;
    return ie.includes(ex);
  };

  if (!q) {
    const local = SYMBOL_CATALOG.filter(item => matchesCat(item.category) && matchesEx(item.exchange));
    return local.slice(0, maxLimit);
  }

  const qLower = q.toLowerCase();
  const localMatches = SYMBOL_CATALOG.filter(item => {
    if (!matchesCat(item.category) || !matchesEx(item.exchange)) return false;
    const symMatch = item.symbol.toLowerCase().includes(qLower);
    const nameMatch = item.name && item.name.toLowerCase().includes(qLower);
    const nameFaMatch = item.nameFa && item.nameFa.toLowerCase().includes(qLower);
    const baseMatch = item.base && item.base.toLowerCase().includes(qLower);
    return symMatch || nameMatch || nameFaMatch || baseMatch;
  });

  // Proxy TradingView symbol search (cached 10 min)
  let tvMatches = [];
  const cached = tvSearchCache.get(qLower);
  if (cached) {
    tvMatches = cached;
  } else {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const url = `${TV_SEARCH_URL}?text=${encodeURIComponent(q)}&hl=1`;
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: {
          Origin: 'https://www.tradingview.com',
          'User-Agent': TV_USER_AGENT
        }
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.symbols)) {
          tvMatches = json.symbols.map(s => {
            const cleanSym = String(s.symbol || '').replace(/<[^>]+>/g, '').trim();
            const exch = String(s.exchange || 'GLOBAL').trim();
            const canonicalSym = `${exch}:${cleanSym}`;
            const mappedType = mapTvType(s.type);
            const mappedCat = mapTvCategory(s.type, cleanSym);
            const isEod = Array.isArray(s.params) && s.params.includes('eod');
            const delaySec = s.delay ? Number(s.delay) : 0;
            const dataStatus = isEod ? 'eod' : (delaySec > 0 ? 'delayed' : 'live');
            return {
              symbol: canonicalSym,
              name: s.description || cleanSym,
              nameFa: s.description || cleanSym,
              exchange: exch,
              type: mappedType,
              category: mappedCat,
              currency: s.currency_code || 'USD',
              source: 'tradingview',
              dataStatus,
              delaySec,
              timeframes: STANDARD_TIMEFRAMES,
              precision: 2,
              minTick: 0.01,
              lotSize: 1
            };
          }).filter(e => e.symbol && e.name);
          tvSearchCache.set(qLower, tvMatches, 1, TV_CACHE_TTL);
        }
      }
    } catch (e) {
      // Upstream TradingView error: fall back to local
    }
  }

  // Merge local matches and TV matches, deduplicate by canonical symbol
  const merged = [];
  const seenSymbols = new Set();

  for (const item of localMatches) {
    if (!seenSymbols.has(item.symbol)) {
      seenSymbols.add(item.symbol);
      merged.push(item);
    }
  }

  for (const item of tvMatches) {
    if (!seenSymbols.has(item.symbol) && matchesCat(item.category) && matchesEx(item.exchange)) {
      seenSymbols.add(item.symbol);
      merged.push(item);
    }
  }

  return merged.slice(0, 50);
}
