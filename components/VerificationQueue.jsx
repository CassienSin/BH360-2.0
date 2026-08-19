'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { BadgeCheck, Search, X, ShieldCheck, ShieldX, Scale, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { verificationStyle } from '@/lib/verification'

/**
 * Manual account verification, done by a barangay official.
 *
 * The decision is a judgement about whether a person actually lives in this
 * barangay, which is exactly the kind of thing a signup form cannot decide
 * and a named official can. Both outcomes are written through the
 * set_verification_status RPC — the client cannot touch the columns
 * directly, and nobody can verify their own account.
 */
export default function VerificationQueue({ profile, users, onUpdated }) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(null)     // id being written
  const [rejecting, setRejecting] = useState(null) // the account being rejected
  const [reason, setReason] = useState('')

  // The official's own row is excluded: self-verification is refused by the
  // database anyway, and showing the button would just invite the error.
  const candidates = useMemo(
    () => users.filter(u => u.id !== profile?.id && !u.is_super_admin),
    [users, profile?.id]
  )

  const counts = useMemo(() => ({
    pending: candidates.filter(u => (u.verification_status || 'pending') === 'pending').length,
    verified: candidates.filter(u => u.verification_status === 'verified').length,
    rejected: candidates.filter(u => u.verification_status === 'rejected').length,
  }), [candidates])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates
      .filter(u => (u.verification_status || 'pending') === tab)
      .filter(u => !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.address?.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // oldest waiting first
  }, [candidates, tab, search])

  async function decide(user, status, note) {
    if (working) return
    setWorking(user.id)
    const { error } = await supabase.rpc('set_verification_status', {
      target_user: user.id,
      new_status: status,
      note: note ?? null,
    })
    setWorking(null)

    if (error) {
      toast.error(error.message || 'Could not update verification')
      return
    }

    onUpdated?.(user.id, {
      verification_status: status,
      verification_note: note?.trim() || null,
      verified_by: profile?.id ?? null,
      verified_at: new Date().toISOString(),
    })
    setRejecting(null)
    setReason('')
    toast.success(
      status === 'verified' ? `${user.full_name} is now verified`
        : status === 'rejected' ? `${user.full_name} was not verified`
        : `${user.full_name} moved back to pending`
    )
  }

  return (
    <div className="space-y-4">

      {/* Why this screen exists — an official deciding someone's standing
          in the barangay should be able to see the basis for the duty. */}
      <div className="white-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
            <BadgeCheck size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800">Resident Verification</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              You are confirming that this person actually lives in {profile?.barangays?.name || 'this barangay'}.
              Verified accounts may request barangay documents; unverified accounts can still
              report incidents, because an emergency should never wait on paperwork.
            </p>
            <div className="flex items-start gap-1.5 mt-2">
              <Scale size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                <strong style={{ color: '#5B54E8' }}>RA 7160, Sec. 394</strong> — the barangay secretary
                keeps the record of the barangay’s inhabitants and reports the actual number of
                residents. The barangay, not the signup form, is the authority on who lives here.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="white-card p-4 space-y-3">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by verification status">
          {[
            { value: 'pending', label: 'Awaiting review', count: counts.pending },
            { value: 'verified', label: 'Verified', count: counts.verified },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
          ].map(f => {
            const style = verificationStyle(f.value)
            const active = tab === f.value
            return (
              <button key={f.value} onClick={() => setTab(f.value)} aria-pressed={active}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: active ? style.color : '#fafaff',
                  color: active ? 'white' : '#6b7280',
                  border: active ? 'none' : '1px solid #f0effe',
                }}>
                {f.label} <span style={{ opacity: 0.75 }}>{f.count}</span>
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            type="search" aria-label="Search accounts"
            placeholder="Search by name, phone, or address..."
            className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="white-card p-10 text-center">
          <BadgeCheck size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 text-sm">
            {tab === 'pending' ? 'Nobody is waiting for verification.' : `No ${tab} accounts.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(u => {
            const style = verificationStyle(u.verification_status)
            const busy = working === u.id
            return (
              <div key={u.id} className="white-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : u.full_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-800 text-sm truncate">{u.full_name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                        {style.icon} {style.short}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                        {u.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{u.phone || 'No phone on file'}</p>
                    <p className="text-xs text-gray-500">{u.address || 'No address on file'}</p>
                    <p className="text-[11px] text-gray-400 mt-1" title={fullDate(u.created_at)}>
                      Registered {timeAgo(u.created_at)}
                      {u.verified_at && ` · reviewed ${timeAgo(u.verified_at)}`}
                    </p>
                    {u.verification_note && (
                      <p className="text-[11px] mt-1.5 px-2.5 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: style.bg, color: style.color }}>
                        {u.verification_note}
                      </p>
                    )}
                  </div>
                </div>

                {rejecting === u.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={2}
                      aria-label={`Reason for not verifying ${u.full_name}`}
                      placeholder="Why can this account not be verified? The resident will see this."
                      className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => decide(u, 'rejected', reason)}
                        disabled={busy || !reason.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldX size={13} />}
                        Confirm rejection
                      </button>
                      <button onClick={() => { setRejecting(null); setReason('') }}
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold"
                        style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    {u.verification_status !== 'verified' && (
                      <button onClick={() => decide(u, 'verified', null)} disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        Verify resident
                      </button>
                    )}
                    {u.verification_status !== 'rejected' && (
                      <button onClick={() => { setRejecting(u.id); setReason('') }} disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        <ShieldX size={13} /> Can’t verify
                      </button>
                    )}
                    {u.verification_status !== 'pending' && (
                      <button onClick={() => decide(u, 'pending', null)} disabled={busy}
                        title="Move back to the review queue"
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                        style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
