import { createClient } from './supabase'

const supabase = createClient()

export async function getProvinces() {
  const { data } = await supabase.rpc('get_distinct_provinces')
  return data?.map(r => r.province) || []
}

export async function getCities(province) {
  if (!province) return []
  const { data } = await supabase.rpc('get_distinct_cities', { p_province: province })
  return data?.map(r => r.city) || []
}

export async function getBarangays(province, city) {
  if (!province || !city) return []
  const { data } = await supabase
    .from('barangays')
    .select('id, name')
    .eq('province', province)
    .eq('city', city)
    .order('name')
  return data || []
}

export async function getBarangayById(id) {
  const { data } = await supabase
    .from('barangays')
    .select('*')
    .eq('id', id)
    .single()
  return data
}