'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Menu, Bell, Search, User, Settings, LogOut, ChevronDown, AlertTriangle, FileText, X, Clock, ArrowRight, HelpCircle, Sparkles } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { timeAgo } from '@/lib/timeAgo'

// Extracted so the 1-second tick re-renders only this tiny component,
// not the whole header (including the search modal and dropdowns).
function LiveClock() {
  const [now, setNow] = useState(null)
  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  if (!now) return null
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
      <Clock size={12} className="text-gray-400" />
      <span className="text-xs font-bold text-gray-600">
        {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </span>
    </div>
  )
}

const roleConfig = {
  resident: { label: 'Resident', color: '#5B54E8', bg: '#f0effe' },
  official: { label: 'Barangay Official', color: '#f97316', bg: '#fff7ed' },
  tanod: { label: 'Tanod', color: '#22c55e', bg: '#f0fdf4' },
}

export default function DashboardHeader({
  profile,
  sidebarOpen,
  setSidebarOpen,
  sectionTitle,
  sectionDesc,
  notifications = [],
  searchData = { incidents: [], tickets: [], announcements: [] },
  onNotificationClick,
  onSearchResultClick,
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [isMac, setIsMac] = useState(false)

  const searchRef = useRef(null)
  const notifRef = useRef(null)
  const userMenuRef = useRef(null)
  const searchInputRef = useRef(null)
  const resultsRef = useRef(null)

  useEffect(() => {
    // Show ⌘K on Macs instead of Ctrl+K
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setHighlighted(0)
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
        setNotifOpen(false)
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
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
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
    await supabase.auth.signOut()
    window.location.href = '/login'
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
  // walk through. The footer already ADVERTISED ↑↓/↵ navigation; now
  // it actually exists.
  const flatResults = useMemo(() => ([
    ...filteredResults.incidents.map(item => ({ type: 'incidents', item })),
    ...filteredResults.tickets.map(item => ({ type: 'tickets', item })),
    ...filteredResults.announcements.map(item => ({ type: 'announcements', item })),
  ]), [filteredResults])

  const totalResults = flatResults.length
  const ticketsOffset = filteredResults.incidents.length
  const announcementsOffset = ticketsOffset + filteredResults.tickets.length

  // Reset the highlight when the result set changes
  useEffect(() => { setHighlighted(0) }, [searchQuery])

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

  const unreadCount = notifications.length
  const rc = roleConfig[profile?.role] || roleConfig.resident

  // Shared row renderer keeps highlight styling consistent
  function resultRow({ idx, icon, iconStyle, title, subtitle, onClick, key }) {
    const isHighlighted = idx === highlighted
    return (
      <button key={key} data-idx={idx}
        onClick={onClick}
        onMouseEnter={() => setHighlighted(idx)}
        className="w-full px-5 py-3 flex items-center gap-3 transition-colors text-left"
        style={{ background: isHighlighted ? '#faf5ff' : 'transparent' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={iconStyle}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        </div>
        <ArrowRight size={12} className={isHighlighted ? 'text-purple-400' : 'text-gray-300'} />
      </button>
    )
  }

  return (
    <>
      <header className="bg-white sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
        style={{
          boxShadow: '0 2px 12px rgba(91,84,232,0.06)',
          borderBottom: '1px solid #f0effe',
        }}>

        {/* LEFT SIDE — Menu + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {!sidebarOpen && (
            <>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open sidebar"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
                <Menu size={18} />
              </button>
              <div className="h-9 w-px hidden sm:block" style={{ background: '#f0effe' }} />
            </>
          )}

          <div className="min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.5px' }}>
                  {sectionTitle}
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700">LIVE</span>
                </div>
              </div>
              {profile?.barangays ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-500 truncate">
                    <span className="font-semibold text-gray-700">{profile.barangays.name}</span>
                    <span className="text-gray-300 mx-1">·</span>
                    <span>{profile.barangays.city}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 truncate mt-0.5">{sectionDesc}</p>
              )}
            </div>
          </div>
        </div>

        {/* CENTER — Search bar */}
        <button onClick={openSearch} aria-label="Open search"
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl flex-1 max-w-md transition-all hover:bg-gray-50"
          style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-400 flex-1 text-left">Search anything...</span>
          <kbd className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5"
            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>

        {/* RIGHT SIDE — Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          <LiveClock />

          {/* Mobile search */}
          <button onClick={openSearch} aria-label="Open search"
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <Search size={16} />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} pending` : ''}`}
              aria-expanded={notifOpen}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Bell size={16} />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </>
              )}
            </button>

            {notifOpen && (
              <div className="fixed sm:absolute right-3 sm:right-0 top-[64px] sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-80 sm:max-w-none rounded-2xl overflow-hidden fade-up z-50"
                style={{ background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff' }}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100"
                  style={{ background: '#fafaff' }}>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
                    <p className="text-xs text-gray-400">{unreadCount} pending {unreadCount === 1 ? 'item' : 'items'}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: '#fef2f2', color: '#dc2626' }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {unreadCount === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: '#f0fdf4' }}>
                        <Bell size={20} className="text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                      <p className="text-xs text-gray-400 mt-0.5">No pending notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notif, i) => (
                      <button
                        key={notif.id ?? `notif-${i}`}
                        onClick={() => {
                          onNotificationClick?.(notif)
                          setNotifOpen(false)
                        }}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 text-left">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                          style={{ background: notif.color || '#fff7ed' }}>
                          {notif.icon || '⚠️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.subtitle}</p>
                          {notif.created_at && (
                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                          )}
                        </div>
                        <ArrowRight size={12} className="text-gray-300 flex-shrink-0 mt-1" />
                      </button>
                    ))
                  )}
                </div>

                {unreadCount > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100" style={{ background: '#fafaff' }}>
                    <p className="text-[10px] text-gray-400 text-center">Click any notification to view details</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="Account menu" aria-expanded={userMenuOpen} aria-haspopup="menu"
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 2px 8px rgba(91,84,232,0.3)' }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile?.full_name || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.[0]?.toUpperCase()
                )}
              </div>
              <ChevronDown size={12} className={`text-gray-400 hidden sm:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="fixed sm:absolute right-3 sm:right-0 top-[64px] sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-64 rounded-2xl overflow-hidden fade-up z-50"
                style={{ background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff' }}>

                {/* User info */}
                <div className="px-4 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #fafaff, white)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)' }}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile?.full_name || 'Avatar'} className="w-full h-full object-cover" />
                      ) : (
                        profile?.full_name?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{profile?.full_name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5"
                        style={{ background: rc.bg, color: rc.color }}>
                        {rc.label}
                      </span>
                    </div>
                  </div>
                  {profile?.barangays && (
                    <div className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg text-xs"
                      style={{ background: '#f0effe', color: '#5B54E8' }}>
                      <span>📍</span>
                      <span className="font-semibold truncate">{profile.barangays.name}</span>
                    </div>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-2">
                  <button onClick={() => { router.push('/profile'); setUserMenuOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                    <User size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">My Profile</span>
                  </button>
                  <button onClick={() => { router.push('/settings'); setUserMenuOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                    <Settings size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">Settings</span>
                  </button>
                  <button onClick={() => { router.push('/help'); setUserMenuOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                    <HelpCircle size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">Help & Support</span>
                  </button>
                </div>

                <div className="py-2 border-t border-gray-100">
                  <button onClick={handleLogout}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 transition-colors text-left group">
                    <LogOut size={14} className="text-red-400 group-hover:text-red-500" />
                    <span className="text-sm font-semibold text-red-500">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SEARCH MODAL */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
          <div ref={searchRef} role="dialog" aria-modal="true" aria-label="Search"
            className="w-full max-w-2xl rounded-3xl overflow-hidden fade-up"
            style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search incidents, tickets, announcements..."
                aria-label="Search"
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              />
              <kbd className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: '#f0effe', color: '#5B54E8' }}>
                ESC
              </kbd>
              <button onClick={closeSearch} aria-label="Close search"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto" ref={resultsRef}>
              {!searchQuery && (
                <div className="px-5 py-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: '#f0effe' }}>
                    <Sparkles size={20} style={{ color: '#5B54E8' }} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Quick Search</p>
                  <p className="text-xs text-gray-400 mt-1">Type to search across all your barangay data</p>
                  <div className="mt-5 flex items-center justify-center gap-2 flex-wrap text-xs text-gray-400">
                    <span className="px-2 py-1 rounded-lg" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>incidents</span>
                    <span className="px-2 py-1 rounded-lg" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>tickets</span>
                    <span className="px-2 py-1 rounded-lg" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>announcements</span>
                  </div>
                </div>
              )}

              {searchQuery && totalResults === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No results for "{searchQuery}"</p>
                  <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                </div>
              )}

              {filteredResults.incidents.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{ background: '#fafaff' }}>
                    Incidents ({filteredResults.incidents.length})
                  </p>
                  {filteredResults.incidents.map((inc, i) => resultRow({
                    key: `inc-${inc.id}`,
                    idx: i,
                    icon: <AlertTriangle size={14} className="text-orange-500" />,
                    iconStyle: { background: '#fff7ed' },
                    title: inc.title,
                    subtitle: `📍 ${inc.location} · ${inc.status}`,
                    onClick: () => selectResult('incidents', inc),
                  }))}
                </div>
              )}

              {filteredResults.tickets.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{ background: '#fafaff' }}>
                    Tickets ({filteredResults.tickets.length})
                  </p>
                  {filteredResults.tickets.map((t, i) => resultRow({
                    key: `tkt-${t.id}`,
                    idx: ticketsOffset + i,
                    icon: <FileText size={14} className="text-white" />,
                    iconStyle: { background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' },
                    title: t.title,
                    subtitle: `Status: ${t.status}`,
                    onClick: () => selectResult('tickets', t),
                  }))}
                </div>
              )}

              {filteredResults.announcements.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{ background: '#fafaff' }}>
                    Announcements ({filteredResults.announcements.length})
                  </p>
                  {filteredResults.announcements.map((a, i) => resultRow({
                    key: `ann-${a.id}`,
                    idx: announcementsOffset + i,
                    icon: <Bell size={14} className="text-white" />,
                    iconStyle: { background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' },
                    title: a.title,
                    subtitle: a.content,
                    onClick: () => selectResult('announcements', a),
                  }))}
                </div>
              )}
            </div>

            {searchQuery && totalResults > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between" style={{ background: '#fafaff' }}>
                <p className="text-xs text-gray-400">{totalResults} {totalResults === 1 ? 'result' : 'results'} found</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'white', border: '1px solid #e5e7eb' }}>↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'white', border: '1px solid #e5e7eb' }}>↵</kbd>
                    select
                  </span>
                </div>
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
        confirmText="Yes, Sign Out"
        cancelText="Stay Signed In"
        variant="logout"
      />
    </>
  )
}