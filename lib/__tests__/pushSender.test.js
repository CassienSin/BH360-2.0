import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendNotification = vi.fn()
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a) => sendNotification(...a) } }))

const { sendToDevices } = await import('../pushSender')

function fakeAdmin() {
  const removed = []
  const admin = {
    from: () => ({ delete: () => ({ in: async (_col, ids) => { removed.push(...ids); return { error: null } } }) }),
  }
  return { admin, removed }
}

const sub = (id) => ({ id, endpoint: `https://push.example/${id}`, p256dh: 'k', auth: 'a' })

describe('sendToDevices', () => {
  beforeEach(() => sendNotification.mockReset())

  it('passes the urgency and TTL to the push service', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 })
    const { admin } = fakeAdmin()
    const result = await sendToDevices(admin, [sub('a')], { title: 'Hi' }, { urgency: 'high', ttl: 86400 })
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } },
      JSON.stringify({ title: 'Hi' }),
      { TTL: 86400, urgency: 'high' }
    )
    expect(result).toEqual({ sent: 1, failed: 0, removed: 0 })
  })

  it('deletes devices the push service says are gone (404/410), and only those', async () => {
    sendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 500, body: 'try later' })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, removed } = fakeAdmin()
    const result = await sendToDevices(admin, [sub('ok'), sub('gone'), sub('missing'), sub('flaky')], {}, { urgency: 'normal', ttl: 60 })
    expect(result).toEqual({ sent: 1, failed: 3, removed: 2 })
    expect(removed).toEqual(['gone', 'missing'])
    expect(error).toHaveBeenCalledTimes(1) // the 500 is logged, kept, and retried next time
    error.mockRestore()
  })
})
