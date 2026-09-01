import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The bug these cover: the siren stayed silent through the first critical
 * incident and only started once someone pressed Mute and then Unmute —
 * because that click was the user gesture the browser had been waiting for
 * before it would let the page make any sound at all.
 */

/** A stand-in for the real thing, faithful about the parts that bit us:
 *  it starts suspended, resume() only works once a gesture has happened,
 *  and currentTime does not advance while suspended. */
function makeAudioContextClass({ gestureRequired = true } = {}) {
  const instances = []
  let hadGesture = !gestureRequired

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended'
      this.currentTime = 0
      this.started = []
      this.destination = { name: 'destination' }
      instances.push(this)
    }
    async resume() {
      if (!hadGesture) return           // exactly what Chrome does: no-op
      this.state = 'running'
      this.currentTime = 12.5           // the clock only moves once running
    }
    createOscillator() {
      const started = this.started
      return {
        type: '', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, stop() {},
        start(t) { started.push(t) },
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
      }
    }
  }

  return { FakeAudioContext, instances, grantGesture() { hadGesture = true } }
}

/** Minimal window with an event bus, so we can fire a real "click". */
function makeWindow(AudioContextClass) {
  const handlers = {}
  return {
    AudioContext: AudioContextClass,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn) },
    removeEventListener(type, fn) {
      handlers[type] = (handlers[type] || []).filter(h => h !== fn)
    },
    dispatch(type) { for (const fn of [...(handlers[type] || [])]) fn() },
    handlerCount(type) { return (handlers[type] || []).length },
  }
}

// Module-level state (the shared AudioContext) has to be thrown away
// between tests, so each one imports a fresh copy.
async function freshModule() {
  vi.resetModules()
  return import('@/lib/audioAlert')
}

let win
afterEach(() => { vi.unstubAllGlobals(); win = null })

describe('playSiren before any user gesture', () => {
  beforeEach(() => {
    const { FakeAudioContext } = makeAudioContextClass()
    win = makeWindow(FakeAudioContext)
    vi.stubGlobal('window', win)
  })

  it('reports failure instead of pretending it played', async () => {
    const { playSiren, isAudioUnlocked } = await freshModule()
    expect(await playSiren()).toBe(false)
    expect(isAudioUnlocked()).toBe(false)
  })

  it('schedules nothing, so no note is lost to a frozen clock', async () => {
    const { FakeAudioContext, instances } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { playSiren } = await freshModule()
    await playSiren()
    expect(instances[0].started).toEqual([])
  })
})

describe('playSiren once the gesture has happened', () => {
  it('sounds, and reads the clock AFTER resume rather than before', async () => {
    // The original code captured currentTime while the context was still
    // suspended — 0 — then scheduled the envelope against it, so by the
    // time the context started the note was already in the past.
    const { FakeAudioContext, instances, grantGesture } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { playSiren, primeAudio, isAudioUnlocked } = await freshModule()

    grantGesture()
    expect(await primeAudio()).toBe(true)
    expect(isAudioUnlocked()).toBe(true)

    expect(await playSiren()).toBe(true)
    expect(instances[0].started).toEqual([12.5])
  })

  it('reuses one context rather than leaking one per blast', async () => {
    // Browsers cap the number of AudioContexts a page may hold; a siren
    // that repeats every 3s until acknowledged would hit that cap.
    const { FakeAudioContext, instances, grantGesture } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { playSiren, primeAudio } = await freshModule()
    grantGesture()
    await primeAudio()
    await playSiren(); await playSiren(); await playSiren()
    expect(instances).toHaveLength(1)
    expect(instances[0].started).toHaveLength(3)
  })
})

