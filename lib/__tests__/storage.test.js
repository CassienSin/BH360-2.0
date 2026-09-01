import { describe, it, expect } from 'vitest'
import { incidentImagePath, INCIDENT_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/storage'

describe('incidentImagePath — legacy and current values both have to work', () => {
  const uid = 'aaaaaaaa-1111-2222-3333-444444444444'

  it('extracts the object path from a legacy public URL', () => {
    expect(incidentImagePath(
      `https://abc.supabase.co/storage/v1/object/public/${INCIDENT_BUCKET}/${uid}/1700-x.jpg`
    )).toBe(`${uid}/1700-x.jpg`)
  })

  it('extracts it from an already-signed URL, dropping the token', () => {
    expect(incidentImagePath(
      `https://abc.supabase.co/storage/v1/object/sign/${INCIDENT_BUCKET}/${uid}/x.jpg?token=eyJhbGci`
    )).toBe(`${uid}/x.jpg`)
  })

  it('passes a bare path through — what new uploads store', () => {
    expect(incidentImagePath(`${uid}/1700-x.jpg`)).toBe(`${uid}/1700-x.jpg`)
  })

  it('keeps nested folders, so resolution proof still resolves', () => {
    expect(incidentImagePath(`${uid}/resolutions/x.jpg`)).toBe(`${uid}/resolutions/x.jpg`)
  })

  it('strips a leading slash', () => {
    expect(incidentImagePath(`/${uid}/x.jpg`)).toBe(`${uid}/x.jpg`)
  })

  it('preserves the uploader folder, which the storage policy authorises against', () => {
    // The read policy compares (storage.foldername(name))[1] to the viewer's
    // barangay via the uploader, so losing this segment would deny everyone.
    const path = incidentImagePath(
      `https://abc.supabase.co/storage/v1/object/public/${INCIDENT_BUCKET}/${uid}/x.jpg`)
    expect(path.split('/')[0]).toBe(uid)
  })

  it('returns null for anything empty rather than a broken path', () => {
    for (const v of [null, undefined, '', '   ', 42, {}]) {
      expect(incidentImagePath(v), String(v)).toBeNull()
    }
  })
})

describe('signed URL lifetime', () => {
  it('expires within the hour, so a shared link stops working', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThan(0)
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600)
  })
})
