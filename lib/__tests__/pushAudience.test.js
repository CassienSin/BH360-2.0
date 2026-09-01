import { describe, it, expect } from 'vitest'
import { incidentNotification, ticketReplyAudience } from '@/lib/pushAudience'

const RESIDENT = 'r-1'
const OFFICIAL_A = 'o-1'
const OFFICIAL_B = 'o-2'

const ticket = {
  id: 't-9',
  title: 'Streetlight out',
  created_by: RESIDENT,
  barangay_id: 'b-1',
}

describe('ticketReplyAudience — who hears a reply', () => {
  it('sends a resident\'s message to the barangay officials', () => {
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: RESIDENT, message: 'Any update?' },
      sender: { full_name: 'Sayed', role: 'resident' },
      officialIds: [OFFICIAL_A, OFFICIAL_B],
    })
    expect(userIds.sort()).toEqual([OFFICIAL_A, OFFICIAL_B])
  })

  it('sends an official\'s reply to the resident who opened the ticket', () => {
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: OFFICIAL_A, message: 'Crew tomorrow.' },
      sender: { full_name: 'Kap. Reyes', role: 'official' },
      officialIds: [OFFICIAL_A, OFFICIAL_B],
    })
    // Not the other official, and not the sender — only the resident.
    expect(userIds).toEqual([RESIDENT])
  })

  it('never pushes someone their own message back', () => {
    // The sender's own phone would otherwise buzz for what they just typed,
    // and a second device of theirs is worse: it looks like a reply.
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: OFFICIAL_A, message: 'hi' },
      sender: { role: 'official' },
      officialIds: [OFFICIAL_A, OFFICIAL_B],
    })
    expect(userIds).not.toContain(OFFICIAL_A)
  })

  it('drops the sender even when they are also the ticket author', () => {
    // A resident replying on their own ticket: officials get it, they do not.
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: RESIDENT, message: 'still broken' },
      sender: { role: 'resident' },
      officialIds: [OFFICIAL_A, RESIDENT], // a resident wrongly listed as official
    })
    expect(userIds).toEqual([OFFICIAL_A])
  })

  it('de-duplicates so one person is not pushed twice for one message', () => {
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: RESIDENT, message: 'hello' },
      sender: { role: 'resident' },
      officialIds: [OFFICIAL_A, OFFICIAL_A, OFFICIAL_B],
    })
    expect(userIds).toEqual([OFFICIAL_A, OFFICIAL_B])
  })

  it('notifies nobody rather than everybody when there are no officials', () => {
    const { userIds } = ticketReplyAudience({
      ticket,
      message: { sender_id: RESIDENT, message: 'hello' },
      sender: { role: 'resident' },
      officialIds: [],
    })
    expect(userIds).toEqual([])
  })

  it('survives a ticket with no author rather than pushing a null id', () => {
    const { userIds } = ticketReplyAudience({
      ticket: { ...ticket, created_by: null },
      message: { sender_id: OFFICIAL_A, message: 'hello' },
      sender: { role: 'official' },
      officialIds: [OFFICIAL_A],
    })
    expect(userIds).toEqual([])
  })
})

describe('ticketReplyAudience — what it says', () => {
  it('names the sender and the ticket, so it is readable on a lock screen', () => {
    const { notification } = ticketReplyAudience({
      ticket,
      message: { sender_id: OFFICIAL_A, message: 'Crew tomorrow.', created_at: '2026-09-01T10:00:00Z' },
      sender: { full_name: 'Kap. Reyes', role: 'official' },
      officialIds: [],
    })
    expect(notification.title).toBe('Kap. Reyes replied')
    expect(notification.body).toContain('Streetlight out')
    expect(notification.body).toContain('Crew tomorrow.')
    expect(notification.timestamp).toBe('2026-09-01T10:00:00Z')
  })

  it('opens the recipient\'s own view of the ticket, not the sender\'s', () => {
    // Sending a resident an /official/ URL would land them on a page RLS
    // refuses to fill.
    const fromOfficial = ticketReplyAudience({
      ticket, message: { sender_id: OFFICIAL_A }, sender: { role: 'official' }, officialIds: [],
    })
    expect(fromOfficial.notification.url).toBe('/resident/ticket/t-9')

    const fromResident = ticketReplyAudience({
      ticket, message: { sender_id: RESIDENT }, sender: { role: 'resident' }, officialIds: [OFFICIAL_A],
    })
    expect(fromResident.notification.url).toBe('/official/ticket/t-9')
  })

  it('collapses a burst of replies onto one ticket rather than stacking them', () => {
    const first = ticketReplyAudience({
      ticket, message: { sender_id: OFFICIAL_A, message: 'a' }, sender: {}, officialIds: [],
    })
    const second = ticketReplyAudience({
      ticket, message: { sender_id: OFFICIAL_A, message: 'b' }, sender: {}, officialIds: [],
    })
    expect(first.notification.tag).toBe(second.notification.tag)
  })

  it('falls back to a role-appropriate name when the profile has none', () => {
    expect(ticketReplyAudience({
      ticket, message: { sender_id: OFFICIAL_A }, sender: { role: 'official' }, officialIds: [],
    }).notification.title).toBe('The barangay replied')

    expect(ticketReplyAudience({
      ticket, message: { sender_id: RESIDENT }, sender: { role: 'resident' }, officialIds: [],
    }).notification.title).toBe('A resident replied')
  })
})

describe('incidentNotification', () => {
  it('leads with Critical so the urgency survives a lock screen glance', () => {
    const n = incidentNotification({
      id: 'i-1', category: 'Fire', title: 'House fire', location: 'Mabini St',
    })
    expect(n.priority).toBe('Critical')
    expect(n.title).toMatch(/^Critical · /)
    expect(n.url).toBe('/official/incident/i-1')
  })

  it('does not shout for an ordinary report', () => {
    const n = incidentNotification({
      id: 'i-2', category: 'Garbage', title: 'Uncollected', location: 'Purok 3',
    })
    expect(n.priority).not.toBe('Critical')
    expect(n.title).toMatch(/^New report · /)
  })

  it('honours a priority an official set by hand over the category default', () => {
    const n = incidentNotification({
      id: 'i-3', category: 'Garbage', priority: 'Critical', title: 'Chemical dump',
    })
    expect(n.title).toMatch(/^Critical · /)
  })
})
