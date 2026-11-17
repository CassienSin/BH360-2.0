import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BOOT_SCRIPT, DASHBOARD_SKELETONS, dashboardKinds, dashboardColumn } from '../dashboardSkeletons'

/**
 * Runs the boot script against a fake browser and returns the attributes it
 * put on <html> and whether it added the render-blocking link.
 *   url        — the page URL
 *   desktop    — whether the desktop layout query matches (lib/layout.js)
 *   wide       — whether (min-width: 1024px) matches
 *   saved      — localStorage 'sidebarOpen' (null = never set)
 *   permission — Notification.permission, or null for no Notification API
 *   dismissed  — sessionStorage 'notif-banner-dismissed'
 *   storageThrows — localStorage/sessionStorage throw (private mode)
 */
function boot({ url, desktop = true, wide = true, saved = null, permission = 'default', dismissed = null, storageThrows = false }) {
  const attrs = {}
  const links = []
  const storage = (value) => ({
    getItem: () => { if (storageThrows) throw new Error('blocked'); return value },
  })
  const window = {}
  if (permission) window.Notification = { permission }
  const document = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v } },
    createElement: () => ({ setAttribute(k, v) { this[k] = v } }),
    head: { appendChild: (el) => links.push(el) },
  }
  const { pathname, search } = new URL(url, 'https://bh360.test')
  // The script reads browser globals; `in window` resolves against `window`.
  new Function('document', 'location', 'localStorage', 'sessionStorage', 'matchMedia', 'window', 'URLSearchParams',
    `with (window) { ${BOOT_SCRIPT} }`)(
    document, { pathname, search }, storage(saved), storage(dismissed),
    (q) => ({ matches: q.includes('1024px') ? wide : desktop }), window, URLSearchParams,
  )
  return { attrs, links }
}

describe('BOOT_SCRIPT', () => {
  it('picks the skeleton for the section in the URL', () => {
    expect(boot({ url: '/official?section=incidents' }).attrs['data-skeleton']).toBe('records')
    expect(boot({ url: '/official?section=users' }).attrs['data-skeleton']).toBe('table')
    expect(boot({ url: '/resident?section=ai' }).attrs['data-skeleton']).toBe('launcher')
    expect(boot({ url: '/tanod?section=stats' }).attrs['data-skeleton']).toBe('analytics')
  })

  it("falls back to the dashboard's home for a missing or unknown section", () => {
    expect(boot({ url: '/official' }).attrs['data-skeleton']).toBe('overview')
    expect(boot({ url: '/resident?section=nope' }).attrs['data-skeleton']).toBe('overview')
  })

  it('follows the saved sidebar width on desktop only (matches useSidebarState)', () => {
    expect(boot({ url: '/official', saved: 'false' }).attrs['data-sidebar']).toBe('closed')
    expect(boot({ url: '/official', saved: 'true' }).attrs['data-sidebar']).toBe('open')
    expect(boot({ url: '/official', saved: null }).attrs['data-sidebar']).toBe('open')
    // Phones: the drawer always starts closed, which the skeleton draws as no sidebar.
    expect(boot({ url: '/official', saved: 'false', desktop: false }).attrs['data-sidebar']).toBe('open')
  })

  it('starts collapsed on tablets when nothing is saved (matches useSidebarState)', () => {
    expect(boot({ url: '/official', wide: false }).attrs['data-sidebar']).toBe('closed')
    expect(boot({ url: '/official', wide: false, saved: 'true' }).attrs['data-sidebar']).toBe('open')
    expect(boot({ url: '/official', wide: true }).attrs['data-sidebar']).toBe('open')
  })

  it('predicts the notification banner like NotificationBanner does', () => {
    expect(boot({ url: '/official', permission: 'default' }).attrs['data-banner']).toBe('ask')
    expect(boot({ url: '/official', permission: 'denied' }).attrs['data-banner']).toBe('denied')
    expect(boot({ url: '/official', permission: 'granted' }).attrs['data-banner']).toBeUndefined()
    expect(boot({ url: '/official', dismissed: 'true' }).attrs['data-banner']).toBeUndefined()
    expect(boot({ url: '/official', permission: null }).attrs['data-banner']).toBeUndefined()
  })

  it('holds the first paint until the skeleton is parsed, on dashboards only', () => {
    const { links } = boot({ url: '/tanod' })
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ rel: 'expect', href: '#dash-shell-end', blocking: 'render' })
  })

  it('marks app pages, and holds the paint on the static standalone pages', () => {
    const profile = boot({ url: '/profile?tab=security' })
    expect(profile.attrs['data-app']).toBe('')
    expect(profile.attrs['data-skeleton']).toBeUndefined()
    expect(profile.attrs['data-banner']).toBeUndefined()
    expect(profile.links.map(l => l.href)).toEqual(['#page-shell-end'])
    // A dynamic detail page: app frame on the canvas, but no paint hold.
    const detail = boot({ url: '/official/incident/abc' })
    expect(detail.attrs['data-app']).toBe('')
    expect(detail.links).toHaveLength(0)
  })

  it('leaves the public pages alone apart from the sidebar width', () => {
    for (const url of ['/', '/login', '/register', '/officialish']) {
      const { attrs, links } = boot({ url })
      expect(attrs['data-app'], url).toBeUndefined()
      expect(attrs['data-skeleton'], url).toBeUndefined()
      expect(links, url).toHaveLength(0)
    }
  })

  it('never throws when storage is blocked', () => {
    const { attrs } = boot({ url: '/official?section=map', storageThrows: true })
    expect(attrs['data-sidebar']).toBe('open')
    expect(attrs['data-skeleton']).toBe('launcher')
  })
})

describe('DASHBOARD_SKELETONS', () => {
  const css = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8')

  it('only uses skeleton kinds the CSS can show', () => {
    for (const path of Object.keys(DASHBOARD_SKELETONS)) {
      for (const kind of dashboardKinds(path)) {
        expect(css, `${path} → ${kind}`).toContain(`html[data-skeleton='${kind}'] .dash-shell-variant[data-kind='${kind}']`)
      }
    }
  })

  it("lists each dashboard's home kind first (shown when the boot script can't run)", () => {
    expect(dashboardKinds('/official')[0]).toBe('overview')
    expect(dashboardKinds('/tanod')[0]).toBe('overview')
  })

  it('gives resident and tanod sections their centred column', () => {
    expect(dashboardColumn('/official', 'records')).toBe('')
    expect(dashboardColumn('/resident', 'overview')).toBe('max-w-4xl 2xl:max-w-5xl')
    expect(dashboardColumn('/resident', 'records')).toBe('max-w-3xl 2xl:max-w-6xl')
    expect(dashboardColumn('/resident', 'launcher')).toBe('max-w-3xl')
    expect(dashboardColumn('/tanod', 'records')).toBe('max-w-2xl')
    expect(dashboardColumn('/tanod', 'analytics')).toBe('max-w-3xl')
  })
})
