import { describe, it, expect, vi } from 'vitest'
import { subscribeWhenSignedIn } from '../realtime'

// A client whose session token arrives when the test says so.
function fakeClient({ fail = false } = {}) {
  let release
  const authed = new Promise((resolve, reject) => { release = () => (fail ? reject(new Error('no session')) : resolve()) })
  const order = []
  const supabase = {
    realtime: { setAuth: vi.fn(() => { order.push('setAuth'); return authed.then(() => order.push('token loaded')) }) },
    removeChannel: vi.fn(async () => { order.push('removed'); return 'ok' }),
  }
  const channel = { subscribe: vi.fn((cb) => { order.push('joined'); return cb }) }
  return { supabase, channel, order, release }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('subscribeWhenSignedIn', () => {
  it('joins only after the session token has loaded', async () => {
    const { supabase, channel, order, release } = fakeClient()
    subscribeWhenSignedIn(supabase, channel)
    await settle()
    expect(channel.subscribe).not.toHaveBeenCalled()
    release()
    await settle()
    expect(order).toEqual(['setAuth', 'token loaded', 'joined'])
  })

  it('passes the status callback through to subscribe', async () => {
    const { supabase, channel, release } = fakeClient()
    const onStatus = () => {}
    subscribeWhenSignedIn(supabase, channel, onStatus)
    release()
    await settle()
    expect(channel.subscribe).toHaveBeenCalledWith(onStatus)
  })

  it('never joins when left before the token loaded (unmounted)', async () => {
    const { supabase, channel, order, release } = fakeClient()
    const leave = subscribeWhenSignedIn(supabase, channel)
    await settle() // the token is loading…
    await leave() // …and the component unmounts
    release()
    await settle()
    expect(channel.subscribe).not.toHaveBeenCalled()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
    expect(order).toEqual(['setAuth', 'removed', 'token loaded'])
  })

  it('never joins when left in the same tick it was set up', async () => {
    const { supabase, channel, release } = fakeClient()
    const leave = subscribeWhenSignedIn(supabase, channel)
    await leave()
    release()
    await settle()
    expect(channel.subscribe).not.toHaveBeenCalled()
  })

  it('removes a joined channel on leave', async () => {
    const { supabase, channel, release } = fakeClient()
    const leave = subscribeWhenSignedIn(supabase, channel)
    release()
    await settle()
    await leave()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('still joins if the token cannot be loaded', async () => {
    const { supabase, channel, release } = fakeClient({ fail: true })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    subscribeWhenSignedIn(supabase, channel)
    release()
    await settle()
    expect(channel.subscribe).toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
