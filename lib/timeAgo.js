// Relative-time formatting.
//
// All three exports accept a Date, an ISO string, or a timestamp number.
// Invalid or missing input returns '' rather than "NaNs ago".
//
// Note on units: months/years use average lengths (30.44 / 365.25 days)
// and every unit is clamped to a minimum of 1 — the old thresholds let
// 28–29 days render as "0mo ago" and 360–364 days as "0y ago".

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30.44 * DAY // average month
const YEAR = 365.25 * DAY // average year

/**
 * Parse input and return elapsed whole seconds, or null when unusable.
 * Future timestamps (server clock skew, scheduled publish times) clamp
 * to 0 so they read as "just now" instead of going negative.
 */
function elapsedSeconds(date, now = new Date()) {
  if (!date) return null
  const past = new Date(date)
  if (isNaN(past.getTime())) return null
  return Math.max(0, Math.floor((now - past) / 1000))
}

/** Break elapsed seconds into a { unit, value } pair with safe boundaries. */
function breakdown(seconds) {
  if (seconds < 5) return { unit: 'now', value: 0 }
  if (seconds < MINUTE) return { unit: 'second', value: seconds }
  if (seconds < HOUR) return { unit: 'minute', value: Math.floor(seconds / MINUTE) }
  if (seconds < DAY) return { unit: 'hour', value: Math.floor(seconds / HOUR) }
  if (seconds < WEEK) return { unit: 'day', value: Math.floor(seconds / DAY) }
  if (seconds < MONTH) return { unit: 'week', value: Math.max(1, Math.floor(seconds / WEEK)) }
  if (seconds < YEAR) return { unit: 'month', value: Math.max(1, Math.floor(seconds / MONTH)) }
  return { unit: 'year', value: Math.max(1, Math.floor(seconds / YEAR)) }
}

const SHORT_SUFFIX = {
  second: 's',
  minute: 'm',
  hour: 'h',
  day: 'd',
  week: 'w',
  month: 'mo',
  year: 'y',
}

/**
 * Compact form: "just now", "45s ago", "3m ago", "2h ago", "5d ago",
 * "2w ago", "3mo ago", "1y ago".
 * @param {Date|string|number} date
 * @param {Date} [now] - injectable for tests
 */
export function timeAgo(date, now = new Date()) {
  const seconds = elapsedSeconds(date, now)
  if (seconds === null) return ''

  const { unit, value } = breakdown(seconds)
  if (unit === 'now') return 'just now'
  return `${value}${SHORT_SUFFIX[unit]} ago`
}

/**
 * Long form: "Just now", "5 minutes ago", "2 hours ago", "Yesterday",
 * "4 days ago", "Last week", "3 weeks ago", "Last month", "6 months ago",
 * then a full date ("March 15, 2025") beyond a year.
 * @param {Date|string|number} date
 * @param {Date} [now] - injectable for tests
 */
export function timeAgoLong(date, now = new Date()) {
  const seconds = elapsedSeconds(date, now)
  if (seconds === null) return ''

  const { unit, value } = breakdown(seconds)

  switch (unit) {
    case 'now':
    case 'second':
      return 'Just now'
    case 'minute':
      return `${value} ${value === 1 ? 'minute' : 'minutes'} ago`
    case 'hour':
      return `${value} ${value === 1 ? 'hour' : 'hours'} ago`
    case 'day':
      return value === 1 ? 'Yesterday' : `${value} days ago`
    case 'week':
      return value === 1 ? 'Last week' : `${value} weeks ago`
    case 'month':
      return value === 1 ? 'Last month' : `${value} months ago`
    default:
      // Beyond a year, an absolute date is more useful than "2 years ago"
      return new Date(date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
  }
}

/**
 * Full date and time for tooltips: "March 15, 2025, 02:30 PM".
 * @param {Date|string|number} date
 */
export function fullDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}