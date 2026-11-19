'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { DashboardShellSkeleton } from '@/components/Skeletons'
import { DASHBOARD_SKELETONS } from '@/lib/dashboardSkeletons'
import ClientBoundary from '@/components/ClientBoundary'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardHeader from '@/components/DashboardHeader'
import { DashboardIcon, IncidentsIcon, ResidentIcon, UsersIcon, VerificationsIcon } from '@/components/icons/BhIcons'
import { Button } from '@/components/ui/button'
import { StatStrip } from '@/components/ui/stat-strip'
import ApplicationsSection from '@/components/admin/ApplicationsSection'
import { useSidebarState } from '@/lib/useSidebarState'
import { isPhoneLayout } from '@/lib/layout'
import { useNotifications } from '@/lib/useNotifications'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import { useUrlSection } from '@/lib/useUrlSection'
import { createClient } from '@/lib/supabase'
import { XCircle, MapPin, Copy, Search, Users, Building2, Loader2, KeyRound, RefreshCw, AlertTriangle, Scale, X, BarChart3 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { PRIORITY_STYLE, getCategoryMeta, getBasis } from '@/lib/legalBasis'
import { computeStanding, STANDING_STYLE } from '@/lib/triage'
import { firstRealError } from '@/lib/dbError'
import { SITE_URL } from '@/lib/siteUrl'
import { subscribeWhenSignedIn } from '@/lib/realtime'



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

// The invite email, ready to send from the admin's own inbox — the app
// has no email service of its own.
function inviteEmail(app) {
  const barangay = app.barangays?.name ? `Barangay ${app.barangays.name}` : 'your barangay'
  const subject = `Your BarangayHub 360 invite code for ${barangay}`
  const body = [
    `Hi ${app.full_name?.split(' ')[0] || 'there'},`,
    '',
    `Your request to set up ${barangay} on BarangayHub 360 has been approved.`,
    '',
    `Your official invite code: ${app.generated_code}`,
    '',
    'To create your account:',
    `1. Go to ${SITE_URL}/register`,
    '2. Choose "Barangay Official" and enter the code above',
    '3. Fill in your details and sign in',
    '',
    'Inviting your team: once you are signed in, open Users and press "Tanod Code" or "Official Code". Share each code with one person; they choose the matching role when they sign up.',
    '',
    'BarangayHub 360',
  ].join('\n')
  return { to: app.email, subject, body }
}

// Three ways out, because a mailto: link only works when the computer has
// a mail app set up — on Windows without one, Chrome/Edge open a blank tab.
function emailLinks(app) {
  const { to, subject, body } = inviteEmail(app)
  const q = (params) => new URLSearchParams(params).toString().replace(/\+/g, '%20')
  return {
    gmail: `https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', to, su: subject, body })}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?${q({ to, subject, body })}`,
    mailto: `mailto:${encodeURIComponent(to)}?${q({ subject, body })}`,
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// A broken photo link falls back to the initial instead of an empty tile.
function UserAvatar({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const initial = name?.trim()?.[0]?.toUpperCase() || '?'
  if (!src || failedSrc === src) return initial
  return <img loading="lazy" decoding="async" src={src} alt="" onError={() => setFailedSrc(src)} className="w-full h-full object-cover" />
}

const ADMIN_TABS = ['applications', 'incidents', 'codes', 'barangays', 'users']

function AdminPanel() {
  const router = useRouter()
  // Memoize so we don't construct a new client on every render.
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState(null)
  // New barangay applications, written by the database for super admins
  // (supabase/setup.sql Section 18).
  const notificationCenter = useNotifications(profile?.id)
  const [sidebarOpen, setSidebarOpen] = useSidebarState()
  // The admin belongs to no barangay: the sidebar and the context line say so.
  const adminProfile = useMemo(() => profile && { ...profile, role: 'admin', barangays: { name: 'All barangays' } }, [profile])
  const [applications, setApplications] = useState([])
  const [barangayResults, setBarangayResults] = useState([])
  const [barangaySearch, setBarangaySearch] = useState('')
  const [barangayCitySearch, setBarangayCitySearch] = useState('')
  const [barangayProvinceSearch, setBarangayProvinceSearch] = useState('')
  const [barangayPage, setBarangayPage] = useState(1)
  const [barangayHasMore, setBarangayHasMore] = useState(false)
  // Which query the results on screen belong to. While it differs from the
  // current query, a search is under way (no separate loading flag to sync).
  const [fetchedBarangayKey, setFetchedBarangayKey] = useState(null)
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
  const [loadingIncidentAnalytics, setLoadingIncidentAnalytics] = useState(false)
  const [incidentAnalyticsError, setIncidentAnalyticsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useUrlSection(ADMIN_TABS, 'applications', { param: 'tab' })
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
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
        .select('*, barangays(name, city, province)')
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
      setAnalyticsIncidents(allRows)
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
  const barangayQueryKey = [barangaySearch.trim(), barangayCitySearch.trim(), barangayProvinceSearch.trim(), barangayPage].join('|')
  const searchingBarangays = fetchedBarangayKey !== barangayQueryKey

  useEffect(() => {
    if (loading) return
    const nameQuery = barangaySearch.trim()
    const cityQuery = barangayCitySearch.trim()
    const provinceQuery = barangayProvinceSearch.trim()
    const key = [nameQuery, cityQuery, provinceQuery, barangayPage].join('|')
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
      setFetchedBarangayKey(key)
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
      if (authError || !user) return router.replace(loginHref())

      const { data: prof, error: profError } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      // NOTE: this check is UX only — a malicious user can bypass any
      // client-side gate. Real enforcement must live in RLS policies
      // (and ideally a middleware/server-component check on this route).
      if (profError || !prof?.is_super_admin) {
        toast.error('Access denied. Super admin only.')
        return router.replace(loginHref())
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
    const leaveChannel = subscribeWhenSignedIn(supabase, channel)

    return () => { leaveChannel() }
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
    // Only barangays that use the app: every one with registered users
    // (so a quiet barangay still shows its zero), plus any with reports.
    // Listing all ~42,000 PSGC barangays made this tab slow to load and
    // buried the dozen that matter.
    const barangays = new Map()
    for (const u of users) {
      if (!u.barangay_id || barangays.has(u.barangay_id)) continue
      barangays.set(u.barangay_id, {
        id: u.barangay_id,
        name: u.barangays?.name || 'Unnamed barangay',
        city: u.barangays?.city || '',
        province: u.barangays?.province || '',
        total: 0,
        open: 0,
        critical: 0,
      })
    }
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
  }, [analyticsIncidents, users])

  const totalBarangaysWithUsers = useMemo(
    () => new Set(users.map(u => u.barangay_id).filter(Boolean)).size,
    [users]
  )

  // The open tab eases in when you switch tabs, not on page load.
  const tabEnter = useSectionEntrance(activeTab, !loading) ? 'fade-up' : ''

  if (loading) return <DashboardShellSkeleton path="/admin" kind={DASHBOARD_SKELETONS['/admin'].kinds[activeTab]} sidebarOpen={sidebarOpen} banner={null} />

  // What the band says above each tab (A01–A05).
  const HEADS = {
    applications: {
      eyebrow: 'Platform · Applications', title: 'Barangays asking to join',
      desc: pendingCount
        ? `${pendingCount} application${pendingCount === 1 ? ' is' : 's are'} waiting for review. Approving one gives the applicant an official invite code.`
        : 'Nothing is waiting for review. New applications from barangays show up here.',
    },
    incidents: { eyebrow: 'Platform · Incidents', title: 'Every report, every barangay', desc: 'Watch for reports that sit too long. Dispatch stays with each barangay.' },
    codes: { eyebrow: 'Platform · Invite codes', title: 'Invite officials and tanods', desc: 'Residents sign up on their own. Officials and tanods need a code.' },
    barangays: { eyebrow: 'Platform · Barangays', title: 'Barangays on BarangayHub 360', desc: `${totalBarangaysWithUsers} barangay${totalBarangaysWithUsers === 1 ? '' : 's'} with people on the platform.` },
    users: { eyebrow: 'Platform · Users', title: 'People across all barangays', desc: `${users.length}${users.length >= 100 ? '+' : ''} accounts, newest first.` },
  }
  const head = HEADS[activeTab]

  // The platform's numbers (A02: on the band of Barangays).
  const platformStats = [
    { label: 'Applications waiting', value: pendingCount, note: `${approvedCount} approved in all`, onClick: () => setActiveTab('applications') },
    { label: 'Barangays', value: totalBarangaysWithUsers, note: 'with people on the platform' },
    { label: 'People', value: `${users.length}${users.length >= 100 ? '+' : ''}`, note: 'accounts' },
    { label: 'Open reports', value: incidentStats.pending, tone: incidentStats.critical ? 'danger' : 'default', note: `across ${incidentStats.barangays} barangay${incidentStats.barangays === 1 ? '' : 's'}`, onClick: () => setActiveTab('incidents') },
  ]

  return (
    <>
    <DashboardFrame sidebarOpen={sidebarOpen}
      sidebar={<DashboardSidebar profile={adminProfile} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeSection={activeTab} setActiveSection={key => { setActiveTab(key); if (isPhoneLayout()) setSidebarOpen(false) }}
        roleLabel="Platform admin"
        navItems={[{ section: 'PLATFORM', items: [
          { key: 'applications', label: 'Applications', icon: VerificationsIcon, count: pendingCount, hasNew: pendingCount > 0 },
          { key: 'incidents', label: 'All incidents', icon: IncidentsIcon, ...(incidentStats.critical ? { count: incidentStats.critical, badge: 'CRITICAL' } : {}) },
          { key: 'codes', label: 'Invite codes', icon: UsersIcon },
          { key: 'barangays', label: 'Barangays', icon: DashboardIcon },
          { key: 'users', label: 'Users', icon: ResidentIcon },
        ]}]} />}
      header={<DashboardHeader profile={adminProfile} columnClass="max-w-[100rem]"
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        eyebrow={head.eyebrow} sectionTitle={head.title} sectionDesc={head.desc}
        phoneTitle={{ applications: 'Applications', incidents: 'All incidents', codes: 'Invite codes', barangays: 'Barangays', users: 'Users' }[activeTab]}
        actions={<Button variant="onband" onClick={refreshData} disabled={refreshing} aria-busy={refreshing || undefined}>
          <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />Refresh
        </Button>}
        notificationCenter={notificationCenter}
        searchData={{ incidents, tickets: [], announcements: [] }}
        onSearchResultClick={() => setActiveTab('incidents')}>
        {activeTab === 'barangays' && <div className="band-slot"><StatStrip stats={platformStats} /></div>}
      </DashboardHeader>}>
      <div className="mx-auto w-full min-w-0 max-w-[100rem] space-y-3.5">

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <div className={tabEnter}>
            <ApplicationsSection apps={filteredApps} counts={{ pending: pendingCount }}
              filter={statusFilter} onFilter={setStatusFilter} search={search} onSearch={setSearch}
              processing={processing} onApprove={handleApprove} onReject={app => setReviewing(app)}
              onCopy={copyToClipboard} emailLinks={emailLinks} inviteEmail={inviteEmail} />
          </div>
        )}


        {/* ALL INCIDENTS TAB — every barangay on the platform.
            Barangay officials see only their own; this is the one view
            that spans them, so it leads with the cross-barangay numbers
            (which barangays are affected, and who is falling behind). */}
        {activeTab === 'incidents' && (
          <div className={`w-full min-w-0 space-y-3 ${tabEnter}`}>

            <div className="white-card flex w-full min-w-0 flex-wrap gap-2 p-2" role="tablist" aria-label="Incident views">
              <button role="tab" aria-selected={incidentView === 'list'} onClick={() => setIncidentView('list')}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
                style={{ background: incidentView === 'list' ? 'var(--brand)' : 'var(--app-surface)', color: incidentView === 'list' ? 'white' : '#6b7280' }}>
                <AlertTriangle size={14} /> Incident List
              </button>
              <button role="tab" aria-selected={incidentView === 'analytics'} onClick={() => {
                setIncidentView('analytics')
                loadIncidentAnalytics()
              }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
                style={{ background: incidentView === 'analytics' ? 'var(--brand)' : 'var(--app-surface)', color: incidentView === 'analytics' ? 'white' : '#6b7280' }}>
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
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-black mt-1" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="white-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={incidentSearch} onChange={e => setIncidentSearch(e.target.value)}
                    type="search"
                    aria-label="Search incidents"
                    placeholder="Search by title, barangay, city, category, or reporter..."
                    className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800" />
                  {incidentSearch && (
                    <button onClick={() => setIncidentSearch('')} aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600">
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
                        background: incidentStatusFilter === f.value ? f.color : 'var(--app-surface)',
                        color: incidentStatusFilter === f.value ? 'white' : '#6b7280',
                        border: incidentStatusFilter === f.value ? 'none' : '1px solid var(--brand-soft)',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="w-px self-stretch hidden sm:block" style={{ background: 'var(--brand-soft)' }} />
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
                          background: active ? color : 'var(--app-surface)',
                          color: active ? 'white' : '#6b7280',
                          border: active ? 'none' : '1px solid var(--brand-soft)',
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
                <p className="text-gray-500 text-sm">
                  {incidents.length === 0
                    ? 'No incidents have been reported on the platform yet.'
                    : 'No incidents match your filters'}
                </p>
                {incidents.length > 0 && (
                  <button onClick={() => {
                    setIncidentSearch(''); setIncidentStatusFilter('all')
                    setIncidentPriorityFilter('all'); setIncidentBarangayFilter('all')
                  }} className="mt-2 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
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
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{ background: pri.bg, color: pri.color }}>
                                {pri.icon} {pri.label}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{ background: st.bg, color: st.color }}>
                                {st.label}
                              </span>
                              {standing.aged && standingStyle && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                  style={{ background: standingStyle.bg, color: standingStyle.color, border: `1px solid ${standingStyle.border}` }}>
                                  {standing.label}
                                </span>
                              )}
                            </div>

                            {/* The cross-barangay line — this is what the
                                barangay-scoped dashboards cannot show. */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Building2 size={11} className="text-gray-500 flex-shrink-0" />
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--brand)' }}>
                                {inc.barangays?.name || 'Unassigned barangay'}
                                {inc.barangays?.city && (
                                  <span className="font-normal text-gray-500">
                                    {' · '}{inc.barangays.city}, {inc.barangays.province}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1">
                              <MapPin size={11} className="text-gray-500 flex-shrink-0" />
                              <p className="text-xs text-gray-500 truncate">{inc.location}</p>
                            </div>

                            {basis?.law && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Scale size={11} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
                                <p className="text-xs text-gray-500 truncate">
                                  {inc.legal_basis || `${basis.law}${basis.sections ? `, ${basis.sections}` : ''} — ${basis.lawTitle}`}
                                </p>
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-1.5" title={fullDate(inc.created_at)}>
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
                    style={{ color: 'var(--brand)' }}>
                    <RefreshCw size={13} className={loadingIncidentAnalytics ? 'animate-spin' : ''} />
                    Refresh analytics
                  </button>
                </div>

                {loadingIncidentAnalytics ? (
                  <div className="white-card flex items-center justify-center gap-3 p-12 text-sm text-gray-500">
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)' }} />
                    Loading all incident records…
                  </div>
                ) : incidentAnalyticsError ? (
                  <div className="white-card p-8 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-semibold text-gray-700">Analytics could not be loaded</p>
                    <p className="mt-1 text-xs text-gray-500">{incidentAnalyticsError}</p>
                    <button onClick={() => loadIncidentAnalytics(true)} className="mt-3 rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: 'var(--brand)' }}>
                      Try again
                    </button>
                  </div>
                ) : incidentAnalytics ? (
                  <>
                    <p className="px-1 text-xs text-white/75">All {incidentAnalytics.total} incident records, across {incidentAnalytics.barangays.length} barangays using the app.</p>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: 'All reports', value: incidentAnalytics.total, color: '#5B54E8' },
                        { label: 'Open reports', value: incidentAnalytics.open, color: '#f97316' },
                        { label: 'Resolved', value: incidentAnalytics.resolved, color: '#22c55e' },
                        { label: 'Critical open', value: incidentAnalytics.critical, color: '#dc2626' },
                      ].map(stat => (
                        <div key={stat.label} className="white-card min-w-0 p-4">
                          <p className="text-xs text-gray-500">{stat.label}</p>
                          <p className="mt-1 text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                      <section className="white-card min-w-0 p-5">
                        <h3 className="font-bold text-gray-800">Reports by month</h3>
                        <p className="mb-4 mt-1 text-xs text-gray-500">Created during the latest six calendar months</p>
                        <div className="flex h-36 items-end gap-2" role="img" aria-label="Incident reports by month for the latest six months">
                          {incidentAnalytics.monthly.map(month => {
                            const maximum = Math.max(1, ...incidentAnalytics.monthly.map(item => item.total))
                            const height = month.total ? Math.max(8, (month.total / maximum) * 100) : 3
                            return (
                              <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                                <span className="text-xs font-semibold text-gray-500">{month.total}</span>
                                <div className="w-full rounded-t-lg" style={{ height: `${height}%`, minHeight: 3, background: 'linear-gradient(180deg, var(--brand-light), var(--brand))' }} />
                                <span className="text-center text-[11px] text-gray-500">{month.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      <section className="white-card min-w-0 p-5">
                        <h3 className="font-bold text-gray-800">Reports by category</h3>
                        <p className="mb-4 mt-1 text-xs text-gray-500">All reported incident categories</p>
                        {incidentAnalytics.categories.length === 0 ? <p className="text-sm text-gray-500">No category data yet.</p> : (
                          <div className="space-y-3">
                            {incidentAnalytics.categories.slice(0, 8).map(category => (
                              <div key={category.name}>
                                <div className="mb-1 flex justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate text-gray-600">{category.name}</span>
                                  <span className="font-bold text-gray-700">{category.total}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, (category.total / incidentAnalytics.total) * 100)}%`, background: 'var(--brand)' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <section className="white-card min-w-0 overflow-hidden p-5">
                      <h3 className="font-bold text-gray-800">Incident reports by barangay</h3>
                      <p className="mb-4 mt-1 text-xs text-gray-500">Every barangay with registered users or reports, ranked by total reports</p>
                      {incidentAnalytics.barangays.length === 0 ? <p className="text-sm text-gray-500">No incident reports yet.</p> : (
                        <div className="max-h-[480px] overflow-auto">
                          <table className="stack-table w-full md:min-w-[600px] text-left text-xs">
                            <thead className="sticky top-0 bg-white text-gray-500">
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
                                  <td data-span="full" className="py-3 pr-3 text-gray-500">{[barangay.city, barangay.province].filter(Boolean).join(', ') || '—'}</td>
                                  <td data-label="Reports" className="py-3 pr-3 text-right font-bold text-gray-700">{barangay.total}</td>
                                  <td data-label="Open" className="py-3 pr-3 text-right text-orange-600">{barangay.open}</td>
                                  <td data-label="Critical open" className="py-3 text-right text-red-600">{barangay.critical}</td>
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
          <div className={`space-y-4 ${tabEnter}`}>
            <div className="white-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--brand-soft)' }}>
                  <KeyRound size={18} style={{ color: 'var(--brand)' }} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Quick Code Generator</h3>
                  <p className="text-xs text-gray-500">Generate invite codes for any barangay</p>
                </div>
              </div>

              {/* Search by barangay name, then narrow by location. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-500 mb-1.5">Barangay name</span>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
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
                <p className="text-xs text-gray-500">
                  Fill in multiple fields to narrow the results. For example: Poblacion + Toledo + Cebu.
                </p>
                {searchingBarangays && <Loader2 size={15} className="text-gray-500 animate-spin flex-shrink-0" aria-label="Searching barangays" />}
              </div>

              <div className="space-y-2">
                {barangayResults.length === 0 && !searchingBarangays && (
                  <div className="text-center py-6">
                    <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-500">
                      {barangaySearch || barangayCitySearch || barangayProvinceSearch
                        ? 'No barangays match these filters. Try removing a filter or checking the spelling.'
                        : 'No barangays found'}
                    </p>
                  </div>
                )}
                {barangayResults.map(b => (
                  <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-xl"
                    style={{ background: '#fafafa', border: '1px solid var(--brand-soft)' }}>
                    <Building2 size={14} className="text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.name}</p>
                      <p className="text-xs text-gray-500 truncate">{b.city}, {b.province}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 ml-auto">
                      <button onClick={() => generateCustomCode(b.id, 'official')} disabled={processing || searchingBarangays}
                        className="px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                        + Official
                      </button>
                      <button onClick={() => generateCustomCode(b.id, 'tanod')} disabled={processing || searchingBarangays}
                        className="px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
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
                      style={{ background: 'var(--app-surface)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
                      ← Previous
                    </button>
                    <p className="text-xs text-gray-500" aria-live="polite">
                      Page {barangayPage}{searchingBarangays ? ' · Loading…' : ''}
                    </p>
                    <button onClick={() => setBarangayPage(page => page + 1)}
                      disabled={!barangayHasMore || searchingBarangays}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                      style={{ background: 'var(--app-surface)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
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
                    style={{ background: code.used ? '#f9fafb' : 'var(--brand-soft)', border: `1px solid ${code.used ? '#e5e7eb' : 'var(--brand-border)'}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold" style={{ color: code.used ? '#9ca3af' : 'var(--brand)' }}>
                          {code.code}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                          code.role === 'official' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>{code.role}</span>
                        {code.used && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">used</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{code.barangays?.name}</p>
                    </div>
                    {!code.used && (
                      <button onClick={() => copyToClipboard(code.code)}
                        className="w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg flex items-center justify-center transition-colors hover:bg-white flex-shrink-0">
                        <Copy size={12} style={{ color: 'var(--brand)' }} />
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
          <div className={`white-card p-5 ${tabEnter}`}>
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
                    style={{ background: '#fafafa', border: '1px solid var(--brand-soft)' }}>
                    <Building2 size={16} style={{ color: 'var(--brand)' }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{b?.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-orange-700 font-semibold">{plural(officialsCount, 'official')}</span>
                        <span className="text-green-700 font-semibold">{plural(tanodCount, 'tanod')}</span>
                        <span className="text-purple-700 font-semibold">{plural(residentCount, 'resident')}</span>
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
          <div className={`space-y-4 ${tabEnter}`}>

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
                    <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
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
                  <p className="text-sm text-gray-500">No users yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map(u => {
                    const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.resident
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: '#fafafa', border: '1px solid var(--brand-soft)' }}>
                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                          style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}99)` }}>
                          <UserAvatar src={u.avatar_url} name={u.full_name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.barangays?.name || 'No barangay'}</p>
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

      </div>
    </DashboardFrame>

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
                  <p className="text-xs text-gray-500">{reviewing.full_name}</p>
                </div>
              </div>

              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={4} maxLength={300}
                placeholder="Explain why this application is being rejected..."
                className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800 resize-none" />
              <p className="text-xs text-gray-500 text-right mt-1">{rejectReason.length}/300</p>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setReviewing(null); setRejectReason('') }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold transition-colors hover:bg-gray-50"
                  style={{ background: 'var(--app-surface)', color: '#6b7280', border: '1px solid var(--brand-soft)' }}>
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

    </>
  )
}

/**
 * The tab lives in the URL (?tab=…), read with useSearchParams — see
 * components/ClientBoundary.jsx. The fallback is the dashboard frame's
 * skeleton (lib/dashboardSkeletons.js), as the page's own loading state.
 */
export default function AdminPage() {
  return (
    <ClientBoundary fallback={<DashboardShellSkeleton path="/admin" banner={null} />}>
      <AdminPanel />
    </ClientBoundary>
  )
}
