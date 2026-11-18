'use client'
import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase'
import { useOnline } from '@/lib/useOnline'
import Image from 'next/image'
import Link from 'next/link'
import { LogOut, Search, ChevronLeft, ChevronRight, Pin, PinOff, X, User, Settings, HelpCircle } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { createPortal } from 'react-dom'
import styles from './dashboard-sidebar.module.css'
import { lockBodyScroll } from '@/lib/modalScrollLock'
import { useHydrated } from '@/lib/useHydrated'
import { PHONE_LAYOUT, isPhoneLayout } from '@/lib/layout'

const mobileQuery = PHONE_LAYOUT
function subscribeMobile(onChange) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getMobile = () => window.matchMedia(mobileQuery).matches
const getServerMobile = () => false

// localStorage wrapped in try/catch because storage throws in some
// private modes / locked-down webviews.
function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// Saved pins for one user: a de-duplicated list of nav keys, [] if unreadable.
function readPins(pinKey) {
  try {
    const saved = JSON.parse(storageGet(pinKey))
    return Array.isArray(saved) ? [...new Set(saved.filter(key => typeof key === 'string'))] : []
  } catch {
    return []
  }
}

// The signed-in user's avatar colour, by role (kit.py sidebar()).
const ROLE_COLORS = {
  'Resident': 'var(--brand-strong)',
  'Barangay Official': '#F97316',
  'Tanod': 'var(--ok)',
}

// "Juan Dela Cruz" → "JD"
function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * One nav entry. Icons are BH360 icons (components/icons/BhIcons): outline
 * normally, solid when active. The count sits on the right, red only when
 * the item is overdue (badge: 'OVERDUE').
 */
