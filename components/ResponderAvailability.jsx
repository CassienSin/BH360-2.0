'use client'
import { Phone, AlertTriangle } from 'lucide-react'
import { LEGAL_BASIS } from '@/lib/legalBasis'
import { hotlinesFor, telHref } from '@/lib/hotlines'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Notice } from '@/components/ui/notice'
import { Button } from '@/components/ui/button'

/**
 * Tells the resident, before and after they submit, whether anyone is
 * actually available to receive their report.
 *
 * The uncomfortable design choice here is deliberate: this will often say
 * "nobody is on duty," which makes the barangay look unavailable. That is
 * the correct trade. A resident who knows nobody is on duty calls an
 * emergency agency in seconds; a resident who assumes a tanod is coming
 * waits twenty minutes. Honest bad news beats comfortable silence.
 */

const LEVELS = {
  staffed: {
    tone: 'ok',
    title: (n) => `${n} tanod${n === 1 ? '' : 's'} on duty now.`,
    body: 'Your report goes to them right away.',
  },
  limited: {
    tone: 'warn',
    title: () => 'No tanods on duty; officials are online.',
    body: 'Your report will reach a barangay official, but nobody is in the field right now.',
  },
  unstaffed: {
    tone: 'danger',
    title: () => 'No one is on duty right now.',
    body: 'Your report will be recorded and seen when the barangay comes online. For anything urgent, call an emergency number.',
  },
}

export function AvailabilityStrip({ availability, compact = false }) {
  if (availability.loading || availability.error) return null

  const cfg = LEVELS[availability.level]

  return (
    <Notice tone={cfg.tone} title={cfg.title(availability.tanodCount)} role="status" aria-live="polite">
      {!compact && cfg.body}
    </Notice>
  )
}

/**
 * Emergency numbers, shown when the barangay cannot help fast enough —
 * either because nobody is on duty, or because the incident legally
 * belongs to an agency that operates 24/7 and the barangay does not
 * (RA 9514 fire, RA 8344 medical). Unified 911 covers police, fire and
 * ambulance (lib/hotlines.js).
 */
export function EmergencyContacts({ category, availability, barangayPhone }) {
  const basis = category ? LEGAL_BASIS[category] : null
  const isCritical = basis?.priority === 'Critical'
  const mustRefer = basis?.responseMode === 'refer_to_agency'
  const unstaffed = availability?.level === 'unstaffed'

  // Show when the barangay legally can't handle it, or when nobody's there.
  if (!isCritical && !mustRefer && !unstaffed) return null

  const lines = hotlinesFor(barangayPhone).filter(l => l.number)

  return (
    <Card className="border-[color-mix(in_srgb,var(--danger)_35%,var(--line))]">
      <div className="flex items-start gap-2.5 bg-danger-soft px-[18px] py-3">
        <AlertTriangle size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-ink">
            {mustRefer && basis?.agency ? `${basis.agency} handles this. Call them now.` : 'Call for help directly.'}
          </p>
          <p className="mt-0.5 text-[13px] text-body">
            {mustRefer
              ? 'The barangay will coordinate, but has no authority to respond to this itself.'
              : 'Don’t wait for the barangay if lives are at risk.'}
          </p>
        </div>
      </div>
      <Rows className="border-t border-line">
        {lines.map(line => (
          <Row key={line.key} as="a" href={telHref(line.number)} interactive aria-label={`Call ${line.name}, ${line.number}`} className="flex items-center gap-3">
            <Phone size={18} strokeWidth={1.9} aria-hidden="true" className={`shrink-0 ${line.danger ? 'text-danger' : 'text-brand-strong'}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{line.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{line.desc}</span>
            </span>
            <span className="text-sm font-extrabold tabular-nums text-ink">{line.number}</span>
          </Row>
        ))}
      </Rows>
    </Card>
  )
}

/**
 * Post-submit confirmation. Replaces "Reported successfully!" with the
 * truth: was anyone actually assigned, and if not, what should the
 * resident do next?
 */
export function ReportOutcome({ incident, availability, barangayPhone, onDone }) {
  const assigned = Boolean(incident?.assigned_to)
  const offDutyFallback = incident?.assignment_method === 'auto_offduty'
  const basis = LEGAL_BASIS[incident?.category]

  // A report that never reached the database is not "recorded and officials
  // will see it" — it is on this phone. Saying otherwise to someone who has
  // just reported a fire is the worst lie this screen could tell.
  const state = incident?.queuedOffline
    ? 'queued'
    : offDutyFallback ? 'offduty' : assigned ? 'assigned' : 'unassigned'

  const cfg = {
    queued: {
      tone: 'info',
      title: 'Saved on this phone, not sent yet.',
      body: 'You have no connection, so nobody at the barangay can see this yet. It sends by itself the moment you are back online. If anyone is in danger, call the numbers below now.',
    },
    assigned: {
      tone: 'ok',
      title: 'A tanod has been assigned.',
      body: 'They have been notified and can see your report now.',
    },
    offduty: {
      tone: 'warn',
      title: 'Assigned, but no tanod is on duty.',
      body: 'Your report went to the most recently active tanod, who may not be working right now. If this is urgent, call the numbers below.',
    },
    unassigned: {
      tone: 'danger',
      title: 'No responder is available right now.',
      body: 'Your report is recorded and officials will see it when they come online. If anyone is in danger, call an emergency number now.',
    },
  }[state]

  return (
    <div className="flex flex-col gap-3.5">
      <Notice tone={cfg.tone} title={cfg.title} role="status">{cfg.body}</Notice>

      {(state !== 'assigned' || basis?.responseMode === 'refer_to_agency') && (
        <EmergencyContacts
          category={incident?.category}
          availability={availability}
          barangayPhone={barangayPhone}
        />
      )}

      <Button size="lg" full onClick={onDone}>Back to home</Button>
    </div>
  )
}
