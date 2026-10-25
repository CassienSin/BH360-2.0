'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, AlertTriangle, Shield, BarChart2, FileText, MessageCircle, Bell, CheckCircle,
  TrendingUp, Activity, Map as MapIcon, Scale, Smartphone, WifiOff, BookOpen, Home, Star,
  Building2, UserPlus, Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { dashboardPath } from '@/lib/roles'

const dots = [...Array(30)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const smallDots = [...Array(20)].map((_, i) => ({
  left: ((i * 31 + 5) % 100),
  top: ((i * 19 + 11) % 100),
  duration: ((i * 4) % 8) + 5,
  delay: (i * 0.9) % 6,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{ overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
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
    {smallDots.map((dot, i) => (
      <div key={`sm-${i}`} style={{
        position: 'absolute',
        width: '3px',
        height: '3px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.25)',
        left: `${dot.left}%`,
        top: `${dot.top}%`,
        animation: `floatReverse ${dot.duration}s ease-in-out infinite`,
        animationDelay: `${dot.delay}s`,
      }} />
    ))}
  </div>
)

// Backgroundless logo; larger copies get a soft drop shadow.
function Logo({ size, alt = 'BarangayHub 360' }: { size: number; alt?: string }) {
  return (
    <span className="relative inline-block flex-shrink-0 align-middle" style={{ width: size, height: size }}>
      <Image src="/logo.png" alt={alt} fill sizes={`${size}px`} loading="eager"
        className={`object-contain ${size >= 60 ? 'drop-shadow-2xl' : ''}`} />
    </span>
  )
}

// Tailwind can't see dynamically-built class names like `bg-${color}-100`,
// so those classes never make it into the CSS build. Full literal class
// strings keep the mockup's status pills styled.
const MOCK_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

const FEATURES = [
  { icon: AlertTriangle, title: 'Incident reporting', desc: 'Residents report from their phone with a photo and a map pin. Each report gets a priority based on the law that applies.', color: '#ea580c', bg: '#fff7ed' },
  { icon: MapIcon, title: 'Dispatch and live map', desc: 'Officials see every open report on a live map, send the nearest on-duty tanod, and follow the response.', color: '#16a34a', bg: '#f0fdf4' },
  { icon: FileText, title: 'Document requests', desc: 'Request a clearance, residency or indigency certificate online, with the processing time from the Citizen’s Charter.', color: '#0284c7', bg: '#f0f9ff' },
  { icon: MessageCircle, title: 'Tickets and AI assistant', desc: 'Ask the AI assistant any time, or open a ticket to chat with a barangay official.', color: '#7c3aed', bg: '#f5f3ff' },
  { icon: Scale, title: 'Blotter and Lupon cases', desc: 'Track Katarungang Pambarangay cases from filing to settlement, with the deadlines the law sets.', color: '#b45309', bg: '#fffbeb' },
  { icon: Bell, title: 'Announcements and alerts', desc: 'Post once and every resident is notified, including push alerts on their phone.', color: '#e11d48', bg: '#fff1f2' },
]

const STEPS = [
  { icon: Building2, title: 'Your barangay requests access', desc: 'A barangay official sends a request. Once it’s approved, the barangay is set up.' },
  { icon: UserPlus, title: 'Officials invite the team', desc: 'Officials share invite codes with fellow officials and tanods. Residents sign up and choose their barangay.' },
  { icon: Send, title: 'Reports come in and get handled', desc: 'Residents report and request. Officials dispatch tanods, who update each case from the field.' },
  { icon: TrendingUp, title: 'See what needs attention', desc: 'Analytics show trends, hotspots and response times, with an AI summary for the barangay.' },
]

const ROLES = [
  {
    icon: Home, role: 'Resident', subtitle: 'Get help from your barangay', color: '#4A43D4', bg: '#f0effe',
    perks: ['Report incidents with a photo and location', 'Request barangay documents', 'Chat with officials through tickets', 'Get announcements and alerts'],
    cta: { href: '/register', label: 'Create an account' },
  },
  {
    icon: Star, role: 'Barangay official', subtitle: 'Run the barangay from one place', color: '#c2410c', bg: '#fff7ed',
    perks: ['See every report on a live map', 'Dispatch tanods and track responses', 'Process documents and blotter cases', 'Post announcements and view analytics'],
    cta: { href: '/request-access', label: 'Request access' },
    inviteNote: true,
  },
  {
    icon: Shield, role: 'Tanod', subtitle: 'Respond faster in the field', color: '#15803d', bg: '#f0fdf4',
    perks: ['Get assignments as they come in', 'Navigate to the scene', 'Update status and mark cases resolved', 'Go on and off duty'],
    cta: { href: '/register', label: 'Join with an invite code' },
  },
]

const LAWS = [
  { code: 'RA 7160', name: 'Local Government Code', desc: 'Blotter cases follow the Katarungang Pambarangay process, including which disputes the Lupon can take and when a case can be elevated.' },
  { code: 'RA 11032', name: 'Ease of Doing Business Act', desc: 'Every document request shows the processing time the barangay commits to in its Citizen’s Charter.' },
  { code: 'RA 9514 and more', name: 'Fire Code and related laws', desc: 'Incidents are classified with the law that applies, so a fire report shows that the Bureau of Fire Protection leads the response.' },
]

const HIGHLIGHTS = [
  { icon: Smartphone, text: 'Works on any phone' },
  { icon: WifiOff, text: 'Reports save even offline' },
  { icon: BookOpen, text: 'Grounded in Philippine law' },
]

function SectionHeading({ icon: Icon, eyebrow, title, desc }: { icon: typeof Activity; eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="text-center mb-10 sm:mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
        style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
        <Icon size={12} style={{ color: 'var(--brand)' }} aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-dark)' }}>{eyebrow}</span>
      </div>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-800 mb-4 max-w-2xl mx-auto"
        style={{ letterSpacing: '-1.5px', lineHeight: 1.1 }}>
        {title}
      </h2>
      {desc && <p className="text-gray-600 max-w-xl mx-auto text-base leading-relaxed">{desc}</p>}
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  // false = show the branded splash instead of landing content.
  // Prevents the PWA cold-start flash: launching the installed app while
  // logged in used to show the full landing page for ~1s while the
  // Supabase session check round-tripped, then jump to the dashboard.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    handleScroll() // correct initial state if the page loads mid-scroll
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Wait for Supabase to verify the session before showing the landing
    // page. Auth storage may be cookie-backed, so a localStorage check can
    // incorrectly report a signed-in user as logged out.
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return

      // Not logged in after all (expired/invalid token) — show landing.
      if (!user) { setReady(true); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin, deactivated_at')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      // Sign out deactivated users, then show them the landing page
      if (profile?.deactivated_at) {
        await supabase.auth.signOut()
        if (!cancelled) setReady(true)
        return
      }

      const path = dashboardPath(profile)
      // THE BACK-BUTTON FIX: replace, not push. push() kept the landing
      // page in history, so on mobile, Back from the dashboard landed
      // here — and this effect immediately pushed the user forward
      // again, trapping them in a redirect loop.
      if (path) {
        router.replace(path) // stay on the splash until the redirect lands
      } else {
        setReady(true) // logged in but no valid role — fall back to landing
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [router])

  // Keep the branded splash visible while Supabase checks the session and
  // while a signed-in user is redirected to their dashboard.
  if (!ready) {
    return (
      <div className="min-h-screen bg-brand flex flex-col items-center justify-center gap-6">
        <div style={{ animation: 'float 2.5s ease-in-out infinite' }}>
          <Logo size={80} alt="BH360" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-sm">BarangayHub 360</p>
          <p className="text-purple-100 text-xs mt-1">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(0px)',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(0px)',
          borderBottom: scrolled ? '1px solid var(--brand-soft)' : '1px solid transparent',
          boxShadow: scrolled ? '0 2px 12px rgba(91,84,232,0.06)' : 'none',
        }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0" aria-label="BarangayHub 360 home">
            <Logo size={38} alt="" />
            <span className="min-w-0">
              <span className={`block font-bold text-sm leading-tight transition-colors duration-300 ${scrolled ? 'text-gray-800' : 'text-white'}`}>BarangayHub 360</span>
              <span className={`text-xs leading-tight hidden sm:block transition-colors duration-300 ${scrolled ? 'text-gray-500' : 'text-purple-100'}`}>Smart barangay management</span>
            </span>
          </Link>
          {/* Real links (crawlable, prefetched, cmd/long-press-able)
              instead of onClick router.push buttons */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link href="/login"
              className={`text-sm font-semibold transition-colors duration-300 px-3 py-2.5 rounded-xl ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
              Sign in
            </Link>
            <Link href="/register"
              className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl transition-transform hover:scale-105 hidden min-[400px]:flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, var(--brand-dark), var(--brand))', boxShadow: '0 4px 20px rgba(91,84,232,0.4)' }}>
              Get started <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="pt-28 sm:pt-32 pb-24 sm:pb-32 relative overflow-hidden bg-brand">
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
            <div className="absolute bottom-0 left-20 w-[400px] h-[400px] rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
          </div>
          <AnimatedDots />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto">

              <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-bold text-white fade-up"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                For residents, officials and tanods
              </p>

              <h1 className="text-[42px] sm:text-6xl lg:text-7xl font-black text-white mb-6 fade-up-1"
                style={{ letterSpacing: '-2px', lineHeight: 1.05 }}>
                The Future of{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #fff 0%, #ddd6fe 50%, #fff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Barangay</span>{' '}Management
              </h1>

              <p className="text-purple-50 text-lg sm:text-xl mb-9 fade-up-2 max-w-2xl mx-auto leading-relaxed">
                Residents report incidents and request documents from their phone. Officials dispatch tanods,
                track every case and keep everyone informed, all in one place.
              </p>

              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-center gap-3 fade-up-3 mb-5">
                <Link href="/register"
                  className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold transition-transform hover:scale-105"
                  style={{ background: 'white', color: 'var(--brand-dark)', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
                  Create an account <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/login"
                  className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold text-white transition-colors hover:bg-white/20"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.55)' }}>
                  Sign in
                </Link>
              </div>

              <p className="text-purple-50 text-sm fade-up-4 mb-8">
                Barangay official?{' '}
                <Link href="/request-access" className="font-bold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white">
                  Request access for your barangay
                </Link>
              </p>

              <ul className="fade-up-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-purple-50">
                {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-1.5 whitespace-nowrap">
                    <Icon size={15} aria-hidden="true" /> {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dashboard preview */}
            <div className="relative fade-up-4 mx-auto mt-14 sm:mt-20" style={{ maxWidth: '900px' }}>
              <div className="rounded-3xl overflow-hidden relative"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 50px 100px rgba(0,0,0,0.35)',
                }}>
                {/* Browser frame */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-red-400 opacity-80" aria-hidden="true" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" aria-hidden="true" />
                  <div className="w-3 h-3 rounded-full bg-green-400 opacity-80" aria-hidden="true" />
                  <p className="flex-1 text-center text-xs text-white/80">Official dashboard · sample data</p>
                </div>

                {/* Dashboard mockup */}
                <div className="p-4 sm:p-6 bg-white" aria-hidden="true">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand)' }}>Good morning</p>
                      <p className="text-xl font-bold text-gray-800">Kapitan Santos</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))' }}>S</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
                    {[
                      { label: 'Open reports', value: '6', color: '#4A43D4', icon: AlertTriangle },
                      { label: 'Resolved', value: '18', color: '#16a34a', icon: CheckCircle },
                      { label: 'Tickets', value: '7', color: '#ea580c', icon: FileText },
                      { label: 'Avg. response', value: '9m', color: '#e11d48', icon: TrendingUp },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl p-3 border" style={{ borderColor: 'var(--brand-soft)' }}>
                        <s.icon size={14} style={{ color: s.color }} />
                        <p className="text-xl font-bold mt-2" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-gray-500">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {[
                      { title: 'Streetlight broken — Sitio 3', status: 'pending' },
                      { title: 'Noise complaint — Block 5', status: 'assigned' },
                      { title: 'Flooding — Riverside', status: 'resolved' },
                    ].map((inc) => (
                      <div key={inc.title} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--brand-soft)' }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff7ed' }}>
                          <AlertTriangle size={14} className="text-orange-500" />
                        </div>
                        <p className="flex-1 min-w-0 text-sm font-medium text-gray-700 truncate">{inc.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MOCK_STATUS_CLASSES[inc.status]}`}>{inc.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -top-4 -left-4 px-4 py-2 rounded-2xl items-center gap-2 hidden sm:flex" aria-hidden="true"
                style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', animation: 'float 4s ease-in-out infinite' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                  <Activity size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">Live updates</p>
                  <p className="text-xs text-gray-500">No refresh needed</p>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-2xl items-center gap-2 hidden sm:flex" aria-hidden="true"
                style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', animation: 'floatReverse 5s ease-in-out infinite' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-soft)' }}>
                  <BarChart2 size={14} style={{ color: 'var(--brand)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">AI summaries</p>
                  <p className="text-xs text-gray-500">Trends and hotspots</p>
                </div>
              </div>
            </div>
          </div>

          {/* Smooth bottom edge */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '100px', background: 'linear-gradient(to bottom, transparent, white)', zIndex: 10 }} aria-hidden="true" />
        </section>

        {/* Features */}
        <section id="features" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, white 0%, var(--app-surface) 100%)' }}>
          <div className="max-w-6xl mx-auto">
            <SectionHeading icon={Activity} eyebrow="Features" title="Everything your barangay handles, in one app"
              desc="Built around how Filipino barangays actually work, from the first report to the final settlement." />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
                <div key={title} className="p-5 sm:p-6 rounded-3xl"
                  style={{ background: 'white', border: '1px solid var(--brand-soft)', boxShadow: '0 4px 20px rgba(91,84,232,0.06)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: bg }}>
                    <Icon size={22} style={{ color }} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg mb-2">{title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <SectionHeading icon={TrendingUp} eyebrow="How it works" title="From sign-up to a working barangay" />

            <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STEPS.map(({ icon: Icon, title, desc }, i) => (
                <li key={title} className="flex items-start gap-4 p-5 sm:p-6 rounded-3xl"
                  style={{ background: 'white', border: '1px solid var(--brand-soft)', boxShadow: '0 4px 20px rgba(91,84,232,0.06)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                    style={{ background: 'linear-gradient(135deg, var(--brand-dark), var(--brand))', boxShadow: '0 8px 24px rgba(91,84,232,0.3)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
                      {title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                  </div>
                  <Icon size={20} className="hidden sm:block flex-shrink-0 mt-1" style={{ color: 'var(--brand)', opacity: 0.45 }} aria-hidden="true" />
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles */}
        <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, white 0%, var(--app-surface) 100%)' }}>
          <div className="max-w-5xl mx-auto">
            <SectionHeading icon={Shield} eyebrow="For everyone" title="A view for every role in the barangay" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ROLES.map(({ icon: Icon, role, subtitle, color, bg, perks, cta, inviteNote }) => (
                <div key={role} className="p-6 rounded-3xl flex flex-col"
                  style={{ background: 'white', border: '1px solid var(--brand-soft)', boxShadow: '0 4px 20px rgba(91,84,232,0.06)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: bg }}>
                    <Icon size={22} style={{ color }} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-lg" style={{ color }}>{role}</h3>
                  <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
                  <ul className="space-y-2.5 mb-6">
                    {perks.map(perk => (
                      <li key={perk} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color }} aria-hidden="true" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {inviteNote && (
                      <p className="text-xs text-gray-500 mb-3 text-center">
                        Joining an existing barangay?{' '}
                        <Link href="/register" className="font-bold underline underline-offset-2" style={{ color }}>Sign up with your invite code</Link>
                      </p>
                    )}
                    <Link href={cta.href}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold transition-colors"
                      style={{ background: bg, color }}>
                      {cta.label} <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Philippine law */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <SectionHeading icon={Scale} eyebrow="Grounded in Philippine law" title="Built on the rules barangays already follow"
              desc="BarangayHub 360 cites the law behind what it shows, so residents and officials know why a case is handled the way it is." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {LAWS.map(({ code, name, desc }) => (
                <div key={code} className="p-6 rounded-3xl"
                  style={{ background: 'var(--app-surface)', border: '1px solid var(--brand-soft)' }}>
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg mb-3"
                    style={{ background: 'var(--brand-soft)', color: 'var(--brand-dark)' }}>
                    <Scale size={12} aria-hidden="true" /> {code}
                  </p>
                  <h3 className="font-bold text-gray-800 text-base mb-2">{name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-brand relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)' }} />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)' }} />
          </div>
          <AnimatedDots />

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="mb-7" style={{ animation: 'float 6s ease-in-out infinite' }}>
              <Logo size={76} alt="" />
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5" style={{ letterSpacing: '-2px', lineHeight: 1.05 }}>
              Bring your barangay online
            </h2>
            <p className="text-purple-50 mb-9 leading-relaxed text-base sm:text-lg max-w-xl mx-auto">
              Residents can sign up today. Barangay officials can request access to set up their barangay.
            </p>

            <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-center gap-3 mb-6">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold transition-transform hover:scale-105"
                style={{ background: 'white', color: 'var(--brand-dark)', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
                Create an account <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/request-access"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-colors hover:bg-white/20"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.55)' }}>
                Request access
              </Link>
            </div>

            <p className="text-sm text-purple-50">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white">Sign in</Link>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={36} alt="" />
            <div>
              <p className="text-sm font-bold text-gray-800">BarangayHub 360</p>
              <p className="text-xs text-gray-500">Smart barangay management</p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-gray-600">
            <Link href="/login" className="hover:text-gray-900">Sign in</Link>
            <Link href="/register" className="hover:text-gray-900">Create an account</Link>
            <Link href="/request-access" className="hover:text-gray-900">Request access</Link>
          </nav>
          <p className="text-xs text-gray-500 text-center">© 2026 BarangayHub 360</p>
        </div>
      </footer>

    </div>
  )
}
