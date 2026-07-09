'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, Inbox, CheckCircle, XCircle, Clock, Mail, Phone, MapPin, MessageSquare, Copy, Search, Users, Building2, Loader2, KeyRound, ArrowLeft, Sparkles, LogOut, RefreshCw, Bell } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'

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
  const [searchingBarangays, setSearchingBarangays] = useState(false)
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
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
    const [appsRes, usersRes, codesRes] = await Promise.all([
      supabase.from('barangay_applications')
        .select('*, barangays(name, city, province)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('*, barangays(name)')
        .or('is_super_admin.is.null,is_super_admin.eq.false')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('invite_codes')
        .select('*, barangays(name)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const firstError = appsRes.error || usersRes.error || codesRes.error
    if (firstError) {
      toast.error('Some data failed to load: ' + firstError.message)
    }

    setApplications(appsRes.data || [])
    setUsers(usersRes.data || [])
    setInviteCodes(codesRes.data || [])
  }, [supabase])

  // Debounced server-side barangay search. This scales to any table size —
  // we never try to load every barangay into the browser (Supabase caps
  // selects at 1,000 rows anyway). Empty search shows the first 20 by name.
  useEffect(() => {
    if (loading) return
    // Strip characters that would break the PostgREST .or() filter syntax
    const q = barangaySearch.trim().replace(/[,()%]/g, '')
    setSearchingBarangays(true)
    const t = setTimeout(async () => {
      let query = supabase.from('barangays')
        .select('id, name, city, province')
        .order('name')
        .limit(20)
      if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,province.ilike.%${q}%`)
      const { data, error } = await query
      if (error) toast.error('Barangay search failed: ' + error.message)
      setBarangayResults(data || [])
      setSearchingBarangays(false)
    }, 300)
    return () => clearTimeout(t)
  }, [barangaySearch, loading, supabase])

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

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: 'applications', label: 'Applications', icon: Inbox, count: pendingCount },
            { value: 'codes', label: 'Invite Codes', icon: KeyRound },
            { value: 'barangays', label: 'Barangays', icon: Building2 },
            { value: 'users', label: 'Users', icon: Users },
          ].map(({ value, label, icon: Icon, count }) => (
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
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <div className="space-y-3 fade-up">
            {/* Filters */}
            <div className="white-card p-4">
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
                <div key={app.id} className="white-card p-5">
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
                      <span className="font-semibold" style={{ color: '#5B54E8' }}>
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

              {/* Search — results come from the database, not a preloaded list */}
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={barangaySearch} onChange={e => setBarangaySearch(e.target.value)}
                  placeholder="Search barangay, city, or province..."
                  className="input-field w-full rounded-2xl pl-10 pr-10 py-2.5 text-sm text-gray-800" />
                {searchingBarangays && (
                  <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>

              <div className="space-y-2">
                {barangayResults.length === 0 && !searchingBarangays && (
                  <div className="text-center py-6">
                    <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">
                      {barangaySearch ? `No barangays match "${barangaySearch}"` : 'No barangays found'}
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
                      <button onClick={() => generateCustomCode(b.id, 'official')} disabled={processing}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                        + Official
                      </button>
                      <button onClick={() => generateCustomCode(b.id, 'tanod')} disabled={processing}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                        + Tanod
                      </button>
                    </div>
                  </div>
                ))}
                {barangayResults.length === 20 && (
                  <p className="text-xs text-gray-400 text-center pt-2">
                    Showing first 20 matches — refine your search to narrow down
                  </p>
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