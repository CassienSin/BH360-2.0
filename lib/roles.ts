export type Profile = {
  is_super_admin?: boolean
  role?: string
} | null

export function dashboardPath(profile: Profile) {
  if (profile?.is_super_admin) return '/admin'
  if (profile?.role === 'official') return '/official'
  if (profile?.role === 'tanod') return '/tanod'
  return '/resident'
}