'use client'
import { useCallback, useState } from 'react'
import { useHydrated } from '@/lib/useHydrated'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { DESK_LAYOUT, SIDEBAR_OPEN_BY_DEFAULT } from '@/lib/layout'

const KEY = 'sidebarOpen'

// The saved desktop choice: true / false, or null for "never chose" (then
// the width decides). localStorage throws in some private-browsing modes; a
// failed read is "no saved preference", a failed write is simply not
// remembered.
function readSaved() {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? null : v === 'true'
  } catch {
    return null
  }
}

/**
 * The dashboard sidebar's open state, shared by the resident, tanod and
 * official dashboards.
 *
 * - Desktop: the user's last choice, remembered across visits. With none
 *   yet, open from 1024px up and collapsed to icons on tablets
 *   (lib/layout.js). The boot script in lib/dashboardSkeletons.js mirrors
 *   this so the loading skeleton has the same width.
 * - Phone layout (narrow, or a phone held sideways): always starts closed, and opening the drawer is never saved
 *   (saving the phone's auto-close used to overwrite the desktop choice).
 * - Crossing the breakpoint (rotating a tablet, resizing a window) shows
 *   the right state for the new size without touching the saved choice.
 * - Server render and hydration use `serverDefault`, so the markup the
 *   server sent always matches the first browser render.
 */
export function useSidebarState(serverDefault = true) {
  const hydrated = useHydrated()
  const isDesktop = useMediaQuery(DESK_LAYOUT, true)
  const wideByDefault = useMediaQuery(SIDEBAR_OPEN_BY_DEFAULT, true)
  const [desktopChoice, setDesktopOpen] = useState(() => (typeof window === 'undefined' ? null : readSaved()))
  const [mobileOpen, setMobileOpen] = useState(false)
  const desktopOpen = desktopChoice ?? wideByDefault

  const open = !hydrated ? serverDefault : isDesktop ? desktopOpen : mobileOpen

  const setOpen = useCallback((value) => {
    if (window.matchMedia(DESK_LAYOUT).matches) {
      setDesktopOpen(value)
      try { localStorage.setItem(KEY, String(value)) } catch { /* not remembered */ }
    } else {
      setMobileOpen(value)
    }
  }, [])

  return [open, setOpen]
}
