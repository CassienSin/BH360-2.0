'use client'
import { Shield, ShieldOff, Clock, Phone, AlertTriangle } from 'lucide-react'
import { LEGAL_BASIS } from '@/lib/legalBasis'

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
    bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a',
    Icon: Shield,
    title: (n) => `${n} tanod${n === 1 ? '' : 's'} on duty now`,
    body: 'Your report will be sent to them immediately.',
  },
  limited: {
    bg: '#fffbeb', border: '#fef3c7', color: '#b45309',
    Icon: Clock,
    title: () => 'No tanods on duty — officials are online',
    body: 'Your report will reach a barangay official, but nobody is in the field right now.',
  },
  unstaffed: {
    bg: '#fef2f2', border: '#fecaca', color: '#dc2626',
    Icon: ShieldOff,
    title: () => 'No one is on duty right now',
    body: 'Your report will be recorded and seen when the barangay comes online. For anything urgent, call an emergency number below.',
  },
}

export function AvailabilityStrip({ availability, compact = false }) {
  if (availability.loading || availability.error) return null

  const cfg = LEVELS[availability.level]
  const { Icon } = cfg

  return (
    <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      role="status" aria-live="polite">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'white' }}>
        <Icon size={15} style={{ color: cfg.color }} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black leading-tight" style={{ color: cfg.color }}>
          {cfg.title(availability.tanodCount)}
        </p>
        {!compact && (
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: cfg.color, opacity: 0.85 }}>
            {cfg.body}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * National emergency numbers, shown when the barangay cannot help fast
 * enough — either because nobody is on duty, or because the incident
 * legally belongs to an agency that operates 24/7 and the barangay does
 * not (RA 9514 fire, RA 8344 medical).
 */
const EMERGENCY_NUMBERS = [
  { label: 'National Emergency Hotline', number: '911', note: 'Fire, medical, police — 24/7' },
  { label: 'Philippine Red Cross', number: '143', note: 'Ambulance and rescue' },
]

export function EmergencyContacts({ category, availability, barangayPhone }) {
  const basis = category ? LEGAL_BASIS[category] : null
  const isCritical = basis?.priority === 'Critical'
  const mustRefer = basis?.responseMode === 'refer_to_agency'
  const unstaffed = availability?.level === 'unstaffed'

  // Show when the barangay legally can't handle it, or when nobody's there.
  if (!isCritical && !mustRefer && !unstaffed) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #fecaca' }}>
      <div className="px-4 py-3 flex items-start gap-2.5" style={{ background: '#dc2626' }}>
        <AlertTriangle size={16} className="text-white flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-xs font-black text-white leading-tight">
            {mustRefer && basis?.agency
              ? `${basis.agency} handles this — call them now`
              : 'Call for help directly'}
          </p>
          <p className="text-[11px] text-red-100 mt-0.5 leading-relaxed">
            {mustRefer
              ? 'The barangay will coordinate, but has no authority to respond to this itself.'
              : 'Do not wait for the barangay if lives are at risk.'}
          </p>
        </div>
      </div>

      <div className="p-2 space-y-1.5" style={{ background: '#fef2f2' }}>
        {EMERGENCY_NUMBERS.map(c => (
          <a key={c.number} href={`tel:${c.number}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-transform active:scale-95"
            style={{ background: 'white', border: '1px solid #fecaca' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#dc2626' }}>
              <Phone size={15} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900">{c.number}</p>
              <p className="text-[10px] text-gray-500 truncate">{c.label} · {c.note}</p>
            </div>
          </a>
        ))}

        {barangayPhone && (
          <a href={`tel:${barangayPhone.replace(/[^0-9+]/g, '')}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-transform active:scale-95"
            style={{ background: 'white', border: '1px solid #e8e3ff' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
              <Phone size={15} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900">{barangayPhone}</p>
              <p className="text-[10px] text-gray-500">Barangay hall</p>
            </div>
          </a>
        )}
      </div>
    </div>
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

  const state = offDutyFallback ? 'offduty' : assigned ? 'assigned' : 'unassigned'

  const cfg = {
    assigned: {
      bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a', Icon: Shield,
      title: 'A tanod has been assigned',
      body: 'They have been notified and can see your report now.',
    },
    offduty: {
      bg: '#fffbeb', border: '#fef3c7', color: '#b45309', Icon: Clock,
      title: 'Assigned, but no tanod is on duty',
      body: 'Your report went to the most recently active tanod, who may not be working right now. If this is urgent, call the numbers below.',
    },
    unassigned: {
      bg: '#fef2f2', border: '#fecaca', color: '#dc2626', Icon: ShieldOff,
      title: 'No responder is available right now',
      body: 'Your report is recorded and officials will see it when they come online. If anyone is in danger, call an emergency number now.',
    },
  }[state]

  const { Icon } = cfg

  return (
    <div className="space-y-4 fade-up">
      <div className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
        role="status">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'white' }}>
          <Icon size={18} style={{ color: cfg.color }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight" style={{ color: cfg.color }}>{cfg.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: cfg.color, opacity: 0.85 }}>{cfg.body}</p>
        </div>
      </div>

      {(state !== 'assigned' || basis?.responseMode === 'refer_to_agency') && (
        <EmergencyContacts
          category={incident?.category}
          availability={availability}
          barangayPhone={barangayPhone}
        />
      )}

      <button onClick={onDone}
        className="btn-primary w-full py-3.5 rounded-2xl text-white font-semibold text-sm">
        Back to dashboard
      </button>
    </div>
  )
}