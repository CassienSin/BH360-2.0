import { describe, it, expect } from 'vitest'
import { postLoginPath } from '../loginRedirect'

const official = { role: 'official' }
const resident = { role: 'resident' }
const admin = { role: 'official', is_super_admin: true }
const q = next => `?next=${encodeURIComponent(next)}`

describe('postLoginPath', () => {
  it('returns to the page and section the user was on', () => {
    expect(postLoginPath(official, q('/official?section=incidents'))).toBe('/official?section=incidents')
    expect(postLoginPath(official, q('/official/incident/abc'))).toBe('/official/incident/abc')
    expect(postLoginPath(resident, q('/resident?section=tickets'))).toBe('/resident?section=tickets')
  })

  it('allows the shared pages for every role', () => {
    expect(postLoginPath(resident, q('/profile?tab=security'))).toBe('/profile?tab=security')
    expect(postLoginPath(official, q('/help'))).toBe('/help')
  })

  it('falls back to the dashboard without a next param', () => {
    expect(postLoginPath(official, '')).toBe('/official')
    expect(postLoginPath(admin, '')).toBe('/admin')
  })

  it("never sends a user into another role's area", () => {
    expect(postLoginPath(resident, q('/official?section=users'))).toBe('/resident')
    expect(postLoginPath(official, q('/admin'))).toBe('/official')
    expect(postLoginPath(resident, q('/residentx'))).toBe('/resident')
  })

  it('rejects off-site and malformed targets', () => {
    expect(postLoginPath(official, q('https://evil.example/official'))).toBe('/official')
    expect(postLoginPath(official, q('//evil.example/official'))).toBe('/official')
    expect(postLoginPath(official, q('/\\evil.example'))).toBe('/official')
    expect(postLoginPath(official, q('official'))).toBe('/official')
    expect(postLoginPath(resident, q('/resident/../official'))).toBe('/resident')
    expect(postLoginPath(resident, q('/resident/%2e%2e/official'))).toBe('/resident')
  })
})
