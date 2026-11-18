import { notFound } from 'next/navigation'
import FramePreview from './FramePreview'

export const metadata = { title: 'Crafted frame · BH360' }

/** /dev/crafted/frame?role=official|resident|tanod — the dashboard shell with sample data. Development only. */
export default async function Page({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { role } = await searchParams
  return <FramePreview role={['official', 'resident', 'tanod'].includes(role) ? role : 'official'} />
}
