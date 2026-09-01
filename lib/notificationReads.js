'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Which notifications this person has already seen.
 *
 * The sidebar badge and the header bell are separate components that both
 * need this answer, and they have to agree: opening Announcements should
 * clear the sidebar count AND the bell dot, not one of them. So the read
 * markers live in one module-level store that every caller subscribes to,
 * rather than each component fetching its own copy and drifting.
 *
 * Backed by the notification_reads table, so a marker survives a reload and
 * follows the person to their other devices.
 */

// Stable key per notification. Type is part of it so an announcement id and
// an incident id that happen to match cannot collide.
export function notifKey(n) {
  return `${n?.type || 'notif'}:${n?.id}`
}

/** How many of these has the person NOT seen yet. */
export function unreadCount(items, readKeys) {
  if (!items?.length || !readKeys) return 0
  let count = 0
  for (const item of items) {
    if (!readKeys.has(notifKey(item))) count += 1
  }
  return count
}

/* ---------------------------------------------------------------------- */

let readKeys = new Set()
let loadedFor = null
const listeners = new Set()

function publish(next) {
  readKeys = next
  for (const fn of listeners) {
    try { fn(readKeys) } catch { /* one bad listener must not stop the rest */ }
  }
}

export function getReadKeys() {
  return readKeys
}

export function subscribeToReadKeys(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Signing in as someone else must not inherit the last person's markers. */
export function resetReadKeys() {
  loadedFor = null
  publish(new Set())
}

export function addReadKeys(keys) {
  const next = new Set(readKeys)
  for (const k of keys) next.add(k)
  publish(next)
}

export function removeReadKeys(keys) {
  const next = new Set(readKeys)
  for (const k of keys) next.delete(k)
  publish(next)
}

/* ---------------------------------------------------------------------- */

export function useNotificationReads(profileId) {
  const supabase = useMemo(() => createClient(), [])
  const [keys, setKeys] = useState(getReadKeys)

  // setState happens in the subscription callback, not in the effect body.
  useEffect(() => subscribeToReadKeys(setKeys), [])

  useEffect(() => {
    if (!profileId) return
    if (loadedFor === profileId) return
    if (loadedFor !== null) resetReadKeys()

    let cancelled = false
    loadedFor = profileId
    supabase
      .from('notification_reads')
      .select('notif_key')
      .eq('user_id', profileId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Let a later mount retry rather than caching a failed load as
          // "this user has read nothing", which would re-badge everything.
          loadedFor = null
          console.error('Failed to load read markers:', error)
          return
        }
        publish(new Set(data.map(r => r.notif_key)))
      })
    return () => { cancelled = true }
  }, [profileId, supabase])

  const isRead = useCallback(n => keys.has(notifKey(n)), [keys])

  /**
   * Mark one or many as read. Optimistic: the badge clears at once and the
   * write follows, rolling back if it fails so the UI never claims a read
   * state that would not survive a reload.
   */
  const markRead = useCallback(async (input) => {
    if (!profileId) return
    const items = Array.isArray(input) ? input : [input]
    const fresh = [...new Set(
      items.map(notifKey).filter(k => !getReadKeys().has(k))
    )]
    if (fresh.length === 0) return

    addReadKeys(fresh)
    const { error } = await supabase.from('notification_reads').upsert(
      fresh.map(k => ({ user_id: profileId, notif_key: k })),
      { onConflict: 'user_id,notif_key' }
    )
    if (error) {
      console.error('Failed to mark notification read:', error)
      removeReadKeys(fresh)
    }
  }, [profileId, supabase])

  return { readKeys: keys, isRead, markRead }
}
