/**
 * The notification types the database writes (supabase/setup.sql, Section
 * 18), and the pure rules the bell and /api/push/send share about them.
 * No React, no Supabase: everything here is unit-tested.
 */

// icon / colour for the bell; pref: which Settings switch silences its push
// (none = always pushed: nothing in Settings covers it); noun: how a group
// of repeats reads ("3 new replies").
export const NOTIFICATION_TYPES = {
  ticket_reply:      { icon: '💬', color: '#f0effe', pref: 'tickets',       noun: ['new reply', 'new replies'] },
  ticket_new:        { icon: '📋', color: '#f0effe', pref: 'tickets',       noun: ['new ticket', 'new tickets'] },
  ticket_status:     { icon: '📋', color: '#f0effe', pref: 'tickets',       noun: ['ticket update', 'ticket updates'] },
  incident_new:      { icon: '⚠️', color: '#fff7ed', pref: 'incidents',     noun: ['new incident', 'new incidents'] },
  incident_assigned: { icon: '🛡️', color: '#fef9c3', pref: 'incidents',     noun: ['dispatch', 'dispatches'] },
  incident_status:   { icon: '✅', color: '#ecfdf5', pref: 'incidents',     noun: ['incident update', 'incident updates'] },
  announcement:      { icon: '📢', color: '#eff6ff', pref: 'announcements', noun: ['new announcement', 'new announcements'] },
  document_new:      { icon: '📄', color: '#f5f3ff', pref: null,            noun: ['document request', 'document requests'] },
  document_status:   { icon: '📄', color: '#f5f3ff', pref: null,            noun: ['document update', 'document updates'] },
  blotter:           { icon: '⚖️', color: '#fef2f2', pref: null,            noun: ['case update', 'case updates'] },
  verification_new:  { icon: '🪪', color: '#f0fdf4', pref: null,            noun: ['resident to verify', 'residents to verify'] },
  verification:      { icon: '🪪', color: '#f0fdf4', pref: null,            noun: ['verification update', 'verification updates'] },
  appointment:       { icon: '📅', color: '#f0effe', pref: null,            noun: ['appointment reminder', 'appointment reminders'] },
  application:       { icon: '🏛️', color: '#f0effe', pref: null,            noun: ['new application', 'new applications'] },
}

const FALLBACK = { icon: '🔔', color: '#f0effe', pref: null, noun: ['update', 'updates'] }

const HOUR = 60 * 60
const DAY = 24 * HOUR

/**
 * How each type is pushed.
 *
 * urgency: 'high' reaches a sleeping phone at once. Android holds 'normal'
 * pushes while the browser is asleep (in testing, until Chrome was next
 * opened), so 'normal' is only for what can wait for that.
 *
 * ttl (seconds): how long the push service keeps trying a phone that is off
 * or offline before dropping the push. The bell keeps the notification
 * either way; this is only about whether a late buzz is still worth it.
 */
export const PUSH_DELIVERY = {
  // Someone should act now; an hour later it is stale.
  incident_new:      { urgency: 'high',   ttl: HOUR },     // officials: a new report
  incident_assigned: { urgency: 'high',   ttl: HOUR },     // tanod: dispatched
  // A person's own case moved.
  incident_status:   { urgency: 'high',   ttl: 6 * HOUR }, // reporter: a tanod is on the way, resolved
  ticket_reply:      { urgency: 'high',   ttl: DAY },
  ticket_status:     { urgency: 'high',   ttl: DAY },
  verification:      { urgency: 'high',   ttl: DAY },
  document_status:   { urgency: 'high',   ttl: DAY },      // processing, ready, released, denied
  blotter:           { urgency: 'high',   ttl: DAY },      // filed, hearing set, status
  // Routine: fine to arrive when the phone next wakes.
  announcement:      { urgency: 'normal', ttl: DAY },
  appointment:       { urgency: 'normal', ttl: HOUR },     // a reminder after the meeting is noise
  ticket_new:        { urgency: 'normal', ttl: DAY },      // officials' queues
  document_new:      { urgency: 'normal', ttl: DAY },
  verification_new:  { urgency: 'normal', ttl: DAY },
  application:       { urgency: 'normal', ttl: DAY },      // super admins
}

/** Urgency and TTL for a notification row's push. */
export function pushDelivery(row) {
  const delivery = PUSH_DELIVERY[row?.type] || { urgency: 'normal', ttl: HOUR }
  // A critical incident is high whatever its type says.
  if (/^Critical/.test(row?.title || '')) return { urgency: 'high', ttl: Math.min(delivery.ttl, HOUR) }
  return delivery
}

/** Settings → "Send test notification": checking a phone's setup. */
export const TEST_PUSH = { urgency: 'high', ttl: 10 * 60 }

