'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Menu, Bell, Search, User, Settings, LogOut, ChevronDown, AlertTriangle, FileText, X, Clock, ArrowRight, HelpCircle, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import { timeAgo } from '@/lib/timeAgo'

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
  const supabase = createClient()

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(null)
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  const searchRef = useRef(null)
  const notifRef = useRef(null)
  const userMenuRef = useRef(null)
  const searchInputRef = useRef(null)

  // Live clock — only start on client to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Cmd+K shortcut
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
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
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setLogoutConfirm(true)
    setUserMenuOpen(false)
  }

  async function confirmLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Search filter
  const filteredResults = searchQuery ? {
    incidents: searchData.incidents.filter(i =>
      i.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.location?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5),
    tickets: searchData.tickets.filter(t =>
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5),
    announcements: searchData.announcements.filter(a =>
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5),
  } : { incidents: [], tickets: [], announcements: [] }

  const totalResults = filteredResults.incidents.length + filteredResults.tickets.length + filteredResults.announcements.length
  const unreadCount = notifications.length

  const roleConfig = {
    resident: { label: 'Resident', color: '#5B54E8', bg: '#f0effe' },
    official: { label: 'Barangay Official', color: '#f97316', bg: '#fff7ed' },
    tanod: { label: 'Tanod', color: '#22c55e', bg: '#f0fdf4' },
  }
  const rc = roleConfig[profile?.role] || roleConfig.resident


  return (
    <>
      <header className="bg-white sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
        style={{
          boxShadow: '0 2px 12px rgba(91,84,232,0.06)',
          borderBottom: '1px solid #f0effe'
        }}>

        {/* LEFT SIDE — Menu + Title with breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!sidebarOpen && (
              <>
                <button onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
                  <Menu size={18} />
                </button>
                <div className="h-9 w-px hidden sm:block" style={{background: '#f0effe'}} />
              </>
            )}

            <div className="min-w-0 flex items-center gap-3">
              {/* Title block */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-800 truncate" style={{letterSpacing: '-0.5px'}}>
                    {sectionTitle}
                  </h1>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                    style={{background: '#f0fdf4', border: '1px solid #dcfce7'}}>
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
        <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl flex-1 max-w-md transition-all hover:bg-gray-50"
          style={{background: '#fafaff', border: '1px solid #f0effe'}}>
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-400 flex-1 text-left">Search anything...</span>
          <kbd className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5"
            style={{background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff'}}>
            Ctrl+K
          </kbd>
        </button>

        {/* RIGHT SIDE — Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Live clock — only render on client */}
            {currentTime && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-600">
                  {currentTime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            )}

          {/* Mobile search */}
          <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <Search size={16} />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)}
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
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden fade-up"
                style={{background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff'}}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100"
                  style={{background: '#fafaff'}}>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
                    <p className="text-xs text-gray-400">{unreadCount} pending {unreadCount === 1 ? 'item' : 'items'}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{background: '#fef2f2', color: '#dc2626'}}>
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {unreadCount === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                        style={{background: '#f0fdf4'}}>
                        <Bell size={20} className="text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                      <p className="text-xs text-gray-400 mt-0.5">No pending notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notif, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onNotificationClick?.(notif)
                          setNotifOpen(false)
                        }}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 text-left">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                          style={{background: notif.color || '#fff7ed'}}>
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
                  <div className="px-4 py-2 border-t border-gray-100" style={{background: '#fafaff'}}>
                    <p className="text-[10px] text-gray-400 text-center">Click any notification to view details</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 2px 8px rgba(91,84,232,0.3)'}}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.[0]?.toUpperCase()
                )}
              </div>
              <ChevronDown size={12} className={`text-gray-400 hidden sm:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl overflow-hidden fade-up"
                style={{background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff'}}>

                {/* User info */}
                <div className="px-4 py-4 border-b border-gray-100" style={{background: 'linear-gradient(135deg, #fafaff, white)'}}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        profile?.full_name?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{profile?.full_name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5"
                        style={{background: rc.bg, color: rc.color}}>
                        {rc.label}
                      </span>
                    </div>
                  </div>
                  {profile?.barangays && (
                    <div className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg text-xs"
                      style={{background: '#f0effe', color: '#5B54E8'}}>
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
                  <button onClick={() => { toast('Settings coming soon!', { icon: '⚙️' }); setUserMenuOpen(false) }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                    <Settings size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">Settings</span>
                  </button>
                  <button onClick={() => { toast('Help center coming soon!', { icon: '💡' }); setUserMenuOpen(false) }}
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
          style={{background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'}}>
          <div ref={searchRef} className="w-full max-w-2xl rounded-3xl overflow-hidden fade-up"
            style={{background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)'}}>

            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search incidents, tickets, announcements..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              />
              <kbd className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{background: '#f0effe', color: '#5B54E8'}}>
                ESC
              </kbd>
              <button onClick={() => setSearchOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!searchQuery && (
                <div className="px-5 py-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                    style={{background: '#f0effe'}}>
                    <Sparkles size={20} style={{color: '#5B54E8'}} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Quick Search</p>
                  <p className="text-xs text-gray-400 mt-1">Type to search across all your barangay data</p>
                  <div className="mt-5 flex items-center justify-center gap-2 flex-wrap text-xs text-gray-400">
                    <span className="px-2 py-1 rounded-lg" style={{background: '#fafaff', border: '1px solid #f0effe'}}>incidents</span>
                    <span className="px-2 py-1 rounded-lg" style={{background: '#fafaff', border: '1px solid #f0effe'}}>tickets</span>
                    <span className="px-2 py-1 rounded-lg" style={{background: '#fafaff', border: '1px solid #f0effe'}}>announcements</span>
                  </div>
                </div>
              )}

              {searchQuery && totalResults === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No results found</p>
                  <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                </div>
              )}

              {filteredResults.incidents.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{background: '#fafaff'}}>
                    Incidents ({filteredResults.incidents.length})
                  </p>
                  {filteredResults.incidents.map(inc => (
                    <button key={inc.id}
                      onClick={() => { onSearchResultClick?.('incidents', inc); setSearchOpen(false); setSearchQuery('') }}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background: '#fff7ed'}}>
                        <AlertTriangle size={14} className="text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                        <p className="text-xs text-gray-400 truncate">📍 {inc.location} · {inc.status}</p>
                      </div>
                      <ArrowRight size={12} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.tickets.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{background: '#fafaff'}}>
                    Tickets ({filteredResults.tickets.length})
                  </p>
                  {filteredResults.tickets.map(t => (
                    <button key={t.id}
                      onClick={() => { onSearchResultClick?.('tickets', t); setSearchOpen(false); setSearchQuery('') }}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <FileText size={14} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400 truncate">Status: {t.status}</p>
                      </div>
                      <ArrowRight size={12} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.announcements.length > 0 && (
                <div>
                  <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                    style={{background: '#fafaff'}}>
                    Announcements ({filteredResults.announcements.length})
                  </p>
                  {filteredResults.announcements.map(a => (
                    <button key={a.id}
                      onClick={() => { onSearchResultClick?.('announcements', a); setSearchOpen(false); setSearchQuery('') }}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <Bell size={14} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                        <p className="text-xs text-gray-400 truncate">{a.content}</p>
                      </div>
                      <ArrowRight size={12} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchQuery && totalResults > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between" style={{background: '#fafaff'}}>
                <p className="text-xs text-gray-400">{totalResults} {totalResults === 1 ? 'result' : 'results'} found</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{background: 'white', border: '1px solid #e5e7eb'}}>↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{background: 'white', border: '1px solid #e5e7eb'}}>↵</kbd>
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