'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { MapPin, CheckCircle, Clock, AlertTriangle, Home, Phone, Navigation, TrendingUp, Award, Zap, FileText, Star } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import AnimatedDots from '@/components/AnimatedDots'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import ResolveModal from '@/components/ResolveModal'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyNewAssignment } from '@/lib/notifications'
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from '@/lib/incident-config'
import { useRequireRole } from '@/lib/useRequireRole'
import { useSidebar } from '@/lib/useSidebar'

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

const HOURS_MS = 1000 * 60 * 60
const INCIDENT_SELECT = '*, profiles!incidents_reported_by_fkey(full_name, phone)'

const SECTION_TITLES = {
  home: 'Home',
  active: 'Active Assignments',
  resolved: 'Resolved Incidents',
  stats: 'My Performance',
}

const ACHIEVEMENTS = [
  { icon: '🎯', title: 'First Resolution', desc: 'Resolve your first incident', target: 1, type: 'count' },
  { icon: '⭐', title: 'Rising Star', desc: 'Resolve 10 incidents', target: 10, type: 'count' },
  { icon: '🏆', title: 'Champion', desc: 'Resolve 50 incidents', target: 50, type: 'count' },
  { icon: '💎', title: 'Excellence', desc: '90% resolution rate', target: 90, type: 'rate' },
]

