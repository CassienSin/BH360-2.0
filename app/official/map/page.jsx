'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Map as MapIcon, AlertTriangle, Loader2, Filter } from 'lucide-react'
import dynamic from 'next/dynamic'


const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl flex items-center justify-center" style={{height: '70vh', background: 'white'}}>
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
})

const categoryConfig = {
  Noise: { color: '#f97316', emoji: '🔊' },
  Theft: { color: '#ef4444', emoji: '🚨' },
  Violence: { color: '#dc2626', emoji: '⚠️' },
  Fire: { color: '#ea580c', emoji: '🔥' },
  Flood: { color: '#3b82f6', emoji: '🌊' },
  Infrastructure: { color: '#8b5cf6', emoji: '🛠️' },
  Animals: { color: '#a16207', emoji: '🐕' },
  Medical: { color: '#dc2626', emoji: '🚑' },
  Traffic: { color: '#0891b2', emoji: '🚦' },
  Vandalism: { color: '#7c3aed', emoji: '🎨' },
  Drugs: { color: '#be185d', emoji: '💊' },
  Other: { color: '#6b7280', emoji: '📝' },
}

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

export default function MapView() {
  const router = useRouter()
  const supabase = createClient()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active') // 'active' = pending + assigned (NOT resolved)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: prof } = await supabase.from('profiles').select('barangay_id, role').eq('id', user.id).single()
      if (prof?.role !== 'official' || !prof?.barangay_id) return router.push('/login')

      const { data } = await supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', prof.barangay_id)
        .order('created_at', { ascending: false })

      setIncidents(data || [])
      setLoading(false)
    }
    loadData()
  }, [])

  const filteredIncidents = incidents.filter(inc => {
    let matchesStatus = false
    if (statusFilter === 'all') matchesStatus = true
    else if (statusFilter === 'active') matchesStatus = inc.status === 'pending' || inc.status === 'assigned'
    else matchesStatus = inc.status === statusFilter

    const matchesCategory = categoryFilter === 'all' || inc.category === categoryFilter
    return matchesStatus && matchesCategory
  })

  const incidentsWithCoords = filteredIncidents.filter(i => i.latitude && i.longitude)
  const incidentsWithoutCoords = filteredIncidents.filter(i => !i.latitude || !i.longitude)

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
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
            <MapIcon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Incident Map</h1>
            <p className="text-xs text-gray-400">Visualize incidents across your barangay</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{background: '#f0effe'}}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background: statusFilter === 'resolved' ? '#22c55e' : '#ef4444'}} />
          <span className="text-xs font-bold" style={{color: '#5B54E8'}}>{incidentsWithCoords.length} showing</span>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Filters */}
        <div className="white-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} style={{color: '#5B54E8'}} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{color: '#5B54E8'}}>Filters</p>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap mb-3">
            {[
              { value: 'active', label: '🔴 Active Only', color: '#dc2626' },
              { value: 'all', label: 'All Status', color: '#5B54E8' },
              { value: 'pending', label: 'Pending', color: '#f97316' },
              { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
              { value: 'resolved', label: 'Resolved', color: '#22c55e' },
            ].map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: statusFilter === f.value ? f.color : '#fafaff',
                  color: statusFilter === f.value ? 'white' : '#6b7280',
                  border: statusFilter === f.value ? 'none' : '1px solid #f0effe',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCategoryFilter('all')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: categoryFilter === 'all' ? '#5B54E8' : '#fafaff',
                color: categoryFilter === 'all' ? 'white' : '#6b7280',
                border: categoryFilter === 'all' ? 'none' : '1px solid #f0effe',
              }}>
              All Categories
            </button>
            {Object.entries(categoryConfig).map(([cat, conf]) => {
              // Count only incidents matching the current status filter
              const count = incidents.filter(i => {
                if (!i.latitude || !i.longitude) return false
                if (i.category !== cat) return false
                if (statusFilter === 'all') return true
                if (statusFilter === 'active') return i.status === 'pending' || i.status === 'assigned'
                return i.status === statusFilter
              }).length
              if (count === 0) return null
              return (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  style={{
                    background: categoryFilter === cat ? conf.color : '#fafaff',
                    color: categoryFilter === cat ? 'white' : conf.color,
                    border: categoryFilter === cat ? 'none' : `1px solid ${conf.color}20`,
                  }}>
                  <span>{conf.emoji}</span> {cat} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Map */}
        {loading ? (
          <div className="rounded-3xl flex items-center justify-center" style={{height: '70vh', background: 'white'}}>
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading incidents...</p>
            </div>
          </div>
        ) : incidentsWithCoords.length === 0 ? (
          <div className="white-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center" style={{background: '#f0effe'}}>
              <MapIcon size={28} style={{color: '#5B54E8', opacity: 0.5}} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No incidents on map</h2>
            <p className="text-gray-500 text-sm">
              {incidents.length === 0
                ? 'No incidents reported yet.'
                : 'No incidents with location coordinates match your filters. Encourage residents to pin their locations when reporting!'}
            </p>
          </div>
        ) : (
          <IncidentMap incidents={incidentsWithCoords} />
        )}

        {/* Incidents without coords */}
        {incidentsWithoutCoords.length > 0 && !loading && (
          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {incidentsWithoutCoords.length} incident{incidentsWithoutCoords.length !== 1 ? 's' : ''} without coordinates
              </p>
            </div>
            <p className="text-xs text-gray-400 mb-3">These incidents don't have map locations:</p>
            <div className="space-y-2">
              {incidentsWithoutCoords.slice(0, 5).map(inc => {
                const cat = categoryConfig[inc.category] || categoryConfig.Other
                return (
                  <div key={inc.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                    <span className="text-base">{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{inc.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">📍 {inc.location}</p>
                    </div>
                  </div>
                )
              })}
              {incidentsWithoutCoords.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center pt-2">
                  +{incidentsWithoutCoords.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}