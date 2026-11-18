'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * A notification opened from a push lands with ?nid=<its id> on the URL
 * (lib/notificationTypes.js notificationHref). Mark that row read, on
 * whichever page it opened, and take the parameter back off the address so
 * a refresh or a shared link does not carry it.
 *
 * Mounted once in the root layout. A push tap is a full page load, so a
 * mount-time check is enough; links inside the app mark read before they
 * navigate and never carry ?nid.
 */
export default function NotificationLinkReader() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const nid = url.searchParams.get('nid')
    if (!nid) return
    url.searchParams.delete('nid')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    createClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', nid)
      .is('read_at', null)
      .then(({ error }) => { if (error) console.error('Could not mark the notification read:', error) })
  }, [])
  return null
}
