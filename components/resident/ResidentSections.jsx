'use client'
import { ChevronRight, Phone, Plus } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Status, Tag } from '@/components/ui/tag'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { DocumentsIcon, TicketsIcon, BlotterIcon, AnnouncementsIcon } from '@/components/icons/BhIcons'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import { DOCUMENT_TYPES, DOC_STATUS_STYLE, deadlineState, formatDeadline } from '@/lib/documents'
import { CASE_STATUS, stageDeadline, isOpen as caseIsOpen } from '@/lib/katarungan'
import { hotlinesFor, telHref, numberLabel } from '@/lib/hotlines'

/*
 * The resident dashboard's sections in the Crafted style (R01, R04, R07,
 * R09, R10 and the tickets list). Presentation only: every list gets the
 * data the page already loads, and every action calls back into the page.
 */

/* ---------------------------------------------------------------------
   Where a report stands, in plain words (DESIGN.md §7)
   --------------------------------------------------------------------- */

export const REPORT_STEPS = ['Received', 'Assigned', 'On the way', 'Resolved']

/** The step a report has reached (1–4), its status line and tone. */
export function reportState(inc) {
  if (!inc) return { step: 1, label: '', tone: 'quiet' }
  if (inc.status === 'resolved') {
    return inc.rating
      ? { step: 4, label: `Resolved · you rated it ${inc.rating}/5`, tone: 'quiet' }
      : { step: 4, label: 'Resolved · rate the response', tone: 'brand', rate: true }
  }
  if (inc.arrived_at) return { step: 3, label: 'Tanod is there', tone: 'ok' }
  if (inc.acknowledged_at) return { step: 3, label: 'Tanod on the way', tone: 'ok' }
  if (inc.status === 'assigned') return { step: 2, label: 'Tanod assigned', tone: 'info' }
  return { step: 1, label: 'Waiting for a tanod', tone: 'warn' }
}

/** "Reported today, 6:12 PM" / "Reported yesterday" / "Reported Nov 9". */
function reportedWhen(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today, ${time}`
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `yesterday, ${time}`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

/** An empty list: muted words and one action, no illustration (DESIGN.md §5). */
function EmptyCard({ text, action }) {
  return (
    <Card className="px-[18px] py-5">
      <Muted>{text}</Muted>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  )
}

/* ---------------------------------------------------------------------
   R04 — My reports
   --------------------------------------------------------------------- */

export function ReportRows({ incidents, onOpen, onRate, emptyText, emptyAction }) {
  if (!incidents.length) return <EmptyCard text={emptyText} action={emptyAction} />
  return (
    <Card lift>
      <Rows>
        {incidents.map(inc => {
          const st = reportState(inc)
          const done = inc.status === 'resolved'
          return (
            <Row key={inc.id} className="flex gap-3">
              <CategoryIcon category={inc.category} size={20} className="mt-0.5 shrink-0"
                style={{ color: done ? 'var(--text-muted)' : categoryColor(inc.category) }} />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(inc)}
                  className="group flex w-full items-start gap-2 text-left rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink group-hover:text-brand-strong">{inc.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5" title={fullDate(inc.created_at)}>Reported {reportedWhen(inc.created_at)}</span>
                  </span>
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
                <div className="mt-2 flex items-center gap-2">
                  {st.rate ? (
                    <button type="button" onClick={() => onRate(inc)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong hover:text-brand-deep rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                      <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />{st.label}
                    </button>
                  ) : (
                    <Status tone={st.tone}>{st.label}</Status>
                  )}
                  {inc.priority === 'Critical' && !done && <Tag tone="danger">Critical</Tag>}
                </div>
                {!done && <Progress className="mt-2.5 max-w-[268px]" value={st.step} label={`Report progress: ${REPORT_STEPS[st.step - 1]}`} />}
              </div>
            </Row>
          )
        })}
      </Rows>
    </Card>
  )
}

/* ---------------------------------------------------------------------
   Tickets (no reference screen: the same rows)
   --------------------------------------------------------------------- */

const TICKET_STATE = {
  open: { label: 'Waiting for the barangay', tone: 'warn' },
  in_progress: { label: 'Being handled', tone: 'info' },
  closed: { label: 'Closed', tone: 'quiet' },
}

export function TicketRows({ tickets, onOpen, emptyText, emptyAction }) {
  if (!tickets.length) return <EmptyCard text={emptyText} action={emptyAction} />
  return (
    <Card lift>
      <Rows>
        {tickets.map(t => {
          const st = TICKET_STATE[t.status] || { label: t.status, tone: 'quiet' }
          return (
            <Row key={t.id} as="button" interactive onClick={() => onOpen(t)} className="flex gap-3">
              <TicketsIcon size={20} className={`mt-0.5 shrink-0 ${t.status === 'closed' ? 'text-muted-foreground' : 'text-brand-strong'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{t.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5" title={fullDate(t.created_at)}>
                  {[t.category, `Opened ${timeAgoLong(t.created_at).toLowerCase()}`].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-2 block"><Status tone={st.tone}>{st.label}</Status></span>
              </span>
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Row>
          )
        })}
      </Rows>
    </Card>
  )
}

