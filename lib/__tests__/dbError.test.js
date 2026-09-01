import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isMissingSchemaObject, firstRealError } from '@/lib/dbError'

const schemaCacheError = {
  code: 'PGRST205',
  message: "Could not find the table 'public.blotter_cases' in the schema cache",
}
const realError = { code: '42501', message: 'permission denied for table incidents' }

describe('isMissingSchemaObject', () => {
  it('recognises a table missing from the PostgREST schema cache', () => {
    expect(isMissingSchemaObject(schemaCacheError)).toBe(true)
  })

  it('recognises a missing function, and Postgres’s own undefined codes', () => {
    expect(isMissingSchemaObject({ code: 'PGRST202', message: 'no function' })).toBe(true)
    expect(isMissingSchemaObject({ code: '42P01', message: 'relation does not exist' })).toBe(true)
    expect(isMissingSchemaObject({ code: '42883', message: 'function does not exist' })).toBe(true)
  })

  it('falls back to the message when no code is set', () => {
    expect(isMissingSchemaObject({ message: 'relation "x" does not exist' })).toBe(true)
  })

  it('does not mistake a permission or network failure for a missing table', () => {
    expect(isMissingSchemaObject(realError)).toBe(false)
    expect(isMissingSchemaObject({ message: 'Failed to fetch' })).toBe(false)
  })

  it('handles null', () => {
    expect(isMissingSchemaObject(null)).toBe(false)
    expect(isMissingSchemaObject(undefined)).toBe(false)
  })
})

describe('firstRealError', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('stays silent when the only failure is a table that is not deployed yet', () => {
    // The exact case from the screenshot: the blotter query fails because
    // setup.sql has not been run, and everything else on the dashboard is
    // fine. The resident should see nothing.
    const results = [{ data: [] }, { data: [] }, { error: schemaCacheError }]
    expect(firstRealError(results, 'the resident dashboard')).toBeNull()
  })

  it('logs the missing tables for whoever is doing the deploying', () => {
    firstRealError([{ error: schemaCacheError }], 'the resident dashboard')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('supabase/setup.sql'))
  })

  it('still surfaces a real failure', () => {
    expect(firstRealError([{ error: realError }])).toBe(realError)
  })

  it('prefers the real failure when both kinds are present', () => {
    expect(firstRealError([{ error: schemaCacheError }, { error: realError }])).toBe(realError)
  })

  it('returns null when nothing failed', () => {
    expect(firstRealError([{ data: [] }, { data: [] }])).toBeNull()
  })
})
