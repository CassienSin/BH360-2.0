'use client'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Muted } from '@/components/ui/text'
import { SearchBox } from '@/components/official/Toolbar'
import { fullDate, timeAgoLong } from '@/lib/timeAgo'

/*
 * O10: the announcements the barangay has published, newest first, with
 * search and a This week switch. Presentation only: the list is what the
 * page already loads; New announcement opens its own page.
 */

const DAY = 24 * 60 * 60 * 1000

export default function AnnouncementsSection({ announcements, now, onNew }) {
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const weekCount = announcements.filter(a => now - new Date(a.created_at) <= 7 * DAY).length

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return announcements
      .filter(a => view === 'all' || now - new Date(a.created_at) <= 7 * DAY)
      .filter(a => !q || a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q))
  }, [announcements, view, search, now])

  if (announcements.length === 0) {
    return (
      <Card className="px-[18px] py-5">
        <p className="text-sm font-bold text-ink">No announcements yet</p>
        <Muted className="mt-1">Post water interruptions, events and advisories here. Every resident sees them.</Muted>
        <Button className="mt-4" onClick={onNew}><Plus aria-hidden="true" />New announcement</Button>
      </Card>
    )
  }

  return (
    <Card className="@container">
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
        <Segmented label="Show" value={view} onChange={setView}
          items={[{ value: 'all', label: 'All', count: announcements.length }, { value: 'week', label: 'This week', count: weekCount }]} />
        <SearchBox value={search} onChange={setSearch} label="Search announcements" className="min-w-48 flex-1 @3xl:max-w-64" />
        <Button variant="secondary" className="h-9 desk:hidden" onClick={onNew}><Plus aria-hidden="true" />New</Button>
      </div>

      {shown.length === 0 ? (
        <div className="border-t border-line px-[18px] py-5">
          <Muted>{search ? 'Nothing matches that search.' : 'Nothing posted this week.'}</Muted>
        </div>
      ) : (
        <Rows className="border-t border-line">
          {shown.map(a => {
            const age = now - new Date(a.created_at)
            return (
              <Row key={a.id} className="grid gap-x-4 gap-y-1 @3xl:grid-cols-[minmax(0,1fr)_200px] @3xl:items-center">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink">
                    <span className="min-w-0 break-words">{a.title}</span>
                    {age <= DAY && <Tag tone="brand" className="shrink-0">New</Tag>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-body">{a.content}</p>
                </div>
                <p className="text-xs text-muted-foreground @3xl:text-right" title={fullDate(a.created_at)}>
                  Published {timeAgoLong(a.created_at, new Date(now)).toLowerCase()} · everyone
                </p>
              </Row>
            )
          })}
        </Rows>
      )}
    </Card>
  )
}