export default function TanodDashboard() {
  const { supabase, profile } = useRequireRole('tanod')
  const { sidebarOpen, setSidebarOpen, closeOnMobile } = useSidebar()
  const [incidents, setIncidents] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState(null)
  const [directionsMenu, setDirectionsMenu] = useState(null)

  // Mirror of incident ids, so the realtime handler can tell "new to me"
  // apart from "update to something I already have" without relying on
  // payload.old (which is empty unless the table has REPLICA IDENTITY FULL)
  const incidentIdsRef = useRef(new Set())
  useEffect(() => {
    incidentIdsRef.current = new Set(incidents.map(i => i.id))
  }, [incidents])

  // ---- Data loading (waits for the auth gate to hand us a profile) ----
  const fetchIncidents = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('incidents')
      .select(INCIDENT_SELECT)
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [supabase])

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function loadData() {
      try {
        const inc = await fetchIncidents(profile.id)
        if (!cancelled) setIncidents(inc)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
        if (!cancelled) toast.error('Failed to load your assignments. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()

    return () => { cancelled = true }
  }, [profile?.id, fetchIncidents])

  // Revalidate when the tab regains focus. The realtime filter only delivers
  // rows where assigned_to is still this tanod, so re-assignments AWAY from
  // them never arrive as events — a focus refetch clears those stale cards.
  useEffect(() => {
    if (!profile?.id) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const inc = await fetchIncidents(profile.id)
        setIncidents(inc)
      } catch {
        // Non-critical background refresh — stay quiet on failure
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [profile?.id, fetchIncidents])

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!profile?.id) return

    const incidentChannel = supabase
      .channel(`tanod-incidents-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `assigned_to=eq.${profile.id}`,
      }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
          return
        }

        // "New assignment" = a row we don't already have, currently assigned.
        // This works regardless of REPLICA IDENTITY (the old code compared
        // payload.old.status, which is usually not populated).
        const alreadyHave = incidentIdsRef.current.has(payload.new.id)
        const isNewAssignment = !alreadyHave && payload.new.status === 'assigned'

        if (isNewAssignment) {
          const { data, error } = await supabase
            .from('incidents')
            .select(INCIDENT_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (error || !data) return

          setIncidents(prev => {
            if (prev.some(i => i.id === data.id)) return prev.map(i => (i.id === data.id ? data : i))
            return [data, ...prev]
          })

          const toastId = `assignment-${data.id}`
          if (data.priority === 'Critical') {
            toast.error(`🚨 CRITICAL ASSIGNMENT: ${data.title}`, { duration: 8000, id: toastId })
          } else if (data.priority === 'High') {
            toast(`⚠️ HIGH PRIORITY: ${data.title}`, { duration: 6000, icon: '🟠', id: toastId })
          } else {
            toast.success(`🚨 New assignment: ${data.title}`, { duration: 5000, id: toastId })
          }
          notifyNewAssignment(data)
        } else if (payload.eventType === 'UPDATE') {
          // Merge so the joined reporter profile is preserved
          setIncidents(prev => prev.map(i => (i.id === payload.new.id ? { ...i, ...payload.new } : i)))
        } else if (payload.eventType === 'INSERT' && !alreadyHave) {
          // Inserted directly in a non-assigned status — still track it
          setIncidents(prev => (prev.some(i => i.id === payload.new.id) ? prev : [payload.new, ...prev]))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
    }
  }, [profile?.id, supabase])

  function navClick(key) {
    setActiveSection(key)
    closeOnMobile()
  }

  async function handleResolve({ notes, imageUrl, resolvedAt }) {
    const incidentId = resolveModal.id
    const { error } = await supabase.from('incidents').update({
      status: 'resolved',
      resolution_notes: notes,
      resolution_image_url: imageUrl,
      resolved_at: resolvedAt,
    }).eq('id', incidentId)

    if (error) {
      // Keep the modal open so the tanod's notes/photo aren't lost
      toast.error('Failed to save resolution. Please try again.')
      return
    }

    setIncidents(prev => prev.map(i =>
      i.id === incidentId
        ? { ...i, status: 'resolved', resolution_notes: notes, resolution_image_url: imageUrl, resolved_at: resolvedAt }
        : i
    ))
    toast.success('Incident resolved! Great work! 🛡️', { id: `resolved-${incidentId}` })
    setResolveModal(null)
  }

  function openDirections(provider, lat, lng) {
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      waze: `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    }
    window.open(urls[provider], '_blank', 'noopener,noreferrer')
    setDirectionsMenu(null)
  }

  function callReporter(phone) {
    if (!phone) {
      toast.error('No phone number available')
      return
    }
    window.location.href = `tel:${phone}`
  }

  // ---- Derived data (memoized) ----
  const assignedIncidents = useMemo(() =>
    incidents
      .filter(i => i.status === 'assigned')
      .sort((a, b) => {
        const aPriority = PRIORITY_CONFIG[a.priority]?.order || 2
        const bPriority = PRIORITY_CONFIG[b.priority]?.order || 2
        if (aPriority !== bPriority) return bPriority - aPriority
        return new Date(b.created_at) - new Date(a.created_at)
      }),
    [incidents]
  )

  const resolvedIncidents = useMemo(
    () => incidents.filter(i => i.status === 'resolved'),
    [incidents]
  )

  const stats = useMemo(() => {
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const resolvedThisMonth = resolvedIncidents.filter(i =>
      new Date(i.resolved_at || i.created_at) >= thisMonth
    ).length

    const times = resolvedIncidents
      .filter(i => i.resolved_at)
      .map(i => (new Date(i.resolved_at) - new Date(i.created_at)) / HOURS_MS)
    const avgHours = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null
    const avgResponseTime = avgHours === null
      ? null
      : avgHours < 1 ? `${Math.round(avgHours * 60)}m` : `${avgHours.toFixed(1)}h`

    const rated = resolvedIncidents.filter(i => i.rating)
    const avgRating = rated.length > 0
      ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1)
      : null

    const totalAssigned = incidents.length
    const resolutionRate = totalAssigned > 0
      ? Math.round((resolvedIncidents.length / totalAssigned) * 100)
      : 0

    return { resolvedThisMonth, avgResponseTime, avgRating, ratedCount: rated.length, totalAssigned, resolutionRate }
  }, [incidents, resolvedIncidents])

  const recentRatings = useMemo(
    () => resolvedIncidents.filter(i => i.rating).slice(0, 5),
    [resolvedIncidents]
  )

  const navItems = [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Home', icon: Home },
      { key: 'active', label: 'Active Assignments', icon: AlertTriangle, count: assignedIncidents.length, hasNew: assignedIncidents.length > 0 },
      { key: 'resolved', label: 'Resolved', icon: CheckCircle },
      { key: 'stats', label: 'My Performance', icon: TrendingUp, badge: 'NEW' },
    ]},
  ]

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
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
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
          { label: 'This Month', value: stats.resolvedThisMonth, color: '#5B54E8', key: 'stats' },
          { label: 'Success', value: `${stats.resolutionRate}%`, color: '#3b82f6', key: 'stats' },
        ]}
        navItems={navItems}
      />

      <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 h-screen overflow-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <DashboardHeader
          profile={profile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={SECTION_TITLES[activeSection]}
          sectionDesc="Field officer portal"
          notifications={assignedIncidents.map(i => ({
            id: i.id,
            type: 'assignment',
            icon: PRIORITY_CONFIG[i.priority]?.icon || '🛡️',
            color: PRIORITY_CONFIG[i.priority]?.bg || '#fef9c3',
            title: `${i.priority || ''}: ${i.title}`,
            subtitle: `📍 ${i.location}`,
            created_at: i.created_at,
            data: i,
          }))}
          searchData={{ incidents, tickets: [], announcements: [] }}
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
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Welcome back</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }}>{profile?.full_name?.split(' ')[0]} 🛡️</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    You have {assignedIncidents.length} active assignment{assignedIncidents.length !== 1 ? 's' : ''}{profile?.barangays?.name ? ` in ${profile.barangays.name}` : ''}.
                  </p>
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
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Active</p>
                  </button>
                  <button onClick={() => navClick('resolved')} className="glass-card p-4 text-left">
                    <CheckCircle size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{resolvedIncidents.length}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Resolved</p>
                  </button>
                  <button onClick={() => navClick('stats')} className="glass-card p-4 text-left">
                    <Zap size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{stats.resolvedThisMonth}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>This Month</p>
                  </button>
                  <button onClick={() => navClick('stats')} className="glass-card p-4 text-left">
                    <Award size={18} className="mb-2 text-white opacity-80" />
                    <p className="text-2xl font-bold text-white">{stats.resolutionRate}%</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Success</p>
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
                      const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                      return (
                        <div key={inc.id} className="white-card px-4 py-3 flex items-center gap-3 cursor-pointer"
                          onClick={() => navClick('active')}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: cat.bg }}>
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                              {inc.priority && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                                  style={{
                                    background: PRIORITY_CONFIG[inc.priority]?.bg,
                                    color: PRIORITY_CONFIG[inc.priority]?.color,
                                    ...(inc.priority === 'Critical' ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
                                  }}>
                                  {PRIORITY_CONFIG[inc.priority]?.icon}
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
                const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                const hasCoords = inc.latitude && inc.longitude
                return (
                  <div key={inc.id} className="white-card p-5 relative overflow-visible">
                    {inc.priority === 'Critical' && (
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden"
                        style={{ background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)', animation: 'shimmer 2s linear infinite' }} />
                    )}

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: cat.bg }}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-800">{inc.title}</h3>
                          {inc.priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{
                                background: PRIORITY_CONFIG[inc.priority]?.bg,
                                color: PRIORITY_CONFIG[inc.priority]?.color,
                                ...(inc.priority === 'Critical' ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
                              }}>
                              <span>{PRIORITY_CONFIG[inc.priority]?.icon}</span> {inc.priority}
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
                          <span>Reported by {inc.profiles?.full_name || 'Unknown'} · {timeAgoLong(inc.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {inc.image_url && (
                      <a href={inc.image_url} target="_blank" rel="noopener noreferrer"
                        className="block mb-3 rounded-2xl overflow-hidden"
                        style={{ border: '1px solid #f0effe' }}>
                        <img src={inc.image_url} alt="Incident evidence" className="w-full max-h-48 object-cover" loading="lazy" />
                      </a>
                    )}

                    {hasCoords && (
                      <div className="mb-3 relative">
                        <MiniMap lat={inc.latitude} lng={inc.longitude} />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          style={{ background: 'rgba(255,255,255,0.95)', color: '#5B54E8', backdropFilter: 'blur(10px)' }}>
                          <MapPin size={10} /> Reported Location
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {hasCoords && (
                        <div className="relative">
                          <button
                            onClick={() => setDirectionsMenu(directionsMenu === inc.id ? null : inc.id)}
                            aria-expanded={directionsMenu === inc.id}
                            className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 flex items-center justify-center gap-1.5"
                            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                            <Navigation size={12} /> Navigate
                          </button>
                          {directionsMenu === inc.id && (
                            <>
                              {/* Invisible backdrop: click anywhere else to close */}
                              <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setDirectionsMenu(null)} />
                              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden fade-up"
                                style={{ background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff', zIndex: 9999 }}>
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
                            </>
                          )}
                        </div>
                      )}

                      <button onClick={() => callReporter(inc.profiles?.phone)}
                        disabled={!inc.profiles?.phone}
                        title={inc.profiles?.phone || 'No phone number on file'}
                        className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-1.5"
                        style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                        <Phone size={12} /> Call
                      </button>

                      <button onClick={() => setResolveModal(inc)}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold text-white transition-all hover:scale-105 flex items-center justify-center gap-1.5 ${!hasCoords && 'col-span-2'}`}
                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
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
                const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                return (
                  <div key={inc.id} className="white-card p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: cat.bg }}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                          {inc.priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{ background: PRIORITY_CONFIG[inc.priority]?.bg, color: PRIORITY_CONFIG[inc.priority]?.color }}>
                              <span>{PRIORITY_CONFIG[inc.priority]?.icon}</span> {inc.priority}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">resolved</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                        <div className="flex items-center gap-1 mt-1.5 text-gray-300 text-xs">
                          <MapPin size={12} /><span>{inc.location}</span>
                        </div>
                        {inc.resolved_at && (
                          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1" title={fullDate(inc.resolved_at)}>
                            <CheckCircle size={11} /> Resolved {timeAgo(inc.resolved_at)}
                          </p>
                        )}

                        {inc.resolution_notes && (
                          <div className="mt-3 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                            <div className="flex items-start gap-2">
                              <FileText size={11} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-emerald-900">{inc.resolution_notes}</p>
                            </div>
                          </div>
                        )}

                        {inc.resolution_image_url && (
                          <a href={inc.resolution_image_url} target="_blank" rel="noopener noreferrer"
                            className="block mt-2 rounded-xl overflow-hidden"
                            style={{ border: '1px solid #dcfce7', maxWidth: '200px' }}>
                            <img src={inc.resolution_image_url} alt="Resolution proof" className="w-full max-h-32 object-cover" loading="lazy" />
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
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Performance Dashboard</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }}>Your Impact 🏆</h2>
                  <p className="text-gray-400 text-sm mt-1">Keep up the great work, {profile?.full_name?.split(' ')[0]}!</p>
                </div>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 24px rgba(34,197,94,0.4)' }}>
                  <Award size={28} className="text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Resolved', value: resolvedIncidents.length, icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
                  { label: 'This Month', value: stats.resolvedThisMonth, icon: Zap, color: '#f97316', bg: '#fff7ed' },
                  { label: 'Avg Response', value: stats.avgResponseTime || 'N/A', icon: Clock, color: '#3b82f6', bg: '#eff6ff' },
                  { label: 'Avg Rating', value: stats.avgRating ? `${stats.avgRating}★` : 'N/A', icon: Star, color: '#f59e0b', bg: '#fffbeb' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="white-card p-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: bg }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
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
                  <p className="text-3xl font-black" style={{ color: stats.resolutionRate >= 80 ? '#22c55e' : stats.resolutionRate >= 50 ? '#f97316' : '#ef4444' }}>
                    {stats.resolutionRate}%
                  </p>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                  <div className="absolute inset-y-0 left-0 transition-all duration-1000 rounded-full"
                    style={{
                      width: `${stats.resolutionRate}%`,
                      background: stats.resolutionRate >= 80
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : stats.resolutionRate >= 50
                        ? 'linear-gradient(90deg, #f97316, #ea580c)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }} />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="text-gray-400">{resolvedIncidents.length} of {stats.totalAssigned} incidents resolved</span>
                </div>
              </div>

              {/* Badges/Achievements with progress toward locked ones */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Achievements</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ACHIEVEMENTS.map(badge => {
                    const current = badge.type === 'count' ? resolvedIncidents.length : stats.resolutionRate
                    const unlocked = badge.type === 'count'
                      ? current >= badge.target
                      : current >= badge.target && stats.totalAssigned >= 5
                    const progress = Math.min((current / badge.target) * 100, 100)
                    return (
                      <div key={badge.title} className={`white-card p-4 text-center transition-all ${unlocked ? '' : 'opacity-60'}`}>
                        <div className={`text-3xl mb-2 ${unlocked ? '' : 'grayscale opacity-60'}`}>{badge.icon}</div>
                        <p className="text-xs font-bold text-gray-800">{badge.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{badge.desc}</p>
                        {unlocked ? (
                          <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            UNLOCKED
                          </div>
                        ) : (
                          <div className="mt-2">
                            <div className="relative h-1 rounded-full overflow-hidden mx-auto" style={{ background: '#f3f4f6', maxWidth: '80px' }}>
                              <div className="absolute inset-y-0 left-0 rounded-full"
                                style={{ width: `${progress}%`, background: '#a78bfa' }} />
                            </div>
                            <p className="text-[9px] text-gray-400 mt-1">
                              {badge.type === 'count' ? `${current}/${badge.target}` : `${current}% of ${badge.target}%`}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Ratings */}
              {recentRatings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Recent Ratings</p>
                    {stats.avgRating && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
                        title={`Average of all ${stats.ratedCount} rating${stats.ratedCount === 1 ? '' : 's'}`}>
                        <Star size={12} className="text-white fill-white" />
                        <span className="text-xs font-bold text-white">{stats.avgRating} / 5.0</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {recentRatings.map(inc => {
                      const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                      return (
                        <div key={inc.id} className="white-card p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: cat.bg }}>
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
                              <p className="text-[10px] text-gray-400 mt-1">
                                From {inc.profiles?.full_name || 'a resident'} · {timeAgo(inc.rated_at || inc.resolved_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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