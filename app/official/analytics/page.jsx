'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, BarChart2, RefreshCw, AlertTriangle, FileText, MapPin, TrendingUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
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

  export default function AIAnalytics() {
    const router = useRouter()
    const supabase = createClient()
    const [incidents, setIncidents] = useState([])
    const [tickets, setTickets] = useState([])
    const [analysis, setAnalysis] = useState('')
    const [loading, setLoading] = useState(false)
    const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: inc } = await supabase.from('incidents').select('*').order('created_at', { ascending: false })
      const { data: tix } = await supabase.from('tickets').select('*').order('created_at', { ascending: false })
      setIncidents(inc || [])
      setTickets(tix || [])
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

  const pendingCount = incidents.filter(i => i.status === 'pending').length
  const assignedCount = incidents.filter(i => i.status === 'assigned').length
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length
  const openTickets = tickets.filter(t => t.status === 'open').length
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length
  const closedTickets = tickets.filter(t => t.status === 'closed').length

  const incidentStatusData = [
    { name: 'Pending', value: pendingCount, color: '#f97316' },
    { name: 'Assigned', value: assignedCount, color: '#3b82f6' },
    { name: 'Resolved', value: resolvedCount, color: '#22c55e' },
  ]

  const ticketStatusData = [
    { name: 'Open', value: openTickets, color: '#f97316' },
    { name: 'In Progress', value: inProgressTickets, color: '#3b82f6' },
    { name: 'Closed', value: closedTickets, color: '#22c55e' },
  ]

  const locationMap = {}
  incidents.forEach(inc => {
    const loc = inc.location?.split(',')[0]?.trim() || 'Unknown'
    locationMap[loc] = (locationMap[loc] || 0) + 1
  })
  const hotspotData = Object.entries(locationMap)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  })
  const trendData = last7Days.map(day => {
    const count = incidents.filter(inc => {
      const incDate = new Date(inc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      return incDate === day
    }).length
    return { day, incidents: count }
  })

  const typeMap = {}
  incidents.forEach(inc => {
    const title = inc.title?.toLowerCase() || ''
    let type = 'Other'
    if (title.includes('noise')) type = 'Noise'
    else if (title.includes('fire')) type = 'Fire'
    else if (title.includes('flood')) type = 'Flood'
    else if (title.includes('theft') || title.includes('steal')) type = 'Theft'
    else if (title.includes('fight') || title.includes('assault')) type = 'Violence'
    else if (title.includes('stray') || title.includes('animal')) type = 'Animals'
    else if (title.includes('light') || title.includes('streetlight')) type = 'Infrastructure'
    typeMap[type] = (typeMap[type] || 0) + 1
  })
  const typeData = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  const COLORS = ['#5B54E8', '#7C75F0', '#f97316', '#22c55e', '#3b82f6', '#f43f5e', '#a78bfa']

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-2xl px-4 py-3 shadow-lg border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm font-bold" style={{color: p.color || '#5B54E8'}}>
              {p.value} {p.name}
            </p>
          ))}
        </div>
      )
    }
    return null
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
            <h1 className="text-base font-bold text-gray-800">AI Analytics</h1>
            <p className="text-xs text-gray-400">AI-powered barangay insights</p>
          </div>
        </div>
        <button onClick={generateAnalysis} disabled={loading || !dataLoaded}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold disabled:opacity-50 transition-all"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: 'white', boxShadow: '0 4px 16px rgba(91,84,232,0.3)'}}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:block">{loading ? 'Analyzing...' : 'Generate AI Report'}</span>
          <span className="sm:hidden">{loading ? '...' : 'Generate'}</span>
        </button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Summary Stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60 mb-3">Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Pending', value: pendingCount, color: '#f97316' },
              { label: 'Assigned', value: assignedCount, color: '#3b82f6' },
              { label: 'Resolved', value: resolvedCount, color: '#22c55e' },
              { label: 'Open', value: openTickets, color: '#f97316' },
              { label: 'In Progress', value: inProgressTickets, color: '#3b82f6' },
              { label: 'Closed', value: closedTickets, color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} className="white-card p-4 text-center">
                <p className="text-2xl font-bold" style={{color}}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pie Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} style={{color: '#5B54E8'}} />
              <h3 className="font-bold text-gray-800 text-sm">Incident Status</h3>
            </div>
            {incidents.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={incidentStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value">
                    {incidentStatusData.map((entry, index) => (
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
              <FileText size={16} style={{color: '#5B54E8'}} />
              <h3 className="font-bold text-gray-800 text-sm">Ticket Status</h3>
            </div>
            {tickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={ticketStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value">
                    {ticketStatusData.map((entry, index) => (
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

        {/* Line Chart */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{color: '#5B54E8'}} />
            <h3 className="font-bold text-gray-800 text-sm">Incident Trend — Last 7 Days</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" />
              <XAxis dataKey="day" tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="incidents" stroke="#5B54E8" strokeWidth={3}
                dot={{fill: '#5B54E8', strokeWidth: 2, r: 5}}
                activeDot={{r: 7, fill: '#7C75F0'}} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hotspot Bar Chart */}
        {hotspotData.length > 0 && (
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} style={{color: '#5B54E8'}} />
              <h3 className="font-bold text-gray-800 text-sm">Incident Hotspots by Location</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hotspotData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" horizontal={false} />
                <XAxis type="number" tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="location" tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="incidents" radius={[0, 8, 8, 0]}>
                  {hotspotData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Type Bar Chart */}
        {typeData.length > 0 && (
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} style={{color: '#5B54E8'}} />
              <h3 className="font-bold text-gray-800 text-sm">Incident Types Breakdown</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" vertical={false} />
                <XAxis dataKey="type" tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="incidents" radius={[8, 8, 0, 0]}>
                  {typeData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Analysis */}
        <div className="white-card p-6 relative overflow-hidden">

          {/* Decorative gradient */}
          {analysis && (
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{background: 'radial-gradient(circle, #5B54E8 0%, transparent 70%)', filter: 'blur(60px)'}} />
          )}

          <div className="relative">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)'}}>
                  <BarChart2 size={20} className="text-white" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
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
                  <p className="text-xs text-gray-400">Smart analysis powered by Claude Sonnet 4.5</p>
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

            {/* Empty state */}
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

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                  {[
                    { icon: '📊', title: 'Trend Analysis', desc: 'Identify patterns' },
                    { icon: '🎯', title: 'Hotspot Detection', desc: 'Find problem areas' },
                    { icon: '💡', title: 'Smart Recommendations', desc: 'Get actionable advice' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-2xl" style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <p className="text-xs font-bold text-gray-700">{item.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
              {loading && (
                <div className="py-8">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <div className="absolute inset-0 rounded-2xl"
                        style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)', animation: 'float 2s ease-in-out infinite'}}>
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

            {/* Analysis result */}
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