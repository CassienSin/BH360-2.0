'use client'
import { ChevronRight } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row, RowTitle } from '@/components/ui/table'
import { Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Muted } from '@/components/ui/text'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { BlotterIcon, DocumentsIcon, IncidentsIcon, TicketsIcon, VerificationsIcon } from '@/components/icons/BhIcons'
import { timeAgo } from '@/lib/timeAgo'

/*
 * The official dashboard's pieces in the Crafted style (O01). Presentation
 * only: they draw what app/official/page.jsx already loads and call back
 * into it for every action.
 */

/** Where an incident stands, for an official: a plain label and a tone. */
export function incidentState(inc) {
  if (!inc) return { label: '', tone: 'quiet' }
  if (inc.status === 'resolved') return { label: 'Resolved', tone: 'quiet' }
  if (inc.arrived_at) return { label: 'Tanod on scene', tone: 'ok' }
  if (inc.acknowledged_at) return { label: 'Tanod on the way', tone: 'ok' }
  if (inc.status === 'assigned' || inc.assigned_to) return { label: 'Dispatched', tone: 'info' }
  return inc.priority === 'Critical'
    ? { label: 'Unassigned', tone: 'danger' }
    : { label: 'Unassigned', tone: 'warn' }
}

const KIND_ICON = {
  case: BlotterIcon, document: DocumentsIcon, incident: IncidentsIcon,
  ticket: TicketsIcon, verification: VerificationsIcon,
}

const WHEN_COLOR = { danger: 'text-danger', warn: 'text-warn', quiet: 'text-muted-foreground' }

/**
 * "Waiting on you": what needs an official's hand, most urgent first
 * (lib/officialQueue.js). Each row has one action; the first overdue item's
 * action is the red one.
 */
export function WaitingCard({ items, limit = 6, onAct }) {
  const shown = items.slice(0, limit)
  return (
    <Card>
      <CardHead title={<>Waiting on you <span className="ml-1 text-[13px] font-bold text-muted-foreground tabular-nums">{items.length}</span></>} />
      {shown.length === 0 ? (
        <Muted className="border-t border-line px-[18px] py-5">Nothing is waiting on you. New reports, tickets and sign-ups will show up here.</Muted>
      ) : (
        <Rows className="border-t border-line">
          {shown.map((item, i) => {
            const Icon = KIND_ICON[item.kind]
            const urgent = item.tone === 'danger'
            return (
              <Row key={`${item.kind}-${item.id}`} critical={urgent && item.kind === 'incident'} className="flex items-center gap-3">
                <Icon size={20} aria-hidden="true" className={`shrink-0 ${urgent ? 'text-danger' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <RowTitle title={item.title} sub={item.sub} />
                  {/* Phones: the timing goes under the title instead of in its own column. */}
                  <p className={`mt-0.5 truncate text-xs font-bold sm:hidden ${WHEN_COLOR[item.tone]}`}>{item.when}</p>
                </div>
                <span className={`hidden w-36 shrink-0 truncate text-xs font-bold sm:block ${WHEN_COLOR[item.tone]}`}>{item.when}</span>
                <Button size="sm" variant={urgent && i === 0 ? 'danger' : 'secondary'} className="shrink-0"
                  onClick={() => onAct(item)} aria-label={`${item.action}: ${item.title}`}>
                  {item.action}
                </Button>
              </Row>
            )
          })}
        </Rows>
      )}
      {items.length > limit && (
        <p className="border-t border-line px-[18px] py-3 text-xs text-muted-foreground">
          {items.length - limit} more in their sections.
        </p>
      )}
    </Card>
  )
}

/** The latest reports, each opening its incident page. */
export function RecentIncidentsCard({ incidents, onOpen, onViewAll }) {
  return (
    <Card>
      <CardHead title="Recent incidents"
        action={<Button variant="ghost" size="sm" onClick={onViewAll}>View all</Button>} />
      {incidents.length === 0 ? (
        <Muted className="border-t border-line px-[18px] py-5">No incidents yet. Reports from residents show up here as they come in.</Muted>
      ) : (
        <Rows className="border-t border-line">
          {incidents.map(inc => {
            const st = incidentState(inc)
            return (
              <Row key={inc.id} as="button" type="button" interactive critical={inc.priority === 'Critical' && inc.status !== 'resolved'}
                onClick={() => onOpen(inc)} className="flex items-center gap-3">
                <span className="shrink-0" style={{ color: inc.status === 'resolved' ? 'var(--text-muted)' : categoryColor(inc.category) }}>
                  <CategoryIcon category={inc.category} size={20} />
                </span>
                <RowTitle className="flex-1" title={inc.title}
                  sub={[inc.profiles?.full_name, inc.location, timeAgo(inc.created_at)].filter(Boolean).join(' · ')} />
                <Status tone={st.tone} className="shrink-0">{st.label}</Status>
                <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </Row>
            )
          })}
        </Rows>
      )}
    </Card>
  )
}

/** A dashboard section whose tool is its own page (map, calendar,
 *  analytics): what it is, and one way in. */
export function SectionLauncher({ icon: Icon, title, body, href, cta, onOpen }) {
  return (
    <Card lift className="flex flex-col gap-4 px-[18px] py-5 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand-strong" aria-hidden="true">
        <Icon size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
        <Muted className="mt-0.5">{body}</Muted>
      </div>
      <Button onClick={() => onOpen(href)} className="shrink-0">{cta}<ChevronRight aria-hidden="true" /></Button>
    </Card>
  )
}
