// Invented sample data for /dev/crafted/official. Nothing here is read from
// or written to Supabase, and none of it is real.
const now = Date.now()
const ago = h => new Date(now - h * 3600e3).toISOString()
const ahead = d => new Date(now + d * 24 * 3600e3).toISOString()

export const PROFILE = {
  id: 'me', role: 'official', full_name: 'Sample Official', barangay_id: 'b1',
  barangays: { id: 'b1', name: 'Sample Barangay', city: 'Sample City', province: 'Sample Province' },
}

export const TANODS = [
  { id: 't1', full_name: 'Tanod One', role: 'tanod', on_duty: true, last_seen_at: ago(0.1), verification_status: 'verified', created_at: ago(900) },
  { id: 't2', full_name: 'Tanod Two', role: 'tanod', on_duty: false, duty_changed_at: ago(5), verification_status: 'verified', created_at: ago(800) },
]

export const INCIDENTS = [
  { id: 'i1', title: 'Flooding near the creek', category: 'Flood', priority: 'Critical', status: 'pending', location: 'Riverside', description: 'Water is rising past the footbridge.', created_at: ago(0.07), profiles: { full_name: 'Resident Three' }, latitude: 10.38, longitude: 123.64 },
  { id: 'i2', title: 'Loud karaoke past curfew', category: 'Noise', priority: 'Low', status: 'assigned', assigned_to: 't1', acknowledged_at: ago(0.3), location: 'Purok 3', description: 'Still going at midnight.', created_at: ago(0.6), profiles: { full_name: 'Resident Four' } },
  { id: 'i3', title: 'Streetlight out on the main road', category: 'Infrastructure', priority: 'Medium', status: 'pending', location: 'Purok 2', description: 'Dark stretch near the chapel.', created_at: ago(5), profiles: { full_name: 'Resident One' } },
  { id: 'i4', title: 'Stray dogs by the school', category: 'Other', priority: 'Medium', status: 'resolved', assigned_to: 't2', location: 'Purok 1', description: 'Three dogs at the gate.', created_at: ago(30), resolved_at: ago(28), rating: 5, profiles: { full_name: 'Resident Two' } },
]

export const TICKETS = [
  { id: 'k1', title: 'Garbage not collected', category: 'Sanitation', status: 'open', description: 'Two weeks now.', created_at: ago(3), profiles: { full_name: 'Resident Two' } },
  { id: 'k2', title: 'Clearance for a job application', category: 'Documents', status: 'open', description: 'What do I bring?', created_at: ago(1), profiles: { full_name: 'Resident One' } },
  { id: 'k3', title: 'Water interruption schedule', category: 'Utilities', status: 'in_progress', description: 'When is the next one?', created_at: ago(26), profiles: { full_name: 'Resident Five' } },
  { id: 'k4', title: 'Barangay ID replacement', category: 'Documents', status: 'closed', description: 'Lost my ID.', created_at: ago(120), profiles: { full_name: 'Resident Four' } },
]

export const USERS = [
  PROFILE,
  ...TANODS,
  { id: 'u1', full_name: 'Resident Six', role: 'resident', verification_status: 'pending', created_at: ago(4), address: 'Purok 4', phone: '09000000001' },
  { id: 'u2', full_name: 'Resident Seven', role: 'resident', verification_status: 'pending', created_at: ago(28), address: 'Purok 1', phone: '09000000002' },
  { id: 'u3', full_name: 'Resident One', role: 'resident', verification_status: 'verified', created_at: ago(600), address: 'Purok 2' },
]

export const DOCUMENTS = [
  { id: 'd1', document_type: 'barangay_clearance', status: 'pending', purpose: 'Employment', created_at: ago(80), due_at: ago(4), profiles: { full_name: 'Resident One', phone: '09000000003' } },
  { id: 'd2', document_type: 'certificate_of_residency', status: 'processing', purpose: 'School', created_at: ago(20), due_at: ahead(1), profiles: { full_name: 'Resident Two' } },
  { id: 'd3', document_type: 'certificate_of_indigency', status: 'ready', purpose: 'Medical assistance', created_at: ago(50), due_at: ahead(2), profiles: { full_name: 'Resident Five' } },
]

export const CASES = [
  { id: 'c1', case_number: 'KP-SAMPLE-0001', nature: 'Unpaid debt', status: 'mediation', complainant_name: 'Resident One', respondent_name: 'Resident Two', filed_at: ago(400), mediation_due_at: ago(48) },
  { id: 'c2', case_number: 'KP-SAMPLE-0002', nature: 'Boundary dispute', status: 'pangkat', complainant_name: 'Resident Three', respondent_name: 'Resident Four', filed_at: ago(700), pangkat_due_at: ahead(9) },
]

export const ANNOUNCEMENTS = [
  { id: 'a1', title: 'Water interruption on Saturday', content: 'Purok 1 to 3, 9 AM to 3 PM, for pipe repairs.', priority: 'urgent', created_at: ago(2) },
  { id: 'a2', title: 'Clean-up drive this Sunday', content: 'Meet at the covered court at 6 AM.', priority: 'normal', created_at: ago(30) },
]

const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString() }
export const APPOINTMENTS = [
  { id: 'p1', title: 'Mediation hearing', participant_name: 'KP-SAMPLE-0001 · Lupon room', starts_at: at(9) },
  { id: 'p2', title: 'Clearance pickups', participant_name: null, starts_at: at(14) },
]
