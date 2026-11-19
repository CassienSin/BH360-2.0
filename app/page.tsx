'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Phone, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { dashboardPath } from '@/lib/roles'
import Band from '@/components/crafted/Band'
import { Button } from '@/components/ui/button'
import {
  IncidentsIcon, DocumentsIcon, AnnouncementsIcon, BlotterIcon, TicketsIcon, MapIcon, InfrastructureIcon,
} from '@/components/icons/BhIcons'

// What the app does, in plain words (P01 "What you can do").
const FEATURES = [
  { icon: IncidentsIcon, title: 'Report and track', desc: 'Send a report with a photo and your location. See when a tanod is assigned and on the way.' },
  { icon: DocumentsIcon, title: 'Documents without the line', desc: 'Request a clearance, residency or indigency certificate. The processing time comes from the Citizen’s Charter.' },
  { icon: AnnouncementsIcon, title: 'Hear it first', desc: 'Water interruptions, typhoon alerts and events, sent straight to your phone.' },
  { icon: BlotterIcon, title: 'Lupon cases, in the open', desc: 'Follow your Katarungang Pambarangay case and its hearing dates, with the deadlines the law sets.' },
  { icon: TicketsIcon, title: 'Talk to the barangay', desc: 'Ask a question and get an answer from an official, in one thread.' },
  { icon: MapIcon, title: 'Built for responders', desc: 'Officials dispatch from a live map. Tanods get the route on their phone.' },
]

const STEPS = [
  { title: 'Sign up', desc: 'Create an account with your name and your barangay.' },
  { title: 'Get verified', desc: 'An official checks that you live in the barangay.' },
  { title: 'Use it', desc: 'Report, request and receive alerts from one app.' },
]

// The laws the app already follows (DESIGN.md §7: cite the law where the app does).
const LAWS = [
  { code: 'RA 7160', name: 'Local Government Code', desc: 'Blotter cases follow the Katarungang Pambarangay process and its deadlines.' },
  { code: 'RA 11032', name: 'Ease of Doing Business Act', desc: 'Each document request shows the time the barangay commits to in its Citizen’s Charter.' },
  { code: 'RA 9514 and more', name: 'Fire Code and related laws', desc: 'Reports are classified by the law that applies, so a fire report shows that the BFP leads.' },
]

function Logo({ size, alt = '' }: { size: number; alt?: string }) {
  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      <Image src="/logo.png" alt={alt} fill sizes={`${size}px`} loading="eager" className="object-contain" />
    </span>
  )
}

