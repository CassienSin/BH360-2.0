'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {DOTS.map((dot, i) => (
      <div
        key={i}
        style={{
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
        }}
      />
    ))}
  </div>
)

const CATEGORY_CONFIG = {
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

const PRIORITY_CONFIG = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠' },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarView() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date()) // default to today so the panel isn't empty
  const [colorBy, setColorBy] = useState('category') // 'category' or 'priority'
  const [showAnnouncements, setShowAnnouncements] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/login')
          return
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*, barangays(name)')
          .eq('id', user.id)
          .single()

        if (cancelled) return
        if (prof?.role !== 'official' || !prof?.barangay_id) {
          router.push('/login')
          return
        }
        setProfile(prof)

        const [{ data: inc }, { data: ann }] = await Promise.all([
          supabase.from('incidents')
            .select('*, profiles!incidents_reported_by_fkey(full_name)')
            .eq('barangay_id', prof.barangay_id)
            .order('created_at', { ascending: false }),
          supabase.from('announcements')
            .select('*')
            .eq('barangay_id', prof.barangay_id)
            .order('created_at', { ascending: false }),
        ])

        if (cancelled) return
        setIncidents(inc || [])
        setAnnouncements(ann || [])
      } catch (err) {
        console.error('Failed to load calendar data:', err)
        if (!cancelled) toast.error('Failed to load data. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()

    return () => { cancelled = true }
  }, [supabase, router])

  // Calendar frame
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const startDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Bucket items by day for the visible month — O(n) once, instead of
  // filtering the whole array for every calendar cell on every render
  const incidentsByDay = useMemo(() => {
    const map = new Map()
    incidents.forEach(inc => {
      const d = new Date(inc.created_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day).push(inc)
      }
    })
    return map
  }, [incidents, year, month])

  const announcementsByDay = useMemo(() => {
    const map = new Map()
    announcements.forEach(a => {
      const d = new Date(a.created_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day).push(a)
      }
    })
    return map
  }, [announcements, year, month])

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const monthly = [...incidentsByDay.values()].flat()
    return {
      total: monthly.length,
      resolved: monthly.filter(i => i.status === 'resolved').length,
      pending: monthly.filter(i => i.status === 'pending').length,
      critical: monthly.filter(i => i.priority === 'Critical').length,
    }
  }, [incidentsByDay])

  // Legend: only show categories/priorities that actually occur this month
  const legendEntries = useMemo(() => {
    const monthly = [...incidentsByDay.values()].flat()
    if (colorBy === 'category') {
      const present = new Set(monthly.map(i => i.category || 'Other'))
      return Object.entries(CATEGORY_CONFIG).filter(([cat]) => present.has(cat))
    }
    const present = new Set(monthly.map(i => i.priority || 'Medium'))
    return Object.entries(PRIORITY_CONFIG).filter(([p]) => present.has(p))
  }, [incidentsByDay, colorBy])

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }
  function goToToday() {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  function isToday(day) {
    const today = new Date()
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  function isSelected(day) {
    if (!selectedDate) return false
    return selectedDate.getFullYear() === year &&
           selectedDate.getMonth() === month &&
           selectedDate.getDate() === day
  }

  function handleDayClick(day) {
    // Clicking the selected day again deselects it
    if (isSelected(day)) {
      setSelectedDate(null)
    } else {
      setSelectedDate(new Date(year, month, day))
    }
  }

  // Build calendar grid
  const calendarCells = useMemo(() => {
    const cells = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) cells.push(day)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [startDay, daysInMonth])

  // Selected day items (in this month only — selection resets on month change)
  const selectedInThisMonth = selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month
  const selectedIncidents = selectedInThisMonth ? (incidentsByDay.get(selectedDate.getDate()) || []) : []
  const selectedAnnouncements = selectedInThisMonth && showAnnouncements
    ? (announcementsByDay.get(selectedDate.getDate()) || [])
    : []

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-brand">
        <AnimatedDots />
        <header
          className="bg-white relative z-10 px-4 sm:px-6 py-4 flex items-center gap-3"
          style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
        >
          <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer h-4 w-32 rounded-lg" />
            <div className="skeleton-shimmer h-3 w-48 rounded-lg" />
          </div>
        </header>
        <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="white-card p-4 space-y-2">
                <div className="skeleton-shimmer h-3 w-16 rounded-lg" />
                <div className="skeleton-shimmer h-7 w-10 rounded-lg" />
                <div className="skeleton-shimmer h-3 w-20 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="white-card p-5">
            <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading calendar...</span>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
      </div>

      <header
        className="bg-white relative z-10 px-4 sm:px-6 py-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
          >
            <CalendarIcon size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">Calendar View</h1>
            <p className="text-xs text-gray-400 truncate">
              Incidents & events by date{profile?.barangays?.name ? ` · ${profile.barangays.name}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={goToToday}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
          style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}
        >
          Today
        </button>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Monthly Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">This Month</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#5B54E8' }}>{monthlyStats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Incidents</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#f97316' }}>{monthlyStats.pending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Need attention</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Resolved</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#22c55e' }}>{monthlyStats.resolved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completed</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Critical</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#dc2626' }}>{monthlyStats.critical}</p>
            <p className="text-xs text-gray-500 mt-0.5">Urgent cases</p>
          </div>
        </div>

        {/* Filter toggles */}
        <div className="white-card p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} style={{ color: '#5B54E8' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>View</p>
          </div>

          <div className="flex gap-1" role="group" aria-label="Color dots by">
            <button
              onClick={() => setColorBy('category')}
              aria-pressed={colorBy === 'category'}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: colorBy === 'category' ? '#5B54E8' : '#fafaff',
                color: colorBy === 'category' ? 'white' : '#6b7280',
                border: colorBy === 'category' ? '1px solid #5B54E8' : '1px solid #f0effe',
              }}
            >
              By Category
            </button>
            <button
              onClick={() => setColorBy('priority')}
              aria-pressed={colorBy === 'priority'}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: colorBy === 'priority' ? '#5B54E8' : '#fafaff',
                color: colorBy === 'priority' ? 'white' : '#6b7280',
                border: colorBy === 'priority' ? '1px solid #5B54E8' : '1px solid #f0effe',
              }}
            >
              By Priority
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          <button
            onClick={() => setShowAnnouncements(v => !v)}
            aria-pressed={showAnnouncements}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: showAnnouncements ? '#f0effe' : '#fafaff',
              color: showAnnouncements ? '#5B54E8' : '#9ca3af',
              border: '1px solid #f0effe',
            }}
          >
            📢 Announcements
          </button>
        </div>

        {/* Calendar */}
        <div className="white-card p-5">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }} aria-live="polite">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="aspect-square" aria-hidden="true" />
              }

              const dayIncidents = incidentsByDay.get(day) || []
              const dayAnnouncements = showAnnouncements ? (announcementsByDay.get(day) || []) : []
              const hasItems = dayIncidents.length > 0 || dayAnnouncements.length > 0
              const today = isToday(day)
              const selected = isSelected(day)

              const dotColors = dayIncidents.slice(0, 4).map(inc => {
                const config = colorBy === 'category'
                  ? (CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other)
                  : (PRIORITY_CONFIG[inc.priority] || PRIORITY_CONFIG.Medium)
                return config.color
              })

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  aria-label={`${MONTH_NAMES[month]} ${day}: ${dayIncidents.length} incident${dayIncidents.length === 1 ? '' : 's'}${dayAnnouncements.length ? `, ${dayAnnouncements.length} announcement${dayAnnouncements.length === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={selected}
                  className="aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col items-start justify-start transition-all hover:scale-105 relative overflow-hidden"
                  style={{
                    background: selected
                      ? 'linear-gradient(135deg, #5B54E8, #7C75F0)'
                      : today
                      ? '#f0effe'
                      : hasItems
                      ? '#fafaff'
                      : 'white',
                    border: selected ? '2px solid transparent' : today ? '2px solid #5B54E8' : '1px solid #f0effe',
                    boxShadow: selected ? '0 8px 24px rgba(91,84,232,0.4)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="text-xs sm:text-sm font-bold"
                      style={{ color: selected ? 'white' : today ? '#5B54E8' : '#374151' }}
                    >
                      {day}
                    </span>
                    {dayIncidents.length > 0 && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: selected ? 'rgba(255,255,255,0.25)' : '#5B54E8', color: 'white' }}
                      >
                        {dayIncidents.length}
                      </span>
                    )}
                  </div>

                  {/* Dots */}
                  {dotColors.length > 0 && (
                    <div className="flex gap-0.5 mt-auto flex-wrap">
                      {dotColors.map((color, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: selected ? 'white' : color }} />
                      ))}
                      {dayIncidents.length > 4 && (
                        <span className="text-[8px] font-bold" style={{ color: selected ? 'white' : '#9ca3af' }}>
                          +{dayIncidents.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Announcement indicator */}
                  {dayAnnouncements.length > 0 && (
                    <div className="absolute top-1 right-1">
                      <span className="text-[10px]" aria-hidden="true">📢</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day details */}
        {selectedDate && selectedInThisMonth && (
          <div className="white-card p-5 fade-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5B54E8' }}>Selected Day</p>
                <h3 className="text-lg font-bold text-gray-800 mt-0.5" style={{ letterSpacing: '-0.5px' }}>
                  {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                aria-label="Close day details"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {selectedIncidents.length === 0 && selectedAnnouncements.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No activity on this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedAnnouncements.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Announcements ({selectedAnnouncements.length})
                    </p>
                    <div className="space-y-2">
                      {selectedAnnouncements.map(a => (
                        <div
                          key={a.id}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: '#fafaff', border: '1px solid #f0effe' }}
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
                          >
                            📢
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{a.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.content}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(a.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedIncidents.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Incidents ({selectedIncidents.length})
                    </p>
                    <div className="space-y-2">
                      {selectedIncidents.map(inc => {
                        const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                        const prio = PRIORITY_CONFIG[inc.priority]
                        return (
                          <div
                            key={inc.id}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: '#fafaff', border: '1px solid #f0effe' }}
                          >
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: cat.bg }}
                            >
                              {cat.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-800 truncate">{inc.title}</p>
                                {prio && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                                    style={{ background: prio.bg, color: prio.color }}
                                    title={`${inc.priority} priority`}
                                  >
                                    {prio.icon} {inc.priority}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    inc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    inc.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                    'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {inc.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                📍 {inc.location}{inc.profiles?.full_name ? ` · ${inc.profiles.full_name}` : ''}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(inc.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {legendEntries.length > 0 && (
          <div className="white-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5B54E8' }}>
              Legend ({colorBy === 'category' ? 'Categories' : 'Priorities'} this month)
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {legendEntries.map(([name, conf]) => (
                <div key={name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: conf.color }} />
                  <span className="text-gray-600">{conf.icon} {name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}