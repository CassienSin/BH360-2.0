'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { LogOut, Search, ChevronLeft, Pin, PinOff, Activity, TrendingUp, Zap } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { createPortal } from 'react-dom'

export default function DashboardSidebar({
  profile,
  sidebarOpen,
  setSidebarOpen,
  activeSection,
  setActiveSection,
  navItems,
  roleLabel = 'User',
  stats = [], // [{ label, value, color, key (optional - to navigate) }]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [pinned, setPinned] = useState([])
  const [hoveredItem, setHoveredItem] = useState(null)
  const navRef = useRef(null)
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  // Load pinned items from localStorage isn't allowed in artifacts; use in-memory only

 function handleLogout() {
    setLogoutConfirm(true)
  }

  async function confirmLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  function togglePin(key, e) {
    e.stopPropagation()
    setPinned(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  // Filter nav items by search
  const filteredNavItems = navItems.map(section => ({
    ...section,
    items: section.items.filter(item =>
      !search || item.label.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(s => s.items.length > 0)

  // Get all pinned items as flat list
  const pinnedItems = navItems
    .flatMap(s => s.items)
    .filter(item => pinned.includes(item.key))

  const roleColors = {
    'Resident': { gradient: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: '#5B54E8' },
    'Barangay Official': { gradient: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#f97316' },
    'Tanod': { gradient: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#22c55e' },
  }
  const rc = roleColors[roleLabel] || roleColors.Resident

  return (
    <>
    <aside className={`sidebar flex-shrink-0 flex flex-col bg-white ${sidebarOpen ? 'w-64 open' : 'w-16'}`}
      style={{boxShadow: '4px 0 24px rgba(91,84,232,0.1)',  height: '100dvh', overflow: 'hidden',}}>

      {/* Logo / Brand */}
      <div className={`flex items-center gap-3 px-4 py-4 ${!sidebarOpen && 'justify-center'}`}
        style={{borderBottom: '1px solid #f0effe'}}>
        <div className="w-9 h-9 relative flex-shrink-0">
          <Image src="/logo.png" alt="BH360" fill sizes="36px" loading="eager" className="object-contain" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-gray-800">BH360</p>
            <p className="text-xs text-gray-400 truncate">{profile?.barangays?.name || 'Portal'}</p>
          </div>
        )}
        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors hidden md:flex flex-shrink-0">
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Stats Card */}
      {sidebarOpen && stats.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="rounded-2xl p-3"
            style={{background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff'}}>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={11} style={{color: '#5B54E8'}} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{color: '#5B54E8'}}>
                Quick Stats
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stats.slice(0, 4).map((stat, i) => (
                <button key={i}
                  onClick={() => stat.key && navClick(stat.key)}
                  disabled={!stat.key}
                  className="text-left p-2 rounded-xl transition-all hover:scale-105 disabled:hover:scale-100"
                  style={{background: 'white', border: `1px solid ${stat.color}20`}}>
                  <p className="text-lg font-black leading-none" style={{color: stat.color}}>{stat.value}</p>
                  <p className="text-[10px] text-gray-500 mt-1 truncate">{stat.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {sidebarOpen && (
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Quick filter..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
              style={{background: '#fafaff', border: '1px solid #f0effe'}}
              onFocus={e => e.target.style.borderColor = '#5B54E8'}
              onBlur={e => e.target.style.borderColor = '#f0effe'}
            />
          </div>
        </div>
      )}

      {/* Pinned section */}
      {sidebarOpen && pinnedItems.length > 0 && !search && (
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5 text-gray-400 flex items-center gap-1">
            <Pin size={9} /> Pinned
          </p>
          <div className="space-y-0.5">
            {pinnedItems.map(({ key, label, icon: Icon, count, hasNew }) => (
              <button key={`pinned-${key}`} onClick={() => navClick(key)}
                className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeSection === key ? 'active-nav' : 'hover:bg-gray-50'}`}
                style={activeSection === key ? {
                  background: 'linear-gradient(135deg, rgba(91,84,232,0.12), rgba(124,117,240,0.06))',
                } : {}}>
                {activeSection === key && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{background: 'linear-gradient(180deg, #5B54E8, #7C75F0)', boxShadow: '0 0 12px rgba(91,84,232,0.5)'}} />
                )}
                <Icon size={15} style={{color: activeSection === key ? '#5B54E8' : '#9ca3af', flexShrink: 0}} />
                <span className="text-xs flex-1 text-left"
                  style={{color: activeSection === key ? '#5B54E8' : '#6b7280', fontWeight: activeSection === key ? 700 : 500}}>
                  {label}
                </span>
                {hasNew && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                    style={{
                      background: activeSection === key ? '#5B54E8' : '#ede9fe',
                      color: activeSection === key ? 'white' : '#5B54E8',
                    }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav ref={navRef} className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {filteredNavItems.map(({ section, items }) => (
          <div key={section}>
            {sidebarOpen && (
              <p className="text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5 text-gray-400 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                {section}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map(({ key, label, icon: Icon, count, hasNew, badge }) => {
                const isActive = activeSection === key
                const isPinned = pinned.includes(key)
                const isHovered = hoveredItem === key

                return (
                  <div key={key} className="relative">
                    <button
                      onClick={() => navClick(key)}
                      onMouseEnter={() => setHoveredItem(key)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${!sidebarOpen && 'justify-center'} ${isActive ? '' : 'hover:bg-gray-50'}`}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, rgba(91,84,232,0.12), rgba(124,117,240,0.06))',
                        boxShadow: '0 2px 8px rgba(91,84,232,0.08)',
                      } : {}}>

                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full"
                          style={{
                            background: 'linear-gradient(180deg, #5B54E8, #7C75F0)',
                            boxShadow: '0 0 16px rgba(91,84,232,0.6)'
                          }} />
                      )}

                      <div className="relative flex-shrink-0">
                        <Icon size={17} style={{color: isActive ? '#5B54E8' : '#9ca3af'}} />
                        {hasNew && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>

                      {sidebarOpen && (
                        <>
                          <span className="text-sm flex-1 text-left"
                            style={{color: isActive ? '#5B54E8' : '#6b7280', fontWeight: isActive ? 700 : 500}}>
                            {label}
                          </span>

                          {/* Pin toggle on hover */}
                            {isHovered && !isActive && (
                              <span onClick={(e) => togglePin(key, e)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') togglePin(key, e) }}
                                className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-purple-100 transition-colors cursor-pointer"
                                title={isPinned ? 'Unpin' : 'Pin to top'}>
                                {isPinned ? (
                                  <PinOff size={10} style={{color: '#5B54E8'}} />
                                ) : (
                                  <Pin size={10} style={{color: '#9ca3af'}} />
                                )}
                              </span>
                            )}

                          {badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                              style={{background: '#fef3c7', color: '#92400e'}}>
                              {badge}
                            </span>
                          )}

                          {count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold min-w-[18px] text-center"
                              style={{
                                background: isActive ? '#5B54E8' : '#ede9fe',
                                color: isActive ? 'white' : '#5B54E8',
                              }}>
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </button>

                    {/* Tooltip when collapsed */}
                    {!sidebarOpen && isHovered && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 rounded-xl z-50 whitespace-nowrap fade-up pointer-events-none"
                        style={{
                          background: '#1f2937',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{label}</span>
                          {count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                              style={{background: '#5B54E8', color: 'white'}}>
                              {count}
                            </span>
                          )}
                        </div>
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0"
                          style={{
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            borderRight: '5px solid #1f2937',
                          }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {sidebarOpen && search && filteredNavItems.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">No items match "{search}"</p>
            <button onClick={() => setSearch('')}
              className="mt-2 text-xs font-semibold" style={{color: '#5B54E8'}}>
              Clear search
            </button>
          </div>
        )}
      </nav>

      {/* User Profile Footer */}
      <div className={`px-3 py-3 ${!sidebarOpen && 'flex justify-center'}`}
        style={{borderTop: '1px solid #f0effe', background: 'linear-gradient(180deg, white, #fafaff)'}}>
        {sidebarOpen ? (
          <div className="rounded-2xl p-2.5"
            style={{background: 'white', border: '1px solid #f0effe'}}>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                  style={{background: rc.gradient, boxShadow: `0 4px 12px ${rc.color}40`}}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{profile?.full_name}</p>
                <p className="text-[10px] truncate" style={{color: rc.color, fontWeight: 600}}>
                  {roleLabel}
                </p>
              </div>
              <button onClick={handleLogout}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                title="Sign out">
                <LogOut size={12} />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Sign out">
            <LogOut size={14} />
          </button>
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
          confirmText="Yes, Sign Out"
          cancelText="Stay Signed In"
          variant="logout"
        />,
        document.body
      )}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}