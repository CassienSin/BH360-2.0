'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, HelpCircle, MessageSquare, BookOpen, Phone, ChevronDown, Send, Sparkles, Search, AlertTriangle, Loader2, CheckCircle, X } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

const DOTS = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

// Ambient decoration only — skipped for users who prefer reduced motion.
const AnimatedDots = () => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  if (!show) return null
  return (
    <div className="absolute inset-0" style={{ overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      {DOTS.map((dot, i) => (
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
}

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
  { value: 'general', label: 'General Question', icon: '💬' },
  { value: 'bug', label: 'Bug Report', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', icon: '✨' },
  { value: 'account', label: 'Account Issue', icon: '🔐' },
]

const HOTLINES = [
  { name: 'National Emergency Hotline', number: '911', icon: '🚨', desc: 'For police, fire, or medical emergencies', color: '#ef4444', bg: '#fef2f2' },
  { name: 'Philippine Red Cross', number: '143', icon: '🚑', desc: 'Medical emergencies and ambulance', color: '#dc2626', bg: '#fef2f2' },
  { name: 'Bureau of Fire Protection', number: '160', icon: '🚒', desc: 'Fire emergencies', color: '#f97316', bg: '#fff7ed' },
  { name: 'Philippine National Police', number: '117', icon: '👮', desc: 'Crime, public safety', color: '#3b82f6', bg: '#eff6ff' },
  { name: 'NDRRMC (Disaster)', number: '(02) 8911-1406', icon: '🌊', desc: 'Natural disasters', color: '#0891b2', bg: '#ecfeff' },
  { name: 'DOH Health Hotline', number: '1555', icon: '🏥', desc: 'Health emergencies and concerns', color: '#16a34a', bg: '#f0fdf4' },
]

export default function HelpPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('faq')
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
        router.push('/login')
        return
      }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!cancelled) setProfile(prof)
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
    { key: 'faq', label: 'FAQ', icon: HelpCircle },
    { key: 'guides', label: 'Guides', icon: BookOpen },
    { key: 'contact', label: 'Contact', icon: MessageSquare },
    { key: 'emergency', label: 'Emergency', icon: Phone },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
      </div>

      <header className="bg-white relative z-10 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0"
        style={{ boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.3px' }}>Help & Support</h1>
          <p className="text-xs text-gray-400 truncate">We're here to help, 24/7</p>
        </div>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}>
          <HelpCircle size={16} className="text-white" />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Hero card */}
        <div className="glass-card p-5 flex items-center gap-3 fade-up">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Sparkles size={20} className="text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">How can we help{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}?</p>
            <p className="text-purple-200 text-xs mt-0.5">Browse FAQs, guides, or contact us directly.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="white-card p-2 fade-up-1">
          <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Help sections">
            {tabs.map(tab => {
              const Icon = tab.icon
              const selected = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  role="tab" aria-selected={selected}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl transition-all"
                  style={{
                    background: selected ? '#f0effe' : 'transparent',
                    color: selected ? '#5B54E8' : '#6b7280',
                  }}>
                  <Icon size={16} aria-hidden="true" />
                  <span className="text-[10px] font-bold">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-3 fade-up-2">
            <div className="white-card p-4">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  type="search"
                  aria-label="Search FAQs"
                  placeholder="Search FAQs..."
                  className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {filteredFaqs.length === 0 && (
                <div className="white-card p-8 text-center">
                  <Search size={32} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
                  <p className="text-sm font-semibold text-gray-700">No FAQs match your search</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Try different keywords, or send us your question directly</p>
                  <button
                    onClick={() => {
                      // Carry the search into the contact form so they don't retype it
                      setContactForm(f => ({ ...f, subject: searchQuery.trim().slice(0, 100) }))
                      setActiveTab('contact')
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    <MessageSquare size={12} /> Ask support
                  </button>
                </div>
              )}
              {filteredFaqs.map(faq => {
                // While searching, matches open automatically — the answer is
                // usually what matched, so don't make people click each one
                const expanded = query ? true : expandedFaq === faq.q
                return (
                  <div key={faq.q} className="white-card overflow-hidden">
                    <button onClick={() => setExpandedFaq(prev => (prev === faq.q ? null : faq.q))}
                      aria-expanded={expanded}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors">
                      <p className="text-sm font-bold text-gray-800 flex-1">{faq.q}</p>
                      <ChevronDown size={16} aria-hidden="true"
                        className="text-gray-400 flex-shrink-0 transition-transform"
                        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 fade-up">
                        <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Guides Tab */}
        {activeTab === 'guides' && (
          <div className="space-y-3 fade-up-2">
            <div className="p-3 rounded-2xl flex items-start gap-2.5"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <BookOpen size={14} style={{ color: '#5B54E8' }} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-purple-900">
                Quick guides for <strong>{userRole === 'resident' ? 'residents' : userRole === 'official' ? 'barangay officials' : 'tanods'}</strong>
              </p>
            </div>

            {userGuides.map(guide => (
              <div key={guide.title} className="white-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0" aria-hidden="true">{guide.icon}</span>
                  <h3 className="text-sm font-bold text-gray-800">{guide.title}</h3>
                </div>
                <ol className="space-y-2">
                  {guide.steps.map((step, j) => (
                    <li key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-xl flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }} aria-hidden="true">
                        {j + 1}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === 'contact' && (
          <div className="fade-up-2">
            {sentAt ? (
              /* Success panel replaces the form — clearer than a toast that
                 vanishes, and prevents accidental duplicate sends */
              <div className="white-card p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-3xl flex items-center justify-center"
                  style={{ background: '#f0fdf4' }}>
                  <CheckCircle size={26} className="text-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">Message sent</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  The BH360 support team has your message and will respond within 24 hours.
                </p>
                <button
                  onClick={() => setSentAt(null)}
                  className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                  style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                  <Send size={12} /> Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submitSupport} className="white-card p-5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f0effe' }}>
                    <MessageSquare size={18} style={{ color: '#5B54E8' }} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Contact Support</h3>
                    <p className="text-xs text-gray-400">We respond within 24 hours</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Message category">
                    {CONTACT_CATEGORIES.map(c => (
                      <button key={c.value} type="button"
                        onClick={() => setContactForm(f => ({ ...f, category: c.value }))}
                        aria-pressed={contactForm.category === c.value}
                        className="p-2.5 rounded-2xl flex items-center gap-2 transition-all"
                        style={{
                          background: contactForm.category === c.value ? '#f0effe' : '#fafaff',
                          border: `2px solid ${contactForm.category === c.value ? '#5B54E8' : '#f0effe'}`,
                        }}>
                        <span aria-hidden="true">{c.icon}</span>
                        <span className="text-xs font-bold text-gray-700">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="support-subject" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Subject</label>
                  <input id="support-subject" value={contactForm.subject}
                    onChange={e => setContactForm(f => ({ ...f, subject: e.target.value }))}
                    maxLength={100}
                    className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800"
                    placeholder="Brief description of your issue" />
                </div>

                <div>
                  <label htmlFor="support-message" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Message</label>
                  <textarea id="support-message" value={contactForm.message}
                    onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                    rows={5} maxLength={1000}
                    className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800 resize-none"
                    placeholder="Tell us what's happening..." />
                  <p className="text-xs text-gray-400 text-right mt-1" aria-live="polite">{contactForm.message.length}/1000</p>
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                  {submitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={14} /> Send Message</>
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                  <CheckCircle size={11} aria-hidden="true" /> Your message goes directly to the BH360 support team
                </p>
              </form>
            )}
          </div>
        )}

        {/* Emergency Tab */}
        {activeTab === 'emergency' && (
          <div className="space-y-3 fade-up-2">
            <div className="rounded-3xl p-5"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fee2e2' }}>
                  <AlertTriangle size={20} className="text-red-500" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-700">Life-threatening Emergency?</h3>
                  <p className="text-xs text-red-600">Use these hotlines first</p>
                </div>
              </div>
              <p className="text-xs text-red-700">
                BH360 is for community management. For active emergencies, contact the appropriate hotline below directly.
              </p>
            </div>

            {HOTLINES.map(contact => (
              <a key={contact.number} href={`tel:${contact.number.replace(/[^0-9+]/g, '')}`}
                aria-label={`Call ${contact.name} at ${contact.number}`}
                className="white-card p-4 flex items-center gap-3 transition-all hover:scale-[1.02]">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: contact.bg }} aria-hidden="true">
                  {contact.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{contact.name}</p>
                  <p className="text-xs text-gray-400 truncate">{contact.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
                  style={{ background: contact.bg }}>
                  <Phone size={12} style={{ color: contact.color }} aria-hidden="true" />
                  <span className="text-sm font-black" style={{ color: contact.color }}>{contact.number}</span>
                </div>
              </a>
            ))}

            <p className="text-xs text-white opacity-60 text-center pt-2">
              Numbers are valid for the Philippines 🇵🇭
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <Image src="/logo.png" alt="BH360" width={32} height={32} className="object-contain mx-auto mb-1 opacity-50" />
          <p className="text-xs text-white opacity-40">BarangayHub 360 · v1.0.0</p>
        </div>
      </main>
    </div>
  )
}