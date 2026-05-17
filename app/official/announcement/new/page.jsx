'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Bell, AlignLeft, Send, CheckCircle, Sparkles, Megaphone, Calendar, Info, AlertTriangle, Lightbulb, Users, Eye, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

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

const templates = [
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

export default function NewAnnouncement() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const titleLength = form.title.length
  const contentLength = form.content.length
  const titleValid = titleLength >= 3 && titleLength <= 150
  const contentValid = contentLength >= 10 && contentLength <= 2000
  const formValid = titleValid && contentValid

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formValid) {
      if (titleLength < 3) toast.error('Title must be at least 3 characters.')
      else if (contentLength < 10) toast.error('Content must be at least 10 characters.')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('barangay_id, full_name').eq('id', user.id).single()

    if (!prof?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      content: form.content.trim(),
      posted_by: user.id,
      barangay_id: prof.barangay_id,
    })

    if (error) {
      toast.error('Failed to post announcement.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/official'), 1500)
  }

  function useTemplate(template) {
    setForm({ title: template.title, content: template.content })
    toast.success(`Template "${template.label}" loaded!`)
  }

  if (success) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-brand flex items-center justify-center p-4">
        <AnimatedDots />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
            style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        </div>

        <div className="white-card p-8 max-w-md text-center relative z-10 fade-up-1">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center relative"
            style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)', animation: 'float 2s ease-in-out infinite'}}>
            <Megaphone size={36} className="text-white" />
            <Sparkles size={14} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{letterSpacing: '-0.5px'}}>Announcement Posted!</h2>
          <p className="text-sm text-gray-500 mb-2">Your announcement is now live and visible to all residents in your barangay.</p>
          <p className="text-xs text-gray-400">Redirecting to dashboard...</p>
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{background: '#5B54E8', animationDelay: '0ms'}} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{background: '#7C75F0', animationDelay: '150ms'}} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{background: '#a78bfa', animationDelay: '300ms'}} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
      </div>

      <header className="bg-white relative z-10 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0"
        style={{boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate" style={{letterSpacing: '-0.3px'}}>New Announcement</h1>
          <p className="text-xs text-gray-400 truncate">Reach every resident in seconds</p>
        </div>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
          <Megaphone size={16} className="text-white" />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Intro card */}
        <div className="glass-card p-4 flex items-start gap-3 fade-up">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{background: 'rgba(255,255,255,0.2)'}}>
            <Users size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">Broadcast to your barangay</p>
            <p className="text-purple-200 text-xs mt-0.5 leading-relaxed">
              All residents will see this announcement in their dashboard, with optional push notifications.
            </p>
          </div>
        </div>

        {/* Templates */}
        <div className="fade-up-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white opacity-60 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Quick Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((tmpl, i) => (
              <button key={i} type="button" onClick={() => useTemplate(tmpl)}
                className="white-card p-3 text-left flex items-center gap-2 hover:scale-[1.02] transition-all">
                <span className="text-xl flex-shrink-0">{tmpl.icon}</span>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={11} /> Title <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs font-bold ${
                  titleLength > 150 ? 'text-red-500' :
                  titleLength > 120 ? 'text-orange-500' :
                  titleLength >= 3 ? 'text-emerald-500' :
                  'text-gray-300'
                }`}>
                  {titleLength}/150
                </span>
              </div>
              <div className="relative">
                <Bell size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  required maxLength={150}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 font-semibold"
                  placeholder="Announcement title..." />
              </div>
              {form.title && !titleValid && titleLength < 3 && (
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlignLeft size={11} /> Content <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs font-bold ${
                  contentLength > 2000 ? 'text-red-500' :
                  contentLength > 1800 ? 'text-orange-500' :
                  contentLength >= 10 ? 'text-emerald-500' :
                  'text-gray-300'
                }`}>
                  {contentLength}/2000
                </span>
              </div>
              <div className="relative">
                <AlignLeft size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})}
                  required rows={8} maxLength={2000}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none leading-relaxed"
                  placeholder="Write your announcement here...&#10;&#10;Include important details like:&#10;• What is the announcement about?&#10;• When does it apply?&#10;• Who is affected?&#10;• What should residents do?" />
              </div>
              {form.content && contentLength < 10 && (
                <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Add more details ({10 - contentLength} more characters)
                </p>
              )}
              {contentValid && (
                <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11} /> Looks great!
                </p>
              )}
            </div>

            {/* Pro tip */}
            <div className="p-3 rounded-2xl flex items-start gap-2.5"
              style={{background: '#fffbeb', border: '1px solid #fef3c7'}}>
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">Pro Tip</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Keep your titles short and clear. Use emojis sparingly to highlight important information. Residents will receive a notification when you post!
                </p>
              </div>
            </div>

            {/* Live Preview */}
            {(form.title || form.content) && (
              <div className="fade-up">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={11} style={{color: '#5B54E8'}} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{color: '#5B54E8'}}>
                    Preview (as residents will see)
                  </p>
                </div>
                <div className="rounded-2xl p-4"
                  style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                      <Bell size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-sm">
                        {form.title || 'Your announcement title...'}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1 leading-relaxed whitespace-pre-wrap">
                        {form.content || 'Your detailed content will appear here as residents will see it...'}
                      </p>
                      <p className="text-gray-300 text-xs mt-2">just now</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button type="submit" disabled={loading || !formValid}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: formValid ? 'linear-gradient(135deg, #5B54E8, #7C75F0)' : '#9ca3af',
                boxShadow: formValid ? '0 8px 32px rgba(91,84,232,0.4)' : 'none',
              }}>
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
            <Info size={14} style={{color: '#5B54E8'}} /> Best Practices
          </h3>
          <div className="space-y-2.5">
            {[
              { icon: '✅', title: 'Be specific', desc: 'Include dates, times, and locations' },
              { icon: '✅', title: 'Stay clear', desc: 'Use simple language everyone understands' },
              { icon: '✅', title: 'Add a call to action', desc: 'Tell residents what to do or expect' },
              { icon: '❌', title: 'Avoid all caps', desc: 'IT FEELS LIKE SHOUTING — use sparingly' },
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-base flex-shrink-0">{tip.icon}</span>
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