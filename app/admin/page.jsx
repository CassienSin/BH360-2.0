'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, Inbox, CheckCircle, XCircle, Clock, Mail, Phone, MapPin, MessageSquare, Copy, Search, Users, Building2, Loader2, KeyRound, ArrowLeft, Sparkles, LogOut, RefreshCw, Bell, AlertTriangle, Scale, X, BarChart3 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { PRIORITY_STYLE, getCategoryMeta, getBasis } from '@/lib/legalBasis'
import { computeStanding, STANDING_STYLE } from '@/lib/triage'
import { firstRealError } from '@/lib/dbError'

const dots = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{ overflow: 'hidden', pointerEvents: 'none' }}>
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

// Extracted so the 1-second tick only re-renders this tiny component,
// not the whole admin panel (which can hold hundreds of list rows).
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

// Cryptographically secure invite code. Math.random() is predictable and
// must never be used for codes that gate privileged roles.
function generateSecureCode(prefix) {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  // Unambiguous alphabet (no 0/O, 1/I/L) so codes survive being read aloud.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const code = Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
  return `${prefix.toUpperCase()}-${code}`
}

// The super admin's incident feed is platform-wide, so it is capped.
// Barangay dashboards load their own barangay in full; this view exists to
// spot what is going wrong across barangays, not to be a second copy of
// every barangay's queue.
const INCIDENT_FEED_LIMIT = 300
const INCIDENT_ANALYTICS_PAGE_SIZE = 500

// Applications were unbounded, which meant relying on Supabase's silent
// 1,000-row cap to stop the query — a limit that truncates without saying so.
const APPLICATION_LIMIT = 300
const BARANGAY_PAGE_SIZE = 20

const INCIDENT_STATUS_STYLE = {
  pending:  { label: 'Pending',  color: '#f97316', bg: '#fff7ed' },
  assigned: { label: 'Assigned', color: '#3b82f6', bg: '#eff6ff' },
  resolved: { label: 'Resolved', color: '#22c55e', bg: '#f0fdf4' },
}

const ROLE_CONFIG = {
  resident: { color: '#5B54E8', bg: '#f0effe' },
  official: { color: '#f97316', bg: '#fff7ed' },
  tanod: { color: '#22c55e', bg: '#f0fdf4' },
}

