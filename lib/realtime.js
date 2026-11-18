/**
 * Live updates (Supabase Realtime) that wait for the signed-in session.
 *
 * A channel sends its access token when it joins, and the database checks
 * every change it would deliver against that token's row-level security. On
 * a full page load (a refresh, a typed URL, opening a push notification) a
 * component's effect usually runs before the browser client has read the
 * session, so a channel joined straight away goes in as a signed-out
 * visitor: RLS hides every row and the page never updates until the next
 * reload. Moving between pages inside the app hid this, because the session
 * was already loaded by then.
 *
 * Use it in place of .subscribe(), and call what it returns from the
 * effect's cleanup in place of removeChannel:
 *
 *   const channel = supabase.channel('name').on('postgres_changes', …, handler)
 *   const leave = subscribeWhenSignedIn(supabase, channel)
 *   return () => leave()
 *
 * A component that goes away before the token has loaded never joins.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('@supabase/supabase-js').RealtimeChannel} channel
 * @param {(status: string, err?: Error) => void} [onStatus]  passed to subscribe()
 * @returns {() => Promise<unknown>} leave: removes the channel
 */
export function subscribeWhenSignedIn(supabase, channel, onStatus) {
  let left = false

  Promise.resolve()
    // With no argument, setAuth reads the current session's token (or the
    // anon key when signed out) and hands it to every channel's join.
    .then(() => supabase.realtime.setAuth())
    .catch((err) => {
      // Join anyway: with whatever token the client has, the page still
      // gets the updates RLS allows, as it did before this wait existed.
      console.error('Realtime: could not load the session before joining:', err)
    })
    .then(() => {
      if (!left) channel.subscribe(onStatus)
    })

  return () => {
    left = true
    return supabase.removeChannel(channel)
  }
}
