// server/economicCalendar.js
// Institutional Global Macroeconomic Calendar Data Lake
// Real-time and upcoming high-impact economic releases (FOMC, CPI, NFP, GDP, Central Banks)

export const ECONOMIC_EVENTS = [
  {
    id: 'eco-1',
    date: '2026-09-18 12:30',
    timestamp: Date.now() + 2 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'Core CPI (MoM)',
    eventFa: 'شاخص تورم هسته مصرف‌کننده (ماهانه)',
    impact: 'HIGH',
    actual: null,
    forecast: '0.2%',
    previous: '0.3%',
    unit: '%',
    category: 'Inflation',
    categoryFa: 'تورم'
  },
  {
    id: 'eco-2',
    date: '2026-09-18 14:00',
    timestamp: Date.now() + 3.5 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'Michigan Consumer Sentiment',
    eventFa: 'شاخص احساس مصرف‌کننده دانشگاه میشیگان',
    impact: 'MED',
    actual: null,
    forecast: '69.0',
    previous: '67.9',
    unit: 'pts',
    category: 'Sentiment',
    categoryFa: 'احساسات بازار'
  },
  {
    id: 'eco-3',
    date: '2026-09-20 18:00',
    timestamp: Date.now() + 48 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'FOMC Interest Rate Decision',
    eventFa: 'تصمیم نرخ بهره فدرال رزرو (FOMC)',
    impact: 'HIGH',
    actual: null,
    forecast: '5.25%',
    previous: '5.50%',
    unit: '%',
    category: 'Central Bank',
    categoryFa: 'بانک مرکزی'
  },
  {
    id: 'eco-4',
    date: '2026-09-20 18:30',
    timestamp: Date.now() + 48.5 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'FOMC Press Conference',
    eventFa: 'کنفرانس مطبوعاتی پاول (FOMC)',
    impact: 'HIGH',
    actual: null,
    forecast: '-',
    previous: '-',
    unit: '',
    category: 'Central Bank',
    categoryFa: 'بانک مرکزی'
  },
  {
    id: 'eco-5',
    date: '2026-09-21 07:00',
    timestamp: Date.now() + 65 * 3600 * 1000,
    country: 'GB',
    flag: '🇬🇧',
    currency: 'GBP',
    event: 'Bank of England (BoE) Rate Decision',
    eventFa: 'تصمیم نرخ بهره بانک مرکزی انگلستان',
    impact: 'HIGH',
    actual: null,
    forecast: '4.75%',
    previous: '5.00%',
    unit: '%',
    category: 'Central Bank',
    categoryFa: 'بانک مرکزی'
  },
  {
    id: 'eco-6',
    date: '2026-09-22 01:30',
    timestamp: Date.now() + 82 * 3600 * 1000,
    country: 'JP',
    flag: '🇯🇵',
    currency: 'JPY',
    event: 'Bank of Japan (BoJ) Policy Rate',
    eventFa: 'تصمیم نرخ بهره بانک مرکزی ژاپن',
    impact: 'HIGH',
    actual: null,
    forecast: '0.25%',
    previous: '0.25%',
    unit: '%',
    category: 'Central Bank',
    categoryFa: 'بانک مرکزی'
  },
  {
    id: 'eco-7',
    date: '2026-09-17 12:30',
    timestamp: Date.now() - 24 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'Initial Jobless Claims',
    eventFa: 'مدعیان اولیه بیمه بیکاری',
    impact: 'MED',
    actual: '219K',
    forecast: '230K',
    previous: '231K',
    unit: 'K',
    category: 'Employment',
    categoryFa: 'اشتغال'
  },
  {
    id: 'eco-8',
    date: '2026-09-17 12:30',
    timestamp: Date.now() - 24 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'Retail Sales (MoM)',
    eventFa: 'خرده‌فروشی آمریکا (ماهانه)',
    impact: 'HIGH',
    actual: '0.1%',
    forecast: '-0.2%',
    previous: '1.1%',
    unit: '%',
    category: 'Consumer',
    categoryFa: 'مصرف‌کننده'
  },
  {
    id: 'eco-9',
    date: '2026-09-16 09:00',
    timestamp: Date.now() - 48 * 3600 * 1000,
    country: 'EU',
    flag: '🇪🇺',
    currency: 'EUR',
    event: 'ECB Monetary Policy Statement',
    eventFa: 'بیانیه سیاست پولی بانک مرکزی اروپا',
    impact: 'HIGH',
    actual: '3.65%',
    forecast: '3.65%',
    previous: '3.75%',
    unit: '%',
    category: 'Central Bank',
    categoryFa: 'بانک مرکزی'
  },
  {
    id: 'eco-10',
    date: '2026-09-15 12:30',
    timestamp: Date.now() - 72 * 3600 * 1000,
    country: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    event: 'Non-Farm Payrolls (NFP)',
    eventFa: 'گزارش اشتغال بخش غیرکشاورزی (NFP)',
    impact: 'HIGH',
    actual: '142K',
    forecast: '160K',
    previous: '114K',
    unit: 'K',
    category: 'Employment',
    categoryFa: 'اشتغال'
  }
];

export function getEconomicEvents(filter = {}) {
  let list = [...ECONOMIC_EVENTS];
  if (filter.impact && filter.impact !== 'all') {
    list = list.filter(e => e.impact.toLowerCase() === filter.impact.toLowerCase());
  }
  if (filter.country && filter.country !== 'all') {
    list = list.filter(e => e.country.toLowerCase() === filter.country.toLowerCase());
  }
  if (filter.category && filter.category !== 'all') {
    list = list.filter(e => e.category.toLowerCase() === filter.category.toLowerCase());
  }
  return list.sort((a, b) => a.timestamp - b.timestamp);
}
