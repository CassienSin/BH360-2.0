'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { FileCheck2, Scale, Loader2, Clock, AlertOctagon, CheckCircle2, XCircle, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import RecordListToolbar, { RecordListEmpty } from './RecordListToolbar'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import {
  DOCUMENT_TYPES, DOC_STATUS_STYLE, DEADLINE_STYLE,
  deadlineState, formatDeadline, workingDeadline,
} from '@/lib/documents'

/**
 * The official's side of RA 11032.
 *
 * The queue is ordered by DEADLINE, not by arrival: the request closest to
 * running out of time is the one the law says to do next. Every row shows
 * the working days left, and a request whose time has run out is labelled
 * deemed approved under Sec. 10 rather than quietly ageing at the bottom of
 * a list.
 */
export default function DocumentQueue({ profile, requests, onUpdated }) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(null)
  const [denying, setDenying] = useState(null)
  const [extending, setExtending] = useState(null)
  const [reason, setReason] = useState('')

  const counts = useMemo(() => {
    const open = requests.filter(r => !['released', 'denied'].includes(r.status))
    return {
      open: open.length,
      breach: open.filter(r => deadlineState(r).deemedApproved).length,
      done: requests.length - open.length,
    }
  }, [requests])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const isOpen = r => !['released', 'denied'].includes(r.status)
    return requests
      .filter(r => tab === 'all' || (tab === 'open' ? isOpen(r) : !isOpen(r)))
      .filter(r => !q ||
        r.reference_code?.toLowerCase().includes(q) ||
        r.purpose?.toLowerCase().includes(q) ||
        DOCUMENT_TYPES[r.document_type]?.label.toLowerCase().includes(q) ||
        r.profiles?.full_name?.toLowerCase().includes(q))
      // Soonest deadline first for open work; most recently decided first
      // once it is finished.
      .sort((a, b) => (tab === 'open'
        ? new Date(a.due_at) - new Date(b.due_at)
        : tab === 'all' ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(b.released_at || b.created_at) - new Date(a.released_at || a.created_at)))
  }, [requests, tab, search])

  function resetFilters() { setSearch(''); setTab('all') }

  async function patch(req, changes, message) {
    if (working) return
    setWorking(req.id)
    const { error } = await supabase.from('document_requests').update(changes).eq('id', req.id)
    setWorking(null)
    if (error) {
      toast.error(error.message || 'Could not update the request')
      return
    }
    onUpdated?.(req.id, changes)
    setDenying(null)
    setExtending(null)
    setReason('')
    toast.success(message)
  }

  function claim(req) {
    patch(req, { status: 'processing', handled_by: profile?.id ?? null }, 'Marked as processing')
  }

  function markReady(req) {
    patch(req, { status: 'ready', handled_by: profile?.id ?? null }, 'Marked ready for pickup')
  }

  function release(req) {
    const state = deadlineState(req)
    patch(req, {
      status: 'released',
      handled_by: profile?.id ?? null,
      released_at: new Date().toISOString(),
      // Sec. 10 already approved it by operation of law; record when that
      // happened rather than pretending the release was on time.
      deemed_approved_at: state.deemedApproved ? (req.deemed_approved_at || req.due_at) : req.deemed_approved_at,
    }, 'Released')
  }

  function deny(req) {
    // Sec. 10 requires a denial to be in writing and to state the reason.
    patch(req, {
      status: 'denied',
      handled_by: profile?.id ?? null,
      released_at: new Date().toISOString(),
      denial_reason: reason.trim(),
    }, 'Denied, with the reason recorded')
  }

  /** Sec. 9(b)(1): the processing time may be extended once, for the same
   *  number of days. Once used, there is no second extension — which is why
   *  the button disappears rather than staying available and failing. */
  function extend(req) {
    if (req.extended || !reason.trim()) return
    const newDue = workingDeadline(new Date(req.due_at), req.processing_days)
    patch(req, {
      extended: true,
      extension_reason: reason.trim(),
      due_at: newDue.toISOString(),
    }, `Extended to ${formatDeadline(newDue)}`)
  }

  return (
    <div className="space-y-4">

      <div className="white-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))' }}>
            <FileCheck2 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800">Document Requests</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Sorted by deadline — the request with the least time left is at the top.
            </p>
            <div className="flex items-start gap-1.5 mt-2">
              <Scale size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong style={{ color: 'var(--brand)' }}>RA 11032, Secs. 9(b)(1) and 10</strong> — a simple
                transaction must be acted on within <strong>3 working days</strong> (7 for complex,
                20 for highly technical), extendable once. If the deadline passes with no decision,
                the request is <strong>deemed approved</strong> by operation of law.
              </p>
            </div>
          </div>
        </div>
      </div>

      {counts.breach > 0 && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertOctagon size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-xs text-red-800 leading-relaxed">
            <strong>{counts.breach}</strong> request{counts.breach === 1 ? ' has' : 's have'} passed
            the RA 11032 deadline and {counts.breach === 1 ? 'is' : 'are'} deemed approved under
            Sec. 10. Release {counts.breach === 1 ? 'it' : 'them'} now — the acknowledgement receipt
            already carries the same force as the document itself.
          </p>
        </div>
      )}

      <RecordListToolbar search={search} onSearchChange={setSearch} searchLabel="Search document requests"
        placeholder="Reference, document, requester, or purpose…" noun="Document requests"
        filters={[{ value: 'all', label: 'All', count: requests.length }, { value: 'open', label: 'Open', count: counts.open }, { value: 'done', label: 'Closed', count: counts.done }]}
        value={tab} onFilterChange={setTab} shown={shown.length} total={requests.length} onReset={resetFilters}
        sortHint={tab === 'open' ? 'Open requests: soonest deadline first.' : tab === 'done' ? 'Released and denied requests: most recently closed first.' : 'All requests: newest first.'} />

      {shown.length === 0 ? (
        <RecordListEmpty total={requests.length} search={search} noun="document requests" filterLabel={tab === 'open' ? 'Open' : tab === 'done' ? 'Closed' : 'All'} icon={FileCheck2} onReset={resetFilters} description="Document requests submitted to your barangay will appear here for processing." />
      ) : (
        <div className="space-y-2">
          {shown.map(req => {
            const doc = DOCUMENT_TYPES[req.document_type]
            const st = DOC_STATUS_STYLE[req.status] || DOC_STATUS_STYLE.pending
            const state = deadlineState(req)
            const dl = DEADLINE_STYLE[state.level]
            const busy = working === req.id

            return (
              <div key={req.id} className="white-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: doc?.bg || '#f9fafb' }}>
                    <span aria-hidden="true">{doc?.icon || '📄'}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-800 text-sm">{doc?.label || req.document_type}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {state.label && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: dl.bg, color: dl.color, border: `1px solid ${dl.border}` }}>
                          {state.label}
                        </span>
                      )}
                      {req.extended && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                          Extended once
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-xs mt-1" style={{ color: 'var(--brand)' }}>
                      {req.reference_code}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>{req.profiles?.full_name || 'Unknown requester'}</strong> · {req.purpose}
                    </p>
                    {req.notes && <p className="text-xs text-gray-500 mt-0.5">{req.notes}</p>}

                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock size={11} className="flex-shrink-0" style={{ color: dl.color }} />
                      <p className="text-xs" style={{ color: dl.color }}>
                        Due {formatDeadline(req.due_at)}
                        <span className="text-gray-500">
                          {' · '}{req.processing_days} working day{req.processing_days === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-start gap-1.5 mt-1">
                      <Scale size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
                      <p className="text-xs text-gray-500 leading-relaxed">{req.legal_basis}</p>
                    </div>

                    {req.extension_reason && (
                      <p className="text-xs text-gray-500 mt-1">
                        <strong>Extension:</strong> {req.extension_reason}
                      </p>
                    )}
                    {req.denial_reason && (
                      <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: '#fef2f2', color: '#b91c1c' }}>
                        <strong>Denied:</strong> {req.denial_reason}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mt-1.5" title={fullDate(req.created_at)}>
                      Filed {timeAgo(req.created_at)}
                      {req.released_at && ` · closed ${timeAgo(req.released_at)}`}
                    </p>
                  </div>
                </div>

                {extending === req.id ? (
                  <div className="mt-3 space-y-2">
                    <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
                      style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e' }}>
                      RA 11032 Sec. 9(b)(1) allows <strong>one</strong> extension, for the same number
                      of days. This moves the deadline to{' '}
                      <strong>{formatDeadline(workingDeadline(new Date(req.due_at), req.processing_days))}</strong>,
                      and cannot be done again.
                    </div>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                      aria-label="Reason for the extension"
                      placeholder="Why does this need longer? The requester will see this."
                      className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800" />
                    <div className="flex gap-2">
                      <button onClick={() => extend(req)} disabled={busy || !reason.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Timer size={13} />}
                        Confirm the one extension
                      </button>
                      <button onClick={() => { setExtending(null); setReason('') }}
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold"
                        style={{ background: 'var(--app-surface)', color: '#6b7280', border: '1px solid var(--brand-soft)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : denying === req.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                      aria-label="Reason for denial"
                      placeholder="RA 11032 requires a denial to state its reason in writing."
                      className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800" />
                    <div className="flex gap-2">
                      <button onClick={() => deny(req)} disabled={busy || !reason.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Confirm denial
                      </button>
                      <button onClick={() => { setDenying(null); setReason('') }}
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold"
                        style={{ background: 'var(--app-surface)', color: '#6b7280', border: '1px solid var(--brand-soft)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : !state.decided && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {req.status === 'pending' && (
                      <button onClick={() => claim(req)} disabled={busy}
                        className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Timer size={13} />}
                        Start processing
                      </button>
                    )}
                    {req.status === 'processing' && (
                      <button onClick={() => markReady(req)} disabled={busy}
                        className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Mark ready
                      </button>
                    )}
                    <button onClick={() => release(req)} disabled={busy}
                      className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                      <CheckCircle2 size={13} /> Release
                    </button>
                    <button onClick={() => { setDenying(req.id); setReason('') }} disabled={busy}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <XCircle size={13} /> Deny
                    </button>
                    {!req.extended && !state.deemedApproved && (
                      <button onClick={() => { setExtending(req.id); setReason('') }} disabled={busy}
                        title="RA 11032 Sec. 9(b)(1) — one extension only"
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                        style={{ background: 'var(--app-surface)', color: '#6b7280', border: '1px solid var(--brand-soft)' }}>
                        Extend once
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
