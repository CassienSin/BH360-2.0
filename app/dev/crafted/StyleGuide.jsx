'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Download, MapPin, ChevronLeft, MoreHorizontal, Bell, Mail, Lock, Phone, ChevronRight } from 'lucide-react'
import Band from '@/components/crafted/Band'
import TabBar from '@/components/crafted/TabBar'
import { BhIcon, BH_ICON_NAMES, InfrastructureIcon, NoiseIcon, FloodIcon, DocumentsIcon, TicketsIcon } from '@/components/icons/BhIcons'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card, CardHead } from '@/components/ui/card'
import { Tag, Status } from '@/components/ui/tag'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'
import { StatStrip } from '@/components/ui/stat-strip'
import { Rows, Row, RowTitle, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Toggle } from '@/components/ui/toggle'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { SectionLabel, Eyebrow, Muted } from '@/components/ui/text'
import { Skeleton } from '@/components/Skeletons'

const TOKENS = [
  ['--ink', 'headings'], ['--body', 'body text'], ['--text-muted', 'secondary'], ['--line', 'borders'],
  ['--page', 'page'], ['--surface', 'cards'], ['--surface-sunk', 'table head'], ['--track', 'tracks'],
  ['--brand', 'band end, charts'], ['--brand-strong', 'primary, links'], ['--brand-deep', 'hover'], ['--brand-soft', 'active nav'],
  ['--danger', 'emergency'], ['--danger-soft', ''], ['--ok', 'done'], ['--ok-soft', ''],
  ['--warn', 'waiting'], ['--warn-soft', ''], ['--info', 'assigned'], ['--info-soft', ''],
]

function Section({ title, note, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
        {note && <Muted>{note}</Muted>}
      </div>
      {children}
    </section>
  )
}

