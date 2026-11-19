'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { createClient } from '@/lib/supabase'
import { useNow } from '@/lib/useNow'
import OfficialShell from '@/components/official/OfficialShell'
import { DashboardShellSkeleton } from '@/components/Skeletons'
import { Button } from '@/components/ui/button'
import { StatStrip } from '@/components/ui/stat-strip'
import { Notice } from '@/components/ui/notice'
import { BarChart2, RefreshCw, TrendingUp, Trophy, Star, Activity, Zap, Ticket } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { CATEGORY_CONFIG } from '@/lib/legalBasis'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'

const HOURS_MS = 1000 * 60 * 60

function formatHours(hours) {
  // No data is a dash, not N/A or 0 (one rule for every rate and average).
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

// Chart tooltip. Module level: defined inside the page, it was a new
// component type on every render, so recharts remounted it each time.
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-[12px] px-4 py-3 shadow-lg border border-gray-100">
        <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color || p.fill || 'var(--brand)' }}>
            {p.value} {p.name}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AIAnalytics() {
  const now = useNow()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [analysisTime, setAnalysisTime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.replace(loginHref())
          return
        }
        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('*, barangays(name)')
          .eq('id', user.id)
          .single()

        if (cancelled) return
      // A failed query is not the same as being the wrong role. Sending
      // someone to the login page for a network blip signs them out of a
      // session that is perfectly valid.
        if (profError) {
          console.error('Could not load your profile:', profError)
          toast.error('Could not load analytics. Please refresh.')
          setLoading(false)
          return
        }
        if (prof?.role !== 'official') {
          router.replace(loginHref())
          return
        }
        setProfile(prof)

        const bid = prof.barangay_id
        // Fetch all three datasets in parallel
        const [{ data: inc }, { data: tix }, { data: tan }] = await Promise.all([
          supabase.from('incidents')
            .select('*, assigned_tanod:profiles!incidents_assigned_to_fkey(id, full_name)')
            .eq('barangay_id', bid)
            .order('created_at', { ascending: false }),
          supabase.from('tickets')
            .select('*')
            .eq('barangay_id', bid)
            .order('created_at', { ascending: false }),
          supabase.from('profiles')
            .select('id, full_name, avatar_url')
            .eq('role', 'tanod')
            .eq('barangay_id', bid),
        ])

        if (cancelled) return
        setIncidents(inc || [])
        setTickets(tix || [])
        setTanods(tan || [])
        setDataLoaded(true)
      } catch (err) {
        console.error('Failed to load analytics data:', err)
        if (!cancelled) toast.error('Failed to load data. Please refresh.')
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }
    loadData()

    return () => { cancelled = true }
  }, [supabase, router])

  const generateAnalysis = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setAnalysis('')
    try {
      const response = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidents, tickets }),
      })
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
      const data = await response.json()
      if (typeof data?.analysis !== 'string' || !data.analysis.trim()) {
        throw new Error('Empty analysis returned')
      }
      setAnalysis(data.analysis)
      setAnalysisTime(new Date())
    } catch (err) {
      console.error('AI analysis failed:', err)
      toast.error('Failed to generate AI report. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [loading, incidents, tickets])

  async function copyAnalysis() {
    try {
      await navigator.clipboard.writeText(analysis)
      toast.success('Analysis copied to clipboard!')
    } catch {
      toast.error('Could not copy. Try selecting the text manually.')
    }
  }

  // ============ CALCULATIONS (memoized — these iterate the full dataset) ============

  const stats = useMemo(() => {
    const totalIncidents = incidents.length
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length
    const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0

    const ratedIncidents = incidents.filter(i => i.rating)
    const avgRating = ratedIncidents.length > 0
      ? (ratedIncidents.reduce((a, b) => a + b.rating, 0) / ratedIncidents.length).toFixed(1)
      : null

    const resolvedWithTimes = incidents.filter(i => i.resolved_at && i.created_at)
    const avgResponseHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum, i) => sum + (new Date(i.resolved_at) - new Date(i.created_at)) / HOURS_MS, 0) / resolvedWithTimes.length
      : null

    // Week-over-week delta for the Total Incidents card
    const weekAgo = now - 7 * 24 * HOURS_MS
    const twoWeeksAgo = now - 14 * 24 * HOURS_MS
    const thisWeek = incidents.filter(i => new Date(i.created_at).getTime() >= weekAgo).length
    const lastWeek = incidents.filter(i => {
      const t = new Date(i.created_at).getTime()
      return t >= twoWeeksAgo && t < weekAgo
    }).length

    const openTickets = tickets.filter(t => t.status === 'open').length
    const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length
    const criticalPending = incidents.filter(i => i.priority === 'Critical' && i.status !== 'resolved').length

    return {
      totalIncidents, resolvedIncidents, resolutionRate, avgRating, avgResponseHours,
      thisWeek, lastWeek, openTickets, inProgressTickets, criticalPending,
    }
  }, [incidents, tickets, now])

  const tanodStats = useMemo(() => tanods.map(t => {
    const assigned = incidents.filter(i => i.assigned_to === t.id)
    const resolved = assigned.filter(i => i.status === 'resolved')
    const ratings = assigned.filter(i => i.rating)
    const avgRat = ratings.length > 0 ? ratings.reduce((a, b) => a + b.rating, 0) / ratings.length : 0

    const responseTimes = resolved
      .filter(i => i.resolved_at)
      .map(i => (new Date(i.resolved_at) - new Date(i.created_at)) / HOURS_MS)
    const avgResp = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null

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
      // Performance score: resolution rate (50%), avg rating (30%), responsiveness (20%)
      score: assigned.length > 0
        ? (resolved.length / assigned.length) * 50 +
          (avgRat / 5) * 30 +
          (avgResp !== null && avgResp < 24 ? 20 * (1 - avgResp / 24) : 0)
        : 0,
    }
  }).sort((a, b) => b.score - a.score), [tanods, incidents])

  const heatmapData = useMemo(() => {
    const grid = {}
    incidents.forEach(inc => {
      const date = new Date(inc.created_at)
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
      const key = `${day}-${date.getHours()}`
      grid[key] = (grid[key] || 0) + 1
    })
    return {
      grid,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      hours: Array.from({ length: 24 }, (_, i) => i),
      max: Math.max(...Object.values(grid), 1),
    }
  }, [incidents])

  const topCategories = useMemo(() => {
    const counts = {}
    incidents.forEach(inc => {
      const cat = inc.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return Object.entries(counts)
      .map(([cat, count]) => ({ category: cat, count, ...(CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [incidents])

  // Category trends (last 4 weeks) — labeled with actual date ranges, only top categories
  const trendCategoryData = useMemo(() => {
    const now = new Date()
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const start = new Date(now)
      start.setDate(now.getDate() - (4 - i) * 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      const fmt = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      return { label: `${fmt(start)}–${fmt(end)}`, start, end }
    })

    return weeks.map(week => {
      const weekIncidents = incidents.filter(inc => {
        const d = new Date(inc.created_at)
        return d >= week.start && d < week.end
      })
      const counts = { week: week.label }
      topCategories.forEach(({ category }) => {
        counts[category] = weekIncidents.filter(i => (i.category || 'Other') === category).length
      })
      return counts
    })
  }, [incidents, topCategories])

  const statusData = useMemo(() => [
    { name: 'Pending', value: incidents.filter(i => i.status === 'pending').length, color: '#f97316' },
    { name: 'Assigned', value: incidents.filter(i => i.status === 'assigned').length, color: '#3b82f6' },
    { name: 'Resolved', value: stats.resolvedIncidents, color: '#22c55e' },
  ].filter(d => d.value > 0), [incidents, stats.resolvedIncidents])

  const priorityData = useMemo(() => [
    { name: 'Critical', value: incidents.filter(i => i.priority === 'Critical').length, color: '#dc2626' },
    { name: 'High', value: incidents.filter(i => i.priority === 'High').length, color: '#f97316' },
    { name: 'Medium', value: incidents.filter(i => i.priority === 'Medium').length, color: '#3b82f6' },
    { name: 'Low', value: incidents.filter(i => i.priority === 'Low').length, color: '#22c55e' },
  ].filter(d => d.value > 0), [incidents])

  const dailyTrend = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      const count = incidents.filter(inc => new Date(inc.created_at).toDateString() === date.toDateString()).length
      const resolved = incidents.filter(inc => inc.resolved_at && new Date(inc.resolved_at).toDateString() === date.toDateString()).length
      days.push({ day: dayStr, incidents: count, resolved })
    }
    return days
  }, [incidents])

  function getHeatmapColor(value) {
    if (value === 0) return '#fafaff'
    const intensity = value / heatmapData.max
    if (intensity < 0.25) return '#ede9fe'
    if (intensity < 0.5) return '#c4b5fd'
    if (intensity < 0.75) return '#a78bfa'
    return '#5B54E8'
  }

  // ---- Page loading skeleton ----
  if (pageLoading) return <DashboardShellSkeleton path="/official" kind="analytics" />

  return (
    <OfficialShell profile={profile} active="analytics"
      eyebrow="Analytics" title="How the barangay is doing"
      desc="Reports, response times and ratings from what is on record."
      actions={
        <Button variant="white" onClick={generateAnalysis} disabled={!dataLoaded || loading} aria-busy={loading || undefined}>
          <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Analyzing…' : 'AI report'}
        </Button>
      }
      band={<StatStrip stats={[
        { label: 'Reports', value: stats.totalIncidents, note: `${stats.thisWeek} this week, ${stats.lastWeek} the week before` },
        { label: 'Avg. response', value: formatHours(stats.avgResponseHours), note: 'to the first response' },
        { label: 'Resolved', value: stats.resolvedIncidents, tone: stats.resolvedIncidents ? 'ok' : 'default', note: stats.totalIncidents ? `${stats.resolutionRate}% of reports` : 'no reports yet' },
        { label: 'Rating', value: stats.avgRating ? `${stats.avgRating} / 5` : '—', note: 'from residents' },
      ]} />}>
      <div className="space-y-6">

        {/* Critical alert strip — most urgent info first */}
        {stats.criticalPending > 0 && (
          <Notice tone="danger" title={`${stats.criticalPending} critical incident${stats.criticalPending === 1 ? '' : 's'} still unresolved.`}>
            These need someone now. Open Incidents to dispatch.
          </Notice>
        )}

        <div>
          {/* Ticket summary strip — tickets were fetched but never shown before */}
          {(stats.openTickets > 0 || stats.inProgressTickets > 0) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span
                className="text-xs font-bold h-[22px] px-2 rounded-[6px] flex items-center gap-1.5 bg-warn-soft text-warn"
              >
                <Ticket size={12} /> {stats.openTickets} open ticket{stats.openTickets === 1 ? '' : 's'}
              </span>
              {stats.inProgressTickets > 0 && (
                <span
                  className="text-xs font-bold h-[22px] px-2 rounded-[6px] flex items-center bg-info-soft text-info"
                >
                  {stats.inProgressTickets} in progress
                </span>
              )}
            </div>
          )}
        </div>

        {/* Empty state for a brand-new barangay */}
        {incidents.length === 0 && (
          <div className="white-card p-10 text-center">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--brand-soft)' }}
            >
              <BarChart2 size={28} style={{ color: 'var(--brand)' }} />
            </div>
            <h3 className="text-lg font-bold text-ink mb-1">No incident data yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Charts and insights will appear here once residents start reporting incidents. Check back soon!
            </p>
          </div>
        )}

        {/* Tanod Leaderboard */}
        {tanodStats.length > 0 && (
          <div className="white-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} style={{ color: '#f59e0b' }} />
              <h3 className="text-[15px] font-extrabold text-ink">Tanod Leaderboard</h3>
              <span className="text-xs text-muted-foreground ml-auto">{tanods.length} tanod{tanods.length === 1 ? '' : 's'}</span>
            </div>

            <div className="space-y-2">
              {tanodStats.slice(0, 5).map((t, idx) => {
                const medals = ['🥇', '🥈', '🥉']
                const medal = medals[idx]
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors hover:bg-gray-50"
                    style={{ background: idx < 3 ? `linear-gradient(90deg, ${['#fff7ed', 'var(--brand-soft)', '#fffbeb'][idx]}, transparent)` : '#fafafa' }}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0 w-12">
                      {medal ? <span className="text-2xl" aria-hidden="true">{medal}</span> : <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>}
                    </div>

                    <div
                      className="w-10 h-10 rounded-[12px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{ background: 'var(--ok)' }}
                    >
                      {t.avatar_url ? (
                        <img loading="lazy" decoding="async" src={t.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        t.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{t.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-muted-foreground">{t.resolved}/{t.assigned} resolved</span>
                        {t.avgRating > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                            <Star size={10} fill="#f59e0b" /> {t.avgRating.toFixed(1)}
                            <span className="text-muted-foreground font-normal">({t.ratingCount})</span>
                          </span>
                        )}
                        {t.avgResponseTime !== null && (
                          <span className="text-blue-600 font-semibold">⚡ {formatHours(t.avgResponseTime)}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-lg font-black"
                        style={{ color: !t.assigned ? 'var(--text-muted)' : t.score >= 70 ? 'var(--ok)' : t.score >= 40 ? 'var(--warn)' : 'var(--text-muted)' }}
                        title={t.assigned ? 'Score = resolution rate (50%) + rating (30%) + responsiveness (20%)' : 'Nothing assigned yet, so there is nothing to score'}
                      >
                        {t.assigned ? Math.round(t.score) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">SCORE</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Score = resolution rate (50%) · resident rating (30%) · response speed (20%)
            </p>
          </div>
        )}

        {incidents.length > 0 && (
          <>
            {/* Status & Priority Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="white-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} style={{ color: 'var(--brand)' }} />
                  <h3 className="text-[15px] font-extrabold text-ink">Status Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#6b7280' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="white-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} style={{ color: '#f97316' }} />
                  <h3 className="text-[15px] font-extrabold text-ink">Priority Levels</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {priorityData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#6b7280' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Heatmap */}
            <div className="white-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} style={{ color: 'var(--brand)' }} />
                <h3 className="text-[15px] font-extrabold text-ink">Activity Heatmap</h3>
                <span className="text-xs text-muted-foreground ml-auto">When incidents are reported</span>
              </div>

              {/* Phones: the 24 hours scroll sideways under a fixed day column. */}
              <p className="sm:hidden text-xs text-muted-foreground mb-2">Swipe sideways to see all 24 hours.</p>
              <div className="overflow-x-auto rail-fade sm:[mask-image:none] sm:[-webkit-mask-image:none]">
                <div className="min-w-[600px]">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-10 flex-shrink-0 sticky left-0 z-[1] bg-white"></div>
                    {heatmapData.hours.map(h => (
                      <div key={h} className="flex-1 text-[11px] text-muted-foreground text-center">
                        {h % 3 === 0 ? `${h}h` : ''}
                      </div>
                    ))}
                  </div>
                  {heatmapData.days.map(day => (
                    <div key={day} className="flex items-center gap-1 mb-1">
                      <div className="w-10 flex-shrink-0 self-stretch flex items-center sticky left-0 z-[1] bg-white text-xs font-semibold text-muted-foreground">{day}</div>
                      {heatmapData.hours.map(h => {
                        const value = heatmapData.grid[`${day}-${h}`] || 0
                        return (
                          <div
                            key={h}
                            className="flex-1 aspect-square rounded transition-all hover:scale-125 cursor-help"
                            style={{ background: getHeatmapColor(value) }}
                            title={`${day} ${h}:00 — ${value} incident${value === 1 ? '' : 's'}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-xs">
                <span className="text-muted-foreground">Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
                  <div key={i} className="w-5 h-5 rounded" style={{ background: getHeatmapColor(intensity * heatmapData.max) }} />
                ))}
                <span className="text-muted-foreground">More</span>
              </div>
            </div>

            {/* Category Trends */}
            <div className="white-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} style={{ color: 'var(--brand)' }} />
                <h3 className="text-[15px] font-extrabold text-ink">Category Trends — Last 4 Weeks</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {topCategories.map(cat => (
                    <Line
                      key={cat.category}
                      type="monotone"
                      dataKey={cat.category}
                      stroke={cat.color}
                      strokeWidth={2.5}
                      dot={{ fill: cat.color, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                  <Legend iconType="circle" iconSize={6}
                    formatter={(value) => <span style={{ fontSize: 12, color: '#6b7280' }}>{CATEGORY_CONFIG[value]?.icon} {value}</span>} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Activity */}
            <div className="white-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} style={{ color: 'var(--brand)' }} />
                <h3 className="text-[15px] font-extrabold text-ink">Daily Activity — Last 14 Days</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B54E8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#5B54E8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0effe" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="incidents" name="reported" stroke="#5B54E8" strokeWidth={2} fillOpacity={1} fill="url(#colorIncidents)" />
                  <Area type="monotone" dataKey="resolved" name="resolved" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Categories */}
            <div className="white-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} style={{ color: 'var(--brand)' }} />
                <h3 className="text-[15px] font-extrabold text-ink">Top Incident Categories</h3>
              </div>
              <div className="space-y-3">
                {topCategories.map(cat => {
                  const percent = stats.totalIncidents > 0 ? (cat.count / stats.totalIncidents) * 100 : 0
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base" aria-hidden="true">{cat.icon}</span>
                          <span className="text-sm font-semibold text-body">{cat.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: cat.color }}>{cat.count}</span>
                          <span className="text-xs text-muted-foreground">({percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                          style={{ width: `${percent}%`, background: cat.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* AI Analysis */}
        <div className="white-card p-6 relative overflow-hidden">
          {analysis && (
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)', filter: 'blur(60px)' }}
            />
          )}

          <div className="relative">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 relative">
                  <div
                    className="absolute inset-0 rounded-[12px]"
                    style={{ background: 'var(--brand-strong)' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BarChart2 size={20} className="text-white" />
                  </div>
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--warn)' }}
                  >
                    <span className="text-[11px]" aria-hidden="true">✨</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-ink text-lg">AI-Powered Insights</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                      CLAUDE AI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Smart analysis powered by Claude</p>
                </div>
              </div>

              {analysis && (
                <button
                  onClick={generateAnalysis}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-[12px] text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
                >
                  <RefreshCw size={12} /> Regenerate
                </button>
              )}
            </div>

            {!analysis && !loading && (
              <div className="text-center py-12 px-4">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div
                    className="absolute inset-0 rounded-3xl"
                    style={{ background: 'var(--brand-strong)', opacity: 0.1 }}
                  />
                  <div
                    className="absolute inset-2 rounded-[12px] flex items-center justify-center"
                    style={{ background: 'var(--brand-strong)' }}
                  >
                    <BarChart2 size={28} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-ink mb-2">Ready to analyze your data</h3>
                <p className="text-sm text-muted-foreground mb-1 max-w-md mx-auto">
                  Get AI-powered insights, trend analysis, hotspot detection, and actionable recommendations.
                </p>
                <p className="text-xs text-muted-foreground mb-6">Analysis takes about 10-15 seconds.</p>

                <button
                  onClick={generateAnalysis}
                  disabled={!dataLoaded || incidents.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-105"
                  style={{ background: 'var(--brand-strong)' }}
                >
                  ✨ Generate AI Report
                </button>
                {incidents.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-3">Needs at least one incident to analyze</p>
                )}
              </div>
            )}

            {loading && (
              <div className="py-8" role="status" aria-label="Generating analysis">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <div
                      className="absolute inset-0 rounded-[12px]"
                      style={{ background: 'var(--brand-strong)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BarChart2 size={20} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">Claude AI is analyzing...</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--brand)', animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--brand-light)', animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '300ms' }} />
                      <span className="text-xs text-muted-foreground ml-1.5">Processing your data</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 max-w-xl mx-auto">
                  {[85, 100, 75, 95, 60, 90].map((w, i) => (
                    <div key={i} className="skeleton-shimmer h-4 rounded-xl" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            )}

            {analysis && (
              <div className="fade-up">
                <div
                  className="rounded-[12px] p-6 mb-4"
                  style={{ background: 'linear-gradient(135deg, var(--app-surface) 0%, #f5f4ff 100%)', border: '1px solid var(--brand-soft)' }}
                >
                  <div className="markdown ai-analysis text-body leading-relaxed">
                    <ReactMarkdown>{analysis}</ReactMarkdown>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Generated at {analysisTime?.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyAnalysis}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors hover:bg-gray-50"
                      style={{ color: '#6b7280', border: '1px solid #e5e7eb' }}
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={generateAnalysis}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: 'var(--brand-strong)' }}
                    >
                      <RefreshCw size={11} /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </OfficialShell>
  )
}