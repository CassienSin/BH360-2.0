'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, FileText, AlignLeft, Tag, CheckCircle, Send, Sparkles, HelpCircle, Loader2, Lightbulb, FileQuestion, AlertCircle, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const TITLE_MIN = 3
const TITLE_MAX = 100
const DESC_MIN = 10
const DESC_MAX = 1000

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

const CATEGORIES = [
  { value: 'inquiry', label: 'Inquiry', desc: 'Ask a question or get information', icon: FileQuestion, color: '#3b82f6', bg: '#eff6ff' },
  { value: 'request', label: 'Request', desc: 'Request a service or document', icon: FileText, color: '#5B54E8', bg: '#f0effe' },
  { value: 'complaint', label: 'Complaint', desc: 'Report an issue or grievance', icon: AlertCircle, color: '#f97316', bg: '#fff7ed' },
  { value: 'feedback', label: 'Feedback', desc: 'Share suggestions or feedback', icon: Star, color: '#22c55e', bg: '#f0fdf4' },
]

const EXAMPLES = [
  { title: 'Request for Barangay Clearance', icon: '📄', category: 'request' },
  { title: 'Issue with Streetlight in our area', icon: '💡', category: 'complaint' },
  { title: 'Suggestion for Community Event', icon: '🎉', category: 'feedback' },
  { title: 'Question about Health Program', icon: '🏥', category: 'inquiry' },
]

const NEXT_STEPS = [
  { step: '01', title: 'Officials review your ticket', desc: 'Usually within a few hours' },
  { step: '02', title: 'Real-time chat opens', desc: 'Discuss your concern directly' },
  { step: '03', title: 'Resolution & feedback', desc: 'Ticket closes once resolved' },
]

