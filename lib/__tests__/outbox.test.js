import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * A queued action is a promise to a tanod standing in the field that their
 * tap was not lost. These cover the ways that promise could quietly break:
 * replaying out of order, replaying twice, or one bad item wedging the
 * queue forever.
 */

// A stand-in for the IndexedDB layer, faithful about the part that matters:
// put() assigns an increasing id, and getAll() returns insertion order.
function fakeDb() {
  let nextId = 1
  const stores = { outbox: new Map(), snapshots: new Map() }
  return {
    stores,
    module: {
      OUTBOX: 'outbox',
      SNAPSHOTS: 'snapshots',
      put: vi.fn(async (store, value) => {
        const id = value.id ?? nextId++
        const key = store === 'outbox' ? id : value.key
        stores[store].set(key, { ...value, id })
        return id
      }),
      get: vi.fn(async (store, key) => stores[store].get(key) ?? undefined),
      all: vi.fn(async (store) => [...stores[store].values()]),
      del: vi.fn(async (store, key) => { stores[store].delete(key) }),
      clear: vi.fn(async (store) => { stores[store].clear() }),
    },
  }
}

let db
let outbox

beforeEach(async () => {
  vi.resetModules()
  db = fakeDb()
  vi.doMock('@/lib/offline/db', () => db.module)
  outbox = await import('@/lib/offline/outbox')
})

const ok = () => ({ ok: true })

describe('enqueue', () => {
  it('refuses a kind nothing knows how to replay', async () => {
    // Better to fail at the call site than to store something that will
    // sit in the queue forever.
    await expect(outbox.enqueue('incident.teleport', {})).rejects.toThrow(/Unknown outbox kind/)
  })

  it('returns null when storage refused, so the caller cannot claim it saved', async () => {
    // Private mode, a quota, an embedded webview. "We'll send it later" has
    // to be true.
    db.module.put.mockResolvedValueOnce(null)
    const saved = await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    expect(saved).toBeNull()
  })

  it('stamps when it was queued', async () => {
    const saved = await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    expect(saved.queuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('pending', () => {
  it('returns oldest first — the order they were taken', async () => {
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    await outbox.enqueue(outbox.KINDS.ARRIVE, { id: 'i1' })
    await outbox.enqueue(outbox.KINDS.RESOLVE, { id: 'i1' })
    const items = await outbox.pending()
    expect(items.map(i => i.kind)).toEqual([
      outbox.KINDS.ACKNOWLEDGE, outbox.KINDS.ARRIVE, outbox.KINDS.RESOLVE,
    ])
  })

  it('keeps one person\'s queue off another\'s screen', async () => {
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' }, { userId: 'a' })
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i2' }, { userId: 'b' })
    expect(await outbox.pending('a')).toHaveLength(1)
  })
})

describe('drain', () => {
  it('replays in order and clears what succeeded', async () => {
    const seen = []
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    await outbox.enqueue(outbox.KINDS.ARRIVE, { id: 'i1' })

    const result = await outbox.drain({
      [outbox.KINDS.ACKNOWLEDGE]: async p => { seen.push(['ack', p.id]); return ok() },
      [outbox.KINDS.ARRIVE]: async p => { seen.push(['arrive', p.id]); return ok() },
    })

    expect(seen).toEqual([['ack', 'i1'], ['arrive', 'i1']])
    expect(result).toMatchObject({ sent: 2, remaining: 0 })
    expect(await outbox.pending()).toHaveLength(0)
  })

  it('stops at a failure instead of pushing past it', async () => {
    // An arrival that lands before its own acknowledgement tells the
    // barangay a story that did not happen.
    const seen = []
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    await outbox.enqueue(outbox.KINDS.ARRIVE, { id: 'i1' })

    const result = await outbox.drain({
      [outbox.KINDS.ACKNOWLEDGE]: async () => ({ ok: false }),
      [outbox.KINDS.ARRIVE]: async () => { seen.push('arrive'); return ok() },
    })

    expect(seen).toEqual([])
    expect(result).toMatchObject({ sent: 0, failed: 1, remaining: 2 })
    expect(await outbox.pending()).toHaveLength(2)
  })

  it('keeps a failed item for the next attempt', async () => {
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    await outbox.drain({ [outbox.KINDS.ACKNOWLEDGE]: async () => ({ ok: false }) })
    const second = await outbox.drain({ [outbox.KINDS.ACKNOWLEDGE]: async () => ok() })
    expect(second).toMatchObject({ sent: 1, remaining: 0 })
  })

  it('drops an item that can never succeed rather than retrying forever', async () => {
    // The incident was deleted while the tanod had no signal.
    await outbox.enqueue(outbox.KINDS.RESOLVE, { id: 'gone' })
    const result = await outbox.drain({
      [outbox.KINDS.RESOLVE]: async () => ({ ok: false, permanent: true }),
    })
    expect(result).toMatchObject({ dropped: 1, remaining: 0 })
    expect(await outbox.pending()).toHaveLength(0)
  })

  it('drops a kind this build no longer knows, which would wedge the queue', async () => {
    await outbox.enqueue(outbox.KINDS.DUTY, { onDuty: true })
    const result = await outbox.drain({})   // no handlers at all
    expect(result).toMatchObject({ dropped: 1, remaining: 0 })
  })

  it('treats a handler that throws as a failure, not a crash', async () => {
    await outbox.enqueue(outbox.KINDS.ACKNOWLEDGE, { id: 'i1' })
    const result = await outbox.drain({
      [outbox.KINDS.ACKNOWLEDGE]: async () => { throw new Error('network') },
    })
    expect(result).toMatchObject({ failed: 1, remaining: 1 })
    expect(await outbox.pending()).toHaveLength(1)
  })

  it('is a no-op on an empty queue', async () => {
    expect(await outbox.drain({})).toMatchObject({ sent: 0, remaining: 0 })
  })
})

describe('describe', () => {
  it('names a single waiting action rather than counting it', async () => {
    expect(outbox.describe([{ kind: outbox.KINDS.ACKNOWLEDGE }])).toBe('an acknowledgement')
    expect(outbox.describe([{ kind: outbox.KINDS.REPORT }])).toBe('an incident report')
  })
  it('counts once there is more than one', () => {
    expect(outbox.describe([{ kind: 'a' }, { kind: 'b' }])).toBe('2 actions')
  })
  it('says nothing when nothing is waiting', () => {
    expect(outbox.describe([])).toBeNull()
  })
})
