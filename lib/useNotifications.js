'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { notify } from '@/components/Toast'
import { showNotification } from '@/lib/notifications'
import { groupNotifications, unreadTotal, notificationHref } from '@/lib/notificationTypes'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const LIMIT = 50

/**
 * This person's notifications: the rows the database writes for them
 * (supabase/setup.sql, Section 18), live.
 *
 * - Loads the latest 50; a realtime subscription filtered to their own rows
 *   adds new ones and follows read_at changes made on other devices.
 * - Re-fetches when the tab becomes visible or the connection returns, so a
 *   phone that slept through realtime events catches up.
 * - A new row shows a toast (and a system notification when the tab is in
 *   the background; it shares the push's tag, so the two collapse into
 *   one). `silentTypes` skips the toast for types a dashboard already
 *   alerts on in its own way (the official's incident siren, the tanod's
 *   dispatch alert, the resident's announcement toast).
 *
 * Returns the rows, the bell's grouped items, the unread count, and the
 * actions that change read_at.
 */
export function useNotifications(profileId, { silentTypes = [] } = {}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [rows, setRows] = useState([])
  // Ids already shown, kept outside state so a realtime INSERT can tell at
  // once whether it is new (state updaters run later, during render).
  const knownIds = useRef(new Set())

  const silentRef = useRef(silentTypes)
  useEffect(() => { silentRef.current = silentTypes })

  // Fetch (no state) and apply are separate so the effect below can start
  // the first load and only touch state once the rows arrive.
  const fetchRows = useCallback(() => supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(LIMIT), [profileId, supabase])

  const applyRows = useCallback(({ data, error }) => {
    if (error) {
      console.error('Could not load notifications:', error)
      return
    }
    for (const row of data || []) knownIds.current.add(row.id)
    setRows(data || [])
  }, [])

  const open = useCallback((row) => {
    router.push(row.link || '/')
  }, [router])
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open })

  // Writes read_at for these rows, showing the change at once.
  const markRead = useCallback(async (ids) => {
    const list = (ids || []).filter(Boolean)
    if (!list.length) return
    const now = new Date().toISOString()
    setRows(prev => prev.map(r => (list.includes(r.id) && !r.read_at ? { ...r, read_at: now } : r)))
    const { error } = await supabase.from('notifications').update({ read_at: now }).in('id', list).is('read_at', null)
    if (error) console.error('Could not mark notifications read:', error)
  }, [supabase])

  // Everything, including unread rows older than the 50 loaded.
  const markAllRead = useCallback(async () => {
    if (!profileId) return
    const now = new Date().toISOString()
    setRows(prev => prev.map(r => (r.read_at ? r : { ...r, read_at: now })))
    const { error } = await supabase.from('notifications').update({ read_at: now })
      .eq('user_id', profileId).is('read_at', null)
    if (error) console.error('Could not mark notifications read:', error)
  }, [profileId, supabase])

  useEffect(() => {
    if (!profileId) return

    function announce(row) {
      if (silentRef.current.includes(row.type)) return
      notify.info({
        title: row.title,
        body: row.body || '',
        id: `notification-${row.id}`,
        action: row.link ? { label: 'Open', onClick: () => openRef.current(row) } : undefined,
      })
      // Declines when the tab is in front, so it never doubles the toast.
      showNotification(row.title, {
        body: row.body || '',
        tag: row.group_key || row.id,
        data: { url: notificationHref(row) },
      })
    }

    const load = () => { fetchRows().then(applyRows) }
    load()
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new
          if (!row?.id || knownIds.current.has(row.id)) return
          knownIds.current.add(row.id)
          setRows(prev => [row, ...prev.filter(r => r.id !== row.id)].slice(0, LIMIT))
          announce(row)
        } else if (payload.eventType === 'UPDATE') {
          setRows(prev => prev.map(r => (r.id === payload.new.id ? { ...r, ...payload.new } : r)))
        } else if (payload.eventType === 'DELETE') {
          setRows(prev => prev.filter(r => r.id !== payload.old?.id))
        }
      })
    const leaveChannel = subscribeWhenSignedIn(supabase, channel)

    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    return () => {
      leaveChannel()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
    }
  }, [profileId, supabase, fetchRows, applyRows])

  const items = useMemo(() => groupNotifications(rows), [rows])
  const unread = useMemo(() => unreadTotal(rows), [rows])

  // Opening a bell item: mark everything it stands for, then go there.
  const openItem = useCallback((item) => {
    markRead(item.unreadIds)
    open(item.latest)
  }, [markRead, open])

  return { rows, items, unread, markRead, markAllRead, openItem }
}
