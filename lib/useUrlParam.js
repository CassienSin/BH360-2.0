'use client'
import { useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * A panel kept open by a query parameter (`/tanod?assignment=<id>`), the
 * same URL-state pattern as useUrlSection: refresh and deep links reopen
 * it, and the phone's Back button closes it.
 *
 * open(value) pushes a history entry. close() steps Back when this page
 * pushed that entry, so Back and the panel's own close button agree; on a
 * deep link (nothing to step back to) it replaces the URL instead.
 *
 * Callers must sit inside a <Suspense> boundary (useSearchParams).
 *
 * @param {string} param the query-string key
 * @returns {[string | null, (value: string) => void, () => void]}
 */
export function useUrlParam(param) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pushedHere = useRef(false)
  const value = searchParams.get(param)

  const urlWith = useCallback(next => {
    const params = new URLSearchParams(window.location.search)
    if (next == null) params.delete(param)
    else params.set(param, next)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [param, pathname])

  const open = useCallback(next => {
    if (new URLSearchParams(window.location.search).get(param) === next) return
    pushedHere.current = true
    router.push(urlWith(next), { scroll: false })
  }, [router, urlWith, param])

  const close = useCallback(() => {
    if (pushedHere.current) {
      pushedHere.current = false
      router.back()
    } else {
      router.replace(urlWith(null), { scroll: false })
    }
  }, [router, urlWith])

  return [value, open, close]
}
