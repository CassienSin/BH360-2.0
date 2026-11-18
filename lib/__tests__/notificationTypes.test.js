import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  NOTIFICATION_TYPES, typeMeta, pushAllowed, groupNotifications, unreadTotal,
  notificationHref, pushPayload, pushTag, recipientAllowed,
} from '../notificationTypes'

const row = (over = {}) => ({
  id: 'n1', user_id: 'u1', type: 'ticket_reply', title: 'Kap. Reyes replied',
  body: 'Streetlight out: We will send someone', link: '/resident/ticket/t1',
  group_key: 'ticket-reply:t1', created_at: '2026-11-17T10:00:00Z', read_at: null, ...over,
})

describe('pushAllowed', () => {
  it('follows the Settings switch for the type', () => {
    expect(pushAllowed('ticket_reply', { tickets: false })).toBe(false)
    expect(pushAllowed('incident_assigned', { incidents: false })).toBe(false)
    expect(pushAllowed('announcement', { announcements: false })).toBe(false)
    expect(pushAllowed('incident_new', { tickets: false })).toBe(true)
  })

  it('treats a switch never touched as on', () => {
    expect(pushAllowed('ticket_reply', {})).toBe(true)
    expect(pushAllowed('ticket_reply', null)).toBe(true)
  })

  it('always pushes types no switch covers', () => {
    expect(pushAllowed('document_status', { tickets: false, incidents: false, announcements: false })).toBe(true)
    expect(pushAllowed('verification', {})).toBe(true)
  })
})

