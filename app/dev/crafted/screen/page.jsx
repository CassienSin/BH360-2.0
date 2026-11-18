import { notFound } from 'next/navigation'
import ScreenPreview from './ScreenPreview'

export const metadata = { title: 'Crafted phone screen · BH360' }

/** /dev/crafted/screen — a standalone screen on the band with a footer bar. Development only. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ScreenPreview />
}
