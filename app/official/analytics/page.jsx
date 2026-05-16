'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, BarChart2, RefreshCw, AlertTriangle, FileText, MapPin, TrendingUp, Trophy, Clock, Star, Activity, Award, Zap, Users } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'

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
  Noise: { icon: '🔊', color: '#f97316' },
  Theft: { icon: '🚨', color: '#ef4444' },
  Violence: { icon: '⚠️', color: '#dc2626' },
  Fire: { icon: '🔥', color: '#ea580c' },
  Flood: { icon: '🌊', color: '#3b82f6' },
  Infrastructure: { icon: '🛠️', color: '#8b5cf6' },
  Animals: { icon: '🐕', color: '#a16207' },
  Medical: { icon: '🚑', color: '#dc2626' },
  Traffic: { icon: '🚦', color: '#0891b2' },
  Vandalism: { icon: '🎨', color: '#7c3aed' },
  Drugs: { icon: '💊', color: '#be185d' },
  Other: { icon: '📝', color: '#6b7280' },
}

export default function AIAnalytics() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data: prof } = await supabase.from('profiles').select('*, barangays(name)').eq('id', user.id).single()
      if (prof?.role !== 'official') return router.push('/login')
      setProfile(prof)

      const bid = prof.barangay_id

      const { data: inc } = await supabase.from('incidents')
        .select('*, assigned_tanod:profiles!incidents_assigned_to_fkey(id, full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })

      const { data: tix } = await supabase.from('tickets')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })

      const { data: tan } = await supabase.from('profiles')
        .select('*')
        .eq('role', 'tanod')
        .eq('barangay_id', bid)

      setIncidents(inc || [])
      setTickets(tix || [])
      setTanods(tan || [])
      setDataLoaded(true)
    }
    loadData()
  }, [])

  async function generateAnalysis() {
    setLoading(true)
    setAnalysis('')
    const response = await fetch('/api/ai-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidents, tickets })
    })
    const data = await response.json()
    setAnalysis(data.analysis)
    setLoading(false)
  }

  // ============ CALCULATIONS ============

  // KPI Stats
  const totalIncidents = incidents.length
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0

  const ratedIncidents = incidents.filter(i => i.rating)
  const avgRating = ratedIncidents.length > 0
    ? (ratedIncidents.reduce((a, b) => a + b.rating, 0) / ratedIncidents.length).toFixed(1)
    : null

  // Average response time
  const resolvedWithTimes = incidents.filter(i => i.resolved_at && i.created_at)
  const avgResponseHours = resolvedWithTimes.length > 0
    ? resolvedWithTimes.reduce((sum, i) =>
        sum + (new Date(i.resolved_at) - new Date(i.created_at)) / (1000 * 60 * 60), 0
      ) / resolvedWithTimes.length
    : null

  // Tanod Leaderboard
  const tanodStats = tanods.map(t => {
    const assigned = incidents.filter(i => i.assigned_to === t.id)
    const resolved = assigned.filter(i => i.status === 'resolved')
    const ratings = assigned.filter(i => i.rating)
    const avgRat = ratings.length > 0 ? (ratings.reduce((a, b) => a + b.rating, 0) / ratings.length) : 0

    // Avg response time for this tanod
    const responseTimes = resolved
      .filter(i => i.resolved_at)
      .map(i => (new Date(i.resolved_at) - new Date(i.created_at)) / (1000 * 60 * 60))
    const avgResp = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null

    return {
      id: t.id,
      name: t.full_name,
      avatar_url: t.avatar_url,
      assigned: assigned.length,
      resolved: resolved.length,
      resolutionRate: assigned.length > 0 ? Math.round((resolved.length / assigned.length) * 100) : 0,
      avgRating: avgRat,
      ratingCount: ratings.length,
      avgResponseTime: avgResp,
      // Performance score: weight resolution rate (50%), avg rating (30%), responsiveness (20%)
      score: assigned.length > 0
        ? (resolved.length / assigned.length) * 50 +
          (avgRat / 5) * 30 +
          (avgResp !== null && avgResp < 24 ? 20 * (1 - avgResp / 24) : 0)
        : 0
    }
  }).sort((a, b) => b.score - a.score)

  // Response Time Heatmap (hour x day-of-week)
  const heatmapData = (() => {
    const grid = {} // { 'Mon-9': count }
    incidents.forEach(inc => {
      const date = new Date(inc.created_at)
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
      const hour = date.getHours()
      const key = `${day}-${hour}`
      grid[key] = (grid[key] || 0) + 1
    })

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const hours = Array.from({length: 24}, (_, i) => i)
    return { grid, days, hours }
  })()

  const maxHeatmapValue = Math.max(...Object.values(heatmapData.grid), 1)

  // Category Trends (last 4 weeks)
  const trendCategoryData = (() => {
    const now = new Date()
    const weeks = [...Array(4)].map((_, i) => {
      const start = new Date(now)
      start.setDate(now.getDate() - (3 - i) * 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { label: `Week ${i + 1}`, start, end }
    })

    return weeks.map(week => {
      const weekIncidents = incidents.filter(inc => {
        const d = new Date(inc.created_at)
        return d >= week.start && d < week.end
      })
      const counts = { week: week.label }
      Object.keys(categoryConfig).forEach(cat => {
        counts[cat] = weekIncidents.filter(i => i.category === cat).length
      })
      return counts
    })
  })()

  // Top categories
  const topCategories = (() => {
    const counts = {}
    incidents.forEach(inc => {
      const cat = inc.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return Object.entries(counts)
      .map(([cat, count]) => ({ category: cat, count, ...categoryConfig[cat] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  })()

  // Status data
  const statusData = [
    { name: 'Pending', value: incidents.filter(i => i.status === 'pending').length, color: '#f97316' },
    { name: 'Assigned', value: incidents.filter(i => i.status === 'assigned').length, color: '#3b82f6' },
    { name: 'Resolved', value: resolvedIncidents, color: '#22c55e' },
  ]

  // Priority distribution
  const priorityData = [
    { name: 'Critical', value: incidents.filter(i => i.priority === 'Critical').length, color: '#dc2626' },
    { name: 'High', value: incidents.filter(i => i.priority === 'High').length, color: '#f97316' },
    { name: 'Medium', value: incidents.filter(i => i.priority === 'Medium').length, color: '#3b82f6' },
    { name: 'Low', value: incidents.filter(i => i.priority === 'Low').length, color: '#22c55e' },
  ]

  // Daily trend (last 14 days)
  const dailyTrend = (() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      const count = incidents.filter(inc => {
        const d = new Date(inc.created_at)
        return d.toDateString() === date.toDateString()
      }).length
      const resolved = incidents.filter(inc => {
        if (!inc.resolved_at) return false
        const d = new Date(inc.resolved_at)
        return d.toDateString() === date.toDateString()
      }).length
      days.push({ day: dayStr, incidents: count, resolved })
    }
    return days
  })()

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-2xl px-4 py-3 shadow-lg border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm font-bold" style={{color: p.color || p.fill || '#5B54E8'}}>
              {p.value} {p.name}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  function getHeatmapColor(value) {
    if (value === 0) return '#fafaff'
    const intensity = value / maxHeatmapValue
    if (intensity < 0.25) return '#ede9fe'
    if (intensity < 0.5) return '#c4b5fd'
    if (intensity < 0.75) return '#a78bfa'
    return '#5B54E8'
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
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
            <BarChart2 size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Analytics Dashboard</h1>
            <p className="text-xs text-gray-400">Insights and trends · {profile?.barangays?.name}</p>
          </div>
        </div>
        <button onClick={generateAnalysis} disabled={loading || !dataLoaded}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold disabled:opacity-50 transition-all"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: 'white', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:block">{loading ? 'Analyzing...' : 'AI Report'}</span>
          <span className="sm:hidden">{loading ? '...' : 'AI'}</span>
        </button>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* KPI Scorecards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60 mb-3">Key Performance Indicators</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="white-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                  <Activity size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{background: '#f0effe', color: '#5B54E8'}}>TOTAL</span>
              </div>
              <p className="text-3xl font-black text-gray-800">{totalIncidents}</p>
              <p className="text-xs text-gray-400 mt-1">Total Incidents</p>
            </div>

            <div className="white-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)'}}>
                  <Award size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{background: '#f0fdf4', color: '#16a34a'}}>RATE</span>
              </div>
              <p className="text-3xl font-black text-gray-800">{resolutionRate}%</p>
              <p className="text-xs text-gray-400 mt-1">Resolution Rate</p>
            </div>

            <div className="white-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #3b82f6, #2563eb)'}}>
                  <Clock size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{background: '#eff6ff', color: '#2563eb'}}>SPEED</span>
              </div>
              <p className="text-3xl font-black text-gray-800">
                {avgResponseHours !== null
                  ? avgResponseHours < 1
                    ? `${Math.round(avgResponseHours * 60)}m`
                    : `${avgResponseHours.toFixed(1)}h`
                  : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Avg Response Time</p>
            </div>

            <div className="white-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)'}}>
                  <Star size={18} className="text-white fill-white" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{background: '#fffbeb', color: '#d97706'}}>RATING</span>
              </div>
              <p className="text-3xl font-black text-gray-800">
                {avgRating ? `${avgRating}★` : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Avg Resident Rating</p>
            </div>
          </div>
        </div>

        {/* Tanod Leaderboard */}
        {tanodStats.length > 0 && (
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} style={{color: '#f59e0b'}} />
              <h3 className="font-bold text-gray-800 text-sm">Tanod Leaderboard</h3>
              <span className="text-xs text-gray-400 ml-auto">{tanods.length} tanods</span>
            </div>

            <div className="space-y-2">
              {tanodStats.slice(0, 5).map((t, idx) => {
                const medals = ['🥇', '🥈', '🥉']
                const medal = medals[idx]
                return (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-gray-50"
                    style={{background: idx < 3 ? `linear-gradient(90deg, ${['#fff7ed', '#f0effe', '#fffbeb'][idx]}, transparent)` : '#fafafa'}}>
                    <div className="flex items-center gap-2 flex-shrink-0 w-12">
                      {medal ? (
                        <span className="text-2xl">{medal}</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                      )}
                    </div>

                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)'}}>
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        t.name?.[0]?.toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{t.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-gray-400">{t.resolved}/{t.assigned} resolved</span>
                        {t.avgRating > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                            <Star size={10} fill="#f59e0b" /> {t.avgRating.toFixed(1)}
                          </span>
                        )}
                        {t.avgResponseTime !== null && (
                          <span className="text-blue-600 font-semibold">
                            ⚡ {t.avgResponseTime < 1 ? `${Math.round(t.avgResponseTime * 60)}m` : `${t.avgResponseTime.toFixed(1)}h`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black" style={{color: t.score >= 70 ? '#22c55e' : t.score >= 40 ? '#f97316' : '#9ca3af'}}>
                        {Math.round(t.score)}
                      </p>
                      <p className="text-[10px] text-gray-400">SCORE</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Status & Priority Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} style={{color: '#5B54E8'}} />
              <h3 className="font-bold text-gray-800 text-sm">Status Distribution</h3>
            </div>
            {incidents.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{fontSize: '12px', color: '#6b7280'}}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} style={{color: '#f97316'}} />
              <h3 className="font-bold text-gray-800 text-sm">Priority Levels</h3>
            </div>
            {incidents.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value">
                    {priorityData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{fontSize: '12px', color: '#6b7280'}}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{color: '#5B54E8'}} />
            <h3 className="font-bold text-gray-800 text-sm">Activity Heatmap</h3>
            <span className="text-xs text-gray-400 ml-auto">When incidents are reported</span>
          </div>

          {incidents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-10 flex-shrink-0"></div>
                    {heatmapData.hours.map(h => (
                      <div key={h} className="flex-1 text-[9px] text-gray-400 text-center">
                        {h % 3 === 0 ? `${h}h` : ''}
                      </div>
                    ))}
                  </div>
                  {heatmapData.days.map(day => (
                    <div key={day} className="flex items-center gap-1 mb-1">
                      <div className="w-10 flex-shrink-0 text-xs font-semibold text-gray-500">{day}</div>
                      {heatmapData.hours.map(h => {
                        const key = `${day}-${h}`
                        const value = heatmapData.grid[key] || 0
                        return (
                          <div key={h} className="flex-1 aspect-square rounded transition-all hover:scale-125 cursor-help"
                            style={{background: getHeatmapColor(value)}}
                            title={`${day} ${h}:00 - ${value} incidents`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-xs">
                <span className="text-gray-400">Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
                  <div key={i} className="w-5 h-5 rounded"
                    style={{background: getHeatmapColor(intensity * maxHeatmapValue)}} />
                ))}
                <span className="text-gray-400">More</span>
              </div>
            </>
          )}
        </div>

        {/* Category Trends */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{color: '#5B54E8'}} />
            <h3 className="font-bold text-gray-800 text-sm">Category Trends — Last 4 Weeks</h3>
          </div>
          {incidents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" />
                <XAxis dataKey="week" tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                {topCategories.map(cat => (
                  <Line key={cat.category} type="monotone" dataKey={cat.category}
                    stroke={cat.color} strokeWidth={2.5}
                    dot={{fill: cat.color, r: 4}}
                    activeDot={{r: 6}} />
                ))}
                <Legend iconType="circle" iconSize={6}
                  formatter={(value) => <span style={{fontSize: '11px', color: '#6b7280'}}>{categoryConfig[value]?.icon} {value}</span>} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily Activity */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{color: '#5B54E8'}} />
            <h3 className="font-bold text-gray-800 text-sm">Daily Activity — Last 14 Days</h3>
          </div>
          {incidents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B54E8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#5B54E8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" />
                <XAxis dataKey="day" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="incidents" name="reported" stroke="#5B54E8" strokeWidth={2}
                  fillOpacity={1} fill="url(#colorIncidents)" />
                <Area type="monotone" dataKey="resolved" name="resolved" stroke="#22c55e" strokeWidth={2}
                  fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Categories */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} style={{color: '#5B54E8'}} />
            <h3 className="font-bold text-gray-800 text-sm">Top Incident Categories</h3>
          </div>
          {topCategories.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <div className="space-y-3">
              {topCategories.map((cat, i) => {
                const percent = totalIncidents > 0 ? (cat.count / totalIncidents) * 100 : 0
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-sm font-semibold text-gray-700">{cat.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{color: cat.color}}>{cat.count}</span>
                        <span className="text-xs text-gray-400">({percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden" style={{background: '#f3f4f6'}}>
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                        style={{width: `${percent}%`, background: cat.color}} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Analysis */}
        <div className="white-card p-6 relative overflow-hidden">
          {analysis && (
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{background: 'radial-gradient(circle, #5B54E8 0%, transparent 70%)', filter: 'blur(60px)'}} />
          )}

          <div className="relative">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative" style={{animation: 'float 2s ease-in-out infinite'}}>
                  <div className="absolute inset-0 rounded-2xl"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BarChart2 size={20} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-10"
                    style={{background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 2px 8px rgba(251,191,36,0.4)'}}>
                    <span className="text-[8px]">✨</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-800 text-lg">AI-Powered Insights</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background: '#fef3c7', color: '#92400e'}}>
                      CLAUDE AI
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Smart analysis powered by Claude</p>
                </div>
              </div>

              {analysis && (
                <button onClick={generateAnalysis} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all hover:scale-105"
                  style={{background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff'}}>
                  <RefreshCw size={12} /> Regenerate
                </button>
              )}
            </div>

            {!analysis && !loading && (
              <div className="text-center py-12 px-4">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-3xl"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', opacity: 0.1, animation: 'float 4s ease-in-out infinite'}} />
                  <div className="absolute inset-2 rounded-2xl flex items-center justify-center"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)'}}>
                    <BarChart2 size={28} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Ready to analyze your data</h3>
                <p className="text-sm text-gray-500 mb-1 max-w-md mx-auto">Get AI-powered insights, trend analysis, hotspot detection, and actionable recommendations.</p>
                <p className="text-xs text-gray-400 mb-6">Analysis takes about 10-15 seconds.</p>

                <button onClick={generateAnalysis} disabled={!dataLoaded}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-105"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)'}}>
                  ✨ Generate AI Report
                </button>
              </div>
            )}

            {loading && (
              <div className="py-8">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="relative w-12 h-12 flex-shrink-0" style={{animation: 'float 2s ease-in-out infinite'}}>
                    <div className="absolute inset-0 rounded-2xl"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BarChart2 size={20} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Claude AI is analyzing...</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background: '#5B54E8', animationDelay: '0ms'}} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background: '#7C75F0', animationDelay: '150ms'}} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background: '#a78bfa', animationDelay: '300ms'}} />
                      <span className="text-xs text-gray-400 ml-1.5">Processing your data</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 max-w-xl mx-auto">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton-shimmer h-4 rounded-xl"
                      style={{width: `${[85, 100, 75, 95, 60, 90][i]}%`}} />
                  ))}
                </div>
              </div>
            )}

            {analysis && (
              <div className="fade-up">
                <div className="rounded-2xl p-6 mb-4"
                  style={{background: 'linear-gradient(135deg, #fafaff 0%, #f5f4ff 100%)', border: '1px solid #f0effe'}}>
                  <div className="markdown ai-analysis text-gray-700 leading-relaxed">
                    <ReactMarkdown>{analysis}</ReactMarkdown>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Analysis generated just now
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      navigator.clipboard.writeText(analysis)
                      alert('Analysis copied to clipboard!')
                    }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors hover:bg-gray-50"
                      style={{color: '#6b7280', border: '1px solid #e5e7eb'}}>
                      📋 Copy
                    </button>
                    <button onClick={generateAnalysis} disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
                      <RefreshCw size={11} /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}