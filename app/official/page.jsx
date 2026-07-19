'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, AlertTriangle, FileText, Bell, BarChart2, LogOut, Plus, ChevronRight, Shield, Menu, Users, KeyRound, Copy, Search, Filter, X, Map, Download, FileSpreadsheet, Star, Calendar } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import AnimatedDots from '@/components/AnimatedDots'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import ConfirmDialog from '@/components/ConfirmDialog'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import { exportToCSV, exportToPDF } from '@/lib/export'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyCriticalIncident, notifyNewIncident } from '@/lib/notifications'
import { CATEGORY_CONFIG as categoryConfig, PRIORITY_CONFIG as priorityConfig } from '@/lib/incident-config'
import { useRequireRole } from '@/lib/useRequireRole'
import { useSidebar } from '@/lib/useSidebar'

export default function OfficialDashboard() {
  const router = useRouter()
  const { supabase, profile } = useRequireRole('official')
  const { sidebarOpen, setSidebarOpen, closeOnMobile } = useSidebar()
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState('all')
  const [confirmDialog, setConfirmDialog] = useState(null) // { type, ...data }
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('all')

  useEffect(() => {
    if (!profile) return
    if (!profile.barangay_id) {
      setLoading(false)
      return
    }

    const bid = profile.barangay_id
    let cancelled = false

    async function loadData() {
      const { data: inc } = await supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setIncidents(inc || [])

      const { data: tix } = await supabase.from('tickets')
        .select('*, profiles!tickets_created_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setTickets(tix || [])

      const { data: ann } = await supabase.from('announcements')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setAnnouncements(ann || [])

      const { data: tan } = await supabase.from('profiles')
        .select('*')
        .eq('role', 'tanod')
        .eq('barangay_id', bid)
        .is('deactivated_at', null)
      if (cancelled) return
      setTanods(tan || [])

      const { data: allUsers } = await supabase.from('profiles')
        .select('*')
        .eq('barangay_id', bid)
        .is('deactivated_at', null)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setUsers(allUsers || [])

      const { data: codes } = await supabase.from('invite_codes')
        .select('*, profiles(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setInviteCodes(codes || [])

      setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [profile?.id, profile?.barangay_id, supabase])

  // Real-time subscriptions
  useEffect(() => {
    if (!profile?.barangay_id) return

    const bid = profile.barangay_id

    // Subscribe to incident changes
    const incidentChannel = supabase
      .channel('official-incidents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `barangay_id=eq.${bid}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data } = await supabase
            .from('incidents')
            .select('*, profiles!incidents_reported_by_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setIncidents(prev => [data, ...prev])
            if (data.priority === 'Critical') {
              toast.error(`🚨 CRITICAL: ${data.title}`, { duration: 8000 })
              notifyCriticalIncident(data)
            } else if (data.priority === 'High') {
              toast(`⚠️ HIGH PRIORITY: ${data.title}`, { duration: 6000, icon: '🟠' })
              notifyNewIncident(data)
            } else {
              toast.success(`🆕 New incident: ${data.title}`, { duration: 5000 })
              notifyNewIncident(data)
            }
          }
        }
        if (payload.eventType === 'UPDATE') {
          setIncidents(prev => prev.map(i =>
            i.id === payload.new.id ? { ...i, ...payload.new } : i
          ))
        }
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to ticket changes
    const ticketChannel = supabase
      .channel('official-tickets')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `barangay_id=eq.${bid}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data } = await supabase
            .from('tickets')
            .select('*, profiles!tickets_created_by_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setTickets(prev => [data, ...prev])
            toast.success(`📋 New ticket: ${data.title}`, { duration: 5000 })
          }
        }
        if (payload.eventType === 'UPDATE') {
          setTickets(prev => prev.map(t =>
            t.id === payload.new.id ? { ...t, ...payload.new } : t
          ))
        }
      })
      .subscribe()

    // Subscribe to announcement changes
    const announcementChannel = supabase
      .channel('official-announcements')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAnnouncements(prev => [payload.new, ...prev])
        }
        if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(ticketChannel)
      supabase.removeChannel(announcementChannel)
    }
  }, [profile?.barangay_id])

  const filteredIncidents = incidents
    .filter(inc => {
      const matchesSearch = !incidentSearch ||
        inc.title?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
        inc.description?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
        inc.location?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
        inc.profiles?.full_name?.toLowerCase().includes(incidentSearch.toLowerCase())
      const matchesFilter = incidentFilter === 'all' || inc.status === incidentFilter
      const matchesCategory = incidentCategoryFilter === 'all' || inc.category === incidentCategoryFilter
      const matchesPriority = incidentPriorityFilter === 'all' || inc.priority === incidentPriorityFilter
      return matchesSearch && matchesFilter && matchesCategory && matchesPriority
    })
    .sort((a, b) => {
      // Sort by status first (pending/assigned before resolved)
      const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
      const aStatus = statusOrder[a.status] || 4
      const bStatus = statusOrder[b.status] || 4
      if (aStatus !== bStatus) return aStatus - bStatus

      // Then by priority (Critical first)
      const aPriority = priorityConfig[a.priority]?.order || 2
      const bPriority = priorityConfig[b.priority]?.order || 2
      if (aPriority !== bPriority) return bPriority - aPriority

      // Finally by date (newest first)
      return new Date(b.created_at) - new Date(a.created_at)
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
    closeOnMobile()
  }

  async function dispatchTanod(incidentId, tanodId) {
    const tanod = tanods.find(t => t.id === tanodId)
    await supabase.from('incidents').update({ assigned_to: tanodId, status: 'assigned' }).eq('id', incidentId)
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, assigned_to: tanodId, status: 'assigned' } : i))
    toast.success(`${tanod?.full_name} dispatched successfully!`)
  }

  async function handleExportIncidents(format) {
    const columns = [
      { label: 'Title', key: 'title' },
      { label: 'Category', key: 'category' },
      { label: 'Priority', key: 'priority' },
      { label: 'Status', key: 'status' },
      { label: 'Location', key: 'location' },
      { label: 'Reporter', value: (r) => r.profiles?.full_name || '—' },
      { label: 'Description', key: 'description' },
      { label: 'Date Reported', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]

    const data = filteredIncidents
    const filename = `incidents-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`

    if (format === 'csv') {
      exportToCSV(data, filename, columns)
      toast.success(`Exported ${data.length} incidents to CSV!`)
    } else {
      await exportToPDF(data, filename, columns, {
        title: 'Incident Report',
        subtitle: `${data.length} incidents${incidentFilter !== 'all' ? ` (${incidentFilter})` : ''}`,
        barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
        orientation: 'landscape',
        paperSize: 'a4',
      })
      toast.success(`Exported ${data.length} incidents to PDF!`)
    }
  }

  async function handleExportTickets(format) {
    const columns = [
      { label: 'Title', key: 'title' },
      { label: 'Status', key: 'status' },
      { label: 'Sender', value: (r) => r.profiles?.full_name || '—' },
      { label: 'Description', key: 'description' },
      { label: 'Date Created', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]

    const data = filteredTickets
    const filename = `tickets-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`

    if (format === 'csv') {
      exportToCSV(data, filename, columns)
      toast.success(`Exported ${data.length} tickets to CSV!`)
    } else {
      await exportToPDF(data, filename, columns, {
        title: 'Ticket Report',
        subtitle: `${data.length} tickets`,
        barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
        orientation: 'portrait',
        paperSize: 'a4',
      })
      toast.success(`Exported ${data.length} tickets to PDF!`)
    }
  }

  async function handleExportUsers(format) {
    const columns = [
      { label: 'Full Name', key: 'full_name' },
      { label: 'Role', key: 'role' },
      { label: 'Phone', key: 'phone' },
      { label: 'Address', key: 'address' },
      { label: 'Joined', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]

    const filename = `users-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`

    if (format === 'csv') {
      exportToCSV(users, filename, columns)
      toast.success(`Exported ${users.length} users to CSV!`)
    } else {
      await exportToPDF(users, filename, columns, {
        title: 'User Directory',
        subtitle: `${users.length} registered users`,
        barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
        orientation: 'portrait',
        paperSize: 'a4',
      })
      toast.success(`Exported ${users.length} users to PDF!`)
    }
  }

  function resolveIncident(incident) {
    setConfirmDialog({
      type: 'resolve',
      title: 'Mark as resolved?',
      message: `Are you sure "${incident.title}" has been resolved? This will notify the resident and update the incident status.`,
      confirmText: 'Yes, Mark Resolved',
      variant: 'success',
      onConfirm: async () => {
        await supabase.from('incidents').update({ status: 'resolved' }).eq('id', incident.id)
        setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'resolved' } : i))
        toast.success('Incident marked as resolved!')
        setConfirmDialog(null)
      }
    })
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
    users: 'User Management', map: 'Incident Map', calendar: 'Calendar'
  }
  const sectionDesc = {
    dashboard: 'Overview of barangay operations', incidents: 'Monitor and respond to incidents',
    announcements: 'Manage community announcements', tickets: 'Handle resident support tickets',
    tanods: 'Manage field officers', analytics: 'AI-powered insights and trends',
    users: 'Manage accounts and invite codes', map: 'Visualize incidents on a map',
    calendar: 'View activity by date'
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
            { key: 'map', label: 'Incident Map', icon: Map },
            { key: 'calendar', label: 'Calendar', icon: Calendar },
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
           <NotificationBanner />

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
                  <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain opacity-20" />
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
                            <p className="text-xs text-gray-400" title={fullDate(inc.created_at)}>{inc.profiles?.full_name} · {inc.location} · {timeAgo(inc.created_at)}</p>
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

                  {/* Priority Filter */}
                    <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider w-full mb-1">Filter by Priority</p>
                      <button onClick={() => setIncidentPriorityFilter('all')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: incidentPriorityFilter === 'all' ? '#5B54E8' : '#fafaff',
                          color: incidentPriorityFilter === 'all' ? 'white' : '#6b7280',
                          border: incidentPriorityFilter === 'all' ? 'none' : '1px solid #f0effe',
                        }}>
                        All Priorities
                      </button>
                      {Object.entries(priorityConfig).sort((a, b) => b[1].order - a[1].order).map(([p, conf]) => {
                        const count = incidents.filter(i => i.priority === p).length
                        if (count === 0) return null
                        return (
                          <button key={p} onClick={() => setIncidentPriorityFilter(p)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            style={{
                              background: incidentPriorityFilter === p ? conf.color : '#fafaff',
                              color: incidentPriorityFilter === p ? 'white' : conf.color,
                              border: incidentPriorityFilter === p ? 'none' : `1px solid ${conf.color}30`,
                            }}>
                            <span>{conf.icon}</span> {p} <span className="opacity-70">({count})</span>
                          </button>
                        )
                      })}

                      {/* Export buttons */}
                        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-400 mr-auto">Export {filteredIncidents.length} {filteredIncidents.length === 1 ? 'incident' : 'incidents'}</p>
                          <button onClick={() => handleExportIncidents('csv')} disabled={filteredIncidents.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                            style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7'}}>
                            <FileSpreadsheet size={12} /> CSV
                          </button>
                          <button onClick={() => handleExportIncidents('pdf')} disabled={filteredIncidents.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                            style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}>
                            <Download size={12} /> PDF
                          </button>
                        </div>
                    </div>

                  {(incidentSearch || incidentFilter !== 'all' || incidentCategoryFilter !== 'all' || incidentPriorityFilter !== 'all') && (
                    <p className="text-xs text-gray-400 mt-3">
                      Showing {filteredIncidents.length} of {incidents.length} incidents
                      <button onClick={() => { setIncidentSearch(''); setIncidentFilter('all'); setIncidentCategoryFilter('all'); setIncidentPriorityFilter('all') }}
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
                  <button onClick={() => { setIncidentSearch(''); setIncidentFilter('all'); setIncidentCategoryFilter('all'); setIncidentPriorityFilter('all') }}
                    className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>
                    Clear filters →
                  </button>
                </div>
              )}

              {filteredIncidents.map(inc => {
                const cat = categoryConfig[inc.category] || categoryConfig.Other
                return (
                  <div key={inc.id} className="white-card p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{background: cat.bg}}>
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusColor[inc.status]}`}>{inc.status}</span>
                            {inc.priority && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                                style={{
                                  background: priorityConfig[inc.priority]?.bg || '#f9fafb',
                                  color: priorityConfig[inc.priority]?.color || '#6b7280',
                                  ...(inc.priority === 'Critical' ? {animation: 'pulse 2s ease-in-out infinite'} : {})
                                }}>
                                <span>{priorityConfig[inc.priority]?.icon}</span> {inc.priority}
                              </span>
                            )}
                            {inc.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{background: cat.bg, color: cat.color}}>
                                {inc.category}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                          <p className="text-gray-300 text-xs mt-1" title={fullDate(inc.created_at)}>📍 {inc.location} · By {inc.profiles?.full_name} · {timeAgo(inc.created_at)}</p>

                          {/* Resident Rating */}
                            {inc.rating && (
                              <div className="mt-3 p-3 rounded-xl" style={{background: '#fffbeb', border: '1px solid #fef3c7'}}>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                      <Star key={s} size={12} fill={s <= inc.rating ? '#f59e0b' : 'none'} color={s <= inc.rating ? '#f59e0b' : '#d1d5db'} />
                                    ))}
                                  </div>
                                  <span className="text-xs font-bold text-amber-700">{inc.rating}.0 / 5.0</span>
                                  <span className="text-[10px] text-amber-600">· Resident feedback</span>
                                </div>
                                {inc.rating_feedback && (
                                  <p className="text-xs text-amber-900 italic">"{inc.rating_feedback}"</p>
                                )}
                              </div>
                            )}

                            {/* Resolution Details */}
                            {inc.status === 'resolved' && inc.resolution_notes && (
                              <div className="mt-3 p-3 rounded-xl" style={{background: '#f0fdf4', border: '1px solid #dcfce7'}}>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Resolution Notes</p>
                                <p className="text-xs text-emerald-900">{inc.resolution_notes}</p>
                                {inc.resolution_image_url && (
                                  <a href={inc.resolution_image_url} target="_blank" rel="noopener noreferrer"
                                    className="block mt-2 rounded-lg overflow-hidden"
                                    style={{border: '1px solid #dcfce7', maxWidth: '180px'}}>
                                    <img src={inc.resolution_image_url} alt="Resolution proof" className="w-full max-h-24 object-cover" />
                                  </a>
                                )}
                              </div>
                            )}

                            {inc.image_url && (
                            <a href={inc.image_url} target="_blank" rel="noopener noreferrer"
                              className="block mt-3 rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
                              style={{border: '1px solid #f0effe', maxWidth: '400px'}}>
                              <img src={inc.image_url} alt="Incident" className="w-full max-h-64 object-cover" />
                            </a>
                          )}
                        </div>
                      </div>
                        {inc.status !== 'resolved' && (
                          <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto mt-3 sm:mt-0">
                            {inc.status === 'pending' && (
                              <select onChange={e => e.target.value && dispatchTanod(inc.id, e.target.value)}
                                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400 bg-white">
                                <option value="">Dispatch Tanod...</option>
                                {tanods.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                              </select>
                            )}
                            <button onClick={() => resolveIncident(inc)}
                              className="flex-1 text-xs bg-emerald-500 text-white px-3 py-2 rounded-xl hover:bg-emerald-600 font-semibold transition-colors whitespace-nowrap">
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

                  {/* Export buttons */}
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mr-auto">Export {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}</p>
                      <button onClick={() => handleExportTickets('csv')} disabled={filteredTickets.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                        style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7'}}>
                        <FileSpreadsheet size={12} /> CSV
                      </button>
                      <button onClick={() => handleExportTickets('pdf')} disabled={filteredTickets.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                        style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}>
                        <Download size={12} /> PDF
                      </button>
                    </div>
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

              {/* Header with stats + New button */}
              <div className="white-card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
                      <Bell size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Community Broadcasts</h3>
                      <p className="text-xs text-gray-400">
                        {announcements.length} total · Reaches all residents in {profile?.barangays?.name}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => router.push('/official/announcement/new')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
                    <Plus size={14} /> New Announcement
                  </button>
                </div>

                {/* Quick stats */}
                {announcements.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xl font-black" style={{color: '#5B54E8'}}>{announcements.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black" style={{color: '#22c55e'}}>
                        {announcements.filter(a => {
                          const days = (Date.now() - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
                          return days <= 7
                        }).length}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">This Week</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black" style={{color: '#f97316'}}>
                        {announcements.filter(a => {
                          const days = (Date.now() - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
                          return days <= 1
                        }).length}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Today</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {announcements.length === 0 && (
                <div className="white-card p-10 text-center">
                  <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                    style={{background: '#f0effe'}}>
                    <Bell size={28} style={{color: '#5B54E8', opacity: 0.5}} />
                  </div>
                  <p className="text-gray-700 font-semibold text-sm">No announcements yet</p>
                  <p className="text-gray-400 text-xs mt-1">Start broadcasting updates to your community</p>
                  <button onClick={() => router.push('/official/announcement/new')}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-bold transition-all hover:scale-105"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
                    <Plus size={14} /> Create First Announcement
                  </button>
                </div>
              )}

              {/* Announcement cards */}
              {announcements.map((a, i) => {
                const daysAgo = (Date.now() - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
                const isNew = daysAgo <= 1
                const isThisWeek = daysAgo <= 7

                return (
                  <div key={a.id} className="white-card p-5 relative overflow-hidden">
                    {/* New badge accent bar */}
                    {isNew && (
                      <div className="absolute top-0 left-0 right-0 h-1"
                        style={{background: 'linear-gradient(90deg, #5B54E8, #7C75F0, #5B54E8)', animation: 'shimmer 2s linear infinite'}} />
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
                        <Bell size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-800 text-sm break-words flex-1">{a.title}</h3>
                          {isNew && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                              style={{background: '#fef2f2', color: '#dc2626', animation: 'pulse 2s ease-in-out infinite'}}>
                              NEW
                            </span>
                          )}
                          {!isNew && isThisWeek && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                              style={{background: '#f0fdf4', color: '#16a34a'}}>
                              THIS WEEK
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap break-words">{a.content}</p>

                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                          <span className="flex items-center gap-1" title={fullDate(a.created_at)}>
                            📅 {timeAgoLong(a.created_at)}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            👥 All residents
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{background: '#f0effe'}}>
                      <Users size={18} style={{color: '#5B54E8'}} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">All Users</h3>
                      <p className="text-xs text-gray-400">{users.length} registered accounts in {profile?.barangays?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleExportUsers('csv')} disabled={users.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40"
                      style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7'}}>
                      <FileSpreadsheet size={12} /> CSV
                    </button>
                    <button onClick={() => handleExportUsers('pdf')} disabled={users.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
                      style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}>
                      <Download size={12} /> PDF
                    </button>
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

          {!loading && profile?.barangay_id && activeSection === 'map' && (
            <div className="fade-up space-y-4">
              <div className="white-card p-8 text-center">
                <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                  <Map size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Incident Map View</h2>
                <p className="text-gray-400 text-sm mb-6">Visualize all incidents geographically on an interactive map</p>
                <button onClick={() => router.push('/official/map')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 20px rgba(91,84,232,0.35)'}}>
                  Open Map View <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'calendar' && (
            <div className="fade-up space-y-4">
              <div className="white-card p-8 text-center">
                <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                <Calendar size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Calendar View</h2>
              <p className="text-gray-400 text-sm mb-6">View incidents and announcements plotted by date</p>
              <button onClick={() => router.push('/official/calendar')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 20px rgba(91,84,232,0.35)'}}>
                Open Calendar <ChevronRight size={16} />
              </button>
            </div>
          </div>
          )}
        </main>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={!!confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog?.onConfirm}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmText={confirmDialog?.confirmText}
          variant={confirmDialog?.variant || 'danger'}
        />
      </div>
    )
  }