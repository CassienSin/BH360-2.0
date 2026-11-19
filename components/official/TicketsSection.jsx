'use client'
import { Card } from '@/components/ui/card'
import { Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Muted } from '@/components/ui/text'
import { TicketsIcon } from '@/components/icons/BhIcons'
import { waitingFor } from '@/lib/officialQueue'
import { SearchBox, FilterSelect, ExportMenu } from '@/components/official/Toolbar'

/*
 * O04: the tickets list styled as the left pane of a split view. Each
 * ticket still opens its own page (/official/ticket/[id], the right pane),
 * so on wide screens the space beside the list says what to do instead.
 * Presentation only: the page owns the search, the filter and the export.
 */

const HOUR = 60 * 60 * 1000

/** "3:02 PM" today, "Yesterday", then "Nov 16". */
function when(at, now) {
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  const today = new Date(now)
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  const y = new Date(today); y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

/** Where a ticket stands for the official: who it is waiting on. */
function ticketState(t, now) {
  if (t.status === 'closed') return { label: 'Closed', tone: 'quiet' }
  if (t.status === 'in_progress') return { label: 'Being handled', tone: 'info' }
  const waited = now - new Date(t.created_at).getTime()
  return { label: `Waiting on you · ${waitingFor(t.created_at, now).replace('Waiting ', '')}`, tone: waited > 2 * HOUR ? 'warn' : 'quiet' }
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
]

export default function TicketsSection({ tickets, filtered, search, onSearch, filter, onFilter, onOpen, onExport, now }) {
  const counts = Object.fromEntries(FILTERS.map(f => [f.value, f.value === 'all' ? tickets.length : tickets.filter(t => t.status === f.value).length]))
  // Open ones first (the oldest waiting at the top), then the rest, newest first.
  const ordered = [...filtered].sort((a, b) => {
    const rank = t => (t.status === 'open' ? 0 : t.status === 'in_progress' ? 1 : 2)
    return rank(a) - rank(b) || (rank(a) === 0
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at))
  })
  // Open or being handled: the dashboard's "need a reply".
  const waiting = tickets.filter(t => t.status !== 'closed').length

  return (
    <div className="grid items-stretch gap-3.5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <Card lift className="!overflow-visible flex min-h-[420px] flex-col">
        <div className="flex items-center gap-2 px-3.5 py-3 sm:px-[18px]">
          <SearchBox value={search} onChange={onSearch} label="Search tickets" className="min-w-0 flex-1" />
          <FilterSelect label="Status" value={filter} onChange={onFilter}
            options={FILTERS.map(f => ({ value: f.value, label: `${f.label} · ${counts[f.value]}` }))} />
        </div>

        {tickets.length === 0 ? (
          <Muted className="border-t border-line px-[18px] py-5">No tickets yet. Questions, requests and complaints from residents show up here.</Muted>
        ) : ordered.length === 0 ? (
          <div className="border-t border-line px-[18px] py-5">
            <Muted>No ticket matches.</Muted>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => { onSearch(''); onFilter('all') }}>Clear filters</Button>
          </div>
        ) : (
          <ul className="flex-1 border-t border-line">
            {ordered.map(t => {
              const st = ticketState(t, now)
              return (
                <li key={t.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => onOpen(t)}
                    className="block w-full px-[18px] py-3 text-left outline-none transition-colors hover:bg-surface-sunk focus-visible:bg-surface-sunk">
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{t.title}</span>
                      <time dateTime={t.created_at} className="shrink-0 text-xs text-muted-foreground">{when(t.created_at, now)}</time>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[t.profiles?.full_name || 'A resident', t.category].filter(Boolean).join(' · ')}
                    </span>
                    <Status tone={st.tone} className="mt-2">{st.label}</Status>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-line px-3.5 py-2.5 sm:px-[18px]">
          <p className="flex-1 text-xs text-muted-foreground">
            {filtered.length === tickets.length ? `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}` : `${filtered.length} of ${tickets.length}`}
          </p>
          <ExportMenu count={filtered.length} noun="tickets" onExport={onExport} />
        </div>
      </Card>

      {/* The right pane until a ticket is opened (wide screens only). */}
      <Card className="hidden flex-col items-center justify-center gap-2 px-8 py-12 text-center lg:flex">
        <span className="flex size-12 items-center justify-center rounded-[12px] bg-brand-soft text-brand-strong" aria-hidden="true">
          <TicketsIcon size={24} />
        </span>
        <p className="mt-1 text-[15px] font-extrabold text-ink">Pick a conversation</p>
        <Muted className="max-w-[40ch]">
          {waiting
            ? `${waiting} ticket${waiting === 1 ? ' is' : 's are'} waiting on a reply. The oldest is at the top of the list.`
            : 'Every open ticket has a reply. New questions from residents show up in the list.'}
        </Muted>
      </Card>
    </div>
  )
}
