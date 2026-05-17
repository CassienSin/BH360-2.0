'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, Inbox, CheckCircle, XCircle, Clock, Mail, Phone, Briefcase, MapPin, MessageSquare, Copy, Search, Filter, Users, Building2, AlertTriangle, Loader2, KeyRound, ArrowLeft, Sparkles } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'

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

export default function AdminPanel() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [barangays, setBarangays] = useState([])
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('applications')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [reviewing, setReviewing] = useState(null) // application being reviewed
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof?.is_super_admin) {
        toast.error('Access denied. Super admin only.')
        return router.push('/login')
      }
      setProfile(prof)

      // Load applications with barangay info
      const { data: apps } = await supabase.from('barangay_applications')
        .select('*, barangays(name, city, province)')
        .order('created_at', { ascending: false })
      setApplications(apps || [])

      // Load all barangays with their user counts
      const { data: bgs } = await supabase.from('barangays')
        .select('id, name, city, province')
        .order('name')
      setBarangays(bgs || [])

      // Load all users
      const { data: allUsers } = await supabase.from('profiles')
        .select('*, barangays(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      setUsers(allUsers || [])

      // Load all invite codes
      const { data: codes } = await supabase.from('invite_codes')
        .select('*, barangays(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      setInviteCodes(codes || [])

      setLoading(false)
    }
    loadData()
  }, [])

  async function handleApprove(app) {
    // Check if barangay already has an official
    const { data: existingOfficial } = await supabase
      .from('profiles')
      .select('id')
      .eq('barangay_id', app.barangay_id)
      .eq('role', 'official')
      .limit(1)

    if (existingOfficial && existingOfficial.length > 0) {
      const confirmed = confirm(`This barangay already has ${existingOfficial.length} official(s). Generate code anyway?`)
      if (!confirmed) return
    }

    // Generate unique code
    const code = `OFFICIAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Insert invite code
    const { error: codeError } = await supabase.from('invite_codes').insert({
      code,
      role: 'official',
      barangay_id: app.barangay_id,
    })

    if (codeError) {
      toast.error('Failed to generate code: ' + codeError.message)
      return
    }

    // Update application
    const { error: updateError } = await supabase.from('barangay_applications').update({
      status: 'approved',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      generated_code: code,
    }).eq('id', app.id)

    if (updateError) {
      toast.error('Failed to update application')
      return
    }

    setApplications(prev => prev.map(a =>
      a.id === app.id ? { ...a, status: 'approved', generated_code: code, reviewed_at: new Date().toISOString() } : a
    ))

    // Reload codes
    const { data: codes } = await supabase.from('invite_codes')
      .select('*, barangays(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setInviteCodes(codes || [])

    setReviewing(null)
    toast.success(`Approved! Code: ${code}`, { duration: 6000 })
  }

  async function handleReject(app, reason) {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    const { error } = await supabase.from('barangay_applications').update({
      status: 'rejected',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    }).eq('id', app.id)

    if (error) {
      toast.error('Failed to reject application')
      return
    }

    setApplications(prev => prev.map(a =>
      a.id === app.id ? { ...a, status: 'rejected', rejection_reason: reason.trim(), reviewed_at: new Date().toISOString() } : a
    ))

    setReviewing(null)
    setRejectReason('')
    toast.success('Application rejected')
  }

  async function generateCustomCode(barangayId, role) {
    const code = `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const { data, error } = await supabase.from('invite_codes').insert({
      code,
      role,
      barangay_id: barangayId,
    }).select('*, barangays(name)').single()

    if (error) {
      toast.error('Failed to generate code')
      return
    }

    setInviteCodes(prev => [data, ...prev])
    toast.success(`Code generated: ${code}`, { duration: 6000 })
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const filteredApps = applications.filter(a => {
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    const matchesSearch = !search ||
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()) ||
      a.barangays?.name?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const pendingCount = applications.filter(a => a.status === 'pending').length
  const approvedCount = applications.filter(a => a.status === 'approved').length
  const rejectedCount = applications.filter(a => a.status === 'rejected').length

  const barangaysWithOfficials = new Set(users.filter(u => u.role === 'official').map(u => u.barangay_id))
  const totalBarangaysWithUsers = new Set(users.map(u => u.barangay_id)).size

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
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
      </div>

      <header className="bg-white relative z-10 px-4 sm:px-6 py-4 flex items-center gap-3"
        style={{boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.push('/')}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{background: 'linear-gradient(135deg, #1f2937, #374151)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'}}>
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
              Super Admin Panel
              <Sparkles size={14} style={{color: '#f59e0b'}} />
            </h1>
            <p className="text-xs text-gray-400">System administration · {profile?.full_name}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{background: '#fff7ed'}}>
                <Inbox size={14} className="text-orange-500" />
              </div>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <p className="text-2xl font-black" style={{color: '#f97316'}}>{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Applications</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{background: '#f0fdf4'}}>
                <CheckCircle size={14} className="text-emerald-500" />
              </div>
              <p className="text-xs text-gray-400">Approved</p>
            </div>
            <p className="text-2xl font-black" style={{color: '#22c55e'}}>{approvedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total approved</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{background: '#f0effe'}}>
                <Building2 size={14} style={{color: '#5B54E8'}} />
              </div>
              <p className="text-xs text-gray-400">Active</p>
            </div>
            <p className="text-2xl font-black" style={{color: '#5B54E8'}}>{totalBarangaysWithUsers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Barangays w/ users</p>
          </div>

          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{background: '#eff6ff'}}>
                <Users size={14} className="text-blue-500" />
              </div>
              <p className="text-xs text-gray-400">Total Users</p>
            </div>
            <p className="text-2xl font-black" style={{color: '#3b82f6'}}>{users.length}</p>
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
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
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
                      style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                      <Mail size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{app.email}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                      <Phone size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{app.phone}</span>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{background: '#f0effe', border: '1px solid #e8e3ff'}}>
                      <MapPin size={12} style={{color: '#5B54E8'}} className="flex-shrink-0" />
                      <span className="font-semibold" style={{color: '#5B54E8'}}>
                        {app.barangays?.name}, {app.barangays?.city}, {app.barangays?.province}
                      </span>
                    </div>
                  </div>

                  {app.message && (
                    <div className="p-3 rounded-xl mb-3" style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <MessageSquare size={10} /> Message
                      </p>
                      <p className="text-xs text-gray-700 italic">"{app.message}"</p>
                    </div>
                  )}

                  {app.status === 'approved' && app.generated_code && (
                    <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
                      style={{background: '#f0fdf4', border: '1px solid #dcfce7'}}>
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
                      style={{background: '#fef2f2', border: '1px solid #fecaca'}}>
                      <XCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Rejection Reason</p>
                        <p className="text-xs text-red-900 mt-0.5">{app.rejection_reason}</p>
                      </div>
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(app)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02]"
                        style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 12px rgba(34,197,94,0.3)'}}>
                        <CheckCircle size={12} /> Approve & Generate Code
                      </button>
                      <button onClick={() => setReviewing(app)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-red-100"
                        style={{background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'}}>
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
                  style={{background: '#f0effe'}}>
                  <KeyRound size={18} style={{color: '#5B54E8'}} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Quick Code Generator</h3>
                  <p className="text-xs text-gray-400">Generate invite codes for any barangay</p>
                </div>
              </div>

              <div className="space-y-2">
                {barangays.slice(0, 20).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{background: '#fafafa', border: '1px solid #f0effe'}}>
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.name}</p>
                      <p className="text-xs text-gray-400 truncate">{b.city}, {b.province}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => generateCustomCode(b.id, 'official')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa'}}>
                        + Official
                      </button>
                      <button onClick={() => generateCustomCode(b.id, 'tanod')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7'}}>
                        + Tanod
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="white-card p-5">
              <h3 className="font-bold text-gray-800 mb-4">Recent Invite Codes</h3>
              <div className="space-y-2">
                {inviteCodes.slice(0, 30).map(code => (
                  <div key={code.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{background: code.used ? '#f9fafb' : '#f0effe', border: `1px solid ${code.used ? '#e5e7eb' : '#e8e3ff'}`}}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold" style={{color: code.used ? '#9ca3af' : '#5B54E8'}}>
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
                        <Copy size={12} style={{color: '#5B54E8'}} />
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
                    style={{background: '#fafafa', border: '1px solid #f0effe'}}>
                    <Building2 size={16} style={{color: '#5B54E8'}} className="flex-shrink-0" />
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
          <div className="white-card p-5 fade-up">
            <h3 className="font-bold text-gray-800 mb-4">Recent Users ({users.length})</h3>
            <div className="space-y-2">
              {users.map(u => {
                const roleConfig = {
                  resident: { color: '#5B54E8', bg: '#f0effe' },
                  official: { color: '#f97316', bg: '#fff7ed' },
                  tanod: { color: '#22c55e', bg: '#f0fdf4' },
                }
                const rc = roleConfig[u.role] || roleConfig.resident
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{background: '#fafafa', border: '1px solid #f0effe'}}>
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{background: `linear-gradient(135deg, ${rc.color}, ${rc.color}99)`}}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        u.full_name?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.barangays?.name || 'No barangay'}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                      style={{background: rc.bg, color: rc.color}}>
                      {u.role}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>

      {/* Rejection Modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)'}}
          onClick={() => setReviewing(null)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1"
            style={{background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)'}}
            onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
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
                  style={{background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe'}}>
                  Cancel
                </button>
                <button onClick={() => handleReject(reviewing, rejectReason)} disabled={!rejectReason.trim()}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                  style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 32px rgba(239,68,68,0.4)'}}>
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}