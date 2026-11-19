'use client'
import { useState, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import {
  X, Plus, Loader2, Gavel, ShieldAlert, Users, Clock,
  FileCheck2, ArrowRightCircle, Handshake,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import { timeAgo } from '@/lib/timeAgo'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { SearchBox } from '@/components/official/Toolbar'
import {
  KP_EXCLUSIONS, CATEGORY_KP_HINTS, CASE_STATUS,
  assessEligibility, stageDeadline, availableActions, isOpen,
  summonDeadline, mediationDeadline, pangkatDeadline,
} from '@/lib/katarungan'
import { getCategoryMeta } from '@/lib/legalBasis'

const NATURES = [
  'Boundary or property dispute', 'Unpaid debt', 'Damage to property',
  'Slander or defamation', 'Physical injuries', 'Noise or nuisance',
  'Family or neighbour quarrel', 'Breach of agreement', 'Other',
]

/** Each action that closes or advances a stage, and what it needs from the official. */
const ACTION_META = {
  record_first_meeting: { label: 'Record first meeting', icon: Users, tone: 'primary', prompt: null },
  constitute_pangkat:   { label: 'Constitute Pangkat', icon: Gavel, tone: 'primary', prompt: null },
  extend_pangkat:       { label: 'Extend once', icon: Clock, tone: 'muted', prompt: null,
                          confirm: 'RA 7160 Sec. 410(e) allows ONE extension of up to 15 days. This cannot be undone.' },
  settle:               { label: 'Record settlement', icon: Handshake, tone: 'good',
                          prompt: 'Terms of the amicable settlement', required: true },
  issue_cfa:            { label: 'Issue CFA', icon: FileCheck2, tone: 'danger',
                          prompt: 'Why did conciliation fail? Sec. 412 requires this on the certificate.', required: true },
  repudiate:            { label: 'Record repudiation', icon: ShieldAlert, tone: 'warn',
                          prompt: 'Ground for repudiation — fraud, violence or intimidation (Sec. 418)', required: true },
  refer:                { label: 'Refer onward', icon: ArrowRightCircle, tone: 'muted',
                          prompt: 'Referred to which office?', required: true },
  withdraw:             { label: 'Withdraw', icon: X, tone: 'muted',
                          prompt: 'Reason for withdrawal', required: false },
}

// The stage as a tag (O07).
const STAGE_TONE = {
  filed: 'quiet', mediation: 'brand', pangkat: 'warn', settled: 'ok',
  repudiated: 'warn', cfa_issued: 'danger', referred: 'quiet', withdrawn: 'quiet',
}

// The Katarungang Pambarangay steps, for the card under the docket.
const KP_STEPS = [
  ['Summons', 'The respondent is summoned by the next working day after filing (Sec. 410(b)).'],
  ['Mediation', 'The Punong Barangay has 15 days from the first meeting (Sec. 410(b)).'],
  ['Conciliation', 'The Pangkat has 15 days, extendable once by 15 (Sec. 410(e)).'],
  ['Settlement or CFA', 'A settlement is final after 10 days unless repudiated (Secs. 416, 418); otherwise a Certificate to File Action (Sec. 412).'],
]

/**
 * The Lupon's docket.
 *
 * Ordered by deadline, because Katarungang Pambarangay is a clock the
 * barangay is answerable to: Sec. 410 gives it a working day to summon and
 * 15 days to mediate, and Sec. 412 turns the whole thing into a precondition
 * the courts will check.
 */
export default function BlotterQueue({ profile, cases, incidents = [], residents = [], onChanged, filing, onFilingChange }) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(null)
  const [pending, setPending] = useState(null)   // { caseId, action }
  const [note, setNote] = useState('')
  // The filing form can be opened from the band (the page passes `filing`)
  // or from the toolbar on phones.
  const [filingLocal, setFilingLocal] = useState(false)
  const [openId, setOpenId] = useState(null)       // the case whose record is open
  const [confirmation, setConfirmation] = useState(null)

  const counts = useMemo(() => {
    const open = cases.filter(isOpen)
    return {
      open: open.length,
      breach: open.filter(c => stageDeadline(c).level === 'breach').length,
      closed: cases.length - open.length,
    }
  }, [cases])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cases
      .filter(c => tab === 'all' || (tab === 'open' ? isOpen(c) : !isOpen(c)))
      .filter(c => !q ||
        c.case_number?.toLowerCase().includes(q) ||
        c.complainant_name?.toLowerCase().includes(q) ||
        c.respondent_name?.toLowerCase().includes(q) ||
        c.nature?.toLowerCase().includes(q))
      .sort((a, b) => {
        if (tab !== 'open') return new Date(b.filed_at) - new Date(a.filed_at)
        const da = stageDeadline(a).dueAt, db = stageDeadline(b).dueAt
        if (da && db) return new Date(da) - new Date(db)
        return da ? -1 : db ? 1 : 0
      })
  }, [cases, tab, search])

  function resetFilters() { setSearch('') }

  async function patch(kase, changes, message) {
    if (working) return false
    setWorking(kase.id)
    try {
      const { error } = await supabase.from('blotter_cases').update(changes).eq('id', kase.id)
      if (error) { toast.error(error.message); return false }
      onChanged?.(kase.id, changes)
      setPending(null)
      setNote('')
      toast.success(message)
      return true
    } catch (error) {
      console.error('Could not update case:', error)
      toast.error('Could not update this case. Check its status before trying again.')
      return false
    } finally {
      setWorking(null)
    }
  }

  function runAction(kase, action) {
    const now = new Date().toISOString()
    const text = note.trim()

    switch (action) {
      case 'record_first_meeting':
        return patch(kase, {
          status: 'mediation',
          first_meeting_at: now,
          mediation_due_at: mediationDeadline(now).toISOString(),
        }, 'Mediation started — 15 days from today (Sec. 410(b))')
      case 'constitute_pangkat':
        return patch(kase, {
          status: 'pangkat',
          pangkat_convened_at: now,
          pangkat_due_at: pangkatDeadline(now).toISOString(),
        }, 'Pangkat convened — 15 days (Sec. 410(e))')
      case 'extend_pangkat':
        return patch(kase, {
          pangkat_extended: true,
          pangkat_due_at: pangkatDeadline(kase.pangkat_convened_at, true).toISOString(),
        }, 'Extended once, as Sec. 410(e) allows')
      case 'settle':
        return patch(kase, { status: 'settled', settled_at: now, settlement_terms: text },
          'Settlement recorded — final after 10 days unless repudiated (Sec. 416)')
      case 'issue_cfa':
        return patch(kase, { status: 'cfa_issued', cfa_issued_at: now, cfa_reason: text },
          'Certificate to File Action issued (Sec. 412)')
      case 'repudiate':
        return patch(kase, { status: 'repudiated', repudiated_at: now, repudiation_reason: text },
          'Repudiation recorded (Sec. 418)')
      case 'refer':
        return patch(kase, { status: 'referred', referred_to: text }, 'Referred onward')
      case 'withdraw':
        return patch(kase, { status: 'withdrawn', withdrawn_reason: text || null }, 'Case withdrawn')
      default:
        return undefined
    }
  }

  function startAction(kase, action) {
    const meta = ACTION_META[action]
    if (meta.confirm) { setConfirmation({ caseId: kase.id, action }); return }
    if (meta.prompt) { setPending({ caseId: kase.id, action }); setNote(''); return }
    runAction(kase, action)
  }

  const filingOpen = filing ?? filingLocal
  const setFilingOpen = v => (onFilingChange ? onFilingChange(v) : setFilingLocal(v))

  /** Where a case stands against its clock, as a status line. */
  function deadlineLine(kase) {
    const d = stageDeadline(kase)
    if (!isOpen(kase)) return { label: (CASE_STATUS[kase.status] || CASE_STATUS.filed).label, tone: 'quiet' }
    if (d.level === 'breach') return { label: `Overdue ${Math.abs(d.daysLeft)} day${Math.abs(d.daysLeft) === 1 ? '' : 's'}`, tone: 'danger' }
    if (!d.label) return { label: 'No clock running', tone: 'quiet' }
    const left = d.daysLeft === 0 ? 'due today' : `${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'} left`
    return { label: kase.status === 'filed' ? `Summons ${left}` : left[0].toUpperCase() + left.slice(1), tone: d.level === 'due' ? 'warn' : 'quiet' }
  }

  const filedOn = at => new Date(at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

  // The case record and its actions, under the row it belongs to.
  function detail(kase) {
    const actions = availableActions(kase)
    const busy = working === kase.id
    const isPending = pending?.caseId === kase.id
    const meta = isPending ? ACTION_META[pending.action] : null
    const d = stageDeadline(kase)
    return (
      <div className="space-y-3 rounded-[12px] border border-line bg-surface-sunk px-4 py-3.5">
        {kase.description && <p className="text-sm leading-relaxed text-body">{kase.description}</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {(CASE_STATUS[kase.status] || CASE_STATUS.filed).desc}.{d.label ? ` ${d.label}${d.dueAt ? `: ${filedOn(d.dueAt)}` : ''}${d.citation ? ` (${d.citation})` : ''}.` : ''}
          {' '}Filed {filedOn(kase.filed_at)}.{kase.legal_basis ? ` ${kase.legal_basis}` : ''}
        </p>
        {kase.prohibited && <Notice tone="danger" title="This case must not be mediated.">RA 7160, Sec. 408 excludes it from the Lupon. Refer it onward.</Notice>}
        {kase.settlement_terms && <Notice tone="ok" title="Settled">{kase.settlement_terms}</Notice>}
        {kase.repudiation_reason && <Notice tone="warn" title="Repudiated">{kase.repudiation_reason}</Notice>}
        {kase.cfa_reason && <Notice tone="danger" title="Certificate to File Action">{kase.cfa_reason}</Notice>}
        {kase.referred_to && <p className="text-sm text-body"><strong className="text-ink">Referred to:</strong> {kase.referred_to}</p>}

        {isPending ? (
          <div className="space-y-2.5">
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} aria-label={meta.label} placeholder={meta.prompt} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setPending(null); setNote('') }}>Cancel</Button>
              <Button variant={meta.tone === 'danger' ? 'danger' : 'primary'} onClick={() => runAction(kase, pending.action)}
                disabled={busy || (meta.required && !note.trim())} aria-busy={busy || undefined}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}{meta.label}
              </Button>
            </div>
          </div>
        ) : actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, i) => {
              const m = ACTION_META[action]
              const Icon = m.icon
              return (
                <Button key={action} size="sm" disabled={busy} onClick={() => startAction(kase, action)}
                  variant={i === 0 && (m.tone === 'primary' || m.tone === 'good') ? 'primary' : m.tone === 'danger' ? 'danger' : 'secondary'}>
                  <Icon aria-hidden="true" />{m.label}
                </Button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const toggle = id => { setOpenId(o => (o === id ? null : id)); setPending(null); setNote('') }

  return (
    <div className="@container flex flex-col gap-3.5">
      <ConfirmDialog open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        title="Extend this case once?"
        message={confirmation ? `${cases.find(item => item.id === confirmation.caseId)?.case_number || 'Selected case'}: ${ACTION_META[confirmation.action].confirm}` : ''}
        confirmText="Confirm extension" cancelText="Keep current deadline" variant="warning"
        loadingText="Saving extension…"
        onConfirm={async () => {
          const current = cases.find(item => item.id === confirmation.caseId)
          if (!current || !availableActions(current).includes(confirmation.action)) {
            toast.error('This case has changed. Review its current status before continuing.')
            setConfirmation(null)
            return
          }
          if (await runAction(current, confirmation.action)) setConfirmation(null)
        }} />

      {counts.breach > 0 && (
        <Notice tone="danger" title={`${counts.breach} case${counts.breach === 1 ? ' is' : 's are'} past the period RA 7160 allows.`}>
          A lapsed period does not end the Lupon&rsquo;s duty; it means the parties have waited longer than the law intends.
        </Notice>
      )}

      {filingOpen && (
        <FileComplaint
          profile={profile}
          incidents={incidents}
          residents={residents}
          onCancel={() => setFilingOpen(false)}
          onDone={(created) => { setFilingOpen(false); onChanged?.(created?.id, created, 'created') }}
        />
      )}

      <Card className="!overflow-visible">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
          <Segmented label="Filter by stage" value={tab} onChange={v => { setTab(v); setOpenId(null) }}
            items={[{ value: 'open', label: 'Open', count: counts.open }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
          <SearchBox value={search} onChange={setSearch} label="Search blotter cases" placeholder="Search cases" className="min-w-48 flex-1 @5xl:max-w-64" />
          {!filingOpen && (
            <Button variant="secondary" className="h-9 desk:hidden" onClick={() => setFilingOpen(true)}>
              <Plus aria-hidden="true" />File a complaint
            </Button>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="border-t border-line px-[18px] py-6">
            <p className="text-sm font-bold text-ink">{cases.length === 0 ? 'No cases yet' : search ? 'Nothing matches' : tab === 'open' ? 'No open cases' : 'Nothing here'}</p>
            <Muted className="mt-1">{cases.length === 0 ? 'Complaints the secretary records show up here, oldest deadline first.' : 'Try another tab or clear the search.'}</Muted>
            {search && <Button variant="secondary" size="sm" className="mt-3" onClick={resetFilters}>Clear search</Button>}
          </div>
        ) : (
          <>
            {/* Wide: the docket as a table (O07); a row opens its record. */}
            <table className="hidden w-full table-fixed border-collapse text-left @3xl:table">
              <thead>
                <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                  <th scope="col" className="w-[150px] py-2.5 pl-[18px] font-bold">Case</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Parties</th>
                  <th scope="col" className="w-[130px] px-3 py-2.5 font-bold">Stage</th>
                  <th scope="col" className="w-[170px] px-3 py-2.5 font-bold">Deadline</th>
                  <th scope="col" className="hidden w-[130px] px-3 py-2.5 font-bold @5xl:table-cell">Filed</th>
                  <th scope="col" className="w-[96px] py-2.5 pr-[18px]"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(kase => {
                  const st = CASE_STATUS[kase.status] || CASE_STATUS.filed
                  const line = deadlineLine(kase)
                  const open = openId === kase.id
                  return (
                    <Fragment key={kase.id}>
                      <tr onClick={() => toggle(kase.id)}
                        className={`cursor-pointer border-t border-line transition-colors hover:bg-surface-sunk ${line.tone === 'danger' ? 'bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))]' : ''}`}>
                        <td className="py-3 pl-[18px] font-mono text-[13px] font-bold text-muted-foreground">{kase.case_number}</td>
                        <td className="min-w-0 px-3 py-3">
                          <p className="truncate text-sm font-bold text-ink">{kase.complainant_name} v. {kase.respondent_name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{kase.nature}</p>
                        </td>
                        <td className="px-3 py-3"><Tag tone={STAGE_TONE[kase.status] || 'quiet'}>{st.label}</Tag></td>
                        <td className="px-3 py-3"><Status tone={line.tone} className="max-w-full">{line.label}</Status></td>
                        <td className="hidden px-3 py-3 text-[13px] text-body @5xl:table-cell">{filedOn(kase.filed_at)}</td>
                        <td className="py-3 pr-[18px] text-right">
                          <Button size="sm" variant="secondary" aria-expanded={open} onClick={e => { e.stopPropagation(); toggle(kase.id) }}>
                            {open ? 'Close' : 'Open'}
                          </Button>
                        </td>
                      </tr>
                      {open && <tr><td colSpan={6} className="px-[18px] pb-3.5">{detail(kase)}</td></tr>}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* Narrow: one row per case; tap to open its record. */}
            <Rows className="border-t border-line @3xl:hidden">
              {shown.map(kase => {
                const st = CASE_STATUS[kase.status] || CASE_STATUS.filed
                const line = deadlineLine(kase)
                const open = openId === kase.id
                return (
                  <Row key={kase.id} critical={line.tone === 'danger'} className="space-y-2.5">
                    <button type="button" onClick={() => toggle(kase.id)} aria-expanded={open} className="block w-full text-left outline-none focus-visible:underline">
                      <span className="block truncate text-sm font-bold text-ink">{kase.complainant_name} v. {kase.respondent_name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{kase.case_number} · {kase.nature}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Tag tone={STAGE_TONE[kase.status] || 'quiet'}>{st.label}</Tag>
                        <Status tone={line.tone}>{line.label}</Status>
                      </span>
                    </button>
                    {open && detail(kase)}
                  </Row>
                )
              })}
            </Rows>
          </>
        )}
      </Card>

      {/* The law the docket runs on (RA 7160, Secs. 410 to 418). */}
      <Card>
        <CardHead title="Katarungang Pambarangay timeline" action={<span className="text-xs text-muted-foreground">RA 7160, Secs. 410 to 418</span>} />
        <ol className="grid border-t border-line sm:grid-cols-2 xl:grid-cols-4">
          {KP_STEPS.map(([title, body], i) => (
            <li key={title} className="border-line px-[18px] py-3 not-first:border-t sm:not-first:border-t-0 sm:[&:nth-child(n+3)]:border-t sm:even:border-l xl:[&:nth-child(n+3)]:border-t-0 xl:not-first:border-l">
              <p className="flex items-center gap-2 text-[13px] font-extrabold text-brand-strong">
                <span className="flex size-[22px] items-center justify-center rounded-full bg-brand-soft text-xs">{i + 1}</span>{title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">{body}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

/**
 * Taking a complaint.
 *
 * The Sec. 408 checklist is answered by the person in front of the
 * complainant, not inferred, because every exception turns on facts only
 * they know — where the parties live, who they work for, what the dispute is
 * worth. The assessment updates live so the consequence of a tick is visible
 * before the case is filed.
 */
function FileComplaint({ profile, incidents, residents, onDone, onCancel }) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    incident_id: '', complainant_id: '', complainant_name: '', complainant_address: '',
    complainant_phone: '', respondent_name: '', respondent_address: '',
    nature: NATURES[0], description: '',
  })
  const [exclusions, setExclusions] = useState([])

  const linked = incidents.find(i => i.id === form.incident_id) || null
  const hint = linked ? CATEGORY_KP_HINTS[linked.category] : null
  const assessment = assessEligibility(exclusions)

  function toggle(key) {
    setExclusions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function pickComplainant(id) {
    const r = residents.find(x => x.id === id)
    setForm(f => ({
      ...f,
      complainant_id: id,
      complainant_name: r ? r.full_name : f.complainant_name,
      complainant_address: r?.address || f.complainant_address,
      complainant_phone: r?.phone || f.complainant_phone,
    }))
  }

  function pickIncident(id) {
    const inc = incidents.find(i => i.id === id)
    setForm(f => ({
      ...f,
      incident_id: id,
      description: inc && !f.description ? inc.description : f.description,
    }))
    const suggested = inc ? (CATEGORY_KP_HINTS[inc.category]?.suggest || []) : []
    if (suggested.length) setExclusions(prev => [...new Set([...prev, ...suggested])])
  }

  const valid = form.complainant_name.trim() && form.respondent_name.trim() && form.description.trim().length >= 10

  async function submit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    const filedAt = new Date()

    const { data, error } = await supabase.from('blotter_cases').insert({
      barangay_id: profile.barangay_id,
      incident_id: form.incident_id || null,
      complainant_id: form.complainant_id || null,
      complainant_name: form.complainant_name.trim(),
      complainant_address: form.complainant_address.trim() || null,
      complainant_phone: form.complainant_phone.trim() || null,
      respondent_name: form.respondent_name.trim(),
      respondent_address: form.respondent_address.trim() || null,
      nature: form.nature,
      description: form.description.trim(),
      lupon_eligible: assessment.eligible,
      prohibited: assessment.prohibited,
      exclusion_reasons: exclusions,
      legal_basis: assessment.legalBasis,
      // A case the Lupon cannot take is recorded as referred from the start
      // rather than sitting in a queue it can never leave.
      status: assessment.eligible ? 'filed' : 'referred',
      summon_due_at: assessment.eligible ? summonDeadline(filedAt).toISOString() : null,
      recorded_by: profile.id,
    }).select().single()

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Recorded as ${data.case_number}`)
    onDone?.(data)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[14px] border border-line bg-surface px-[18px] py-4 shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold text-ink">File a complaint</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Take it down as the complainant tells it. The Sec. 408 checks decide whether the Lupon can hear it.</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Close the form"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand-strong">
            <X size={18} />
          </button>
        )}
      </div>

      {residents.length > 0 && (
        <div>
          <label htmlFor="kp-complainant-account" className="text-[13px] font-bold text-ink">
            Is the complainant a registered resident?{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select id="kp-complainant-account" value={form.complainant_id}
            onChange={e => pickComplainant(e.target.value)}
            className="mt-2 h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-strong">
            <option value="">Not a registered account — record the name below</option>
            {residents.map(r => (
              <option key={r.id} value={r.id}>{r.full_name}{r.address ? ` · ${r.address}` : ''}</option>
            ))}
          </select>
          {/* Linking the account is what lets the complainant follow their own
              case from their dashboard — the read policy is scoped to it. */}
          <p className="text-xs text-muted-foreground mt-1.5">
            Linking an account lets the complainant follow the case themselves.
          </p>
        </div>
      )}

      {incidents.length > 0 && (
        <div>
          <label htmlFor="kp-incident" className="text-[13px] font-bold text-ink">
            Arising from a reported incident? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select id="kp-incident" value={form.incident_id}
            onChange={e => pickIncident(e.target.value)}
            className="mt-2 h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-strong">
            <option value="">Not linked to an incident</option>
            {incidents.slice(0, 50).map(i => (
              <option key={i.id} value={i.id}>
                {getCategoryMeta(i.category).icon} {i.title} — {timeAgo(i.created_at)}
              </option>
            ))}
          </select>
          {hint?.prompt && (
            <Notice tone="warn" className="mt-2">{hint.prompt}</Notice>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Complainant" required value={form.complainant_name}
          onChange={v => setForm(f => ({ ...f, complainant_name: v }))} />
        <Field label="Respondent" required value={form.respondent_name}
          onChange={v => setForm(f => ({ ...f, respondent_name: v }))} />
        <Field label="Complainant address" value={form.complainant_address}
          onChange={v => setForm(f => ({ ...f, complainant_address: v }))} />
        <Field label="Respondent address" value={form.respondent_address}
          onChange={v => setForm(f => ({ ...f, respondent_address: v }))} />
        <Field label="Complainant phone" value={form.complainant_phone}
          onChange={v => setForm(f => ({ ...f, complainant_phone: v }))} />
        <div>
          <label htmlFor="kp-nature" className="text-[13px] font-bold text-ink">Nature of the dispute</label>
          <select id="kp-nature" value={form.nature}
            onChange={e => setForm(f => ({ ...f, nature: e.target.value }))}
            className="mt-2 h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-strong">
            {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="kp-desc" className="text-[13px] font-bold text-ink">
          What happened?
        </label>
        <textarea id="kp-desc" rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="In the complainant’s own words where possible."
          className="mt-2 w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none focus:border-brand-strong" />
      </div>

      <div>
        <p className="text-[13px] font-bold text-ink">
          Does any of these apply? <span className="font-normal text-muted-foreground">(RA 7160, Sec. 408)</span>
        </p>
        <div className="space-y-1.5 mt-2">
          {Object.entries(KP_EXCLUSIONS).map(([key, x]) => {
            const on = exclusions.includes(key)
            return (
              <label key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-2.5 transition-colors ${on ? (x.prohibited ? 'border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-danger-soft' : 'border-[color-mix(in_srgb,var(--warn)_35%,var(--line))] bg-warn-soft') : 'border-line bg-surface hover:border-line-strong'}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(key)} className="mt-0.5 size-4 accent-[var(--brand-strong)]" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{x.label}</span>
                  {x.help && <span className="mt-0.5 block text-xs text-body">{x.help}</span>}
                  <span className="mt-0.5 block text-xs font-bold text-brand-strong">{x.citation}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <Notice tone={assessment.prohibited ? 'danger' : assessment.eligible ? 'ok' : 'warn'} title={assessment.summary}>
        {assessment.blocking.map(b => (
          <span key={b.key} className="mt-1 block">
            <strong>{b.citation}</strong>: {b.label}
            {b.consequence && <span className="mt-0.5 block">{b.consequence}</span>}
          </span>
        ))}
      </Notice>

      <div className="flex flex-wrap gap-2.5">
        {onCancel && <Button type="button" variant="secondary" size="lg" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" size="lg" className="flex-1" disabled={!valid || saving} aria-busy={saving || undefined}>
          {saving ? 'Recording…' : assessment.eligible ? 'File with the Lupon' : 'Record and refer'}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, required }) {
  const id = `kp-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-bold text-ink">
        {label}{!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)}
        className="mt-2 h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-strong" />
    </div>
  )
}
