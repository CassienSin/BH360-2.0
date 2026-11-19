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
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Segmented } from '@/components/ui/segmented'
import { Muted } from '@/components/ui/text'
import { Avatar } from '@/components/ui/avatar'
import { SearchBox, FilterSelect } from '@/components/official/Toolbar'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { useSidebarState } from '@/lib/useSidebarState'
import { isPhoneLayout } from '@/lib/layout'
import { useNotifications } from '@/lib/useNotifications'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import { useUrlSection } from '@/lib/useUrlSection'
import { createClient } from '@/lib/supabase'
import { Copy, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { getBasis } from '@/lib/legalBasis'
import { computeStanding } from '@/lib/triage'
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

const PRIORITY_TONE = { Critical: 'danger', High: 'warn' }
const ROLE_LABEL = { official: 'Official', tanod: 'Tanod', resident: 'Resident' }

/** A3 rows: where a report stands, in one plain label (read-only view). */
function adminIncidentRow(inc) {
  const resolved = inc.status === 'resolved'
  const standing = resolved ? null : computeStanding(inc)
  let status = 'Waiting'
  let tone = inc.priority === 'Critical' ? 'danger' : 'warn'
  if (resolved) { status = 'Resolved'; tone = 'quiet' }
  else if (inc.arrived_at) { status = 'On scene'; tone = 'ok' }
  else if (inc.acknowledged_at) { status = 'On the way'; tone = 'ok' }
  else if (inc.status === 'assigned') { status = 'Dispatched'; tone = 'info' }
  if (standing?.aged) { status = standing.label; tone = standing.level >= 2 ? 'danger' : 'warn' }
  const basis = getBasis(inc.category)
  return {
    status, tone,
    critical: inc.priority === 'Critical' && !resolved,
    basis: inc.legal_basis || (basis?.law ? `${basis.law}${basis.sections ? `, ${basis.sections}` : ''}: ${basis.lawTitle}` : null),
  }
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
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('open')
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('all')
  const [incidentBarangayFilter, setIncidentBarangayFilter] = useState('all')
  const [incidentView, setIncidentView] = useState('list')
  const [userRole, setUserRole] = useState('all')
  const [userSearch, setUserSearch] = useState('')
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

  const shownUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter(u => (userRole === 'all' || u.role === userRole) &&
      (!q || u.full_name?.toLowerCase().includes(q) || u.barangays?.name?.toLowerCase().includes(q)))
  }, [users, userRole, userSearch])

  const filteredIncidents = useMemo(() => {
    const q = incidentSearch.trim().toLowerCase()
    return incidents.filter(i => {
      if (incidentStatusFilter === 'open' ? i.status === 'resolved' : incidentStatusFilter !== 'all' && i.status !== incidentStatusFilter) return false
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
    { label: 'Barangays', value: totalBarangaysWithUsers, note: 'with people' },
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
          { key: 'incidents', label: 'All incidents', icon: IncidentsIcon, count: incidentStats.critical || undefined, hasNew: incidentStats.critical > 0 },
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
        {activeTab === 'incidents' && (
          <div className="band-slot">
            <Segmented onBand label="Incident views" value={incidentView} onChange={v => { setIncidentView(v); if (v === 'analytics') loadIncidentAnalytics() }}
              items={[{ value: 'list', label: 'Reports' }, { value: 'analytics', label: 'Barangay analytics' }]} />
          </div>
        )}
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

            {incidentView === 'list' ? <>
            <StatStrip stats={[
              { label: 'In the feed', value: incidentStats.total, note: `the latest ${INCIDENT_FEED_LIMIT}` },
              { label: 'Unassigned', value: incidentStats.pending, note: 'waiting for a tanod' },
              { label: 'Critical open', value: incidentStats.critical, tone: incidentStats.critical ? 'danger' : 'default', note: 'not resolved' },
              { label: 'Past response time', value: incidentStats.overdue, tone: incidentStats.overdue ? 'danger' : 'default', note: 'waiting too long' },
            ]} />

            <Card className="@container !overflow-visible">
              <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
                <Segmented label="Filter by status" value={incidentStatusFilter} onChange={setIncidentStatusFilter}
                  items={[
                    { value: 'open', label: 'Open', count: incidents.filter(i => i.status !== 'resolved').length },
                    { value: 'pending', label: 'Unassigned' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'all', label: 'All' },
                  ]}
                  className="w-full @3xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
                <SearchBox value={incidentSearch} onChange={setIncidentSearch} label="Search all reports" className="min-w-48 flex-1 @5xl:max-w-64" />
                <div className="flex w-full flex-wrap gap-2 @3xl:ml-auto @3xl:w-auto">
                  <FilterSelect label="Barangay" value={incidentBarangayFilter} onChange={setIncidentBarangayFilter} className="min-w-0 flex-1 @3xl:flex-none"
                    options={[{ value: 'all', label: `All barangays · ${incidentBarangays.length}` }, ...incidentBarangays.map(b => ({ value: b.id, label: b.name }))]} />
                  <FilterSelect label="Priority" value={incidentPriorityFilter} onChange={setIncidentPriorityFilter} className="min-w-0 flex-1 @3xl:flex-none"
                    options={[{ value: 'all', label: 'Priority' }, ...['Critical', 'High', 'Medium', 'Low'].map(p => ({ value: p, label: p }))]} />
                </div>
              </div>

              {filteredIncidents.length === 0 ? (
                <div className="border-t border-line px-[18px] py-6">
                  <p className="text-sm font-bold text-ink">{incidents.length === 0 ? 'No reports on the platform yet' : 'Nothing matches'}</p>
                  {incidents.length > 0 && (
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => {
                      setIncidentSearch(''); setIncidentStatusFilter('all')
                      setIncidentPriorityFilter('all'); setIncidentBarangayFilter('all')
                    }}>Clear filters</Button>
                  )}
                </div>
              ) : (
                <>
                  <table className="hidden w-full table-fixed border-collapse text-left @3xl:table">
                    <thead>
                      <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                        <th scope="col" className="py-2.5 pl-[18px] font-bold">Report</th>
                        <th scope="col" className="w-[28%] px-3 py-2.5 font-bold">Barangay</th>
                        <th scope="col" className="w-[96px] px-3 py-2.5 font-bold">Priority</th>
                        <th scope="col" className="w-[150px] px-3 py-2.5 font-bold">Status</th>
                        <th scope="col" className="w-[96px] py-2.5 pr-[18px] font-bold">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIncidents.map(inc => {
                        const row = adminIncidentRow(inc)
                        return (
                          <tr key={inc.id} className={`border-t border-line ${row.critical ? 'bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))]' : ''}`}
                            title={row.basis || undefined}>
                            <td className="min-w-0 py-3 pl-[18px]">
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span className="shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={18} /></span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-bold text-ink">{inc.title}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{[inc.location, inc.profiles?.full_name && `by ${inc.profiles.full_name}`].filter(Boolean).join(' · ')}</span>
                                </span>
                              </span>
                            </td>
                            <td className="truncate px-3 py-3 text-[13px] text-body">{[inc.barangays?.name || 'No barangay', inc.barangays?.city].filter(Boolean).join(' · ')}</td>
                            <td className="px-3 py-3"><Tag tone={PRIORITY_TONE[inc.priority] || 'quiet'}>{inc.priority || 'Medium'}</Tag></td>
                            <td className="px-3 py-3"><Status tone={row.tone} className="max-w-full">{row.status}</Status></td>
                            <td className="py-3 pr-[18px] text-[13px] text-body" title={fullDate(inc.created_at)}>{timeAgo(inc.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <Rows className="border-t border-line @3xl:hidden">
                    {filteredIncidents.map(inc => {
                      const row = adminIncidentRow(inc)
                      return (
                        <Row key={inc.id} critical={row.critical} className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={20} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">{inc.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{[inc.barangays?.name || 'No barangay', timeAgo(inc.created_at)].join(' · ')}</p>
                            <span className="mt-1.5 flex flex-wrap items-center gap-2">
                              <Tag tone={PRIORITY_TONE[inc.priority] || 'quiet'}>{inc.priority || 'Medium'}</Tag>
                              <Status tone={row.tone}>{row.status}</Status>
                            </span>
                          </div>
                        </Row>
                      )
                    })}
                  </Rows>
                </>
              )}
              <p className="border-t border-line px-[18px] py-3 text-xs text-muted-foreground">
                Read-only: each barangay&rsquo;s officials handle dispatch. Showing {filteredIncidents.length} of {incidents.length}
                {incidents.length >= INCIDENT_FEED_LIMIT ? ` (the most recent ${INCIDENT_FEED_LIMIT})` : ''}.
              </p>
            </Card>
            </> : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-ink">Incident analytics</h2>
                    <p className="text-xs text-muted-foreground">Platform-wide summary grouped by barangay, category, and month.</p>
                  </div>
                  <button onClick={() => loadIncidentAnalytics(true)} disabled={loadingIncidentAnalytics}
                    className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:opacity-60">
                    <RefreshCw size={13} className={loadingIncidentAnalytics ? 'animate-spin' : ''} />
                    Refresh analytics
                  </button>
                </div>

                {loadingIncidentAnalytics ? (
                  <div className="white-card flex items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)' }} />
                    Loading all incident records…
                  </div>
                ) : incidentAnalyticsError ? (
                  <div className="white-card p-8 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-semibold text-body">Analytics could not be loaded</p>
                    <p className="mt-1 text-xs text-muted-foreground">{incidentAnalyticsError}</p>
                    <Button size="sm" className="mt-3" onClick={() => loadIncidentAnalytics(true)}>Try again</Button>
                  </div>
                ) : incidentAnalytics ? (
                  <>
                    <p className="px-1 text-xs text-muted-foreground">All {incidentAnalytics.total} incident records, across {incidentAnalytics.barangays.length} barangays using the app.</p>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: 'All reports', value: incidentAnalytics.total, color: 'var(--ink)' },
                        { label: 'Open reports', value: incidentAnalytics.open, color: 'var(--warn)' },
                        { label: 'Resolved', value: incidentAnalytics.resolved, color: 'var(--ok)' },
                        { label: 'Critical open', value: incidentAnalytics.critical, color: 'var(--danger)' },
                      ].map(stat => (
                        <div key={stat.label} className="white-card min-w-0 p-4">
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="mt-1 text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                      <section className="white-card min-w-0 p-5">
                        <h3 className="text-[15px] font-extrabold text-ink">Reports by month</h3>
                        <p className="mb-4 mt-1 text-xs text-muted-foreground">Created during the latest six calendar months</p>
                        <div className="flex h-36 items-end gap-2" role="img" aria-label="Incident reports by month for the latest six months">
                          {incidentAnalytics.monthly.map(month => {
                            const maximum = Math.max(1, ...incidentAnalytics.monthly.map(item => item.total))
                            const height = month.total ? Math.max(8, (month.total / maximum) * 100) : 3
                            return (
                              <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                                <span className="text-xs font-semibold text-muted-foreground">{month.total}</span>
                                <div className="w-full rounded-t-lg" style={{ height: `${height}%`, minHeight: 3, background: 'var(--brand-strong)' }} />
                                <span className="text-center text-[11px] text-muted-foreground">{month.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      <section className="white-card min-w-0 p-5">
                        <h3 className="text-[15px] font-extrabold text-ink">Reports by category</h3>
                        <p className="mb-4 mt-1 text-xs text-muted-foreground">All reported incident categories</p>
                        {incidentAnalytics.categories.length === 0 ? <p className="text-sm text-muted-foreground">No category data yet.</p> : (
                          <div className="space-y-3">
                            {incidentAnalytics.categories.slice(0, 8).map(category => (
                              <div key={category.name}>
                                <div className="mb-1 flex justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate text-body">{category.name}</span>
                                  <span className="font-bold text-body">{category.total}</span>
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
                      <h3 className="text-[15px] font-extrabold text-ink">Incident reports by barangay</h3>
                      <p className="mb-4 mt-1 text-xs text-muted-foreground">Every barangay with registered users or reports, ranked by total reports</p>
                      {incidentAnalytics.barangays.length === 0 ? <p className="text-sm text-muted-foreground">No incident reports yet.</p> : (
                        <div className="max-h-[480px] overflow-auto">
                          <table className="stack-table w-full md:min-w-[600px] text-left text-xs">
                            <thead className="sticky top-0 bg-surface-sunk text-muted-foreground">
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
                                  <td className="py-3 pr-3 font-semibold text-body">{barangay.name}</td>
                                  <td data-span="full" className="py-3 pr-3 text-muted-foreground">{[barangay.city, barangay.province].filter(Boolean).join(', ') || '—'}</td>
                                  <td data-label="Reports" className="py-3 pr-3 text-right font-bold text-body">{barangay.total}</td>
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
                  <div className="white-card p-8 text-center text-sm text-muted-foreground">Open this view to load analytics for all incidents.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INVITE CODES TAB */}
        {activeTab === 'codes' && (
          <div className={`grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_380px] ${tabEnter}`}>
            {/* The codes (A04) */}
            <Card>
              <CardHead title="Recent invite codes" sub="The latest 30. Each works once." />
              {inviteCodes.length === 0 ? (
                <Muted className="border-t border-line px-[18px] py-5">No codes yet. Make one with New invite code.</Muted>
              ) : (
                <Rows className="border-t border-line">
                  {inviteCodes.slice(0, 30).map(code => (
                    <Row key={code.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <code className={`font-mono text-sm font-bold tracking-[0.06em] ${code.used ? 'text-muted-foreground line-through decoration-1' : 'text-ink'}`}>{code.code}</code>
                          <Tag tone={code.role === 'official' ? 'brand' : 'quiet'}>{code.role === 'official' ? 'Official' : 'Tanod'}</Tag>
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{code.barangays?.name || '—'}</span>
                          <Status tone={code.used ? 'ok' : 'quiet'} className="shrink-0">{code.used ? 'Used' : 'Unused'}</Status>
                        </p>
                      </div>
                      {!code.used && (
                        <button type="button" onClick={() => copyToClipboard(code.code)} aria-label={`Copy code ${code.code}`}
                          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                          <Copy size={15} />
                        </button>
                      )}
                    </Row>
                  ))}
                </Rows>
              )}
            </Card>

            {/* Make a code for any barangay */}
            <Card>
              <CardHead title="New invite code" sub="Find the barangay, then make an official or tanod code." />
              <div className="space-y-2.5 border-t border-line px-[18px] py-3.5">
                <SearchBox value={barangaySearch} label="Barangay name" placeholder="Barangay name, e.g. Poblacion"
                  onChange={v => { setBarangaySearch(v); setBarangayPage(1); setBarangayResults([]); setBarangayHasMore(false) }} />
                <div className="grid grid-cols-2 gap-2">
                  <SearchBox value={barangayCitySearch} label="City or municipality" placeholder="City, e.g. Toledo"
                    onChange={v => { setBarangayCitySearch(v); setBarangayPage(1); setBarangayResults([]); setBarangayHasMore(false) }} />
                  <SearchBox value={barangayProvinceSearch} label="Province" placeholder="Province"
                    onChange={v => { setBarangayProvinceSearch(v); setBarangayPage(1); setBarangayResults([]); setBarangayHasMore(false) }} />
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {searchingBarangays && <Loader2 size={13} className="animate-spin" aria-label="Searching barangays" />}
                  Fill in more than one to narrow it down.
                </p>
              </div>
              {barangayResults.length === 0 && !searchingBarangays ? (
                <Muted className="border-t border-line px-[18px] py-4">
                  {barangaySearch || barangayCitySearch || barangayProvinceSearch ? 'No barangays match. Remove a filter or check the spelling.' : 'No barangays found.'}
                </Muted>
              ) : (
                <Rows className="border-t border-line">
                  {barangayResults.map(b => (
                    <Row key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[b.city, b.province].filter(Boolean).join(', ')}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => generateCustomCode(b.id, 'official')} disabled={processing || searchingBarangays}>+ Official</Button>
                        <Button size="sm" variant="secondary" onClick={() => generateCustomCode(b.id, 'tanod')} disabled={processing || searchingBarangays}>+ Tanod</Button>
                      </div>
                    </Row>
                  ))}
                </Rows>
              )}
              {(barangayPage > 1 || barangayHasMore) && (
                <div className="flex items-center justify-between gap-3 border-t border-line px-[18px] py-3">
                  <Button size="sm" variant="secondary" onClick={() => setBarangayPage(page => Math.max(1, page - 1))} disabled={barangayPage === 1 || searchingBarangays}>Previous</Button>
                  <p className="text-xs text-muted-foreground" aria-live="polite">Page {barangayPage}{searchingBarangays ? ' · Loading…' : ''}</p>
                  <Button size="sm" variant="secondary" onClick={() => setBarangayPage(page => page + 1)} disabled={!barangayHasMore || searchingBarangays}>Next</Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* BARANGAYS TAB (A02) */}
        {activeTab === 'barangays' && (
          <Card className={`@container ${tabEnter}`}>
            <CardHead title="Barangays with people" sub="Counts from the accounts loaded here" />
            {totalBarangaysWithUsers === 0 ? (
              <Muted className="border-t border-line px-[18px] py-5">No barangay has people on the platform yet.</Muted>
            ) : (
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                    <th scope="col" className="py-2.5 pl-[18px] font-bold">Barangay</th>
                    <th scope="col" className="w-[96px] px-3 py-2.5 font-bold">Residents</th>
                    <th scope="col" className="hidden w-[22%] px-3 py-2.5 font-bold @md:table-cell">Officials · tanods</th>
                    <th scope="col" className="hidden w-[18%] py-2.5 pr-[18px] font-bold @lg:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(users.map(u => u.barangay_id))).filter(Boolean).map(bId => {
                    const b = users.find(u => u.barangay_id === bId)?.barangays
                    const inBarangay = users.filter(u => u.barangay_id === bId)
                    const count = role => inBarangay.filter(u => u.role === role).length
                    return (
                      <tr key={bId} className="border-t border-line">
                        <td className="min-w-0 py-3 pl-[18px]">
                          <p className="truncate text-sm font-bold text-ink">{b?.name || 'Unnamed barangay'}</p>
                          <p className="truncate text-xs text-muted-foreground">{[b?.city, b?.province].filter(Boolean).join(', ') || '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-body tabular-nums">{count('resident')}</td>
                        <td className="hidden px-3 py-3 text-[13px] text-body tabular-nums @md:table-cell">{count('official')} · {count('tanod')}</td>
                        <td className="hidden py-3 pr-[18px] @lg:table-cell"><Status tone="ok">Active</Status></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {/* USERS TAB (A05) */}
        {activeTab === 'users' && (
          <Card className={`@container ${tabEnter}`}>
            <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
              <Segmented label="Show" value={userRole} onChange={setUserRole}
                items={[
                  { value: 'all', label: 'Everyone' },
                  { value: 'official', label: 'Officials', count: users.filter(u => u.role === 'official').length },
                  { value: 'tanod', label: 'Tanods', count: users.filter(u => u.role === 'tanod').length },
                  { value: 'resident', label: 'Residents', count: users.filter(u => u.role === 'resident').length },
                ]}
                className="w-full @2xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
              <SearchBox value={userSearch} onChange={setUserSearch} label="Search people" className="min-w-44 flex-1 @3xl:max-w-64" />
            </div>
            {shownUsers.length === 0 ? (
              <Muted className="border-t border-line px-[18px] py-5">{users.length === 0 ? 'Nobody yet.' : 'Nobody matches.'}</Muted>
            ) : (
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                    <th scope="col" className="py-2.5 pl-[18px] font-bold">Name</th>
                    <th scope="col" className="w-[110px] px-3 py-2.5 font-bold">Role</th>
                    <th scope="col" className="hidden w-[30%] py-2.5 pr-[18px] font-bold @xl:table-cell">Barangay</th>
                  </tr>
                </thead>
                <tbody>
                  {shownUsers.map(u => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="min-w-0 py-2.5 pl-[18px]">
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar name={u.full_name} src={u.avatar_url} size="sm" tone={u.role === 'tanod' ? 'ok' : 'brand'} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-ink">{u.full_name || 'No name given'}</span>
                            <span className="block truncate text-xs text-muted-foreground @xl:hidden">{u.barangays?.name || 'No barangay'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><Tag tone={u.role === 'resident' ? 'quiet' : u.role === 'tanod' ? 'ok' : 'brand'}>{ROLE_LABEL[u.role] || u.role}</Tag></td>
                      <td className="hidden truncate py-2.5 pr-[18px] text-[13px] text-body @xl:table-cell">{u.barangays?.name || 'No barangay'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="border-t border-line px-[18px] py-3 text-xs text-muted-foreground">
              Showing {shownUsers.length} of {users.length}{users.length >= 100 ? '+ (the newest 100)' : ''}.
            </p>
          </Card>
        )}

      </div>
    </DashboardFrame>

      {/* Decline, with the reason the applicant will see */}
      {reviewing && (
        <div className="fixed inset-0 z-50 sheet-overlay bg-[var(--scrim)] [animation:sheetFade_.2s_ease_both]"
          onClick={() => setReviewing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="decline-title"
            className="sheet-panel relative flex max-w-md flex-col overflow-hidden bg-surface shadow-[var(--shadow-float)] [animation:sheetUp_.32s_var(--ease-sheet)_both] sm:border sm:border-line"
            onClick={e => e.stopPropagation()}>
            <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
            <div className="px-[18px] pt-3.5 pb-1 sm:pt-[18px]">
              <h2 id="decline-title" className="text-[17px] font-extrabold text-ink">Decline the application</h2>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{[reviewing.barangays?.name && `Brgy. ${reviewing.barangays.name}`, reviewing.full_name].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="px-[18px] py-4">
              <label htmlFor="decline-reason" className="mb-2 block text-[13px] font-bold text-ink">Why? The applicant sees this.</label>
              <textarea id="decline-reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={4} maxLength={300}
                placeholder="For example: we could not confirm the barangay resolution"
                className="w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted-foreground focus:border-brand-strong" />
              <p className="mt-1.5 text-xs text-muted-foreground">{rejectReason.length} of 300</p>
            </div>
            <div className="flex gap-2.5 border-t border-line px-[18px] pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
              <Button variant="secondary" size="lg" onClick={() => { setReviewing(null); setRejectReason('') }}>Cancel</Button>
              <Button variant="danger" size="lg" className="flex-1" onClick={() => handleReject(reviewing, rejectReason)}
                disabled={!rejectReason.trim() || processing} aria-busy={processing || undefined}>
                {processing ? 'Declining…' : 'Decline'}
              </Button>
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
