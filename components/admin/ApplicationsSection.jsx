'use client'
import { useState } from 'react'
import { Check, ChevronLeft, Copy, Loader2, Mail } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Notice } from '@/components/ui/notice'
import { Muted, SectionLabel } from '@/components/ui/text'
import { SearchBox, Menu } from '@/components/official/Toolbar'
import { fullDate } from '@/lib/timeAgo'

/*
 * A01: barangays asking to join, as a split view: the list on the left,
 * the application on the right. Presentation only: the page owns the
 * filter, the search, approving (which makes the invite code), rejecting
 * with a reason, copying and the email links.
 */

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All' },
]
const STATUS = {
  pending: { label: 'Pending', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Declined', tone: 'danger' },
}

/** "Today", "Yesterday", then "Nov 15". */
function submitted(at) {
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const y = new Date(today); y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const place = app => [app.barangays?.city, app.barangays?.province].filter(Boolean).join(', ')

export default function ApplicationsSection({
  apps, counts, filter, onFilter, search, onSearch, processing,
  onApprove, onReject, onCopy, emailLinks, inviteEmail,
}) {
  // The application on the right; on phones the list and it take turns.
  const [openId, setOpenId] = useState(null)
  const selected = apps.find(a => a.id === openId) || apps[0] || null

  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Left: the list */}
      <Card lift className={`@container !overflow-visible ${openId ? 'hidden xl:block' : ''}`}>
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
          <Segmented label="Filter by status" value={filter} onChange={v => { onFilter(v); setOpenId(null) }}
            items={TABS.map(t => ({ value: t.value, label: t.label, count: t.value === 'pending' ? counts.pending : undefined }))}
            className="w-full @xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
          <SearchBox value={search} onChange={onSearch} label="Search applications" className="min-w-44 flex-1" />
        </div>
        {apps.length === 0 ? (
          <Muted className="border-t border-line px-[18px] py-5">
            {search ? 'Nothing matches that search.' : filter === 'pending' ? 'Nothing is waiting for review.' : 'Nothing in this list.'}
          </Muted>
        ) : (
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                <th scope="col" className="py-2.5 pl-[18px] font-bold">Barangay</th>
                <th scope="col" className="hidden w-[34%] px-3 py-2.5 font-bold @xl:table-cell">Requested by</th>
                <th scope="col" className="hidden w-[18%] px-3 py-2.5 font-bold @md:table-cell">Submitted</th>
                <th scope="col" className="w-[96px] py-2.5 pr-[18px]"><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => {
                const on = selected?.id === app.id
                return (
                  <tr key={app.id} onClick={() => setOpenId(app.id)} aria-current={on ? 'true' : undefined}
                    className={`cursor-pointer border-t border-line transition-colors ${on ? 'xl:bg-brand-soft xl:shadow-[inset_3px_0_0_var(--brand-strong)]' : 'hover:bg-surface-sunk'}`}>
                    <td className="min-w-0 py-3 pl-[18px]">
                      <p className="truncate text-sm font-bold text-ink">{app.barangays?.name ? `Brgy. ${app.barangays.name}` : 'Unnamed barangay'}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{place(app) || '—'}</p>
                    </td>
                    <td className="hidden truncate px-3 py-3 text-[13px] text-body @xl:table-cell">{app.full_name}</td>
                    <td className="hidden px-3 py-3 text-[13px] text-body @md:table-cell" title={fullDate(app.created_at)}>{submitted(app.created_at)}</td>
                    <td className="py-3 pr-[18px] text-right">
                      {app.status === 'pending'
                        ? <Button size="sm" variant={on ? 'primary' : 'secondary'} onClick={e => { e.stopPropagation(); setOpenId(app.id) }}>Review</Button>
                        : <Status tone={STATUS[app.status]?.tone || 'quiet'}>{STATUS[app.status]?.label || app.status}</Status>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Right: the application */}
      {selected ? (
        <Card lift className={openId ? '' : 'hidden xl:block'}>
          <div className="flex items-start gap-3 px-[18px] pt-4 pb-3">
            <button type="button" onClick={() => setOpenId(null)} aria-label="Back to the list"
              className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand-strong xl:hidden">
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-extrabold text-ink">{selected.barangays?.name ? `Brgy. ${selected.barangays.name}` : 'Unnamed barangay'}</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{[place(selected), `submitted ${fullDate(selected.created_at)}`].filter(Boolean).join(' · ')}</p>
            </div>
            <Status tone={STATUS[selected.status]?.tone || 'quiet'} className="shrink-0">{STATUS[selected.status]?.label || selected.status}</Status>
          </div>

          <dl className="grid grid-cols-2 border-t border-line text-sm">
            {[
              ['Requested by', selected.full_name || '—'],
              ['Role', selected.position || '—'],
              ['Email', selected.email || '—'],
              ['Phone', selected.phone || '—'],
            ].map(([k, v], i) => (
              <div key={k} className={`min-w-0 border-line px-[18px] py-3 ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t' : ''}`}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-bold break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-3 border-t border-line px-[18px] py-4">
            {selected.message && (
              <div>
                <SectionLabel as="h3" className="mb-1">Their message</SectionLabel>
                <p className="text-sm leading-relaxed text-body">&ldquo;{selected.message}&rdquo;</p>
              </div>
            )}

            {selected.status === 'approved' && selected.generated_code && (
              <Notice tone="ok" title="Official invite code">
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[15px] font-bold tracking-[0.06em] text-ink">{selected.generated_code}</code>
                  <Button size="sm" variant="secondary" onClick={() => onCopy(selected.generated_code)}><Copy aria-hidden="true" />Copy</Button>
                  <Menu items={[
                    { label: 'Gmail', onClick: () => window.open(emailLinks(selected).gmail, '_blank', 'noopener') },
                    { label: 'Outlook', onClick: () => window.open(emailLinks(selected).outlook, '_blank', 'noopener') },
                    { label: 'Mail app', onClick: () => { window.location.href = emailLinks(selected).mailto } },
                    { label: 'Copy the message', onClick: () => { const m = inviteEmail(selected); onCopy(`To: ${m.to}\nSubject: ${m.subject}\n\n${m.body}`) } },
                  ]} trigger={({ open, toggle }) => (
                    <Button size="sm" variant="secondary" onClick={toggle} aria-expanded={open} aria-haspopup="menu"><Mail aria-hidden="true" />Email the code</Button>
                  )} />
                </span>
                <span className="mt-2 block">The code is for the applicant only. Once signed in, they make tanod and official codes for their team under Users.</span>
              </Notice>
            )}

            {selected.status === 'rejected' && selected.rejection_reason && (
              <Notice tone="danger" title="Declined">{selected.rejection_reason}</Notice>
            )}

            {selected.status === 'pending' && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Approving gives {selected.full_name?.split(' ')[0] || 'the applicant'} an official invite code to set up the barangay. Declining asks you for a reason they will see.
              </p>
            )}
          </div>

          {selected.status === 'pending' && (
            <div className="flex flex-wrap gap-2.5 border-t border-line px-[18px] py-3.5">
              <Button variant="secondary" onClick={() => onReject(selected)} disabled={processing}>Decline</Button>
              <Button className="ml-auto" onClick={() => onApprove(selected)} disabled={processing} aria-busy={processing || undefined}>
                {processing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Approve and make the code
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="hidden px-8 py-12 text-center xl:block">
          <p className="text-[15px] font-extrabold text-ink">Nothing to review</p>
          <Muted className="mt-1">Pick another list on the left.</Muted>
        </Card>
      )}
    </div>
  )
}