export default function AdminPanel() {
  const router = useRouter()
  // Memoize so we don't construct a new client on every render.
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [barangayResults, setBarangayResults] = useState([])
  const [barangaySearch, setBarangaySearch] = useState('')
  const [barangayCitySearch, setBarangayCitySearch] = useState('')
  const [barangayProvinceSearch, setBarangayProvinceSearch] = useState('')
  const [barangayPage, setBarangayPage] = useState(1)
  const [barangayHasMore, setBarangayHasMore] = useState(false)
  const [searchingBarangays, setSearchingBarangays] = useState(false)
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  // Platform-wide incident feed — every barangay, not just one.
  const [incidents, setIncidents] = useState([])
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all')
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('all')
  const [incidentBarangayFilter, setIncidentBarangayFilter] = useState('all')
  const [incidentView, setIncidentView] = useState('list')
  const [analyticsIncidents, setAnalyticsIncidents] = useState(null)
  const [analyticsBarangays, setAnalyticsBarangays] = useState(null)
  const [loadingIncidentAnalytics, setLoadingIncidentAnalytics] = useState(false)
  const [incidentAnalyticsError, setIncidentAnalyticsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('applications')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false) // guards against double-clicks
  const [approveConfirm, setApproveConfirm] = useState(null) // { app, officialCount }

  // One shared fetch used by initial load AND refresh — previously duplicated.
  // Promise.all runs the queries in parallel instead of one after another.
  const fetchAll = useCallback(async () => {
    const [appsRes, usersRes, codesRes, incidentsRes] = await Promise.all([
      supabase.from('barangay_applications')
        .select('*, barangays(name, city, province)')
        .order('created_at', { ascending: false })
        .limit(APPLICATION_LIMIT),
      supabase.from('profiles')
        .select('*, barangays(name)')
        .or('is_super_admin.is.null,is_super_admin.eq.false')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('invite_codes')
        .select('*, barangays(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      // No .eq('barangay_id', ...) here — that is the whole point. RLS lets
      // a super admin read every barangay's incidents (see the
      // "incidents: read same barangay or super admin" policy), so this
      // returns the platform-wide feed.
      supabase.from('incidents')
        .select('*, barangays(name, city, province), profiles!incidents_reported_by_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(INCIDENT_FEED_LIMIT),
    ])

    const firstError = firstRealError(
      [appsRes, usersRes, codesRes, incidentsRes], 'the admin panel')
    if (firstError) {
      console.error('Admin panel load failed:', firstError)
      toast.error('Some of the panel could not load. Try refreshing.')
    }

    setApplications(appsRes.data || [])
    setUsers(usersRes.data || [])
    setInviteCodes(codesRes.data || [])
    setIncidents(incidentsRes.data || [])
  }, [supabase])

  // Analytics are loaded only when requested. Unlike the live incident feed,
  // this query pages through the full table so its totals are not limited to
  // the newest 300 reports.
  const loadIncidentAnalytics = useCallback(async (forceRefresh = false) => {
    if (loadingIncidentAnalytics || (analyticsIncidents && !forceRefresh)) return
    setLoadingIncidentAnalytics(true)
    setIncidentAnalyticsError('')
    try {
      const allRows = []
      for (let from = 0; ; from += INCIDENT_ANALYTICS_PAGE_SIZE) {
        const { data, error } = await supabase.from('incidents')
          .select('id, barangay_id, status, priority, category, created_at, barangays(name, city, province)')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + INCIDENT_ANALYTICS_PAGE_SIZE - 1)
        if (error) throw error
        const page = data || []
        allRows.push(...page)
        if (page.length < INCIDENT_ANALYTICS_PAGE_SIZE) break
      }
      const allBarangays = []
      for (let from = 0; ; from += INCIDENT_ANALYTICS_PAGE_SIZE) {
        const { data, error } = await supabase.from('barangays')
          .select('id, name, city, province')
          .order('name')
          .order('province')
          .order('city')
          .order('id')
          .range(from, from + INCIDENT_ANALYTICS_PAGE_SIZE - 1)
        if (error) throw error
        const page = data || []
        allBarangays.push(...page)
        if (page.length < INCIDENT_ANALYTICS_PAGE_SIZE) break
      }
      setAnalyticsIncidents(allRows)
      setAnalyticsBarangays(allBarangays)
    } catch (error) {
      console.error('Incident analytics load failed:', error)
      setIncidentAnalyticsError(error.message || 'Could not load incident analytics.')
      toast.error('Could not load all incident analytics. Try again.')
    } finally {
      setLoadingIncidentAnalytics(false)
    }
  }, [supabase, loadingIncidentAnalytics, analyticsIncidents])

  // Debounced, paginated server-side barangay search. This scales to any
  // table size — we never try to load every barangay into the browser.
  useEffect(() => {
    if (loading) return
    const nameQuery = barangaySearch.trim()
    const cityQuery = barangayCitySearch.trim()
    const provinceQuery = barangayProvinceSearch.trim()
    setSearchingBarangays(true)
    let cancelled = false
    const t = setTimeout(async () => {
      const start = (barangayPage - 1) * BARANGAY_PAGE_SIZE
      let query = supabase.from('barangays')
        .select('id, name, city, province')
        .order('name')
        .order('province')
        .order('city')
        .order('id')
      // Filled fields are combined with AND, so common barangay names can
      // be narrowed by their city/municipality and province.
      if (nameQuery) query = query.ilike('name', `%${nameQuery}%`)
      if (cityQuery) query = query.ilike('city', `%${cityQuery}%`)
      if (provinceQuery) query = query.ilike('province', `%${provinceQuery}%`)
      // Fetch one extra row to know whether a Next page exists.
      const { data, error } = await query.range(start, start + BARANGAY_PAGE_SIZE)
      if (cancelled) return
      if (error) toast.error('Barangay search failed: ' + error.message)
      const matches = data || []
      setBarangayResults(matches.slice(0, BARANGAY_PAGE_SIZE))
      setBarangayHasMore(matches.length > BARANGAY_PAGE_SIZE)
      setSearchingBarangays(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [barangaySearch, barangayCitySearch, barangayProvinceSearch, barangayPage, loading, supabase])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return router.push('/login')

      const { data: prof, error: profError } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      // NOTE: this check is UX only — a malicious user can bypass any
      // client-side gate. Real enforcement must live in RLS policies
      // (and ideally a middleware/server-component check on this route).
      if (profError || !prof?.is_super_admin) {
        toast.error('Access denied. Super admin only.')
        return router.push('/login')
      }
      if (cancelled) return

      setProfile(prof)
      await fetchAll()
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [supabase, router, fetchAll])

  // Platform-wide incident realtime. Barangay dashboards filter their
  // channel by barangay_id; this one deliberately does not — the super
  // admin is watching every barangay at once.
  useEffect(() => {
    if (!profile?.is_super_admin) return

    const channel = supabase
      .channel('admin-all-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Refetch the one row so the barangay and reporter joins are filled in
          const { data, error } = await supabase
            .from('incidents')
            .select('*, barangays(name, city, province), profiles!incidents_reported_by_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (error) console.error('Could not load the new incident:', error)
          if (!data) return
          setIncidents(prev => (
            prev.some(i => i.id === data.id)
              ? prev
              : [data, ...prev].slice(0, INCIDENT_FEED_LIMIT)
          ))
          if (data.priority === 'Critical') {
            toast.error(`CRITICAL in ${data.barangays?.name || 'unknown barangay'}: ${data.title}`, { duration: 8000 })
          }
        }
        if (payload.eventType === 'UPDATE') {
          setIncidents(prev => prev.map(i => (i.id === payload.new.id ? { ...i, ...payload.new } : i)))
        }
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, profile?.is_super_admin])

  async function refreshData() {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
    toast.success('Data refreshed!')
  }

  // Step 1: check for existing officials with an accurate COUNT
  // (the old .limit(1) query could only ever report "1 official(s)").
  async function handleApprove(app) {
    if (processing) return
    setProcessing(true)

    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('barangay_id', app.barangay_id)
      .eq('role', 'official')

    setProcessing(false)

    if (error) {
      toast.error('Could not verify existing officials: ' + error.message)
      return
    }

    if (count && count > 0) {
      // Consistent UI: use the app's ConfirmDialog instead of window.confirm
      setApproveConfirm({ app, officialCount: count })
      return
    }

    await doApprove(app)
  }

  // Step 2: generate code + update application.
  // NOTE: these two writes are not atomic. For real safety, move them into a
  // single Postgres function called via supabase.rpc('approve_application', ...)
  // so a failure can't leave an orphaned invite code behind.
  async function doApprove(app) {
    if (processing) return
    setProcessing(true)

    const code = generateSecureCode('OFFICIAL')

    const { error: codeError } = await supabase.from('invite_codes').insert({
      code,
      role: 'official',
      barangay_id: app.barangay_id,
    })

    if (codeError) {
      setProcessing(false)
      toast.error('Failed to generate code: ' + codeError.message)
      return
    }

    const reviewedAt = new Date().toISOString()
    const { error: updateError } = await supabase.from('barangay_applications').update({
      status: 'approved',
      reviewed_by: profile.id,
      reviewed_at: reviewedAt,
      generated_code: code,
    }).eq('id', app.id)

    if (updateError) {
      setProcessing(false)
      // Best-effort cleanup so the code doesn't float around unclaimed.
      await supabase.from('invite_codes').delete().eq('code', code)
      toast.error('Failed to update application — code was rolled back')
      return
    }

    setApplications(prev => prev.map(a =>
      a.id === app.id ? { ...a, status: 'approved', generated_code: code, reviewed_at: reviewedAt } : a
    ))
    // Prepend locally instead of refetching the whole codes list.
    setInviteCodes(prev => [{
      id: `local-${code}`,
      code,
      role: 'official',
      barangay_id: app.barangay_id,
      used: false,
      created_at: reviewedAt,
      barangays: app.barangays ? { name: app.barangays.name } : null,
    }, ...prev])

    setReviewing(null)
    setProcessing(false)
    toast.success(`Approved! Code: ${code}`, { duration: 6000 })
  }

  async function handleReject(app, reason) {
    if (processing) return
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setProcessing(true)

    const reviewedAt = new Date().toISOString()
    const { error } = await supabase.from('barangay_applications').update({
      status: 'rejected',
      reviewed_by: profile.id,
      reviewed_at: reviewedAt,
      rejection_reason: reason.trim(),
    }).eq('id', app.id)

    setProcessing(false)

    if (error) {
      toast.error('Failed to reject application: ' + error.message)
      return
    }

    setApplications(prev => prev.map(a =>
      a.id === app.id ? { ...a, status: 'rejected', rejection_reason: reason.trim(), reviewed_at: reviewedAt } : a
    ))

    setReviewing(null)
    setRejectReason('')
    toast.success('Application rejected')
  }

  async function generateCustomCode(barangayId, role) {
    if (processing) return
    setProcessing(true)

    const code = generateSecureCode(role)

    const { data, error } = await supabase.from('invite_codes').insert({
      code,
      role,
      barangay_id: barangayId,
    }).select('*, barangays(name)').single()

    setProcessing(false)

    if (error) {
      toast.error('Failed to generate code: ' + error.message)
      return
    }

    setInviteCodes(prev => [data, ...prev])
    toast.success(`Code generated: ${code}`, { duration: 6000 })
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  // Derived data memoized so keystrokes elsewhere don't refilter needlessly.
  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applications.filter(a => {
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter
      const matchesSearch = !q ||
        a.full_name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.barangays?.name?.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [applications, statusFilter, search])

  const { pendingCount, approvedCount } = useMemo(() => ({
    pendingCount: applications.filter(a => a.status === 'pending').length,
    approvedCount: applications.filter(a => a.status === 'approved').length,
  }), [applications])

  // Barangays that actually appear in the feed, for the filter dropdown.
  const incidentBarangays = useMemo(() => {
    const seen = new Map()
    for (const inc of incidents) {
      if (inc.barangay_id && !seen.has(inc.barangay_id)) {
        seen.set(inc.barangay_id, inc.barangays?.name || 'Unknown barangay')
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [incidents])

  const filteredIncidents = useMemo(() => {
    const q = incidentSearch.trim().toLowerCase()
    return incidents.filter(i => {
      if (incidentStatusFilter !== 'all' && i.status !== incidentStatusFilter) return false
      if (incidentPriorityFilter !== 'all' && i.priority !== incidentPriorityFilter) return false
      if (incidentBarangayFilter !== 'all' && i.barangay_id !== incidentBarangayFilter) return false
      if (!q) return true
      return (
        i.title?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.barangays?.name?.toLowerCase().includes(q) ||
        i.barangays?.city?.toLowerCase().includes(q) ||
        i.profiles?.full_name?.toLowerCase().includes(q)
      )
    })
  }, [incidents, incidentSearch, incidentStatusFilter, incidentPriorityFilter, incidentBarangayFilter])

  const incidentStats = useMemo(() => ({
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'pending').length,
    critical: incidents.filter(i => i.priority === 'Critical' && i.status !== 'resolved').length,
    barangays: new Set(incidents.map(i => i.barangay_id).filter(Boolean)).size,
    // Reports still pending past their response window. Across barangays
    // this is the number that says which ones need help.
    overdue: incidents.filter(i => computeStanding(i).aged).length,
  }), [incidents])

  const incidentAnalytics = useMemo(() => {
    if (!analyticsIncidents) return null
    const barangays = new Map((analyticsBarangays || []).map(barangay => [barangay.id, {
      id: barangay.id,
      name: barangay.name || 'Unnamed barangay',
      city: barangay.city || '',
      province: barangay.province || '',
      total: 0,
      open: 0,
      critical: 0,
    }]))
    const categories = new Map()
    const statuses = { pending: 0, assigned: 0, resolved: 0 }
    const monthly = new Map()

    for (const incident of analyticsIncidents) {
      const barangayKey = incident.barangay_id || 'unassigned'
      const place = incident.barangays || {}
      const barangay = barangays.get(barangayKey) || {
        id: barangayKey,
        name: place.name || 'Unassigned barangay',
        city: place.city || '',
        province: place.province || '',
        total: 0,
        open: 0,
        critical: 0,
      }
      barangay.total += 1
      if (incident.status !== 'resolved') barangay.open += 1
      if (incident.priority === 'Critical' && incident.status !== 'resolved') barangay.critical += 1
      barangays.set(barangayKey, barangay)

      const status = (incident.status || 'pending').toLowerCase()
      statuses[status] = (statuses[status] || 0) + 1
      const category = incident.category || 'Uncategorized'
      categories.set(category, (categories.get(category) || 0) + 1)

      if (incident.created_at) {
        const date = new Date(incident.created_at)
        if (!Number.isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthly.set(monthKey, (monthly.get(monthKey) || 0) + 1)
        }
      }
    }

    const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setDate(1)
      date.setMonth(date.getMonth() - (5 - index))
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return {
        key,
        label: date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }),
        total: monthly.get(key) || 0,
      }
    })

    return {
      total: analyticsIncidents.length,
      open: analyticsIncidents.filter(i => i.status !== 'resolved').length,
      resolved: statuses.resolved || 0,
      critical: analyticsIncidents.filter(i => i.priority === 'Critical' && i.status !== 'resolved').length,
      barangays: [...barangays.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
      categories: [...categories.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      statuses,
      monthly: lastSixMonths,
    }
  }, [analyticsIncidents, analyticsBarangays])

  const totalBarangaysWithUsers = useMemo(
    () => new Set(users.map(u => u.barangay_id).filter(Boolean)).size,
    [users]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
      </div>

      {/* Premium Header */}
      <header className="bg-white sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>

        {/* LEFT — Back & Brand */}
        <button onClick={() => router.push('/')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Back to home">
          <ArrowLeft size={18} />
        </button>

        <div className="h-9 w-px hidden sm:block" style={{ background: '#f0effe' }} />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1f2937, #4b5563)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}>
              <Shield size={18} className="text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 2px 8px rgba(251,191,36,0.4)' }}>
              <Sparkles size={8} className="text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.5px' }}>
                Super Admin
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #1f2937, #4b5563)' }}>
                <Sparkles size={9} className="text-yellow-300" />
                <span className="text-[10px] font-black text-white tracking-wider">ROOT</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-gray-500 truncate">{profile?.full_name} · Online</p>
            </div>
          </div>
        </div>

        {/* RIGHT — Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          <LiveClock />

          {/* Refresh button */}
          <button onClick={refreshData} disabled={refreshing}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh data">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Pending count indicator */}
          {pendingCount > 0 && (
            <div className="relative">
              <button onClick={() => setActiveTab('applications')}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
                title={`${pendingCount} pending applications`}>
                <Bell size={15} className="text-gray-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: '#ef4444', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>
                  {pendingCount}
                </span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping opacity-75" />
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-9 w-px hidden sm:block" style={{ background: '#f0effe' }} />

          {/* Logout button */}
          <button onClick={() => setLogoutConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
            title="Sign out">
            <LogOut size={13} />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-6 space-y-6">

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#fff7ed' }}>
                <Inbox size={14} className="text-orange-500" />
              </div>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <p className="text-2xl font-black" style={{ color: '#f97316' }}>{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Applications</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#f0fdf4' }}>
                <CheckCircle size={14} className="text-emerald-500" />
              </div>
              <p className="text-xs text-gray-400">Approved</p>
            </div>
            <p className="text-2xl font-black" style={{ color: '#22c55e' }}>{approvedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total approved</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#f0effe' }}>
                <Building2 size={14} style={{ color: '#5B54E8' }} />
              </div>
              <p className="text-xs text-gray-400">Active</p>
            </div>
            <p className="text-2xl font-black" style={{ color: '#5B54E8' }}>{totalBarangaysWithUsers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Barangays w/ users</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#eff6ff' }}>
                <Users size={14} className="text-blue-500" />
              </div>
              <p className="text-xs text-gray-400">Total Users</p>
            </div>
            <p className="text-2xl font-black" style={{ color: '#3b82f6' }}>{users.length}{users.length >= 100 ? '+' : ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">Registered</p>
          </div>

          {/* Platform-wide incidents — the super admin's actual job is
              seeing across barangays, so this is a headline number, not
              something buried inside a tab. */}
          <button onClick={() => setActiveTab('incidents')}
            className="white-card p-4 text-left transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#fef2f2' }}>
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <p className="text-xs text-gray-400">Incidents</p>
            </div>
            <p className="text-2xl font-black" style={{ color: '#ef4444' }}>
              {incidentStats.pending}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Pending across {incidentStats.barangays} barangay{incidentStats.barangays === 1 ? '' : 's'}
            </p>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: 'applications', label: 'Applications', icon: Inbox, count: pendingCount },
            { value: 'incidents', label: 'All Incidents', icon: AlertTriangle, count: incidentStats.critical, countLabel: 'critical open' },
            { value: 'codes', label: 'Invite Codes', icon: KeyRound },
            { value: 'barangays', label: 'Barangays', icon: Building2 },
            { value: 'users', label: 'Users', icon: Users },
          ].map(({ value, label, icon: Icon, count, countLabel }) => (
            <button key={value} onClick={() => setActiveTab(value)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
              style={{
                background: activeTab === value ? 'white' : 'rgba(255,255,255,0.15)',
                color: activeTab === value ? '#5B54E8' : 'white',
                boxShadow: activeTab === value ? '0 4px 16px rgba(91,84,232,0.15)' : 'none',
              }}>
              <Icon size={13} /> {label}
              {count > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: activeTab === value ? '#5B54E8' : 'rgba(255,255,255,0.25)',
                    color: 'white',
                  }}>
                  {count}{countLabel ? ` ${countLabel}` : ''}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <div className="w-full min-w-0 space-y-3 fade-up">
            {/* Filters */}
            <div className="white-card w-full min-w-0 overflow-hidden p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or barangay..."
                    className="input-field w-full rounded-2xl pl-10 pr-4 py-2.5 text-sm text-gray-800" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'all', label: 'All', color: '#5B54E8' },
                    { value: 'pending', label: 'Pending', color: '#f97316' },
                    { value: 'approved', label: 'Approved', color: '#22c55e' },
                    { value: 'rejected', label: 'Rejected', color: '#ef4444' },
                  ].map(f => (
                    <button key={f.value} onClick={() => setStatusFilter(f.value)}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: statusFilter === f.value ? f.color : '#fafaff',
                        color: statusFilter === f.value ? 'white' : '#6b7280',
                        border: statusFilter === f.value ? 'none' : '1px solid #f0effe',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Applications List */}
            {filteredApps.length === 0 ? (
              <div className="white-card p-12 text-center">
                <Inbox size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-400 text-sm">No applications match your filters</p>
              </div>
            ) : (
              filteredApps.map(app => (
                <div key={app.id} className="white-card w-full min-w-0 overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                        {app.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{app.position}</p>
                        <p className="text-xs text-gray-300 mt-1" title={fullDate(app.created_at)}>
                          Applied {timeAgo(app.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                      <Mail size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{app.email}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                      <Phone size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{app.phone}</span>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
                      <MapPin size={12} style={{ color: '#5B54E8' }} className="flex-shrink-0" />
                      <span className="min-w-0 break-words font-semibold" style={{ color: '#5B54E8' }}>
                        {app.barangays?.name}, {app.barangays?.city}, {app.barangays?.province}
                      </span>
                    </div>
                  </div>

                  {app.message && (
                    <div className="p-3 rounded-xl mb-3" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <MessageSquare size={10} /> Message
                      </p>
                      <p className="text-xs text-gray-700 italic">"{app.message}"</p>
                    </div>
                  )}

                  {app.status === 'approved' && app.generated_code && (
                    <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
                      style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                      <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Generated Code</p>
                        <p className="font-mono text-sm font-bold text-emerald-900">{app.generated_code}</p>
                      </div>
                      <button onClick={() => copyToClipboard(app.generated_code)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-colors">
                        <Copy size={12} className="text-emerald-600" />
                      </button>
                    </div>
                  )}

                  {app.status === 'rejected' && app.rejection_reason && (
                    <div className="flex items-start gap-2 p-3 rounded-xl mb-3"
                      style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <XCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Rejection Reason</p>
                        <p className="text-xs text-red-900 mt-0.5">{app.rejection_reason}</p>
                      </div>
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(app)} disabled={processing}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
                        {processing
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle size={12} />} Approve & Generate Code
                      </button>
                      <button onClick={() => setReviewing(app)} disabled={processing}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-red-100 disabled:opacity-60"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        <XCircle size={12} className="inline" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}


        {/* ALL INCIDENTS TAB — every barangay on the platform.
            Barangay officials see only their own; this is the one view
            that spans them, so it leads with the cross-barangay numbers
            (which barangays are affected, and who is falling behind). */}
        {activeTab === 'incidents' && (
          <div className="w-full min-w-0 space-y-3 fade-up">

            <div className="white-card flex w-full min-w-0 flex-wrap gap-2 p-2" role="tablist" aria-label="Incident views">
              <button role="tab" aria-selected={incidentView === 'list'} onClick={() => setIncidentView('list')}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
                style={{ background: incidentView === 'list' ? '#5B54E8' : '#fafaff', color: incidentView === 'list' ? 'white' : '#6b7280' }}>
                <AlertTriangle size={14} /> Incident List
              </button>
              <button role="tab" aria-selected={incidentView === 'analytics'} onClick={() => {
                setIncidentView('analytics')
                loadIncidentAnalytics()
              }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
                style={{ background: incidentView === 'analytics' ? '#5B54E8' : '#fafaff', color: incidentView === 'analytics' ? 'white' : '#6b7280' }}>
                <BarChart3 size={14} /> Barangay Analytics
              </button>
            </div>

            {incidentView === 'list' ? <>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total in feed', value: incidentStats.total, color: '#5B54E8', sub: `Latest ${INCIDENT_FEED_LIMIT}` },
                { label: 'Pending', value: incidentStats.pending, color: '#f97316', sub: 'Awaiting dispatch' },
                { label: 'Critical open', value: incidentStats.critical, color: '#dc2626', sub: 'Unresolved' },
                { label: 'Past response time', value: incidentStats.overdue, color: '#b45309', sub: 'Pending too long' },
              ].map(stat => (
                <div key={stat.label} className="white-card p-4">
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-black mt-1" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="white-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={incidentSearch} onChange={e => setIncidentSearch(e.target.value)}
                    type="search"
                    aria-label="Search incidents"
                    placeholder="Search by title, barangay, city, category, or reporter..."
                    className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800" />
                  {incidentSearch && (
                    <button onClick={() => setIncidentSearch('')} aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <select
                  value={incidentBarangayFilter}
                  onChange={e => setIncidentBarangayFilter(e.target.value)}
                  aria-label="Filter by barangay"
                  className="input-field rounded-2xl px-4 py-2.5 text-sm text-gray-800 sm:max-w-[240px]">
                  <option value="all">All barangays ({incidentBarangays.length})</option>
                  {incidentBarangays.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
                  {[
                    { value: 'all', label: 'All', color: '#5B54E8' },
                    { value: 'pending', label: 'Pending', color: '#f97316' },
                    { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
                    { value: 'resolved', label: 'Resolved', color: '#22c55e' },
                  ].map(f => (
                    <button key={f.value} onClick={() => setIncidentStatusFilter(f.value)}
                      aria-pressed={incidentStatusFilter === f.value}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: incidentStatusFilter === f.value ? f.color : '#fafaff',
                        color: incidentStatusFilter === f.value ? 'white' : '#6b7280',
                        border: incidentStatusFilter === f.value ? 'none' : '1px solid #f0effe',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="w-px self-stretch hidden sm:block" style={{ background: '#f0effe' }} />
                <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by priority">
                  {['all', 'Critical', 'High', 'Medium', 'Low'].map(level => {
                    const style = PRIORITY_STYLE[level]
                    const color = style?.color || '#5B54E8'
                    const active = incidentPriorityFilter === level
                    return (
                      <button key={level} onClick={() => setIncidentPriorityFilter(level)}
                        aria-pressed={active}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: active ? color : '#fafaff',
                          color: active ? 'white' : '#6b7280',
                          border: active ? 'none' : '1px solid #f0effe',
                        }}>
                        {style ? `${style.icon} ${style.label}` : 'All priorities'}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* List */}
            {filteredIncidents.length === 0 ? (
              <div className="white-card p-12 text-center">
                <AlertTriangle size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-400 text-sm">
                  {incidents.length === 0
                    ? 'No incidents have been reported on the platform yet.'
                    : 'No incidents match your filters'}
                </p>
                {incidents.length > 0 && (
                  <button onClick={() => {
                    setIncidentSearch(''); setIncidentStatusFilter('all')
                    setIncidentPriorityFilter('all'); setIncidentBarangayFilter('all')
                  }} className="mt-2 text-xs font-semibold" style={{ color: '#5B54E8' }}>
                    Clear filters →
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-white/70 px-1">
                  Showing {filteredIncidents.length} of {incidents.length} incidents
                  {incidents.length >= INCIDENT_FEED_LIMIT && ` (most recent ${INCIDENT_FEED_LIMIT})`}
                </p>
                <div className="space-y-2">
                  {filteredIncidents.map(inc => {
                    const cat = getCategoryMeta(inc.category)
                    const pri = PRIORITY_STYLE[inc.priority] || PRIORITY_STYLE.Medium
                    const st = INCIDENT_STATUS_STYLE[inc.status] || INCIDENT_STATUS_STYLE.pending
                    const standing = computeStanding(inc)
                    const standingStyle = STANDING_STYLE[standing.level]
                    const basis = getBasis(inc.category)
                    return (
                      <div key={inc.id} className="white-card p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: cat.bg }}>
                            <span aria-hidden="true">{cat.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-gray-800 text-sm truncate">{inc.title}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: pri.bg, color: pri.color }}>
                                {pri.icon} {pri.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: st.bg, color: st.color }}>
                                {st.label}
                              </span>
                              {standing.aged && standingStyle && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                  style={{ background: standingStyle.bg, color: standingStyle.color, border: `1px solid ${standingStyle.border}` }}>
                                  {standing.label}
                                </span>
                              )}
                            </div>

                            {/* The cross-barangay line — this is what the
                                barangay-scoped dashboards cannot show. */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Building2 size={11} className="text-gray-400 flex-shrink-0" />
                              <p className="text-xs font-semibold truncate" style={{ color: '#5B54E8' }}>
                                {inc.barangays?.name || 'Unassigned barangay'}
                                {inc.barangays?.city && (
                                  <span className="font-normal text-gray-400">
                                    {' · '}{inc.barangays.city}, {inc.barangays.province}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1">
                              <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                              <p className="text-xs text-gray-500 truncate">{inc.location}</p>
                            </div>

                            {basis?.law && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Scale size={11} className="flex-shrink-0" style={{ color: '#5B54E8' }} />
                                <p className="text-[11px] text-gray-500 truncate">
                                  {inc.legal_basis || `${basis.law}${basis.sections ? `, ${basis.sections}` : ''} — ${basis.lawTitle}`}
                                </p>
                              </div>
                            )}

                            <p className="text-[11px] text-gray-400 mt-1.5" title={fullDate(inc.created_at)}>
                              Reported {timeAgo(inc.created_at)}
                              {inc.profiles?.full_name && ` by ${inc.profiles.full_name}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            </> : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Incident analytics</h2>
                    <p className="text-xs text-white/75">Platform-wide summary grouped by barangay, category, and month.</p>
                  </div>
                  <button onClick={() => loadIncidentAnalytics(true)} disabled={loadingIncidentAnalytics}
                    className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold disabled:opacity-60"
                    style={{ color: '#5B54E8' }}>
                    <RefreshCw size={13} className={loadingIncidentAnalytics ? 'animate-spin' : ''} />
                    Refresh analytics
                  </button>
                </div>

                {loadingIncidentAnalytics ? (
                  <div className="white-card flex items-center justify-center gap-3 p-12 text-sm text-gray-500">
                    <Loader2 size={18} className="animate-spin" style={{ color: '#5B54E8' }} />
                    Loading all incident records…
                  </div>
                ) : incidentAnalyticsError ? (
                  <div className="white-card p-8 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-semibold text-gray-700">Analytics could not be loaded</p>
                    <p className="mt-1 text-xs text-gray-500">{incidentAnalyticsError}</p>
                    <button onClick={() => loadIncidentAnalytics(true)} className="mt-3 rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: '#5B54E8' }}>
                      Try again
                    </button>
                  </div>
                ) : incidentAnalytics ? (
                  <>
                    <p className="px-1 text-xs text-white/75">All {incidentAnalytics.total} incident records loaded across {incidentAnalytics.barangays.length} registered barangays.</p>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: 'All reports', value: incidentAnalytics.total, color: '#5B54E8' },
                        { label: 'Open reports', value: incidentAnalytics.open, color: '#f97316' },
                        { label: 'Resolved', value: incidentAnalytics.resolved, color: '#22c55e' },
                        { label: 'Critical open', value: incidentAnalytics.critical, color: '#dc2626' },
                      ].map(stat => (
                        <div key={stat.label} className="white-card min-w-0 p-4">
                          <p className="text-xs text-gray-400">{stat.label}</p>
                          <p className="mt-1 text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                      <section className="white-card min-w-0 p-5">
                        <h3 className="font-bold text-gray-800">Reports by month</h3>
                        <p className="mb-4 mt-1 text-xs text-gray-400">Created during the latest six calendar months</p>
                        <div className="flex h-36 items-end gap-2" role="img" aria-label="Incident reports by month for the latest six months">
                          {incidentAnalytics.monthly.map(month => {
                            const maximum = Math.max(1, ...incidentAnalytics.monthly.map(item => item.total))
                            const height = month.total ? Math.max(8, (month.total / maximum) * 100) : 3
                            return (
                              <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                                <span className="text-[10px] font-semibold text-gray-500">{month.total}</span>
                                <div className="w-full rounded-t-lg" style={{ height: `${height}%`, minHeight: 3, background: 'linear-gradient(180deg, #7c75f0, #5B54E8)' }} />
                                <span className="text-center text-[9px] text-gray-400">{month.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      <section className="white-card min-w-0 p-5">
                        <h3 className="font-bold text-gray-800">Reports by category</h3>
                        <p className="mb-4 mt-1 text-xs text-gray-400">All reported incident categories</p>
                        {incidentAnalytics.categories.length === 0 ? <p className="text-sm text-gray-400">No category data yet.</p> : (
                          <div className="space-y-3">
                            {incidentAnalytics.categories.slice(0, 8).map(category => (
                              <div key={category.name}>
                                <div className="mb-1 flex justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate text-gray-600">{category.name}</span>
                                  <span className="font-bold text-gray-700">{category.total}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, (category.total / incidentAnalytics.total) * 100)}%`, background: '#5B54E8' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <section className="white-card min-w-0 overflow-hidden p-5">
                      <h3 className="font-bold text-gray-800">Incident reports by barangay</h3>
                      <p className="mb-4 mt-1 text-xs text-gray-400">Every registered barangay, including those with no reports, ranked by total reports</p>
                      {incidentAnalytics.barangays.length === 0 ? <p className="text-sm text-gray-400">No incident reports yet.</p> : (
                        <div className="max-h-[480px] overflow-auto">
                          <table className="w-full min-w-[600px] text-left text-xs">
                            <thead className="sticky top-0 bg-white text-gray-400">
                              <tr>
                                <th className="py-2 pr-3 font-semibold">Barangay</th>
                                <th className="py-2 pr-3 font-semibold">City / Municipality</th>
                                <th className="py-2 pr-3 text-right font-semibold">Reports</th>
                                <th className="py-2 pr-3 text-right font-semibold">Open</th>
                                <th className="py-2 text-right font-semibold">Critical open</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incidentAnalytics.barangays.map(barangay => (
                                <tr key={barangay.id} className="border-t border-gray-100">
                                  <td className="py-3 pr-3 font-semibold text-gray-700">{barangay.name}</td>
                                  <td className="py-3 pr-3 text-gray-500">{[barangay.city, barangay.province].filter(Boolean).join(', ') || '—'}</td>
                                  <td className="py-3 pr-3 text-right font-bold text-gray-700">{barangay.total}</td>
                                  <td className="py-3 pr-3 text-right text-orange-600">{barangay.open}</td>
                                  <td className="py-3 text-right text-red-600">{barangay.critical}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="white-card p-8 text-center text-sm text-gray-500">Open this view to load analytics for all incidents.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INVITE CODES TAB */}
        {activeTab === 'codes' && (
          <div className="space-y-4 fade-up">
            <div className="white-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: '#f0effe' }}>
                  <KeyRound size={18} style={{ color: '#5B54E8' }} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Quick Code Generator</h3>
                  <p className="text-xs text-gray-400">Generate invite codes for any barangay</p>
                </div>
              </div>

              {/* Search by barangay name, then narrow by location. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-500 mb-1.5">Barangay name</span>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={barangaySearch} onChange={e => {
                      setBarangaySearch(e.target.value)
                      setBarangayPage(1)
                      setBarangayResults([])
                      setBarangayHasMore(false)
                    }}
                      aria-label="Search by barangay name"
                      placeholder="e.g. Poblacion"
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-2.5 text-sm text-gray-800" />
                  </div>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-500 mb-1.5">City / Municipality</span>
                  <input value={barangayCitySearch} onChange={e => {
                    setBarangayCitySearch(e.target.value)
                    setBarangayPage(1)
                    setBarangayResults([])
                    setBarangayHasMore(false)
                  }}
                    aria-label="Filter by city or municipality"
                    placeholder="e.g. Toledo"
                    className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-500 mb-1.5">Province</span>
                  <input value={barangayProvinceSearch} onChange={e => {
                    setBarangayProvinceSearch(e.target.value)
                    setBarangayPage(1)
                    setBarangayResults([])
                    setBarangayHasMore(false)
                  }}
                    aria-label="Filter by province"
                    placeholder="Optional, e.g. Cebu"
                    className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800" />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 mb-3 min-h-5">
                <p className="text-xs text-gray-400">
                  Fill in multiple fields to narrow the results. For example: Poblacion + Toledo + Cebu.
                </p>
                {searchingBarangays && <Loader2 size={15} className="text-gray-400 animate-spin flex-shrink-0" aria-label="Searching barangays" />}
              </div>

              <div className="space-y-2">
                {barangayResults.length === 0 && !searchingBarangays && (
                  <div className="text-center py-6">
                    <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">
                      {barangaySearch || barangayCitySearch || barangayProvinceSearch
                        ? 'No barangays match these filters. Try removing a filter or checking the spelling.'
                        : 'No barangays found'}
                    </p>
                  </div>
                )}
                {barangayResults.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: '#fafafa', border: '1px solid #f0effe' }}>
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.name}</p>
                      <p className="text-xs text-gray-400 truncate">{b.city}, {b.province}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => generateCustomCode(b.id, 'official')} disabled={processing || searchingBarangays}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                        + Official
                      </button>
                      <button onClick={() => generateCustomCode(b.id, 'tanod')} disabled={processing || searchingBarangays}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                        + Tanod
                      </button>
                    </div>
                  </div>
                ))}
                {(barangayPage > 1 || barangayHasMore) && (
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <button onClick={() => setBarangayPage(page => Math.max(1, page - 1))}
                      disabled={barangayPage === 1 || searchingBarangays}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                      style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                      ← Previous
                    </button>
                    <p className="text-xs text-gray-400" aria-live="polite">
                      Page {barangayPage}{searchingBarangays ? ' · Loading…' : ''}
                    </p>
                    <button onClick={() => setBarangayPage(page => page + 1)}
                      disabled={!barangayHasMore || searchingBarangays}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                      style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="white-card p-5">
              <h3 className="font-bold text-gray-800 mb-4">Recent Invite Codes</h3>
              <div className="space-y-2">
                {inviteCodes.slice(0, 30).map(code => (
                  <div key={code.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: code.used ? '#f9fafb' : '#f0effe', border: `1px solid ${code.used ? '#e5e7eb' : '#e8e3ff'}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold" style={{ color: code.used ? '#9ca3af' : '#5B54E8' }}>
                          {code.code}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          code.role === 'official' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>{code.role}</span>
                        {code.used && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">used</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{code.barangays?.name}</p>
                    </div>
                    {!code.used && (
                      <button onClick={() => copyToClipboard(code.code)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white flex-shrink-0">
                        <Copy size={12} style={{ color: '#5B54E8' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BARANGAYS TAB */}
        {activeTab === 'barangays' && (
          <div className="white-card p-5 fade-up">
            <h3 className="font-bold text-gray-800 mb-4">Active Barangays ({totalBarangaysWithUsers})</h3>
            <div className="space-y-2">
              {Array.from(new Set(users.map(u => u.barangay_id))).filter(Boolean).map(bId => {
                const b = users.find(u => u.barangay_id === bId)?.barangays
                const usersInBarangay = users.filter(u => u.barangay_id === bId)
                const officialsCount = usersInBarangay.filter(u => u.role === 'official').length
                const tanodCount = usersInBarangay.filter(u => u.role === 'tanod').length
                const residentCount = usersInBarangay.filter(u => u.role === 'resident').length

                return (
                  <div key={bId} className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{ background: '#fafafa', border: '1px solid #f0effe' }}>
                    <Building2 size={16} style={{ color: '#5B54E8' }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{b?.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-orange-600 font-semibold">{officialsCount} officials</span>
                        <span className="text-green-600 font-semibold">{tanodCount} tanods</span>
                        <span className="text-purple-600 font-semibold">{residentCount} residents</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4 fade-up">

            {/* Stats by role */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { role: 'resident', label: 'Residents' },
                { role: 'official', label: 'Officials' },
                { role: 'tanod', label: 'Tanods' },
              ].map(r => {
                const rc = ROLE_CONFIG[r.role]
                const count = users.filter(u => u.role === r.role).length
                return (
                  <div key={r.role} className="white-card p-4 text-center">
                    <div className="w-10 h-10 rounded-2xl mx-auto mb-2 flex items-center justify-center"
                      style={{ background: rc.bg }}>
                      <Users size={16} style={{ color: rc.color }} />
                    </div>
                    <p className="text-2xl font-black" style={{ color: rc.color }}>{count}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Users list */}
            <div className="white-card p-5">
              <h3 className="font-bold text-gray-800 mb-4">Barangay Users ({users.length}{users.length >= 100 ? '+' : ''})</h3>
              {users.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No users yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map(u => {
                    const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.resident
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: '#fafafa', border: '1px solid #f0effe' }}>
                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                          style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}99)` }}>
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name || 'User avatar'} className="w-full h-full object-cover" />
                          ) : (
                            u.full_name?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.barangays?.name || 'No barangay'}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                          style={{ background: rc.bg, color: rc.color }}>
                          {u.role}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Rejection Modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => setReviewing(null)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1"
            style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                  <XCircle size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Reject Application</h2>
                  <p className="text-xs text-gray-400">{reviewing.full_name}</p>
                </div>
              </div>

              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={4} maxLength={300}
                placeholder="Explain why this application is being rejected..."
                className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800 resize-none" />
              <p className="text-xs text-gray-400 text-right mt-1">{rejectReason.length}/300</p>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setReviewing(null); setRejectReason('') }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold transition-colors hover:bg-gray-50"
                  style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
                  Cancel
                </button>
                <button onClick={() => handleReject(reviewing, rejectReason)}
                  disabled={!rejectReason.trim() || processing}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 32px rgba(239,68,68,0.4)' }}>
                  {processing ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve anyway confirmation (replaces window.confirm for consistent UI) */}
      <ConfirmDialog
        open={!!approveConfirm}
        onClose={() => setApproveConfirm(null)}
        onConfirm={() => {
          const app = approveConfirm?.app
          setApproveConfirm(null)
          if (app) doApprove(app)
        }}
        title="Barangay already has an official"
        message={`This barangay already has ${approveConfirm?.officialCount} official${approveConfirm?.officialCount === 1 ? '' : 's'}. Generate another official code anyway?`}
        confirmText="Yes, Generate Code"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Logout Confirmation */}
      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign out of Super Admin?"
        message="Are you sure you want to sign out? You'll need to log in again to access the admin panel."
        confirmText="Yes, Sign Out"
        cancelText="Stay Signed In"
        variant="logout"
      />
    </div>
  )
}
