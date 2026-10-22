// Chartivia landing page: bilingual (FA default / EN), live pricing from /api/plans.
const LS_KEY = 'tradingchart_user_settings'; // shared with the chart app

const EN = {
  skip: 'Skip to main content', navAria: 'Primary', navFeatures: 'Features', navMarkets: 'Markets', navPricing: 'Pricing', navFaq: 'FAQ',
  ctaOpen: 'Open chart', ctaStart: 'Start free', ctaPlans: 'Compare plans',
  heroPill: 'Charts, analysis and practice trading in one place',
  heroTitle: 'See the market clearly. Decide with confidence.',
  heroLead: 'Chartivia is a charting and technical-analysis platform: fast charts, 100+ indicators, drawing tools, price alerts, a screener and paper-trading accounts for risk-free practice — fully in English and Persian.',
  heroNote: 'No install · Desktop and mobile · Free Basic plan',
  featTitle: 'Everything you need for professional analysis', featSub: 'The tools you know from global platforms, with a precise right-to-left Persian interface.',
  f1t: 'Fast, precise charts', f1d: 'Candles, bars, line, Heikin Ashi, Renko and more; multi-chart layouts, many timeframes and bar replay.',
  f2t: '100+ indicators', f2d: 'Moving averages, RSI, MACD, Bollinger Bands, volume profile and dozens more, fully configurable with saved templates.',
  f3t: 'Drawing tools', f3d: 'Trend lines, Fibonacci, channels, price patterns and notes on the chart, saved in your own layouts.',
  f4t: 'Price alerts & webhooks', f4d: 'Crossing, channel and percent-move alerts; higher plans add a private, secure webhook URL.',
  f5t: 'Paper trading & journal', f5d: 'Practice without real money, a prop-firm challenge simulator and a trade journal to measure performance.',
  f6t: 'Pine scripting & backtests', f6d: 'A Pine editor for building indicators and strategies, with a strategy tester report.',
  f7t: 'Screener & economic calendar', f7d: 'Technical ratings across symbols, a macro events calendar and market depth for crypto symbols.',
  f8t: 'Cloud sync', f8d: 'Your layouts, watchlists and alerts are available on every device.',
  f9t: 'Account security', f9d: 'Two-factor sign-in with an authenticator app, device management and sign-out everywhere.',
  mkTitle: 'Markets covered', tagLive: 'Live data', tagDemo: 'Demo data',
  mk1t: 'Crypto', mk1d: 'Real-time prices and market depth for major crypto symbols from Binance.',
  mk2t: 'Forex, gold, commodities, stocks and Tehran exchange', mk2d: 'Demo series for learning and testing the tools; connections to official data sources for these markets are in development.',
  prTitle: 'Choose your plan', prSub: 'Start free and upgrade whenever you need more.', cycleAria: 'Billing period', cycM: 'Monthly', cycY: 'Yearly (2 months free)',
  prNote: 'Paid plans are activated after you request an upgrade from your account and support confirms payment.',
  faqTitle: 'Frequently asked questions',
  q1: 'Do I need to install anything?', a1: 'No. Chartivia runs in desktop and mobile browsers.',
  q2: 'Is the free plan time-limited?', a2: 'No. The Basic plan is free forever; it simply has lower limits.',
  q3: 'Does paper trading use real money?', a3: 'No. Paper accounts and the webhook relay are simulations; no order is ever sent to a broker.',
  q4: 'Which markets have live data?', a4: 'Crypto data is live. Other markets currently use demo data and are labelled “Demo” in the app.',
  q5: 'How is my account protected?', a5: 'Traffic is encrypted, passwords are stored hashed, and you can enable two-factor sign-in.',
  ctaTitle: 'Open the chart now',
  disc: 'Chartivia information and tools are for education and analysis only and are not investment advice. Trading financial markets carries a risk of losing capital.',
  title: 'Chartivia — Advanced Charting & Trading Platform',
  free: 'Free', mo: '/mo', yr: '/yr', popular: 'Most popular', choose: 'Get started', current: 'Start free',
  charts: n => `${n} ${n === 1 ? 'chart' : 'charts'} per layout`, inds: n => `${n} indicators per chart`,
  alerts: n => `${n} price alerts`, bars: n => `${n.toLocaleString('en-US')} historical bars`,
  webhook: 'Webhook alerts', backtest: 'Deep backtesting', paper: n => `${n} paper ${n === 1 ? 'account' : 'accounts'}`,
  loadErr: 'Pricing could not be loaded. Open the chart to see plans.'
};
const FA_DIGITS = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const FA_FN = {
  free: 'رایگان', mo: '/ماه', yr: '/سال', popular: 'محبوب‌ترین', choose: 'شروع کنید', current: 'شروع رایگان',
  charts: n => `${FA_DIGITS(n)} نمودار در هر چیدمان`, inds: n => `${FA_DIGITS(n)} اندیکاتور در هر نمودار`,
  alerts: n => `${FA_DIGITS(n)} هشدار قیمت`, bars: n => `${FA_DIGITS(n.toLocaleString('en-US')).replace(/,/g, '٬')} کندل تاریخی`,
  webhook: 'هشدار وب‌هوک', backtest: 'بک‌تست عمیق', paper: n => `${FA_DIGITS(n)} حساب معاملات کاغذی`,
  loadErr: 'بارگذاری قیمت‌ها ممکن نشد. برای مشاهده پلن‌ها وارد نمودار شوید.'
};

