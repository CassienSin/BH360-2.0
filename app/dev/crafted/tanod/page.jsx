import { notFound } from 'next/navigation'
import TanodPreview from './TanodPreview'

export const metadata = { title: 'Crafted tanod · BH360' }

/** /dev/crafted/tanod?view=duty|active|done|stats|assignment|resolve — the tanod screens with invented data. Development only. */
export default async function Page({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { view } = await searchParams
  return <TanodPreview view={view || 'duty'} />
}
