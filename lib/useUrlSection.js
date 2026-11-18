'use client'
import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Which section/tab of a page is showing, kept in the URL
 * (`/official?section=incidents`, `/admin?tab=users`) instead of in
 * component state.
 *
 * Why: state is lost on refresh, so every reload used to drop the user back
 * on the default section. With the URL as the source of truth:
 * - refresh and deep links land on the same section,
 * - the phone/browser Back button steps back through sections (push),
 * - the default section keeps a clean URL (`/official`, no query).
 *
 * Unknown or missing values fall back to `fallback`, so a stale or hand-typed
 * link can never render an empty page.
 *
 * Callers must sit inside a <Suspense> boundary: Next requires one around
 * useSearchParams on prerendered routes or the production build fails.
 *
 * @param {readonly string[]} sections allowed values — keep it a module-level constant
 * @param {string} fallback           the default section
 * @param {{ param?: string, history?: 'push' | 'replace' }} [opts]
 *   param   — query-string key (default 'section')
 *   history — 'push' (default) makes Back step through sections; 'replace'
 *             suits in-page tabs where Back should leave the page
 * @returns {[string, (key: string, opts?: { replace?: boolean }) => void]}
 */
export function useUrlSection(sections, fallback, { param = 'section', history = 'push' } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const raw = searchParams.get(param)
  const active = raw && sections.includes(raw) ? raw : fallback

  const setActive = useCallback((key, { replace = history === 'replace' } = {}) => {
    if (!sections.includes(key)) key = fallback
    // Read the live query string so other params (filters, ?from=) survive.
    const params = new URLSearchParams(window.location.search)
    const current = params.get(param) || fallback
    if (current === key) return // no duplicate history entries

    if (key === fallback) params.delete(param)
    else params.set(param, key)
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    // scroll:false — the dashboards scroll their own <main>, not the window.
    if (replace) router.replace(url, { scroll: false })
    else router.push(url, { scroll: false })
  }, [router, pathname, sections, fallback, param, history])

  return [active, setActive]
}

/** Build a link straight to a section, e.g. sectionHref('/official', 'calendar'). */
export function sectionHref(base, key, param = 'section') {
  return key ? `${base}?${param}=${encodeURIComponent(key)}` : base
}
