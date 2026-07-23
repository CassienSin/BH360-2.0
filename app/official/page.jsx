'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, AlertTriangle, FileText, Bell, BarChart2, Plus, ChevronRight, Shield, Users, KeyRound, Copy, Search, X, Map, Download, FileSpreadsheet, Star, Calendar, Phone } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import ConfirmDialog from '@/components/ConfirmDialog'
import TanodRoster from '@/components/TanodRoster'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import { exportToCSV, exportToPDF } from '@/lib/export'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyCriticalIncident, notifyNewIncident } from '@/lib/notifications'

const DOTS = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

// Ambient decoration only — skipped for users who prefer reduced motion.
const AnimatedDots = () => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  if (!show) return null
  return (
    <div className="absolute inset-0" style={{ overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      {DOTS.map((dot, i) => (
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
}

// Profile picture with graceful fallback to the initial-letter circle.
// Used in User Management and Tanod Management — avatar_url was never
// rendered there before, only the initial.
function Avatar({ src, name, gradient, className = 'w-9 h-9', textClass = 'text-sm' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={`${className} rounded-2xl object-cover flex-shrink-0`}
        style={{ border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    )
  }
  return (
    <div className={`${className} rounded-2xl flex items-center justify-center ${textClass} font-bold text-white flex-shrink-0`}
      style={{ background: gradient }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

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

const priorityConfig = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

const roleConfig = {
  resident: { color: '#5B54E8', bg: '#f0effe', label: 'Resident' },
  official: { color: '#f97316', bg: '#fff7ed', label: 'Official' },
  tanod: { color: '#22c55e', bg: '#f0fdf4', label: 'Tanod' },
}

export default function OfficialDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState('all')
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [confirmDialog, setConfirmDialog] = useState(null) // { type, ...data }
  const [generatingCode, setGeneratingCode] = useState(false)
  const hadDropRef = useRef(false) // realtime dropped at some point → refetch on reconnect

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) {
      setSidebarOpen(JSON.parse(saved))
    } else if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
    }
  }, [sidebarOpen, mounted])

  // Only react when the viewport CROSSES the mobile breakpoint. The old
  // version force-set the sidebar on every resize (and once on mount),
  // which stomped the user's saved preference on desktop.
  useEffect(() => {
    let lastMobile = window.innerWidth < 768
    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      if (isMobile !== lastMobile) {
        lastMobile = isMobile
        setSidebarOpen(!isMobile)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ---- Data fetching (reusable so realtime reconnects can refresh) ----
  const loadBarangayData = useCallback(async (bid) => {
    // These six queries were sequential (~6 round trips) — run them in parallel
    const [inc, tix, ann, tan, allUsers, codes] = await Promise.all([
      supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false }),
      supabase.from('tickets')
        .select('*, profiles!tickets_created_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false }),
      supabase.from('announcements')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('*')
        .eq('role', 'tanod')
        .eq('barangay_id', bid)
        .is('deactivated_at', null),
      supabase.from('profiles')
        .select('*')
        .eq('barangay_id', bid)
        .is('deactivated_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('invite_codes')
        .select('*, profiles(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false }),
    ])
    setIncidents(inc.data || [])
    setTickets(tix.data || [])
    setAnnouncements(ann.data || [])
    setTanods(tan.data || [])
    setUsers(allUsers.data || [])
    setInviteCodes(codes.data || [])
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session) return router.replace('/login')
        const user = session.user
        const { data: prof } = await supabase.from('profiles')
          .select('*, barangays(id, name, city, province)')
          .eq('id', user.id).single()
        if (cancelled) return
        if (prof?.role !== 'official') return router.replace('/login')
        setProfile(prof)

        if (!prof?.barangay_id) {
          setLoading(false)
          return
        }
        await loadBarangayData(prof.barangay_id)
      } catch (err) {
        console.error('Dashboard load failed:', err)
        if (!cancelled) toast.error('Failed to load dashboard. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase, router, loadBarangayData])

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
            // Dedup guard: a reconnect refetch may already have this row
            setIncidents(prev => (prev.some(i => i.id === data.id) ? prev : [data, ...prev]))
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
      .subscribe((status) => {
        // Reconnected after a drop → refetch everything that happened during
        // the gap (phone sleep / wifi blip / backgrounded tab)
        if (status === 'SUBSCRIBED') {
          if (hadDropRef.current) {
            hadDropRef.current = false
            loadBarangayData(bid).catch(err => console.error('Reconnect refresh failed:', err))
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          hadDropRef.current = true
        }
      })

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
            setTickets(prev => (prev.some(t => t.id === data.id) ? prev : [data, ...prev]))
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
          setAnnouncements(prev => (prev.some(a => a.id === payload.new.id) ? prev : [payload.new, ...prev]))
        }
        if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
      .subscribe()

    // Profile changes: keeps the dispatch dropdown, tanod list, AND the
    // user directory live. The old handler only patched existing tanods —
    // a newly registered user/tanod never appeared until a full reload.
    const profileChannel = supabase
      .channel('official-profiles')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        const p = payload.new
        if (p.deactivated_at) return
        setUsers(prev => (prev.some(u => u.id === p.id) ? prev : [p, ...prev]))
        if (p.role === 'tanod') {
          setTanods(prev => (prev.some(t => t.id === p.id) ? prev : [...prev, p]))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        const p = payload.new
        if (p.deactivated_at) {
          // Deactivated mid-session — remove from both lists
          setUsers(prev => prev.filter(u => u.id !== p.id))
          setTanods(prev => prev.filter(t => t.id !== p.id))
          return
        }
        setUsers(prev => prev.map(u => (u.id === p.id ? { ...u, ...p } : u)))
        if (p.role === 'tanod') {
          setTanods(prev => (prev.some(t => t.id === p.id)
            ? prev.map(t => (t.id === p.id ? { ...t, ...p } : t))
            : [...prev, p])) // reactivated or role changed to tanod
        } else {
          setTanods(prev => prev.filter(t => t.id !== p.id)) // role changed away
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(ticketChannel)
      supabase.removeChannel(announcementChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [profile?.barangay_id, supabase, loadBarangayData])

  // Active assignment count per tanod — shown in the dispatch dropdown so
  // officials naturally balance the load ("Reyes · 2 active")
  const tanodActiveCounts = useMemo(() => {
    const counts = {}
    incidents.forEach(i => {
      if (i.status === 'assigned' && i.assigned_to) {
        counts[i.assigned_to] = (counts[i.assigned_to] || 0) + 1
      }
    })
    return counts
  }, [incidents])

  const filteredIncidents = useMemo(() => {
    const q = incidentSearch.trim().toLowerCase()
    return incidents
      .filter(inc => {
        const matchesSearch = !q ||
          inc.title?.toLowerCase().includes(q) ||
          inc.description?.toLowerCase().includes(q) ||
          inc.location?.toLowerCase().includes(q) ||
          inc.profiles?.full_name?.toLowerCase().includes(q)
        const matchesFilter = incidentFilter === 'all' || inc.status === incidentFilter
        const matchesCategory = incidentCategoryFilter === 'all' || inc.category === incidentCategoryFilter
        const matchesPriority = incidentPriorityFilter === 'all' || inc.priority === incidentPriorityFilter
        return matchesSearch && matchesFilter && matchesCategory && matchesPriority
      })
      .sort((a, b) => {
        // Status first (pending/assigned before resolved)
        const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
        const aStatus = statusOrder[a.status] || 4
        const bStatus = statusOrder[b.status] || 4
        if (aStatus !== bStatus) return aStatus - bStatus
        // Then priority (Critical first)
        const aPriority = priorityConfig[a.priority]?.order || 2
        const bPriority = priorityConfig[b.priority]?.order || 2
        if (aPriority !== bPriority) return bPriority - aPriority
        // Finally newest first
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [incidents, incidentSearch, incidentFilter, incidentCategoryFilter, incidentPriorityFilter])

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase()
    return tickets.filter(t => {
      const matchesSearch = !q ||
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.profiles?.full_name?.toLowerCase().includes(q)
      const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter
      return matchesSearch && matchesFilter
    })
  }, [tickets, ticketSearch, ticketFilter])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter(u => {
      const matchesSearch = !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.address?.toLowerCase().includes(q)
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
      return matchesSearch && matchesRole
    })
  }, [users, userSearch, userRoleFilter])

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  async function doDispatch(incidentId, tanod) {
    // Atomic: only succeeds while the incident is still pending, so two
    // officials can't double-dispatch the same incident
    const { data: updated, error } = await supabase.from('incidents')
      .update({ assigned_to: tanod.id, status: 'assigned' })
      .eq('id', incidentId)
      .eq('status', 'pending')
      .select()
    if (error) {
      toast.error('Dispatch failed. Please try again.')
      return
    }
    if (!updated || updated.length === 0) {
      toast.error('This incident was already assigned or resolved by someone else.')
      return // realtime will sync the true state
    }
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, assigned_to: tanod.id, status: 'assigned' } : i))
    toast.success(`${tanod.full_name} dispatched successfully!`)
  }

  function dispatchTanod(incidentId, tanodId) {
    const tanod = tanods.find(t => t.id === tanodId)
    if (!tanod) return

    if (!tanod.on_duty) {
      setConfirmDialog({
        type: 'dispatch-offduty',
        title: 'Dispatch off-duty tanod?',
        message: `${tanod.full_name} is currently OFF DUTY and may not see this assignment right away. Consider calling them first${tanod.phone ? ` (${tanod.phone})` : ''}. Dispatch anyway?`,
        confirmText: 'Dispatch Anyway',
        variant: 'danger',
        onConfirm: async () => {
          await doDispatch(incidentId, tanod)
          setConfirmDialog(null)
        }
      })
      return
    }
    doDispatch(incidentId, tanod)
  }

  function resolveIncident(incident) {
    setConfirmDialog({
      type: 'resolve',
      title: 'Mark as resolved?',
      message: `Are you sure "${incident.title}" has been resolved? This will notify the resident and update the incident status.`,
      confirmText: 'Yes, Mark Resolved',
      variant: 'success',
      onConfirm: async () => {
        const { error } = await supabase.from('incidents')
          .update({ status: 'resolved' })
          .eq('id', incident.id)
        if (error) {
          toast.error('Failed to update. Please try again.')
          setConfirmDialog(null)
          return
        }
        setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'resolved' } : i))
        toast.success('Incident marked as resolved!')
        setConfirmDialog(null)
      }
    })
  }

  async function generateInviteCode(role) {
    if (generatingCode) return
    setGeneratingCode(true)
    const code = `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const { data, error } = await supabase.from('invite_codes').insert({
      code, role, barangay_id: profile.barangay_id
    }).select().single()
    setGeneratingCode(false)
    if (error) { toast.error('Failed to generate code.'); return }
    setInviteCodes(prev => [data, ...prev])
    toast.success(`Code generated: ${code}`)
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch {
      // Clipboard API can fail on http:// or older webviews — show the code
      // so it can at least be copied manually
      toast(`Copy manually: ${text}`, { duration: 6000 })
    }
  }

  const statusColor = {
    pending: 'bg-amber-100 text-amber-700', assigned: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700', open: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700', closed: 'bg-emerald-100 text-emerald-700',
  }
  const statusClass = (s) => statusColor[s] || 'bg-gray-100 text-gray-500'

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
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'Incident Report',
          subtitle: `${data.length} incidents${incidentFilter !== 'all' ? ` (${incidentFilter})` : ''}`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'landscape',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} incidents to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
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
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'Ticket Report',
          subtitle: `${data.length} tickets`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'portrait',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} tickets to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
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
    const data = filteredUsers // exports respect the search/role filter, like incidents do
    const filename = `users-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'User Directory',
          subtitle: `${data.length} registered users${userRoleFilter !== 'all' ? ` (${userRoleFilter}s)` : ''}`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'portrait',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} users to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
    }
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
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
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
          { label: 'On Duty', value: `${tanods.filter(t => t.on_duty).length}/${tanods.length}`, color: '#22c55e', key: 'tanods' },
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
              subtitle: `Open ticket from ${t.profiles?.full_name || 'a resident'}`,
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
                    { label: 'On Duty Now', value: tanods.filter(t => t.on_duty).length, sub: `of ${tanods.length} tanods`, textColor: '#22c55e' },
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

              <TanodRoster profile={profile} />

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
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{background: cat.bg}}>
                            {cat.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                            <p className="text-xs text-gray-400 truncate" title={fullDate(inc.created_at)}>{inc.profiles?.full_name} · {inc.location} · {timeAgo(inc.created_at)}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusClass(inc.status)}`}>{inc.status}</span>
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
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        value={incidentSearch}
                        onChange={e => setIncidentSearch(e.target.value)}
                        type="search"
                        aria-label="Search incidents"
                        placeholder="Search incidents by title, location, or reporter..."
                        className="input-field w-full rounded-2xl pl-10 pr-10 py-2.5 text-sm text-gray-800"
                      />
                      {incidentSearch && (
                        <button onClick={() => setIncidentSearch('')}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter incidents by status">
                      {[
                        { value: 'all', label: 'All', count: incidents.length, color: '#5B54E8' },
                        { value: 'pending', label: 'Pending', count: incidents.filter(i => i.status === 'pending').length, color: '#f97316' },
                        { value: 'assigned', label: 'Assigned', count: incidents.filter(i => i.status === 'assigned').length, color: '#3b82f6' },
                        { value: 'resolved', label: 'Resolved', count: incidents.filter(i => i.status === 'resolved').length, color: '#22c55e' },
                      ].map(f => (
                        <button key={f.value} onClick={() => setIncidentFilter(f.value)}
                          aria-pressed={incidentFilter === f.value}
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
                  <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100" role="group" aria-label="Filter incidents by category">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider w-full mb-1">Filter by Category</p>
                    <button onClick={() => setIncidentCategoryFilter('all')}
                      aria-pressed={incidentCategoryFilter === 'all'}
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
                      // Never hide the currently selected chip even at zero count
                      if (count === 0 && incidentCategoryFilter !== cat) return null
                      return (
                        <button key={cat} onClick={() => setIncidentCategoryFilter(prev => prev === cat ? 'all' : cat)}
                          aria-pressed={incidentCategoryFilter === cat}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          style={{
                            background: incidentCategoryFilter === cat ? conf.color : '#fafaff',
                            color: incidentCategoryFilter === cat ? 'white' : conf.color,
                            border: incidentCategoryFilter === cat ? 'none' : `1px solid ${conf.bg}`,
                          }}>
                          <span aria-hidden="true">{conf.icon}</span> {cat} <span className="opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Priority Filter */}
                  <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100" role="group" aria-label="Filter incidents by priority">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider w-full mb-1">Filter by Priority</p>
                    <button onClick={() => setIncidentPriorityFilter('all')}
                      aria-pressed={incidentPriorityFilter === 'all'}
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
                      if (count === 0 && incidentPriorityFilter !== p) return null
                      return (
                        <button key={p} onClick={() => setIncidentPriorityFilter(prev => prev === p ? 'all' : p)}
                          aria-pressed={incidentPriorityFilter === p}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          style={{
                            background: incidentPriorityFilter === p ? conf.color : '#fafaff',
                            color: incidentPriorityFilter === p ? 'white' : conf.color,
                            border: incidentPriorityFilter === p ? 'none' : `1px solid ${conf.color}30`,
                          }}>
                          <span aria-hidden="true">{conf.icon}</span> {p} <span className="opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>

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
                const isCriticalOpen = inc.priority === 'Critical' && inc.status !== 'resolved'
                return (
                  <div key={inc.id} className="white-card p-5"
                    style={isCriticalOpen ? { borderLeft: '3px solid #ef4444' } : undefined}>
                    <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{background: cat.bg}}>
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusClass(inc.status)}`}>{inc.status}</span>
                            {inc.priority && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                                style={{
                                  background: priorityConfig[inc.priority]?.bg || '#f9fafb',
                                  color: priorityConfig[inc.priority]?.color || '#6b7280',
                                  ...(isCriticalOpen ? {animation: 'pulse 2s ease-in-out infinite'} : {})
                                }}>
                                <span aria-hidden="true">{priorityConfig[inc.priority]?.icon}</span> {inc.priority}
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

                          {/* Assigned tanod — was invisible before; officials had
                              to remember who they dispatched */}
                          {inc.status === 'assigned' && inc.assigned_to && (
                            <p className="text-xs mt-1 font-semibold" style={{color: '#3b82f6'}}>
                              🛡️ Assigned to {tanods.find(t => t.id === inc.assigned_to)?.full_name || 'a tanod'}
                            </p>
                          )}

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
                                  <img src={inc.resolution_image_url} alt="Resolution proof" loading="lazy" className="w-full max-h-24 object-cover" />
                                </a>
                              )}
                            </div>
                          )}

                          {inc.image_url && (
                            <a href={inc.image_url} target="_blank" rel="noopener noreferrer"
                              className="block mt-3 rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
                              style={{border: '1px solid #f0effe', maxWidth: '400px'}}>
                              <img src={inc.image_url} alt="Incident" loading="lazy" className="w-full max-h-64 object-cover" />
                            </a>
                          )}
                        </div>
                      </div>
                      {inc.status !== 'resolved' && (
                        <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto mt-3 sm:mt-0">
                          {inc.status === 'pending' && (
                            <select
                              value=""
                              onChange={e => e.target.value && dispatchTanod(inc.id, e.target.value)}
                              aria-label={`Dispatch a tanod to ${inc.title}`}
                              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400 bg-white">
                              <option value="">Dispatch Tanod...</option>
                              {[...tanods]
                                .sort((a, b) => (b.on_duty === true) - (a.on_duty === true) || (a.full_name || '').localeCompare(b.full_name || ''))
                                .map(t => {
                                  const active = tanodActiveCounts[t.id] || 0
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.on_duty ? '🟢' : '⚪'} {t.full_name}{active > 0 ? ` · ${active} active` : ''}{t.on_duty ? '' : ' (off duty)'}
                                    </option>
                                  )
                                })}
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
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        value={ticketSearch}
                        onChange={e => setTicketSearch(e.target.value)}
                        type="search"
                        aria-label="Search tickets"
                        placeholder="Search tickets by title or sender..."
                        className="input-field w-full rounded-2xl pl-10 pr-10 py-2.5 text-sm text-gray-800"
                      />
                      {ticketSearch && (
                        <button onClick={() => setTicketSearch('')}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter tickets by status">
                      {[
                        { value: 'all', label: 'All', count: tickets.length, color: '#5B54E8' },
                        { value: 'open', label: 'Open', count: tickets.filter(t => t.status === 'open').length, color: '#f97316' },
                        { value: 'in_progress', label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
                        { value: 'closed', label: 'Closed', count: tickets.filter(t => t.status === 'closed').length, color: '#22c55e' },
                      ].map(f => (
                        <button key={f.value} onClick={() => setTicketFilter(f.value)}
                          aria-pressed={ticketFilter === f.value}
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
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/official/ticket/${t.id}`) } }}
                  className="white-card p-5 cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <FileText size={16} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{t.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">From {t.profiles?.full_name || 'a resident'} · {timeAgo(t.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusClass(t.status)}`}>{t.status.replace('_', ' ')}</span>
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
                        {announcements.filter(a => (Date.now() - new Date(a.created_at)) / 86400000 <= 7).length}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">This Week</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black" style={{color: '#f97316'}}>
                        {announcements.filter(a => (Date.now() - new Date(a.created_at)) / 86400000 <= 1).length}
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
              {announcements.map(a => {
                const daysAgo = (Date.now() - new Date(a.created_at)) / 86400000
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
              {/* Summary strip so the section opens with the number that
                  matters: how many are patrolling right now */}
              {tanods.length > 0 && (
                <div className="white-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{background: '#f0fdf4'}}>
                    <Shield size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">
                      {tanods.filter(t => t.on_duty).length} of {tanods.length} on duty
                    </p>
                    <p className="text-xs text-gray-400">Duty status updates live</p>
                  </div>
                  <button onClick={() => navClick('users')}
                    className="text-xs font-semibold flex-shrink-0" style={{color: '#5B54E8'}}>
                    + Invite tanod
                  </button>
                </div>
              )}

              {tanods.length === 0 && (
                <div className="white-card p-10 text-center">
                  <Shield size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-400 text-sm">No tanods registered yet.</p>
                  <button onClick={() => navClick('users')} className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>Generate invite code →</button>
                </div>
              )}

              {/* On-duty first, then alphabetical */}
              {[...tanods]
                .sort((a, b) => (b.on_duty === true) - (a.on_duty === true) || (a.full_name || '').localeCompare(b.full_name || ''))
                .map(t => {
                  const active = tanodActiveCounts[t.id] || 0
                  return (
                    <div key={t.id} className="white-card p-5">
                      <div className="flex items-center gap-4">
                        {/* Profile photo — this list previously showed only the initial */}
                        <Avatar
                          src={t.avatar_url}
                          name={t.full_name}
                          className="w-12 h-12"
                          textClass="text-lg"
                          gradient={t.on_duty
                            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                            : 'linear-gradient(135deg, #9ca3af, #6b7280)'}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800">{t.full_name}</p>
                            {active > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{background: '#eff6ff', color: '#3b82f6'}}>
                                {active} active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {t.phone || 'No phone'} · {t.address || 'No address'}
                            {t.last_seen_at && ` · Seen ${timeAgo(t.last_seen_at)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {t.phone && (
                            <a href={`tel:${t.phone.replace(/[^0-9+]/g, '')}`}
                              aria-label={`Call ${t.full_name}`}
                              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100">
                              <Phone size={14} style={{color: '#5B54E8'}} />
                            </a>
                          )}
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${t.on_duty ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {t.on_duty ? 'On Duty' : 'Off Duty'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                  <button onClick={() => generateInviteCode('official')} disabled={generatingCode}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)'}}>
                    <Plus size={14} /> Official Code
                  </button>
                  <button onClick={() => generateInviteCode('tanod')} disabled={generatingCode}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
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
                          aria-label={`Copy code ${code.code}`}
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
                    <button onClick={() => handleExportUsers('csv')} disabled={filteredUsers.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40"
                      style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7'}}>
                      <FileSpreadsheet size={12} /> CSV
                    </button>
                    <button onClick={() => handleExportUsers('pdf')} disabled={filteredUsers.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
                      style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}>
                      <Download size={12} /> PDF
                    </button>
                  </div>
                </div>

                {/* Search + role filter — a barangay can have hundreds of
                    residents; an unfilterable list wasn't usable */}
                {users.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        type="search"
                        aria-label="Search users"
                        placeholder="Search by name, phone, or address..."
                        className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800"
                      />
                      {userSearch && (
                        <button onClick={() => setUserSearch('')}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter users by role">
                      {[
                        { value: 'all', label: 'All', count: users.length },
                        { value: 'resident', label: 'Residents', count: users.filter(u => u.role === 'resident').length },
                        { value: 'official', label: 'Officials', count: users.filter(u => u.role === 'official').length },
                        { value: 'tanod', label: 'Tanods', count: users.filter(u => u.role === 'tanod').length },
                      ].map(f => {
                        const color = f.value === 'all' ? '#5B54E8' : roleConfig[f.value].color
                        return (
                          <button key={f.value} onClick={() => setUserRoleFilter(f.value)}
                            aria-pressed={userRoleFilter === f.value}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                            style={{
                              background: userRoleFilter === f.value ? color : '#fafaff',
                              color: userRoleFilter === f.value ? 'white' : '#6b7280',
                              border: userRoleFilter === f.value ? `1px solid ${color}` : '1px solid #f0effe',
                            }}>
                            {f.label} <span style={{opacity: 0.75}}>{f.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {users.length > 0 && filteredUsers.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm font-medium">No users match your search</p>
                    <button onClick={() => { setUserSearch(''); setUserRoleFilter('all') }}
                      className="mt-2 text-xs font-semibold" style={{color: '#5B54E8'}}>
                      Clear filters →
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {filteredUsers.map(u => {
                    const rc = roleConfig[u.role] || roleConfig.resident
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{background: '#fafafa', border: '1px solid #f0effe'}}>
                        {/* Profile photo — this list previously showed only the initial */}
                        <Avatar
                          src={u.avatar_url}
                          name={u.full_name}
                          className="w-9 h-9"
                          textClass="text-sm"
                          gradient={`linear-gradient(135deg, ${rc.color}, ${rc.color}99)`}
                        />
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