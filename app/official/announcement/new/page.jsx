'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Bell, AlignLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NewAnnouncement() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (form.title.trim().length < 3) {
      toast.error('Title must be at least 3 characters.')
      setLoading(false); return
    }
    if (form.title.trim().length > 150) {
      toast.error('Title must be under 150 characters.')
      setLoading(false); return
    }
    if (form.content.trim().length < 10) {
      toast.error('Content must be at least 10 characters.')
      setLoading(false); return
    }
    if (form.content.trim().length > 2000) {
      toast.error('Content must be under 2000 characters.')
      setLoading(false); return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('barangay_id').eq('id', user.id).single()

    if (!prof?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      setLoading(false); return
    }

    const { error } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      content: form.content.trim(),
      posted_by: user.id,
      barangay_id: prof.barangay_id
    })

    if (error) { toast.error('Failed to post announcement.'); setLoading(false); return }
    toast.success('Announcement posted!')
    setTimeout(() => router.push('/official'), 1000)
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
      </div>

      <header className="bg-white relative z-10 px-6 py-4 flex items-center gap-3"
        style={{boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">New Announcement</h1>
          <p className="text-xs text-gray-400">Post an update to your barangay</p>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-4 py-8">
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background: 'rgba(255,255,255,0.2)'}}>
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Barangay Announcement</p>
            <p className="text-purple-200 text-xs mt-0.5">Visible to all residents in your barangay immediately.</p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Title
              </label>
              <div className="relative">
                <Bell size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required maxLength={150}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Announcement title..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Content
              </label>
              <div className="relative">
                <AlignLeft size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} required rows={6} maxLength={2000}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Write your announcement here..." />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.content.length}/2000</p>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Posting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Bell size={15} /> Post Announcement
                </span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}