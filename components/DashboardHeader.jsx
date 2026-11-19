'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Menu, Search, User, Settings, LogOut, X, ArrowRight, HelpCircle } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import NotificationBell from '@/components/NotificationBell'
import LiveClock from '@/components/LiveClock'
import Band from '@/components/crafted/Band'
import { IncidentsIcon, TicketsIcon, AnnouncementsIcon } from '@/components/icons/BhIcons'
import { useBrowserValue } from '@/lib/useHydrated'
import styles from './dashboard-header.module.css'

// Avatar with graceful fallback to the initials when the image URL is
// missing or fails to load (deleted storage file, broken link).
function HeaderAvatar({ src, name, className, style }) {
  // Remember WHICH url failed: a new url gets a fresh try with no reset effect.
  const [failedSrc, setFailedSrc] = useState(null)
  const failed = failedSrc != null && failedSrc === src
  const initials = (name || '').trim().split(/\s+/).filter(Boolean).map((w, i, a) => (i === 0 || i === a.length - 1 ? w[0] : '')).join('').toUpperCase()
  return (
    <span className={className} style={style}>
      {src && !failed ? (
        <img src={src} alt="" className="w-full h-full object-cover"
          onError={() => setFailedSrc(src)} />
      ) : (
        initials || '?'
      )}
    </span>
  )
}

const roleConfig = {
  resident: { label: 'Resident', color: 'var(--brand-strong)' },
  official: { label: 'Barangay Official', color: '#F97316' },
  tanod: { label: 'Tanod', color: 'var(--ok)' },
}

// One search result. A component (not a helper called during render), so
// its click handler is plainly an event handler.
function ResultRow({ idx, highlighted, onHighlight, icon, title, subtitle, onClick }) {
  const isHighlighted = idx === highlighted
  return (
    <button data-idx={idx} id={`search-result-${idx}`} role="option" aria-selected={isHighlighted}
      onClick={onClick}
      onMouseEnter={() => onHighlight(idx)}
      className={`${styles.result} ${isHighlighted ? styles.resultActive : ''}`}>
      <span className={styles.resultIcon} aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-ink truncate">{title}</span>
        <span className="block text-xs text-muted-foreground truncate">{subtitle}</span>
      </span>
      <ArrowRight size={14} className={isHighlighted ? 'text-brand-strong' : 'text-muted-foreground'} aria-hidden="true" />
    </button>
  )
}

/**
 * The top of a dashboard's main column, drawn on the purple band
 * (DESIGN.md §3–4). It lives inside the scrolling <main>, so the first
 * card below it overlaps the band.
 *
 * Desktop: the context line (barangay, city · time), search, the bell and
 *          the account menu; then the eyebrow, the title, a subtitle and
 *          the section's actions.
 * Phone:   a menu button (opens the drawer), the title, search and the bell.
 *
 * `children` go under the title on both layouts (a segmented control, a
 * card that sits on the band…). `heading` replaces the title block on both
 * layouts (the resident Home greeting); the phone bar then shows
 * `phoneTitle` as plain text. `columnClass` keeps the header in the same
 * column as a centred section (resident, tanod).
 */
