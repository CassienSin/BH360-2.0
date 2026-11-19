'use client'
import { useState } from 'react'
import ApplicationsSection from '@/components/admin/ApplicationsSection'
import { useHydrated } from '@/lib/useHydrated'

// Invented sample data: nothing is read from or written to Supabase.
function fixtures() {
  const ago = h => new Date(Date.now() - h * 3600e3).toISOString()
  const brgy = (name) => ({ name, city: 'Sample City', province: 'Sample Province' })
  return [
    { id: 'p1', status: 'pending', full_name: 'Applicant One', position: 'Punong Barangay', email: 'one@example.com', phone: '09000000001', barangays: brgy('Sample One'), message: 'We would like to use the app for our barangay.', created_at: ago(2) },
    { id: 'p2', status: 'pending', full_name: 'Applicant Two', position: 'Barangay Secretary', email: 'two@example.com', phone: '09000000002', barangays: brgy('Sample Two'), created_at: ago(26) },
    { id: 'a1', status: 'approved', full_name: 'Applicant Three', position: 'Punong Barangay', email: 'three@example.com', phone: '09000000003', barangays: brgy('Sample Three'), generated_code: 'SMP-OFF-0003', created_at: ago(100) },
    { id: 'r1', status: 'rejected', full_name: 'Applicant Four', position: 'Kagawad', email: 'four@example.com', phone: '09000000004', barangays: brgy('Sample Four'), rejection_reason: 'Could not confirm the resolution.', created_at: ago(200) },
  ]
}
const noop = () => {}

export default function AdminPreview() {
  const hydrated = useHydrated()
  const [filter, setFilter] = useState('pending')
  if (!hydrated) return null
  const all = fixtures()
  const apps = all.filter(a => filter === 'all' || a.status === filter)
  return (
    <div className="min-h-dvh bg-page p-7">
      <div className="mx-auto max-w-[1180px]">
        <ApplicationsSection apps={apps} counts={{ pending: 2 }} filter={filter} onFilter={setFilter} search="" onSearch={noop}
          processing={false} onApprove={noop} onReject={noop} onCopy={noop}
          emailLinks={() => ({ gmail: '#', outlook: '#', mailto: '#' })} inviteEmail={() => ({ to: '', subject: '', body: '' })} />
      </div>
    </div>
  )
}
