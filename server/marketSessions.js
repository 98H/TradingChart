// server/marketSessions.js
// Market session calendar and open window helpers for TradingChart (FR-008).
// Pure ESM, deterministic, supports all symbol catalog categories.

import { getSymbolMeta } from './symbolCatalog.js';

export const MARKET_SESSIONS = {
  crypto: {
    days: [0, 1, 2, 3, 4, 5, 6],
    getWindows: (_dayOfWeek) => [{ startMinute: 0, endMinute: 24 * 60 }]
  },
  forex: {
    days: [1, 2, 3, 4, 5],
    getWindows: (dayOfWeek) => {
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        return [{ startMinute: 0, endMinute: 24 * 60 }];
      }
      if (dayOfWeek === 5) {
        return [{ startMinute: 0, endMinute: 22 * 60 }]; // Friday ends 22:00 UTC
      }
      return [];
    }
  },
  metals: {
    days: [1, 2, 3, 4, 5],
    getWindows: (dayOfWeek) => {
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        return [{ startMinute: 0, endMinute: 24 * 60 }];
      }
      if (dayOfWeek === 5) {
        return [{ startMinute: 0, endMinute: 22 * 60 }];
      }
      return [];
    }
  },
  commodities: {
    days: [1, 2, 3, 4, 5],
    getWindows: (dayOfWeek) => {
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        return [{ startMinute: 0, endMinute: 24 * 60 }];
      }
      if (dayOfWeek === 5) {
        return [{ startMinute: 0, endMinute: 22 * 60 }];
      }
      return [];
    }
  },
  stocks: {
    days: [1, 2, 3, 4, 5],
    getWindows: (dayOfWeek) => {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return [{ startMinute: 13 * 60 + 30, endMinute: 20 * 60 }]; // 13:30 - 20:00 UTC
      }
      return [];
    }
  },
  indices: {
    days: [1, 2, 3, 4, 5],
    getWindows: (dayOfWeek) => {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return [{ startMinute: 13 * 60 + 30, endMinute: 20 * 60 }]; // 13:30 - 20:00 UTC
      }
      return [];
    }
  },
  iran_tse: {
    days: [6, 0, 1, 2, 3], // Sat, Sun, Mon, Tue, Wed
    getWindows: (dayOfWeek) => {
      if (dayOfWeek === 6 || (dayOfWeek >= 0 && dayOfWeek <= 3)) {
        return [{ startMinute: 5 * 60 + 30, endMinute: 9 * 60 }]; // 05:30 - 09:00 UTC
      }
      return [];
    }
  },
  iran_gold: {
    days: [6, 0, 1, 2, 3, 4], // Sat, Sun, Mon, Tue, Wed, Thu
    getWindows: (dayOfWeek) => {
      if (dayOfWeek === 6 || (dayOfWeek >= 0 && dayOfWeek <= 4)) {
        return [{ startMinute: 6 * 60 + 30, endMinute: 15 * 60 + 30 }]; // 06:30 - 15:30 UTC
      }
      return [];
    }
  }
};

/**
 * Normalizes symbol or category string to one of the known category keys.
 *
 * @param {string} target
 * @returns {string}
 */
export function getCategory(target) {
  if (!target) return 'forex';
  const clean = String(target).replace(/^.*:/, '').toUpperCase();
  const lower = String(target).toLowerCase();
  if (MARKET_SESSIONS[lower]) return lower;
  const meta = getSymbolMeta(clean);
  if (meta?.category && MARKET_SESSIONS[meta.category]) {
    return meta.category;
  }
  if (clean.endsWith('USDT') || clean.endsWith('BTC')) return 'crypto';
  return 'forex';
}

/**
 * Checks whether the given day timestamp is a trading/session day (FR-008).
 *
 * @param {string} symbolOrCategory
 * @param {number|Date} dayMs
 * @returns {boolean}
 */
export function isSessionDay(symbolOrCategory, dayMs) {
  const cat = getCategory(symbolOrCategory);
  const cfg = MARKET_SESSIONS[cat];
  if (!cfg) return false;
  const d = new Date(Number(dayMs));
  const dayOfWeek = d.getUTCDay();
  return cfg.days.includes(dayOfWeek);
}

/**
 * Returns UTC open session windows for the given dayMs (FR-008).
 * Empty array if not a session day.
 *
 * @param {string} symbolOrCategory
 * @param {number|Date} dayMs
 * @returns {Array<{ startMinute: number, endMinute: number, startMs: number, endMs: number }>}
 */
export function sessionWindows(symbolOrCategory, dayMs) {
  const cat = getCategory(symbolOrCategory);
  const cfg = MARKET_SESSIONS[cat];
  if (!cfg) return [];
  const t = Number(dayMs);
  const d = new Date(t);
  const dayOfWeek = d.getUTCDay();
  if (!cfg.days.includes(dayOfWeek)) return [];

  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  const rawWindows = cfg.getWindows(dayOfWeek);

  return rawWindows.map(w => ({
    startMinute: w.startMinute,
    endMinute: w.endMinute,
    startMs: dayStart + w.startMinute * 60000,
    endMs: dayStart + w.endMinute * 60000
  }));
}

/**
 * Checks whether the timestamp in ms falls inside an active market session (FR-008).
 *
 * @param {string} symbolOrCategory
 * @param {number|Date} timeMs
 * @returns {boolean}
 */
export function isSessionTime(symbolOrCategory, timeMs) {
  const t = Number(timeMs);
  const windows = sessionWindows(symbolOrCategory, t);
  for (const w of windows) {
    if (t >= w.startMs && t < w.endMs) return true;
  }
  return false;
}
