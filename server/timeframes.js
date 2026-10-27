// server/timeframes.js
// Pure ESM module for timeframe parsing, bucket alignment and bar aggregation.
// No Node.js APIs allowed (isomorphic: reused by client/src/timeframes.js).

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;
// 1970-01-05 00:00:00 UTC was Monday (first Monday of the Unix epoch)
const EPOCH_MONDAY_MS = 4 * DAY_MS;
const NOMINAL_MONTH_MS = 2592000000; // 30 days nominal

/**
 * Parses a timeframe string into a canonical descriptor.
 * Grammar (FR-001):
 * - Seconds: Ns or NS (1–59) -> canonical 'Ns'
 * - Hours: Nh or NH (1–24) -> canonical string of minutes (e.g. '60', '240')
 * - Minutes: N or Nm (1–1440) -> canonical string of minutes (e.g. '1', '45')
 * - Days: D or ND or Nd (1–365) -> canonical 'D' or 'ND'
 * - Weeks: W or NW or Nw (1–52) -> canonical 'W' or 'NW'
 * - Months: M or NM (1–12, uppercase M only) -> canonical 'M' or 'NM'
 *
 * @param {string|object} input
 * @returns {{ canonical: string, unit: 's'|'m'|'D'|'W'|'M', count: number, intervalMs: number } | null}
 */
export function parseTimeframe(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object' && input.canonical && input.unit && typeof input.count === 'number') {
    return input;
  }
  const str = String(input).trim();
  if (!str) return null;

  // 1. Seconds: Ns or NS (1–59)
  const secMatch = str.match(/^([0-9]+)[sS]$/);
  if (secMatch) {
    const count = parseInt(secMatch[1], 10);
    if (count < 1 || count > 59) return null;
    return {
      canonical: `${count}s`,
      unit: 's',
      count,
      intervalMs: count * 1000
    };
  }

  // 2. Hours: Nh or NH (1–24) -> normalize to minutes
  const hourMatch = str.match(/^([0-9]+)[hH]$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    if (hours < 1 || hours > 24) return null;
    const count = hours * 60;
    return {
      canonical: String(count),
      unit: 'm',
      count,
      intervalMs: count * 60 * 1000
    };
  }

  // 3. Minutes: N or Nm (1–1440)
  const minMatch = str.match(/^([0-9]+)m$/) || str.match(/^([0-9]+)$/);
  if (minMatch) {
    const count = parseInt(minMatch[1], 10);
    if (count < 1 || count > 1440) return null;
    return {
      canonical: String(count),
      unit: 'm',
      count,
      intervalMs: count * 60 * 1000
    };
  }

  // 4. Days: D or ND or Nd (1–365)
  const dayMatch = str.match(/^([0-9]*)[dD]$/);
  if (dayMatch) {
    const count = dayMatch[1] === '' ? 1 : parseInt(dayMatch[1], 10);
    if (count < 1 || count > 365) return null;
    return {
      canonical: count === 1 ? 'D' : `${count}D`,
      unit: 'D',
      count,
      intervalMs: count * DAY_MS
    };
  }

  // 5. Weeks: W or NW or Nw (1–52)
  const weekMatch = str.match(/^([0-9]*)[wW]$/);
  if (weekMatch) {
    const count = weekMatch[1] === '' ? 1 : parseInt(weekMatch[1], 10);
    if (count < 1 || count > 52) return null;
    return {
      canonical: count === 1 ? 'W' : `${count}W`,
      unit: 'W',
      count,
      intervalMs: count * WEEK_MS
    };
  }

  // 6. Months: M or NM (1–12) -- Uppercase M only!
  const monthMatch = str.match(/^([0-9]*)M$/);
  if (monthMatch) {
    const count = monthMatch[1] === '' ? 1 : parseInt(monthMatch[1], 10);
    if (count < 1 || count > 12) return null;
    return {
      canonical: count === 1 ? 'M' : `${count}M`,
      unit: 'M',
      count,
      intervalMs: count * NOMINAL_MONTH_MS
    };
  }

  return null;
}

/**
 * Calculates bucket start timestamp in epoch ms for given timeframe and timestamp (FR-002).
 *
 * @param {string|object} tf
 * @param {number} ms
 * @returns {number}
 */
