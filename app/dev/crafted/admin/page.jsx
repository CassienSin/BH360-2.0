import { notFound } from 'next/navigation'
import AdminPreview from './AdminPreview'

export const metadata = { title: 'Crafted admin · BH360' }

/** /dev/crafted/admin — the A01 applications split view with invented data. Development only. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <AdminPreview />
}