function Gallery() {
  const [seg, setSeg] = useState('active')
  const [bandSeg, setBandSeg] = useState('active')
  const [chips, setChips] = useState({ reports: true, tanods: true, heatmap: false })
  const [toggle, setToggle] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [selected, setSelected] = useState(1)

  return (
    <div className="space-y-10">
      <Section title="Tokens" note="DESIGN.md §2. The swatches follow the theme of this column.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TOKENS.map(([name, use]) => (
            <div key={name} className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface p-2">
              <span className="size-8 shrink-0 rounded-md border border-line" style={{ background: `var(${name})` }} />
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs text-ink">{name}</span>
                {use && <span className="block truncate text-xs text-muted-foreground">{use}</span>}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Sora, 400–800.">
        <Card className="p-[18px] space-y-2">
          <p className="text-[28px] font-extrabold tracking-[-0.7px] text-ink">Desktop title 28/800</p>
          <p className="text-[26px] font-extrabold tracking-[-0.6px] text-ink">Phone greeting 26/800</p>
          <p className="text-[17px] font-extrabold text-ink">Phone screen title 17/800</p>
          <p className="text-[15px] font-extrabold text-ink">Card title 15/800</p>
          <p className="text-sm font-bold text-ink">Row title 14/700</p>
          <p className="text-sm leading-[1.55] text-body">Body 14/400, line-height 1.55. Plain, local words: “Tanod on the way · about 5 min”.</p>
          <p className="text-[13px] text-muted-foreground">Secondary 13, muted</p>
          <SectionLabel as="p" className="mb-0">Section label</SectionLabel>
          <p className="text-2xl font-extrabold tracking-[-0.6px] tabular-nums text-ink">1,284</p>
        </Card>
      </Section>

      <Section title="Buttons" note="One primary per screen. Danger only for emergencies and destructive actions.">
        <Card className="p-[18px] space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button aria-busy="true">Saving…</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary">Small 34</Button>
            <Button variant="secondary"><Download /> Default 40</Button>
            <Button size="lg">Large 52</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label="Search" kind="plain"><Search size={18} strokeWidth={1.9} /></IconButton>
            <IconButton label="More" kind="plain" size="sm"><MoreHorizontal size={16} strokeWidth={1.9} /></IconButton>
            <IconButton label="Call" kind="ghost"><Phone size={18} strokeWidth={1.9} /></IconButton>
          </div>
          <Button full size="lg">Full-width large (footer bars)</Button>
        </Card>
        <div className="relative isolate overflow-hidden rounded-[14px] p-4">
          <Band mode="fill" dots={8} />
          <div className="relative z-[1] flex flex-wrap items-center gap-2">
            <Button variant="white"><Plus /> White on band</Button>
            <Button variant="onband"><MapPin /> Onband</Button>
            <IconButton label="Back" kind="onband"><ChevronLeft size={18} strokeWidth={1.9} /></IconButton>
            <IconButton label="Notifications" kind="onband"><Bell size={18} strokeWidth={1.9} /></IconButton>
          </div>
        </div>
      </Section>

      <Section title="Tags and status" note="Tag: height 22, radius 6. Status: a 7px dot, no background — for row states.">
        <Card className="p-[18px] space-y-3">
          <div className="flex flex-wrap gap-2">
            <Tag tone="danger">Critical</Tag><Tag tone="warn">High</Tag><Tag tone="quiet">Medium</Tag>
            <Tag tone="ok">Tanod</Tag><Tag tone="info">Processing</Tag><Tag tone="brand">Official</Tag>
          </div>
          <div className="flex flex-wrap gap-4">
            <Status tone="danger">Unassigned</Status><Status tone="warn">Waiting 3 h</Status><Status tone="ok">On the way</Status>
            <Status tone="info">Assigned</Status><Status tone="quiet">Resolved</Status>
          </div>
        </Card>
      </Section>

      <Section title="Card, rows and table" note="Rows divided by lines, no zebra. Selected: brand-soft with a 3px bar. Critical: a faint red tint.">
        <Card>
          <CardHead title="Waiting on you" sub="Sample rows" action={<Button variant="ghost" size="sm">View all</Button>} />
          <Rows className="border-t border-line">
            {[
              { icon: InfrastructureIcon, title: 'Streetlight out', sub: 'Ticket · Purok 2', status: <Status tone="warn">Waiting 3 h</Status> },
              { icon: NoiseIcon, title: 'Loud karaoke', sub: 'Report · Purok 3', status: <Status tone="info">Assigned</Status> },
              { icon: FloodIcon, title: 'Flooding near the creek', sub: 'Report · Riverside', status: <Status tone="danger">Unassigned</Status>, critical: true },
            ].map((r, i) => (
              <Row key={i} as="button" interactive selected={selected === i} critical={r.critical} onClick={() => setSelected(i)}
                className="flex items-center gap-3">
                <r.icon size={20} className={r.critical ? 'text-danger' : 'text-brand-strong'} />
                <RowTitle title={r.title} sub={r.sub} className="flex-1" />
                {r.status}
                <ChevronRight size={16} className="text-muted-foreground" />
              </Row>
            ))}
          </Rows>
        </Card>
        <Card>
          <Table>
            <THead><tr><TH>Priority</TH><TH>Report</TH><TH>Status</TH><TH className="text-right">Action</TH></tr></THead>
            <TBody>
              <TR critical><TD><Tag tone="danger">Critical</Tag></TD><TD><RowTitle title="Flooding near the creek" sub="Report #0415" /></TD><TD><Status tone="danger">Unassigned</Status></TD><TD className="text-right"><Button size="sm">Dispatch</Button></TD></TR>
              <TR><TD><Tag tone="warn">High</Tag></TD><TD><RowTitle title="Loud karaoke past midnight" sub="Report #0414" /></TD><TD><Status tone="info">Assigned</Status></TD><TD className="text-right"><Button size="sm" variant="secondary">Open</Button></TD></TR>
              <TR selected><TD><Tag>Medium</Tag></TD><TD><RowTitle title="Selected row" sub="Report #0412" /></TD><TD><Status tone="ok">On the way</Status></TD><TD className="text-right"><Button size="sm" variant="secondary">Open</Button></TD></TR>
            </TBody>
          </Table>
        </Card>
      </Section>

      <Section title="Fields">
        <Card className="p-[18px] grid gap-4 sm:grid-cols-2">
          <Field label="Email" icon={<Mail />} placeholder="name@email.com" type="email" />
          <Field label="Password" icon={<Lock />} type="password" placeholder="••••••••" hint="At least 8 characters." />
          <Field label="Short title" defaultValue="Too short" error="Give it a few more words." />
          <Field label="Photos" optional placeholder="Optional field" />
          <Field label="What did you see?" className="sm:col-span-2">
            <Textarea placeholder="Describe what happened" />
          </Field>
        </Card>
      </Section>

      <Section title="Segmented, chips, tabs">
        <Card className="p-[18px] space-y-4">
          <Segmented label="Filter reports" value={seg} onChange={setSeg}
            items={[{ value: 'active', label: 'Active', count: 4 }, { value: 'unassigned', label: 'Unassigned', count: 1 }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]} />
          <div className="flex flex-wrap gap-2">
            {Object.keys(chips).map(k => (
              <Chip key={k} active={chips[k]} onClick={() => setChips(c => ({ ...c, [k]: !c[k] }))}>{k[0].toUpperCase() + k.slice(1)}</Chip>
            ))}
            <Chip dot="var(--danger)">Critical</Chip><Chip dot="var(--brand-strong)">Normal</Chip>
          </div>
          <Tabs defaultValue="one">
            <TabsList><TabsTrigger value="one">Details</TabsTrigger><TabsTrigger value="two">Activity</TabsTrigger></TabsList>
            <TabsContent value="one"><Muted>Real tabs own a panel. Use Segmented for filters.</Muted></TabsContent>
            <TabsContent value="two"><Muted>The second panel.</Muted></TabsContent>
          </Tabs>
        </Card>
        <div className="relative isolate overflow-hidden rounded-[14px] p-4">
          <Band mode="fill" dots={8} />
          <div className="relative z-[1] max-w-sm">
            <Segmented onBand full label="My reports" value={bandSeg} onChange={setBandSeg}
              items={[{ value: 'active', label: 'Active', count: 1 }, { value: 'resolved', label: 'Resolved', count: 6 }]} />
          </div>
        </div>
      </Section>

      <Section title="Stat strip" note="Muted when zero, red only when overdue.">
        <StatStrip stats={[
          { label: 'Unassigned reports', value: 0, note: '2 this month' },
          { label: 'Tanods on duty', value: '1 of 2', note: 'one on a call', tone: 'ok' },
          { label: 'Tickets to reply', value: 2, note: 'oldest 3 h' },
          { label: 'Overdue KP case', value: 1, note: '2 days past', tone: 'danger' },
        ]} />
      </Section>

      <Section title="Avatar, progress, toggle">
        <Card className="p-[18px] space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name="Sample Resident" size="xs" /><Avatar name="Sample Resident" size="sm" />
            <Avatar name="Sample Tanod" tone="ok" /><Avatar name="Off Duty" tone="quiet" />
            <Avatar name="Sample User" tone="solid" color="#F97316" size="sm" /><Avatar name="Sample Resident" size="lg" />
          </div>
          <Progress value={3} label="Report progress" labels={['Received', 'Assigned', 'On the way', 'Resolved']} />
          <Progress value={2} tone="brand" label="Case stage" labels={['Filed', 'Mediation', 'Conciliation', 'Settled']} />
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-ink">Report updates</p><p className="text-xs text-muted-foreground">When a tanod is assigned or arrives</p></div>
            <Toggle checked={toggle} onCheckedChange={setToggle} label="Report updates" />
          </div>
        </Card>
      </Section>

      <Section title="Dialog and bottom sheet" note="Scrim rgba(26,24,48,.42). The sheet rises in 320ms on phones and is a centred card from 640px.">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Mark as resolved?</DialogTitle><DialogDescription>The resident is notified and can rate the response.</DialogDescription></DialogHeader>
              <DialogFooter><DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose><Button>Mark resolved</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="secondary" onClick={() => setSheet(true)}>Open bottom sheet</Button>
        </div>
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Close the report" description="Sample sheet"
          footer={<Button full size="lg" onClick={() => setSheet(false)}>Mark as resolved</Button>}>
          <Muted>Sheet content scrolls on its own; the page behind stays put.</Muted>
        </BottomSheet>
      </Section>

      <Section title="BH360 icons" note="Outline by default, solid when active. Lucide stays for generic glyphs only.">
        <Card className="p-[18px]">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {BH_ICON_NAMES.map(name => (
              <div key={name} className="flex flex-col items-center gap-1.5 text-brand-strong">
                <div className="flex gap-1.5"><BhIcon name={name} size={22} /><BhIcon name={name} size={22} active /></div>
                <span className="text-[11px] text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Tab bars" note="Phone layout only. The red Report button is the only red on a normal resident screen.">
        <div className="max-w-[390px] space-y-3">
          <div className="overflow-hidden rounded-[14px] border border-line pt-6"><TabBar role="resident" activeSection="home" preview /></div>
          <div className="overflow-hidden rounded-[14px] border border-line"><TabBar role="tanod" activeSection="active" preview /></div>
        </div>
      </Section>

      <Section title="Skeletons" note="--track blocks, radius 6–14, shaped like the real cards.">
        <Card className="p-[18px] space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-5 rounded-md" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
            <Skeleton className="h-[34px] w-20 rounded-[10px]" />
          </div>
          <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" />
        </Card>
      </Section>
    </div>
  )
}

/** The band at phone width: back, title, then a card overlapping it. */
function PhoneBand() {
  return (
    <div className="relative isolate w-[360px] max-w-full overflow-hidden rounded-[14px] border border-line bg-page" style={{ height: 300 }}>
      <div className="relative px-4 pt-4 pb-3.5">
        <Band extend={28} fade={84} seed={5} dots={12} />
        <div className="relative z-[1] flex items-center gap-2.5">
          <IconButton label="Back" kind="onband"><ChevronLeft size={18} strokeWidth={1.9} /></IconButton>
          <div className="min-w-0 flex-1"><p className="truncate text-[17px] font-extrabold text-white">Report an incident</p><p className="text-xs text-white/80">Step 1 of 2 · What happened?</p></div>
        </div>
      </div>
      <div className="relative z-[1] px-4 space-y-3.5">
        <Card lift>
          <Row className="flex items-center gap-3"><DocumentsIcon size={20} className="text-brand-strong" /><RowTitle title="Request a document" sub="Clearance, residency, indigency" /></Row>
          <Row className="flex items-center gap-3 border-t border-line"><TicketsIcon size={20} className="text-brand-strong" /><RowTitle title="Ask the barangay" sub="Chat with an official" /></Row>
        </Card>
      </div>
    </div>
  )
}

/** The band at desktop width: eyebrow, title, actions, the stat strip overlapping. */
function DesktopBand() {
  return (
    <div className="relative isolate overflow-hidden rounded-[14px] border border-line bg-page" style={{ height: 330 }}>
      <div className="relative px-7 pt-[18px] pb-5">
        <Band extend={24} fade={120} seed={2} />
        <div className="relative z-[1]">
          <p className="text-[13px] text-white/85">Sample barangay · 7:46 PM</p>
          <div className="mt-5 flex items-end gap-4">
            <div className="flex-1">
              <Eyebrow>Incidents</Eyebrow>
              <h3 className="mt-1.5 text-[28px] font-extrabold tracking-[-0.7px] text-white">Reports from residents</h3>
              <p className="mt-1.5 text-sm text-white/88">Critical reports stay at the top.</p>
            </div>
            <Button variant="onband"><MapPin /> Open map</Button>
            <Button variant="white"><Plus /> Log a walk-in report</Button>
          </div>
        </div>
      </div>
      <div className="relative z-[1] px-7">
        <StatStrip stats={[{ label: 'Unassigned', value: 0, note: 'none waiting' }, { label: 'On duty', value: '1 of 2', tone: 'ok' }, { label: 'Tickets', value: 2, note: 'oldest 3 h' }, { label: 'Overdue', value: 1, tone: 'danger', note: '2 days past' }]} />
      </div>
    </div>
  )
}

export default function StyleGuide() {
  const [theme, setTheme] = useState('light')
  const columns = theme === 'both' ? ['light', 'dark'] : [theme]
  return (
    <div className="min-h-dvh bg-page">
      <div className="relative isolate px-4 sm:px-7 pt-6 pb-6">
        <Band seed={1} />
        <div className="relative z-[1] mx-auto max-w-[1200px] flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <Eyebrow>BH360 · Crafted</Eyebrow>
            <h1 className="mt-1.5 text-[28px] font-extrabold tracking-[-0.7px] text-white">Style guide</h1>
            <p className="mt-1.5 text-sm text-white/88">
              Shells with sample data: <Link className="underline" href="/dev/crafted/frame?role=official">official</Link> ·{' '}
              <Link className="underline" href="/dev/crafted/frame?role=resident">resident</Link> ·{' '}
              <Link className="underline" href="/dev/crafted/frame?role=tanod">tanod</Link> ·{' '}
              <Link className="underline" href="/dev/crafted/auth">auth</Link> ·{' '}
              <Link className="underline" href="/dev/crafted/screen">phone screen</Link>
            </p>
          </div>
          <Segmented onBand label="Theme" value={theme} onChange={setTheme}
            items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'both', label: 'Both' }]} />
        </div>
      </div>

      <div className="relative z-[1] mx-auto max-w-[1200px] px-4 sm:px-7 pb-16 space-y-10">
        <Section title="The band" note="Gradient, banig weave, drifting dots, a soft fade into the page, cards overlapping it. Phone 84px fade, desktop 120px.">
          <div className={`grid gap-4 ${columns.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {columns.map(t => (
              <div key={t} data-ui-theme={t} className="space-y-4 rounded-[18px] bg-page p-3 sm:p-4">
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{t}</p>
                <PhoneBand />
                <DesktopBand />
              </div>
            ))}
          </div>
        </Section>

        <div className={`grid gap-6 ${columns.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {columns.map(t => (
            <div key={t} data-ui-theme={t} className="rounded-[18px] bg-page text-body p-3 sm:p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{t === 'dark' ? 'Dark (first pass, not applied in the app yet)' : 'Light'}</p>
              <Gallery />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
