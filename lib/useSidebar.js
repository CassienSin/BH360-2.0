'use client'
import { useCallback, useEffect, useState } from 'react'

// localStorage can throw in some privacy modes
function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

const DESKTOP = '(min-width: 768px)'

/**
 * Collapsible dashboard sidebar state, shared by the official / tanod /
 * resident dashboards (each used to carry its own diverging copy).
 *
 * Behavior: start closed (so a mobile refresh never renders the drawer
 * open), then on mount restore the saved preference on desktop; after
 * that, only react when the viewport actually CROSSES the breakpoint —
 * reacting to every resize stomps the user's choice. Only the DESKTOP
 * preference is persisted; saving the mobile auto-close would poison the
 * stored value.
 */
export function useSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const desktop = window.matchMedia(DESKTOP)

    const applyFor = (isDesktop) => {
      if (!isDesktop) { setSidebarOpen(false); return }
      const saved = storageGet('sidebarOpen')
      setSidebarOpen(saved !== null ? saved === 'true' : true)
    }

    applyFor(desktop.matches)
    const onChange = (e) => applyFor(e.matches)
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (mounted && window.matchMedia(DESKTOP).matches) {
      storageSet('sidebarOpen', String(sidebarOpen))
    }
  }, [sidebarOpen, mounted])

  // On mobile the sidebar is an overlay — close it after a nav click.
  const closeOnMobile = useCallback(() => {
    if (!window.matchMedia(DESKTOP).matches) setSidebarOpen(false)
  }, [])

  return { sidebarOpen, setSidebarOpen, closeOnMobile }
}
