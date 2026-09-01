import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  notifKey, unreadCount,
  getReadKeys, subscribeToReadKeys, resetReadKeys,
  addReadKeys, removeReadKeys,
} from '@/lib/notificationReads'

/**
 * The bug: the sidebar showed `announcements.length`, so the badge sat at
 * the same number forever — opening the section could not change a count of
 * how many announcements exist. It has to count how many are UNREAD, and
 * the header bell has to agree with it.
 */

beforeEach(() => { resetReadKeys() })

describe('notifKey', () => {
  it('namespaces by type, so an announcement and an incident cannot collide', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    expect(notifKey({ type: 'announcement', id })).not.toBe(notifKey({ type: 'incident', id }))
  })

  it('is stable across separate objects for the same notification', () => {
    // The sidebar and the bell build their own objects from the same row;
    // they must produce the same key or a read in one will not clear the
    // other.
    const fromSidebar = { type: 'announcement', id: 'abc', title: 'Curfew' }
    const fromBell = { type: 'announcement', id: 'abc', icon: '📢', subtitle: 'x' }
    expect(notifKey(fromSidebar)).toBe(notifKey(fromBell))
  })

  it('falls back to a generic prefix rather than throwing on a typeless item', () => {
    expect(notifKey({ id: 'abc' })).toBe('notif:abc')
    expect(() => notifKey(undefined)).not.toThrow()
  })
})

describe('unreadCount', () => {
  const items = [
    { type: 'announcement', id: 'a' },
    { type: 'announcement', id: 'b' },
    { type: 'announcement', id: 'c' },
  ]

  it('counts what has not been read, not how many exist', () => {
    expect(unreadCount(items, new Set())).toBe(3)
    expect(unreadCount(items, new Set(['announcement:a']))).toBe(2)
  })

  it('reaches zero once every one is read — the badge must be able to clear', () => {
    const all = new Set(items.map(notifKey))
    expect(unreadCount(items, all)).toBe(0)
  })

  it('ignores read markers for notifications that are no longer listed', () => {
    // An announcement the official deleted still has a read marker; it must
    // not push the count negative or otherwise skew it.
    const keys = new Set(['announcement:a', 'announcement:deleted-long-ago'])
    expect(unreadCount(items, keys)).toBe(2)
  })

  it('handles the empty and missing cases without throwing', () => {
    expect(unreadCount([], new Set())).toBe(0)
    expect(unreadCount(undefined, new Set())).toBe(0)
    expect(unreadCount(items, undefined)).toBe(0)
  })
})

describe('the shared store', () => {
  it('starts empty', () => {
    expect(getReadKeys().size).toBe(0)
  })

  it('lets the badge and the bell see one another\'s reads', () => {
    // Both components subscribe; marking read anywhere must reach both,
    // which is the whole reason this is not component-local state.
    const badge = vi.fn()
    const bell = vi.fn()
    subscribeToReadKeys(badge)
    subscribeToReadKeys(bell)

    addReadKeys(['announcement:a'])

    expect(badge).toHaveBeenCalledTimes(1)
    expect(bell).toHaveBeenCalledTimes(1)
    expect(badge.mock.calls[0][0].has('announcement:a')).toBe(true)
    expect(bell.mock.calls[0][0].has('announcement:a')).toBe(true)
  })

  it('publishes a new Set each time, so React sees the change', () => {
    // Mutating the same Set in place would leave useState holding an
    // identical reference and skip the re-render — the badge would go
    // stale again, which is the bug we are fixing.
    const before = getReadKeys()
    addReadKeys(['announcement:a'])
    expect(getReadKeys()).not.toBe(before)
  })

  it('rolls a failed write back off the read set', () => {
    addReadKeys(['announcement:a', 'announcement:b'])
    removeReadKeys(['announcement:a'])
    expect(getReadKeys().has('announcement:a')).toBe(false)
    expect(getReadKeys().has('announcement:b')).toBe(true)
  })

  it('clears on reset, so signing in as someone else inherits nothing', () => {
    addReadKeys(['announcement:a'])
    resetReadKeys()
    expect(getReadKeys().size).toBe(0)
  })

  it('stops notifying a listener that unsubscribed', () => {
    const gone = vi.fn()
    subscribeToReadKeys(gone)()
    addReadKeys(['announcement:a'])
    expect(gone).not.toHaveBeenCalled()
  })

  it('keeps publishing to the rest when one listener throws', () => {
    const good = vi.fn()
    subscribeToReadKeys(() => { throw new Error('unmounted component') })
    subscribeToReadKeys(good)
    expect(() => addReadKeys(['announcement:a'])).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
  })
})

describe('the badge, end to end', () => {
  it('drops to zero after the section is opened and stays there', () => {
    const announcements = [
      { type: 'announcement', id: 'a' },
      { type: 'announcement', id: 'b' },
    ]
    expect(unreadCount(announcements, getReadKeys())).toBe(2)

    // Opening the section marks them read.
    addReadKeys(announcements.map(notifKey))
    expect(unreadCount(announcements, getReadKeys())).toBe(0)

    // Re-opening does not resurrect them.
    addReadKeys(announcements.map(notifKey))
    expect(unreadCount(announcements, getReadKeys())).toBe(0)
  })

  it('counts only the new one when an announcement is posted after a read', () => {
    const first = [{ type: 'announcement', id: 'a' }]
    addReadKeys(first.map(notifKey))

    const withNewOne = [...first, { type: 'announcement', id: 'b' }]
    expect(unreadCount(withNewOne, getReadKeys())).toBe(1)
  })
})