function NavItem({ item, active, open, onClick }) {
  const { label, icon: Icon, count, hasNew, badge } = item
  const overdue = badge === 'OVERDUE'
  return (
    <button
      onClick={onClick}
      title={!open ? `${label}${count > 0 ? ` (${count})` : ''}` : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={!open ? `${label}${count > 0 ? `, ${count}` : ''}${overdue ? ', overdue' : ''}` : undefined}
      className={`${styles.navButton} ${active ? styles.active : ''}`}>
      <span className={styles.navIcon}>
        {/* BH360 icons take `active` (solid); a lucide fallback doesn't. */}
        {Icon.bh ? <Icon size={18} active={active} /> : <Icon size={18} strokeWidth={1.9} aria-hidden="true" />}
        {!open && (count > 0 || hasNew) && <span className={`${styles.railDot} ${overdue ? styles.railDotDanger : ''}`} aria-hidden="true" />}
      </span>
      {open && (
        <>
          <span className={styles.navLabel}>{label}</span>
          {badge && !overdue && <span className={styles.navBadge}>{badge}</span>}
          {count > 0 ? (
            <span className={`${styles.count} ${overdue ? styles.countDanger : ''}`}>
              {count}{overdue && <span className="sr-only">, overdue</span>}
            </span>
          ) : hasNew ? <span className={styles.newDot} aria-label="New" /> : null}
        </>
      )}
    </button>
  )
}

export default function DashboardSidebar({
  profile,
  sidebarOpen,
  setSidebarOpen,
  activeSection,
  setActiveSection,
  navItems,
  roleLabel = 'User',
}) {
  const supabase = useMemo(() => createClient(), [])
  const [search, setSearch] = useState('')
  // Pins and the user they belong to: { key: pinKey, items: [...] }
  const [pinState, setPinState] = useState({ key: null, items: [] })
  const hydrated = useHydrated()
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Remember which photo url failed, so a new photo gets a fresh try.
  const [failedAvatar, setFailedAvatar] = useState(null)
  const avatarFailed = failedAvatar != null && failedAvatar === profile?.avatar_url
  const sidebarRef = useRef(null)
  const searchRef = useRef(null)
  const isMobile = useSyncExternalStore(subscribeMobile, getMobile, getServerMobile)
  // The footer status dot reflects the real connection state.
  const online = useOnline()

  // Pins are stored per-user so accounts on a shared device don't
  // inherit each other's shortcuts.
  const pinKey = `sidebar-pinned-${profile?.id || 'anon'}`

  // Load this user's pins the first time the sidebar renders for them in
  // the browser (the server render and hydration show none, so the markup
  // matches). Adjusted while rendering, so there is no effect to re-run.
  if (hydrated && pinState.key !== pinKey) {
    setPinState({ key: pinKey, items: readPins(pinKey) })
  }
  const pinned = pinState.key === pinKey ? pinState.items : []


  // Keep keyboard focus inside the open mobile drawer and restore it on close.
  useEffect(() => {
    if (!sidebarOpen || !isMobile) return
    const previousFocus = document.activeElement
    const unlock = lockBodyScroll()
    sidebarRef.current?.querySelector('[data-close-navigation]')?.focus()
    const onKey = (e) => {
      // The sign-out dialog owns the keyboard while it is open.
      if (document.querySelector('[role="alertdialog"]')) return
      if (e.key === 'Escape') { e.preventDefault(); setSearch(''); setSidebarOpen(false) }
      if (e.key !== 'Tab') return
      const controls = [...(sidebarRef.current?.querySelectorAll('button:not(:disabled), input, a[href], [tabindex="0"]') || [])]
        .filter(element => element.tabIndex >= 0 && !element.hidden)
      const first = controls[0], last = controls[controls.length - 1]
      const outside = !sidebarRef.current?.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || outside)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || outside)) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus()
        else document.querySelector('[aria-label="Open sidebar"]')?.focus()
      })
    }
  }, [sidebarOpen, isMobile, setSidebarOpen])

  async function confirmLogout() {
    if (signingOut) return
    setSigningOut(true)
    // Close the dialog BEFORE navigating — mobile browsers snapshot the page
    // into the back-forward cache at unload, and an open dialog in that
    // snapshot is what made Back resurrect the confirm prompt.
    setLogoutConfirm(false)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      // Network down mid-signout: still clear the local session so the
      // device is signed out even if the server call never landed
      console.error('Sign out failed, clearing local session:', err)
      try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ignore */ }
    }
    // replace, not href: removes the dashboard from history so Back
    // can't return to a signed-out session.
    window.location.replace('/login')
  }

  function navClick(key) {
    setSearch('')
    setActiveSection(key)
    if (isPhoneLayout()) setSidebarOpen(false)
  }

  function togglePin(key, e) {
    e.stopPropagation()
    e.preventDefault()
    const validKeys = new Set(navItems.flatMap(s => s.items.map(item => item.key)))
    // Prune keys that no longer exist in the nav (role change, removed
    // sections) so stale pins don't live in storage forever
    const cleaned = pinned.filter(k => validKeys.has(k))
    const next = cleaned.includes(key) ? cleaned.filter(k => k !== key) : [...cleaned, key]
    setPinState({ key: pinKey, items: next })
    storageSet(pinKey, JSON.stringify(next))
  }

  // Filter nav items by search ("Find a page" lives in the phone drawer only)
  const q = isMobile ? search.trim().toLowerCase() : ''
  const filteredNavItems = navItems.map(section => ({
    ...section,
    items: section.items.filter(item => !q || item.label.toLowerCase().includes(q)),
  })).filter(s => s.items.length > 0)

  // Pinned items as a flat list, in the order they were pinned
  const pinnedItems = pinned
    .map(key => navItems.flatMap(s => s.items).find(item => item.key === key))
    .filter(Boolean)

  const avatarColor = ROLE_COLORS[roleLabel] || 'var(--brand-strong)'
  const open = sidebarOpen

  return (
    <>
    <aside ref={sidebarRef} id="dashboard-navigation" className={`sidebar ${styles.sidebar} ${open ? `open ${styles.isOpen}` : styles.isClosed}`}
      role={isMobile && open ? 'dialog' : undefined}
      aria-modal={isMobile && open ? true : undefined}
      inert={isMobile && !open ? true : undefined}
      aria-label="Dashboard navigation">

      {/* Logo and barangay. Collapsed: the logo expands the sidebar. */}
      <div className={styles.brand}>
        <button
          onClick={() => !open && setSidebarOpen(true)}
          className={styles.logo}
          aria-label={open ? 'BarangayHub 360' : 'Expand sidebar'}
          aria-expanded={open}
          title={!open ? 'Expand sidebar' : undefined}
          tabIndex={open ? -1 : 0}>
          <Image src="/logo.png" alt="" fill sizes="32px" loading="eager" className="object-contain" />
        </button>
        {open && (
          <div className="min-w-0 flex-1">
            <p className={styles.appName}>BarangayHub 360</p>
            <p className={styles.place}>{profile?.barangays?.name || 'Portal'}</p>
          </div>
        )}
        {open && (
          <button type="button" data-close-navigation onClick={() => { setSearch(''); setSidebarOpen(false) }} aria-label={isMobile ? 'Close navigation' : 'Collapse sidebar'} aria-expanded={true} aria-controls="dashboard-navigation"
            className={styles.iconButton}>
            {isMobile ? <X size={18} strokeWidth={1.9} /> : <ChevronLeft size={18} strokeWidth={1.9} />}
          </button>
        )}
      </div>

      <div className={styles.scrollArea}>
      {/* Find a page: phone drawer only. */}
      {open && isMobile && (
        <div className={styles.searchRow}>
          <div className="relative">
            <Search size={16} strokeWidth={1.9} className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch('') }
                // Enter jumps straight to the first match — filter, hit
                // Enter, you're there, no mouse needed
                if (e.key === 'Enter') {
                  const first = filteredNavItems[0]?.items[0]
                  if (first) { navClick(first.key); setSearch('') }
                }
              }}
              placeholder="Find a page…"
              aria-label="Filter navigation items"
              className={styles.search}
            />
            {search && <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus() }} aria-label="Clear navigation filter" className={styles.clearSearch}><X size={16} /></button>}
          </div>
        </div>
      )}

      {/* Pinned */}
      {open && pinnedItems.length > 0 && !q && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Pinned</p>
          {pinnedItems.map(item => (
            <div key={`pinned-${item.key}`} className={styles.navRow}>
              <NavItem item={item} active={activeSection === item.key} open onClick={() => navClick(item.key)} />
            </div>
          ))}
        </div>
      )}

      {/* Main navigation */}
      <nav aria-label="Main" className={styles.nav}>
        {filteredNavItems.map(({ section, items }) => (
          <div key={section} className={styles.group}>
            {open ? <p className={styles.groupLabel}>{section}</p> : <span className={styles.railRule} aria-hidden="true" />}
            {items.map(item => {
              const isPinned = pinned.includes(item.key)
              return (
                <div key={item.key} className={styles.navRow}>
                  <NavItem item={item} active={activeSection === item.key} open={open} onClick={() => navClick(item.key)} />
                  {/* A separate pin control (not nested in the nav button),
                      so it works on touch and keyboards. */}
                  {open && (
                    <button
                      onClick={(e) => togglePin(item.key, e)}
                      aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label} to top`}
                      aria-pressed={isPinned}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                      className={styles.pinButton}>
                      {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {open && search && filteredNavItems.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[13px] text-muted-foreground" role="status">No pages match “{search}”.</p>
            <button onClick={() => setSearch('')} className="mt-2 text-[13px] font-bold text-brand-strong">
              Clear search
            </button>
          </div>
        )}
      </nav>

      {/* Phone drawer: the account pages (the desktop band has an account menu). */}
      {open && isMobile && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Account</p>
          <Link href="/profile" className={styles.navButton}><span className={styles.navIcon}><User size={18} strokeWidth={1.9} /></span><span className={styles.navLabel}>My profile</span></Link>
          <Link href="/settings" className={styles.navButton}><span className={styles.navIcon}><Settings size={18} strokeWidth={1.9} /></span><span className={styles.navLabel}>Settings</span></Link>
          <Link href="/help" className={styles.navButton}><span className={styles.navIcon}><HelpCircle size={18} strokeWidth={1.9} /></span><span className={styles.navLabel}>Help</span></Link>
        </div>
      )}
      </div>

      {/* The signed-in user and sign out */}
      <div className={styles.footer}>
        {open ? (
          <div className={styles.user}>
            <span className={styles.avatar} style={{ background: avatarColor }}>
              {profile?.avatar_url && !avatarFailed ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover"
                  onError={() => setFailedAvatar(profile?.avatar_url)} />
              ) : initialsOf(profile?.full_name)}
              <span className={styles.online} style={{ background: online ? 'var(--ok)' : 'var(--text-muted)' }}
                title={online ? 'Online' : 'Offline — changes may not sync'} />
            </span>
            <div className="flex-1 min-w-0">
              <p className={styles.userName}>{profile?.full_name}</p>
              <p className={styles.userRole}>{roleLabel}{!online && ' · Offline'}</p>
            </div>
            <button onClick={() => setLogoutConfirm(true)} aria-label="Sign out" disabled={signingOut}
              className={styles.signOut} title="Sign out">
              <LogOut size={16} strokeWidth={1.9} />
            </button>
          </div>
        ) : (
          <div className={styles.railFooter}>
            <button onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar" title="Expand sidebar" className={styles.signOut}>
              <ChevronRight size={16} strokeWidth={1.9} />
            </button>
            <button onClick={() => setLogoutConfirm(true)} aria-label="Sign out" disabled={signingOut}
              className={styles.signOut} title="Sign out">
              <LogOut size={16} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </div>

      </aside>

      {typeof document !== 'undefined' && createPortal(
        <ConfirmDialog
          open={logoutConfirm}
          onClose={() => setLogoutConfirm(false)}
          onConfirm={confirmLogout}
          title="Sign out?"
          message="Are you sure you want to sign out? You'll need to log in again to access your dashboard."
          confirmText={signingOut ? 'Signing out...' : 'Yes, Sign Out'}
          cancelText="Stay Signed In"
          variant="logout"
        />,
        document.body
      )}

      {open && (
        <div
          className={styles.scrim}
          onClick={() => { setSearch(''); setSidebarOpen(false) }}
          aria-hidden="true"
        />
      )}
    </>
  )
}