describe('installAudioPrimer', () => {
  it('unlocks on the first interaction, before any incident arrives', async () => {
    const { FakeAudioContext, grantGesture } = makeAudioContextClass()
    const w = makeWindow(FakeAudioContext)
    vi.stubGlobal('window', w)
    const { installAudioPrimer, isAudioUnlocked, playSiren } = await freshModule()

    installAudioPrimer()
    expect(isAudioUnlocked()).toBe(false)

    grantGesture()
    w.dispatch('pointerdown')
    await Promise.resolve(); await Promise.resolve()

    expect(isAudioUnlocked()).toBe(true)
    expect(await playSiren()).toBe(true)
  })

  it('listens for keyboard and iOS touch too, not just the mouse', async () => {
    const { FakeAudioContext } = makeAudioContextClass()
    const w = makeWindow(FakeAudioContext)
    vi.stubGlobal('window', w)
    const { installAudioPrimer } = await freshModule()
    installAudioPrimer()
    expect(w.handlerCount('pointerdown')).toBe(1)
    expect(w.handlerCount('keydown')).toBe(1)
    expect(w.handlerCount('touchend')).toBe(1)
  })

  it('keeps listening after unlocking, since mobile re-suspends on background', async () => {
    const { FakeAudioContext, grantGesture } = makeAudioContextClass()
    const w = makeWindow(FakeAudioContext)
    vi.stubGlobal('window', w)
    const { installAudioPrimer } = await freshModule()
    installAudioPrimer()
    grantGesture()
    w.dispatch('pointerdown')
    await Promise.resolve(); await Promise.resolve()
    expect(w.handlerCount('pointerdown')).toBe(1)
  })

  it('removes its listeners on cleanup', async () => {
    const { FakeAudioContext } = makeAudioContextClass()
    const w = makeWindow(FakeAudioContext)
    vi.stubGlobal('window', w)
    const { installAudioPrimer } = await freshModule()
    installAudioPrimer()()
    expect(w.handlerCount('pointerdown')).toBe(0)
    expect(w.handlerCount('keydown')).toBe(0)
    expect(w.handlerCount('touchend')).toBe(0)
  })
})

describe('onAudioUnlockChange', () => {
  it('tells the alert when sound becomes possible, so it can drop the warning', async () => {
    const { FakeAudioContext, grantGesture } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { onAudioUnlockChange, primeAudio } = await freshModule()

    const seen = []
    onAudioUnlockChange(v => seen.push(v))

    await primeAudio()          // still blocked — no change, no callback
    expect(seen).toEqual([])

    grantGesture()
    await primeAudio()
    expect(seen).toEqual([true])

    await primeAudio()          // already unlocked — must not re-fire
    expect(seen).toEqual([true])
  })

  it('stops calling a listener that unsubscribed', async () => {
    const { FakeAudioContext, grantGesture } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { onAudioUnlockChange, primeAudio } = await freshModule()
    const seen = []
    onAudioUnlockChange(v => seen.push(v))()
    grantGesture()
    await primeAudio()
    expect(seen).toEqual([])
  })

  it('survives a listener that throws', async () => {
    const { FakeAudioContext, grantGesture } = makeAudioContextClass()
    vi.stubGlobal('window', makeWindow(FakeAudioContext))
    const { onAudioUnlockChange, primeAudio } = await freshModule()
    const seen = []
    onAudioUnlockChange(() => { throw new Error('a stale React setState') })
    onAudioUnlockChange(v => seen.push(v))
    grantGesture()
    expect(await primeAudio()).toBe(true)
    expect(seen).toEqual([true])
  })
})

describe('environments without Web Audio', () => {
  it('does not throw on the server, where there is no window', async () => {
    const { playSiren, primeAudio, installAudioPrimer, isAudioUnlocked } = await freshModule()
    expect(await playSiren()).toBe(false)
    expect(await primeAudio()).toBe(false)
    expect(isAudioUnlocked()).toBe(false)
    expect(() => installAudioPrimer()()).not.toThrow()
  })

  it('gives up quietly when the browser has no AudioContext at all', async () => {
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
    const { playSiren, primeAudio } = await freshModule()
    expect(await playSiren()).toBe(false)
    expect(await primeAudio()).toBe(false)
  })

  it('survives a constructor that throws', async () => {
    class Exploding { constructor() { throw new Error('blocked by policy') } }
    vi.stubGlobal('window', makeWindow(Exploding))
    const { playSiren } = await freshModule()
    expect(await playSiren()).toBe(false)
  })
})
