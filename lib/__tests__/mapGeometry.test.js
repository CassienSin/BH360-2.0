import { describe, it, expect } from 'vitest'
import {
  overdueMs, isOverdue, urgency, circlePolygon, separateCoincident,
  clusterByOverlap, topPriority, lngLatBounds, RESPONSE_WINDOW_MS,
} from '../mapGeometry'

const NOW = Date.parse('2026-10-25T08:00:00Z')
const ago = ms => new Date(NOW - ms).toISOString()

describe('overdue', () => {
  it('counts only pending incidents past their window', () => {
    const late = { status: 'pending', priority: 'Critical', created_at: ago(RESPONSE_WINDOW_MS.Critical + 60000) }
    expect(overdueMs(late, NOW)).toBe(60000)
    expect(isOverdue(late, NOW)).toBe(true)
    expect(isOverdue({ ...late, status: 'assigned' }, NOW)).toBe(false)
    expect(isOverdue({ ...late, created_at: ago(60000) }, NOW)).toBe(false)
  })
  it('treats an unknown priority as Medium and a bad date as not overdue', () => {
    const inc = { status: 'pending', priority: 'Weird', created_at: ago(RESPONSE_WINDOW_MS.Medium + 1) }
    expect(isOverdue(inc, NOW)).toBe(true)
    expect(isOverdue({ status: 'pending', created_at: 'nope' }, NOW)).toBe(false)
  })
})

describe('urgency and topPriority', () => {
  it('ranks resolved lowest', () => {
    expect(urgency({ status: 'resolved', priority: 'Critical' })).toBe(0)
    expect(urgency({ status: 'pending', priority: 'Critical' })).toBe(4)
  })
  it('ignores resolved members when picking a group priority', () => {
    expect(topPriority([
      { status: 'resolved', priority: 'Critical' },
      { status: 'pending', priority: 'High' },
    ])).toBe('High')
    expect(topPriority([{ status: 'resolved', priority: 'High' }])).toBe(null)
  })
})

describe('circlePolygon', () => {
  it('returns a closed ring of the right radius', () => {
    const ring = circlePolygon([10, 123], 200, 32)
    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring[32])
    const dLatM = (ring[8][1] - 10) * 111320
    expect(Math.round(dLatM)).toBe(200)
  })
})

describe('separateCoincident', () => {
  it('leaves lone pins alone and moves stacked ones apart deterministically', () => {
    const a = { id: 'a', latitude: 10, longitude: 123 }
    const b = { id: 'b', latitude: 10, longitude: 123 }
    const c = { id: 'c', latitude: 10.01, longitude: 123 }
    const out = separateCoincident([a, b, c])
    const byId = Object.fromEntries(out.map(o => [o.incident.id, o]))
    expect(byId.c.offset).toBe(false)
    expect(byId.c.latitude).toBe(10.01)
    expect(byId.a.offset).toBe(true)
    expect([byId.a.latitude, byId.a.longitude]).not.toEqual([byId.b.latitude, byId.b.longitude])
    expect(separateCoincident([a, b, c])).toEqual(out)
  })
})

describe('clusterByOverlap', () => {
  // 1 degree = 1000 px, so 0.01 degrees apart = 10 px apart
  const project = ([lng, lat]) => ({ x: lng * 1000, y: -lat * 1000 })

  it('keeps pins that fit and merges only colliding ones', () => {
    const groups = clusterByOverlap([
      { id: '1', latitude: 0, longitude: 0, status: 'pending', priority: 'Low' },
      { id: '2', latitude: 0, longitude: 0.01, status: 'pending', priority: 'Critical' },
      { id: '3', latitude: 0, longitude: 1, status: 'pending', priority: 'Low' },
    ], project)
    expect(groups).toHaveLength(2)
    const big = groups.find(g => g.incidents.length === 2)
    expect(big.incidents[0].id).toBe('2')
    expect(big.longitude).toBeCloseTo(0.005)
  })

  it('returns one group per incident when nothing overlaps', () => {
    const groups = clusterByOverlap([
      { id: '1', latitude: 0, longitude: 0 },
      { id: '2', latitude: 0, longitude: 0.1 },
    ], project)
    expect(groups.map(g => g.incidents.length)).toEqual([1, 1])
  })
})

describe('lngLatBounds', () => {
  it('skips points without coordinates', () => {
    expect(lngLatBounds([{ latitude: 1, longitude: 2 }, { latitude: null }, { latitude: 3, longitude: 4 }]))
      .toEqual([[2, 1], [4, 3]])
    expect(lngLatBounds([])).toBe(null)
  })
})
