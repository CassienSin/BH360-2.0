'use client'
import { useMemo, useState } from 'react'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import DashboardHeader from '@/components/DashboardHeader'
import TabBar from '@/components/crafted/TabBar'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { StatStrip } from '@/components/ui/stat-strip'
import {
  AssignmentHero, UpNextCard, AssignmentList, DoneList, AssignmentPanel, HandledChart, ByTypeCard,
} from '@/components/tanod/TanodSections'
import { byUrgency, handledByDay, resolvedByCategory } from '@/lib/tanod'
import { useHydrated } from '@/lib/useHydrated'
import ResolveModal from '@/components/ResolveModal'
import { useNow } from '@/lib/useNow'

// Invented sample data: nothing is read from or written to Supabase.
function fixtures(now) {
  const ago = h => new Date(now - h * 3600e3).toISOString()
  return [
    { id: 'a1', title: 'Flooding near the creek', category: 'Flood', priority: 'Critical', status: 'assigned', location: 'Riverside, behind the chapel', description: 'Water from the creek is reaching the houses. Knee-deep at the corner.', created_at: ago(0.07), acknowledged_at: ago(0.05), latitude: 10.3812, longitude: 123.6391, profiles: { full_name: 'Resident One', phone: '09000000001' } },
    { id: 'a2', title: 'Loud karaoke past midnight', category: 'Noise', priority: 'Low', status: 'assigned', location: 'Purok 3', description: 'Still going.', created_at: ago(0.4), profiles: { full_name: 'Resident Two' } },
    { id: 'a3', title: 'Stray dogs near the school', category: 'Animals', priority: 'Medium', status: 'assigned', location: 'Purok 1', description: 'Three dogs at the gate.', created_at: ago(1), profiles: { full_name: 'Resident Three' } },
    { id: 'r1', title: 'Streetlight out on the main road', category: 'Infrastructure', priority: 'Medium', status: 'resolved', location: 'Purok 2', created_at: ago(5), acknowledged_at: ago(4.9), arrived_at: ago(4.8), resolved_at: ago(4.5), resolution_notes: 'Reported to the city electrician; cones placed.', rating: 5 },
    { id: 'r2', title: 'Burning trash', category: 'Fire', priority: 'High', status: 'resolved', location: 'Purok 4', created_at: ago(30), resolved_at: ago(29.5) },
    { id: 'r3', title: 'Noise at the basketball court', category: 'Noise', priority: 'Low', status: 'resolved', location: 'Purok 3', created_at: ago(52), resolved_at: ago(51) },
  ]
}

const noop = () => {}

export default function TanodPreview(props) {
  const hydrated = useHydrated()
  return hydrated ? <Body {...props} /> : null
}

function Body({ view: initial }) {
  const now = useNow()
  const [view, setView] = useState(initial)
  const incidents = useMemo(() => fixtures(now), []) // eslint-disable-line react-hooks/exhaustive-deps
  const assigned = incidents.filter(i => i.status === 'assigned').sort(byUrgency)
  const done = incidents.filter(i => i.status === 'resolved')
  const section = { duty: 'home', active: 'active', done: 'resolved', stats: 'stats', assignment: 'home', resolve: 'home' }[view] || 'home'
  const handlers = { busy: false, onOpen: () => setView('assignment'), onStamp: noop, onResolve: noop, onDirections: noop }

  const band = section === 'home' ? (
    <div className="flex flex-col gap-3.5">
      <div className="flex w-full items-center gap-3 rounded-[12px] bg-[var(--onband)] px-3.5 py-3 text-white">
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-extrabold">On duty</span><span className="block text-xs text-white/80">Sharing location with the barangay · 3h 12m</span></span>
        <span className="flex h-[26px] w-11 items-center justify-end rounded-full bg-ok px-[3px]"><span className="size-5 rounded-full bg-white" /></span>
      </div>
      <AssignmentHero inc={assigned[0]} {...handlers} />
    </div>
  ) : section === 'stats' ? (
    <StatStrip className="sm:grid-flow-row sm:grid-cols-4" stats={[
      { label: 'Resolved', value: 3, note: 'this month · 3 in all' },
      { label: 'Avg. response', value: '6 min', note: 'over 2 reports' },
      { label: 'Resolved rate', value: '50%', note: 'of 6 assigned' },
      { label: 'Resident rating', value: '5.0 / 5', note: '1 rating' },
    ]} />
  ) : (
    <Segmented onBand full label="Assigned to me" value={section} onChange={k => setView(k === 'active' ? 'active' : 'done')}
      items={[{ value: 'active', label: 'Active', count: assigned.length }, { value: 'resolved', label: 'Done', count: done.length }]} />
  )

  return (
    <>
      <DashboardFrame sidebarOpen={false}
        tabBar={<TabBar role="tanod" activeSection={section} onSelect={k => setView({ home: 'duty', active: 'active', stats: 'stats' }[k] || 'duty')} />}
        sidebar={null}
        header={<DashboardHeader profile={{ full_name: 'Sample Tanod', role: 'tanod', barangays: { name: 'Sample Barangay', city: 'Sample City' } }}
          columnClass={section === 'stats' ? 'max-w-3xl' : 'max-w-2xl'} sidebarOpen={false} setSidebarOpen={noop}
          sectionTitle={section === 'stats' ? 'My performance' : section === 'home' ? 'Duty' : 'Assigned to me'}
          phoneTitle={section === 'home' ? 'Tanod · Sample Barangay' : undefined}
          heading={section === 'home' ? (<><p className="text-xs font-bold tracking-[0.08em] text-white/75 uppercase">Thursday, Nov 19</p><h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.6px] text-white">Magandang gabi, Sample.</h1></>) : undefined}
          notificationCenter={{ items: [], unread: 0, markAllRead() {}, openItem() {} }}
          searchData={{ incidents: [], tickets: [], announcements: [] }}>
          <div className="band-slot">{band}</div>
        </DashboardHeader>}>
        <div className={`${section === 'stats' ? 'max-w-3xl' : 'max-w-2xl'} mx-auto flex flex-col gap-3.5`}>
          {section === 'home' && <>
            <UpNextCard items={assigned.slice(1)} now={now} onOpen={handlers.onOpen} onSeeAll={noop} />
            <StatStrip lift={false} className="grid-cols-3 sm:grid-flow-row sm:grid-cols-3" stats={[
              { label: 'Not opened yet', value: 2, tone: 'danger', note: '3 assigned' },
              { label: 'Past their time', value: 0, note: 'all within target' },
              { label: 'Avg. response', value: '6 min', note: 'to the first response' },
            ]} />
          </>}
          {section === 'active' && <AssignmentList items={assigned} now={now} onOpen={handlers.onOpen} empty="" />}
          {section === 'resolved' && <DoneList items={done} onOpen={handlers.onOpen} />}
          {section === 'stats' && <>
            <HandledChart days={handledByDay(incidents, 7, now)} />
            <ByTypeCard rows={resolvedByCategory(incidents)} />
          </>}
          {!['home', 'active', 'resolved', 'stats'].includes(section) && <Card className="p-4">Unknown view</Card>}
        </div>
      </DashboardFrame>
      <ResolveModal open={view === 'resolve'} onClose={() => setView('duty')} onResolve={noop} incident={assigned[0]} userId="sample" />
      {view === 'assignment' && (
        <AssignmentPanel inc={assigned[0]} now={now} busy={false} onClose={() => setView('duty')}
          onStamp={noop} onResolve={noop} onDirections={noop} onCall={noop} />
      )}
    </>
  )
}