export default function NewTicket() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({ title: '', description: '', category: 'inquiry' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const redirectTimerRef = useRef(null)

  // Clear the pending redirect if the user navigates away first
  useEffect(() => {
    return () => clearTimeout(redirectTimerRef.current)
  }, [])

  // Validate against trimmed lengths so "   ab " can't enable the button
  const trimmedTitle = form.title.trim()
  const trimmedDesc = form.description.trim()
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const descValid = trimmedDesc.length >= DESC_MIN && trimmedDesc.length <= DESC_MAX
  const formValid = titleValid && descValid

  const selectedCategory = CATEGORIES.find(c => c.value === form.category) || CATEGORIES[0]
  const CategoryIcon = selectedCategory.icon

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    if (trimmedTitle.length < TITLE_MIN) {
      toast.error(`Subject must be at least ${TITLE_MIN} characters.`)
      return
    }
    if (trimmedDesc.length < DESC_MIN) {
      toast.error(`Description must be at least ${DESC_MIN} characters.`)
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

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: trimmedTitle,
          description: trimmedDesc,
          category: form.category,
          created_by: user.id,
          barangay_id: prof.barangay_id,
          status: 'open',
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create ticket. Please try again.')
        return
      }

      setSuccess(true)
      redirectTimerRef.current = setTimeout(() => router.push(`/resident/ticket/${data.id}`), 1500)
    } catch (err) {
      console.error('Ticket creation failed:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
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
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 8px 32px rgba(34,197,94,0.4)',
              animation: 'float 2s ease-in-out infinite',
            }}
          >
            <CheckCircle size={36} className="text-white" />
            <Sparkles size={14} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>Ticket Created!</h2>
          <p className="text-sm text-gray-500 mb-2">Your ticket has been submitted to your barangay officials.</p>
          <p className="text-xs text-gray-400">Redirecting to chat...</p>
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#5B54E8', animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#7C75F0', animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '300ms' }} />
          </div>
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
          <h1 className="text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.3px' }}>Create New Ticket</h1>
          <p className="text-xs text-gray-400 truncate">A barangay official will respond shortly</p>
        </div>
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
        >
          <FileText size={16} className="text-white" />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Intro card */}
        <div className="glass-card p-4 flex items-start gap-3 fade-up">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <Lightbulb size={18} className="text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">What's a support ticket?</p>
            <p className="text-purple-200 text-xs mt-0.5 leading-relaxed">
              Use this to request services, ask questions, file complaints, or share feedback. You'll be able to chat directly with a barangay official.
            </p>
          </div>
        </div>

        {/* Examples */}
        <div className="fade-up-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white opacity-60 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Quick Examples
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, title: ex.title, category: ex.category }))}
                className="white-card p-3 text-left flex items-center gap-2 hover:scale-[1.02] transition-all"
              >
                <span className="text-base flex-shrink-0" aria-hidden="true">{ex.icon}</span>
                <span className="text-xs font-semibold text-gray-700 truncate">{ex.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main form */}
        <div className="white-card p-5 sm:p-6 fade-up-2">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Category selector */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag size={11} /> Category <span className="text-red-500">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const selected = form.category === cat.value
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                      className="rounded-2xl p-3 text-left transition-all hover:scale-[1.02]"
                      style={{
                        background: selected ? cat.bg : '#fafaff',
                        border: `2px solid ${selected ? cat.color : '#f0effe'}`,
                        boxShadow: selected ? `0 4px 16px ${cat.color}30` : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} style={{ color: cat.color }} />
                        <span className="text-sm font-bold" style={{ color: selected ? cat.color : '#374151' }}>
                          {cat.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">{cat.desc}</p>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Subject/Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="ticket-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={11} /> Subject <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-xs font-bold ${
                    form.title.length > 80 ? 'text-orange-500' : titleValid ? 'text-emerald-500' : 'text-gray-300'
                  }`}
                >
                  {form.title.length}/{TITLE_MAX}
                </span>
              </div>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="ticket-title"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                  maxLength={TITLE_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Brief title for your ticket..."
                />
              </div>
              {form.title && !titleValid && (
                <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> Subject is too short ({TITLE_MIN - trimmedTitle.length} more character{TITLE_MIN - trimmedTitle.length === 1 ? '' : 's'} needed)
                </p>
              )}
              {titleValid && (
                <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11} /> Good subject!
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="ticket-description" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlignLeft size={11} /> Description <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-xs font-bold ${
                    form.description.length > 900 ? 'text-orange-500' : descValid ? 'text-emerald-500' : 'text-gray-300'
                  }`}
                >
                  {form.description.length}/{DESC_MAX}
                </span>
              </div>
              <div className="relative">
                <AlignLeft size={15} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden="true" />
                <textarea
                  id="ticket-description"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  required
                  rows={6}
                  maxLength={DESC_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Provide as much detail as possible — when, where, what happened, and what you need..."
                />
              </div>
              {form.description && !descValid && (
                <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> Need more details ({DESC_MIN - trimmedDesc.length} more character{DESC_MIN - trimmedDesc.length === 1 ? '' : 's'})
                </p>
              )}
              {descValid && (
                <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11} /> Great detail!
                </p>
              )}
            </div>

            {/* Tip card */}
            <div className="p-3 rounded-2xl flex items-start gap-2.5" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-amber-900">Pro Tip</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Include specific details like location, date/time, and what kind of help you need. The more details, the faster officials can help!
                </p>
              </div>
            </div>

            {/* Preview */}
            {(form.title || form.description) && (
              <div className="rounded-2xl p-4 fade-up" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
                  Preview
                </p>
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedCategory.bg }}
                  >
                    <CategoryIcon size={14} style={{ color: selectedCategory.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {form.title || 'Your ticket title...'}
                      </p>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{ background: selectedCategory.bg, color: selectedCategory.color }}
                      >
                        {selectedCategory.label}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">
                        open
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {form.description || 'Your detailed description will appear here...'}
                    </p>
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
                  Creating ticket...
                </>
              ) : (
                <>
                  <Send size={14} /> Submit Ticket
                </>
              )}
            </button>

            {/* Helper text */}
            <p className="text-xs text-gray-400 text-center">
              By submitting, your ticket will be visible to barangay officials only
            </p>
          </form>
        </div>

        {/* What happens next */}
        <div className="white-card p-5 fade-up-3">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <HelpCircle size={14} style={{ color: '#5B54E8' }} /> What happens next?
          </h3>
          <div className="space-y-3">
            {NEXT_STEPS.map(s => (
              <div key={s.step} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
                >
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}