export function bucketStart(tf, ms) {
  const parsed = typeof tf === 'object' && tf !== null && tf.unit ? tf : parseTimeframe(tf);
  if (!parsed) throw new Error(`Invalid timeframe: ${tf}`);

  const time = Number(ms);

  switch (parsed.unit) {
    case 's': {
      const stepMs = parsed.count * 1000;
      return Math.floor(time / stepMs) * stepMs;
    }
    case 'm': {
      const stepMs = parsed.count * 60 * 1000;
      return Math.floor(time / stepMs) * stepMs;
    }
    case 'D': {
      const epochDay = Math.floor(time / DAY_MS);
      const bucketDay = Math.floor(epochDay / parsed.count) * parsed.count;
      return bucketDay * DAY_MS;
    }
    case 'W': {
      const diff = time - EPOCH_MONDAY_MS;
      const weekIndex = Math.floor(diff / WEEK_MS);
      const bucketWeekIndex = Math.floor(weekIndex / parsed.count) * parsed.count;
      return EPOCH_MONDAY_MS + bucketWeekIndex * WEEK_MS;
    }
    case 'M': {
      const d = new Date(time);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthIndex = (year - 1970) * 12 + month;
      const bucketMonthIndex = Math.floor(monthIndex / parsed.count) * parsed.count;
      const bucketYear = 1970 + Math.floor(bucketMonthIndex / 12);
      const bucketMonth = bucketMonthIndex % 12;
      return Date.UTC(bucketYear, bucketMonth, 1, 0, 0, 0, 0);
    }
    default:
      throw new Error(`Unsupported timeframe unit: ${parsed.unit}`);
  }
}

/**
 * Calculates next bucket start timestamp in epoch ms (FR-002).
 *
 * @param {string|object} tf
 * @param {number} startMs
 * @returns {number}
 */
export function nextBucket(tf, startMs) {
  const parsed = typeof tf === 'object' && tf !== null && tf.unit ? tf : parseTimeframe(tf);
  if (!parsed) throw new Error(`Invalid timeframe: ${tf}`);

  const start = Number(startMs);

  switch (parsed.unit) {
    case 's':
      return start + parsed.count * 1000;
    case 'm':
      return start + parsed.count * 60 * 1000;
    case 'D':
      return start + parsed.count * DAY_MS;
    case 'W':
      return start + parsed.count * WEEK_MS;
    case 'M': {
      const d = new Date(start);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthIndex = (year - 1970) * 12 + month;
      const nextMonthIndex = monthIndex + parsed.count;
      const nextYear = 1970 + Math.floor(nextMonthIndex / 12);
      const nextMonth = nextMonthIndex % 12;
      return Date.UTC(nextYear, nextMonth, 1, 0, 0, 0, 0);
    }
    default:
      throw new Error(`Unsupported timeframe unit: ${parsed.unit}`);
  }
}

/**
 * Aggregates lower-timeframe bars into target timeframe bars according to FR-002 and FR-003.
 * OHLCV rules: open = first open, close = last close, high = max, low = min, volume = sum.
 * Sets closeTime = nextBucket - 1.
 *
 * @param {Array<object>} bars
 * @param {string|object} tf
 * @param {{ dropPartialOldest?: boolean }} [options]
 * @returns {Array<object>}
 */
export function aggregate(bars, tf, options = {}) {
  if (!Array.isArray(bars) || bars.length === 0) return [];
  const parsed = typeof tf === 'object' && tf !== null && tf.unit ? tf : parseTimeframe(tf);
  if (!parsed) throw new Error(`Invalid timeframe: ${tf}`);

  const { dropPartialOldest = false } = options;

  // Group bars by bucketStart
  const buckets = new Map();
  for (const bar of bars) {
    const bStart = bucketStart(parsed, bar.time);
    let group = buckets.get(bStart);
    if (!group) {
      group = [];
      buckets.set(bStart, group);
    }
    group.push(bar);
  }

  const sortedStarts = Array.from(buckets.keys()).sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < sortedStarts.length; i++) {
    const bStart = sortedStarts[i];
    const group = buckets.get(bStart);
    group.sort((a, b) => a.time - b.time);

    // If dropPartialOldest is true and this is the oldest bucket:
    // Drop it if it does not cover from the start of the bucket
    if (i === 0 && dropPartialOldest) {
      if (group[0].time > bStart) {
        continue;
      }
    }

    const open = group[0].open;
    const close = group[group.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const b of group) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += (Number(b.volume) || 0);
    }

    const nBucket = nextBucket(parsed, bStart);
    result.push({
      time: bStart,
      open,
      high,
      low,
      close,
      volume,
      closeTime: nBucket - 1
    });
  }

  return result;
}
