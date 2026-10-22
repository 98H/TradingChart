// client/src/platformBanner.js — renders the admin-controlled global
// announcement (back-office → Settings → Global announcement) at the top of
// the trading app. Source of truth: GET /api/platform (public, no-store).
//
// Contract:
//  • info | warning | success levels, Persian/English text picked by the app
//    language (falls back to the other language when one is empty).
//  • Dismissal is remembered per announcement revision (updatedAt), so editing
//    the text in the console shows it again to everyone.
//  • Text is inserted with textContent only (never HTML) — admin input is
//    untrusted from the client's point of view.
//  • Lives inside #app-container as a normal flex row above the header, so it
//    pushes the workspace down instead of covering the chart toolbar.
import { getLanguage } from './i18n.js';

const DISMISS_KEY = 'tc_announcement_dismissed';
const REFRESH_MS = 5 * 60 * 1000;
let current = null;   // last announcement payload
let timer = null;

const isFa = () => getLanguage() === 'fa';

function dismissedRev() {
  try { return localStorage.getItem(DISMISS_KEY) || ''; } catch (e) { return ''; }
}

function remove() {
  document.getElementById('tc-platform-banner')?.remove();
  document.body.classList.remove('has-platform-banner');
}

function render() {
  const a = current;
  if (!a || dismissedRev() === String(a.updatedAt)) { remove(); return; }
  const fa = isFa();
  const text = (fa ? (a.fa || a.en) : (a.en || a.fa)) || '';
  if (!text) { remove(); return; }
  let el = document.getElementById('tc-platform-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tc-platform-banner';
    el.setAttribute('role', a.level === 'warning' ? 'alert' : 'status');
    el.innerHTML = '<span class="tc-pb-ico" aria-hidden="true"></span><p class="tc-pb-text"></p><button type="button" class="tc-pb-close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
    el.querySelector('.tc-pb-close').addEventListener('click', () => {
      try { localStorage.setItem(DISMISS_KEY, String(current?.updatedAt || '')); } catch (e) { /* private mode */ }
      remove();
    });
    const host = document.getElementById('app-container') || document.body;
    host.insertBefore(el, host.firstChild);
  }
  el.dataset.level = ['info', 'warning', 'success'].includes(a.level) ? a.level : 'info';
  el.setAttribute('dir', fa ? 'rtl' : 'ltr');
  el.querySelector('.tc-pb-ico').textContent = a.level === 'warning' ? '⚠' : a.level === 'success' ? '✓' : 'ℹ';
  el.querySelector('.tc-pb-text').textContent = text;
  el.querySelector('.tc-pb-close').setAttribute('aria-label', fa ? 'بستن اطلاعیه' : 'Dismiss announcement');
  document.body.classList.add('has-platform-banner');
}

async function refresh() {
  try {
    const r = await fetch('/api/platform', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    current = j && j.announcement ? j.announcement : null;
    window.__TC_EMAIL_DELIVERY__ = !!(j && j.emailDelivery);
    render();
  } catch (e) { /* offline: keep whatever is shown */ }
}

/** Boot once; re-render on language switches via relocalizePlatformBanner(). */
export function initPlatformBanner() {
  refresh();
  if (!timer) {
    timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }
}
export function relocalizePlatformBanner() { if (current) render(); }
