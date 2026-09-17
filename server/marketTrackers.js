// server/marketTrackers.js
// Alternative data feeds inspired by LuxAlgo Market-Trackers (SEC EDGAR & US Gov disclosures)

export const CONGRESSIONAL_TRADES = [
  {
    id: 'ct-101',
    member: 'Nancy Pelosi (D-CA)',
    chamber: 'House',
    asset: 'NVDA',
    assetDescription: 'NVIDIA Corporation - Common Stock',
    txType: 'Purchase',
    txDate: '2026-08-14',
    disclosureDate: '2026-09-02',
    amount: '$1,000,001 - $5,000,000',
    priceEstimate: 124.50,
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20023411.pdf'
  },
  {
    id: 'ct-102',
    member: 'Tommy Tuberville (R-AL)',
    chamber: 'Senate',
    asset: 'AAPL',
    assetDescription: 'Apple Inc. - Common Stock',
    txType: 'Sale',
    txDate: '2026-08-20',
    disclosureDate: '2026-09-05',
    amount: '$250,001 - $500,000',
    priceEstimate: 226.30,
    sourceUrl: 'https://efdsearch.senate.gov/search/view/ptr/89b12a34-2026/'
  },
  {
    id: 'ct-103',
    member: 'Dan Goldman (D-NY)',
    chamber: 'House',
    asset: 'MSFT',
    assetDescription: 'Microsoft Corporation - Common Stock',
    txType: 'Purchase',
    txDate: '2026-08-28',
    disclosureDate: '2026-09-10',
    amount: '$500,001 - $1,000,000',
    priceEstimate: 428.10,
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20023489.pdf'
  },
  {
    id: 'ct-104',
    member: 'Markwayne Mullin (R-OK)',
    chamber: 'Senate',
    asset: 'USOIL',
    assetDescription: 'ConocoPhillips / Energy Sector',
    txType: 'Purchase',
    txDate: '2026-09-01',
    disclosureDate: '2026-09-12',
    amount: '$100,001 - $250,000',
    priceEstimate: 72.40,
    sourceUrl: 'https://efdsearch.senate.gov/search/view/ptr/77f98c12-2026/'
  },
  {
    id: 'ct-105',
    member: 'Josh Gottheimer (D-NJ)',
    chamber: 'House',
    asset: 'TSLA',
    assetDescription: 'Tesla, Inc. - Common Stock',
    txType: 'Purchase',
    txDate: '2026-09-04',
    disclosureDate: '2026-09-14',
    amount: '$250,001 - $500,000',
    priceEstimate: 238.90,
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20023562.pdf'
  }
];

export const INSIDER_TRADES = [
  {
    id: 'in-201',
    company: 'NVIDIA Corporation (NVDA)',
    insider: 'Huang Jen Hsun (CEO)',
    relationship: 'Officer / Director',
    form: 'Form 4',
    filingDate: '2026-09-08',
    txType: 'Sale (Rule 10b5-1)',
    shares: 120000,
    price: 128.40,
    value: 15408000,
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000045/wf-form4_1725829102.xml'
  },
  {
    id: 'in-202',
    company: 'Tesla Inc. (TSLA)',
    insider: 'Taneja Vaibhav (CFO)',
    relationship: 'Chief Financial Officer',
    form: 'Form 4',
    filingDate: '2026-09-11',
    txType: 'Purchase',
    shares: 4500,
    price: 242.15,
    value: 1089675,
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1318605/000131860526000032/wf-form4_1726081234.xml'
  },
  {
    id: 'in-203',
    company: 'Apple Inc. (AAPL)',
    insider: 'Cook Timothy D (CEO)',
    relationship: 'Chief Executive Officer',
    form: 'Form 4',
    filingDate: '2026-08-30',
    txType: 'Gift / Disposition',
    shares: 50000,
    price: 228.50,
    value: 11425000,
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000088/wf-form4_1725049102.xml'
  }
];

export const HEDGE_FUND_13F = [
  {
    fund: 'Berkshire Hathaway Inc.',
    manager: 'Warren Buffett',
    period: 'Q2 2026',
    topHoldings: [
      { ticker: 'AAPL', name: 'Apple Inc.', pctPortfolio: 32.5, shares: 385000000, valueB: 87.9 },
      { ticker: 'BAC', name: 'Bank of America', pctPortfolio: 10.8, shares: 780000000, valueB: 31.2 },
      { ticker: 'AXP', name: 'American Express', pctPortfolio: 12.4, shares: 151000000, valueB: 35.1 },
      { ticker: 'KO', name: 'Coca-Cola Co.', pctPortfolio: 8.9, shares: 400000000, valueB: 27.6 },
      { ticker: 'CVX', name: 'Chevron Corp.', pctPortfolio: 6.2, shares: 118000000, valueB: 18.2 }
    ]
  },
  {
    fund: 'Citadel Advisors LLC',
    manager: 'Ken Griffin',
    period: 'Q2 2026',
    topHoldings: [
      { ticker: 'NVDA', name: 'NVIDIA Corporation', pctPortfolio: 5.8, shares: 28400000, valueB: 3.65 },
      { ticker: 'MSFT', name: 'Microsoft Corporation', pctPortfolio: 4.9, shares: 7200000, valueB: 3.08 },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', pctPortfolio: 4.2, shares: 4800000, valueB: 2.64 },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', pctPortfolio: 3.7, shares: 12500000, valueB: 2.32 }
    ]
  }
];

export const FINRA_SHORT_VOLUME = [
  { symbol: 'NVDA', date: '2026-09-15', shortVolume: 42180000, totalVolume: 89450000, shortRatioPct: 47.15 },
  { symbol: 'AAPL', date: '2026-09-15', shortVolume: 28450000, totalVolume: 61200000, shortRatioPct: 46.48 },
  { symbol: 'TSLA', date: '2026-09-15', shortVolume: 51200000, totalVolume: 92400000, shortRatioPct: 55.41 },
  { symbol: 'SPY', date: '2026-09-15', shortVolume: 34100000, totalVolume: 58900000, shortRatioPct: 57.89 },
  { symbol: 'AMD', date: '2026-09-15', shortVolume: 22100000, totalVolume: 45300000, shortRatioPct: 48.78 }
];
