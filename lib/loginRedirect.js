import { dashboardPath } from '@/lib/roles'

// Pages every signed-in role may return to after logging in.
const SHARED = ['/profile', '/settings', '/help']

function within(path, base) {
  return path === base || path.startsWith(base + '/') || path.startsWith(base + '?')
}

/**
 * '/login?next=<where the user is now>', so that signing in again after a
 * session expires lands them back on the same page and section instead of
 * the default dashboard. Call it only from the browser.
 */
export function loginHref() {
  if (typeof window === 'undefined') return '/login'
  const here = window.location.pathname + window.location.search
  if (here === '/' || within(here, '/login')) return '/login'
  return `/login?next=${encodeURIComponent(here)}`
}

/**
 * Where to send a user who just signed in. Honours ?next= only when it's a
 * same-site path inside their own role's area (or a shared page), so a
 * crafted link can't redirect off-site or drop a resident on /official.
 */
export function postLoginPath(profile, search = typeof window === 'undefined' ? '' : window.location.search) {
  const home = dashboardPath(profile)
  let next = null
  try {
    const raw = new URLSearchParams(search).get('next')
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) {
      // Resolve it the way the browser will, so '/official/../admin' is
      // checked as '/admin', and anything that escapes to another origin
      // is dropped.
      const base = 'http://bh360.invalid'
      const url = new URL(raw, base)
      if (url.origin === base) next = url.pathname + url.search
    }
  } catch { /* malformed: ignore */ }
  if (next && (within(next, home) || SHARED.some(b => within(next, b)))) return next
  return home
}
