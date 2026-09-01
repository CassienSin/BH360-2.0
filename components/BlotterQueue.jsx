'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Scale, Search, X, Plus, Loader2, Gavel, ShieldAlert, Users, Clock,
  FileCheck2, ArrowRightCircle, Handshake,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import {
  KP_EXCLUSIONS, CATEGORY_KP_HINTS, CASE_STATUS, KP_DEADLINE_STYLE,
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

const TONE = {
  primary: { background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: 'white', border: 'none' },
  good:    { background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white', border: 'none' },
  danger:  { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  warn:    { background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7' },
  muted:   { background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' },
}

/**
 * The Lupon's docket.
 *
 * Ordered by deadline, because Katarungang Pambarangay is a clock the
 * barangay is answerable to: Sec. 410 gives it a working day to summon and
 * 15 days to mediate, and Sec. 412 turns the whole thing into a precondition
 * the courts will check.
 */
export default function BlotterQueue({ profile, cases, incidents = [], residents = [], onChanged }) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(null)
  const [pending, setPending] = useState(null)   // { caseId, action }
  const [note, setNote] = useState('')
  const [filing, setFiling] = useState(false)

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
      .filter(c => (tab === 'open' ? isOpen(c) : !isOpen(c)))
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

  async function patch(kase, changes, message) {
    if (working) return
    setWorking(kase.id)
    const { error } = await supabase.from('blotter_cases').update(changes).eq('id', kase.id)
    setWorking(null)
    if (error) { toast.error(error.message); return }
    onChanged?.(kase.id, changes)
    setPending(null)
    setNote('')
    toast.success(message)
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
    if (meta.confirm && !window.confirm(meta.confirm)) return
    if (meta.prompt) { setPending({ caseId: kase.id, action }); setNote(''); return }
    runAction(kase, action)
  }

  return (
    <div className="space-y-4">

      <div className="white-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
            <Gavel size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800">Katarungang Pambarangay</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Sorted by deadline — the case closest to running out of time is at the top.
            </p>
            <div className="flex items-start gap-1.5 mt-2">
              <Scale size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                <strong style={{ color: '#5B54E8' }}>RA 7160, Secs. 408–418</strong> — summon the
                respondent by the <strong>next working day</strong>, mediate within{' '}
                <strong>15 days</strong> of the first meeting, then the Pangkat has 15 more,
                extendible once. Conciliation is a <strong>precondition to court</strong> (Sec. 412);
                a settlement becomes final after 10 days unless repudiated (Secs. 416, 418).
              </p>
            </div>
          </div>
        </div>
      </div>

      {counts.breach > 0 && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <Clock size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-xs text-red-800 leading-relaxed">
            <strong>{counts.breach}</strong> case{counts.breach === 1 ? '' : 's'} past the period
            RA 7160 allows. A lapsed period does not end the Lupon’s duty — it just means the
            parties have been waiting longer than the law intends.
          </p>
        </div>
      )}

      <div className="white-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter cases">
            {[
              { value: 'open', label: 'Open', count: counts.open, color: '#f97316' },
              { value: 'closed', label: 'Closed', count: counts.closed, color: '#22c55e' },
            ].map(f => (
              <button key={f.value} onClick={() => setTab(f.value)} aria-pressed={tab === f.value}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: tab === f.value ? f.color : '#fafaff',
                  color: tab === f.value ? 'white' : '#6b7280',
                  border: tab === f.value ? 'none' : '1px solid #f0effe',
                }}>
                {f.label} <span style={{ opacity: 0.75 }}>{f.count}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setFiling(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
            <Plus size={13} /> {filing ? 'Close form' : 'Record a complaint'}
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            type="search" aria-label="Search blotter cases"
            placeholder="Search by case number, party, or nature..."
            className="input-field w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-gray-800" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {filing && (
        <FileComplaint
          profile={profile}
          incidents={incidents}
          residents={residents}
          onDone={(created) => { setFiling(false); onChanged?.(created?.id, created, 'created') }}
        />
      )}

      {shown.length === 0 ? (
        <div className="white-card p-10 text-center">
          <Gavel size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 text-sm">
            {tab === 'open' ? 'No cases before the Lupon.' : 'No closed cases yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(kase => {
            const st = CASE_STATUS[kase.status] || CASE_STATUS.filed
            const deadline = stageDeadline(kase)
            const dl = KP_DEADLINE_STYLE[deadline.level]
            const actions = availableActions(kase)
            const busy = working === kase.id
            const isPending = pending?.caseId === kase.id
            const meta = isPending ? ACTION_META[pending.action] : null

            return (
              <div key={kase.id} className="white-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold" style={{ color: '#5B54E8' }}>
                        {kase.case_number}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {deadline.label && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: dl.bg, color: dl.color, border: `1px solid ${dl.border}` }}
                          title={deadline.citation || undefined}>
                          {deadline.label}
                          {deadline.level === 'breach' && ` · ${Math.abs(deadline.daysLeft)}d over`}
                          {deadline.level === 'due' && deadline.daysLeft >= 0 && ` · ${deadline.daysLeft}d left`}
                        </span>
                      )}
                      {kase.prohibited && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                          ⛔ Must not be mediated
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-gray-800 mt-1.5">
                      {kase.complainant_name} <span className="font-normal text-gray-400">vs</span> {kase.respondent_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{kase.nature}</p>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{kase.description}</p>

                    <div className="flex items-start gap-1.5 mt-2">
                      <Scale size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
                      <p className="text-[11px] text-gray-500 leading-relaxed">{kase.legal_basis}</p>
                    </div>

                    {kase.settlement_terms && (
                      <p className="text-[11px] mt-1.5 px-2.5 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: '#f0fdf4', color: '#166534' }}>
                        <strong>Settled:</strong> {kase.settlement_terms}
                      </p>
                    )}
                    {kase.repudiation_reason && (
                      <p className="text-[11px] mt-1.5 px-2.5 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: '#fffbeb', color: '#92400e' }}>
                        <strong>Repudiated:</strong> {kase.repudiation_reason}
                      </p>
                    )}
                    {kase.cfa_reason && (
                      <p className="text-[11px] mt-1.5 px-2.5 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: '#fef2f2', color: '#b91c1c' }}>
                        <strong>CFA:</strong> {kase.cfa_reason}
                      </p>
                    )}
                    {kase.referred_to && (
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        <strong>Referred to:</strong> {kase.referred_to}
                      </p>
                    )}

                    <p className="text-[11px] text-gray-400 mt-1.5" title={fullDate(kase.filed_at)}>
                      Filed {timeAgo(kase.filed_at)}
                    </p>
                  </div>
                </div>

                {isPending ? (
                  <div className="mt-3 space-y-2">
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                      aria-label={meta.label}
                      placeholder={meta.prompt}
                      className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800" />
                    <div className="flex gap-2">
                      <button onClick={() => runAction(kase, pending.action)}
                        disabled={busy || (meta.required && !note.trim())}
                        className="flex-1 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                        style={TONE[meta.tone]}>
                        {busy ? <Loader2 size={13} className="animate-spin mx-auto" /> : `Confirm · ${meta.label}`}
                      </button>
                      <button onClick={() => { setPending(null); setNote('') }}
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold" style={TONE.muted}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : actions.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {actions.map(action => {
                      const m = ACTION_META[action]
                      const Icon = m.icon
                      return (
                        <button key={action} onClick={() => startAction(kase, action)} disabled={busy}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-40"
                          style={TONE[m.tone]}>
                          <Icon size={13} /> {m.label}
                        </button>
                      )
                    })}
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

/**
 * Taking a complaint.
 *
 * The Sec. 408 checklist is answered by the person in front of the
 * complainant, not inferred, because every exception turns on facts only
 * they know — where the parties live, who they work for, what the dispute is
 * worth. The assessment updates live so the consequence of a tick is visible
 * before the case is filed.
 */
function FileComplaint({ profile, incidents, residents, onDone }) {
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
    <form onSubmit={submit} className="white-card p-5 space-y-4 fade-up">
      <h4 className="font-bold text-gray-800 text-sm">Record a complaint</h4>

      {residents.length > 0 && (
        <div>
          <label htmlFor="kp-complainant-account" className="text-xs font-bold text-gray-700">
            Is the complainant a registered resident?{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select id="kp-complainant-account" value={form.complainant_id}
            onChange={e => pickComplainant(e.target.value)}
            className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5">
            <option value="">Not a registered account — record the name below</option>
            {residents.map(r => (
              <option key={r.id} value={r.id}>{r.full_name}{r.address ? ` · ${r.address}` : ''}</option>
            ))}
          </select>
          {/* Linking the account is what lets the complainant follow their own
              case from their dashboard — the read policy is scoped to it. */}
          <p className="text-[10px] text-gray-400 mt-1">
            Linking an account lets the complainant follow the case themselves.
          </p>
        </div>
      )}

      {incidents.length > 0 && (
        <div>
          <label htmlFor="kp-incident" className="text-xs font-bold text-gray-700">
            Arising from a reported incident? <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select id="kp-incident" value={form.incident_id}
            onChange={e => pickIncident(e.target.value)}
            className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5">
            <option value="">Not linked to an incident</option>
            {incidents.slice(0, 50).map(i => (
              <option key={i.id} value={i.id}>
                {getCategoryMeta(i.category).icon} {i.title} — {timeAgo(i.created_at)}
              </option>
            ))}
          </select>
          {hint?.prompt && (
            <p className="text-[11px] mt-1.5 px-2.5 py-2 rounded-lg leading-relaxed"
              style={{ background: '#fffbeb', color: '#92400e' }}>
              {hint.prompt}
            </p>
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
          <label htmlFor="kp-nature" className="text-xs font-bold text-gray-700">Nature of the dispute</label>
          <select id="kp-nature" value={form.nature}
            onChange={e => setForm(f => ({ ...f, nature: e.target.value }))}
            className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5">
            {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="kp-desc" className="text-xs font-bold text-gray-700">
          What happened? <span className="text-red-500">*</span>
        </label>
        <textarea id="kp-desc" rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="In the complainant’s own words where possible."
          className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5" />
      </div>

      <div>
        <p className="text-xs font-bold text-gray-700">
          Does any of these apply? <span className="font-normal text-gray-400">(RA 7160, Sec. 408)</span>
        </p>
        <div className="space-y-1.5 mt-2">
          {Object.entries(KP_EXCLUSIONS).map(([key, x]) => {
            const on = exclusions.includes(key)
            return (
              <label key={key}
                className="flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: on ? (x.prohibited ? '#fef2f2' : '#fffbeb') : '#fafaff',
                  border: `1px solid ${on ? (x.prohibited ? '#fecaca' : '#fef3c7') : '#f0effe'}`,
                }}>
                <input type="checkbox" checked={on} onChange={() => toggle(key)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="text-[11px] font-semibold text-gray-800 block">{x.label}</span>
                  {x.help && <span className="text-[10px] text-gray-500 block mt-0.5">{x.help}</span>}
                  <span className="text-[10px] font-bold block mt-0.5" style={{ color: '#5B54E8' }}>{x.citation}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="px-3.5 py-3 rounded-2xl"
        style={{
          background: assessment.prohibited ? '#fef2f2' : assessment.eligible ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${assessment.prohibited ? '#fecaca' : assessment.eligible ? '#dcfce7' : '#fef3c7'}`,
        }}>
        <p className="text-xs font-bold"
          style={{ color: assessment.prohibited ? '#b91c1c' : assessment.eligible ? '#166534' : '#92400e' }}>
          {assessment.summary}
        </p>
        {assessment.blocking.map(b => (
          <p key={b.key} className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
            <strong>{b.citation}</strong> — {b.label}
            {b.consequence && <span className="block mt-0.5">{b.consequence}</span>}
          </p>
        ))}
      </div>

      <button type="submit" disabled={!valid || saving}
        className="btn-primary w-full py-3 rounded-2xl text-white text-sm font-bold disabled:opacity-40">
        {saving ? 'Recording…' : assessment.eligible ? 'File with the Lupon' : 'Record and refer'}
      </button>
    </form>
  )
}

function Field({ label, value, onChange, required }) {
  const id = `kp-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)}
        className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5" />
    </div>
  )
}
