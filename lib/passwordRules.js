// One set of password rules for every screen that sets a password
// (sign-up and reset), so a reset can't accept a password sign-up rejects.

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lowercase', label: 'One lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'One number (0-9)', test: (pw) => /[0-9]/.test(pw) },
  { key: 'symbol', label: 'One symbol (!@#$%^&*)', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
]

/** @returns {{ checks: Record<string, boolean>, score: number, ok: boolean }} */
export function checkPassword(password = '') {
  const checks = Object.fromEntries(PASSWORD_RULES.map(r => [r.key, r.test(password)]))
  const score = Object.values(checks).filter(Boolean).length
  return { checks, score, ok: score === PASSWORD_RULES.length }
}