export function testPushPayload(now = new Date()) {
  return {
    title: 'Test notification',
    body: 'Notifications reach this device, even with the app closed.',
    url: '/settings',
    // A second test replaces the first instead of stacking.
    tag: 'bh360-test',
    timestamp: now.toISOString(),
    data: { type: 'test' },
  }
}

export function typeMeta(type) {
  return NOTIFICATION_TYPES[type] || FALLBACK
}

/**
 * Whether this person's Settings allow a push for this type. A switch that
 * was never touched counts as on (the Settings defaults are all on).
 */
export function pushAllowed(type, prefs) {
  const key = typeMeta(type).pref
  if (!key) return true
  return (prefs || {})[key] !== false
}

/**
 * Bell items from notification rows (newest first, as loaded). Rows that
 * share a group_key collapse into one item: "3 new replies" over the latest
 * one. Each item knows every id it stands for, so opening it marks them all
 * read. Unread items come first, then read; newest first within each.
 */
export function groupNotifications(rows) {
  const items = []
  const byGroup = new Map()
  for (const row of rows || []) {
    const key = row.group_key
    const existing = key ? byGroup.get(key) : null
    if (existing) {
      existing.ids.push(row.id)
      if (!row.read_at) existing.unreadIds.push(row.id)
      continue
    }
    const item = { key: key || row.id, latest: row, ids: [row.id], unreadIds: row.read_at ? [] : [row.id] }
    if (key) byGroup.set(key, item)
    items.push(item)
  }
  for (const item of items) {
    item.unread = item.unreadIds.length > 0
    // How many unread repeats, when there is more than one to speak of.
    item.count = item.unreadIds.length > 1 ? item.unreadIds.length : 1
    item.title = item.count > 1
      ? `${item.count} ${typeMeta(item.latest.type).noun[1]}`
      : item.latest.title
    item.subtitle = item.count > 1 ? item.latest.title : (item.latest.body || '')
  }
  const time = (item) => new Date(item.latest.created_at || 0).getTime()
  return [
    ...items.filter(i => i.unread).sort((a, b) => time(b) - time(a)),
    ...items.filter(i => !i.unread).sort((a, b) => time(b) - time(a)),
  ]
}

/** How many unread notifications, counting each row (not each group). */
export function unreadTotal(rows) {
  let n = 0
  for (const row of rows || []) if (!row.read_at) n += 1
  return n
}

/**
 * The link to open for a notification, carrying its id (?nid=) so the page
 * it lands on marks it read, even when opened from a push on a phone where
 * no page was open to do it.
 */
export function notificationHref(row) {
  const base = row?.link || '/'
  if (!row?.id) return base
  const [path, hash = ''] = base.split('#')
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}nid=${encodeURIComponent(row.id)}${hash ? `#${hash}` : ''}`
}

/**
 * Tags the older per-table push used for the three events it covered
 * (lib/pushAudience.js on main). Reusing them means a device that receives
 * the same event from both paths, while both exist, shows it once: a push
 * with a visible notification's tag replaces it rather than stacking.
 */
const LEGACY_TAG_PREFIX = { ticket_reply: 'ticket-', incident_new: 'incident-', incident_assigned: 'assignment-' }

export function pushTag(row) {
  const prefix = LEGACY_TAG_PREFIX[row?.type]
  if (prefix && row.entity_id) return prefix + row.entity_id
  // Otherwise repeats of one thing (its group) replace each other.
  return row?.group_key || row?.id
}

/**
 * Whether this deployment may push to a recipient in this barangay.
 *
 * Production and previews share one database and the same VAPID keys, so a
 * preview could reach every real device. PUSH_ONLY_BARANGAY_IDS
 * (comma-separated) limits a preview to a test barangay's accounts, and a
 * preview without it pushes to nobody: forgetting the setting must not mean
 * real users get every event twice. Production (or any host that is not a
 * Vercel preview) pushes to everyone unless a list is set.
 *
 * @param {string|null} barangayId  the recipient's barangay
 * @param {string} [onlyBarangayIds]  PUSH_ONLY_BARANGAY_IDS
 * @param {string} [deployment]  VERCEL_ENV: 'production' | 'preview' | 'development'
 */
export function recipientAllowed(barangayId, onlyBarangayIds, deployment) {
  const list = String(onlyBarangayIds || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!list.length) return deployment !== 'preview' && deployment !== 'development'
  return Boolean(barangayId) && list.includes(barangayId)
}

/** The JSON the service worker turns into a system notification. */
export function pushPayload(row) {
  const critical = row.type === 'incident_new' && /^Critical/.test(row.title || '')
  return {
    title: row.title,
    body: row.body || '',
    url: notificationHref(row),
    tag: pushTag(row),
    priority: critical ? 'Critical' : undefined,
    timestamp: row.created_at,
    data: { notificationId: row.id, type: row.type },
  }
}
