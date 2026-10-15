// server/platformSettings.js
// Admin-controlled platform switches: open/close registration, maintenance
// banner, global announcement, and the list of e-mail domains treated as test
// accounts (excluded from business KPIs). Atomic JSON persistence.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'data', 'accounts', 'platform_settings.json');

const DEFAULTS = {
  registrationOpen: true,
  maintenanceMode: false,
  announcementEnabled: false,
  announcementLevel: 'info',          // info | warning | success
  announcementFa: '',
  announcementEn: '',
  testDomains: ['test.io', 'qa.test', 't.io', 'example.com', 'test.local'],
  updatedAt: 0
};
const LEVELS = ['info', 'warning', 'success'];
const DOMAIN_RE = /^[a-z0-9.-]{2,60}\.[a-z]{2,24}$/;

let _cache = null;
function load() {
  if (_cache) return _cache;
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first boot */ }
  _cache = { ...DEFAULTS, ...raw };
  if (!Array.isArray(_cache.testDomains)) _cache.testDomains = [...DEFAULTS.testDomains];
  return _cache;
}
function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

export function getPlatformSettings() { return { ...load(), testDomains: [...load().testDomains] }; }

export function isTestEmail(email) {
  const dom = String(email || '').split('@')[1] || '';
  return load().testDomains.some(d => dom === d || dom.endsWith('.' + d));
}

export function updatePlatformSettings(b) {
  const cur = load();
  const next = { ...cur };
  const errors = [];
  for (const k of ['registrationOpen', 'maintenanceMode', 'announcementEnabled']) {
    if (b[k] !== undefined) next[k] = !!b[k];
  }
  if (b.announcementLevel !== undefined) {
    if (!LEVELS.includes(b.announcementLevel)) errors.push({ field: 'announcementLevel', code: 'invalid' });
    else next.announcementLevel = b.announcementLevel;
  }
  if (b.announcementFa !== undefined) next.announcementFa = String(b.announcementFa).trim().slice(0, 280);
  if (b.announcementEn !== undefined) next.announcementEn = String(b.announcementEn).trim().slice(0, 280);
  if (b.testDomains !== undefined) {
    const list = (Array.isArray(b.testDomains) ? b.testDomains : String(b.testDomains).split(/[\s,]+/))
      .map(x => String(x).trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    const bad = list.filter(x => !DOMAIN_RE.test(x));
    if (bad.length) errors.push({ field: 'testDomains', code: 'invalid_domain', values: bad.slice(0, 5) });
    else next.testDomains = [...new Set(list)].slice(0, 50);
  }
  if (next.announcementEnabled && !next.announcementFa && !next.announcementEn) {
    errors.push({ field: 'announcement', code: 'announcement_empty' });
  }
  if (errors.length) return { ok: false, error: 'validation_failed', errors };
  const changed = Object.keys(DEFAULTS).filter(k => k !== 'updatedAt' && JSON.stringify(cur[k]) !== JSON.stringify(next[k]));
  if (changed.length) { next.updatedAt = Date.now(); _cache = next; save(); }
  return { ok: true, settings: getPlatformSettings(), changed };
}

/** Public subset served to every client (banner + registration state). */
export function publicPlatformInfo() {
  const s = load();
  return {
    registrationOpen: s.registrationOpen,
    maintenanceMode: s.maintenanceMode,
    announcement: s.announcementEnabled ? { level: s.announcementLevel, fa: s.announcementFa, en: s.announcementEn, updatedAt: s.updatedAt } : null
  };
}
