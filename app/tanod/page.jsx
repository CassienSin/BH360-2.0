'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { MapPin, CheckCircle, Clock, AlertTriangle, Home, Phone, Navigation, TrendingUp, Award, Zap, Camera, FileText, Star } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import ResolveModal from '@/components/ResolveModal'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyNewAssignment } from '@/lib/notifications'

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

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

const priorityConfig = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

export default function TanodDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState(null)
  const [directionsMenu, setDirectionsMenu] = useState(null)

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
      if (prof?.role !== 'tanod') return router.push('/login')
      setProfile(prof)
      const { data: inc } = await supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name, phone)')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false })
      setIncidents(inc || [])
      setLoading(false)
    }
    loadData()
  }, [])

 // Real-time subscriptions
    useEffect(() => {
      if (!profile?.id) return

      const incidentChannel = supabase
        .channel('tanod-incidents')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `assigned_to=eq.${profile.id}`,
        }, async (payload) => {

          const isNewAssignment =
            payload.eventType === 'INSERT' ||
            (payload.eventType === 'UPDATE' &&
            payload.old?.status === 'pending' &&
            payload.new?.status === 'assigned')

          if (isNewAssignment) {
            const { data } = await supabase
              .from('incidents')
              .select('*, profiles!incidents_reported_by_fkey(full_name, phone)')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              setIncidents(prev => {
                const exists = prev.find(i => i.id === data.id)
                if (exists) return prev.map(i => i.id === data.id ? data : i)
                return [data, ...prev]
              })
              const toastId = `assignment-${data.id}`
                if (data.priority === 'Critical') {
                  toast.error(`🚨 CRITICAL ASSIGNMENT: ${data.title}`, { duration: 8000, id: toastId })
                  notifyNewAssignment(data)
                } else if (data.priority === 'High') {
                  toast(`⚠️ HIGH PRIORITY: ${data.title}`, { duration: 6000, icon: '🟠', id: toastId })
                  notifyNewAssignment(data)
                } else {
                  toast.success(`🚨 New assignment: ${data.title}`, { duration: 5000, id: toastId })
                  notifyNewAssignment(data)
                }
            }
          } else if (payload.eventType === 'UPDATE') {
            setIncidents(prev => prev.map(i =>
              i.id === payload.new.id ? { ...i, ...payload.new } : i
            ))
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(incidentChannel)
      }
    }, [profile?.id])

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  async function handleResolve({ notes, imageUrl, resolvedAt }) {
    const incidentId = resolveModal.id
    await supabase.from('incidents').update({
      status: 'resolved',
      resolution_notes: notes,
      resolution_image_url: imageUrl,
      resolved_at: resolvedAt,
    }).eq('id', incidentId)

    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, status: 'resolved', resolution_notes: notes, resolution_image_url: imageUrl, resolved_at: resolvedAt } : i
    ))
    toast.success('Incident resolved! Great work! 🛡️', {
      id: `resolved-${incidentId}`,
    })
    setResolveModal(null)
  }

  function openDirections(provider, lat, lng) {
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      waze: `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    }
    window.open(urls[provider], '_blank')
    setDirectionsMenu(null)
  }

  function callReporter(phone) {
    if (!phone) {
      toast.error('No phone number available')
      return
    }
    window.location.href = `tel:${phone}`
  }

  const assignedIncidents = incidents
    .filter(i => i.status === 'assigned')
    .sort((a, b) => {
      const aPriority = priorityConfig[a.priority]?.order || 2
      const bPriority = priorityConfig[b.priority]?.order || 2
      if (aPriority !== bPriority) return bPriority - aPriority
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const resolvedIncidents = incidents.filter(i => i.status === 'resolved')

  // Performance stats
  const thisMonth = new Date()
  thisMonth.setDate(1)
  const resolvedThisMonth = resolvedIncidents.filter(i =>
    new Date(i.resolved_at || i.created_at) >= thisMonth
  ).length

  const avgResponseTime = resolvedIncidents.length > 0
    ? (() => {
        const times = resolvedIncidents
          .filter(i => i.resolved_at)
          .map(i => (new Date(i.resolved_at) - new Date(i.created_at)) / (1000 * 60 * 60))
        if (times.length === 0) return null
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        return avg < 1 ? `${Math.round(avg * 60)}m` : `${avg.toFixed(1)}h`
      })()
    : null

  const totalAssigned = incidents.length
  const resolutionRate = totalAssigned > 0 ? Math.round((resolvedIncidents.length / totalAssigned) * 100) : 0

  const navItems = [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Home', icon: Home },
      { key: 'active', label: 'Active Assignments', icon: AlertTriangle, count: assignedIncidents.length, hasNew: assignedIncidents.length > 0 },
      { key: 'resolved', label: 'Resolved', icon: CheckCircle },
      { key: 'stats', label: 'My Performance', icon: TrendingUp, badge: 'NEW' },
    ]},
  ]

  const sectionTitle = {
    home: 'Home',
    active: 'Active Assignments',
    resolved: 'Resolved Incidents',
    stats: 'My Performance'
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
        roleLabel="Tanod"
        stats={[
          { label: 'Active', value: assignedIncidents.length, color: '#f97316', key: 'active' },
          { label: 'Resolved', value: resolvedIncidents.length, color: '#22c55e', key: 'resolved' },
          { label: 'This Month', value: resolvedThisMonth, color: '#5B54E8', key: 'stats' },
          { label: 'Success', value: `${resolutionRate}%`, color: '#3b82f6', key: 'stats' },
        ]}
        navItems={navItems}
      />

      <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 h-screen overflow-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <DashboardHeader
          profile={profile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={sectionTitle[activeSection]}
          sectionDesc="Field officer portal"
          notifications={assignedIncidents.map(i => ({
            id: i.id,
            type: 'assignment',
            icon: priorityConfig[i.priority]?.icon || '🛡️',
            color: priorityConfig[i.priority]?.bg || '#fef9c3',
            title: `${i.priority || ''}: ${i.title}`,
            subtitle: `📍 ${i.location}`,
            created_at: i.created_at,
            data: i,
          }))}
          searchData={{
            incidents,
            tickets: [],
            announcements: [],
          }}
          onNotificationClick={() => setActiveSection('active')}
          onSearchResultClick={() => setActiveSection('active')}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <NotificationBanner />

          {loading && (
            <div className="space-y-3 fade-up max-w-2xl mx-auto">
              {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {!loading && activeSection === 'home' && (
            <div className="space-y-6 fade-up max-w-2xl mx-auto">
              <div className="white-card p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color: '#5B54E8'}}>Welcome back</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>{profile?.full_name?.split(' ')[0]} 🛡️</h2>
                  <p className="text-gray-400 text-sm mt-1">You have {assignedIncidents.length} active assignment{assignedIncidents.length !== 1 ? 's' : ''} in {profile?.barangays?.name}.</p>
                </div>
                <div className="hidden sm:block w-16 h-16 relative">
                  <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain opacity-20" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Your Status</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => navClick('active')} className="glass-card p-4 text-left">
                    <AlertTriangle size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{assignedIncidents.length}</p>
                    <p className="text-[10px] mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>Active</p>
                  </button>
                  <button onClick={() => navClick('resolved')} className="glass-card p-4 text-left">
                    <CheckCircle size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{resolvedIncidents.length}</p>
                    <p className="text-[10px] mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>Resolved</p>
                  </button>
                  <button onClick={() => navClick('stats')} className="glass-card p-4 text-left">
                    <Zap size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{resolvedThisMonth}</p>
                    <p className="text-[10px] mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>This Month</p>
                  </button>
                  <button onClick={() => navClick('stats')} className="glass-card p-4 text-left">
                    <Award size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{resolutionRate}%</p>
                    <p className="text-[10px] mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>Success</p>
                  </button>
                </div>
              </div>

              {assignedIncidents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Priority Assignments</p>
                    <button onClick={() => navClick('active')} className="text-xs font-semibold text-white opacity-70 hover:opacity-100 transition-opacity">View all →</button>
                  </div>
                  <div className="space-y-2">
                    {assignedIncidents.slice(0, 2).map(inc => {
                      const cat = categoryConfig[inc.category] || categoryConfig.Other
                      return (
                        <div key={inc.id} className="white-card px-4 py-3 flex items-center gap-3 cursor-pointer"
                          onClick={() => navClick('active')}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base" style={{background: cat.bg}}>
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                              {inc.priority && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                                  style={{
                                    background: priorityConfig[inc.priority]?.bg,
                                    color: priorityConfig[inc.priority]?.color,
                                    ...(inc.priority === 'Critical' ? {animation: 'pulse 2s ease-in-out infinite'} : {})
                                  }}>
                                  {priorityConfig[inc.priority]?.icon}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">📍 {inc.location}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 flex-shrink-0">assigned</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {assignedIncidents.length === 0 && (
                <div className="white-card p-8 text-center">
                  <CheckCircle size={40} className="mx-auto text-emerald-300 mb-3" />
                  <p className="font-semibold text-gray-700">All clear!</p>
                  <p className="text-gray-400 text-sm mt-1">No active assignments right now.</p>
                </div>
              )}
            </div>
          )}

          {!loading && activeSection === 'active' && (
            <div className="space-y-4 fade-up max-w-2xl mx-auto">
              {assignedIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <CheckCircle size={40} className="mx-auto text-emerald-300 mb-3" />
                  <p className="font-semibold text-gray-700">All clear!</p>
                  <p className="text-gray-400 text-sm mt-1">No active assignments right now.</p>
                </div>
              )}
              {assignedIncidents.map(inc => {
                const cat = categoryConfig[inc.category] || categoryConfig.Other
                const hasCoords = inc.latitude && inc.longitude
                return (
                  <div key={inc.id} className="white-card p-5 relative overflow-hidden">
                    {inc.priority === 'Critical' && (
                      <div className="absolute top-0 left-0 right-0 h-1"
                        style={{background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)', animation: 'shimmer 2s linear infinite'}} />
                    )}

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{background: cat.bg}}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-800">{inc.title}</h3>
                          {inc.priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{
                                background: priorityConfig[inc.priority]?.bg,
                                color: priorityConfig[inc.priority]?.color,
                                ...(inc.priority === 'Critical' ? {animation: 'pulse 2s ease-in-out infinite'} : {})
                              }}>
                              <span>{priorityConfig[inc.priority]?.icon}</span> {inc.priority}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">assigned</span>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">{inc.description}</p>
                        <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                          <MapPin size={12} /><span>{inc.location}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs" title={fullDate(inc.created_at)}>
                          <Clock size={12} />
                          <span>Reported by {inc.profiles?.full_name} · {timeAgoLong(inc.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Incident image if exists */}
                    {inc.image_url && (
                      <a href={inc.image_url} target="_blank" rel="noopener noreferrer"
                        className="block mb-3 rounded-2xl overflow-hidden"
                        style={{border: '1px solid #f0effe'}}>
                        <img src={inc.image_url} alt="Incident" className="w-full max-h-48 object-cover" />
                      </a>
                    )}

                    {/* Mini Map */}
                    {hasCoords && (
                      <div className="mb-3 relative">
                        <MiniMap lat={inc.latitude} lng={inc.longitude} />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          style={{background: 'rgba(255,255,255,0.95)', color: '#5B54E8', backdropFilter: 'blur(10px)'}}>
                          <MapPin size={10} /> Live Location
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {/* Get Directions */}
                      {hasCoords && (
                        <div className="relative">
                          <button onClick={() => setDirectionsMenu(directionsMenu === inc.id ? null : inc.id)}
                            className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 flex items-center justify-center gap-1.5"
                            style={{background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff'}}>
                            <Navigation size={12} /> Navigate
                          </button>
                          {directionsMenu === inc.id && (
  <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden fade-up"
    style={{background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff', zIndex: 9999}}>
                              <button onClick={() => openDirections('google', inc.latitude, inc.longitude)}
                                className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                🗺️ Google Maps
                              </button>
                              <button onClick={() => openDirections('waze', inc.latitude, inc.longitude)}
                                className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100">
                                🚗 Waze
                              </button>
                              <button onClick={() => openDirections('apple', inc.latitude, inc.longitude)}
                                className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100">
                                🍎 Apple Maps
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Call Reporter */}
                      <button onClick={() => callReporter(inc.profiles?.phone)}
                        disabled={!inc.profiles?.phone}
                        className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-1.5"
                        style={{background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa'}}>
                        <Phone size={12} /> Call
                      </button>

                      {/* Mark Resolved */}
                      <button onClick={() => setResolveModal(inc)}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold text-white transition-all hover:scale-105 flex items-center justify-center gap-1.5 ${!hasCoords && 'col-span-2'}`}
                        style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)'}}>
                        <CheckCircle size={12} /> Resolve
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && activeSection === 'resolved' && (
            <div className="space-y-3 fade-up max-w-2xl mx-auto">
              {resolvedIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <p className="text-gray-400 text-sm">No resolved incidents yet.</p>
                </div>
              )}
              {resolvedIncidents.map(inc => {
                const cat = categoryConfig[inc.category] || categoryConfig.Other
                return (
                  <div key={inc.id} className="white-card p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{background: cat.bg}}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                          {inc.priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{background: priorityConfig[inc.priority]?.bg, color: priorityConfig[inc.priority]?.color}}>
                              <span>{priorityConfig[inc.priority]?.icon}</span> {inc.priority}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">resolved</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                        <div className="flex items-center gap-1 mt-1.5 text-gray-300 text-xs">
                          <MapPin size={12} /><span>{inc.location}</span>
                        </div>
                        {inc.resolved_at && (
                          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                            <CheckCircle size={11} /> Resolved {timeAgo(inc.resolved_at)}
                          </p>
                        )}

                        {/* Resolution notes */}
                        {inc.resolution_notes && (
                          <div className="mt-3 p-3 rounded-xl" style={{background: '#f0fdf4', border: '1px solid #dcfce7'}}>
                            <div className="flex items-start gap-2">
                              <FileText size={11} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-emerald-900">{inc.resolution_notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Resolution image */}
                        {inc.resolution_image_url && (
                          <a href={inc.resolution_image_url} target="_blank" rel="noopener noreferrer"
                            className="block mt-2 rounded-xl overflow-hidden"
                            style={{border: '1px solid #dcfce7', maxWidth: '200px'}}>
                            <img src={inc.resolution_image_url} alt="Resolution proof" className="w-full max-h-32 object-cover" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && activeSection === 'stats' && (
            <div className="space-y-6 fade-up max-w-3xl mx-auto">
              <div className="white-card p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color: '#5B54E8'}}>Performance Dashboard</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>Your Impact 🏆</h2>
                  <p className="text-gray-400 text-sm mt-1">Keep up the great work, {profile?.full_name?.split(' ')[0]}!</p>
                </div>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 24px rgba(34,197,94,0.4)'}}>
                  <Award size={28} className="text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(() => {
                  const ratedCount = resolvedIncidents.filter(i => i.rating).length
                  const avgRating = ratedCount > 0
                    ? (resolvedIncidents.filter(i => i.rating).reduce((a, b) => a + b.rating, 0) / ratedCount).toFixed(1)
                    : null

                  return [
                    { label: 'Total Resolved', value: resolvedIncidents.length, icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
                    { label: 'This Month', value: resolvedThisMonth, icon: Zap, color: '#f97316', bg: '#fff7ed' },
                    { label: 'Avg Response', value: avgResponseTime || 'N/A', icon: Clock, color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Avg Rating', value: avgRating ? `${avgRating}★` : 'N/A', icon: Star, color: '#f59e0b', bg: '#fffbeb' },
                  ]
                })().map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="white-card p-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{background: bg}}>
                      <Icon size={18} style={{color}} />
                    </div>
                    <p className="text-2xl font-bold" style={{color}}>{value}</p>
                    <p className="text-xs text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Resolution Rate */}
              <div className="white-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Resolution Rate</h3>
                    <p className="text-xs text-gray-400">Percentage of incidents you've resolved</p>
                  </div>
                  <p className="text-3xl font-black" style={{color: resolutionRate >= 80 ? '#22c55e' : resolutionRate >= 50 ? '#f97316' : '#ef4444'}}>
                    {resolutionRate}%
                  </p>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{background: '#f3f4f6'}}>
                  <div className="absolute inset-y-0 left-0 transition-all duration-1000 rounded-full"
                    style={{
                      width: `${resolutionRate}%`,
                      background: resolutionRate >= 80
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : resolutionRate >= 50
                        ? 'linear-gradient(90deg, #f97316, #ea580c)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }} />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="text-gray-400">{resolvedIncidents.length} of {totalAssigned} incidents resolved</span>
                </div>
              </div>

             {/* Badges/Achievements */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Achievements</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { unlocked: resolvedIncidents.length >= 1, icon: '🎯', title: 'First Resolution', desc: 'Resolve your first incident' },
                      { unlocked: resolvedIncidents.length >= 10, icon: '⭐', title: 'Rising Star', desc: 'Resolve 10 incidents' },
                      { unlocked: resolvedIncidents.length >= 50, icon: '🏆', title: 'Champion', desc: 'Resolve 50 incidents' },
                      { unlocked: resolutionRate >= 90 && totalAssigned >= 5, icon: '💎', title: 'Excellence', desc: '90% resolution rate' },
                    ].map(badge => (
                      <div key={badge.title} className={`white-card p-4 text-center transition-all ${badge.unlocked ? '' : 'opacity-40 grayscale'}`}>
                        <div className="text-3xl mb-2">{badge.icon}</div>
                        <p className="text-xs font-bold text-gray-800">{badge.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{badge.desc}</p>
                        {badge.unlocked && (
                          <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{background: '#f0fdf4', color: '#16a34a'}}>
                            UNLOCKED
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Ratings — PASTE THE NEW BLOCK HERE */}
                {(() => {
                  const ratedIncidents = resolvedIncidents.filter(i => i.rating).slice(0, 5)
                  const avgRating = ratedIncidents.length > 0
                    ? (ratedIncidents.reduce((a, b) => a + b.rating, 0) / ratedIncidents.length).toFixed(1)
                    : null

                  if (ratedIncidents.length === 0) return null

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Recent Ratings</p>
                        {avgRating && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                            style={{background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)'}}>
                            <Star size={12} className="text-white fill-white" />
                            <span className="text-xs font-bold text-white">{avgRating} / 5.0</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {ratedIncidents.map(inc => {
                          const cat = categoryConfig[inc.category] || categoryConfig.Other
                          return (
                            <div key={inc.id} className="white-card p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base" style={{background: cat.bg}}>
                                  {cat.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-sm font-bold text-gray-800 truncate">{inc.title}</p>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                          <Star key={s} size={11} fill={s <= inc.rating ? '#f59e0b' : 'none'} color={s <= inc.rating ? '#f59e0b' : '#d1d5db'} />
                                        ))}
                                      </div>
                                      <span className="text-xs font-bold text-amber-700">{inc.rating}.0</span>
                                    </div>
                                  </div>
                                  {inc.rating_feedback ? (
                                    <p className="text-xs text-gray-500 italic">"{inc.rating_feedback}"</p>
                                  ) : (
                                    <p className="text-xs text-gray-300">No written feedback</p>
                                  )}
                                  <p className="text-[10px] text-gray-400 mt-1">From {inc.profiles?.full_name} · {timeAgo(inc.rated_at || inc.resolved_at)}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

          </main>
        </div>

        <ResolveModal
          open={!!resolveModal}
          onClose={() => setResolveModal(null)}
          onResolve={handleResolve}
          incident={resolveModal}
          userId={profile?.id}
        />
      </div>
    )
  }