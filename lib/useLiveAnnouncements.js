'use client'
import { useEffect, useRef } from 'react'

const POLL_MS = 60_000

/**
 * Calls onNew(announcement) once for every announcement that goes live in
 * this barangay while the page is open.
 *
 * Why not a plain realtime INSERT listener: an announcement is saved with
 * published_at a minute ahead (the official's undo window), and row-level
 * security hides it from residents until then. Realtime checks that policy
 * at the moment of the insert, so residents were never sent the event and
 * only saw the announcement after a refresh. Three things now cover it:
 *   1. the official's page saves the row again when the undo window closes,
 *      which realtime does deliver (an UPDATE, now visible);
 *   2. a quiet re-check every minute and whenever the tab comes back, for
 *      when the official closed their tab before the window closed;
 *   3. the INSERT event still counts, for anything posted without a delay.
 */
export function useLiveAnnouncements(supabase, barangayId, onNew) {
  const onNewRef = useRef(onNew)
  useEffect(() => { onNewRef.current = onNew })

  useEffect(() => {
    if (!supabase || !barangayId) return
    let cancelled = false
    const seen = new Set()
    // Only announcements published after this page opened are "new"; the
    // page's own first load already shows the older ones.
    const since = new Date().toISOString()

    function deliver(row) {
      if (cancelled || !row?.id || seen.has(row.id)) return
      const published = row.published_at ? new Date(row.published_at).getTime() : Date.now()
      if (published < new Date(since).getTime()) return   // an older one being edited
      if (published > Date.now() + 5000) return            // still inside the undo window
      seen.add(row.id)
      onNewRef.current?.(row)
    }

    async function check() {
      const { data, error } = await supabase.from('announcements')
        .select('*')
        .eq('barangay_id', barangayId)
        .gte('published_at', since)
        .order('published_at', { ascending: true })
        .limit(20)
      if (!error) (data || []).forEach(deliver)
    }

    const channel = supabase
      .channel(`live-announcements-${barangayId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'announcements', filter: `barangay_id=eq.${barangayId}`,
      }, (payload) => {
        if (payload.eventType !== 'DELETE') deliver(payload.new)
      })
      .subscribe()

    const timer = setInterval(check, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [supabase, barangayId])
}
