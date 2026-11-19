import { describe, it, expect } from 'vitest'
import { waitingOnOfficial, waitingFor } from '@/lib/officialQueue'

const NOW = new Date('2026-11-18T12:00:00+08:00').getTime()
const hoursAgo = h => new Date(NOW - h * 3600e3).toISOString()
const daysFromNow = d => new Date(NOW + d * 24 * 3600e3).toISOString()

describe('waitingFor', () => {
  it('says how long something has waited, in short units', () => {
    expect(waitingFor(hoursAgo(0.25), NOW)).toBe('Waiting 15 min')
    expect(waitingFor(hoursAgo(3), NOW)).toBe('Waiting 3 h')
    expect(waitingFor(hoursAgo(50), NOW)).toBe('Waiting 2 d')
  })
})

describe('waitingOnOfficial', () => {
  it('puts an overdue case first, then a critical unassigned report, then the rest', () => {
    const items = waitingOnOfficial({
      now: NOW,
      tickets: [{ id: 't1', status: 'open', title: 'Streetlight', created_at: hoursAgo(3) }],
      incidents: [
        { id: 'i1', status: 'pending', priority: 'Medium', title: 'Noise', created_at: hoursAgo(1) },
        { id: 'i2', status: 'pending', priority: 'Critical', title: 'Fire', created_at: hoursAgo(0.5) },
      ],
      cases: [{ id: 'c1', status: 'mediation', case_number: 'KP-1', mediation_due_at: daysFromNow(-2) }],
      users: [{ id: 'u1', full_name: 'Maria', verification_status: 'pending', created_at: hoursAgo(5) }],
    })
    expect(items.map(i => i.id)).toEqual(['c1', 'i2', 'i1', 't1', 'u1'])
    expect(items[0]).toMatchObject({ tone: 'danger', action: 'Review', when: 'Overdue 2 days' })
    expect(items[1]).toMatchObject({ tone: 'danger', action: 'Assign' })
    expect(items[3]).toMatchObject({ tone: 'warn', action: 'Reply', when: 'Waiting 3 h' })
  })

  it('leaves out what is settled, assigned, answered, verified or the official themself', () => {
    const items = waitingOnOfficial({
      now: NOW, selfId: 'me',
      tickets: [{ id: 't1', status: 'in_progress', created_at: hoursAgo(3) }],
      incidents: [
        { id: 'i1', status: 'resolved', created_at: hoursAgo(1) },
        { id: 'i2', status: 'pending', assigned_to: 'tanod', created_at: hoursAgo(1) },
      ],
      cases: [{ id: 'c1', status: 'mediation', mediation_due_at: daysFromNow(10) }],
      users: [
        { id: 'me', verification_status: 'pending' },
        { id: 'u2', verification_status: 'verified' },
        { id: 'u3', verification_status: 'pending', is_super_admin: true },
      ],
    })
    expect(items).toEqual([])
  })

  it('treats an account with no verification status as still pending', () => {
    const items = waitingOnOfficial({ now: NOW, users: [{ id: 'u1', full_name: 'Jose', created_at: hoursAgo(30) }] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'verification', action: 'Verify' })
  })
})
