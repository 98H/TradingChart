/**
 * @spec 008
 * @covers FR-001, FR-003, FR-005, FR-007, FR-009
 */
const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function request(endpoint, options = {}) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const res = await fetch(reqUrl, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[008 API Acceptance Suite] Running against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Market Trackers REST API (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Default GET /api/market-trackers (kind=all)
    const resAll = await request('/api/market-trackers');
    assert(resAll.status === 200, 'FR-001 default GET /api/market-trackers status', `Expected 200, got ${resAll.status}`);
    const body = resAll.body;
    assert(body && typeof body === 'object', 'FR-001 response body object', 'Response is not a valid JSON object');
    assert(Array.isArray(body.congressionalTrades) && body.congressionalTrades.length > 0,
      'FR-001 congressionalTrades array', 'Expected non-empty congressionalTrades array');
    assert(Array.isArray(body.insiderTrades) && body.insiderTrades.length > 0,
      'FR-001 insiderTrades array', 'Expected non-empty insiderTrades array');
    assert(Array.isArray(body.hedgeFund13F) && body.hedgeFund13F.length > 0,
      'FR-001 hedgeFund13F array', 'Expected non-empty hedgeFund13F array');
    assert(Array.isArray(body.finraShortVolume) && body.finraShortVolume.length > 0,
      'FR-001 finraShortVolume array', 'Expected non-empty finraShortVolume array');

    // Validate Congressional Trade schema & official sourceUrl
    const ct = body.congressionalTrades[0];
    assert(typeof ct.id === 'string' && ct.id.startsWith('ct-'), 'FR-001 congressional trade id', `Invalid id: ${ct.id}`);
    assert(typeof ct.member === 'string' && ct.member.length > 0, 'FR-001 congressional trade member', 'Missing member');
    assert(ct.chamber === 'House' || ct.chamber === 'Senate', 'FR-001 congressional trade chamber', `Invalid chamber: ${ct.chamber}`);
    assert(typeof ct.asset === 'string' && ct.asset.length > 0, 'FR-001 congressional trade asset', 'Missing asset');
    assert(typeof ct.assetDescription === 'string', 'FR-001 congressional trade assetDescription', 'Missing assetDescription');
    assert(ct.txType === 'Purchase' || ct.txType === 'Sale', 'FR-001 congressional trade txType', `Invalid txType: ${ct.txType}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(ct.txDate), 'FR-001 congressional trade txDate format', `Invalid txDate: ${ct.txDate}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(ct.disclosureDate), 'FR-001 congressional trade disclosureDate format', `Invalid disclosureDate: ${ct.disclosureDate}`);
    assert(typeof ct.amount === 'string' && ct.amount.length > 0, 'FR-001 congressional trade amount', 'Missing amount');
    assert(typeof ct.priceEstimate === 'number' && ct.priceEstimate > 0, 'FR-001 congressional trade priceEstimate', `Invalid priceEstimate: ${ct.priceEstimate}`);
    assert(typeof ct.sourceUrl === 'string' && (ct.sourceUrl.startsWith('https://disclosures-clerk.house.gov/') || ct.sourceUrl.startsWith('https://efdsearch.senate.gov/')),
      'FR-001 congressional trade official sourceUrl', `Invalid sourceUrl: ${ct.sourceUrl}`);

    // Validate SEC Form 4 Insider Trade schema & official sourceUrl
    const it = body.insiderTrades[0];
    assert(typeof it.id === 'string' && it.id.startsWith('in-'), 'FR-001 insider trade id', `Invalid id: ${it.id}`);
    assert(typeof it.company === 'string' && it.company.length > 0, 'FR-001 insider trade company', 'Missing company');
    assert(typeof it.insider === 'string' && it.insider.length > 0, 'FR-001 insider trade insider', 'Missing insider');
    assert(typeof it.relationship === 'string', 'FR-001 insider trade relationship', 'Missing relationship');
    assert(it.form === 'Form 4', 'FR-001 insider trade form', `Expected Form 4, got ${it.form}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(it.filingDate), 'FR-001 insider trade filingDate format', `Invalid filingDate: ${it.filingDate}`);
    assert(typeof it.txType === 'string' && it.txType.length > 0, 'FR-001 insider trade txType', 'Missing txType');
    assert(typeof it.shares === 'number' && it.shares > 0, 'FR-001 insider trade shares', `Invalid shares: ${it.shares}`);
    assert(typeof it.price === 'number' && it.price > 0, 'FR-001 insider trade price', `Invalid price: ${it.price}`);
    assert(typeof it.value === 'number' && it.value > 0, 'FR-001 insider trade value', `Invalid value: ${it.value}`);
    assert(typeof it.sourceUrl === 'string' && it.sourceUrl.startsWith('https://www.sec.gov/Archives/edgar/data/'),
      'FR-001 insider trade official sourceUrl', `Invalid SEC sourceUrl: ${it.sourceUrl}`);

    // Validate 13F Portfolio schema
    const hf = body.hedgeFund13F[0];
    assert(typeof hf.fund === 'string' && hf.fund.length > 0, 'FR-001 13F fund name', 'Missing fund');
    assert(typeof hf.manager === 'string', 'FR-001 13F fund manager', 'Missing manager');
    assert(typeof hf.period === 'string', 'FR-001 13F period', 'Missing period');
    assert(Array.isArray(hf.topHoldings) && hf.topHoldings.length > 0, 'FR-001 13F topHoldings array', 'Missing topHoldings');
    const holding = hf.topHoldings[0];
    assert(typeof holding.ticker === 'string' && holding.ticker.length > 0, 'FR-001 13F holding ticker', 'Missing ticker');
    assert(typeof holding.pctPortfolio === 'number' && holding.pctPortfolio > 0, 'FR-001 13F holding pctPortfolio', 'Missing pctPortfolio');

    // Validate FINRA Short Volume schema
    const sv = body.finraShortVolume[0];
    assert(typeof sv.symbol === 'string' && sv.symbol.length > 0, 'FR-001 FINRA short volume symbol', 'Missing symbol');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(sv.date), 'FR-001 FINRA short volume date', `Invalid date: ${sv.date}`);
    assert(typeof sv.shortVolume === 'number' && sv.shortVolume > 0, 'FR-001 shortVolume', 'Missing shortVolume');
    assert(typeof sv.totalVolume === 'number' && sv.totalVolume >= sv.shortVolume, 'FR-001 totalVolume >= shortVolume', 'Invalid totalVolume');
    assert(typeof sv.shortRatioPct === 'number' && sv.shortRatioPct >= 0 && sv.shortRatioPct <= 100, 'FR-001 shortRatioPct 0..100', 'Invalid shortRatioPct');

    // Category filtering by kind parameter
    const resCongress = await request('/api/market-trackers?kind=congress');
    assert(resCongress.body.congressionalTrades.length > 0, 'FR-001 kind=congress populates congressionalTrades', 'Expected trades');
    assert(resCongress.body.insiderTrades.length === 0, 'FR-001 kind=congress leaves insiderTrades empty', 'Expected empty');
    assert(resCongress.body.hedgeFund13F.length === 0, 'FR-001 kind=congress leaves hedgeFund13F empty', 'Expected empty');
    assert(resCongress.body.finraShortVolume.length === 0, 'FR-001 kind=congress leaves finraShortVolume empty', 'Expected empty');

    const resInsider = await request('/api/market-trackers?kind=insider');
    assert(resInsider.body.insiderTrades.length > 0, 'FR-001 kind=insider populates insiderTrades', 'Expected trades');
    assert(resInsider.body.congressionalTrades.length === 0, 'FR-001 kind=insider leaves congressionalTrades empty', 'Expected empty');

    const res13F = await request('/api/market-trackers?kind=13f');
    assert(res13F.body.hedgeFund13F.length > 0, 'FR-001 kind=13f populates hedgeFund13F', 'Expected 13f funds');

    const resShortVol = await request('/api/market-trackers?kind=short_vol');
    assert(resShortVol.body.finraShortVolume.length > 0, 'FR-001 kind=short_vol populates finraShortVolume', 'Expected short volume');

    // Unrecognized kind returns all empty arrays
    const resInvalidKind = await request('/api/market-trackers?kind=unknown_category');
    assert(resInvalidKind.status === 200, 'FR-001 unknown kind returns 200', `Expected 200, got ${resInvalidKind.status}`);
    assert(resInvalidKind.body.congressionalTrades.length === 0 &&
           resInvalidKind.body.insiderTrades.length === 0 &&
           resInvalidKind.body.hedgeFund13F.length === 0 &&
           resInvalidKind.body.finraShortVolume.length === 0,
           'FR-001 unknown kind returns empty arrays for all categories', 'Arrays must be empty');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Economic Calendar REST API (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resCal = await request('/api/economic-calendar');
    assert(resCal.status === 200, 'FR-003 GET /api/economic-calendar status', `Expected 200, got ${resCal.status}`);
    assert(typeof resCal.body.total === 'number' && resCal.body.total > 0, 'FR-003 calendar total count', 'Missing total');
    assert(Array.isArray(resCal.body.events) && resCal.body.events.length === resCal.body.total,
      'FR-003 calendar events array matches total', 'Mismatch between events length and total');

    // Validate event schema
    const ev = resCal.body.events[0];
    assert(typeof ev.id === 'string' && ev.id.startsWith('eco-'), 'FR-003 event id format', `Invalid id: ${ev.id}`);
    assert(typeof ev.date === 'string' && ev.date.length > 0, 'FR-003 event date', 'Missing date');
    assert(typeof ev.timestamp === 'number' && ev.timestamp > 0, 'FR-003 event timestamp', 'Missing timestamp');
    assert(typeof ev.country === 'string' && ev.country.length === 2, 'FR-003 event country 2-letter code', `Invalid country: ${ev.country}`);
    assert(typeof ev.flag === 'string' && ev.flag.length > 0, 'FR-003 event flag', 'Missing flag');
    assert(typeof ev.currency === 'string' && ev.currency.length === 3, 'FR-003 event currency code', `Invalid currency: ${ev.currency}`);
    assert(typeof ev.event === 'string' && ev.event.length > 0, 'FR-003 event title in English', 'Missing event');
    assert(typeof ev.eventFa === 'string' && ev.eventFa.length > 0, 'FR-003 event title in Persian', 'Missing eventFa');
    assert(['HIGH', 'MED', 'LOW'].includes(ev.impact), 'FR-003 event impact HIGH|MED|LOW', `Invalid impact: ${ev.impact}`);
    assert(ev.actual === null || typeof ev.actual === 'string', 'FR-003 event actual string or null', 'Invalid actual');
    assert(typeof ev.forecast === 'string', 'FR-003 event forecast', 'Missing forecast');
    assert(typeof ev.previous === 'string', 'FR-003 event previous', 'Missing previous');
    assert(typeof ev.unit === 'string', 'FR-003 event unit', 'Missing unit');
    assert(typeof ev.category === 'string' && ev.category.length > 0, 'FR-003 event category', 'Missing category');
    assert(typeof ev.categoryFa === 'string' && ev.categoryFa.length > 0, 'FR-003 event categoryFa', 'Missing categoryFa');

    // Verify chronological order by timestamp ascending
    for (let i = 1; i < resCal.body.events.length; i++) {
      assert(resCal.body.events[i].timestamp >= resCal.body.events[i - 1].timestamp,
        'FR-003 events sorted chronologically ascending', `Event index ${i} out of order`);
    }

    // Filter by impact=high
    const resHigh = await request('/api/economic-calendar?impact=high');
    assert(resHigh.status === 200, 'FR-003 filter impact=high status', 'Expected 200');
    assert(resHigh.body.events.every(e => e.impact === 'HIGH'),
      'FR-003 impact=high returns only HIGH events', 'Non-high impact event returned');

    // Filter by country=US
    const resUS = await request('/api/economic-calendar?country=US');
    assert(resUS.status === 200, 'FR-003 filter country=US status', 'Expected 200');
    assert(resUS.body.events.every(e => e.country === 'US'),
      'FR-003 country=US returns only US events', 'Non-US event returned');

    // Filter by category=inflation
    const resInflation = await request('/api/economic-calendar?category=inflation');
    assert(resInflation.status === 200, 'FR-003 filter category=inflation status', 'Expected 200');
    assert(resInflation.body.events.every(e => e.category.toLowerCase().includes('inflation')),
      'FR-003 category=inflation returns only inflation events', 'Non-inflation event returned');

    // Query parameters clamped to <= 32 chars without 500 error
    const longParam = 'a'.repeat(64);
    const resLong = await request(`/api/economic-calendar?impact=${longParam}&country=${longParam}&category=${longParam}`);
    assert(resLong.status === 200, 'FR-003 long query params safely clamped', `Expected 200, got ${resLong.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Breaking News Feed REST API (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resNews = await request('/api/news');
    assert(resNews.status === 200, 'FR-005 GET /api/news status', `Expected 200, got ${resNews.status}`);
    assert(typeof resNews.body.total === 'number' && resNews.body.total > 0, 'FR-005 news total', 'Missing total');
    assert(Array.isArray(resNews.body.news) && resNews.body.news.length > 0, 'FR-005 news items array', 'Missing news array');

    // Validate news item schema
    const item = resNews.body.news[0];
    assert(typeof item.id === 'string' && item.id.startsWith('news_'), 'FR-005 news id format', `Invalid id: ${item.id}`);
    assert(typeof item.symbol === 'string' && item.symbol.length > 0, 'FR-005 news symbol', 'Missing symbol');
    assert(['crypto', 'metals', 'forex', 'equities', 'commodities'].includes(item.category),
      'FR-005 news category', `Invalid category: ${item.category}`);
    assert(typeof item.titleEn === 'string' && item.titleEn.length > 0, 'FR-005 news titleEn', 'Missing titleEn');
    assert(typeof item.titleFa === 'string' && item.titleFa.length > 0, 'FR-005 news titleFa', 'Missing titleFa');
    assert(typeof item.source === 'string', 'FR-005 news source', 'Missing source');
    assert(typeof item.timeAgo === 'string', 'FR-005 news timeAgo', 'Missing timeAgo');
    assert(typeof item.timestamp === 'number' && item.timestamp > 0, 'FR-005 news timestamp', 'Missing timestamp');
    assert(['bullish', 'bearish', 'neutral'].includes(item.sentiment),
      'FR-005 news sentiment bullish|bearish|neutral', `Invalid sentiment: ${item.sentiment}`);
    assert(['high', 'medium'].includes(item.impact),
      'FR-005 news impact high|medium', `Invalid impact: ${item.impact}`);
    assert(typeof item.summaryEn === 'string' && item.summaryEn.length > 0, 'FR-005 news summaryEn', 'Missing summaryEn');
    assert(typeof item.summaryFa === 'string' && item.summaryFa.length > 0, 'FR-005 news summaryFa', 'Missing summaryFa');

    // Filter by category=crypto
    const resCrypto = await request('/api/news?category=crypto');
    assert(resCrypto.status === 200, 'FR-005 filter category=crypto status', 'Expected 200');
    assert(resCrypto.body.news.every(n => n.category === 'crypto'),
      'FR-005 category=crypto returns only crypto articles', 'Non-crypto article returned');

    // Filter by symbol=BTCUSDT
    const resBtc = await request('/api/news?symbol=BTCUSDT');
    assert(resBtc.status === 200, 'FR-005 filter symbol=BTCUSDT status', 'Expected 200');
    assert(resBtc.body.news.every(n => n.symbol === 'BTCUSDT'),
      'FR-005 symbol=BTCUSDT returns matching articles', 'Non-matching symbol returned');

    // Edge case: limit outside 1..100 clamped
    const resClampMin = await request('/api/news?limit=-5');
    assert(resClampMin.status === 200, 'FR-005 clamp negative limit status', 'Expected 200');
    assert(resClampMin.body.news.length === 1, 'FR-005 negative limit clamped to 1', `Expected 1, got ${resClampMin.body.news.length}`);

    const resClampZero = await request('/api/news?limit=0');
    assert(resClampZero.status === 200, 'FR-005 clamp zero limit status', 'Expected 200');
    assert(resClampZero.body.news.length === 1, 'FR-005 zero limit clamped to 1', `Expected 1, got ${resClampZero.body.news.length}`);

    const resLimit5 = await request('/api/news?limit=5');
    assert(resLimit5.status === 200, 'FR-005 limit=5 status', 'Expected 200');
    assert(resLimit5.body.news.length <= 5, 'FR-005 limit=5 returns <= 5 articles', `Expected <= 5, got ${resLimit5.body.news.length}`);

    const resClampMax = await request('/api/news?limit=500');
    assert(resClampMax.status === 200, 'FR-005 clamp 500 limit status', 'Expected 200');
    assert(resClampMax.body.news.length <= 100, 'FR-005 limit=500 clamped to 100', `Expected <= 100, got ${resClampMax.body.news.length}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Tehran Gold & Coin Bubble Snapshot REST API (FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const resGold = await request('/api/gold-snapshot');
    assert(resGold.status === 200, 'FR-007 GET /api/gold-snapshot status', `Expected 200, got ${resGold.status}`);
    const g = resGold.body;
    assert(g && typeof g === 'object', 'FR-007 gold body object', 'Missing body');
    assert(typeof g.timestamp === 'string' && g.timestamp.length > 0, 'FR-007 snapshot timestamp', 'Missing timestamp');
    assert(g.status === 'online', 'FR-007 snapshot status online', `Expected online, got ${g.status}`);

    // Pillar rates
    assert(typeof g.ounceUsd === 'number' && g.ounceUsd > 1000, 'FR-007 ounceUsd > 1000', `Invalid ounceUsd: ${g.ounceUsd}`);
    assert(typeof g.usdFree === 'number' && g.usdFree > 10000, 'FR-007 usdFree rate', `Invalid usdFree: ${g.usdFree}`);
    assert(typeof g.usdtNobitex === 'number' && g.usdtNobitex > 10000, 'FR-007 usdtNobitex rate', `Invalid usdtNobitex: ${g.usdtNobitex}`);
    assert(typeof g.dirhamRate === 'number' && g.dirhamRate > 1000, 'FR-007 dirhamRate', `Invalid dirhamRate: ${g.dirhamRate}`);

    // Abshodeh 17k quote
    assert(g.abshodeh?.symbol === 'GOLD_ABSHODEH', 'FR-007 abshodeh symbol', `Expected GOLD_ABSHODEH, got ${g.abshodeh?.symbol}`);
    assert(typeof g.abshodeh.price === 'number' && g.abshodeh.price > 0, 'FR-007 abshodeh price', 'Missing abshodeh price');
    assert(typeof g.abshodeh.change === 'number', 'FR-007 abshodeh change', 'Missing abshodeh change');
    assert(typeof g.abshodeh.changePercent === 'number', 'FR-007 abshodeh changePercent', 'Missing abshodeh changePercent');
    assert(g.abshodeh.unit === 'تومان / مثقال', 'FR-007 abshodeh unit', `Expected تومان / مثقال, got ${g.abshodeh.unit}`);

    // 18k Gram quote
    assert(g.gram18?.symbol === 'GOLD_18K', 'FR-007 gram18 symbol', `Expected GOLD_18K, got ${g.gram18?.symbol}`);
    assert(typeof g.gram18.price === 'number' && g.gram18.price > 0, 'FR-007 gram18 price', 'Missing gram18 price');
    assert(typeof g.gram18.change === 'number', 'FR-007 gram18 change', 'Missing gram18 change');
    assert(typeof g.gram18.changePercent === 'number', 'FR-007 gram18 changePercent', 'Missing gram18 changePercent');
    assert(g.gram18.unit === 'تومان / گرم', 'FR-007 gram18 unit', `Expected تومان / گرم, got ${g.gram18.unit}`);

    // Official Coin Bubbles
    const expectedCoins = ['emami', 'bahar', 'nim', 'rob', 'gerami'];
    assert(g.coins && typeof g.coins === 'object', 'FR-007 coins dictionary', 'Missing coins');
    for (const key of expectedCoins) {
      const coin = g.coins[key];
      assert(!!coin, `FR-007 coin ${key} present`, `Missing coin ${key}`);
      assert(coin.coinKey === key, `FR-007 coinKey match for ${key}`, `Expected ${key}, got ${coin.coinKey}`);
      assert(typeof coin.name === 'string' && coin.name.length > 0, `FR-007 coin name for ${key}`, 'Missing name');
      assert(typeof coin.nameEn === 'string' && coin.nameEn.length > 0, `FR-007 coin nameEn for ${key}`, 'Missing nameEn');
      assert(typeof coin.marketPrice === 'number' && coin.marketPrice > 0, `FR-007 coin marketPrice for ${key}`, 'Invalid marketPrice');
      assert(typeof coin.intrinsicValue === 'number' && coin.intrinsicValue > 0, `FR-007 coin intrinsicValue for ${key}`, 'Invalid intrinsicValue');
      assert(typeof coin.bubbleAmount === 'number', `FR-007 coin bubbleAmount for ${key}`, 'Missing bubbleAmount');
      assert(typeof coin.bubblePercent === 'number', `FR-007 coin bubblePercent for ${key}`, 'Missing bubblePercent');
      assert(typeof coin.weightGrams === 'number' && coin.weightGrams > 0, `FR-007 coin weightGrams for ${key}`, 'Missing weight');
      assert(typeof coin.purity === 'number' && coin.purity > 0, `FR-007 coin purity for ${key}`, 'Missing purity');

      // Mathematical consistency: bubbleAmount = marketPrice - intrinsicValue
      const diff = coin.marketPrice - coin.intrinsicValue;
      assert(coin.bubbleAmount === diff, `FR-007 bubbleAmount formula for ${key}`,
        `Expected ${diff}, got ${coin.bubbleAmount}`);
      const expectedPct = Math.round((diff / coin.marketPrice) * 1000) / 10;
      assert(Math.abs(coin.bubblePercent - expectedPct) <= 0.2, `FR-007 bubblePercent formula for ${key}`,
        `Expected ~${expectedPct}%, got ${coin.bubblePercent}%`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. TSE Tape & Microstructure REST API (FR-009)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Valid symbol query: FOOLAD
    const resFoolad = await request('/api/tse-tape?symbol=FOOLAD');
    assert(resFoolad.status === 200, 'FR-009 GET /api/tse-tape?symbol=FOOLAD status', `Expected 200, got ${resFoolad.status}`);
    const tape = resFoolad.body;
    assert(tape.symbol === 'FOOLAD', 'FR-009 tape symbol', `Expected FOOLAD, got ${tape.symbol}`);
    assert(typeof tape.nameFa === 'string' && tape.nameFa.length > 0, 'FR-009 tape nameFa', 'Missing nameFa');
    assert(typeof tape.timestamp === 'string', 'FR-009 tape timestamp', 'Missing timestamp');
    assert(typeof tape.lastPrice === 'number' && tape.lastPrice > 0, 'FR-009 tape lastPrice', 'Invalid lastPrice');
    assert(typeof tape.closePrice === 'number' && tape.closePrice > 0, 'FR-009 tape closePrice', 'Invalid closePrice');
    assert(typeof tape.yesterdayPrice === 'number' && tape.yesterdayPrice > 0, 'FR-009 tape yesterdayPrice', 'Invalid yesterdayPrice');
    assert(typeof tape.highPrice === 'number' && tape.highPrice >= tape.lowPrice, 'FR-009 tape highPrice >= lowPrice', 'Invalid high/low');
    assert(typeof tape.volume === 'number' && tape.volume > 0, 'FR-009 tape volume', 'Invalid volume');
    assert(typeof tape.value === 'number' && tape.value > 0, 'FR-009 tape value', 'Invalid value');
    assert(typeof tape.tradesCount === 'number' && tape.tradesCount > 0, 'FR-009 tape tradesCount', 'Invalid tradesCount');
    assert(typeof tape.change === 'number', 'FR-009 tape change', 'Missing change');
    assert(typeof tape.changePercent === 'number', 'FR-009 tape changePercent', 'Missing changePercent');
    assert(typeof tape.individualBuyVolume === 'number', 'FR-009 individualBuyVolume', 'Missing individualBuyVolume');
    assert(typeof tape.individualSellVolume === 'number', 'FR-009 individualSellVolume', 'Missing individualSellVolume');
    assert(typeof tape.individualBuyCount === 'number', 'FR-009 individualBuyCount', 'Missing individualBuyCount');
    assert(typeof tape.individualSellCount === 'number', 'FR-009 individualSellCount', 'Missing individualSellCount');
    assert(typeof tape.institutionalBuyVolume === 'number', 'FR-009 institutionalBuyVolume', 'Missing institutionalBuyVolume');
    assert(typeof tape.institutionalSellVolume === 'number', 'FR-009 institutionalSellVolume', 'Missing institutionalSellVolume');
    assert(typeof tape.buyPerCapitaToman === 'number' && tape.buyPerCapitaToman > 0, 'FR-009 buyPerCapitaToman', 'Missing buyPerCapitaToman');
    assert(typeof tape.sellPerCapitaToman === 'number' && tape.sellPerCapitaToman > 0, 'FR-009 sellPerCapitaToman', 'Missing sellPerCapitaToman');
    assert(typeof tape.buyerPowerRatio === 'number' && tape.buyerPowerRatio > 0, 'FR-009 buyerPowerRatio', 'Missing buyerPowerRatio');
    assert(typeof tape.smartMoneyInflow === 'boolean', 'FR-009 smartMoneyInflow boolean', 'Missing smartMoneyInflow');
    assert(typeof tape.suspiciousVolumeRatio === 'number' && tape.suspiciousVolumeRatio > 0, 'FR-009 suspiciousVolumeRatio', 'Missing suspiciousVolumeRatio');
    assert(typeof tape.queueStatus === 'string' && tape.queueStatus.length > 0, 'FR-009 queueStatus', 'Missing queueStatus');

    // Edge case: Unknown or invalid symbol rejected with 400 invalid_symbol
    const resBad1 = await request('/api/tse-tape?symbol=INVALID_SYMBOL!');
    assert(resBad1.status === 400, 'FR-009 invalid symbol returns 400', `Expected 400, got ${resBad1.status}`);
    assert(resBad1.body?.ok === false && resBad1.body?.error === 'invalid_symbol',
      'FR-009 invalid symbol error body', `Expected ok:false, error:invalid_symbol, got ${JSON.stringify(resBad1.body)}`);

    const resBad2 = await request('/api/tse-tape?symbol=UNKNOWN$TSE');
    assert(resBad2.status === 400, 'FR-009 invalid symbol with special character returns 400', `Expected 400, got ${resBad2.status}`);

    const resBad3 = await request(`/api/tse-tape?symbol=${'A'.repeat(30)}`);
    assert(resBad3.status === 400, 'FR-009 symbol exceeding length limit returns 400', `Expected 400, got ${resBad3.status}`);
  }

  console.log('✅ [008 API Acceptance Suite] All HTTP endpoints passed with verified shapes and schemas.');
}

run().catch(err => {
  console.error(`❌ Suite unhandled error: ${err.message}`);
  process.exit(1);
});
