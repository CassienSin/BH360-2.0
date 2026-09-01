import { describe, it, expect } from 'vitest'
import {
  isVerified, canRequestDocuments, documentBlockReason, verificationStyle, VERIFICATION_STYLE,
} from '@/lib/verification'

describe('who may have a document issued in their name', () => {
  it('lets a verified resident through', () => {
    expect(canRequestDocuments({ role: 'resident', verification_status: 'verified' })).toBe(true)
  })

  it('blocks an unverified resident', () => {
    expect(canRequestDocuments({ role: 'resident', verification_status: 'pending' })).toBe(false)
    expect(canRequestDocuments({ role: 'resident', verification_status: 'rejected' })).toBe(false)
  })

  it('lets officials and tanods through even while their own status is pending', () => {
    // They reached their role through an invite code the barangay issued,
    // which is already a manual check by a named person. This is the rule
    // public.am_verified() has to mirror; when it did not, the UI enabled the
    // form and the database then refused the insert.
    expect(canRequestDocuments({ role: 'official', verification_status: 'pending' })).toBe(true)
    expect(canRequestDocuments({ role: 'tanod', verification_status: 'pending' })).toBe(true)
  })

  it('lets the super admin through', () => {
    expect(canRequestDocuments({ role: 'resident', is_super_admin: true })).toBe(true)
  })

  it('refuses a missing profile rather than defaulting open', () => {
    expect(canRequestDocuments(null)).toBe(false)
    expect(canRequestDocuments(undefined)).toBe(false)
    expect(canRequestDocuments({})).toBe(false)
  })

  it('treats an unknown status as unverified, never as verified', () => {
    expect(isVerified({ role: 'resident', verification_status: 'approved' })).toBe(false)
    expect(isVerified({ role: 'resident' })).toBe(false)
  })
})

describe('the reason shown to the person being blocked', () => {
  it('is null when nothing is blocking them', () => {
    expect(documentBlockReason({ role: 'resident', verification_status: 'verified' })).toBeNull()
  })

  it('says an official still has to check, and that reporting is unaffected', () => {
    const reason = documentBlockReason({ role: 'resident', verification_status: 'pending' })
    expect(reason).toMatch(/official/i)
    expect(reason).toMatch(/report/i)
  })

  it('passes on the official’s own words when there was a rejection', () => {
    const reason = documentBlockReason({
      role: 'resident', verification_status: 'rejected',
      verification_note: 'Address is outside the barangay',
    })
    expect(reason).toContain('Address is outside the barangay')
  })

  it('still explains a rejection that came with no note', () => {
    const reason = documentBlockReason({ role: 'resident', verification_status: 'rejected' })
    expect(reason).toMatch(/barangay hall/i)
  })
})

describe('verificationStyle', () => {
  it('has a style for each real status', () => {
    for (const s of ['verified', 'pending', 'rejected']) {
      expect(VERIFICATION_STYLE[s], s).toBeTruthy()
    }
  })

  it('falls back to pending for null or unknown — never to verified', () => {
    expect(verificationStyle(null)).toBe(VERIFICATION_STYLE.pending)
    expect(verificationStyle('whatever')).toBe(VERIFICATION_STYLE.pending)
  })
})