const faOriginal = new Map();
let lang = 'fa';
let cycle = 'm';
let plansData = null;

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'fa') return q;
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if (s.language === 'en' || s.language === 'fa') return s.language; } catch (e) { /* none */ }
  return (navigator.language || '').toLowerCase().startsWith('fa') ? 'fa' : 'fa';
}

function applyLang(l) {
  lang = l;
  const html = document.documentElement;
  html.lang = l; html.dir = l === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (!faOriginal.has(el)) faOriginal.set(el, el.textContent);
    el.textContent = l === 'en' ? (EN[k] ?? faOriginal.get(el)) : faOriginal.get(el);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const k = el.dataset.i18nAria;
    if (!el.dataset.faAria) el.dataset.faAria = el.getAttribute('aria-label') || '';
    el.setAttribute('aria-label', l === 'en' ? EN[k] : el.dataset.faAria);
  });
  if (!faOriginal.has('title')) faOriginal.set('title', document.title);
  document.title = l === 'en' ? EN.title : faOriginal.get('title');
  const btn = document.getElementById('lang-toggle');
  btn.textContent = l === 'en' ? 'فا' : 'EN';
  btn.setAttribute('aria-label', l === 'en' ? 'فارسی' : 'English');
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); s.language = l; localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  renderPlans();
}

const T = k => (lang === 'en' ? EN[k] : FA_FN[k]);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => {
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return lang === 'fa' ? FA_DIGITS(s).replace(/\./g, '٫').replace(/,/g, '٬') : s;
};

function renderPlans() {
  const host = document.getElementById('plans');
  if (!host) return;
  if (!plansData) return;
  if (plansData === 'error') { host.innerHTML = `<p class="note center">${esc(T('loadErr'))}</p>`; return; }
  const { plans, planOrder } = plansData;
  const unl = lang === 'fa' ? 'نامحدود' : 'Unlimited';
  // -1 = unlimited: replace the leading count with the word "Unlimited"
  const num = (n, fn) => (n === -1 ? fn(0).replace(/^[0۰]/, unl) : fn(n));
  host.innerHTML = planOrder.map(id => {
    const p = plans[id];
    const name = lang === 'fa' ? (p.nameFa || p.nameEn || id) : (p.nameEn || id);
    const price = cycle === 'y' ? p.priceYearlyUSD : p.priceUSD;
    const pop = id === 'plus';
    const feats = [num(p.chartsPerTab, T('charts')), num(p.indicatorsPerChart, T('inds')), num(p.priceAlerts, T('alerts')), T('bars')(p.histBars), num(p.paperAccounts, T('paper'))];
    if (p.webhookAlerts) feats.push(T('webhook'));
    if (p.deepBacktest) feats.push(T('backtest'));
    const priceHtml = Number(p.priceUSD) === 0
      ? `<div class="price">${esc(T('free'))}</div>`
      : `<div class="price">$${money(price)} <small>${esc(cycle === 'y' ? T('yr') : T('mo'))}</small></div>`;
    return `<article class="plan${pop ? ' pop' : ''}">
      ${pop ? `<span class="badge">${esc(T('popular'))}</span>` : ''}
      <h3>${esc(name)}</h3>${priceHtml}
      <ul>${feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <a class="btn ${pop ? 'btn-primary' : 'btn-ghost'}" href="/chart">${esc(Number(p.priceUSD) === 0 ? T('current') : T('choose'))}</a>
    </article>`;
  }).join('');
}

async function loadPlans() {
  try {
    const r = await fetch('/api/plans', { credentials: 'same-origin' });
    const d = await r.json();
    if (!r.ok || !d.plans) throw new Error('bad');
    plansData = { plans: d.plans, planOrder: d.planOrder.filter(id => d.plans[id] && d.plans[id].isActive !== false) };
  } catch (e) { plansData = 'error'; }
  renderPlans();
}

document.getElementById('lang-toggle').addEventListener('click', () => applyLang(lang === 'fa' ? 'en' : 'fa'));
document.querySelectorAll('.cyc').forEach(b => b.addEventListener('click', () => {
  cycle = b.dataset.cycle;
  document.querySelectorAll('.cyc').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  renderPlans();
}));
document.getElementById('year').textContent = String(new Date().getFullYear());
applyLang(pickLang());
loadPlans();
