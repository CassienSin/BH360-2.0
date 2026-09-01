import { describe, it, expect, afterEach, vi } from 'vitest'
import { urlBase64ToUint8Array, pushSupport } from '@/lib/push'

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to raw bytes', () => {
    // PushManager rejects anything that is not the exact 65-byte
    // uncompressed P-256 point, so length is the thing that matters.
    const key = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04) // uncompressed point marker
  })

  it('translates the URL-safe alphabet back to standard base64', () => {
    // '-' and '_' stand in for '+' and '/'; decoding them literally yields
    // different bytes and a subscription that silently never arrives.
    expect(Array.from(urlBase64ToUint8Array('-_8='))).toEqual([251, 255])
  })

  it('restores the padding base64url strips', () => {
    expect(Array.from(urlBase64ToUint8Array('AQAB'))).toEqual([1, 0, 1])
    expect(Array.from(urlBase64ToUint8Array('AQI'))).toEqual([1, 2])
    expect(Array.from(urlBase64ToUint8Array('AQ'))).toEqual([1])
  })
})

describe('pushSupport', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports unsupported on the server rather than throwing', () => {
    // This module is imported by a client component that Next also renders
    // on the server, where window does not exist.
    expect(pushSupport()).toEqual({ supported: false, reason: null, needsInstall: false })
  })

  it('tells an iPhone user to install rather than "unsupported"', () => {
    // iOS Safari exposes no PushManager in a tab but does once the app is on
    // the Home Screen. "Unsupported" would be a dead end they cannot escape.
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), navigator: {} })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: false })
    const s = pushSupport()
    expect(s.supported).toBe(false)
    expect(s.needsInstall).toBe(true)
    expect(s.reason).toMatch(/Home Screen/i)
  })

  it('does not blame the browser when the deployment has no VAPID key', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), PushManager: function () {} })
    vi.stubGlobal('navigator', { serviceWorker: {}, userAgent: 'Chrome' })
    const s = pushSupport()
    expect(s.supported).toBe(false)
    expect(s.needsInstall).toBe(false)
    expect(s.reason).toMatch(/not configured/i)
  })
})
