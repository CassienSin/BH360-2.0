'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertTriangle, MapPin, FileText, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

const categories = [
  { value: 'Noise', label: 'Noise Complaint', icon: '🔊', color: '#f97316', bg: '#fff7ed' },
  { value: 'Theft', label: 'Theft / Robbery', icon: '🚨', color: '#ef4444', bg: '#fef2f2' },
  { value: 'Violence', label: 'Violence / Fight', icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  { value: 'Fire', label: 'Fire', icon: '🔥', color: '#ea580c', bg: '#fff7ed' },
  { value: 'Flood', label: 'Flooding', icon: '🌊', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'Infrastructure', label: 'Infrastructure', icon: '🛠️', color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'Animals', label: 'Stray Animals', icon: '🐕', color: '#a16207', bg: '#fefce8' },
  { value: 'Medical', label: 'Medical Emergency', icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  { value: 'Traffic', label: 'Traffic Issue', icon: '🚦', color: '#0891b2', bg: '#ecfeff' },
  { value: 'Vandalism', label: 'Vandalism', icon: '🎨', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'Drugs', label: 'Illegal Drugs', icon: '💊', color: '#be185d', bg: '#fdf2f8' },
  { value: 'Other', label: 'Other', icon: '📝', color: '#6b7280', bg: '#f9fafb' },
]

export default function ReportIncident() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', description: '', location: '', category: '' })
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (!form.category) {
      toast.error('Please select a category.')
      setLoading(false); return
    }
    if (form.title.trim().length < 3) {
      toast.error('Title must be at least 3 characters.')
      setLoading(false); return
    }
    if (form.title.trim().length > 100) {
      toast.error('Title must be under 100 characters.')
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
    if (form.location.trim().length < 3) {
      toast.error('Please provide a more specific location.')
      setLoading(false); return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('barangay_id').eq('id', user.id).single()

    if (!prof?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      setLoading(false); return
    }

    const { error } = await supabase.from('incidents').insert({
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      category: form.category,
      reported_by: user.id,
      barangay_id: prof.barangay_id,
      status: 'pending'
    })

    if (error) {
      toast.error('Failed to report incident. Please try again.')
      setLoading(false); return
    }

    toast.success('Incident reported successfully!')
    setTimeout(() => router.push('/resident'), 1000)
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
          <h1 className="text-base font-bold text-gray-800">Report an Incident</h1>
          <p className="text-xs text-gray-400">Notify the barangay immediately</p>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background: 'rgba(255,255,255,0.2)'}}>
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Report an incident</p>
            <p className="text-purple-200 text-xs mt-0.5">A barangay official will respond shortly.</p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Tag size={11} /> Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm({...form, category: cat.value})}
                    className="p-3 rounded-2xl flex flex-col items-center gap-1.5 text-center transition-all hover:scale-105"
                    style={{
                      background: form.category === cat.value ? cat.bg : '#fafaff',
                      border: `2px solid ${form.category === cat.value ? cat.color : '#f0effe'}`,
                      boxShadow: form.category === cat.value ? `0 4px 12px ${cat.color}25` : 'none',
                    }}>
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-xs font-bold leading-tight"
                      style={{color: form.category === cat.value ? cat.color : '#6b7280'}}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
              {form.category && (
                <p className="text-xs mt-2 flex items-center gap-1.5 fade-up" style={{color: categories.find(c => c.value === form.category)?.color}}>
                  ✓ Selected: <strong>{categories.find(c => c.value === form.category)?.label}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Incident Title
              </label>
              <div className="relative">
                <AlertTriangle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="title" value={form.title} onChange={handleChange} required maxLength={100}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Brief title for the incident..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Description
              </label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea name="description" value={form.description} onChange={handleChange} required rows={4} maxLength={1000}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Describe the incident in detail..." />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/1000</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Location
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="location" value={form.location} onChange={handleChange} required
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Near Sitio 3 basketball court..." />
              </div>
            </div>

            <button type="submit" disabled={loading || !form.category}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Submitting...
                </span>
              ) : 'Submit Report'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}