describe('groupNotifications', () => {
  it('collapses unread repeats that share a group_key', () => {
    const items = groupNotifications([
      row({ id: 'a', created_at: '2026-11-17T10:03:00Z' }),
      row({ id: 'b', created_at: '2026-11-17T10:02:00Z' }),
      row({ id: 'c', created_at: '2026-11-17T10:01:00Z' }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('3 new replies')
    expect(items[0].subtitle).toBe('Kap. Reyes replied')
    expect(items[0].unreadIds).toEqual(['a', 'b', 'c'])
    expect(items[0].latest.id).toBe('a')
  })

  it('shows a single unread row as itself', () => {
    const [item] = groupNotifications([row(), row({ id: 'old', read_at: '2026-11-17T09:00:00Z' })])
    expect(item.title).toBe('Kap. Reyes replied')
    expect(item.subtitle).toBe('Streetlight out: We will send someone')
    expect(item.unreadIds).toEqual(['n1'])
    expect(item.ids).toEqual(['n1', 'old'])
  })

  it('keeps rows without a group_key separate', () => {
    const items = groupNotifications([
      row({ id: 'x', type: 'incident_new', group_key: null }),
      row({ id: 'y', type: 'incident_new', group_key: null }),
    ])
    expect(items.map(i => i.key)).toEqual(['x', 'y'])
  })

  it('lists unread before read, newest first within each', () => {
    const items = groupNotifications([
      row({ id: 'r-new', group_key: null, read_at: 'x', created_at: '2026-11-17T12:00:00Z' }),
      row({ id: 'u-old', group_key: null, created_at: '2026-11-17T08:00:00Z' }),
      row({ id: 'u-new', group_key: null, created_at: '2026-11-17T11:00:00Z' }),
    ])
    expect(items.map(i => i.key)).toEqual(['u-new', 'u-old', 'r-new'])
  })
})

describe('unreadTotal', () => {
  it('counts rows, not groups', () => {
    expect(unreadTotal([row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c', read_at: 'x' })])).toBe(2)
    expect(unreadTotal([])).toBe(0)
  })
})

describe('notificationHref', () => {
  it('carries the id so the landing page can mark it read', () => {
    expect(notificationHref(row())).toBe('/resident/ticket/t1?nid=n1')
    expect(notificationHref(row({ link: '/official?section=documents' }))).toBe('/official?section=documents&nid=n1')
  })

  it('falls back to home with no link', () => {
    expect(notificationHref(row({ link: null }))).toBe('/?nid=n1')
  })
})

describe('recipientAllowed', () => {
  it('lets production push to everyone when no list is set', () => {
    expect(recipientAllowed('b1', undefined, 'production')).toBe(true)
    expect(recipientAllowed(null, '', 'production')).toBe(true)
    // not on Vercel at all (self-hosted, or next start locally)
    expect(recipientAllowed('b1', undefined, undefined)).toBe(true)
  })

  it('limits a preview to the listed barangays', () => {
    expect(recipientAllowed('qa', 'qa', 'preview')).toBe(true)
    expect(recipientAllowed('qa', ' other , qa ', 'preview')).toBe(true)
    expect(recipientAllowed('real', 'qa', 'preview')).toBe(false)
    expect(recipientAllowed(null, 'qa', 'preview')).toBe(false)
  })

  it('lets a preview with no list push to nobody', () => {
    expect(recipientAllowed('real', undefined, 'preview')).toBe(false)
    expect(recipientAllowed('real', ' , ', 'preview')).toBe(false)
    expect(recipientAllowed('real', '', 'development')).toBe(false)
  })

  it('applies a list on production too, if one is ever set there', () => {
    expect(recipientAllowed('real', 'qa', 'production')).toBe(false)
  })
})

describe('pushTag', () => {
  it('reuses the older push tags for the events both paths send', () => {
    expect(pushTag(row({ entity_id: 't1' }))).toBe('ticket-t1')
    expect(pushTag(row({ type: 'incident_new', entity_id: 'i1', group_key: null }))).toBe('incident-i1')
    expect(pushTag(row({ type: 'incident_assigned', entity_id: 'i1', group_key: null }))).toBe('assignment-i1')
  })
  it('otherwise collapses a group, or tags the row alone', () => {
    expect(pushTag(row({ type: 'ticket_status', group_key: 'ticket-status:t1', entity_id: 't1' }))).toBe('ticket-status:t1')
    expect(pushTag(row({ type: 'document_new', group_key: null, entity_id: 'd1' }))).toBe('n1')
  })
})

describe('pushPayload', () => {
  it('tags repeats so they replace each other on the phone', () => {
    const p = pushPayload(row({ entity_id: 't1' }))
    expect(p.tag).toBe('ticket-t1')
    expect(p.url).toBe('/resident/ticket/t1?nid=n1')
    expect(p.data).toEqual({ notificationId: 'n1', type: 'ticket_reply' })
    expect(p.priority).toBeUndefined()
  })

  it('marks critical incidents as critical', () => {
    const p = pushPayload(row({ type: 'incident_new', title: 'Critical incident: Fire', group_key: null }))
    expect(p.priority).toBe('Critical')
    expect(p.tag).toBe('n1')
  })
})

/**
 * Every type the database writes needs bell metadata and a push rule here.
 * Reads the notify calls out of setup.sql Section 18 (the type is the 4th
 * argument of private.notify and private.notify_role) plus the two direct
 * inserts, so adding a trigger without adding its type fails this test.
 */
describe('types written by setup.sql', () => {
  const sql = readFileSync(fileURLToPath(new URL('../../supabase/setup.sql', import.meta.url)), 'utf8')
  const section = sql.slice(sql.indexOf('SECTION 18 — NOTIFICATIONS'))

  function splitArgs(text) {
    const args = []
    let depth = 0, quote = false, cur = ''
    for (const ch of text) {
      if (ch === "'") quote = !quote
      if (!quote && ch === '(') depth++
      if (!quote && ch === ')') depth--
      if (!quote && depth === 0 && ch === ',') { args.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    args.push(cur.trim())
    return args
  }

  const written = new Set()
  for (const m of section.matchAll(/perform private\.notify(?:_role)?\(([\s\S]*?)\);/g)) {
    const type = splitArgs(m[1])[3]
    expect(type, m[0].slice(0, 80)).toMatch(/^'[a-z_]+'$/)
    written.add(type.slice(1, -1))
  }
  for (const m of section.matchAll(/select p\.id, (?:a\.barangay_id|new\.barangay_id), '([a-z_]+)'/g)) written.add(m[1])

  it('finds the types', () => {
    expect(written.size).toBeGreaterThanOrEqual(12)
    expect(written).toContain('announcement')
    expect(written).toContain('application')
  })

  it('has metadata for each', () => {
    for (const type of written) {
      expect(NOTIFICATION_TYPES, type).toHaveProperty(type)
      expect(typeMeta(type).noun).toHaveLength(2)
    }
  })
})
