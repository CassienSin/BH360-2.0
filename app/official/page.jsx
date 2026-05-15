'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, AlertTriangle, FileText, Bell, BarChart2, LogOut, Plus, ChevronRight, Shield, Menu, Users, KeyRound, Copy, Search, Filter, X } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'

const dots = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{overflow: 'hidden', pointerEvents: 'none'}}>
    {dots.map((dot, i) => (
      <div key={i} style={{
        position: 'absolute',
        width: `${dot.size}px`,
        height: `${dot.size}px`,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.4)',
        left: `${dot.left}%`,
        top: `${dot.top}%`,
        animation: `float ${dot.duration}s ease-in-out infinite`,
        animationDelay: `${dot.delay}s`,
        filter: 'blur(0.5px)',
      }} />
    ))}
  </div>
)

const categoryConfig = {
  Noise: { icon: '🔊', color: '#f97316', bg: '#fff7ed' },
  Theft: { icon: '🚨', color: '#ef4444', bg: '#fef2f2' },
  Violence: { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  Fire: { icon: '🔥', color: '#ea580c', bg: '#fff7ed' },
  Flood: { icon: '🌊', color: '#3b82f6', bg: '#eff6ff' },
  Infrastructure: { icon: '🛠️', color: '#8b5cf6', bg: '#f5f3ff' },
  Animals: { icon: '🐕', color: '#a16207', bg: '#fefce8' },
  Medical: { icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  Traffic: { icon: '🚦', color: '#0891b2', bg: '#ecfeff' },
  Vandalism: { icon: '🎨', color: '#7c3aed', bg: '#f5f3ff' },
  Drugs: { icon: '💊', color: '#be185d', bg: '#fdf2f8' },
  Other: { icon: '📝', color: '#6b7280', bg: '#f9fafb' },
}

export default function OfficialDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState('all')

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(true)
      else setSidebarOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')
      const user = session.user
      const { data: prof } = await supabase.from('profiles').select('*, barangays(id, name, city, province)').eq('id', user.id).single()
      if (prof?.role !== 'official') return router.push('/login')
      setProfile(prof)

      if (!prof?.barangay_id) {
        setLoading(false)
        return
      }

      const bid = prof.barangay_id

      const { data: inc } = await supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      setIncidents(inc || [])

      const { data: tix } = await supabase.from('tickets')
        .select('*, profiles!tickets_created_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      setTickets(tix || [])

      const { data: ann } = await supabase.from('announcements')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      setAnnouncements(ann || [])

      const { data: tan } = await supabase.from('profiles')
        .select('*')
        .eq('role', 'tanod')
        .eq('barangay_id', bid)
      setTanods(tan || [])

      const { data: allUsers } = await supabase.from('profiles')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      setUsers(allUsers || [])

      const { data: codes } = await supabase.from('invite_codes')
        .select('*, profiles(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      setInviteCodes(codes || [])

      setLoading(false)
    }
    loadData()
  }, [])

  async function handleLogout() { await supabase.auth.signOut(); window.location.href = '/login' }

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = !incidentSearch ||
      inc.title?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      inc.description?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      inc.location?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      inc.profiles?.full_name?.toLowerCase().includes(incidentSearch.toLowerCase())
    const matchesFilter = incidentFilter === 'all' || inc.status === incidentFilter
    const matchesCategory = incidentCategoryFilter === 'all' || inc.category === incidentCategoryFilter
    return matchesSearch && matchesFilter && matchesCategory
  })

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = !ticketSearch ||
      t.title?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.description?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(ticketSearch.toLowerCase())
    const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter
    return matchesSearch && matchesFilter
  })

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  async function dispatchTanod(incidentId, tanodId) {
    const tanod = tanods.find(t => t.id === tanodId)
    await supabase.from('incidents').update({ assigned_to: tanodId, status: 'assigned' }).eq('id', incidentId)
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, assigned_to: tanodId, status: 'assigned' } : i))
    toast.success(`${tanod?.full_name} dispatched successfully!`)
  }

  async function resolveIncident(incidentId) {
    await supabase.from('incidents').update({ status: 'resolved' }).eq('id', incidentId)
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: 'resolved' } : i))
    toast.success('Incident marked as resolved!')
  }

  async function generateInviteCode(role) {
    const code = `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const { data, error } = await supabase.from('invite_codes').insert({
      code, role, barangay_id: profile.barangay_id
    }).select().single()
    if (error) { toast.error('Failed to generate code.'); return }
    setInviteCodes(prev => [data, ...prev])
    toast.success(`Code generated: ${code}`)
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const statusColor = {
    pending: 'bg-amber-100 text-amber-700', assigned: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700', open: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700', closed: 'bg-emerald-100 text-emerald-700',
  }

  const sectionTitle = {
    dashboard: 'Dashboard', incidents: 'Incidents', announcements: 'Announcements',
    tickets: 'Ticket Management', tanods: 'Tanod Management', analytics: 'AI Analytics',
    users: 'User Management'
  }
  const sectionDesc = {
    dashboard: 'Overview of barangay operations', incidents: 'Monitor and respond to incidents',
    announcements: 'Manage community announcements', tickets: 'Handle resident support tickets',
    tanods: 'Manage field officers', analytics: 'AI-powered insights and trends',
    users: 'Manage accounts and invite codes'
  }

  const Skeleton = ({ className }) => <div className={`skeleton-shimmer ${className}`} />
  const CardSkeleton = () => (
    <div className="white-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
  const DashboardSkeleton = () => (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <DashboardSidebar
        profile={profile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        roleLabel="Barangay Official"
        stats={[
          { label: 'Pending', value: incidents.filter(i => i.status === 'pending').length, color: '#f97316', key: 'incidents' },
          { label: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, color: '#3b82f6', key: 'tickets' },
          { label: 'Tanods', value: tanods.length, color: '#22c55e', key: 'tanods' },
          { label: 'Total', value: incidents.length, color: '#5B54E8', key: 'incidents' },
        ]}
        navItems={[
          { section: 'MAIN', items: [
            { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'incidents', label: 'Incidents', icon: AlertTriangle, count: incidents.filter(i => i.status === 'pending').length, hasNew: incidents.filter(i => i.status === 'pending').length > 0 },
            { key: 'announcements', label: 'Announcements', icon: Bell },
          ]},
          { section: 'MANAGEMENT', items: [
            { key: 'tickets', label: 'Ticket Management', icon: FileText, count: tickets.filter(t => t.status === 'open').length, hasNew: tickets.filter(t => t.status === 'open').length > 0 },
            { key: 'tanods', label: 'Tanod Management', icon: Shield },
            { key: 'users', label: 'User Management', icon: Users },
          ]},
          { section: 'INSIGHTS', items: [
            { key: 'analytics', label: 'AI Analytics', icon: BarChart2, badge: 'AI' },
          ]},
        ]}
      />

      <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 h-screen overflow-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <DashboardHeader
          profile={profile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={sectionTitle[activeSection]}
          sectionDesc={sectionDesc[activeSection]}
          notifications={[
            ...incidents.filter(i => i.status === 'pending').map(i => ({
              id: i.id,
              type: 'incident',
              icon: '⚠️',
              color: '#fff7ed',
              title: i.title,
              subtitle: `Pending incident at ${i.location}`,
              created_at: i.created_at,
              data: i,
            })),
            ...tickets.filter(t => t.status === 'open').map(t => ({
              id: t.id,
              type: 'ticket',
              icon: '📋',
              color: '#f0effe',
              title: t.title,
              subtitle: `Open ticket from ${t.profiles?.full_name}`,
              created_at: t.created_at,
              data: t,
            }))
          ]}
          searchData={{
            incidents,
            tickets,
            announcements,
          }}
          onNotificationClick={(notif) => {
            if (notif.type === 'incident') setActiveSection('incidents')
            if (notif.type === 'ticket') router.push(`/official/ticket/${notif.id}`)
          }}
          onSearchResultClick={(type, item) => {
            if (type === 'incidents') setActiveSection('incidents')
            if (type === 'tickets') router.push(`/official/ticket/${item.id}`)
            if (type === 'announcements') setActiveSection('announcements')
          }}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">

          {loading && (
            <div className="fade-up">
              {activeSection === 'dashboard' ? <DashboardSkeleton /> : (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
                </div>
              )}
            </div>
          )}

          {!loading && !profile?.barangay_id && (
            <div className="white-card p-8 max-w-2xl mx-auto text-center fade-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center" style={{background: '#fff7ed'}}>
                <AlertTriangle size={28} className="text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">No Barangay Assigned</h2>
              <p className="text-gray-500 text-sm">Your official account isn't linked to a barangay. Please contact your system administrator.</p>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'dashboard' && (
            <div className="space-y-6 fade-up">
              <div className="white-card p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color: '#5B54E8'}}>Welcome back</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>
                    {profile?.full_name?.split(' ')[0]} 👋
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Managing {profile?.barangays?.name || 'your barangay'}</p>
                </div>
                <div className="hidden sm:block w-16 h-16 relative">
                  <Image src="/logo.png" alt="BH360" fill sizes="64px" className="object-contain opacity-20" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Quick Actions</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'View Incidents', icon: AlertTriangle, color: '#fff7ed', iconColor: '#f97316', section: 'incidents' },
                    { label: 'Manage Tanods', icon: Shield, color: '#f0fdf4', iconColor: '#22c55e', section: 'tanods' },
                    { label: 'Announcements', icon: Bell, color: '#f0effe', iconColor: '#5B54E8', section: 'announcements' },
                    { label: 'AI Analytics', icon: BarChart2, color: '#fff1f2', iconColor: '#f43f5e', section: 'analytics' },
                  ].map(({ label, icon: Icon, color, iconColor, section }) => (
                    <button key={label} onClick={() => navClick(section)}
                      className="white-card p-4 text-center flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background: color}}>
                        <Icon size={20} style={{color: iconColor}} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Overview</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Incidents', value: incidents.length, sub: `+${incidents.filter(i => i.status === 'pending').length} pending`, textColor: '#5B54E8' },
                    { label: 'Active Tanods', value: tanods.length, sub: 'On duty', textColor: '#22c55e' },
                    { label: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, sub: `${tickets.filter(t => t.status === 'in_progress').length} in progress`, textColor: '#f97316' },
                    { label: 'Resolved', value: incidents.filter(i => i.status === 'resolved').length, sub: `${incidents.length > 0 ? Math.round(incidents.filter(i => i.status === 'resolved').length / incidents.length * 100) : 0}% rate`, textColor: '#f43f5e' },
                  ].map(({ label, value, sub, textColor }) => (
                    <div key={label} className="white-card p-5">
                      <p className="text-xs text-gray-400 mb-1">{sub}</p>
                      <p className="text-3xl font-bold" style={{color: textColor}}>{value}</p>
                      <p className="text-sm font-medium text-gray-600 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Recent Incidents</p>
                  <button onClick={() => navClick('incidents')} className="text-xs font-semibold text-white opacity-70 hover:opacity-100 transition-opacity">View all →</button>
                </div>
                <div className="space-y-2">
                  {incidents.slice(0, 3).map(inc => {
                    const cat = categoryConfig[inc.category] || categoryConfig.Other
                    return (
                      <div key={inc.id} className="white-card px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{background: cat.bg}}>
                            {cat.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{inc.title}</p>
                            <p className="text-xs text-gray-400">{inc.profiles?.full_name} · {inc.location}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColor[inc.status]}`}>{inc.status}</span>
                      </div>
                    )
                  })}
                  {incidents.length === 0 && (
                    <div className="white-card p-6 text-center">
                      <p className="text-gray-400 text-sm">No incidents yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'incidents' && (
            <div className="space-y-3 fade-up">

              {incidents.length > 0 && (
                <div className="white-card p-4 mb-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={incidentSearch}
                        onChange={e => setIncidentSearch(e.target.value)}
                        placeholder="Search incidents by title, location, or reporter..."
                        className="input-field w-full rounded-2xl pl-10 pr-10 py-2.5 text-sm text-gray-800"
                      />
                      {incidentSearch && (
                        <button onClick={() => setIncidentSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'all', label: 'All', count: incidents.length, color: '#5B54E8' },
                        { value: 'pending', label: 'Pending', count: incidents.filter(i => i.status === 'pending').length, color: '#f97316' },
                        { value: 'assigned', label: 'Assigned', count: incidents.filter(i => i.status === 'assigned').length, color: '#3b82f6' },
                        { value: 'resolved', label: 'Resolved', count: incidents.filter(i => i.status === 'resolved').length, color: '#22c55e' },
                      ].map(f => (
                        <button key={f.value} onClick={() => setIncidentFilter(f.value)}
                          className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          style={{
                            background: incidentFilter === f.value ? f.color : '#fafaff',
                            color: incidentFilter === f.value ? 'white' : '#6b7280',
                            border: incidentFilter === f.value ? 'none' : '1px solid #f0effe',
                            boxShadow: incidentFilter === f.value ? `0 4px 12px ${f.color}40` : 'none',
                          }}>
                          {f.label}
                          <span className="px-1.5 py-0.5 rounded-md text-[10px]"
                            style={{
                              background: incidentFilter === f.value ? 'rgba(255,255,255,0.25)' : 'rgba(91,84,232,0.1)',
                              color: incidentFilter === f.value ? 'white' : '#5B54E8',
                            }}>
                            {f.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider w-full mb-1">Filter by Category</p>
                    <button onClick={() => setIncidentCategoryFilter('all')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: incidentCategoryFilter === 'all' ? '#5B54E8' : '#fafaff',
                        color: incidentCategoryFilter === 'all' ? 'white' : '#6b7280',
                        border: incidentCategoryFilter === 'all' ? 'none' : '1px solid #f0effe',
                      }}>
                      All Categories
                    </button>
                    {Object.entries(categoryConfig).map(([cat, conf]) => {
                      const count = incidents.filter(i => i.category === cat).length
                      if (count === 0) return null
                      return (
                        <button key={cat} onClick={() => setIncidentCategoryFilter(cat)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          style={{
                            background: incidentCategoryFilter === cat ? conf.color : '#fafaff',
                            color: incidentCategoryFilter === cat ? 'white' : conf.color,
                            border: incidentCategoryFilter === cat ? 'none' : `1px solid ${conf.bg}`,
                          }}>
                          <span>{conf.icon}</span> {cat} <span className="opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>

                  {(incidentSearch || incidentFilter !== 'all' || incidentCategoryFilter !== 'all') && (
                    <p className="text-xs text-gray-400 mt-3">
                      Showing {filteredIncidents.length} of {incidents.length} incidents
                      <button onClick={() => { setIncidentSearch(''); setIncidentFilter('all'); setIncidentCategoryFilter('all') }}
                        className="ml-2 font-semibold" style={{color: '#5B54E8'}}>
                        Clear filters
                      </button>
                    </p>
                  )}
                </div>
              )}

              {incidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <AlertTriangle size={36} className="mx-auto mb-3 text-orange-300" />
                  <p className="text-gray-400 text-sm">No incidents yet.</p>
                </div>
              )}

              {incidents.length > 0 && filteredIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <Search size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-500 text-sm font-medium">No incidents match your search</p>
                  <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
                  <button onClick={() => { setIncidentSearch(''); setIncidentFilter('all'); setIncidentCategoryFilter('all') }}
                    className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>
                    Clear filters →
                  </button>
                </div>
              )}

              {filteredIncidents.map(inc => {
                const cat = categoryConfig[inc.category] || categoryConfig.Other
                return (
                  <div key={inc.id} className="white-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{background: cat.bg}}>
                          {cat.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusColor[inc.status]}`}>{inc.status}</span>
                            {inc.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{background: cat.bg, color: cat.color}}>
                                {inc.category}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                          <p className="text-gray-300 text-xs mt-1">📍 {inc.location} · By {inc.profiles?.full_name}</p>
                        </div>
                      </div>
                      {inc.status !== 'resolved' && (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {inc.status === 'pending' && (
                            <select onChange={e => e.target.value && dispatchTanod(inc.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400 bg-white">
                              <option value="">Dispatch Tanod...</option>
                              {tanods.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </select>
                          )}
                          <button onClick={() => resolveIncident(inc.id)}
                            className="text-xs bg-emerald-500 text-white px-3 py-2 rounded-xl hover:bg-emerald-600 font-semibold transition-colors">
                            ✓ Mark Resolved
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'tickets' && (
            <div className="space-y-3 fade-up">

              {tickets.length > 0 && (
                <div className="white-card p-4 mb-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={ticketSearch}
                        onChange={e => setTicketSearch(e.target.value)}
                        placeholder="Search tickets by title or sender..."
                        className="input-field w-full rounded-2xl pl-10 pr-10 py-2.5 text-sm text-gray-800"
                      />
                      {ticketSearch && (
                        <button onClick={() => setTicketSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'all', label: 'All', count: tickets.length, color: '#5B54E8' },
                        { value: 'open', label: 'Open', count: tickets.filter(t => t.status === 'open').length, color: '#f97316' },
                        { value: 'in_progress', label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
                        { value: 'closed', label: 'Closed', count: tickets.filter(t => t.status === 'closed').length, color: '#22c55e' },
                      ].map(f => (
                        <button key={f.value} onClick={() => setTicketFilter(f.value)}
                          className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          style={{
                            background: ticketFilter === f.value ? f.color : '#fafaff',
                            color: ticketFilter === f.value ? 'white' : '#6b7280',
                            border: ticketFilter === f.value ? 'none' : '1px solid #f0effe',
                            boxShadow: ticketFilter === f.value ? `0 4px 12px ${f.color}40` : 'none',
                          }}>
                          {f.label}
                          <span className="px-1.5 py-0.5 rounded-md text-[10px]"
                            style={{
                              background: ticketFilter === f.value ? 'rgba(255,255,255,0.25)' : 'rgba(91,84,232,0.1)',
                              color: ticketFilter === f.value ? 'white' : '#5B54E8',
                            }}>
                            {f.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(ticketSearch || ticketFilter !== 'all') && (
                    <p className="text-xs text-gray-400 mt-3">
                      Showing {filteredTickets.length} of {tickets.length} tickets
                      <button onClick={() => { setTicketSearch(''); setTicketFilter('all') }}
                        className="ml-2 font-semibold" style={{color: '#5B54E8'}}>
                        Clear filters
                      </button>
                    </p>
                  )}
                </div>
              )}

              {tickets.length === 0 && (
                <div className="white-card p-10 text-center">
                  <FileText size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-400 text-sm">No tickets yet.</p>
                </div>
              )}

              {tickets.length > 0 && filteredTickets.length === 0 && (
                <div className="white-card p-10 text-center">
                  <Search size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-500 text-sm font-medium">No tickets match your search</p>
                  <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
                  <button onClick={() => { setTicketSearch(''); setTicketFilter('all') }}
                    className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>
                    Clear filters →
                  </button>
                </div>
              )}

              {filteredTickets.map(t => (
                <div key={t.id} onClick={() => router.push(`/official/ticket/${t.id}`)}
                  className="white-card p-5 cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <FileText size={16} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{t.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">From {t.profiles?.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[t.status]}`}>{t.status.replace('_', ' ')}</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'announcements' && (
            <div className="space-y-3 fade-up">
              <div className="flex justify-end mb-2">
                <button onClick={() => router.push('/official/announcement/new')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white"
                  style={{color: '#5B54E8', boxShadow: '0 4px 16px rgba(91,84,232,0.2)'}}>
                  <Plus size={16} /> New Announcement
                </button>
              </div>
              {announcements.length === 0 && (
                <div className="white-card p-10 text-center">
                  <Bell size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-400 text-sm">No announcements yet.</p>
                </div>
              )}
              {announcements.map(a => (
                <div key={a.id} className="white-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                      <Bell size={16} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{a.title}</h3>
                      <p className="text-gray-500 text-sm mt-1">{a.content}</p>
                      <p className="text-gray-300 text-xs mt-2">{new Date(a.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'tanods' && (
            <div className="space-y-3 fade-up">
              {tanods.length === 0 && (
                <div className="white-card p-10 text-center">
                  <Shield size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-400 text-sm">No tanods registered yet.</p>
                  <button onClick={() => navClick('users')} className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>Generate invite code →</button>
                </div>
              )}
              {tanods.map(t => (
                <div key={t.id} className="white-card p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                      style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)'}}>
                      {t.full_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{t.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.phone || 'No phone'} · {t.address || 'No address'}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700">Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'analytics' && (
            <div className="fade-up space-y-4">
              <div className="white-card p-8 text-center">
                <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                  <BarChart2 size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">AI-Powered Analytics</h2>
                <p className="text-gray-400 text-sm mb-6">Get deep insights from your barangay data</p>
                <button onClick={() => router.push('/official/analytics')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 20px rgba(91,84,232,0.35)'}}>
                  View Analytics <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'users' && (
            <div className="space-y-6 fade-up">
              <div className="white-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                    <KeyRound size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Invite Codes</h3>
                    <p className="text-xs text-gray-400">Generate codes for {profile?.barangays?.name || 'your barangay'}</p>
                  </div>
                </div>
                <div className="flex gap-3 mb-5">
                  <button onClick={() => generateInviteCode('official')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white"
                    style={{background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)'}}>
                    <Plus size={14} /> Official Code
                  </button>
                  <button onClick={() => generateInviteCode('tanod')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white"
                    style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)'}}>
                    <Plus size={14} /> Tanod Code
                  </button>
                </div>

                <div className="space-y-2">
                  {inviteCodes.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No invite codes yet.</p>}
                  {inviteCodes.map(code => (
                    <div key={code.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{background: code.used ? '#f9fafb' : '#f0effe', border: `1px solid ${code.used ? '#e5e7eb' : '#e8e3ff'}`}}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold" style={{color: code.used ? '#9ca3af' : '#5B54E8'}}>
                            {code.code}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            code.role === 'official' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                          }`}>{code.role}</span>
                          {code.used && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">used</span>}
                        </div>
                        {code.used && code.profiles && (
                          <p className="text-xs text-gray-400 mt-0.5">Used by {code.profiles.full_name}</p>
                        )}
                      </div>
                      {!code.used && (
                        <button onClick={() => copyToClipboard(code.code)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white flex-shrink-0">
                          <Copy size={14} style={{color: '#5B54E8'}} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="white-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{background: '#f0effe'}}>
                    <Users size={18} style={{color: '#5B54E8'}} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">All Users</h3>
                    <p className="text-xs text-gray-400">{users.length} registered accounts in {profile?.barangays?.name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {users.map(u => {
                    const roleConfig = {
                      resident: { color: '#5B54E8', bg: '#f0effe', label: 'Resident' },
                      official: { color: '#f97316', bg: '#fff7ed', label: 'Official' },
                      tanod: { color: '#22c55e', bg: '#f0fdf4', label: 'Tanod' },
                    }
                    const rc = roleConfig[u.role] || roleConfig.resident
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{background: '#fafafa', border: '1px solid #f0effe'}}>
                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{background: `linear-gradient(135deg, ${rc.color}, ${rc.color}99)`}}>
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.phone || 'No phone'} · {u.address || 'No address'}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                          style={{background: rc.bg, color: rc.color}}>
                          {rc.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}