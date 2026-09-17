// server/symbolCatalog.js
// Universal symbol registry across Crypto, Forex, Metals, Commodities, and Indices

export const SYMBOL_CATALOG = [
  // Crypto Spot & Perpetuals
  { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'crypto', base: 'BTC', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.0001, exchange: 'Binance' },
  { symbol: 'ETHUSDT', name: 'Ethereum', category: 'crypto', base: 'ETH', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.001, exchange: 'Binance' },
  { symbol: 'SOLUSDT', name: 'Solana', category: 'crypto', base: 'SOL', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance' },
  { symbol: 'BNBUSDT', name: 'BNB', category: 'crypto', base: 'BNB', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance' },
  { symbol: 'XRPUSDT', name: 'Ripple', category: 'crypto', base: 'XRP', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', category: 'crypto', base: 'DOGE', quote: 'USDT', precision: 5, minTick: 0.00001, lotSize: 1, exchange: 'Binance' },
  { symbol: 'ADAUSDT', name: 'Cardano', category: 'crypto', base: 'ADA', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', category: 'crypto', base: 'AVAX', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance' },
  { symbol: 'LINKUSDT', name: 'Chainlink', category: 'crypto', base: 'LINK', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance' },
  { symbol: 'SUIUSDT', name: 'Sui Network', category: 'crypto', base: 'SUI', quote: 'USDT', precision: 4, minTick: 0.0001, lotSize: 1, exchange: 'Binance' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', category: 'crypto', base: 'NEAR', quote: 'USDT', precision: 3, minTick: 0.001, lotSize: 0.1, exchange: 'Binance' },
  { symbol: 'APTUSDT', name: 'Aptos', category: 'crypto', base: 'APT', quote: 'USDT', precision: 2, minTick: 0.01, lotSize: 0.01, exchange: 'Binance' },
  { symbol: 'PEPEUSDT', name: 'Pepe', category: 'crypto', base: 'PEPE', quote: 'USDT', precision: 8, minTick: 0.00000001, lotSize: 1000, exchange: 'Binance' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', category: 'crypto', base: 'SHIB', quote: 'USDT', precision: 8, minTick: 0.00000001, lotSize: 1000, exchange: 'Binance' },
  { symbol: 'TAOUSDT', name: 'Bittensor', category: 'crypto', base: 'TAO', quote: 'USDT', precision: 1, minTick: 0.1, lotSize: 0.001, exchange: 'Binance' },
  { symbol: 'RENDERUSDT', name: 'Render', category: 'crypto', base: 'RENDER', quote: 'USDT', precision: 3, minTick: 0.001, lotSize: 0.1, exchange: 'Binance' },

  // Metals & Commodities
  { symbol: 'XAUUSD', name: 'Gold / US Dollar Spot', category: 'metals', base: 'XAU', quote: 'USD', precision: 2, minTick: 0.05, lotSize: 1, exchange: 'OANDA' },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar Spot', category: 'metals', base: 'XAG', quote: 'USD', precision: 3, minTick: 0.005, lotSize: 50, exchange: 'OANDA' },
  { symbol: 'USOIL', name: 'WTI Crude Oil', category: 'commodities', base: 'WTI', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 10, exchange: 'NYMEX' },
  { symbol: 'UKOIL', name: 'Brent Crude Oil', category: 'commodities', base: 'BRENT', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 10, exchange: 'ICE' },
  { symbol: 'NATGAS', name: 'Natural Gas', category: 'commodities', base: 'NG', quote: 'USD', precision: 3, minTick: 0.001, lotSize: 100, exchange: 'NYMEX' },

  // Forex Majors
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'forex', base: 'EUR', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'forex', base: 'GBP', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'forex', base: 'USD', quote: 'JPY', precision: 3, minTick: 0.001, lotSize: 10000, exchange: 'FX_IDC' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'forex', base: 'AUD', quote: 'USD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', category: 'forex', base: 'USD', quote: 'CAD', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'forex', base: 'USD', quote: 'CHF', precision: 5, minTick: 0.00001, lotSize: 10000, exchange: 'FX_IDC' },

  // Global Indices & Equities
  { symbol: 'SPX', name: 'S&P 500 Index', category: 'indices', base: 'SPX', quote: 'USD', precision: 2, minTick: 0.1, lotSize: 1, exchange: 'CBOE' },
  { symbol: 'NDX', name: 'Nasdaq 100 Index', category: 'indices', base: 'NDX', quote: 'USD', precision: 2, minTick: 0.25, lotSize: 1, exchange: 'NASDAQ' },
  { symbol: 'DJI', name: 'Dow Jones Industrial Average', category: 'indices', base: 'DJI', quote: 'USD', precision: 2, minTick: 1.0, lotSize: 1, exchange: 'DJ' },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', base: 'AAPL', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'stocks', base: 'NVDA', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stocks', base: 'TSLA', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'stocks', base: 'MSFT', quote: 'USD', precision: 2, minTick: 0.01, lotSize: 1, exchange: 'NASDAQ' }
];

export function searchSymbols(query = '', category = 'all') {
  const q = query.trim().toUpperCase();
  return SYMBOL_CATALOG.filter(item => {
    const matchCat = category === 'all' || item.category === category;
    if (!matchCat) return false;
    if (!q) return true;
    return item.symbol.includes(q) || item.name.toUpperCase().includes(q) || item.base.includes(q);
  });
}

export function getSymbolMeta(symbol) {
  const clean = symbol.replace(/^.*:/, '').toUpperCase();
  const found = SYMBOL_CATALOG.find(s => s.symbol === clean);
  if (found) return found;
  return {
    symbol: clean,
    name: clean,
    category: clean.endsWith('USDT') ? 'crypto' : 'stock',
    base: clean.replace(/(USDT|USD|EUR|BTC)$/, ''),
    quote: clean.endsWith('USDT') ? 'USDT' : 'USD',
    precision: 2,
    minTick: 0.01,
    lotSize: 1,
    exchange: 'Global'
  };
}
