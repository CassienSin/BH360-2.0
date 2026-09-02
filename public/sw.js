// The runtime cache is deliberately NOT versioned. Next's asset URLs are
// content-hashed, so a stale entry is unreachable rather than wrong, and
// RUNTIME_MAX bounds the growth. Versioning it meant every worker update
// threw away the chunks the offline page itself needs — so right after an
// update, the one page that has to work offline was the one that could not.
const CACHE_NAME = 'bh360-runtime'
const STATIC_CACHE = 'bh360-static-v5'

// The runtime cache grew without limit before: every page a person visited
// stayed forever. A phone with little free space is exactly the device this
// app is installed on.
const RUNTIME_MAX = 60

// Files to cache for offline use
const STATIC_FILES = [
  '/',
  '/login',
  '/register',
  '/offline',
  '/logo.png',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
]

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // One at a time, not addAll: addAll is all-or-nothing, so a single
      // missing icon used to throw away the whole precache — including
      // /offline, the one file that has to be there when nothing else is.
      return Promise.all(STATIC_FILES.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('[SW] Could not cache', url, err)
        })
      ))
    })
  )
  // No skipWaiting() here. Taking over mid-session lets a new worker serve
  // assets the running page was not built against. The new worker waits for
  // the next load, unless a page explicitly asks it to take over.
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests and external requests
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  // Skip Supabase and API calls (they need fresh data)
  if (request.url.includes('/api/') || request.url.includes('supabase')) return

  // Skip Next.js dev server hot reload
  if (request.url.includes('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(async (cache) => {
            await cache.put(request, responseClone)
            // Oldest out first once the cache is full. Crude, but it keeps
            // an installed app from quietly eating a phone's storage.
            const keys = await cache.keys()
            if (keys.length > RUNTIME_MAX) {
              await Promise.all(keys.slice(0, keys.length - RUNTIME_MAX).map(k => cache.delete(k)))
            }
          })
        }
        return response
      })
      .catch(() => {
        // Network failed - try cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // A page we cannot serve should say so, not drop someone onto
          // the landing screen with no explanation.
          //
          // Redirect rather than serving /offline's HTML at the requested
          // URL: the App Router hydrates against the address bar, so handing
          // it one route's markup under another route's URL trips the error
          // boundary — which is how "no connection" ended up rendering as
          // "we hit a snag". After the redirect the URL and the payload
          // agree, and the page can offer to retry where they were going.
          if (request.mode === 'navigate') {
            const url = new URL(request.url)
            if (url.pathname !== '/offline') {
              const target = new URL('/offline', self.location.origin)
              target.searchParams.set('from', url.pathname + url.search)
              return Response.redirect(target.toString(), 302)
            }
            return caches.match('/offline')
          }
        })
      })
  )
})

// ============================================================================
// PUSH NOTIFICATIONS
//
// This is what makes a notification arrive when BH360 is CLOSED. Everything
// in lib/notifications.js fires from inside a Supabase Realtime callback,
// which only exists while a page is open — close the tab and the websocket
// goes with it. A push is delivered by the browser's own push service to
// this service worker, which runs with no page at all.
// ============================================================================

self.addEventListener('push', (event) => {
  // A push with no readable payload still has to show something: the spec
  // requires a visible notification for every push (userVisibleOnly), and
  // browsers show their own "This site has been updated in the background"
  // if we do not.
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'BarangayHub 360', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'BarangayHub 360'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/favicon-32.png',
    // tag collapses repeats of the same event — a critical incident pushed
    // to a tanod who also has the page open should not stack up twice.
    tag: payload.tag,
    renotify: Boolean(payload.tag) && payload.priority === 'Critical',
    requireInteraction: payload.priority === 'Critical',
    vibrate: payload.priority === 'Critical' ? [200, 100, 200, 100, 200] : [100],
    timestamp: payload.timestamp ? Date.parse(payload.timestamp) : Date.now(),
    data: { url: payload.url || '/', ...payload.data },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Tapping a notification.
//
// lib/notifications.js has always claimed this handler existed. It did not —
// so on Android Chrome, where `new Notification()` throws and the code falls
// back to registration.showNotification(), tapping a notification did
// nothing at all. Android is most of the people using this.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Prefer focusing a tab that is already open — opening a second copy
      // of the dashboard is a worse answer than bringing the first forward.
      for (const client of clientList) {
        const sameOrigin = client.url.startsWith(self.location.origin)
        if (sameOrigin && 'focus' in client) {
          if ('navigate' in client && new URL(client.url).pathname !== target) {
            return client.navigate(target).then((c) => c && c.focus())
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    })
  )
})

// A subscription can be rotated by the push service without the user doing
// anything. Without this the endpoint we stored goes dead silently and the
// device simply stops receiving anything.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))
    })
  )
})
