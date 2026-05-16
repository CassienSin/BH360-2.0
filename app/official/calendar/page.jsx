'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, Filter, X } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'

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
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠' },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
}

export default function CalendarView() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [colorBy, setColorBy] = useState('category') // 'category' or 'priority'
  const [showAnnouncements, setShowAnnouncements] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: prof } = await supabase.from('profiles').select('*, barangays(name)').eq('id', user.id).single()
      if (prof?.role !== 'official' || !prof?.barangay_id) return router.push('/login')
      setProfile(prof)

      const { data: inc } = await supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', prof.barangay_id)
        .order('created_at', { ascending: false })
      setIncidents(inc || [])

      const { data: ann } = await supabase.from('announcements')
        .select('*')
        .eq('barangay_id', prof.barangay_id)
        .order('created_at', { ascending: false })
      setAnnouncements(ann || [])

      setLoading(false)
    }
    loadData()
  }, [])

  // Calendar logic
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDay = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate()

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

  function getIncidentsForDay(day) {
    return incidents.filter(inc => {
      const d = new Date(inc.created_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function getAnnouncementsForDay(day) {
    return announcements.filter(a => {
      const d = new Date(a.created_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
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

  // Build calendar grid
  const calendarCells = []
  for (let i = 0; i < startDay; i++) calendarCells.push(null) // empty cells before day 1
  for (let day = 1; day <= daysInMonth; day++) calendarCells.push(day)
  while (calendarCells.length % 7 !== 0) calendarCells.push(null) // fill last row

  // Monthly stats
  const monthlyIncidents = incidents.filter(inc => {
    const d = new Date(inc.created_at)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const monthlyResolved = monthlyIncidents.filter(i => i.status === 'resolved').length
  const monthlyPending = monthlyIncidents.filter(i => i.status === 'pending').length
  const monthlyCritical = monthlyIncidents.filter(i => i.priority === 'Critical').length

  // Selected day items
  const selectedIncidents = selectedDate ? getIncidentsForDay(selectedDate.getDate()) : []
  const selectedAnnouncements = selectedDate ? getAnnouncementsForDay(selectedDate.getDate()) : []

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
            <CalendarIcon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Calendar View</h1>
            <p className="text-xs text-gray-400">Incidents & events by date · {profile?.barangays?.name}</p>
          </div>
        </div>
        <button onClick={goToToday}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
          style={{background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff'}}>
          Today
        </button>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Monthly Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">This Month</p>
            <p className="text-2xl font-black mt-1" style={{color: '#5B54E8'}}>{monthlyIncidents.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Incidents</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-2xl font-black mt-1" style={{color: '#f97316'}}>{monthlyPending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Need attention</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Resolved</p>
            <p className="text-2xl font-black mt-1" style={{color: '#22c55e'}}>{monthlyResolved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completed</p>
          </div>
          <div className="white-card p-4">
            <p className="text-xs text-gray-400">Critical</p>
            <p className="text-2xl font-black mt-1" style={{color: '#dc2626'}}>{monthlyCritical}</p>
            <p className="text-xs text-gray-500 mt-0.5">Urgent cases</p>
          </div>
        </div>

        {/* Filter toggles */}
        <div className="white-card p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} style={{color: '#5B54E8'}} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{color: '#5B54E8'}}>View</p>
          </div>

          <div className="flex gap-1">
            <button onClick={() => setColorBy('category')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: colorBy === 'category' ? '#5B54E8' : '#fafaff',
                color: colorBy === 'category' ? 'white' : '#6b7280',
                border: colorBy === 'category' ? 'none' : '1px solid #f0effe',
              }}>
              By Category
            </button>
            <button onClick={() => setColorBy('priority')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: colorBy === 'priority' ? '#5B54E8' : '#fafaff',
                color: colorBy === 'priority' ? 'white' : '#6b7280',
                border: colorBy === 'priority' ? 'none' : '1px solid #f0effe',
              }}>
              By Priority
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          <button onClick={() => setShowAnnouncements(!showAnnouncements)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: showAnnouncements ? '#f0effe' : '#fafaff',
              color: showAnnouncements ? '#5B54E8' : '#9ca3af',
              border: '1px solid #f0effe',
            }}>
            📢 Announcements
          </button>
        </div>

        {/* Calendar */}
        <div className="white-card p-5">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>
              {monthNames[month]} {year}
            </h2>
            <button onClick={nextMonth}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="aspect-square" />
              }

              const dayIncidents = getIncidentsForDay(day)
              const dayAnnouncements = showAnnouncements ? getAnnouncementsForDay(day) : []
              const hasItems = dayIncidents.length > 0 || dayAnnouncements.length > 0
              const today = isToday(day)
              const selected = isSelected(day)

              // Get up to 4 dots for display
              const dots = dayIncidents.slice(0, 4).map(inc => {
                const config = colorBy === 'category'
                  ? (categoryConfig[inc.category] || categoryConfig.Other)
                  : (priorityConfig[inc.priority] || priorityConfig.Medium)
                return config.color
              })

              return (
                <button key={idx}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className="aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col items-start justify-start transition-all hover:scale-105 relative overflow-hidden"
                  style={{
                    background: selected
                      ? 'linear-gradient(135deg, #5B54E8, #7C75F0)'
                      : today
                      ? '#f0effe'
                      : hasItems
                      ? '#fafaff'
                      : 'white',
                    border: selected
                      ? 'none'
                      : today
                      ? '2px solid #5B54E8'
                      : '1px solid #f0effe',
                    boxShadow: selected ? '0 8px 24px rgba(91,84,232,0.4)' : 'none',
                  }}>

                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs sm:text-sm font-bold"
                      style={{color: selected ? 'white' : today ? '#5B54E8' : '#374151'}}>
                      {day}
                    </span>
                    {dayIncidents.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{
                          background: selected ? 'rgba(255,255,255,0.25)' : '#5B54E8',
                          color: 'white',
                        }}>
                        {dayIncidents.length}
                      </span>
                    )}
                  </div>

                  {/* Dots */}
                  {dots.length > 0 && (
                    <div className="flex gap-0.5 mt-auto flex-wrap">
                      {dots.map((color, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{background: selected ? 'white' : color}} />
                      ))}
                      {dayIncidents.length > 4 && (
                        <span className="text-[8px] font-bold"
                          style={{color: selected ? 'white' : '#9ca3af'}}>
                          +{dayIncidents.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Announcement indicator */}
                  {dayAnnouncements.length > 0 && (
                    <div className="absolute top-1 right-1">
                      <span className="text-[10px]">📢</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day details */}
        {selectedDate && (
          <div className="white-card p-5 fade-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{color: '#5B54E8'}}>Selected Day</p>
                <h3 className="text-lg font-bold text-gray-800 mt-0.5" style={{letterSpacing: '-0.5px'}}>
                  {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setSelectedDate(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
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
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Announcements ({selectedAnnouncements.length})</p>
                    <div className="space-y-2">
                      {selectedAnnouncements.map(a => (
                        <div key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                          style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                            style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                            📢
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{a.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.content}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(a.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedIncidents.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Incidents ({selectedIncidents.length})</p>
                    <div className="space-y-2">
                      {selectedIncidents.map(inc => {
                        const cat = categoryConfig[inc.category] || categoryConfig.Other
                        return (
                          <div key={inc.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                            style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{background: cat.bg}}>
                              {cat.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-800 truncate">{inc.title}</p>
                                {inc.priority && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                                    style={{background: priorityConfig[inc.priority]?.bg, color: priorityConfig[inc.priority]?.color}}>
                                    {priorityConfig[inc.priority]?.icon}
                                  </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  inc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  inc.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>{inc.status}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">📍 {inc.location} · {inc.profiles?.full_name}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(inc.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
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
        <div className="white-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{color: '#5B54E8'}}>
            Legend ({colorBy === 'category' ? 'Categories' : 'Priorities'})
          </p>
          <div className="flex flex-wrap gap-2">
            {colorBy === 'category' && Object.entries(categoryConfig).map(([cat, conf]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{background: conf.color}} />
                <span className="text-gray-600">{conf.icon} {cat}</span>
              </div>
            ))}
            {colorBy === 'priority' && Object.entries(priorityConfig).map(([p, conf]) => (
              <div key={p} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{background: conf.color}} />
                <span className="text-gray-600">{conf.icon} {p}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}