/* ---------------------------------------------------------------------
   R07 — My documents
   --------------------------------------------------------------------- */

const DOC_TONE = { pending: 'warn', processing: 'info', ready: 'ok', released: 'quiet', denied: 'danger' }
const DOC_LABEL = { ready: 'Ready for pickup' }

export function DocumentRows({ requests, emptyText, emptyAction }) {
  if (!requests.length) return <EmptyCard text={emptyText} action={emptyAction} />
  return (
    <Card lift>
      <Rows>
        {requests.map(req => {
          const doc = DOCUMENT_TYPES[req.document_type]
          const st = DOC_STATUS_STYLE[req.status] || DOC_STATUS_STYLE.pending
          const state = deadlineState(req)
          const decided = ['released', 'denied'].includes(req.status)
          let label = DOC_LABEL[req.status] || st.label
          if (req.status === 'released') label = `Released ${timeAgo(req.released_at || req.created_at)}`
          return (
            <Row key={req.id} className="flex gap-3">
              <DocumentsIcon size={20} className={`mt-0.5 shrink-0 ${decided ? 'text-muted-foreground' : 'text-brand-strong'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{doc?.label || req.document_type}</p>
                <p className="truncate text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{req.reference_code}</span>{req.purpose ? ` · ${req.purpose}` : ''}
                </p>
                <div className="mt-2"><Status tone={DOC_TONE[req.status] || 'quiet'}>{label}</Status></div>
                {req.status === 'ready' && <p className="text-xs text-body mt-1">{st.desc}. Bring a valid ID.</p>}
                {!decided && req.due_at && (
                  <p className={`text-xs mt-1 ${state.level === 'breach' ? 'text-danger font-semibold' : state.level === 'due' ? 'text-warn' : 'text-body'}`}>
                    Due {formatDeadline(req.due_at)}, per the Citizen’s Charter{state.label && !state.deemedApproved ? ` · ${state.label}` : ''}.
                  </p>
                )}
                {state.deemedApproved && (
                  <Notice tone="danger" className="mt-2" icon={false}>
                    The deadline passed without a decision. Under <strong>RA 11032 Sec. 10</strong> this request is deemed approved. Show this reference at the barangay hall.
                  </Notice>
                )}
                {req.extension_reason && <p className="text-xs text-body mt-1"><strong>Extended once (Sec. 9(b)(1)):</strong> {req.extension_reason}</p>}
                {req.status === 'denied' && req.denial_reason && <p className="text-xs text-danger mt-1">{req.denial_reason}</p>}
              </div>
            </Row>
          )
        })}
      </Rows>
    </Card>
  )
}

/* ---------------------------------------------------------------------
   R09 — Announcements
   --------------------------------------------------------------------- */

export function AnnouncementRows({ announcements, unreadIds, emptyText }) {
  if (!announcements.length) return <EmptyCard text={emptyText} />
  return (
    <Card lift>
      <Rows>
        {announcements.map(a => {
          const unread = unreadIds.has(a.id)
          return (
            <Row key={a.id} as="article" className="py-3.5">
              <h3 className="text-[15px] font-extrabold text-ink break-words">{a.title}</h3>
              <p className="mt-1 text-sm leading-[1.55] text-body whitespace-pre-wrap break-words">{a.content}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" title={fullDate(a.created_at)}>
                {unread && <span className="size-[7px] rounded-full bg-brand-strong" aria-hidden="true" />}
                {timeAgoLong(a.created_at)}
                {unread && <span className="sr-only"> · unread</span>}
              </p>
            </Row>
          )
        })}
      </Rows>
    </Card>
  )
}

/* ---------------------------------------------------------------------
   R10 — My cases
   --------------------------------------------------------------------- */

const CASE_STAGES = ['Filed', 'Mediation', 'Conciliation', 'Settled']
const CASE_STEP = { filed: 1, mediation: 2, pangkat: 3, settled: 4, repudiated: 3, cfa_issued: 4, referred: 4, withdrawn: 4 }
const CASE_TONE = { filed: 'quiet', mediation: 'brand', pangkat: 'warn', settled: 'ok', repudiated: 'warn', cfa_issued: 'quiet', referred: 'quiet', withdrawn: 'quiet' }

export function CaseCard({ kase }) {
  const st = CASE_STATUS[kase.status] || CASE_STATUS.filed
  const deadline = stageDeadline(kase)
  const open = caseIsOpen(kase)
  const step = CASE_STEP[kase.status] || 1
  return (
    <Card lift className="px-[18px] py-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-xs font-bold text-muted-foreground">{kase.case_number}</span>
        <Tag tone={CASE_TONE[kase.status] || 'quiet'}>{st.label}</Tag>
      </div>
      <h3 className="mt-2 text-[17px] font-extrabold text-ink break-words">
        {kase.complainant_name ? `${kase.complainant_name} v. ${kase.respondent_name}` : `vs ${kase.respondent_name}`}
      </h3>
      {kase.nature && <p className="text-sm text-body mt-0.5">{kase.nature}</p>}
      {open || kase.status === 'settled' ? (
        <div className="mt-3">
          <Progress tone="brand" value={step} labels={CASE_STAGES} label={`Case stage: ${st.label}`} />
        </div>
      ) : null}
      {open && deadline.label && (
        <p className={`mt-3 text-xs ${deadline.level === 'breach' ? 'font-semibold text-danger' : deadline.level === 'due' ? 'text-warn' : 'text-body'}`}>
          {deadline.label}{deadline.dueAt ? ` · by ${formatDeadline(deadline.dueAt)}` : ''}{deadline.citation ? ` (${deadline.citation})` : ''}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground" title={fullDate(kase.filed_at)}>{st.desc} · filed {timeAgo(kase.filed_at)}</p>
      <CaseOutcome kase={kase} deadline={deadline} />
    </Card>
  )
}

/**
 * A concluded case still carries the outcome the law attaches to it — the
 * settlement terms, the repudiation window, the Certificate to File Action.
 */
function CaseOutcome({ kase, deadline }) {
  if (kase.settlement_terms) {
    return (
      <Notice tone="ok" title="Settled:" className="mt-3" icon={false}>
        {kase.settlement_terms}
        {deadline.level === 'window' && (
          <span className="block mt-1">You may still repudiate this within the window above if your consent was obtained by fraud, violence or intimidation (Sec. 418).</span>
        )}
      </Notice>
    )
  }
  if (kase.cfa_reason) {
    return (
      <Notice tone="quiet" title="Certificate to File Action issued:" className="mt-3" icon={false}>
        {kase.cfa_reason} You may now take this to court.
      </Notice>
    )
  }
  if (kase.referred_to) return <p className="mt-3 text-xs text-body"><strong>Referred to:</strong> {kase.referred_to}</p>
  return null
}

/* ---------------------------------------------------------------------
   R01 — Home
   --------------------------------------------------------------------- */

/**
 * The first card on the band: the one thing that needs the resident most
 * (lib/homeSummary mostPressing), or "all clear".
 */
export function PressingCard({ pressing, incident, allClearNote, onOpen }) {
  if (!pressing) {
    return (
      <Card lift className="px-[18px] py-3.5">
        <Status tone="ok">All clear</Status>
        <p className="mt-1 text-[15px] font-extrabold text-ink">{allClearNote}</p>
      </Card>
    )
  }
  const st = incident ? reportState(incident) : null
  const tone = st ? st.tone : pressing.tone === 'urgent' ? 'danger' : 'warn'
  return (
    <Card lift className="px-[18px] py-3.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0"><Status tone={tone}>{st ? st.label : pressing.detail}</Status></span>
        {pressing.href && (
          <Button variant="ghost" size="sm" className="-mr-2" onClick={onOpen}>Track</Button>
        )}
      </div>
      <p className="mt-1 truncate text-[16px] font-extrabold text-ink">{pressing.title}</p>
      {st && incident.status !== 'resolved' && (
        <Progress className="mt-3" value={st.step} labels={REPORT_STEPS} label={`Report progress: ${REPORT_STEPS[st.step - 1]}`} />
      )}
      {!st && pressing.detail && <p className="text-xs text-muted-foreground mt-0.5">{pressing.detail}</p>}
    </Card>
  )
}

/** The Home list: where a resident goes next. `items`: { key, icon, title, sub, count, onClick }. */
export function HomeLinks({ items }) {
  return (
    <Card>
      <Rows>
        {items.map(item => {
          const Icon = item.icon
          return (
            <Row key={item.key} as="button" interactive onClick={item.onClick} className="flex items-center gap-3 py-3.5">
              <Icon size={20} className="shrink-0 text-brand-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-ink">{item.title}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{item.sub}</span>
              </span>
              {item.count > 0 && <span className="text-xs font-bold tabular-nums text-brand-strong">{item.count}</span>}
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Row>
          )
        })}
      </Rows>
    </Card>
  )
}

/** Emergency hotlines as a two-column grid of calls (R01). */
export function HomeHotlines({ hallPhone }) {
  const lines = hotlinesFor(hallPhone)
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
      {lines.map((line, i) => {
        const href = telHref(line.number)
        const last = i === lines.length - 1 && lines.length % 2 === 1
        const inner = (
          <>
            <Phone size={18} strokeWidth={1.9} aria-hidden="true" className={`mt-0.5 shrink-0 ${line.danger ? 'text-danger' : 'text-brand-strong'}`} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{line.short}</span>
              <span className={`block text-[13px] ${line.number ? 'text-body' : 'text-muted-foreground'}`}>{numberLabel(line.number)}</span>
            </span>
          </>
        )
        const cls = `flex items-start gap-2.5 bg-surface px-3.5 py-3 ${last ? 'col-span-2' : ''}`
        return href ? (
          <a key={line.key} href={href} aria-label={`Call ${line.name}, ${line.number}`}
            className={`${cls} transition-colors hover:bg-surface-sunk outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong`}>{inner}</a>
        ) : (
          <div key={line.key} className={cls} title="No number saved yet">{inner}</div>
        )
      })}
    </div>
  )
}

/** "+ Request a document" style action on the band: a full-width white button. */
export function BandAction({ children, onClick }) {
  return (
    <Button variant="white" full size="lg" className="h-12 shadow-[var(--shadow-lift)]" onClick={onClick}>
      <Plus aria-hidden="true" />{children}
    </Button>
  )
}

export { AnnouncementsIcon, BlotterIcon, DocumentsIcon, TicketsIcon, CardHead }