export default function DashboardHeader({
  profile,
  sidebarOpen,
  setSidebarOpen,
  sectionTitle,
  sectionDesc,
  eyebrow,
  actions,
  heading,
  phoneTitle,
  children,
  columnClass = '',
  bandExtend,
  bandFade,
  notificationCenter,
  searchData = { incidents: [], tickets: [], announcements: [] },
  onSearchResultClick,
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Show ⌘K on Macs instead of Ctrl K (Ctrl K on the server and first paint)
  const isMac = useBrowserValue(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), false)

  const searchRef = useRef(null)
  const userMenuRef = useRef(null)
  const searchInputRef = useRef(null)
  const resultsRef = useRef(null)
  const searchTriggerRef = useRef(null) // element to restore focus to on close


  function openSearch() {
    // Remember what was focused so Escape puts the keyboard user back
    // where they were instead of dropping focus to <body>
    searchTriggerRef.current = document.activeElement
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setHighlighted(0)
    if (searchTriggerRef.current?.focus) {
      searchTriggerRef.current.focus()
      searchTriggerRef.current = null
    }
  }

  // Cmd/Ctrl+K shortcut + Escape
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
      if (e.key === 'Escape') {
        closeSearch()
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) closeSearch()
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock page scroll while the search modal is open
  useEffect(() => {
    if (!searchOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [searchOpen])

  function handleLogout() {
    setLogoutConfirm(true)
    setUserMenuOpen(false)
  }

  async function confirmLogout() {
    if (signingOut) return
    setSigningOut(true)
    // Close the dialog BEFORE navigating — the back-forward cache snapshots
    // the page at unload, and an open dialog in that snapshot is what made
    // Back resurrect the confirm prompt.
    setLogoutConfirm(false)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      // Network down mid-signout: still clear the local session so the
      // device is signed out even if the server call never landed
      console.error('Sign out failed, clearing local session:', err)
      try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ignore */ }
    }
    // replace, not href: removes this page from history so Back can't
    // return to a signed-out dashboard.
    window.location.replace('/login')
  }

  // Search filter — lowercase the query once, not eight times per item
  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return { incidents: [], tickets: [], announcements: [] }
    return {
      incidents: searchData.incidents.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q)
      ).slice(0, 5),
      tickets: searchData.tickets.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      ).slice(0, 5),
      announcements: searchData.announcements.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.content?.toLowerCase().includes(q)
      ).slice(0, 5),
    }
  }, [searchQuery, searchData])

  // Flat list of results in render order — this is what the arrow keys
  // walk through.
  const flatResults = useMemo(() => ([
    ...filteredResults.incidents.map(item => ({ type: 'incidents', item })),
    ...filteredResults.tickets.map(item => ({ type: 'tickets', item })),
    ...filteredResults.announcements.map(item => ({ type: 'announcements', item })),
  ]), [filteredResults])

  const totalResults = flatResults.length
  const ticketsOffset = filteredResults.incidents.length
  const announcementsOffset = ticketsOffset + filteredResults.tickets.length

  // Keep the highlighted row in view while arrowing through a long list
  useEffect(() => {
    if (!searchOpen || !resultsRef.current) return
    resultsRef.current.querySelector(`[data-idx="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, searchOpen])

  function selectResult(type, item) {
    onSearchResultClick?.(type, item)
    closeSearch()
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, totalResults - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = flatResults[highlighted]
      if (target) selectResult(target.type, target.item)
    }
  }


  const rc = roleConfig[profile?.role] || roleConfig.resident
  const place = profile?.barangays
    ? [profile.barangays.name, profile.barangays.city].filter(Boolean).join(', ')
    : sectionDesc

  return (
    <>
      <header className={styles.header}>
        <Band seed={2} extend={bandExtend} fade={bandFade} />
        <div className={`${styles.inner} ${columnClass}`}>
          <div className={styles.topbar}>
            {/* Phone: the drawer holds the other sections, profile, settings,
                help and sign out. */}
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open sidebar"
              aria-expanded={false} aria-controls="dashboard-navigation" className={`${styles.onband} ${styles.phoneOnly}`}>
              <Menu size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
            {heading
              ? <p className={styles.phoneTitle}>{phoneTitle ?? sectionTitle}</p>
              : <h1 className={styles.phoneTitle}>{sectionTitle}</h1>}

            <p className={styles.context}>
              {place}
              <span className={styles.clock}><span aria-hidden="true"> · </span><LiveClock variant="inline" /></span>
            </p>

            <button type="button" onClick={openSearch} aria-label="Open search" className={styles.searchPill}>
              <Search size={16} strokeWidth={1.9} aria-hidden="true" />
              <span className={styles.searchText}>Search reports, people…</span>
              <kbd className={styles.kbd}>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <button type="button" onClick={openSearch} aria-label="Open search" className={`${styles.onband} ${styles.phoneOnly}`}>
              <Search size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>

            {/* Notifications: rows the database writes for this person
                (lib/useNotifications, supabase/setup.sql Section 18). The
                bell itself is unchanged; only its slot is styled. */}
            <div className={styles.bellSlot}>
              <NotificationBell center={notificationCenter} sizeClass="w-10 h-10" />
            </div>

            {/* Account menu (desktop; on phones the drawer has these). */}
            <div className={`relative ${styles.deskOnly}`} ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="Account menu" aria-expanded={userMenuOpen} aria-haspopup="menu"
                className={styles.accountButton}>
                <HeaderAvatar src={profile?.avatar_url} name={profile?.full_name} className={styles.avatar}
                  style={{ background: rc.color }} />
              </button>

              {userMenuOpen && (
                <div role="menu" aria-label="Account" className={styles.menu}>
                  <div className={styles.menuHead}>
                    <HeaderAvatar src={profile?.avatar_url} name={profile?.full_name} className={styles.avatarLg}
                      style={{ background: rc.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{rc.label}{profile?.barangays?.name ? ` · ${profile.barangays.name}` : ''}</p>
                    </div>
                  </div>
                  <div className={styles.menuGroup}>
                    <button role="menuitem" onClick={() => { router.push('/profile'); setUserMenuOpen(false) }} className={styles.menuItem}>
                      <User size={16} strokeWidth={1.9} aria-hidden="true" /> My profile
                    </button>
                    <button role="menuitem" onClick={() => { router.push('/settings'); setUserMenuOpen(false) }} className={styles.menuItem}>
                      <Settings size={16} strokeWidth={1.9} aria-hidden="true" /> Settings
                    </button>
                    <button role="menuitem" onClick={() => { router.push('/help'); setUserMenuOpen(false) }} className={styles.menuItem}>
                      <HelpCircle size={16} strokeWidth={1.9} aria-hidden="true" /> Help
                    </button>
                  </div>
                  <div className={styles.menuGroup}>
                    <button role="menuitem" onClick={handleLogout} disabled={signingOut} className={styles.menuItem}>
                      <LogOut size={16} strokeWidth={1.9} aria-hidden="true" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {heading ? <div className={styles.customHeading}>{heading}</div> : (
          <div className={styles.heading}>
            <div className="min-w-0 flex-1">
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
              <h1 className={styles.deskTitle}>{sectionTitle}</h1>
              {sectionDesc && profile?.barangays && <p className={styles.sub}>{sectionDesc}</p>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
          </div>
          )}

          {children}
        </div>
      </header>

      {/* SEARCH */}
      {searchOpen && (
        <div className={styles.searchScrim}>
          <div ref={searchRef} role="dialog" aria-modal="true" aria-label="Search" className={styles.searchPanel}>

            <div className={styles.searchInputRow}>
              <Search size={18} strokeWidth={1.9} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setHighlighted(0) }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search incidents, tickets, announcements…"
                aria-label="Search"
                role="combobox"
                aria-expanded={totalResults > 0}
                aria-controls="search-results"
                aria-autocomplete="list"
                aria-activedescendant={totalResults > 0 ? `search-result-${highlighted}` : undefined}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-muted-foreground"
              />
              <kbd className={styles.kbdPage}>Esc</kbd>
              <button onClick={closeSearch} aria-label="Close search" className={styles.closeButton}>
                <X size={16} strokeWidth={1.9} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto" ref={resultsRef} id="search-results" role="listbox" aria-label="Search results">
              {!searchQuery && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-bold text-ink">Search this barangay</p>
                  <p className="text-[13px] text-muted-foreground mt-1">Type a title, a street or a few words from a report, ticket or announcement.</p>
                </div>
              )}

              {searchQuery && totalResults === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-ink">No results for &quot;{searchQuery}&quot;</p>
                  <p className="text-[13px] text-muted-foreground mt-1">Try a different word.</p>
                </div>
              )}

              {filteredResults.incidents.length > 0 && (
                <div>
                  <p className={styles.groupLabel}>Incidents · {filteredResults.incidents.length}</p>
                  {filteredResults.incidents.map((inc, i) => (
                    <ResultRow
                      key={`inc-${inc.id}`}
                      idx={i}
                      icon={<IncidentsIcon size={18} />}
                      title={inc.title}
                      subtitle={[inc.location, inc.status].filter(Boolean).join(' · ')}
                      onClick={() => selectResult('incidents', inc)}
                      highlighted={highlighted}
                      onHighlight={setHighlighted}
                    />
                  ))}
                </div>
              )}

              {filteredResults.tickets.length > 0 && (
                <div>
                  <p className={styles.groupLabel}>Tickets · {filteredResults.tickets.length}</p>
                  {filteredResults.tickets.map((t, i) => (
                    <ResultRow
                      key={`tkt-${t.id}`}
                      idx={ticketsOffset + i}
                      icon={<TicketsIcon size={18} />}
                      title={t.title}
                      subtitle={`Status: ${t.status}`}
                      onClick={() => selectResult('tickets', t)}
                      highlighted={highlighted}
                      onHighlight={setHighlighted}
                    />
                  ))}
                </div>
              )}

              {filteredResults.announcements.length > 0 && (
                <div>
                  <p className={styles.groupLabel}>Announcements · {filteredResults.announcements.length}</p>
                  {filteredResults.announcements.map((a, i) => (
                    <ResultRow
                      key={`ann-${a.id}`}
                      idx={announcementsOffset + i}
                      icon={<AnnouncementsIcon size={18} />}
                      title={a.title}
                      subtitle={a.content}
                      onClick={() => selectResult('announcements', a)}
                      highlighted={highlighted}
                      onHighlight={setHighlighted}
                    />
                  ))}
                </div>
              )}
            </div>

            {searchQuery && totalResults > 0 && (
              <div className={styles.searchFoot}>
                <p className="text-xs text-muted-foreground" aria-live="polite">{totalResults} {totalResults === 1 ? 'result' : 'results'}</p>
                <p className="text-xs text-muted-foreground"><kbd className={styles.kbdPage}>↑↓</kbd> move · <kbd className={styles.kbdPage}>↵</kbd> open</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Sign out?"
        message="Are you sure you want to sign out? You'll need to log in again to access your dashboard."
        confirmText={signingOut ? 'Signing out...' : 'Yes, Sign Out'}
        cancelText="Stay Signed In"
        variant="logout"
      />
    </>
  )
}
