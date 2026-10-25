'use client'
import { useCallback, useState } from 'react'
import { useHydrated } from '@/lib/useHydrated'
import { useMediaQuery } from '@/lib/useMediaQuery'

const KEY = 'sidebarOpen'
const DESKTOP = '(min-width: 768px)'

// localStorage throws in some private-browsing modes; a failed read is
// "no saved preference", a failed write is simply not remembered.
function readSaved() {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

/**
 * The dashboard sidebar's open state, shared by the resident, tanod and
 * official dashboards.
 *
 * - Desktop: the user's last choice, remembered across visits.
 * - Phone: always starts closed, and opening the drawer is never saved
 *   (saving the phone's auto-close used to overwrite the desktop choice).
 * - Crossing the breakpoint (rotating a tablet, resizing a window) shows
 *   the right state for the new size without touching the saved choice.
 * - Server render and hydration use `serverDefault`, so the markup the
 *   server sent always matches the first browser render.
 */
export function useSidebarState(serverDefault = true) {
  const hydrated = useHydrated()
  const isDesktop = useMediaQuery(DESKTOP, true)
  const [desktopOpen, setDesktopOpen] = useState(() => (typeof window === 'undefined' ? true : readSaved()))
  const [mobileOpen, setMobileOpen] = useState(false)

  const open = !hydrated ? serverDefault : isDesktop ? desktopOpen : mobileOpen

  const setOpen = useCallback((value) => {
    if (window.matchMedia(DESKTOP).matches) {
      setDesktopOpen(value)
      try { localStorage.setItem(KEY, String(value)) } catch { /* not remembered */ }
    } else {
      setMobileOpen(value)
    }
  }, [])

  return [open, setOpen]
}
