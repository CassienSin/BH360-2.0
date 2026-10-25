import { describe, it, expect } from 'vitest'
import { checkPassword, PASSWORD_RULES } from '../passwordRules'

describe('checkPassword', () => {
  it('accepts a password that meets every rule', () => {
    const r = checkPassword('Barangay#2026')
    expect(r.ok).toBe(true)
    expect(r.score).toBe(PASSWORD_RULES.length)
  })

  it('reports each missing rule', () => {
    const r = checkPassword('barangay')
    expect(r.ok).toBe(false)
    expect(r.checks).toEqual({ length: true, uppercase: false, lowercase: true, number: false, symbol: false })
    expect(r.score).toBe(2)
  })

  it('rejects short passwords even with every character type', () => {
    expect(checkPassword('Ab1!').ok).toBe(false)
  })

  it('treats a missing password as empty', () => {
    expect(checkPassword().score).toBe(0)
  })
})
