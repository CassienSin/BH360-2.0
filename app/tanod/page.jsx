'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LogOut, MapPin, CheckCircle, Clock, AlertTriangle, Home, Menu, Shield } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'

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

export default function TanodDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)

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
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false })
      setIncidents(inc || [])
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleLogout() { await supabase.auth.signOut(); window.location.href = '/login' }

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  async function markResolved(incidentId) {
    await supabase.from('incidents').update({ status: 'resolved' }).eq('id', incidentId)
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: 'resolved' } : i))
    toast.success('Incident marked as resolved! Great work! 🛡️')
  }

  const assignedIncidents = incidents.filter(i => i.status === 'assigned')
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved')

  const sectionTitle = { home: 'Home', active: 'Active Assignments', resolved: 'Resolved Incidents' }

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
        ]}
        navItems={[
          { section: 'MAIN', items: [
            { key: 'home', label: 'Home', icon: Home },
            { key: 'active', label: 'Active Assignments', icon: AlertTriangle, count: assignedIncidents.length, hasNew: assignedIncidents.length > 0 },
            { key: 'resolved', label: 'Resolved', icon: CheckCircle },
          ]},
        ]}
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
            icon: '🛡️',
            color: '#fef9c3',
            title: `Assigned: ${i.title}`,
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
                  <Image src="/logo.png" alt="BH360" fill sizes="64px" className="object-contain opacity-20" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Your Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => navClick('active')} className="glass-card p-5 text-left">
                    <AlertTriangle size={20} className="mb-3 text-white opacity-80" />
                    <p className="text-3xl font-bold text-white">{assignedIncidents.length}</p>
                    <p className="text-sm mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>Active Assignments</p>
                  </button>
                  <button onClick={() => navClick('resolved')} className="glass-card p-5 text-left">
                    <CheckCircle size={20} className="mb-3 text-white opacity-80" />
                    <p className="text-3xl font-bold text-white">{resolvedIncidents.length}</p>
                    <p className="text-sm mt-1" style={{color: 'rgba(255,255,255,0.65)'}}>Resolved</p>
                  </button>
                </div>
              </div>

              {assignedIncidents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Active Assignments</p>
                    <button onClick={() => navClick('active')} className="text-xs font-semibold text-white opacity-70 hover:opacity-100 transition-opacity">View all →</button>
                  </div>
                  <div className="space-y-2">
                    {assignedIncidents.slice(0, 2).map(inc => (
                      <div key={inc.id} className="white-card px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background: '#fef9c3'}}>
                          <AlertTriangle size={14} className="text-yellow-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                          <p className="text-xs text-gray-400 truncate">📍 {inc.location}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 flex-shrink-0">assigned</span>
                      </div>
                    ))}
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
              {assignedIncidents.map(inc => (
                <div key={inc.id} className="white-card p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#fef9c3'}}>
                      <AlertTriangle size={16} className="text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{inc.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">assigned</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">{inc.description}</p>
                      <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                        <MapPin size={12} /><span>{inc.location}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                        <Clock size={12} />
                        <span>Reported by {inc.profiles?.full_name} · {new Date(inc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => markResolved(inc.id)}
                    className="w-full py-2.5 rounded-2xl text-white text-sm font-semibold transition-all"
                    style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)'}}>
                    ✓ Mark as Resolved
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && activeSection === 'resolved' && (
            <div className="space-y-3 fade-up max-w-2xl mx-auto">
              {resolvedIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <p className="text-gray-400 text-sm">No resolved incidents yet.</p>
                </div>
              )}
              {resolvedIncidents.map(inc => (
                <div key={inc.id} className="white-card p-5 opacity-80">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#f0fdf4'}}>
                      <CheckCircle size={16} className="text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 text-sm">{inc.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">resolved</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{inc.description}</p>
                      <div className="flex items-center gap-1 mt-1.5 text-gray-300 text-xs">
                        <MapPin size={12} /><span>{inc.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}