/** The phone in the hero: an illustration of the resident home, not real data. */
function PhoneMock() {
  return (
    <div aria-hidden="true" className="relative w-[300px] h-[560px] rounded-[40px] bg-[#1A1830] p-2.5 shadow-[var(--shadow-float)]">
      <div className="relative isolate h-full overflow-hidden rounded-[32px] bg-page">
        <div className="relative px-4 pt-6 pb-3">
          <Band extend={10} fade={70} dots={8} seed={6} />
          <div className="relative z-[1]">
            <p className="text-[10px] font-bold tracking-[0.1em] text-white/75 uppercase">Today</p>
            <p className="mt-1 text-[19px] font-extrabold tracking-[-0.4px] text-white">Magandang gabi.</p>
          </div>
        </div>
        <div className="relative z-[1] space-y-2.5 px-3">
          <div className="rounded-[12px] border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-lift)]">
            <p className="text-[10px] font-bold text-ok">Tanod on the way</p>
            <p className="mt-0.5 text-[12px] font-extrabold text-ink">Broken streetlight</p>
            <div className="mt-2 flex gap-1">{[1, 2, 3, 4].map(i => <span key={i} className={`h-[3px] flex-1 rounded-sm ${i < 4 ? 'bg-ok' : 'bg-line'}`} />)}</div>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-surface">
            {[[DocumentsIcon, 'Request a document'], [TicketsIcon, 'Ask the barangay'], [BlotterIcon, 'My cases']].map(([Icon, label]) => (
              <div key={label as string} className="flex items-center gap-2.5 px-3 py-2.5 text-brand-strong">
                <Icon size={16} />
                <span className="text-[11.5px] font-bold text-ink">{label as string}</span>
              </div>
            ))}
          </div>
          <div className="rounded-[12px] border border-line bg-surface px-3 py-2.5">
            <p className="text-[9px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Announcement</p>
            <p className="mt-0.5 text-[11.5px] font-extrabold text-ink">Water interruption on Saturday</p>
            <p className="text-[10.5px] text-muted-foreground">Morning to afternoon</p>
          </div>
          <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-surface px-3 py-2.5 text-brand-strong">
            <InfrastructureIcon size={16} />
            <span className="text-[11.5px] font-bold text-ink">Your reports</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  // false = show the branded splash instead of landing content.
  // Prevents the PWA cold-start flash: launching the installed app while
  // logged in used to show the full landing page for ~1s while the
  // Supabase session check round-tripped, then jump to the dashboard.
  const [ready, setReady] = useState(false)

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
      <div className="relative isolate min-h-dvh flex flex-col items-center justify-center gap-5 text-white">
        <Band mode="fill" dots={18} />
        <div className="relative z-[1] flex flex-col items-center gap-4">
          <Logo size={72} alt="BH360" />
          <div className="text-center">
            <p className="text-[15px] font-extrabold">BarangayHub 360</p>
            <p className="mt-1 text-[13px] text-white/80" role="status">Opening your barangay…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden bg-page text-body">

      {/* ---------- Hero on the band (fades over 200px) ---------- */}
      <header className="relative text-white">
        <Band extend={0} fade={200} dots={24} seed={1} />
        <div className="relative z-[1] mx-auto max-w-[1180px] px-4 sm:px-8">
          <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6 py-5">
            <Link href="/" className="flex items-center gap-2.5 rounded-lg text-[15px] font-extrabold" aria-label="BarangayHub 360 home">
              <Logo size={30} />
              <span className="hidden min-[380px]:inline whitespace-nowrap">BarangayHub 360</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-[14px] font-semibold text-white/90">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#how" className="hover:text-white">How it works</a>
              <a href="#barangays" className="hover:text-white">For barangays</a>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="onband" size="sm"><Link href="/login">Sign in</Link></Button>
              <Button asChild variant="white" size="sm" className="hidden min-[360px]:inline-flex"><Link href="/register">Get started</Link></Button>
            </div>
          </nav>

          <div className="grid items-center gap-10 pt-8 pb-16 lg:grid-cols-[1fr_auto] lg:pt-14 lg:pb-10">
            <div className="max-w-[560px]">
              <p className="text-xs font-bold tracking-[0.1em] text-white/75 uppercase">For residents, officials and tanods</p>
              <h1 className="mt-4 text-[40px] sm:text-[56px] lg:text-[64px] font-extrabold leading-[1.02] tracking-[-2px]">
                Your barangay, one tap away.
              </h1>
              <p className="mt-5 text-[15px] sm:text-[17px] leading-[1.6] text-white/90">
                Report a problem and watch help arrive. Request a clearance without the long line. Hear from your barangay the moment something happens.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="white" size="lg"><Link href="/register">Create a free account</Link></Button>
                <Button asChild variant="onband" size="lg"><Link href="/resident/report"><Phone aria-hidden="true" />Report an emergency</Link></Button>
              </div>
              <p className="mt-4 text-[13px] text-white/80">Works on any phone browser. Install it like an app.</p>
            </div>
            <div className="hidden lg:block">
              <PhoneMock />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-[1]">
        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto max-w-[1180px] px-4 sm:px-8 pt-16 pb-16 scroll-mt-6">
          <p className="text-xs font-bold tracking-[0.1em] text-brand-strong uppercase">What you can do</p>
          <h2 className="mt-2 max-w-[560px] text-[30px] sm:text-[36px] font-extrabold leading-[1.12] tracking-[-1px] text-ink">
            Everything the barangay hall does, now on your phone.
          </h2>
          <div className="mt-7 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-surface p-6">
                <Icon size={24} className="text-brand-strong" />
                <h3 className="mt-4 text-[16px] font-extrabold text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-body">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="mx-auto max-w-[1180px] px-4 sm:px-8 pb-16 scroll-mt-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-brand-strong uppercase">How it works</p>
              <h2 className="mt-2 text-[30px] sm:text-[36px] font-extrabold leading-[1.12] tracking-[-1px] text-ink">Three steps, then you’re in.</h2>
            </div>
            <ol className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-extrabold text-brand-strong" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-extrabold text-ink">{step.title}</h3>
                    <p className="mt-1 text-[14px] leading-[1.55] text-body">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- The law behind it ---------- */}
        <section className="mx-auto max-w-[1180px] px-4 sm:px-8 pb-16">
          <p className="text-xs font-bold tracking-[0.1em] text-brand-strong uppercase">Grounded in Philippine law</p>
          <div className="mt-4 grid overflow-hidden rounded-[14px] border border-line bg-surface md:grid-cols-3">
            {LAWS.map((law, i) => (
              <div key={law.code} className={`p-5 border-line ${i > 0 ? 'border-t md:border-t-0 md:border-l' : ''}`}>
                <p className="text-[13px] font-extrabold text-brand-strong">{law.code} · <span className="text-ink">{law.name}</span></p>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-body">{law.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- For barangays ---------- */}
        <section id="barangays" className="mx-auto max-w-[1180px] px-4 sm:px-8 pb-16 scroll-mt-6">
          <div className="relative isolate overflow-hidden rounded-[14px] px-6 py-8 sm:px-9 text-white">
            <Band mode="fill" dots={12} seed={7} />
            <div className="relative z-[1] flex flex-wrap items-center gap-6">
              <div className="min-w-[240px] flex-1">
                <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.7px]">Run a barangay? Bring it online.</h2>
                <p className="mt-2 text-[15px] text-white/88">Send a request. We review it and send your officials their invite codes.</p>
              </div>
              <Button asChild variant="white" size="lg"><Link href="/request-access">Request access</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] mx-auto max-w-[1180px] px-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line py-7">
          <span className="flex items-center gap-2.5 text-[15px] font-extrabold text-ink"><Logo size={26} />BarangayHub 360</span>
          <span className="text-[13px] text-muted-foreground">A capstone project · Data handled under RA 10173</span>
          <span className="ml-auto flex flex-wrap gap-5 text-[14px] text-body">
            <Link href="/login" className="hover:text-brand-strong">Sign in</Link>
            <Link href="/register" className="hover:text-brand-strong">Create an account</Link>
            <Link href="/request-access" className="inline-flex items-center gap-0.5 hover:text-brand-strong">Request access <ChevronRight size={14} aria-hidden="true" /></Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
