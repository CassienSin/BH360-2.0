'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { PageSkeleton } from '@/components/Skeletons'
import ClientBoundary from '@/components/ClientBoundary'
import { PAGE_HEADERS } from '@/lib/pageHeaders'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import { useUrlSection } from '@/lib/useUrlSection'
import { createClient } from '@/lib/supabase'
import { telHref } from '@/lib/hotlines'
import HotlineList from '@/components/crafted/HotlineList'
import { MessageSquare, Phone, ChevronDown, ChevronRight, Search, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import PageShell from '@/components/crafted/PageShell'
import { TicketsIcon, AiIcon } from '@/components/icons/BhIcons'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Input, Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'
import { Notice } from '@/components/ui/notice'
import { SectionLabel, Muted } from '@/components/ui/text'

const faqByRole = {
  resident: [
    { q: 'How do I report an incident?', a: 'Go to your dashboard → Click "Report Incident" → Fill in details (title, category, priority) → Add location and optional photo → Submit. Officials will be notified instantly.' },
    { q: 'How do I create a support ticket?', a: 'Navigate to "My Tickets" → Click "New Ticket" → Choose a category (Inquiry, Request, Complaint, Feedback) → Write your concern → Submit. A barangay official will respond via chat.' },
    { q: 'How do I rate a resolved incident?', a: 'Once an incident is marked as resolved, you\'ll see a "Rate the Service" button on the incident card. Tap it to leave a 1-5 star rating and optional feedback.' },
    { q: 'Can I edit or delete a reported incident?', a: 'No. Once submitted, incidents are locked to maintain integrity. If you made a mistake, contact your barangay officials or submit a support ticket.' },
    { q: 'How do I receive announcement notifications?', a: 'Enable browser notifications when prompted. You can also manage this in Settings → Notifications. Make sure you allow notifications in your browser settings.' },
    { q: 'What does each priority level mean?', a: '🟢 Low — Minor issues, no urgency. 🔵 Medium — Standard concerns. 🟠 High — Needs prompt attention. 🔴 Critical — Emergency, immediate response required.' },
  ],
  official: [
    { q: 'How do I dispatch a tanod to an incident?', a: 'On any pending incident card, use the "Dispatch Tanod" dropdown to select a tanod. They\'ll be notified instantly and the incident status will update to "assigned".' },
    { q: 'How do I post an announcement?', a: 'Navigate to "Announcements" → Click "New Announcement" → Choose a template or write from scratch → Preview → Post. All residents in your barangay will see it immediately.' },
    { q: 'How do I generate invite codes?', a: 'Go to "User Management" → Use the buttons to generate Official or Tanod codes → Share the code with the new user. They\'ll enter it during registration.' },
    { q: 'How do I view analytics?', a: 'Navigate to "AI Analytics" in the sidebar. You\'ll see KPIs, tanod leaderboard, heatmaps, category trends, and AI-powered insights.' },
    { q: 'What\'s the difference between incidents and tickets?', a: 'Incidents are field events (theft, noise, fire) that need physical response. Tickets are administrative concerns (clearance requests, complaints) handled via chat.' },
    { q: 'How do I export reports?', a: 'In the Incidents or Tickets section, use the CSV or PDF buttons to export filtered data with your barangay branding.' },
  ],
  tanod: [
    { q: 'How do I see my assignments?', a: 'Your dashboard shows all incidents assigned to you. Pending assignments appear first, sorted by priority.' },
    { q: 'How do I navigate to an incident?', a: 'Each assignment shows a mini-map. Tap "Get Directions" to open Google Maps, Waze, or Apple Maps with the location pre-filled.' },
    { q: 'How do I mark an incident as resolved?', a: 'Open the incident → Click "Mark Resolved" → Add resolution notes and optionally a proof photo → Submit. The resident will be notified and can rate your service.' },
    { q: 'How does my performance score work?', a: 'Your score combines: Resolution rate (50%) + Average rating (30%) + Response speed (20%). View it on your dashboard.' },
    { q: 'What are the achievement badges?', a: '🎯 First Response — First resolution. ⭐ Rising Star — 10 resolutions. 🏆 Champion — 50 resolutions. 💎 Excellence — 90%+ rating.' },
    { q: 'How do I call a resident?', a: 'Each assignment shows the reporter\'s phone number. Tap the phone icon to call directly from your device.' },
  ],
}

const guides = {
  resident: [
    { title: 'Getting Started', icon: '👋', steps: ['Sign up with your barangay', 'Complete your profile', 'Explore your dashboard'] },
    { title: 'Reporting an Incident', icon: '🚨', steps: ['Click "Report Incident"', 'Choose category & priority', 'Add location & photo', 'Submit and wait for response'] },
    { title: 'Creating a Ticket', icon: '📝', steps: ['Click "New Ticket"', 'Select category', 'Write your concern', 'Chat with the official'] },
  ],
  official: [
    { title: 'Daily Operations', icon: '⚙️', steps: ['Check pending incidents', 'Dispatch tanods', 'Reply to tickets', 'Post announcements'] },
    { title: 'Team Management', icon: '👥', steps: ['Generate invite codes', 'Review user accounts', 'Monitor tanod performance', 'Export reports'] },
    { title: 'Using AI Analytics', icon: '🧠', steps: ['Open AI Analytics tab', 'Review KPIs and trends', 'Read AI recommendations', 'Plan strategically'] },
  ],
  tanod: [
    { title: 'Field Response', icon: '🛡️', steps: ['Check new assignments', 'Get directions to location', 'Call reporter if needed', 'Resolve and document'] },
    { title: 'Performance Tracking', icon: '🏆', steps: ['View your dashboard', 'Check current rating', 'Aim for fast response', 'Collect achievement badges'] },
  ],
}

const CONTACT_CATEGORIES = [
  { value: 'general', label: 'A question' },
  { value: 'bug', label: 'Something is broken' },
  { value: 'feature', label: 'An idea' },
  { value: 'account', label: 'My account' },
]

const HELP_TABS = ['faq', 'guides', 'contact', 'emergency']

function HelpPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  // replace, not push: Back should leave Help, not walk through its tabs
  const [activeTab, setActiveTab] = useUrlSection(HELP_TABS, 'faq', { param: 'tab', history: 'replace' })
  // The open tab's content eases in when you switch tabs, not on page load.
  const tabEnter = useSectionEntrance(activeTab, true) ? 'fade-up' : ''
  const [expandedFaq, setExpandedFaq] = useState(null) // keyed by question text, not index
  const [searchQuery, setSearchQuery] = useState('')
  const [contactForm, setContactForm] = useState({ subject: '', category: 'general', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [sentAt, setSentAt] = useState(null) // shows the success panel after sending

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (cancelled) return
      if (error || !user) {
        router.replace(loginHref())
        return
      }
      const { data: prof, error: profError } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      // submitSupport() needs profile.id; without it the form says "still
      // loading your account" forever rather than naming the problem.
      if (profError) {
        console.error('Could not load your profile:', profError)
        toast.error('Could not load your account. Please refresh.')
      }
      setProfile(prof)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  async function submitSupport(e) {
    e.preventDefault()
    if (submitting) return
    // Profile may still be loading on a slow connection — the insert needs its id
    if (!profile?.id) {
      toast.error('Still loading your account — try again in a moment')
      return
    }
    const subject = contactForm.subject.trim()
    const message = contactForm.message.trim()
    if (!subject || !message) {
      toast.error('Please fill in all fields')
      return
    }
    if (message.length < 10) {
      toast.error('Please add a bit more detail so we can help')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('support_messages').insert({
      user_id: profile.id,
      subject,
      category: contactForm.category,
      message,
    })
    setSubmitting(false)

    if (error) {
      console.error('Support message failed:', error)
      toast.error('Failed to send message. Please try again.')
      return
    }

    setContactForm({ subject: '', category: 'general', message: '' })
    setSentAt(new Date())
  }

  const userRole = profile?.role || 'resident'
  const faqs = faqByRole[userRole] || faqByRole.resident
  const userGuides = guides[userRole] || guides.resident

  const query = searchQuery.trim().toLowerCase()
  const filteredFaqs = query
    ? faqs.filter(f =>
        f.q.toLowerCase().includes(query) ||
        f.a.toLowerCase().includes(query)
      )
    : faqs

  const tabs = [
    { value: 'faq', label: 'Questions' },
    { value: 'guides', label: 'Guides' },
    { value: 'contact', label: 'Contact' },
    { value: 'emergency', label: 'Hotlines' },
  ]
  const isResident = userRole === 'resident'

  return (
    <PageShell
      title={PAGE_HEADERS.help.title}
      sub={PAGE_HEADERS.help.description}
      subOnDesktop
      onBack={() => goBack(router, '/')}
      bandContent={<Segmented onBand full label="Help sections" value={activeTab} onChange={setActiveTab} items={tabs} />}>

      {/* Questions */}
      {activeTab === 'faq' && (
        <div className={`flex flex-col gap-3.5 ${tabEnter}`}>
          <div className="relative">
            <Search size={18} strokeWidth={1.9} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              type="search" aria-label="Search questions" placeholder="Search questions"
              className="h-[48px] pl-11 pr-11 shadow-[var(--shadow-lift)]" />
            {searchQuery && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                <IconButton kind="ghost" label="Clear search" onClick={() => setSearchQuery('')}><X size={16} strokeWidth={1.9} /></IconButton>
              </span>
            )}
          </div>

          <Card>
            <SectionLabel as="h2" className="px-[18px] pt-3.5 mb-1">Common questions</SectionLabel>
            {filteredFaqs.length === 0 ? (
              <div className="px-[18px] pb-4">
                <Muted>Nothing matches “{searchQuery}”. Send us the question instead.</Muted>
                <Button size="sm" variant="secondary" className="mt-3"
                  onClick={() => {
                    // Carry the search into the contact form so they don't retype it
                    setContactForm(f => ({ ...f, subject: searchQuery.trim().slice(0, 100) }))
                    setActiveTab('contact')
                  }}>
                  Ask support
                </Button>
              </div>
            ) : (
              <Rows>
                {filteredFaqs.map(faq => {
                  // While searching, matches open automatically — the answer is
                  // usually what matched, so don't make people click each one
                  const expanded = query ? true : expandedFaq === faq.q
                  return (
                    <div key={faq.q} role="listitem">
                      <button onClick={() => setExpandedFaq(prev => (prev === faq.q ? null : faq.q))}
                        aria-expanded={expanded}
                        className="flex w-full items-center gap-3 px-3.5 sm:px-[18px] py-3 text-left transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong">
                        <span className="flex-1 text-sm font-bold text-ink">{faq.q}</span>
                        <ChevronDown size={16} aria-hidden="true"
                          className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && <p className="px-3.5 sm:px-[18px] pb-3.5 -mt-1 text-sm leading-[1.55] text-body">{faq.a}</p>}
                    </div>
                  )
                })}
              </Rows>
            )}
          </Card>

          <div>
            <SectionLabel>Still stuck?</SectionLabel>
            <Card>
              <Rows>
                {isResident && (
                  <Row as="button" interactive onClick={() => router.push('/resident/ticket/new')} className="flex items-center gap-3">
                    <TicketsIcon size={20} className="shrink-0 text-brand-strong" />
                    <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-ink">Ask the barangay</span><span className="block text-xs text-muted-foreground">Open a ticket and chat with an official</span></span>
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                  </Row>
                )}
                {isResident && (
                  <Row as="button" interactive onClick={() => router.push('/resident/ai')} className="flex items-center gap-3">
                    <AiIcon size={20} className="shrink-0 text-brand-strong" />
                    <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-ink">Ask the assistant</span><span className="block text-xs text-muted-foreground">Quick answers about barangay services</span></span>
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                  </Row>
                )}
                <Row as="button" interactive onClick={() => setActiveTab('contact')} className="flex items-center gap-3">
                  <MessageSquare size={20} strokeWidth={1.9} className="shrink-0 text-brand-strong" aria-hidden="true" />
                  <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-ink">Message BH360 support</span><span className="block text-xs text-muted-foreground">About the app itself: a bug, your account, an idea</span></span>
                  <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                </Row>
                <Row as="a" href={telHref('911')} interactive className="flex items-center gap-3">
                  <Phone size={20} strokeWidth={1.9} className="shrink-0 text-danger" aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-sm font-bold text-ink">Emergency</span>
                  <span className="text-[13px] font-bold text-muted-foreground">911</span>
                </Row>
              </Rows>
            </Card>
          </div>
        </div>
      )}

      {/* Guides */}
      {activeTab === 'guides' && (
        <div className={`flex flex-col gap-3.5 ${tabEnter}`}>
          {userGuides.map((guide, i) => (
            <Card key={guide.title} lift={i === 0} className="px-[18px] py-4">
              <h2 className="text-[15px] font-extrabold text-ink mb-3">{guide.title}</h2>
              <ol className="space-y-2">
                {guide.steps.map((step, j) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-strong" aria-hidden="true">{j + 1}</span>
                    <span className="pt-0.5 text-sm leading-[1.55] text-body">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
          <Muted className="text-center text-xs">Guides for {userRole === 'resident' ? 'residents' : userRole === 'official' ? 'barangay officials' : 'tanods'}.</Muted>
        </div>
      )}

      {/* Contact */}
      {activeTab === 'contact' && (
        <div className={tabEnter || undefined}>
          {sentAt ? (
            /* Success panel replaces the form — clearer than a toast that
               vanishes, and prevents accidental duplicate sends */
            <Card lift className="px-[18px] py-5">
              <h2 className="text-[15px] font-extrabold text-ink">Message sent</h2>
              <Notice tone="ok" className="mt-3">The BH360 support team has your message and will reply within 24 hours.</Notice>
              <Button variant="secondary" className="mt-4" onClick={() => setSentAt(null)}>Send another message</Button>
            </Card>
          ) : (
            <Card lift as="form" onSubmit={submitSupport} className="px-[18px] py-4 space-y-4">
              <div>
                <h2 className="text-[15px] font-extrabold text-ink">Message BH360 support</h2>
                <p className="text-xs text-muted-foreground mt-0.5">For questions about the app. We reply within 24 hours.</p>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-bold text-ink" id="support-category">Topic</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="support-category">
                  {CONTACT_CATEGORIES.map(c => (
                    <Chip key={c.value} active={contactForm.category === c.value}
                      onClick={() => setContactForm(f => ({ ...f, category: c.value }))}>{c.label}</Chip>
                  ))}
                </div>
              </div>

              <Field id="support-subject" label="Subject" value={contactForm.subject}
                onChange={e => setContactForm(f => ({ ...f, subject: e.target.value }))}
                maxLength={100} placeholder="A few words about it" />

              <Field id="support-message" label="Message" hint={`${contactForm.message.length} of 1000`}>
                <Textarea value={contactForm.message}
                  onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                  rows={5} maxLength={1000} placeholder="Tell us what’s happening" />
              </Field>

              <Button type="submit" size="lg" full disabled={submitting} aria-busy={submitting || undefined}>
                {submitting ? <><Loader2 className="animate-spin" aria-hidden="true" />Sending…</> : 'Send message'}
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Hotlines */}
      {activeTab === 'emergency' && (
        <div className={`flex flex-col gap-3.5 ${tabEnter}`}>
          <Notice tone="danger" title="Life in danger? Call first.">BH360 helps the barangay follow up. For an emergency happening now, call a hotline below.</Notice>
          <HotlineList detailed />
          <Muted className="text-center text-xs">Numbers for the Philippines. Calls don’t need data.</Muted>
        </div>
      )}
    </PageShell>
  )
}

/**
 * The tab lives in the URL (?tab=…), read with useSearchParams — see
 * components/ClientBoundary.jsx. The fallback mirrors this page's layout.
 */
export default function Help() {
  return (
    <ClientBoundary fallback={<PageSkeleton layout="help" header={PAGE_HEADERS.help} />}>
      <HelpPage />
    </ClientBoundary>
  )
}
