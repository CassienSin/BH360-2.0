/**
 * Manual resident verification.
 *
 * Signing up proves someone controls an email address. It does not prove
 * they live in the barangay — and the barangay is the body that is supposed
 * to know. Under RA 7160 Sec. 394 the barangay secretary keeps the record
 * of the barangay's inhabitants and reports the actual number of residents,
 * so a human official confirms each account against that record.
 *
 * WHAT VERIFICATION GATES, AND WHAT IT DELIBERATELY DOES NOT:
 *
 *   Gated      — document requests. A barangay clearance or certificate of
 *                residency is an official attestation about a person; the
 *                barangay cannot honestly certify someone it has not
 *                checked.
 *
 *   NOT gated  — incident reporting, tickets, announcements, the AI
 *                assistant. Turning away an emergency report because the
 *                paperwork is still pending would be indefensible, and no
 *                law asks for it. An unverified account can still call for
 *                help.
 *
 * The status itself is only ever written by public.set_verification_status()
 * (see supabase/setup.sql), which requires the caller to be an official of
 * the same barangay or a super admin, and refuses self-verification.
 */

export const VERIFICATION_STYLE = {
  verified: {
    label: 'Verified',
    short: 'Verified',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#dcfce7',
    icon: '✅',
  },
  pending: {
    label: 'Pending verification',
    short: 'Pending',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fef3c7',
    icon: '⏳',
  },
  rejected: {
    label: 'Verification rejected',
    short: 'Rejected',
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca',
    icon: '⛔',
  },
}

/** Treat an unknown/missing status as pending — never as verified. */
export function verificationStyle(status) {
  return VERIFICATION_STYLE[status] || VERIFICATION_STYLE.pending
}

export function isVerified(profile) {
  return profile?.verification_status === 'verified'
}

/**
 * Whether this account may request barangay documents. Officials and tanods
 * reached their role through an invite code the barangay itself issued,
 * which is already a manual check by a named person.
 */
export function canRequestDocuments(profile) {
  if (!profile) return false
  if (profile.is_super_admin) return true
  if (profile.role === 'official' || profile.role === 'tanod') return true
  return isVerified(profile)
}

/** Why a request is blocked, phrased for the person it is blocking. */
export function documentBlockReason(profile) {
  if (canRequestDocuments(profile)) return null
  if (profile?.verification_status === 'rejected') {
    return profile.verification_note
      ? `A barangay official could not verify your account: ${profile.verification_note}`
      : 'A barangay official could not verify your account. Please visit the barangay hall to sort this out.'
  }
  return 'A barangay official still has to verify that you live in this barangay before '
       + 'documents can be issued in your name. You can keep reporting incidents in the meantime.'
}
