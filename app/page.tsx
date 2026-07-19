'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, AlertTriangle, Shield, BarChart2, FileText, MessageCircle, Bell, CheckCircle, Zap, Users, Star, TrendingUp, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { dashboardPath } from '@/lib/roles'
import AnimatedDots from '@/components/AnimatedDots'



// Tailwind can't see dynamically-built class names like `bg-${color}-100`,
// so those classes never make it into the CSS build — the status pills in
// the hero mockup were rendering completely unstyled. Full literal class
// strings are the fix.
const MOCK_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
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

    // Instant, synchronous check — no network. Supabase (supabase-js
    // default) stores its session under an `sb-...-auth-token` key in
    // localStorage. If there's no token, this visitor is logged out:
    // show the landing page immediately instead of a pointless splash.
    // Logged-out users never see the splash at all.
    let hasToken = false
    try {
      hasToken = Object.keys(localStorage).some(
        k => k.startsWith('sb-') && k.includes('auth-token')
      )
    } catch {
      // localStorage unavailable (private mode edge cases) — fall through
      // to the network check with the splash showing briefly.
    }

    if (!hasToken) setReady(true)

    // Full check runs either way — belt and suspenders. It covers
    // cookie-based sessions the localStorage sniff can't see, and it
    // catches stale tokens (token present but session expired).
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

  const features = [
    { icon: AlertTriangle, title: 'Instant Incident Reporting', desc: 'Residents report incidents in seconds. Officials receive real-time notifications.', color: '#fb923c', bg: '#fff7ed' },
    { icon: Shield, title: 'Smart Tanod Dispatch', desc: 'Assign field officers instantly. Track responses with real-time updates.', color: '#22c55e', bg: '#f0fdf4' },
    { icon: BarChart2, title: 'AI-Powered Analytics', desc: 'Claude AI analyzes patterns, identifies hotspots, and recommends actions.', color: '#5B54E8', bg: '#f0effe' },
    { icon: FileText, title: 'Real-time Support Tickets', desc: 'Two-way chat between residents and officials. No more missed concerns.', color: '#38bdf8', bg: '#f0f9ff' },
    { icon: MessageCircle, title: '24/7 AI Assistant', desc: 'Claude AI answers barangay questions any time. Free up your officials.', color: '#a78bfa', bg: '#faf5ff' },
    { icon: Bell, title: 'Live Announcements', desc: 'Post once, reach every resident instantly. Built-in notification system.', color: '#f43f5e', bg: '#fff1f2' },
  ]

  const stats = [
    { icon: Users, value: '3', label: 'User Roles', desc: 'Residents, Officials, Tanods' },
    { icon: Star, value: 'AI', label: 'Powered', desc: 'Claude AI integration' },
    { icon: Zap, value: '24/7', label: 'Always On', desc: 'Round-the-clock support' },
    { icon: Activity, value: 'Live', label: 'Real-time', desc: 'Instant updates everywhere' },
  ]

  const testimonials = [
    { name: 'Brgy. Captain Santos', role: 'Barangay Official', text: 'BH360 transformed how we manage incidents. Our response time dropped by 70%.', rating: 5 },
    { name: 'Maria Cruz', role: 'Resident', text: 'Reporting an issue takes seconds. Officials respond fast. This is how government should work.', rating: 5 },
    { name: 'Tanod Reyes', role: 'Field Officer', text: 'I always know where I need to go. The dashboard is a game-changer for the field.', rating: 5 },
  ]

  // Branded splash — shown only while a token exists and the session
  // check / redirect is in flight. Logged-in PWA launches see this
  // (reads as a native app launch screen) instead of a landing-page
  // flash. Logged-out visitors skip it entirely.
  if (!ready) {
    return (
      <div className="min-h-screen bg-brand flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 relative" style={{ animation: 'float 2.5s ease-in-out infinite' }}>
          <Image src="/logo.png" alt="BH360" fill sizes="80px" priority className="object-contain drop-shadow-2xl" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-sm">BarangayHub 360</p>
          <p className="text-purple-200 text-xs mt-1">Loading your dashboard…</p>
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
          borderBottom: scrolled ? '1px solid #f0effe' : '1px solid transparent',
          boxShadow: scrolled ? '0 2px 12px rgba(91,84,232,0.06)' : 'none',
        }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 relative">
              <Image src="/logo.png" alt="BH360" fill sizes="36px" loading="eager" className="object-contain" />
            </div>
            <div>
              <p className={`font-bold text-sm leading-tight transition-colors duration-300 ${scrolled ? 'text-gray-800' : 'text-white'}`}>BH360</p>
              <p className={`text-xs leading-tight hidden sm:block transition-colors duration-300 ${scrolled ? 'text-gray-400' : 'text-purple-200'}`}>Barangay Management</p>
            </div>
          </div>
          {/* Real links (crawlable, prefetched, cmd/long-press-able)
              instead of onClick router.push buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login"
              className={`text-sm font-semibold transition-colors duration-300 px-3 py-2 hidden sm:block ${scrolled ? 'text-gray-600 hover:text-gray-800' : 'text-white hover:text-purple-200'}`}>
              Sign In
            </Link>
            <Link href="/register"
              className="text-sm font-semibold text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all hover:scale-105 flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 20px rgba(91,84,232,0.4)' }}>
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-32 relative overflow-hidden bg-brand">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
          <div className="absolute bottom-0 left-20 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
        </div>
        <AnimatedDots count={30} smallCount={20} />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 fade-up-1"
              style={{ letterSpacing: '-3px', lineHeight: 1.05 }}>
              The Future of<br />
              <span className="relative inline-block">
                <span style={{
                  background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #fff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Barangay</span>
              </span> Management
            </h1>

            <p className="text-purple-100 text-lg sm:text-xl mb-10 fade-up-2 max-w-2xl mx-auto leading-relaxed font-light">
              BarangayHub 360 brings smart, AI-powered governance to every Filipino community —
              <span className="font-semibold text-white"> faster response times, happier residents.</span>
            </p>

            <div className="flex items-center justify-center gap-3 fade-up-3 flex-wrap mb-6">
              <Link href="/register"
                className="flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: 'white', color: '#5B54E8', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/login"
                className="flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}>
                Sign In
              </Link>
            </div>

            {/* Request access link */}
            <p className="text-purple-200 text-xs fade-up-4 mb-6">
              New barangay?{' '}
              <Link href="/request-access"
                className="font-bold hover:underline transition-colors text-white">
                Request access →
              </Link>
            </p>

            {/* Trust line */}
            <p className="text-purple-200 text-xs fade-up-4 flex items-center justify-center gap-2 flex-wrap">
              <CheckCircle size={12} /> No credit card required
              <span className="text-purple-300 opacity-50">·</span>
              <CheckCircle size={12} /> Free for barangays
              <span className="text-purple-300 opacity-50">·</span>
              <CheckCircle size={12} /> Setup in minutes
            </p>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-20 relative fade-up-4 px-4 sm:px-0" style={{ maxWidth: '900px', margin: '5rem auto 0' }}>
            <div className="rounded-3xl overflow-hidden relative"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 50px 100px rgba(0,0,0,0.4)',
              }}>
              {/* Browser frame */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-400 opacity-80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
                <div className="w-3 h-3 rounded-full bg-green-400 opacity-80" />
                <div className="flex-1 text-center">
                  <span className="text-xs text-white/50">bh360.app/official</span>
                </div>
              </div>

              {/* Dashboard mockup */}
              <div className="p-6 bg-white">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Welcome back</p>
                    <h3 className="text-xl font-bold text-gray-800">Captain Santos 👋</h3>
                  </div>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>S</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
                  {[
                    { label: 'Incidents', value: '24', color: '#5B54E8', icon: AlertTriangle },
                    { label: 'Resolved', value: '18', color: '#22c55e', icon: CheckCircle },
                    { label: 'Tickets', value: '7', color: '#f97316', icon: FileText },
                    { label: 'Response', value: '2m', color: '#f43f5e', icon: TrendingUp },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl p-3 border" style={{ borderColor: '#f0effe' }}>
                      <s.icon size={14} style={{ color: s.color }} />
                      <p className="text-xl font-bold mt-2" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { title: 'Streetlight broken — Sitio 3', status: 'pending' },
                    { title: 'Noise complaint — Block 5', status: 'assigned' },
                    { title: 'Flooding report — Riverside', status: 'resolved' },
                  ].map((inc) => (
                    <div key={inc.title} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ borderColor: '#f0effe' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#fff7ed' }}>
                        <AlertTriangle size={14} className="text-orange-500" />
                      </div>
                      <p className="flex-1 text-sm font-medium text-gray-700">{inc.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MOCK_STATUS_CLASSES[inc.status]}`}>{inc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -left-4 px-4 py-2 rounded-2xl items-center gap-2 hidden sm:flex"
              style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', animation: 'float 4s ease-in-out infinite' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                <Activity size={14} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Live updates</p>
                <p className="text-[10px] text-gray-400">Real-time data</p>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-2xl items-center gap-2 hidden sm:flex"
              style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', animation: 'floatReverse 5s ease-in-out infinite' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0effe' }}>
                <Image src="/logo.png" alt="" width={20} height={20} className="object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">AI Powered</p>
                <p className="text-[10px] text-gray-400">Claude AI</p>
              </div>
            </div>
          </div>
        </div>

        {/* Smooth bottom edge */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '100px', background: 'linear-gradient(to bottom, transparent, white)', zIndex: 10 }} />
      </section>

      {/* Stats Bar */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(({ icon: Icon, value, label, desc }) => (
              <div key={label} className="text-center p-5 rounded-3xl transition-all hover:scale-105"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="text-3xl font-black" style={{ color: '#5B54E8', letterSpacing: '-1px' }}>{value}</p>
                <p className="text-sm font-bold text-gray-700 mt-1">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, white 0%, #fafaff 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <Zap size={12} style={{ color: '#5B54E8' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-800 mb-4"
              style={{ letterSpacing: '-2px' }}>
              Everything your<br />barangay needs
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto text-base">
              A complete platform purpose-built for Filipino communities. No bloat. No fuss.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="group p-4 sm:p-6 rounded-3xl transition-all hover:scale-105 cursor-default"
                style={{ background: 'white', border: '1px solid #f0effe', boxShadow: '0 4px 20px rgba(91,84,232,0.06)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: bg }}>
                  <Icon size={24} style={{ color }} />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <Activity size={12} style={{ color: '#5B54E8' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>How It Works</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-800 mb-4"
              style={{ letterSpacing: '-2px' }}>
              Up and running<br />in minutes
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { step: '01', title: 'Sign up your barangay', desc: 'Create your free account in under a minute. No setup, no installation, no headaches.', icon: Users },
              { step: '02', title: 'Invite your team', desc: 'Generate invite codes for officials and tanods. Residents sign up freely.', icon: Shield },
              { step: '03', title: 'Start serving residents', desc: 'Residents report incidents, officials dispatch tanods, AI analyzes everything.', icon: Zap },
              { step: '04', title: 'Grow with insights', desc: 'AI-powered analytics show trends, hotspots, and recommendations to improve.', icon: TrendingUp },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="flex items-center gap-5 p-4 sm:p-6 rounded-3xl transition-all hover:scale-[1.02]"
                style={{ background: 'white', border: '1px solid #f0effe', boxShadow: '0 4px 20px rgba(91,84,232,0.06)' }}>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center flex-shrink-0 text-white font-black"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)' }}>
                  {step}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
                <Icon size={20} className="hidden sm:block flex-shrink-0" style={{ color: '#5B54E8', opacity: 0.3 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, white 0%, #fafaff 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <Users size={12} style={{ color: '#5B54E8' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>For Everyone</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-800 mb-4"
              style={{ letterSpacing: '-2px' }}>
              Built for every<br />community role
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { emoji: '🏠', role: 'Resident', subtitle: 'Stay connected with your barangay', color: '#5B54E8', bg: '#f0effe', perks: ['Report incidents instantly', 'Create support tickets', 'View announcements', 'Chat with AI assistant'] },
              { emoji: '⭐', role: 'Barangay Official', subtitle: 'Manage your community smarter', color: '#f97316', bg: '#fff7ed', perks: ['Monitor all incidents', 'Dispatch Tanods', 'Post announcements', 'AI-powered analytics'], featured: true },
              { emoji: '🛡️', role: 'Tanod', subtitle: 'Respond faster in the field', color: '#22c55e', bg: '#f0fdf4', perks: ['View assignments', 'Update incident status', 'Mark incidents resolved', 'Track history'] },
            ].map(({ emoji, role, subtitle, color, bg, perks, featured }) => (
              <div key={role} className={`p-7 rounded-3xl transition-all hover:scale-105 relative ${featured ? 'ring-2' : ''}`}
                style={{
                  background: 'white',
                  border: `1px solid ${featured ? color : '#f0effe'}`,
                  boxShadow: featured ? `0 12px 40px ${color}25` : '0 4px 20px rgba(91,84,232,0.06)',
                }}>
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: color }}>
                    Most powerful
                  </div>
                )}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5" style={{ background: bg }} aria-hidden="true">
                  {emoji}
                </div>
                <h3 className="font-bold text-lg mb-1" style={{ color }}>{role}</h3>
                <p className="text-xs text-gray-400 mb-4">{subtitle}</p>
                <div className="space-y-2.5">
                  {perks.map(perk => (
                    <div key={perk} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                        <CheckCircle size={10} style={{ color }} />
                      </div>
                      {perk}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <Star size={12} style={{ color: '#5B54E8' }} fill="#5B54E8" />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>Loved by Communities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-800 mb-4"
              style={{ letterSpacing: '-2px' }}>
              What people<br />are saying
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-3xl transition-all hover:scale-105"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                <div className="flex gap-1 mb-4" role="img" aria-label={`${t.rating} out of 5 stars`}>
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} fill="#fbbf24" className="text-yellow-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 bg-brand relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <AnimatedDots count={30} smallCount={20} />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="w-24 h-24 mx-auto mb-8 relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
            <Image src="/logo.png" alt="BH360" fill sizes="96px" loading="eager" className="object-contain drop-shadow-2xl" />
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6" style={{ letterSpacing: '-2px', lineHeight: 1.05 }}>
            Modernize your<br />barangay today
          </h2>
          <p className="text-purple-200 mb-10 leading-relaxed text-base sm:text-lg max-w-xl mx-auto font-light">
            Join the smart governance revolution. Free for every barangay, forever.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'white', color: '#5B54E8', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              Get Started Free <ArrowRight size={16} />
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}>
              Sign In
            </Link>
          </div>

          {/* Request access link */}
          <p className="text-center text-xs mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Barangay Official?{' '}
            <Link href="/request-access"
              className="font-bold hover:underline transition-colors"
              style={{ color: 'white' }}>
              Request access for your barangay →
            </Link>
          </p>

          <p className="text-purple-200 text-xs flex items-center justify-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5"><CheckCircle size={12} /> No credit card</span>
            <span className="text-purple-300 opacity-50">·</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} /> Setup in minutes</span>
            <span className="text-purple-300 opacity-50">·</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} /> Free forever</span>
          </p>
        </div>

        {/* Smooth bottom edge */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '80px', background: 'linear-gradient(to bottom, transparent, white)', zIndex: 10 }} />
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 relative">
                <Image src="/logo.png" alt="BH360" fill sizes="32px" className="object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">BarangayHub 360</p>
                <p className="text-xs text-gray-400">Smart Barangay Management</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              © 2026 BH360 · Empowering Filipino Communities with AI
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}