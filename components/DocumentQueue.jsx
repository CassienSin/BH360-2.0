'use client'
import { useState, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { fullDate } from '@/lib/timeAgo'
import { DOCUMENT_TYPES, deadlineState, formatDeadline, workingDeadline } from '@/lib/documents'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { SearchBox, FilterSelect, RowMenu } from '@/components/official/Toolbar'

// The status tabs (O05). Closed holds released and denied requests.
const TABS = [
  { value: 'pending', label: 'New', empty: 'new' },
  { value: 'processing', label: 'Processing', empty: 'processing' },
  { value: 'ready', label: 'Ready', empty: 'ready for pickup' },
  { value: 'done', label: 'Closed', empty: 'closed yet' },
]
const isOpen = r => !['released', 'denied'].includes(r.status)

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
  // Start on the earliest stage that has work in it.
  const [tab, setTab] = useState(() =>
    ['pending', 'processing', 'ready'].find(s => requests.some(r => r.status === s)) || 'pending')
  const [docType, setDocType] = useState('all')
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
      pending: requests.filter(r => r.status === 'pending').length,
      processing: requests.filter(r => r.status === 'processing').length,
      ready: requests.filter(r => r.status === 'ready').length,
      done: requests.length - open.length,
    }
  }, [requests])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests
      .filter(r => (tab === 'done' ? !isOpen(r) : r.status === tab))
      .filter(r => docType === 'all' || r.document_type === docType)
      .filter(r => !q ||
        r.reference_code?.toLowerCase().includes(q) ||
        r.purpose?.toLowerCase().includes(q) ||
        DOCUMENT_TYPES[r.document_type]?.label.toLowerCase().includes(q) ||
        r.profiles?.full_name?.toLowerCase().includes(q))
      // Soonest deadline first for open work; most recently decided first
      // once it is finished.
      .sort((a, b) => (tab !== 'done'
        ? new Date(a.due_at) - new Date(b.due_at)
        : new Date(b.released_at || b.created_at) - new Date(a.released_at || a.created_at)))
  }, [requests, tab, search, docType])

  function resetFilters() { setSearch(''); setDocType('all') }

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

  // The one action that moves a request along, by status (the rest sit in
  // the row's menu). Red when the request is already past its deadline.
  function primaryFor(req, state) {
    const tone = state.deemedApproved ? 'danger' : 'primary'
    if (req.status === 'pending') return { label: 'Start processing', run: () => claim(req), variant: tone }
    if (req.status === 'processing') return { label: 'Mark ready', run: () => markReady(req), variant: tone }
    if (req.status === 'ready') return { label: 'Release', run: () => release(req), variant: tone }
    return null
  }

  function menuFor(req, state) {
    if (state.decided) return []
    return [
      req.status !== 'ready' && { label: 'Release now', onClick: () => release(req) },
      !req.extended && !state.deemedApproved && { label: 'Extend once', onClick: () => { setDenying(null); setExtending(req.id); setReason('') } },
      { label: 'Deny, with a reason', danger: true, onClick: () => { setExtending(null); setDenying(req.id); setReason('') } },
    ]
  }

  /** Where a request stands against its deadline, as a status line. */
  function deadlineLine(req, state) {
    if (req.status === 'denied') return { label: 'Denied', tone: 'quiet' }
    if (req.status === 'released') return { label: state.level === 'late' ? 'Released late' : 'Released', tone: state.level === 'late' ? 'warn' : 'quiet' }
    if (state.deemedApproved) return { label: 'Past the deadline', tone: 'danger' }
    return { label: state.label || `Due ${formatDeadline(req.due_at)}`, tone: state.level === 'due' ? 'warn' : 'quiet' }
  }

  // Deny and Extend need a written reason (RA 11032, Secs. 9 and 10): the
  // form opens under the request it is for.
  function reasonForm(req) {
    const busy = working === req.id
    if (extending === req.id) {
      return (
        <div className="space-y-2.5">
          <Notice tone="warn">
            RA 11032 Sec. 9(b)(1) allows <strong>one</strong> extension, for the same number of days. This moves the deadline to{' '}
            <strong>{formatDeadline(workingDeadline(new Date(req.due_at), req.processing_days))}</strong>, and cannot be done again.
          </Notice>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} aria-label="Reason for the extension"
            placeholder="Why does this need longer? The requester will see this." />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setExtending(null); setReason('') }}>Cancel</Button>
            <Button onClick={() => extend(req)} disabled={busy || !reason.trim()} aria-busy={busy || undefined}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}Extend once
            </Button>
          </div>
        </div>
      )
    }
    if (denying === req.id) {
      return (
        <div className="space-y-2.5">
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} aria-label="Reason for denial"
            placeholder="RA 11032 requires a denial to state its reason in writing." />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setDenying(null); setReason('') }}>Cancel</Button>
            <Button variant="danger" onClick={() => deny(req)} disabled={busy || !reason.trim()} aria-busy={busy || undefined}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}Deny the request
            </Button>
          </div>
        </div>
      )
    }
    return null
  }

  const requested = at => new Date(at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const subOf = req => [req.reference_code, req.purpose, req.extended && 'extended once'].filter(Boolean).join(' · ')

  return (
    <div className="@container flex flex-col gap-3.5">
      {counts.breach > 0 && (
        <Notice tone="danger" title={`${counts.breach} request${counts.breach === 1 ? ' is' : 's are'} past the RA 11032 deadline.`}>
          Under Sec. 10 {counts.breach === 1 ? 'it is' : 'they are'} deemed approved. Release {counts.breach === 1 ? 'it' : 'them'} now: the acknowledgement receipt already has the same force as the document.
        </Notice>
      )}

      <Card className="!overflow-visible">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
          <Segmented label="Filter by status" value={tab} onChange={setTab}
            items={TABS.map(t => ({ value: t.value, label: t.label, count: t.value === 'done' ? undefined : counts[t.value] }))}
            className="w-full @3xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
          <SearchBox value={search} onChange={setSearch} label="Search document requests" placeholder="Search requests" className="min-w-48 flex-1 @5xl:max-w-64" />
          <FilterSelect label="Document" value={docType} onChange={setDocType} className="@3xl:ml-auto"
            options={[{ value: 'all', label: 'All documents' }, ...Object.entries(DOCUMENT_TYPES)
              .filter(([key]) => requests.some(r => r.document_type === key) || docType === key)
              .map(([key, d]) => ({ value: key, label: d.label }))]} />
        </div>

        {shown.length === 0 ? (
          <div className="border-t border-line px-[18px] py-6">
            <p className="text-sm font-bold text-ink">{requests.length === 0 ? 'No document requests yet' : search || docType !== 'all' ? 'Nothing matches' : `Nothing ${TABS.find(t => t.value === tab)?.empty}`}</p>
            <Muted className="mt-1">{requests.length === 0 ? 'Clearances and certificates residents request show up here.' : 'Try another tab or clear the search.'}</Muted>
            {(search || docType !== 'all') && <Button variant="secondary" size="sm" className="mt-3" onClick={resetFilters}>Clear filters</Button>}
          </div>
        ) : (
          <>
            {/* Wide: the table (O05). */}
            <table className="hidden w-full table-fixed border-collapse text-left @3xl:table">
              <thead>
                <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                  <th scope="col" className="py-2.5 pl-[18px] font-bold">Request</th>
                  <th scope="col" className="w-[22%] px-3 py-2.5 font-bold">Resident</th>
                  <th scope="col" className="w-[17%] px-3 py-2.5 font-bold">Deadline</th>
                  <th scope="col" className="hidden w-[15%] px-3 py-2.5 font-bold @5xl:table-cell">Requested</th>
                  <th scope="col" className="w-[188px] py-2.5 pr-[18px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(req => {
                  const doc = DOCUMENT_TYPES[req.document_type]
                  const state = deadlineState(req)
                  const line = deadlineLine(req, state)
                  const primary = primaryFor(req, state)
                  const form = reasonForm(req)
                  return (
                    <Fragment key={req.id}>
                      <tr className={`border-t border-line ${state.deemedApproved ? 'bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))]' : ''}`}>
                        <td className="min-w-0 py-3 pl-[18px]">
                          <p className="truncate text-sm font-bold text-ink">{doc?.label || req.document_type}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subOf(req)}</p>
                          {req.denial_reason && <p className="mt-0.5 truncate text-xs text-danger" title={req.denial_reason}>Denied: {req.denial_reason}</p>}
                        </td>
                        <td className="px-3 py-3"><p className="truncate text-sm font-bold text-ink">{req.profiles?.full_name || 'Unknown requester'}</p></td>
                        <td className="px-3 py-3"><Status tone={line.tone} className="max-w-full" title={req.legal_basis || undefined}>{line.label}</Status></td>
                        <td className="hidden px-3 py-3 text-[13px] text-body @5xl:table-cell" title={fullDate(req.created_at)}>{requested(req.created_at)}</td>
                        <td className="py-3 pr-[18px]">
                          <div className="flex items-center justify-end gap-1.5">
                            {primary && (
                              <Button size="sm" variant={primary.variant} onClick={primary.run} disabled={working === req.id}>
                                {working === req.id && <Loader2 className="animate-spin" aria-hidden="true" />}{primary.label}
                              </Button>
                            )}
                            <RowMenu label={`More for ${doc?.label || 'this request'}`} items={menuFor(req, state)} />
                          </div>
                        </td>
                      </tr>
                      {form && <tr><td colSpan={5} className="px-[18px] pb-3.5">{form}</td></tr>}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* Narrow: one row per request. */}
            <Rows className="border-t border-line @3xl:hidden">
              {shown.map(req => {
                const doc = DOCUMENT_TYPES[req.document_type]
                const state = deadlineState(req)
                const line = deadlineLine(req, state)
                const primary = primaryFor(req, state)
                const form = reasonForm(req)
                return (
                  <Row key={req.id} critical={state.deemedApproved} className="space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{doc?.label || req.document_type}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{req.profiles?.full_name || 'Unknown requester'} · {subOf(req)}</p>
                        <Status tone={line.tone} className="mt-1.5">{line.label}</Status>
                      </div>
                      <RowMenu label={`More for ${doc?.label || 'this request'}`} items={menuFor(req, state)} />
                    </div>
                    {primary && !form && (
                      <Button variant={primary.variant} className="w-full" onClick={primary.run} disabled={working === req.id}>
                        {working === req.id && <Loader2 className="animate-spin" aria-hidden="true" />}{primary.label}
                      </Button>
                    )}
                    {form}
                  </Row>
                )
              })}
            </Rows>
          </>
        )}

        <p className="border-t border-line px-3.5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-[18px]">
          Deadlines come from the Citizen&rsquo;s Charter under RA 11032, Secs. 9(b)(1) and 10: 3 working days for a simple request, 7 for a complex one, 20 for a highly technical one, extendable once. With no decision by then, a request is deemed approved.
        </p>
      </Card>
    </div>
  )
}
