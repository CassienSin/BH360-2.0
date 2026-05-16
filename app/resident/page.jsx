'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Bell, AlertTriangle, FileText, LogOut, Plus, ChevronRight, Home, Menu } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import RatingModal from '@/components/RatingModal'
import { Star } from 'lucide-react'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyNewAnnouncement, notifyStatusUpdate } from '@/lib/notifications'

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

export default function ResidentDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [ratingModal, setRatingModal] = useState(null)

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
      setProfile(prof)

      if (!prof?.barangay_id) {
        setLoading(false)
        return
      }

      const { data: ann } = await supabase.from('announcements').select('*')
        .eq('barangay_id', prof.barangay_id)
        .order('created_at', { ascending: false })
      setAnnouncements(ann || [])

      const { data: inc } = await supabase.from('incidents').select('*')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false })
      setIncidents(inc || [])

      const { data: tix } = await supabase.from('tickets').select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      setTickets(tix || [])

      setLoading(false)
    }
    loadData()
  }, [])

  // Real-time subscriptions
  useEffect(() => {
    if (!profile?.barangay_id) return

    const bid = profile.barangay_id

    // Subscribe to announcements (their barangay)
    const announcementChannel = supabase
      .channel('resident-announcements')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements',
        filter: `barangay_id=eq.${bid}`,
        }, (payload) => {
          setAnnouncements(prev => [payload.new, ...prev])
          toast.success(`📢 New announcement: ${payload.new.title}`, { duration: 5000 })
          notifyNewAnnouncement(payload.new)
        })
      .subscribe()

   // Subscribe to their own incidents (status changes)
    const incidentChannel = supabase
      .channel('resident-incidents')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'incidents',
      }, (payload) => {
        setIncidents(prev => prev.map(i => {
          if (i.id === payload.new.id) {
            if (payload.old.status !== payload.new.status) {
              const statusMessage = {
                assigned: '🛡️ Tanod has been assigned to your incident',
                resolved: '✅ Your incident has been resolved!',
              }
              if (statusMessage[payload.new.status]) {
                toast.success(statusMessage[payload.new.status], {
                  id: `incident-${payload.new.id}-${payload.new.status}`,
                })
                notifyStatusUpdate({ id: payload.new.id, title: payload.new.title }, payload.new.status)
              }
            }
            return { ...i, ...payload.new }
          }
          return i
        }))
      })
      .subscribe()

    // Subscribe to their own tickets
    const ticketChannel = supabase
      .channel('resident-tickets')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
      }, (payload) => {
        setTickets(prev => prev.map(t =>
          t.id === payload.new.id ? { ...t, ...payload.new } : t
        ))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(announcementChannel)
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(ticketChannel)
    }
  }, [profile?.barangay_id])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  async function handleRating({ rating, feedback }) {
    const incidentId = ratingModal.id
    await supabase.from('incidents').update({
      rating,
      rating_feedback: feedback,
      rated_at: new Date().toISOString(),
    }).eq('id', incidentId)

    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, rating, rating_feedback: feedback, rated_at: new Date().toISOString() } : i
    ))
    toast.success('Thank you for your feedback! ⭐')
    setRatingModal(null)
  }

  const statusColor = {
    pending: 'bg-amber-100 text-amber-700', assigned: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700', open: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700', closed: 'bg-emerald-100 text-emerald-700',
  }

  const priorityConfig = {
    Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
    Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
    High: { color: '#f97316', bg: '#fff7ed', icon: '🟠' },
    Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  }

  const sectionTitle = {
    home: 'Home', announcements: 'Announcements',
    incidents: 'My Incidents', tickets: 'My Tickets', ai: 'AI Assistant'
  }

  const Skeleton = ({ className }) => <div className={`skeleton-shimmer ${className}`} />
  const CardSkeleton = () => (
    <div className="white-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
  const HomeSkeleton = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="white-card p-6 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <Skeleton className="w-6 h-6 rounded-lg" style={{background: 'rgba(255,255,255,0.2)'}} />
            <Skeleton className="h-8 w-12" style={{background: 'rgba(255,255,255,0.2)'}} />
            <Skeleton className="h-3 w-24" style={{background: 'rgba(255,255,255,0.2)'}} />
          </div>
        ))}
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
        roleLabel="Resident"
        stats={[
          { label: 'Announcements', value: announcements.length, color: '#5B54E8', key: 'announcements' },
          { label: 'My Incidents', value: incidents.length, color: '#f97316', key: 'incidents' },
          { label: 'Pending', value: incidents.filter(i => i.status === 'pending').length, color: '#f97316', key: 'incidents' },
          { label: 'My Tickets', value: tickets.length, color: '#3b82f6', key: 'tickets' },
        ]}
        navItems={[
          { section: 'MAIN', items: [
            { key: 'home', label: 'Home', icon: Home },
            { key: 'announcements', label: 'Announcements', icon: Bell, count: announcements.length, hasNew: announcements.length > 0 },
          ]},
          { section: 'MY ACTIVITY', items: [
            { key: 'incidents', label: 'My Incidents', icon: AlertTriangle, count: incidents.filter(i => i.status === 'pending').length },
            { key: 'tickets', label: 'My Tickets', icon: FileText, count: tickets.filter(t => t.status === 'open').length },
          ]},
          { section: 'SUPPORT', items: [
            { key: 'ai', label: 'AI Assistant', icon: FileText, badge: 'AI' },
          ]},
        ]}
      />

      <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 h-screen overflow-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <DashboardHeader
          profile={profile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={sectionTitle[activeSection]}
          sectionDesc="Stay connected with your barangay"
          notifications={[
            ...announcements.slice(0, 5).map(a => ({
              id: a.id,
              type: 'announcement',
              icon: '📢',
              color: '#f0effe',
              title: a.title,
              subtitle: a.content?.slice(0, 60) + (a.content?.length > 60 ? '...' : ''),
              created_at: a.created_at,
              data: a,
            })),
            ...incidents.filter(i => i.status === 'pending').map(i => ({
              id: i.id,
              type: 'incident',
              icon: '⚠️',
              color: '#fff7ed',
              title: `Your incident: ${i.title}`,
              subtitle: `Waiting for response at ${i.location}`,
              created_at: i.created_at,
              data: i,
            }))
          ]}
          searchData={{
            incidents,
            tickets,
            announcements,
          }}
          onNotificationClick={(notif) => {
            if (notif.type === 'announcement') setActiveSection('announcements')
            if (notif.type === 'incident') setActiveSection('incidents')
          }}
          onSearchResultClick={(type, item) => {
            if (type === 'incidents') setActiveSection('incidents')
            if (type === 'tickets') router.push(`/resident/ticket/${item.id}`)
            if (type === 'announcements') setActiveSection('announcements')
          }}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <NotificationBanner />

          {loading && (
            <div className="fade-up">
              {activeSection === 'home' ? <HomeSkeleton /> : (
                <div className="space-y-3 max-w-3xl mx-auto">
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
              <p className="text-gray-500 text-sm mb-4">Your account isn't linked to a barangay yet. Please contact support or update your profile.</p>
              <button onClick={() => router.push('/profile')} className="btn-primary px-5 py-2.5 rounded-2xl text-white text-sm font-semibold">Go to Profile</button>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'home' && (
            <div className="space-y-6 fade-up max-w-4xl mx-auto">
              <div className="white-card p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color: '#5B54E8'}}>Welcome back</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>{profile?.full_name?.split(' ')[0]} 👋</h2>
                  <p className="text-gray-400 text-sm mt-1">Here's what's happening in {profile?.barangays?.name || 'your barangay'}.</p>
                </div>
                <div className="hidden sm:block w-16 h-16 relative">
                  <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain opacity-20" />
                </div>
              </div>

              <div className="fade-up-1">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Your Activity</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Announcements', value: announcements.length, icon: Bell, section: 'announcements' },
                    { label: 'My Incidents', value: incidents.length, icon: AlertTriangle, section: 'incidents' },
                    { label: 'My Tickets', value: tickets.length, icon: FileText, section: 'tickets' },
                  ].map(({ label, value, icon: Icon, section }) => (
                    <button key={label} onClick={() => navClick(section)} className="glass-card p-5 text-left">
                      <Icon size={20} className="mb-3 text-white opacity-80" />
                      <p className="text-3xl font-bold text-white">{value}</p>
                      <p className="text-sm mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>{label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="fade-up-2">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Quick Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Report Incident', desc: 'Notify the barangay', icon: AlertTriangle, action: () => router.push('/resident/report') },
                    { label: 'New Ticket', desc: 'Request assistance', icon: FileText, action: () => router.push('/resident/ticket/new') },
                    { label: 'AI Assistant', desc: 'Ask anything', icon: FileText, action: () => navClick('ai') },
                    { label: 'Announcements', desc: 'View latest news', icon: Bell, action: () => navClick('announcements') },
                  ].map(({ label, desc, icon: Icon, action }) => (
                    <button key={label} onClick={action} className="white-card p-4 flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <Icon size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {announcements.length > 0 && (
                <div className="fade-up-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Latest Announcements</p>
                    <button onClick={() => navClick('announcements')} className="text-xs font-semibold text-white opacity-70 hover:opacity-100 transition-opacity">View all →</button>
                  </div>
                  <div className="space-y-2">
                    {announcements.slice(0, 2).map(a => (
                      <div key={a.id} className="white-card px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                          <Bell size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                          <p className="text-xs text-gray-400 truncate">{a.content}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'announcements' && (
            <div className="space-y-3 fade-up max-w-3xl mx-auto">
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
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 text-sm">{a.title}</h3>
                      <p className="text-gray-500 text-sm mt-1 leading-relaxed">{a.content}</p>
                      <p className="text-gray-300 text-xs mt-2" title={fullDate(a.created_at)}>{timeAgoLong(a.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'incidents' && (
            <div className="space-y-3 fade-up max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">{incidents.length} total</p>
                <button onClick={() => router.push('/resident/report')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white"
                  style={{color: '#5B54E8', boxShadow: '0 4px 16px rgba(91,84,232,0.2)'}}>
                  <Plus size={14} /> Report Incident
                </button>
              </div>
              {incidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <AlertTriangle size={36} className="mx-auto mb-3 text-orange-300" />
                  <p className="text-gray-400 text-sm">No incidents reported yet.</p>
                  <button onClick={() => router.push('/resident/report')} className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>Report your first →</button>
                </div>
              )}
              {incidents.map(inc => (
                <div key={inc.id} className="white-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#fff7ed'}}>
                        <AlertTriangle size={16} className="text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
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
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                        <p className="text-gray-300 text-xs mt-1.5">📍 {inc.location}</p>

                        {/* Show rating if already rated */}
                        {inc.rating && (
                          <div className="mt-3 p-3 rounded-xl flex items-center gap-3" style={{background: '#fffbeb', border: '1px solid #fef3c7'}}>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={12} fill={s <= inc.rating ? '#f59e0b' : 'none'} color={s <= inc.rating ? '#f59e0b' : '#d1d5db'} />
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-amber-700">Your rating</p>
                              {inc.rating_feedback && <p className="text-xs text-amber-900 truncate">"{inc.rating_feedback}"</p>}
                            </div>
                          </div>
                        )}

                        {/* Rate Service button for unrated resolved */}
                        {inc.status === 'resolved' && !inc.rating && (
                          <button onClick={() => setRatingModal(inc)}
                            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                            style={{background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 4px 12px rgba(251,191,36,0.3)'}}>
                            <Star size={12} fill="white" /> Rate the Service
                          </button>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColor[inc.status]}`}>{inc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'tickets' && (
            <div className="space-y-3 fade-up max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">{tickets.length} total</p>
                <button onClick={() => router.push('/resident/ticket/new')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white"
                  style={{color: '#5B54E8', boxShadow: '0 4px 16px rgba(91,84,232,0.2)'}}>
                  <Plus size={14} /> New Ticket
                </button>
              </div>
              {tickets.length === 0 && (
                <div className="white-card p-10 text-center">
                  <FileText size={36} className="mx-auto mb-3" style={{color: '#5B54E8', opacity: 0.3}} />
                  <p className="text-gray-400 text-sm">No tickets created yet.</p>
                  <button onClick={() => router.push('/resident/ticket/new')} className="mt-4 text-xs font-semibold" style={{color: '#5B54E8'}}>Create your first →</button>
                </div>
              )}
              {tickets.map(t => (
                <div key={t.id} onClick={() => router.push(`/resident/ticket/${t.id}`)} className="white-card p-5 cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                        <FileText size={16} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{t.title}</h3>
                        <p className="text-gray-400 text-xs mt-0.5 truncate">{t.description}</p>
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

          {!loading && profile?.barangay_id && activeSection === 'ai' && (
            <div className="fade-up max-w-3xl mx-auto space-y-4">
              <div className="white-card p-8 text-center">
                <div className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center">
                  <Image src="/logo.png" alt="AI Assistant" width={64} height={64} className="object-contain" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">AI Assistant</h2>
                <p className="text-gray-400 text-sm mb-6">Ask any barangay question — available 24/7</p>
                <button onClick={() => router.push('/resident/ai')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 20px rgba(91,84,232,0.35)'}}>
                  Start Chatting <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
      <RatingModal
        open={!!ratingModal}
        onClose={() => setRatingModal(null)}
        onSubmit={handleRating}
        incident={ratingModal}
      />
    </div>
  )
}