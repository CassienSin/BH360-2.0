import { notFound } from 'next/navigation'
import OfficialPreview from './OfficialPreview'

export const metadata = { title: 'Crafted official · BH360' }

/** /dev/crafted/official?section=… — the official sections with invented sample data. Development only. */
export default async function Page({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { section } = await searchParams
  return <OfficialPreview initial={section || 'dashboard'} />
}
