import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🚀 Starting PSGC import...')
console.log('📥 Fetching data from psgc.gitlab.io...\n')

const [regions, provinces, cities, barangays] = await Promise.all([
  fetch('https://psgc.gitlab.io/api/regions/').then(r => r.json()),
  fetch('https://psgc.gitlab.io/api/provinces/').then(r => r.json()),
  fetch('https://psgc.gitlab.io/api/cities-municipalities/').then(r => r.json()),
  fetch('https://psgc.gitlab.io/api/barangays/').then(r => r.json()),
])

console.log(`📦 Fetched:`)
console.log(`   ${regions.length} regions`)
console.log(`   ${provinces.length} provinces`)
console.log(`   ${cities.length} cities/municipalities`)
console.log(`   ${barangays.length} barangays\n`)

const regionMap = Object.fromEntries(regions.map(r => [r.code, r.name]))
const provinceMap = Object.fromEntries(provinces.map(p => [p.code, p]))
const cityMap = Object.fromEntries(cities.map(c => [c.code, c]))

const data = barangays.map(b => {
  const city = cityMap[b.cityCode] || cityMap[b.municipalityCode]
  const province = city?.provinceCode ? provinceMap[city.provinceCode] : null
  const regionCode = province?.regionCode || city?.regionCode || b.regionCode

  return {
    psgc_code: b.code,
    name: b.name,
    city: city?.name || 'N/A',
    province: province?.name || regionMap[regionCode] || 'NCR',
    region: regionMap[regionCode] || 'Unknown',
  }
})

console.log(`💾 Inserting ${data.length} barangays in batches of 500...\n`)

const batchSize = 500
let inserted = 0
let failed = 0

for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize)
  const { error } = await supabase.from('barangays').insert(batch)
  if (error) {
    console.error(`\n❌ Batch ${i}: ${error.message}`)
    failed += batch.length
  } else {
    inserted += batch.length
    process.stdout.write(`\r✅ ${inserted}/${data.length} (${Math.round(inserted/data.length*100)}%)`)
  }
}

console.log(`\n\n🎉 Done!`)
console.log(`   Inserted: ${inserted}`)
console.log(`   Failed: ${failed}\n`)

process.exit(0)