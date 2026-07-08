'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Bell, AlignLeft, CheckCircle, Sparkles, Megaphone, Info, AlertTriangle, Lightbulb, Users, Eye, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const TITLE_MIN = 3
const TITLE_MAX = 150
const CONTENT_MIN = 10
const CONTENT_MAX = 2000
const DRAFT_KEY = 'announcement-draft'
const UNDO_SECONDS = 60

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

const TEMPLATES = [
  {
    icon: '📢',
    label: 'General Update',
    title: 'Important Update from the Barangay',
    content: 'Dear residents,\n\nWe would like to inform everyone about...\n\nFor any concerns, please feel free to visit the barangay hall during office hours.\n\nThank you for your cooperation.',
  },
  {
    icon: '🎉',
    label: 'Community Event',
    title: 'Upcoming Community Event',
    content: 'We are excited to invite all residents to our upcoming community event!\n\n📅 Date: \n📍 Location: \n🕐 Time: \n\nLet\'s come together as one community. See you there!',
  },
  {
    icon: '⚠️',
    label: 'Safety Alert',
    title: 'Safety Advisory',
    content: 'Attention all residents:\n\nThis is an important safety advisory regarding...\n\nPlease take necessary precautions and stay alert. Report any suspicious activity to your local barangay tanod.',
  },
  {
    icon: '🏥',
    label: 'Health Program',
    title: 'Health Program Schedule',
    content: 'The barangay is pleased to announce the following health program:\n\n🏥 Service: \n📅 Date: \n📍 Where: Barangay Health Center\n👨‍⚕️ Open to: All residents\n\nPlease bring valid ID.',
  },
]

const BEST_PRACTICES = [
  { icon: '✅', title: 'Be specific', desc: 'Include dates, times, and locations' },
  { icon: '✅', title: 'Stay clear', desc: 'Use simple language everyone understands' },
  { icon: '✅', title: 'Add a call to action', desc: 'Tell residents what to do or expect' },
  { icon: '❌', title: 'Avoid all caps', desc: 'IT FEELS LIKE SHOUTING — use sparingly' },
]

