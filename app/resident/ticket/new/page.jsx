'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, FileText, AlignLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NewTicket() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', description: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (form.title.trim().length < 3) {
      toast.error('Subject must be at least 3 characters.')
      setLoading(false); return
    }
    if (form.title.trim().length > 100) {
      toast.error('Subject must be under 100 characters.')
      setLoading(false); return
    }
    if (form.description.trim().length < 10) {
      toast.error('Description must be at least 10 characters.')
      setLoading(false); return
    }
    if (form.description.trim().length > 1000) {
      toast.error('Description must be under 1000 characters.')
      setLoading(false); return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('barangay_id').eq('id', user.id).single()

    if (!prof?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      setLoading(false); return
    }

    const { data, error } = await supabase.from('tickets').insert({
      title: form.title.trim(),
      description: form.description.trim(),
      created_by: user.id,
      barangay_id: prof.barangay_id,
      status: 'open'
    }).select().single()

    if (error) {
      toast.error('Failed to create ticket. Please try again.')
      setLoading(false); return
    }

    toast.success('Ticket created successfully!')
    setTimeout(() => router.push(`/resident/ticket/${data.id}`), 1000)
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
          <h1 className="text-base font-bold text-gray-800">Create New Ticket</h1>
          <p className="text-xs text-gray-400">A barangay official will respond shortly</p>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-4 py-8">
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background: 'rgba(255,255,255,0.2)'}}>
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Support Ticket</p>
            <p className="text-purple-200 text-xs mt-0.5">Describe your concern through chat.</p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Subject
              </label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required maxLength={100}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Request for barangay clearance..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Description
              </label>
              <div className="relative">
                <AlignLeft size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} required rows={5} maxLength={1000}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Explain your concern in detail..." />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/1000</p>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating...
                </span>
              ) : 'Create Ticket'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}