export default function NewAnnouncement() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [posterName, setPosterName] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [postedId, setPostedId] = useState(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(UNDO_SECONDS)
  const [undoing, setUndoing] = useState(false)

  // Restore any saved draft on mount, and load the official's name for the preview
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.title || draft.content) {
          setForm({ title: draft.title || '', content: draft.content || '' })
          setDraftRestored(true)
        }
      }
    } catch {
      // Corrupt draft — ignore
    }

    let cancelled = false
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (!cancelled && prof?.full_name) setPosterName(prof.full_name)
    }
    loadProfile()

    return () => {
      cancelled = true
    }
  }, [supabase, router])

  // Autosave the draft (debounced) so an accidental back-swipe doesn't lose a long announcement
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (form.title || form.content) {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
        } else {
          sessionStorage.removeItem(DRAFT_KEY)
        }
      } catch {
        // Storage full/unavailable — non-critical
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form])

  const trimmedTitle = form.title.trim()
  const trimmedContent = form.content.trim()
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const contentValid = trimmedContent.length >= CONTENT_MIN && trimmedContent.length <= CONTENT_MAX
  const formValid = titleValid && contentValid
  const isDirty = form.title.trim() !== '' || form.content.trim() !== ''

  function applyTemplate(template) {
    // Don't silently wipe out an in-progress announcement
    if (isDirty && !window.confirm(`Replace your current draft with the "${template.label}" template?`)) {
      return
    }
    setForm({ title: template.title, content: template.content })
    setDraftRestored(false)
    toast.success(`Template "${template.label}" loaded!`)
  }

  function clearDraft() {
    setForm({ title: '', content: '' })
    setDraftRestored(false)
    try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    if (!formValid) {
      if (trimmedTitle.length < TITLE_MIN) toast.error(`Title must be at least ${TITLE_MIN} characters.`)
      else if (trimmedContent.length < CONTENT_MIN) toast.error(`Content must be at least ${CONTENT_MIN} characters.`)
      return
    }

    setLoading(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Your session has expired. Please log in again.')
        router.push('/login')
        return
      }

      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('barangay_id')
        .eq('id', user.id)
        .single()

      if (profError || !prof?.barangay_id) {
        toast.error('Your account is not assigned to a barangay.')
        return
      }

      const { data: inserted, error } = await supabase.from('announcements').insert({
        title: trimmedTitle,
        content: trimmedContent,
        posted_by: user.id,
        barangay_id: prof.barangay_id,
        // Publish after the undo window — residents' queries/RLS filter on
        // published_at <= now(), so the row is invisible until then
        published_at: new Date(Date.now() + UNDO_SECONDS * 1000).toISOString(),
      }).select('id').single()

      if (error || !inserted) {
        toast.error('Failed to post announcement. Please try again.')
        return
      }

      // Keep the draft in storage until the undo window closes,
      // so recalling restores the full text
      setPostedId(inserted.id)
      setUndoSecondsLeft(UNDO_SECONDS)
      setSuccess(true)
    } catch (err) {
      console.error('Announcement post failed:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Countdown while the undo window is open; redirect when it closes
  useEffect(() => {
    if (!success || !postedId) return
    if (undoSecondsLeft <= 0) {
      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
      router.push('/official')
      return
    }
    const timer = setTimeout(() => setUndoSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [success, postedId, undoSecondsLeft, router])

  async function undoPost() {
    if (undoing || !postedId) return
    setUndoing(true)
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', postedId)
      if (error) throw error
      // Back to the form with the draft intact (still in state + sessionStorage)
      setPostedId(null)
      setSuccess(false)
      toast.success('Announcement recalled — your draft is unchanged.')
    } catch (err) {
      console.error('Undo failed:', err)
      toast.error('Could not recall the announcement. It may have already published.')
    } finally {
      setUndoing(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-brand flex items-center justify-center p-4">
        <AnimatedDots />
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div
            className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
          />
        </div>

        <div className="white-card p-8 max-w-md text-center relative z-10 fade-up-1" role="status">
          <div
            className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
              boxShadow: '0 8px 32px rgba(91,84,232,0.4)',
              animation: 'float 2s ease-in-out infinite',
            }}
          >
            <Megaphone size={36} className="text-white" />
            <Sparkles size={14} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>Announcement Posted!</h2>
          <p className="text-sm text-gray-500 mb-2">
            It will be visible to all residents in <strong>{undoSecondsLeft}s</strong>. Spotted a mistake? You can still take it back.
          </p>

          {/* Countdown progress bar */}
          <div className="relative h-1.5 rounded-full overflow-hidden mt-4 mb-5" style={{ background: '#f0effe' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(undoSecondsLeft / UNDO_SECONDS) * 100}%`,
                background: 'linear-gradient(90deg, #5B54E8, #7C75F0)',
                transition: 'width 1s linear',
              }}
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={undoPost}
              disabled={undoing}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
              style={{ color: '#ef4444', border: '1px solid #fecaca', background: '#fff' }}
            >
              {undoing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              {undoing ? 'Recalling...' : 'Undo'}
            </button>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
                router.push('/official')
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.4)' }}
            >
              Done
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Leaving this page won't cancel the announcement — it publishes automatically.
          </p>
        </div>
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
        className="bg-white relative z-10 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0"
        style={{ boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.3px' }}>New Announcement</h1>
          <p className="text-xs text-gray-400 truncate">Reach every resident in seconds</p>
        </div>
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
        >
          <Megaphone size={16} className="text-white" />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Intro card */}
        <div className="glass-card p-4 flex items-start gap-3 fade-up">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <Users size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">Broadcast to your barangay</p>
            <p className="text-purple-200 text-xs mt-0.5 leading-relaxed">
              All residents will see this announcement in their dashboard, with optional push notifications.
            </p>
          </div>
        </div>

        {/* Draft restored notice */}
        {draftRestored && (
          <div
            className="rounded-2xl px-4 py-2.5 flex items-center gap-2 fade-up"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}
          >
            <Info size={13} className="text-white flex-shrink-0" />
            <p className="text-xs text-white flex-1">Your unsaved draft was restored.</p>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs font-bold text-white flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
            >
              <X size={11} /> Discard
            </button>
          </div>
        )}

        {/* Templates */}
        <div className="fade-up-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white opacity-60 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Quick Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((tmpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="white-card p-3 text-left flex items-center gap-2 hover:scale-[1.02] transition-all"
              >
                <span className="text-xl flex-shrink-0" aria-hidden="true">{tmpl.icon}</span>
                <span className="text-xs font-semibold text-gray-700 truncate">{tmpl.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main form */}
        <div className="white-card p-5 sm:p-6 fade-up-2">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="announcement-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={11} /> Title <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-xs font-bold ${
                    form.title.length > 120 ? 'text-orange-500' : titleValid ? 'text-emerald-500' : 'text-gray-300'
                  }`}
                >
                  {form.title.length}/{TITLE_MAX}
                </span>
              </div>
              <div className="relative">
                <Bell size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="announcement-title"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                  maxLength={TITLE_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 font-semibold"
                  placeholder="Announcement title..."
                />
              </div>
              {form.title && !titleValid && (
                <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Title is too short
                </p>
              )}
              {titleValid && (
                <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11} /> Great title!
                </p>
              )}
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="announcement-content" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlignLeft size={11} /> Content <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-xs font-bold ${
                    form.content.length > 1800 ? 'text-orange-500' : contentValid ? 'text-emerald-500' : 'text-gray-300'
                  }`}
                >
                  {form.content.length}/{CONTENT_MAX}
                </span>
              </div>
              <div className="relative">
                <AlignLeft size={15} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden="true" />
                <textarea
                  id="announcement-content"
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  required
                  rows={8}
                  maxLength={CONTENT_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none leading-relaxed"
                  placeholder="Write your announcement here...&#10;&#10;Include important details like:&#10;• What is the announcement about?&#10;• When does it apply?&#10;• Who is affected?&#10;• What should residents do?"
                />
              </div>
              {form.content && !contentValid && (
                <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Add more details ({Math.max(CONTENT_MIN - trimmedContent.length, 0)} more characters)
                </p>
              )}
              {contentValid && (
                <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11} /> Looks great!
                </p>
              )}
            </div>

            {/* Pro tip */}
            <div className="p-3 rounded-2xl flex items-start gap-2.5" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-amber-900">Pro Tip</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Keep your titles short and clear. Use emojis sparingly to highlight important information. Residents will receive a notification when you post!
                </p>
              </div>
            </div>

            {/* Live Preview */}
            {isDirty && (
              <div className="fade-up">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={11} style={{ color: '#5B54E8' }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>
                    Preview (as residents will see)
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
                    >
                      <Bell size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-sm break-words">
                        {form.title || 'Your announcement title...'}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1 leading-relaxed whitespace-pre-wrap break-words">
                        {form.content || 'Your detailed content will appear here as residents will see it...'}
                      </p>
                      <p className="text-gray-300 text-xs mt-2">
                        {posterName ? `${posterName} · ` : ''}just now
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !formValid}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: formValid ? 'linear-gradient(135deg, #5B54E8, #7C75F0)' : '#9ca3af',
                boxShadow: formValid ? '0 8px 32px rgba(91,84,232,0.4)' : 'none',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Posting announcement...
                </>
              ) : (
                <>
                  <Megaphone size={14} /> Post Announcement
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              📢 All residents in your barangay will see this immediately
            </p>
          </form>
        </div>

        {/* Best practices */}
        <div className="white-card p-5 fade-up-3">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Info size={14} style={{ color: '#5B54E8' }} /> Best Practices
          </h3>
          <div className="space-y-2.5">
            {BEST_PRACTICES.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-base flex-shrink-0" aria-hidden="true">{tip.icon}</span>
                <div>
                  <p className="text-xs font-bold text-gray-800">{tip.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}